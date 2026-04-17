import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { listApiKeys, mintApiKey, revokeApiKey } from '../../core/users/keys.js';
import { record } from '../../core/audit/log.js';
import { db } from '../../db/client.js';
import { apiKeys, type ApiKey } from '../../db/schema.js';
import { isAdmin, sessionUserId } from '../../middleware/rbac.js';

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
  app.get('/admin/v1/users/:userId/keys', async (req, reply) => {
    const userId = (req.params as { userId: string }).userId;
    if (!isAdmin(req) && userId !== sessionUserId(req)) {
      return reply.code(403).send({
        type: 'error',
        error: { type: 'permission_error', message: 'cannot list keys of another user' },
      });
    }
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
    if (!isAdmin(req) && parsed.data.userId !== sessionUserId(req)) {
      return reply.code(403).send({
        type: 'error',
        error: { type: 'permission_error', message: 'cannot mint a key for another user' },
      });
    }
    const result = await mintApiKey({
      userId: parsed.data.userId,
      name: parsed.data.name,
      quotaMonthlyTokens: parsed.data.quotaMonthlyTokens ?? null,
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
    });
    await record(req, {
      action: 'key.mint',
      entityType: 'api_key',
      entityId: result.record.id,
      detail: { userId: parsed.data.userId, name: parsed.data.name },
    });
    return reply.code(201).send({ ...toDto(result.record), key: result.plaintext });
  });

  app.delete('/admin/v1/keys/:id', async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const [existing] = await db.select().from(apiKeys).where(eq(apiKeys.id, id)).limit(1);
    if (!existing) return reply.code(404).send({ error: 'not_found' });
    if (!isAdmin(req) && existing.userId !== sessionUserId(req)) {
      return reply.code(403).send({
        type: 'error',
        error: { type: 'permission_error', message: 'cannot revoke another user\'s key' },
      });
    }
    await revokeApiKey(id);
    await record(req, { action: 'key.revoke', entityType: 'api_key', entityId: id });
    return reply.code(204).send();
  });
}
