import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  createInvite,
  deleteInvite,
  listInvites,
  resetInvite,
  revokeInvite,
} from '../../core/invites/index.js';
import { record } from '../../core/audit/log.js';
import { requireRole, sessionUserId } from '../../middleware/rbac.js';
import type { InviteCode } from '../../db/schema.js';

const CreateSchema = z.object({
  note: z.string().max(120).optional(),
  maxUses: z.number().int().min(1).max(1000).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});

function toDto(i: InviteCode) {
  return {
    id: i.id,
    code: i.code,
    note: i.note,
    maxUses: i.maxUses,
    useCount: i.useCount,
    revoked: i.revoked,
    expiresAt: i.expiresAt?.toISOString() ?? null,
    createdAt: i.createdAt.toISOString(),
  };
}

export async function registerAdminInvites(app: FastifyInstance): Promise<void> {
  app.get('/admin/v1/invites', async (req, reply) => {
    if (!requireRole(req, reply, ['admin'])) return;
    const rows = await listInvites();
    return { data: rows.map(toDto) };
  });

  app.post('/admin/v1/invites', async (req, reply) => {
    if (!requireRole(req, reply, ['admin'])) return;
    const parsed = CreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        type: 'error',
        error: { type: 'invalid_request_error', message: parsed.error.message },
      });
    }
    const uid = sessionUserId(req);
    const row = await createInvite({
      note: parsed.data.note ?? null,
      maxUses: parsed.data.maxUses,
      createdByUserId: uid,
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
    });
    await record(req, {
      action: 'invite.create',
      entityType: 'invite',
      entityId: row.id,
      detail: { note: row.note, maxUses: row.maxUses },
    });
    return reply.code(201).send(toDto(row));
  });

  // Reset: regenerate the code string + reset usage so admin can re-issue
  // without creating another row. The old code string is invalidated.
  app.post('/admin/v1/invites/:id/reset', async (req, reply) => {
    if (!requireRole(req, reply, ['admin'])) return;
    const id = (req.params as { id: string }).id;
    const row = await resetInvite(id);
    if (!row) return reply.code(404).send({ error: 'not_found' });
    await record(req, { action: 'invite.reset', entityType: 'invite', entityId: id });
    return toDto(row);
  });

  app.post('/admin/v1/invites/:id/revoke', async (req, reply) => {
    if (!requireRole(req, reply, ['admin'])) return;
    const id = (req.params as { id: string }).id;
    await revokeInvite(id);
    await record(req, { action: 'invite.revoke', entityType: 'invite', entityId: id });
    return reply.code(204).send();
  });

  app.delete('/admin/v1/invites/:id', async (req, reply) => {
    if (!requireRole(req, reply, ['admin'])) return;
    const id = (req.params as { id: string }).id;
    await deleteInvite(id);
    await record(req, { action: 'invite.delete', entityType: 'invite', entityId: id });
    return reply.code(204).send();
  });
}
