import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Account, ApiKey } from '../../db/schema.js';
import { db } from '../../db/client.js';
import { usageLog } from '../../db/schema.js';
import { logger } from '../../utils/logger.js';
import {
  CHATGPT_UPSTREAM_BASE,
  CHATGPT_RESPONSES_PATH,
  chatgptAuthHeaders,
  extractChatgptAccountId,
} from '../oauth/chatgpt.js';
import { ensureFreshAccessToken } from '../oauth/refresh.js';
import { incrementWindowUsage } from '../accounts/registry.js';
import { addWindowUsage } from '../accounts/quota.js';
import { applyClassification, classifyUpstream } from '../accounts/health.js';
import { recordKeyUsage } from '../users/quota.js';
import { debitForRequestSafe } from '../users/ledger.js';
import { computeCost } from '../pricing/index.js';
import { isOpen, recordRequest } from './breaker.js';
import { getDispatcher } from '../proxies/index.js';
import { relayLatencyMs, relayRequests, relayTokens } from '../../utils/metrics.js';

export interface ChatgptRelayContext {
  account: Account;
  apiKey: ApiKey;
  /** Original client-requested model id, as written in the request. */
  requestedModel: string;
  /** Already-translated OpenAI Responses-API body. */
  body: Record<string, unknown>;
}

/**
 * Relay to Codex CLI's Responses API using the ChatGPT Plus subscriber
 * OAuth token stored on `account`. Structurally a mirror of the Claude
 * relay: window bookkeeping, cost accounting, circuit breaker, upstream
 * error classification.
 *
 * ⚠️ The exact endpoint + response shape for Codex's backend is not
 * fully public. CHATGPT_RESPONSES_PATH and the expected response JSON
 * are best-effort and intentionally env-overridable so the operator can
 * adjust without a code release when OpenAI rotates surfaces.
 */
export async function relayChatgptResponses(
  req: FastifyRequest,
  reply: FastifyReply,
  ctx: ChatgptRelayContext,
): Promise<void> {
  const streaming = ctx.body.stream === true;
  const startedAt = Date.now();

  if (await isOpen('chatgpt')) {
    await logUsage(ctx, 0, 0, 0, 503, 'circuit_open');
    return reply.code(503).send({
      error: { type: 'overloaded_error', message: 'upstream circuit open; try again shortly' },
    });
  }

  const accessToken = await ensureFreshAccessToken(ctx.account);
  if (!accessToken) {
    await logUsage(ctx, 0, 0, Date.now() - startedAt, 503, 'needs_reauth');
    return reply.code(503).send({
      error: { type: 'overloaded_error', message: 'account needs reauth; try again' },
    });
  }

  // ChatGPT Account Id must be sent on every call. It's persisted in
  // metadata at attach time; fallback to extracting from access token.
  const chatgptAccountId =
    (ctx.account.metadata as Record<string, unknown>)?.chatgptAccountId as string | undefined
    ?? extractChatgptAccountId(accessToken)
    ?? '';
  const dispatcher = await getDispatcher(ctx.account.proxyId);
  const upstreamUrl = `${CHATGPT_UPSTREAM_BASE}${CHATGPT_RESPONSES_PATH}`;

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      method: 'POST',
      headers: chatgptAuthHeaders(accessToken, { chatgptAccountId }),
      body: JSON.stringify(ctx.body),
      ...(dispatcher ? { dispatcher } : {}),
    } as RequestInit);
  } catch (err) {
    logger.error({ err, accountId: ctx.account.id }, 'chatgpt relay upstream fetch failed');
    await Promise.all([
      logUsage(ctx, 0, 0, Date.now() - startedAt, 502, 'upstream_unreachable'),
      recordRequest('chatgpt', true),
    ]);
    return reply
      .code(502)
      .send({ error: { type: 'api_error', message: 'upstream unreachable' } });
  }

  if (!upstream.ok) {
    const text = await upstream.text();
    const latencyMs = Date.now() - startedAt;
    const classification = classifyUpstream(
      upstream.status,
      upstream.headers.get('retry-after'),
      text,
    );
    await Promise.all([
      applyClassification(ctx.account, classification),
      logUsage(ctx, 0, 0, latencyMs, upstream.status, classification.kind),
      recordRequest('chatgpt', true),
    ]);
    relayRequests.inc({
      provider: 'chatgpt',
      route: 'responses',
      outcome: classification.kind,
    });
    relayLatencyMs.observe({ provider: 'chatgpt', route: 'responses' }, latencyMs);
    reply.code(upstream.status).header('content-type', 'application/json');
    return reply.send(safeJson(text) ?? { error: { type: 'api_error', message: text } });
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

    // Responses API streams JSON deltas; we just byte-pipe for now.
    // Token accounting falls back to a final non-stream usage probe
    // later — good enough until we parse the delta format.
    const reader = upstream.body.getReader();
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) raw.write(Buffer.from(value));
      }
    } catch (err) {
      logger.error({ err, accountId: ctx.account.id }, 'chatgpt stream forwarding failed');
    } finally {
      raw.end();
      await Promise.all([
        logUsage(ctx, 0, 0, Date.now() - startedAt, 200, null),
        recordRequest('chatgpt', false),
      ]);
    }
    return;
  }

  const text = await upstream.text();
  const parsed = safeJson(text);
  // Responses API returns usage as { input_tokens, output_tokens }.
  // Field naming may drift; keep lookup defensive.
  const usage = (parsed?.['usage'] ?? {}) as Record<string, unknown>;
  const input =
    typeof usage.input_tokens === 'number'
      ? usage.input_tokens
      : typeof usage.prompt_tokens === 'number'
        ? usage.prompt_tokens
        : 0;
  const output =
    typeof usage.output_tokens === 'number'
      ? usage.output_tokens
      : typeof usage.completion_tokens === 'number'
        ? usage.completion_tokens
        : 0;
  const total = input + output;
  const latencyMs = Date.now() - startedAt;
  const costMud = await computeCost(ctx.requestedModel, input, output).catch(() => 0);
  await Promise.all([
    logUsage(ctx, input, output, latencyMs, upstream.status, null, costMud),
    incrementWindowUsage(ctx.account.id, total).catch(() => {}),
    addWindowUsage(ctx.account.id, total).catch(() => {}),
    recordKeyUsage(ctx.apiKey.id, total).catch(() => {}),
    debitForRequestSafe(ctx.apiKey.id, costMud),
    recordRequest('chatgpt', false),
  ]);
  relayRequests.inc({ provider: 'chatgpt', route: 'responses', outcome: 'ok' });
  relayLatencyMs.observe({ provider: 'chatgpt', route: 'responses' }, latencyMs);
  relayTokens.inc({ provider: 'chatgpt', direction: 'input' }, input);
  relayTokens.inc({ provider: 'chatgpt', direction: 'output' }, output);
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

async function logUsage(
  ctx: ChatgptRelayContext,
  inputTokens: number,
  outputTokens: number,
  latencyMs: number,
  status: number,
  errorCode: string | null,
  costMud: number = 0,
): Promise<void> {
  try {
    await db.insert(usageLog).values({
      apiKeyId: ctx.apiKey.id,
      accountId: ctx.account.id,
      provider: 'chatgpt',
      model: ctx.requestedModel,
      inputTokens,
      outputTokens,
      latencyMs,
      status,
      errorCode,
      costMud,
    });
  } catch (err) {
    logger.warn({ err }, 'chatgpt relay: failed to persist usage_log entry');
  }
}
