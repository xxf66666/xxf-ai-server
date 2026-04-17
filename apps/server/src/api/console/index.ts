// Consumer-facing (/console/*) API surface. Every endpoint is scoped to
// req.adminSession.sub — an authenticated user sees only their own keys,
// usage, balance, etc. No RBAC gate is needed: admins + contributors can
// access this surface too (to see their personal stats).
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, count, desc, eq, gte, sql } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { apiKeys, usageLog, users } from '../../db/schema.js';
import {
  listApiKeys,
  mintApiKey,
  revokeApiKey,
} from '../../core/users/keys.js';
import { hashPassword, verifyPassword } from '../../core/users/passwords.js';
import { getAllSettings } from '../../core/settings/index.js';
import { record } from '../../core/audit/log.js';
import { requireAdmin } from '../../middleware/admin-auth.js';

// Fallback model list when operator hasn't pinned one via settings.
const DEFAULT_MODELS = [
  { id: 'claude-opus-4-7', provider: 'claude', tier: 'opus' },
  { id: 'claude-sonnet-4-6', provider: 'claude', tier: 'sonnet' },
  { id: 'claude-haiku-4-5-20251001', provider: 'claude', tier: 'haiku' },
  { id: 'gpt-4o', provider: 'openai', tier: 'flagship' },
  { id: 'gpt-4o-mini', provider: 'openai', tier: 'small' },
];

const MintSchema = z.object({
  name: z.string().min(1).max(120),
});

const PasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

function sessionUser(req: Parameters<typeof requireAdmin>[0]): string | null {
  const sub = req.adminSession?.sub;
  if (!sub || sub === 'bootstrap') return null;
  return sub;
}

