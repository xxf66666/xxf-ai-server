import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Account } from '../../db/schema.js';
import type { ApiKey } from '../../db/schema.js';
import { db } from '../../db/client.js';
import { usageLog } from '../../db/schema.js';
import { logger } from '../../utils/logger.js';
import {
  CLAUDE_UPSTREAM_BASE,
  CLAUDE_MESSAGES_PATH,
  claudeAuthHeaders,
} from '../oauth/claude.js';
import { decryptAccessToken, incrementWindowUsage } from '../accounts/registry.js';
import { createUsageAccumulator } from './stream.js';

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

  const upstreamUrl = `${CLAUDE_UPSTREAM_BASE}${CLAUDE_MESSAGES_PATH}`;
  const accessToken = decryptAccessToken(ctx.account);

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      method: 'POST',
      headers: claudeAuthHeaders(accessToken),
      body: JSON.stringify(body),
    });
  } catch (err) {
    logger.error({ err, accountId: ctx.account.id }, 'upstream fetch failed');
    await logUsage(ctx, model, 0, 0, Date.now() - startedAt, 502, 'upstream_unreachable');
    return reply.code(502).send({
      type: 'error',
      error: { type: 'api_error', message: 'upstream unreachable' },
    });
  }

  // Non-2xx: forward status + body, translate to our error envelope when possible.
  if (!upstream.ok) {
    const text = await upstream.text();
    const latencyMs = Date.now() - startedAt;
    await logUsage(ctx, model, 0, 0, latencyMs, upstream.status, 'upstream_error');
    reply.code(upstream.status).header('content-type', 'application/json');
    return reply.send(safeJson(text) ?? { type: 'error', error: { type: 'api_error', message: text } });
  }

  // Streaming response: hijack the raw socket so Fastify doesn't buffer.
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
      const total = usage.inputTokens + usage.outputTokens;
      await Promise.all([
        logUsage(ctx, model, usage.inputTokens, usage.outputTokens, latencyMs, 200, null),
        incrementWindowUsage(ctx.account.id, total).catch(() => {}),
      ]);
    }
    return;
  }

  // Non-streaming: read the whole body, parse usage, forward JSON.
  const text = await upstream.text();
  const parsed = safeJson(text);
  const usage = (parsed?.['usage'] ?? {}) as Record<string, unknown>;
  const input = typeof usage.input_tokens === 'number' ? usage.input_tokens : 0;
  const output = typeof usage.output_tokens === 'number' ? usage.output_tokens : 0;
  const latencyMs = Date.now() - startedAt;
  await Promise.all([
    logUsage(ctx, model, input, output, latencyMs, upstream.status, null),
    incrementWindowUsage(ctx.account.id, input + output).catch(() => {}),
  ]);
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
  ctx: RelayContext,
  model: string,
  inputTokens: number,
  outputTokens: number,
  latencyMs: number,
  status: number,
  errorCode: string | null,
): Promise<void> {
  try {
    await db.insert(usageLog).values({
      apiKeyId: ctx.apiKey.id,
      accountId: ctx.account.id,
      provider: 'claude',
      model,
      inputTokens,
      outputTokens,
      latencyMs,
      status,
      errorCode,
    });
  } catch (err) {
    logger.warn({ err }, 'failed to persist usage_log entry');
  }
}
