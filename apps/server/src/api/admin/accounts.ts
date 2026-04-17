import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import {
  ACCOUNT_PLANS,
  PROVIDERS,
  type AccountPlan,
  type Provider,
} from '@xxf/shared';
import {
  attachAccount,
  deleteAccount,
  getAccount,
  listAccounts,
  setAccountStatus,
} from '../../core/accounts/registry.js';
import { probeAccount } from '../../core/accounts/probe.js';
import { record } from '../../core/audit/log.js';
import { db } from '../../db/client.js';
import { accounts, type Account } from '../../db/schema.js';
import { isAdmin, requireRole, sessionUserId } from '../../middleware/rbac.js';

const AttachSchema = z.object({
  provider: z.enum(PROVIDERS),
  plan: z.enum(ACCOUNT_PLANS),
  label: z.string().max(120).optional(),
  shared: z.boolean().optional(),
  ownerUserId: z.string().uuid().optional(),
  oauthAccessToken: z.string().min(16),
  oauthRefreshToken: z.string().min(16).optional(),
  tokenExpiresAt: z.string().datetime().optional(),
});

function toDto(a: Account) {
  return {
    id: a.id,
    provider: a.provider as Provider,
    plan: a.plan as AccountPlan,
    label: a.label,
    ownerUserId: a.ownerUserId,
    shared: a.shared,
    status: a.status,
    windowTokensUsed: a.windowTokensUsed,
    lastUsedAt: a.lastUsedAt?.toISOString() ?? null,
    coolingUntil: a.coolingUntil?.toISOString() ?? null,
    proxyId: a.proxyId,
    createdAt: a.createdAt.toISOString(),
  };
}

export async function registerAdminAccounts(app: FastifyInstance): Promise<void> {
  app.get('/admin/v1/accounts', async (req) => {
    if (isAdmin(req)) {
      const rows = await listAccounts();
      return { data: rows.map(toDto) };
    }
    const uid = sessionUserId(req);
    if (!uid) return { data: [] };
    const rows = await db.select().from(accounts).where(eq(accounts.ownerUserId, uid));
    return { data: rows.map(toDto) };
  });

  app.post('/admin/v1/accounts', async (req, reply) => {
    if (!requireRole(req, reply, ['admin', 'contributor'])) return;
    const parsed = AttachSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        type: 'error',
        error: { type: 'invalid_request_error', message: parsed.error.message },
      });
    }
    const { tokenExpiresAt, ...rest } = parsed.data;
    // Contributors can only attach accounts for themselves.
    const uid = sessionUserId(req);
    const ownerUserId = isAdmin(req) ? rest.ownerUserId ?? uid : uid;
    const account = await attachAccount({
      ...rest,
      ownerUserId,
      tokenExpiresAt: tokenExpiresAt ? new Date(tokenExpiresAt) : null,
    });
    await record(req, {
      action: 'account.attach',
      entityType: 'account',
      entityId: account.id,
      detail: { provider: account.provider, plan: account.plan, shared: account.shared },
    });
    return reply.code(201).send(toDto(account));
  });

  app.patch('/admin/v1/accounts/:id', async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const existing = await getAccount(id);
    if (!existing) return reply.code(404).send({ error: 'not_found' });
    if (!isAdmin(req) && existing.ownerUserId !== sessionUserId(req)) {
      return reply.code(403).send({
        type: 'error',
        error: { type: 'permission_error', message: 'cannot modify account owned by another user' },
      });
    }
    const body = z
      .object({
        status: z.enum(['active', 'cooling', 'rate_limited', 'needs_reauth', 'banned']).optional(),
        coolingUntil: z.string().datetime().nullable().optional(),
        shared: z.boolean().optional(),
        proxyId: z.string().uuid().nullable().optional(),
        label: z.string().max(120).optional(),
      })
      .parse(req.body);
    if (body.status) {
      await setAccountStatus(id, body.status, body.coolingUntil ? new Date(body.coolingUntil) : null);
    }
    if (body.shared !== undefined || body.proxyId !== undefined || body.label !== undefined) {
      const patch: Record<string, unknown> = { updatedAt: new Date() };
      if (body.shared !== undefined) patch.shared = body.shared;
      if (body.proxyId !== undefined) patch.proxyId = body.proxyId;
      if (body.label !== undefined) patch.label = body.label;
      await db.update(accounts).set(patch).where(eq(accounts.id, id));
    }
    const updated = await getAccount(id);
    if (!updated) return reply.code(404).send({ error: 'not_found' });
    return toDto(updated);
  });

  app.delete('/admin/v1/accounts/:id', async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const existing = await getAccount(id);
    if (!existing) return reply.code(404).send({ error: 'not_found' });
    if (!isAdmin(req) && existing.ownerUserId !== sessionUserId(req)) {
      return reply.code(403).send({
        type: 'error',
        error: { type: 'permission_error', message: 'cannot detach another user\'s account' },
      });
    }
    await deleteAccount(id);
    await record(req, { action: 'account.detach', entityType: 'account', entityId: id });
    return reply.code(204).send();
  });

  app.post('/admin/v1/accounts/:id/probe', async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const account = await getAccount(id);
    if (!account) return reply.code(404).send({ error: 'not_found' });
    if (!isAdmin(req) && account.ownerUserId !== sessionUserId(req)) {
      return reply.code(403).send({
        type: 'error',
        error: { type: 'permission_error', message: 'cannot probe another user\'s account' },
      });
    }
    const result = await probeAccount(account);
    await record(req, {
      action: 'account.probe',
      entityType: 'account',
      entityId: id,
      detail: { classification: result.classification, status: result.status },
    });
    return result;
  });
}
