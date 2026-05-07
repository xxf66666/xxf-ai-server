import type { FastifyReply, FastifyRequest } from 'fastify';
import type { ApiKey } from '../../db/schema.js';
import { db } from '../../db/client.js';
import { usageLog } from '../../db/schema.js';
import { logger } from '../../utils/logger.js';
import type { ProviderDef } from '../providers/registry.js';
import type { ProviderCredential } from '../providers/store.js';
import { recordKeyUsage } from '../users/quota.js';
import { debitForRequestSafe } from '../users/ledger.js';
import { computeCost } from '../pricing/index.js';
import { relayLatencyMs, relayRequests, relayTokens, relayTtfbMs } from '../../utils/metrics.js';

export interface OpenAICompatRelayContext {
  provider: ProviderDef;
  credential: ProviderCredential;
  apiKey: ApiKey;
  /** Verbatim model id the client sent; passed to upstream and to billing. */
  model: string;
  /** Full request body; forwarded as-is. */
  body: Record<string, unknown>;
}

/**
 * Forward a /v1/chat/completions request to a generic OpenAI-compatible
 * upstream (DeepSeek / Qwen / Kimi / Mistral / Gemini-OAI / etc).
 *
 * We deliberately do NOT translate the request shape — these vendors
 * already speak OpenAI Chat Completions natively; the only thing that
 * varies is the base URL, the auth header, and edge-case fields that
 * we forward verbatim.
 *
 * Streaming is byte-passthrough; usage accounting reads the standard
 * `{usage: {prompt_tokens, completion_tokens, ...}}` block from the
 * final chunk (or the non-streaming response body).
 */