export async function registerConsole(app: FastifyInstance): Promise<void> {
  // All console routes require a logged-in session (JWT cookie). We
  // reuse requireAdmin here — its JWT cookie verification works for any
  // role, and we DON'T gate by role, so consumers pass through.
  app.addHook('preHandler', async (req, reply) => {
    if (req.url.startsWith('/v1/console/')) {
      await requireAdmin(req, reply);
    }
  });

  app.get('/v1/console/overview', async (req, reply) => {
    const uid = sessionUser(req);
    if (!uid) return reply.code(401).send({ error: 'unauth' });
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const myKeys = await db
      .select({ id: apiKeys.id, used: apiKeys.usedMonthlyTokens, status: apiKeys.status })
      .from(apiKeys)
      .where(eq(apiKeys.userId, uid));
    const activeKeys = myKeys.filter((k) => k.status === 'active').length;
    const usedMonthly = myKeys.reduce((acc, k) => acc + Number(k.used ?? 0), 0);

    const keyIds = myKeys.map((k) => k.id);
    let tokens24h = 0;
    let requests24h = 0;
    let timeseries: Array<{ ts: string; tokens: number; requests: number }> = [];
    if (keyIds.length > 0) {
      const [totals] = await db
        .select({
          tokens: sql<string>`coalesce(sum(${usageLog.inputTokens} + ${usageLog.outputTokens}), 0)`,
          requests: count(),
        })
        .from(usageLog)
        .where(
          and(
            gte(usageLog.createdAt, since24h),
            sql`${usageLog.apiKeyId} IN (${sql.join(
              keyIds.map((id) => sql`${id}`),
              sql`, `,
            )})`,
          ),
        );
      tokens24h = Number(totals?.tokens ?? 0);
      requests24h = Number(totals?.requests ?? 0);

      const rows = await db
        .select({
          ts: sql<string>`date_trunc('hour', ${usageLog.createdAt})`,
          tokens: sql<string>`coalesce(sum(${usageLog.inputTokens} + ${usageLog.outputTokens}), 0)`,
          requests: count(),
        })
        .from(usageLog)
        .where(
          and(
            gte(usageLog.createdAt, since24h),
            sql`${usageLog.apiKeyId} IN (${sql.join(
              keyIds.map((id) => sql`${id}`),
              sql`, `,
            )})`,
          ),
        )
        .groupBy(sql`date_trunc('hour', ${usageLog.createdAt})`)
        .orderBy(sql`date_trunc('hour', ${usageLog.createdAt})`);
      timeseries = rows.map((r) => ({
        ts: new Date(r.ts).toISOString(),
        tokens: Number(r.tokens),
        requests: Number(r.requests),
      }));
    }

    const [meRow] = await db
      .select({ balanceMud: users.balanceMud, spentMud: users.spentMud })
      .from(users)
      .where(eq(users.id, uid))
      .limit(1);
    return {
      email: req.adminSession?.email ?? '',
      role: req.adminSession?.role ?? 'consumer',
      activeKeys,
      tokens24h,
      requests24h,
      usedMonthly,
      balanceMud: Number(meRow?.balanceMud ?? 0),
      spentMud: Number(meRow?.spentMud ?? 0),
      timeseries,
    };
  });

  app.get('/v1/console/keys', async (req, reply) => {
    const uid = sessionUser(req);
    if (!uid) return reply.code(401).send({ error: 'unauth' });
    const rows = await listApiKeys(uid);
    return {
      data: rows.map((k) => ({
        id: k.id,
        name: k.name,
        keyPreview: k.keyPreview,
        status: k.status,
        quotaMonthlyTokens: k.quotaMonthlyTokens,
        usedMonthlyTokens: k.usedMonthlyTokens,
        expiresAt: k.expiresAt?.toISOString() ?? null,
        lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
        createdAt: k.createdAt.toISOString(),
      })),
    };
  });

  app.post('/v1/console/keys', async (req, reply) => {
    const uid = sessionUser(req);
    if (!uid) return reply.code(401).send({ error: 'unauth' });
    const parsed = MintSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        type: 'error',
        error: { type: 'invalid_request_error', message: parsed.error.message },
      });
    }
    const result = await mintApiKey({ userId: uid, name: parsed.data.name });
    await record(req, {
      action: 'key.mint',
      entityType: 'api_key',
      entityId: result.record.id,
      detail: { via: 'console', name: parsed.data.name },
    });
    return reply.code(201).send({
      id: result.record.id,
      name: result.record.name,
      keyPreview: result.record.keyPreview,
      key: result.plaintext,
      status: result.record.status,
      createdAt: result.record.createdAt.toISOString(),
    });
  });

  app.delete('/v1/console/keys/:id', async (req, reply) => {
    const uid = sessionUser(req);
    if (!uid) return reply.code(401).send({ error: 'unauth' });
    const id = (req.params as { id: string }).id;
    const [k] = await db.select().from(apiKeys).where(eq(apiKeys.id, id)).limit(1);
    if (!k) return reply.code(404).send({ error: 'not_found' });
    if (k.userId !== uid) return reply.code(403).send({ error: 'forbidden' });
    await revokeApiKey(id);
    await record(req, { action: 'key.revoke', entityType: 'api_key', entityId: id, detail: { via: 'console' } });
    return reply.code(204).send();
  });

  app.get('/v1/console/usage', async (req, reply) => {
    const uid = sessionUser(req);
    if (!uid) return reply.code(401).send({ error: 'unauth' });
    const query = (req.query ?? {}) as { limit?: string };
    const limit = Math.min(200, Math.max(1, Number(query.limit ?? 50)));
    // Join usage_log → api_keys on key ownership = current user.
    const rows = await db
      .select({
        id: usageLog.id,
        createdAt: usageLog.createdAt,
        provider: usageLog.provider,
        model: usageLog.model,
        inputTokens: usageLog.inputTokens,
        outputTokens: usageLog.outputTokens,
        latencyMs: usageLog.latencyMs,
        status: usageLog.status,
        errorCode: usageLog.errorCode,
        keyName: apiKeys.name,
      })
      .from(usageLog)
      .innerJoin(apiKeys, eq(usageLog.apiKeyId, apiKeys.id))
      .where(eq(apiKeys.userId, uid))
      .orderBy(desc(usageLog.createdAt))
      .limit(limit);
    return {
      data: rows.map((r) => ({
        id: r.id,
        createdAt: r.createdAt.toISOString(),
        provider: r.provider,
        model: r.model,
        inputTokens: r.inputTokens,
        outputTokens: r.outputTokens,
        latencyMs: r.latencyMs,
        status: r.status,
        errorCode: r.errorCode,
        keyName: r.keyName,
      })),
    };
  });

  app.get('/v1/console/breakdown', async (req, reply) => {
    const uid = sessionUser(req);
    if (!uid) return reply.code(401).send({ error: 'unauth' });
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const myKeys = await db
      .select({ id: apiKeys.id, name: apiKeys.name })
      .from(apiKeys)
      .where(eq(apiKeys.userId, uid));
    if (myKeys.length === 0) {
      return { byModel: [], byKey: [], byStatus: [], trend: [] };
    }
    const keyIds = myKeys.map((k) => k.id);
    const keyIdFilter = sql`${usageLog.apiKeyId} IN (${sql.join(
      keyIds.map((id) => sql`${id}`),
      sql`, `,
    )})`;
    const whereScope = and(gte(usageLog.createdAt, since), keyIdFilter);

    const byModel = await db
      .select({
        model: usageLog.model,
        tokens: sql<string>`coalesce(sum(${usageLog.inputTokens} + ${usageLog.outputTokens}), 0)`,
        requests: count(),
      })
      .from(usageLog)
      .where(whereScope)
      .groupBy(usageLog.model);

    const byKey = await db
      .select({
        keyId: usageLog.apiKeyId,
        tokens: sql<string>`coalesce(sum(${usageLog.inputTokens} + ${usageLog.outputTokens}), 0)`,
        requests: count(),
      })
      .from(usageLog)
      .where(whereScope)
      .groupBy(usageLog.apiKeyId);

    const byStatus = await db
      .select({
        bucket: sql<string>`
          case
            when ${usageLog.status} >= 200 and ${usageLog.status} < 300 then '2xx'
            when ${usageLog.status} >= 300 and ${usageLog.status} < 400 then '3xx'
            when ${usageLog.status} >= 400 and ${usageLog.status} < 500 then '4xx'
            when ${usageLog.status} >= 500 then '5xx'
            else 'other'
          end`,
        requests: count(),
      })
      .from(usageLog)
      .where(whereScope)
      .groupBy(sql`1`);

    const trend = await db
      .select({
        ts: sql<string>`date_trunc('hour', ${usageLog.createdAt})`,
        inputTokens: sql<string>`coalesce(sum(${usageLog.inputTokens}), 0)`,
        outputTokens: sql<string>`coalesce(sum(${usageLog.outputTokens}), 0)`,
        requests: count(),
      })
      .from(usageLog)
      .where(whereScope)
      .groupBy(sql`date_trunc('hour', ${usageLog.createdAt})`)
      .orderBy(sql`date_trunc('hour', ${usageLog.createdAt})`);

    const keyName = new Map(myKeys.map((k) => [k.id, k.name]));
    return {
      byModel: byModel.map((r) => ({
        model: r.model,
        tokens: Number(r.tokens),
        requests: Number(r.requests),
      })),
      byKey: byKey.map((r) => ({
        keyId: r.keyId,
        keyName: r.keyId ? (keyName.get(r.keyId) ?? null) : null,
        tokens: Number(r.tokens),
        requests: Number(r.requests),
      })),
      byStatus: byStatus.map((r) => ({ bucket: r.bucket, requests: Number(r.requests) })),
      trend: trend.map((r) => ({
        ts: new Date(r.ts).toISOString(),
        inputTokens: Number(r.inputTokens),
        outputTokens: Number(r.outputTokens),
        requests: Number(r.requests),
      })),
    };
  });

  app.get('/v1/console/models', async () => {
    const settings = await getAllSettings();
    const allow = Array.isArray(settings['models.allow']) ? (settings['models.allow'] as string[]) : [];
    if (allow.length === 0) return { data: DEFAULT_MODELS };
    return {
      data: allow.map((id) => ({ id, provider: id.startsWith('claude-') ? 'claude' : 'openai', tier: null })),
    };
  });

  app.patch('/v1/console/me/password', async (req, reply) => {
    const uid = sessionUser(req);
    if (!uid) return reply.code(401).send({ error: 'unauth' });
    const parsed = PasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        type: 'error',
        error: { type: 'invalid_request_error', message: parsed.error.message },
      });
    }
    const [me] = await db.select().from(users).where(eq(users.id, uid)).limit(1);
    if (!me) return reply.code(404).send({ error: 'not_found' });
    if (!(await verifyPassword(me.passwordHash, parsed.data.currentPassword))) {
      return reply.code(401).send({
        type: 'error',
        error: { type: 'authentication_error', message: 'current password incorrect' },
      });
    }
    await db
      .update(users)
      .set({ passwordHash: await hashPassword(parsed.data.newPassword), updatedAt: new Date() })
      .where(eq(users.id, uid));
    await record(req, { action: 'user.password_change', entityType: 'user', entityId: uid });
    return reply.code(204).send();
  });
}
