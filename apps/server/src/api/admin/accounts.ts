import type { FastifyInstance } from 'fastify';
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
import type { Account } from '../../db/schema.js';

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
  app.get('/admin/v1/accounts', async () => {
    const rows = await listAccounts();
    return { data: rows.map(toDto) };
  });

  app.post('/admin/v1/accounts', async (req, reply) => {
    const parsed = AttachSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        type: 'error',
        error: { type: 'invalid_request_error', message: parsed.error.message },
      });
    }
    const { tokenExpiresAt, ...rest } = parsed.data;
    const account = await attachAccount({
      ...rest,
      tokenExpiresAt: tokenExpiresAt ? new Date(tokenExpiresAt) : null,
    });
    return reply.code(201).send(toDto(account));
  });

  app.patch('/admin/v1/accounts/:id', async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const body = z
      .object({
        status: z.enum(['active', 'cooling', 'rate_limited', 'needs_reauth', 'banned']).optional(),
        coolingUntil: z.string().datetime().nullable().optional(),
      })
      .parse(req.body);
    if (body.status) {
      await setAccountStatus(id, body.status, body.coolingUntil ? new Date(body.coolingUntil) : null);
    }
    const updated = await getAccount(id);
    if (!updated) return reply.code(404).send({ error: 'not_found' });
    return toDto(updated);
  });

  app.delete('/admin/v1/accounts/:id', async (req, reply) => {
    const id = (req.params as { id: string }).id;
    await deleteAccount(id);
    return reply.code(204).send();
  });
}
