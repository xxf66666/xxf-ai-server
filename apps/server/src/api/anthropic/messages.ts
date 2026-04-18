import { createHash } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { requireApiKey } from '../../core/users/auth.js';
import { keyAllowsModel } from '../../core/users/keys.js';
import { pickAccount } from '../../core/accounts/pool.js';
import { relayMessages } from '../../core/relay/anthropic.js';

// Intentionally lenient: Anthropic's Messages API evolves quickly and we
// don't want to block calls on field additions. We only validate the two
// fields we route on; the rest is forwarded verbatim.
const BodyShape = z
  .object({
    model: z.string(),
    stream: z.boolean().optional(),
  })
  .passthrough();

function authFingerprint(auth: string | undefined): string {
  // Use a stable hash of the Bearer token as the rate-limit bucket key.
  // Never store the plaintext in Redis.
  if (!auth) return 'anon';
  return createHash('sha256').update(auth).digest('hex').slice(0, 32);
}

export async function registerAnthropic(app: FastifyInstance): Promise<void> {
  app.post(
    '/v1/messages',
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
      const parsed = BodyShape.safeParse(req.body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({ type: 'error', error: { type: 'invalid_request_error', message: parsed.error.message } });
      }
      const apiKey = req.apiKey!;
      if (!keyAllowsModel(apiKey, parsed.data.model)) {
        return reply.code(403).send({
          type: 'error',
          error: {
            type: 'permission_error',
            message: `this api key is not allowed to call model ${parsed.data.model}`,
          },
        });
      }
      const account = await pickAccount({
        provider: 'claude',
        ownerUserId: apiKey.userId,
      });
      if (!account) {
        return reply.code(503).send({
          type: 'error',
          error: { type: 'overloaded_error', message: 'no upstream claude account available' },
        });
      }
      await relayMessages(req, reply, { account, apiKey });
    },
  );
}
