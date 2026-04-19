import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Account, ApiKey } from '../../db/schema.js';
import { db } from '../../db/client.js';
import { usageLog } from '../../db/schema.js';
import { logger } from '../../utils/logger.js';
import {
  CLAUDE_UPSTREAM_BASE,
  CLAUDE_MESSAGES_PATH,
  claudeAuthHeaders,
} from '../oauth/claude.js';
import { ensureFreshAccessToken } from '../oauth/refresh.js';
import { incrementWindowUsage } from '../accounts/registry.js';
import { addWindowUsage } from '../accounts/quota.js';
import { applyClassification, classifyUpstream } from '../accounts/health.js';
import { recordKeyUsage } from '../users/quota.js';
import { debitForRequestSafe } from '../users/ledger.js';
import { computeCost } from '../pricing/index.js';
import { createUsageAccumulator } from './stream.js';
import { isOpen, recordRequest } from './breaker.js';
import { getDispatcher } from '../proxies/index.js';
import { relayLatencyMs, relayRequests, relayTokens, relayTtfbMs } from '../../utils/metrics.js';

export interface RelayContext {
  account: Account;
  apiKey: ApiKey;
}

interface AnthropicMessagesBody {
  model?: unknown;
  stream?: unknown;
  [key: string]: unknown;
}

export async function relayMessages(
  req: FastifyRequest,
  reply: FastifyReply,
  ctx: RelayContext,
): Promise<void> {
  const body = req.body as AnthropicMessagesBody;
  const model = typeof body.model === 'string' ? body.model : 'unknown';
  const streaming = body.stream === true;
  const startedAt = Date.now();

  if (await isOpen('claude')) {
    await logUsage(ctx, model, 0, 0, 503, 'circuit_open');
    return reply.code(503).send({
      type: 'error',
      error: { type: 'overloaded_error', message: 'upstream circuit open; try again shortly' },
    });
  }

  const accessToken = await ensureFreshAccessToken(ctx.account);
  if (!accessToken) {
    await logUsage(ctx, model, 0, Date.now() - startedAt, 503, 'needs_reauth');
    return reply.code(503).send({
      type: 'error',
      error: { type: 'overloaded_error', message: 'account needs reauth; pool try again' },
    });
  }

  const upstreamUrl = `${CLAUDE_UPSTREAM_BASE}${CLAUDE_MESSAGES_PATH}`;
  const dispatcher = await getDispatcher(ctx.account.proxyId);
  const clientBeta = req.headers['anthropic-beta'];
  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      method: 'POST',
      headers: claudeAuthHeaders(accessToken, clientBeta),
      body: JSON.stringify(body),
      ...(dispatcher ? { dispatcher } : {}),
    } as RequestInit);
  } catch (err) {
    logger.error({ err, accountId: ctx.account.id }, 'upstream fetch failed');
    await Promise.all([
      logUsage(ctx, model, 0, Date.now() - startedAt, 502, 'upstream_unreachable'),
      recordRequest('claude', true),
    ]);
    return reply.code(502).send({
      type: 'error',
      error: { type: 'api_error', message: 'upstream unreachable' },
    });
  }

  if (!upstream.ok) {
    const text = await upstream.text();
    const latencyMs = Date.now() - startedAt;
    const classification = classifyUpstream(upstream.status, upstream.headers.get('retry-after'), text);
    await Promise.all([
      applyClassification(ctx.account, classification),
      logUsage(ctx, model, 0, latencyMs, upstream.status, classification.kind),
      recordRequest('claude', true),
    ]);
    relayRequests.inc({ provider: 'claude', route: 'messages', outcome: classification.kind });
    relayLatencyMs.observe({ provider: 'claude', route: 'messages' }, latencyMs);
    reply.code(upstream.status).header('content-type', 'application/json');
    return reply.send(safeJson(text) ?? { type: 'error', error: { type: 'api_error', message: text } });
  }

  if (streaming && upstream.body) {
    reply.hijack();
    const raw = reply.raw;
    raw.writeHead(upstream.status, {
      'Content-Type': upstream.headers.get('content-type') ?? 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const usage = createUsageAccumulator();
    usage.start();
    const reader = upstream.body.getReader();
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          usage.ingest(value);
          raw.write(Buffer.from(value));
        }
      }
    } catch (err) {
      logger.error({ err, accountId: ctx.account.id }, 'stream forwarding failed');
    } finally {
      raw.end();
      const latencyMs = Date.now() - startedAt;
      const totalInput =
        usage.inputTokens + usage.cacheReadTokens + usage.cacheCreationTokens;
      const total = totalInput + usage.outputTokens;
      const costMud = await computeCost(model, {
        inputTokens: usage.inputTokens,
        cacheReadTokens: usage.cacheReadTokens,
        cacheCreationTokens: usage.cacheCreationTokens,
        outputTokens: usage.outputTokens,
      }).catch(() => 0);
      logger.info(
        {
          accountId: ctx.account.id,
          model,
          latencyMs,
          ttfbMs: usage.ttfbMs,
          inputTokens: usage.inputTokens,
          cacheReadTokens: usage.cacheReadTokens,
          cacheCreationTokens: usage.cacheCreationTokens,
          outputTokens: usage.outputTokens,
          costMud,
          tokPerSec:
            usage.outputTokens > 0 && latencyMs > (usage.ttfbMs ?? 0)
              ? Math.round(
                  (usage.outputTokens * 1000) / (latencyMs - (usage.ttfbMs ?? 0)),
                )
              : null,
        },
        'relay_complete',
      );
      await Promise.all([
        logUsage(ctx, model, usage, latencyMs, 200, null, costMud),
        incrementWindowUsage(ctx.account.id, total).catch(() => {}),
        addWindowUsage(ctx.account.id, total).catch(() => {}),
        recordKeyUsage(ctx.apiKey.id, total).catch(() => {}),
        debitForRequestSafe(ctx.apiKey.id, costMud),
        recordRequest('claude', false),
      ]);
      relayRequests.inc({ provider: 'claude', route: 'messages', outcome: 'ok' });
      relayLatencyMs.observe({ provider: 'claude', route: 'messages' }, latencyMs);
      if (usage.ttfbMs !== null) {
        relayTtfbMs.observe({ provider: 'claude', route: 'messages' }, usage.ttfbMs);
      }
      relayTokens.inc({ provider: 'claude', direction: 'input' }, usage.inputTokens);
      relayTokens.inc({ provider: 'claude', direction: 'output' }, usage.outputTokens);
    }
    return;
  }

  const text = await upstream.text();
  const parsed = safeJson(text);
  const usageRaw = (parsed?.['usage'] ?? {}) as Record<string, unknown>;
  const num = (k: string) => (typeof usageRaw[k] === 'number' ? (usageRaw[k] as number) : 0);
  const usageBuckets = {
    inputTokens: num('input_tokens'),
    cacheReadTokens: num('cache_read_input_tokens'),
    cacheCreationTokens: num('cache_creation_input_tokens'),
    outputTokens: num('output_tokens'),
    ttfbMs: null as number | null,
  };
  const total =
    usageBuckets.inputTokens +
    usageBuckets.cacheReadTokens +
    usageBuckets.cacheCreationTokens +
    usageBuckets.outputTokens;
  const latencyMs = Date.now() - startedAt;
  const costMud = await computeCost(model, usageBuckets).catch(() => 0);
  await Promise.all([
    logUsage(ctx, model, usageBuckets, latencyMs, upstream.status, null, costMud),
    incrementWindowUsage(ctx.account.id, total).catch(() => {}),
    addWindowUsage(ctx.account.id, total).catch(() => {}),
    recordKeyUsage(ctx.apiKey.id, total).catch(() => {}),
    debitForRequestSafe(ctx.apiKey.id, costMud),
    recordRequest('claude', false),
  ]);
  relayRequests.inc({ provider: 'claude', route: 'messages', outcome: 'ok' });
  relayLatencyMs.observe({ provider: 'claude', route: 'messages' }, latencyMs);
  relayTokens.inc({ provider: 'claude', direction: 'input' }, usageBuckets.inputTokens);
  relayTokens.inc({ provider: 'claude', direction: 'output' }, usageBuckets.outputTokens);
  reply.code(upstream.status).header('content-type', 'application/json');
  return reply.send(parsed ?? text);
}