export async function relayOpenAICompat(
  req: FastifyRequest,
  reply: FastifyReply,
  ctx: OpenAICompatRelayContext,
): Promise<void> {
  const startedAt = Date.now();
  const streaming = ctx.body.stream === true;
  const baseUrl = ctx.credential.baseUrlOverride || ctx.provider.baseUrl;
  const url = `${baseUrl}${ctx.provider.chatPath}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (ctx.provider.authHeader) {
    headers[ctx.provider.authHeader] = ctx.credential.apiKey;
  } else {
    headers['Authorization'] = `Bearer ${ctx.credential.apiKey}`;
  }

  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(ctx.body),
    });
  } catch (err) {
    logger.error({ err, slug: ctx.provider.slug }, 'openai-compat fetch failed');
    await logEntry(ctx, 0, 0, Date.now() - startedAt, 502, 'upstream_unreachable', 0);
    return reply.code(502).send({
      error: { type: 'api_error', message: 'upstream unreachable' },
    });
  }

  if (!upstream.ok) {
    const text = await upstream.text();
    const latencyMs = Date.now() - startedAt;
    await logEntry(ctx, 0, 0, latencyMs, upstream.status, 'upstream_error', 0);
    relayRequests.inc({
      provider: ctx.provider.slug,
      route: 'chat',
      outcome: 'upstream_error',
    });
    relayLatencyMs.observe({ provider: ctx.provider.slug, route: 'chat' }, latencyMs);
    reply.code(upstream.status).header('content-type', 'application/json');
    return reply.send(safeJson(text) ?? { error: { type: 'api_error', message: text } });
  }

  if (streaming && upstream.body) {
    reply.hijack();
    const raw = reply.raw;
    raw.writeHead(200, {
      'Content-Type': upstream.headers.get('content-type') ?? 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    let inputTokens = 0;
    let outputTokens = 0;
    let ttfbMs: number | null = null;
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        if (!value) continue;
        if (ttfbMs === null) ttfbMs = Date.now() - startedAt;
        raw.write(Buffer.from(value));
        buf += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf('\n\n')) !== -1) {
          const frame = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          // OpenAI-compat streams use `data: { ... }` lines; the final
          // chunk usually has the cumulative `usage` object.
          for (const line of frame.split('\n')) {
            if (!line.startsWith('data:')) continue;
            const data = line.slice(5).trim();
            if (!data || data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data) as Record<string, unknown>;
              const usage = parsed['usage'] as
                | { prompt_tokens?: number; completion_tokens?: number }
                | undefined;
              if (usage) {
                if (typeof usage.prompt_tokens === 'number')
                  inputTokens = usage.prompt_tokens;
                if (typeof usage.completion_tokens === 'number')
                  outputTokens = usage.completion_tokens;
              }
            } catch {
              /* ignore non-JSON */
            }
          }
        }
      }
    } catch (err) {
      logger.error({ err, slug: ctx.provider.slug }, 'openai-compat stream forward failed');
    } finally {
      raw.end();
      const latencyMs = Date.now() - startedAt;
      const costMud = await computeCost(ctx.model, {
        inputTokens,
        outputTokens,
      }).catch(() => 0);
      logger.info(
        {
          slug: ctx.provider.slug,
          model: ctx.model,
          latencyMs,
          ttfbMs,
          inputTokens,
          outputTokens,
          costMud,
        },
        'relay_complete',
      );
      await Promise.all([
        logEntry(ctx, inputTokens, outputTokens, latencyMs, 200, null, costMud),
        recordKeyUsage(ctx.apiKey.id, inputTokens + outputTokens).catch(() => {}),
        debitForRequestSafe(ctx.apiKey.id, costMud),
      ]);
      relayRequests.inc({ provider: ctx.provider.slug, route: 'chat', outcome: 'ok' });
      relayLatencyMs.observe({ provider: ctx.provider.slug, route: 'chat' }, latencyMs);
      if (ttfbMs !== null) {
        relayTtfbMs.observe({ provider: ctx.provider.slug, route: 'chat' }, ttfbMs);
      }
      relayTokens.inc({ provider: ctx.provider.slug, direction: 'input' }, inputTokens);
      relayTokens.inc({ provider: ctx.provider.slug, direction: 'output' }, outputTokens);
    }
    return;
  }

  // Non-streaming
  const text = await upstream.text();
  const parsed = safeJson(text);
  const usage = (parsed?.['usage'] ?? {}) as Record<string, unknown>;
  const inputTokens = typeof usage.prompt_tokens === 'number' ? usage.prompt_tokens : 0;
  const outputTokens =
    typeof usage.completion_tokens === 'number' ? usage.completion_tokens : 0;
  const latencyMs = Date.now() - startedAt;
  const costMud = await computeCost(ctx.model, { inputTokens, outputTokens }).catch(
    () => 0,
  );
  await Promise.all([
    logEntry(ctx, inputTokens, outputTokens, latencyMs, 200, null, costMud),
    recordKeyUsage(ctx.apiKey.id, inputTokens + outputTokens).catch(() => {}),
    debitForRequestSafe(ctx.apiKey.id, costMud),
  ]);
  relayRequests.inc({ provider: ctx.provider.slug, route: 'chat', outcome: 'ok' });
  relayLatencyMs.observe({ provider: ctx.provider.slug, route: 'chat' }, latencyMs);
  relayTokens.inc({ provider: ctx.provider.slug, direction: 'input' }, inputTokens);
  relayTokens.inc({ provider: ctx.provider.slug, direction: 'output' }, outputTokens);
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

async function logEntry(
  ctx: OpenAICompatRelayContext,
  inputTokens: number,
  outputTokens: number,
  latencyMs: number,
  status: number,
  errorCode: string | null,
  costMud: number,
): Promise<void> {
  try {
    await db.insert(usageLog).values({
      apiKeyId: ctx.apiKey.id,
      accountId: null, // shared API key — no per-user upstream account
      // usage_log.provider is a pgEnum (claude/chatgpt). We store the
      // closest match here; the model column carries the real id so
      // analytics can drill down by model.
      provider: 'chatgpt',
      model: ctx.model,
      inputTokens,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
      outputTokens,
      latencyMs,
      status,
      errorCode,
      costMud,
    });
  } catch (err) {
    logger.warn({ err }, 'openai-compat: failed to persist usage_log');
  }
}
