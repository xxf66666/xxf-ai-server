import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  deleteCode,
  listCodes,
  mintBatch,
  revokeCode,
} from '../../core/redeem/index.js';
import { record } from '../../core/audit/log.js';
import { requireRole, sessionUserId } from '../../middleware/rbac.js';
import type { RedeemCode } from '../../db/schema.js';

const MintSchema = z.object({
  // Face value in USD; we convert to micro-USD server-side.
  valueUsd: z.number().positive().max(1000),
  count: z.number().int().min(1).max(200).optional(),
  note: z.string().max(120).optional(),
});

function toDto(r: RedeemCode) {
  return {
    id: r.id,
    code: r.code,
    valueMud: Number(r.valueMud),
    note: r.note,
    redeemedByUserId: r.redeemedByUserId,
    redeemedAt: r.redeemedAt?.toISOString() ?? null,
    revoked: r.revoked,
    createdAt: r.createdAt.toISOString(),
  };
}

export async function registerAdminRedeem(app: FastifyInstance): Promise<void> {
  app.get('/admin/v1/redeem-codes', async (req, reply) => {
    if (!requireRole(req, reply, ['admin'])) return;
    const rows = await listCodes();
    return { data: rows.map(toDto) };
  });

  app.post('/admin/v1/redeem-codes', async (req, reply) => {
    if (!requireRole(req, reply, ['admin'])) return;
    const parsed = MintSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        type: 'error',
        error: { type: 'invalid_request_error', message: parsed.error.message },
      });
    }
    const valueMud = Math.round(parsed.data.valueUsd * 1_000_000);
    const batch = await mintBatch({
      valueMud,
      count: parsed.data.count,
      note: parsed.data.note ?? null,
      createdByUserId: sessionUserId(req),
    });
    await record(req, {
      action: 'redeem.mint',
      entityType: 'redeem_code',
      detail: {
        count: batch.length,
        valueMud,
        ids: batch.map((b) => b.id),
      },
    });
    return reply.code(201).send({ data: batch.map(toDto) });
  });

  app.post('/admin/v1/redeem-codes/:id/revoke', async (req, reply) => {
    if (!requireRole(req, reply, ['admin'])) return;
    const id = (req.params as { id: string }).id;
    await revokeCode(id);
    await record(req, { action: 'redeem.revoke', entityType: 'redeem_code', entityId: id });
    return reply.code(204).send();
  });

  app.delete('/admin/v1/redeem-codes/:id', async (req, reply) => {
    if (!requireRole(req, reply, ['admin'])) return;
    const id = (req.params as { id: string }).id;
    await deleteCode(id);
    await record(req, { action: 'redeem.delete', entityType: 'redeem_code', entityId: id });
    return reply.code(204).send();
  });
}
