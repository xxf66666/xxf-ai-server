import type { FastifyInstance } from 'fastify';
import { and, count, eq, gte, sql } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { accounts, apiKeys, usageLog, users } from '../../db/schema.js';
import { PLAN_WINDOW_LIMIT } from '../../core/accounts/quota.js';
import type { AccountPlan } from '@xxf/shared';
import { getWindowUsage } from '../../core/accounts/quota.js';

export async function registerAdminStats(app: FastifyInstance): Promise<void> {
  app.get('/admin/v1/stats/overview', async () => {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [activeRow] = await db
      .select({ n: count() })
      .from(accounts)
      .where(eq(accounts.status, 'active'));
    const activeAccounts = Number(activeRow?.n ?? 0);

    const [totals] = await db
      .select({
        tokens: sql<string>`coalesce(sum(${usageLog.inputTokens} + ${usageLog.outputTokens}), 0)`,
        requests: count(),
        cost: sql<string>`coalesce(sum(${usageLog.costMud}), 0)`,
      })
      .from(usageLog)
      .where(gte(usageLog.createdAt, since24h));
    const tokensLast24h = Number(totals?.tokens ?? 0);
    const requestsLast24h = Number(totals?.requests ?? 0);
    const costLast24hMud = Number(totals?.cost ?? 0);

    const buckets = await db
      .select({
        ts: sql<string>`date_trunc('hour', ${usageLog.createdAt})`,
        tokens: sql<string>`coalesce(sum(${usageLog.inputTokens} + ${usageLog.outputTokens}), 0)`,
        requests: count(),
        cost: sql<string>`coalesce(sum(${usageLog.costMud}), 0)`,
      })
      .from(usageLog)
      .where(gte(usageLog.createdAt, since24h))
      .groupBy(sql`date_trunc('hour', ${usageLog.createdAt})`)
      .orderBy(sql`date_trunc('hour', ${usageLog.createdAt})`);

    const activeAccts = await db.select().from(accounts).where(eq(accounts.status, 'active'));
    let used = 0;
    let cap = 0;
    for (const a of activeAccts) {
      used += await getWindowUsage(a.id);
      cap += PLAN_WINDOW_LIMIT[a.plan as AccountPlan] ?? 0;
    }
    const poolUtilization = cap > 0 ? used / cap : 0;

    return {
      activeAccounts,
      tokensLast24h,
      requestsLast24h,
      costLast24hMud,
      poolUtilization,
      timeseries: buckets.map((b) => ({
        ts: new Date(b.ts).toISOString(),
        tokens: Number(b.tokens),
        requests: Number(b.requests),
        costMud: Number(b.cost),
      })),
    };
  });

  app.get('/admin/v1/stats/by-account', async () => {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const rows = await db
      .select({
        accountId: usageLog.accountId,
        tokens: sql<string>`coalesce(sum(${usageLog.inputTokens} + ${usageLog.outputTokens}), 0)`,
        requests: count(),
        cost: sql<string>`coalesce(sum(${usageLog.costMud}), 0)`,
      })
      .from(usageLog)
      .where(and(gte(usageLog.createdAt, since24h)))
      .groupBy(usageLog.accountId);
    return {
      data: rows.map((r) => ({
        accountId: r.accountId,
        tokens: Number(r.tokens),
        requests: Number(r.requests),
        costMud: Number(r.cost),
      })),
    };
  });

  app.get('/admin/v1/stats/by-key', async () => {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const rows = await db
      .select({
        apiKeyId: usageLog.apiKeyId,
        tokens: sql<string>`coalesce(sum(${usageLog.inputTokens} + ${usageLog.outputTokens}), 0)`,
        requests: count(),
        cost: sql<string>`coalesce(sum(${usageLog.costMud}), 0)`,
      })
      .from(usageLog)
      .where(and(gte(usageLog.createdAt, since24h)))
      .groupBy(usageLog.apiKeyId);
    return {
      data: rows.map((r) => ({
        apiKeyId: r.apiKeyId,
        tokens: Number(r.tokens),
        requests: Number(r.requests),
        costMud: Number(r.cost),
      })),
    };
  });

  // Aggregate by user via usage_log → api_keys → users. Useful to answer
  // "who spent the most today" at a glance.
  app.get('/admin/v1/stats/by-user', async () => {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const rows = await db
      .select({
        userId: users.id,
        email: users.email,
        role: users.role,
        tokens: sql<string>`coalesce(sum(${usageLog.inputTokens} + ${usageLog.outputTokens}), 0)`,
        requests: count(),
        cost: sql<string>`coalesce(sum(${usageLog.costMud}), 0)`,
      })
      .from(usageLog)
      .innerJoin(apiKeys, eq(usageLog.apiKeyId, apiKeys.id))
      .innerJoin(users, eq(apiKeys.userId, users.id))
      .where(gte(usageLog.createdAt, since24h))
      .groupBy(users.id, users.email, users.role);
    return {
      data: rows.map((r) => ({
        userId: r.userId,
        email: r.email,
        role: r.role,
        tokens: Number(r.tokens),
        requests: Number(r.requests),
        costMud: Number(r.cost),
      })),
    };
  });
}
