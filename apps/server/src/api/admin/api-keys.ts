import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { listApiKeys, mintApiKey, revokeApiKey } from '../../core/users/keys.js';
import type { ApiKey } from '../../db/schema.js';

const MintSchema = z.object({
  userId: z.string().uuid(),
  name: z.string().min(1).max(120),
  quotaMonthlyTokens: z.number().int().nonnegative().nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});

function toDto(k: ApiKey) {
  return {
    id: k.id,
    userId: k.userId,
    name: k.name,
    keyPreview: k.keyPreview,
    quotaMonthlyTokens: k.quotaMonthlyTokens,
    usedMonthlyTokens: k.usedMonthlyTokens,
    status: k.status,
    expiresAt: k.expiresAt?.toISOString() ?? null,
    lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
    createdAt: k.createdAt.toISOString(),
  };
}

export async function registerAdminApiKeys(app: FastifyInstance): Promise<void> {
  app.get('/admin/v1/users/:userId/keys', async (req) => {
    const userId = (req.params as { userId: string }).userId;
    const rows = await listApiKeys(userId);
    return { data: rows.map(toDto) };
  });

  app.post('/admin/v1/keys', async (req, reply) => {
    const parsed = MintSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        type: 'error',
        error: { type: 'invalid_request_error', message: parsed.error.message },
      });
    }
    const result = await mintApiKey({
      userId: parsed.data.userId,
      name: parsed.data.name,
      quotaMonthlyTokens: parsed.data.quotaMonthlyTokens ?? null,
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
    });
    return reply.code(201).send({ ...toDto(result.record), key: result.plaintext });
  });

  app.delete('/admin/v1/keys/:id', async (req, reply) => {
    const id = (req.params as { id: string }).id;
    await revokeApiKey(id);
    return reply.code(204).send();
  });
}