function safeJson(text: string): Record<string, unknown> | null {
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}

// A subset of UsageAccumulator used for error-path logging where the
// stream never produced usage numbers. Zero-valued fields are fine.
interface UsageLike {
  inputTokens: number;
  cacheReadTokens?: number;
  cacheCreationTokens?: number;
  outputTokens: number;
}

const EMPTY_USAGE: UsageLike = {
  inputTokens: 0,
  cacheReadTokens: 0,
  cacheCreationTokens: 0,
  outputTokens: 0,
};

async function logUsage(
  ctx: RelayContext,
  model: string,
  u: UsageLike | 0,
  latencyMs: number,
  status: number,
  errorCode: string | null,
  costMud: number = 0,
): Promise<void> {
  const usage = u === 0 ? EMPTY_USAGE : u;
  try {
    await db.insert(usageLog).values({
      apiKeyId: ctx.apiKey.id,
      accountId: ctx.account.id,
      provider: 'claude',
      model,
      inputTokens: usage.inputTokens,
      cacheReadTokens: usage.cacheReadTokens ?? 0,
      cacheCreationTokens: usage.cacheCreationTokens ?? 0,
      outputTokens: usage.outputTokens,
      latencyMs,
      status,
      errorCode,
      costMud,
    });
  } catch (err) {
    logger.warn({ err }, 'failed to persist usage_log entry');
  }
}
