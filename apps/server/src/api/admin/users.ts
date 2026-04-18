import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../../db/client.js';
import { users, type User } from '../../db/schema.js';
import { USER_ROLES } from '@xxf/shared';
import { eq, sql } from 'drizzle-orm';
import { hashPassword } from '../../core/users/passwords.js';
import { record } from '../../core/audit/log.js';
import { requireRole } from '../../middleware/rbac.js';
import { seedWelcomeCredit } from '../../core/users/ledger.js';
import { getSetting } from '../../core/settings/index.js';

const CreateSchema = z.object({
  email: z.string().email(),
  role: z.enum(USER_ROLES).default('consumer'),
  password: z.string().min(8).optional(),
});

const UpdateSchema = z.object({
  role: z.enum(USER_ROLES).optional(),
  password: z.string().min(8).optional(),
  // Admin may force a user into any lifecycle state. Most commonly:
  // 'active'  — unlock / force-verify without email round-trip
  // 'suspended' — disable access (login + API) without deleting records
  status: z.enum(['pending_verification', 'active', 'suspended']).optional(),
});

const BalanceSchema = z.object({
  // Positive adds credit, negative deducts. In micro-USD; e.g. $1 = 1_000_000.
  deltaMud: z.number().int(),
  reason: z.string().max(120).optional(),
});

function toDto(u: User) {
  return {
    id: u.id,
    email: u.email,
    role: u.role,
    status: u.status,
    emailVerified: u.emailVerified,
    balanceMud: Number(u.balanceMud ?? 0),
    spentMud: Number(u.spentMud ?? 0),
    lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
    createdAt: u.createdAt.toISOString(),
  };
}

export async function registerAdminUsers(app: FastifyInstance): Promise<void> {
  app.get('/admin/v1/users', async (req, reply) => {
    if (!requireRole(req, reply, ['admin'])) return;
    const rows = await db.select().from(users);
    return { data: rows.map(toDto) };
  });

  app.post('/admin/v1/users', async (req, reply) => {
    if (!requireRole(req, reply, ['admin'])) return;
    const parsed = CreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        type: 'error',
        error: { type: 'invalid_request_error', message: parsed.error.message },
      });
    }
    const passwordHash = parsed.data.password
      ? await hashPassword(parsed.data.password)
      : '!';
    const [row] = await db
      .insert(users)
      .values({
        email: parsed.data.email,
        role: parsed.data.role,
        passwordHash,
      })
      .returning();
    if (!row) return reply.code(500).send({ error: 'insert_failed' });
    if (row.role === 'consumer') {
      const welcome = Number(await getSetting('pricing.welcomeCreditMud')) || 0;
      if (welcome > 0) await seedWelcomeCredit(row.id, welcome).catch(() => {});
    }
    await record(req, {
      action: 'user.create',
      entityType: 'user',
      entityId: row.id,
      detail: { email: row.email, role: row.role },
    });
    // Re-read so returned balance reflects the welcome seed.
    const [fresh] = await db.select().from(users).where(eq(users.id, row.id)).limit(1);
    return reply.code(201).send(toDto(fresh ?? row));
  });

  app.patch('/admin/v1/users/:id', async (req, reply) => {
    if (!requireRole(req, reply, ['admin'])) return;
    const id = (req.params as { id: string }).id;
    const parsed = UpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        type: 'error',
        error: { type: 'invalid_request_error', message: parsed.error.message },
      });
    }
    const patch: Partial<User> = { updatedAt: new Date() };
    if (parsed.data.role) patch.role = parsed.data.role;
    if (parsed.data.password) patch.passwordHash = await hashPassword(parsed.data.password);
    if (parsed.data.status) {
      patch.status = parsed.data.status;
      // Force-verify: when admin flips to 'active', also flag email as
      // verified so downstream UI treats them as fully set up. Flipping
      // away from 'active' does NOT touch email verification — that is
      // a separate fact about the user.
      if (parsed.data.status === 'active') {
        patch.emailVerified = true;
        patch.emailVerifiedAt = new Date();
      }
    }
    await db.update(users).set(patch).where(eq(users.id, id));
    const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!row) return reply.code(404).send({ error: 'not_found' });
    await record(req, {
      action: 'user.update',
      entityType: 'user',
      entityId: id,
      detail: {
        role: parsed.data.role ?? undefined,
        status: parsed.data.status ?? undefined,
        passwordChanged: Boolean(parsed.data.password),
      },
    });
    return toDto(row);
  });

  /**
   * Adjust a user's balance by a delta (positive tops up, negative debits).
   * Uses SQL `balance_mud + delta` so concurrent adjustments compose cleanly.
   * Does NOT touch spent_mud — that only records actual API consumption.
   */
  app.patch('/admin/v1/users/:id/balance', async (req, reply) => {
    if (!requireRole(req, reply, ['admin'])) return;
    const id = (req.params as { id: string }).id;
    const parsed = BalanceSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        type: 'error',
        error: { type: 'invalid_request_error', message: parsed.error.message },
      });
    }
    const [existing] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!existing) return reply.code(404).send({ error: 'not_found' });
    await db
      .update(users)
      .set({
        balanceMud: sql`${users.balanceMud} + ${parsed.data.deltaMud}`,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id));
    const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    await record(req, {
      action: 'user.balance_adjust',
      entityType: 'user',
      entityId: id,
      detail: { deltaMud: parsed.data.deltaMud, reason: parsed.data.reason ?? null },
    });
    return toDto(row ?? existing);
  });

  app.delete('/admin/v1/users/:id', async (req, reply) => {
    if (!requireRole(req, reply, ['admin'])) return;
    const id = (req.params as { id: string }).id;
    await db.delete(users).where(eq(users.id, id));
    await record(req, { action: 'user.delete', entityType: 'user', entityId: id });
    return reply.code(204).send();
  });
}
