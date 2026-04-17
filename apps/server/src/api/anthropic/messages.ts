import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireApiKey } from '../../core/users/auth.js';
import { pickAccount } from '../../core/accounts/pool.js';
import { relayMessages } from '../../core/relay/anthropic.js';

// Intentionally lenient: Anthropic's Messages API evolves quickly and we don't
// want to block calls on field additions. We only validate the two fields we
// route on; the rest is forwarded verbatim.
const BodyShape = z
  .object({
    model: z.string(),
    stream: z.boolean().optional(),
  })
  .passthrough();

export async function registerAnthropic(app: FastifyInstance): Promise<void> {
  app.post('/v1/messages', { preHandler: requireApiKey }, async (req, reply) => {
    const parsed = BodyShape.safeParse(req.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ type: 'error', error: { type: 'invalid_request_error', message: parsed.error.message } });
    }
    const apiKey = req.apiKey!;
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
  });
}
