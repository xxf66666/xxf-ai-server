import { randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { env } from '../../config/env.js';
import { pickAccount } from '../../core/accounts/pool.js';
import { requireApiKey } from '../../core/users/auth.js';
import { keyAllowsModel } from '../../core/users/keys.js';
import { recordKeyUsage } from '../../core/users/quota.js';
import { incrementWindowUsage } from '../../core/accounts/registry.js';
import { addWindowUsage } from '../../core/accounts/quota.js';
import { applyClassification, classifyUpstream } from '../../core/accounts/health.js';
import { isOpen, recordRequest } from '../../core/relay/breaker.js';
import { getDispatcher } from '../../core/proxies/index.js';
import { computeCost } from '../../core/pricing/index.js';
import { debitForRequestSafe } from '../../core/users/ledger.js';
import {
  CLAUDE_MESSAGES_PATH,
  CLAUDE_UPSTREAM_BASE,
  claudeAuthHeaders,
} from '../../core/oauth/claude.js';
import { ensureFreshAccessToken } from '../../core/oauth/refresh.js';
import { db } from '../../db/client.js';
import { usageLog } from '../../db/schema.js';
import { logger } from '../../utils/logger.js';
import {
  resolveModel,
  translateChatToResponses,
  translateRequest,
  translateResponse,
  translateStreamEvent,
} from '../../core/relay/openai-translate.js';
import { relayChatgptResponses } from '../../core/relay/chatgpt.js';

function authFingerprint(auth: string | undefined): string {
  if (!auth) return 'anon';
  return createHash('sha256').update(auth).digest('hex').slice(0, 32);
}

export async function registerOpenAI(app: FastifyInstance): Promise<void> {
  app.post(
    '/v1/chat/completions',
    {
      preHandler: requireApiKey,
      config: {
        rateLimit: {
          max: env.RATE_LIMIT_MAX,
          timeWindow: env.RATE_LIMIT_WINDOW_SECONDS * 1000,
          keyGenerator: (req) => authFingerprint(req.headers.authorization),
        },
      },
    },
    async (req, reply) => {
      const body = req.body as Parameters<typeof translateRequest>[0];
      const requestedModel = body?.model ?? 'gpt-5';
      const anthropicBody = translateRequest(body);
      const streaming = anthropicBody.stream === true;
      const startedAt = Date.now();

      if (await isOpen('claude')) {
        return reply.code(503).send({
          error: { type: 'overloaded_error', message: 'upstream circuit open; try again shortly' },
        });
      }

      const apiKey = req.apiKey!;
      // Whitelist is checked against the user-requested model (gpt-5
      // etc.), NOT the translated claude-* target. Consumers think in
      // OpenAI model ids when they scope a key.
      if (!keyAllowsModel(apiKey, requestedModel)) {
        return reply.code(403).send({
          error: {
            type: 'permission_error',
            message: `this api key is not allowed to call model ${requestedModel}`,
          },
        });
      }

      // Dispatcher: when CHATGPT_RELAY_ENABLED is on and a chatgpt
      // account pool exists, route gpt-*/o3* calls to a real ChatGPT
      // Plus subscriber token. Otherwise fall through to the Claude
      // translation layer (existing behaviour, zero regression if the
      // flag is off).
      if (
        process.env.CHATGPT_RELAY_ENABLED === '1' &&
        /^(gpt-|o3)/.test(requestedModel)
      ) {
        const chatAccount = await pickAccount({
          provider: 'chatgpt',
          ownerUserId: apiKey.userId,
        });
        if (chatAccount) {
          const responsesBody = translateChatToResponses(body);
          return relayChatgptResponses(req, reply, {
            account: chatAccount,
            apiKey,
            requestedModel,
            body: responsesBody as unknown as Record<string, unknown>,
          });
        }
        // No chatgpt account available — fall through to Claude translation.
      }

      const account = await pickAccount({ provider: 'claude', ownerUserId: apiKey.userId });
      if (!account) {
        return reply.code(503).send({
          error: { type: 'overloaded_error', message: 'no upstream claude account available' },
        });
      }

      const accessToken = await ensureFreshAccessToken(account);
      if (!accessToken) {
        return reply.code(503).send({
          error: { type: 'overloaded_error', message: 'account needs reauth; try again' },
        });
      }

      const dispatcher = await getDispatcher(account.proxyId);
      let upstream: Response;
      try {
        upstream = await fetch(`${CLAUDE_UPSTREAM_BASE}${CLAUDE_MESSAGES_PATH}`, {
          method: 'POST',
          headers: claudeAuthHeaders(accessToken),
          body: JSON.stringify(anthropicBody),
          ...(dispatcher ? { dispatcher } : {}),
        } as RequestInit);
      } catch (err) {
        logger.error({ err, accountId: account.id }, 'openai relay upstream fetch failed');
        await Promise.all([
          logEntry(apiKey.id, account.id, requestedModel, 0, Date.now() - startedAt, 502, 'upstream_unreachable'),
          recordRequest('claude', true),
        ]);
        return reply.code(502).send({ error: { type: 'api_error', message: 'upstream unreachable' } });
      }

      if (!upstream.ok) {
        const text = await upstream.text();
        const classification = classifyUpstream(upstream.status, upstream.headers.get('retry-after'), text);
        await Promise.all([
          applyClassification(account, classification),
          logEntry(
            apiKey.id,
            account.id,
            requestedModel,
            0,
            Date.now() - startedAt,
            upstream.status,
            classification.kind,
          ),
          recordRequest('claude', true),
        ]);
        return reply.code(upstream.status).send({ error: { type: 'api_error', message: text.slice(0, 500) } });
      }

      if (streaming && upstream.body) {
        reply.hijack();
        const raw = reply.raw;
        raw.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
        });

        const ctx = { id: randomUUID(), model: resolveModel(body.model) };
        const reader = upstream.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        let inputTokens = 0;
        let cacheReadTokens = 0;
        let cacheCreationTokens = 0;
        let outputTokens = 0;
        try {
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            if (!value) continue;
            buf += decoder.decode(value, { stream: true });
            let idx: number;
            while ((idx = buf.indexOf('\n\n')) !== -1) {
              const frame = buf.slice(0, idx);
              buf = buf.slice(idx + 2);
              let event: string | null = null;
              let data: string | null = null;
              for (const line of frame.split('\n')) {
                if (line.startsWith('event:')) event = line.slice(6).trim();
                else if (line.startsWith('data:')) data = line.slice(5).trim();
              }
              if (!event || !data) continue;
              // Track tokens for accounting. Same cache-aware pattern as
              // the Anthropic relay — keep the three input buckets
              // separate so computeCost can charge each at its own rate.
              if (event === 'message_start' || event === 'message_delta') {
                try {
                  const p = JSON.parse(data);
                  const u = p.usage ?? p.message?.usage;
                  if (u) {
                    const take = (cur: number, raw: unknown): number =>
                      typeof raw === 'number' && raw > cur ? raw : cur;
                    inputTokens = take(inputTokens, u.input_tokens);
                    cacheReadTokens = take(cacheReadTokens, u.cache_read_input_tokens);
                    cacheCreationTokens = take(
                      cacheCreationTokens,
                      u.cache_creation_input_tokens,
                    );
                    outputTokens = take(outputTokens, u.output_tokens);
                  }
                } catch {
                  /* ignore */
                }
              }
              for (const chunk of translateStreamEvent(event, data, ctx)) {
                raw.write(chunk);
              }
            }
          }
        } catch (err) {
          logger.error({ err, accountId: account.id }, 'openai stream forwarding failed');
        } finally {
          raw.end();
          const total = inputTokens + cacheReadTokens + cacheCreationTokens + outputTokens;
          const latencyMs = Date.now() - startedAt;
          const costMud = await computeCost(requestedModel, {
            inputTokens,
            cacheReadTokens,
            cacheCreationTokens,
            outputTokens,
          }).catch(() => 0);
          await Promise.all([
            logEntry(
              apiKey.id,
              account.id,
              requestedModel,
              {
                inputTokens,
                cacheReadTokens,
                cacheCreationTokens,
                outputTokens,
              },
              latencyMs,
              200,
              null,
              costMud,
            ),
            incrementWindowUsage(account.id, total).catch(() => {}),
            addWindowUsage(account.id, total).catch(() => {}),
            recordKeyUsage(apiKey.id, total).catch(() => {}),
            debitForRequestSafe(apiKey.id, costMud),
            recordRequest('claude', false),
          ]);
        }
        return;
      }

      // Non-streaming: consume full body, translate, emit.
      const text = await upstream.text();
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(text) as Record<string, unknown>;
      } catch {
        return reply.code(502).send({ error: { type: 'api_error', message: 'bad upstream json' } });
      }
      const out = translateResponse(
        parsed as unknown as Parameters<typeof translateResponse>[0],
        requestedModel,
      );
      const usage = (parsed['usage'] ?? {}) as Record<string, unknown>;
      const num = (k: string) => (typeof usage[k] === 'number' ? (usage[k] as number) : 0);
      const buckets = {
        inputTokens: num('input_tokens'),
        cacheReadTokens: num('cache_read_input_tokens'),
        cacheCreationTokens: num('cache_creation_input_tokens'),
        outputTokens: num('output_tokens'),
      };
      const total =
        buckets.inputTokens +
        buckets.cacheReadTokens +
        buckets.cacheCreationTokens +
        buckets.outputTokens;
      const latencyMs = Date.now() - startedAt;
      const costMud = await computeCost(requestedModel, buckets).catch(() => 0);
      await Promise.all([
        logEntry(
          apiKey.id,
          account.id,
          requestedModel,
          buckets,
          latencyMs,
          200,
          null,
          costMud,
        ),
        incrementWindowUsage(account.id, total).catch(() => {}),
        addWindowUsage(account.id, total).catch(() => {}),
        recordKeyUsage(apiKey.id, total).catch(() => {}),
        debitForRequestSafe(apiKey.id, costMud),
        recordRequest('claude', false),
      ]);
      return reply.code(200).send(out);
    },
  );
}

interface UsageLike {
  inputTokens: number;
  cacheReadTokens?: number;
  cacheCreationTokens?: number;
  outputTokens: number;
}

async function logEntry(
  apiKeyId: string,
  accountId: string,
  model: string,
  u: UsageLike | 0,
  latencyMs: number,
  status: number,
  errorCode: string | null,
  costMud: number = 0,
): Promise<void> {
  const usage: UsageLike =
    u === 0
      ? { inputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0, outputTokens: 0 }
      : u;
  try {
    await db.insert(usageLog).values({
      apiKeyId,
      accountId,
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
    logger.warn({ err }, 'openai relay: failed to persist usage_log entry');
  }
}
