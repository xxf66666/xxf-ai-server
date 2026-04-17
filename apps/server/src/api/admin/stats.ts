import type { FastifyInstance } from 'fastify';
import { and, count, eq, gte, sql } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { accounts, usageLog } from '../../db/schema.js';
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
      })
      .from(usageLog)
      .where(gte(usageLog.createdAt, since24h));
    const tokensLast24h = Number(totals?.tokens ?? 0);
    const requestsLast24h = Number(totals?.requests ?? 0);

    // Per-hour bucketed series for the last 24h.
    const buckets = await db
      .select({
        ts: sql<string>`date_trunc('hour', ${usageLog.createdAt})`,
        tokens: sql<string>`coalesce(sum(${usageLog.inputTokens} + ${usageLog.outputTokens}), 0)`,
        requests: count(),
      })
      .from(usageLog)
      .where(gte(usageLog.createdAt, since24h))
      .groupBy(sql`date_trunc('hour', ${usageLog.createdAt})`)
      .orderBy(sql`date_trunc('hour', ${usageLog.createdAt})`);

    // Pool utilization = sum(window usage) / sum(window limit) over active accounts.
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
      poolUtilization,
      timeseries: buckets.map((b) => ({
        ts: new Date(b.ts).toISOString(),
        tokens: Number(b.tokens),
        requests: Number(b.requests),
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
      })
      .from(usageLog)
      .where(and(gte(usageLog.createdAt, since24h)))
      .groupBy(usageLog.accountId);
    return {
      data: rows.map((r) => ({
        accountId: r.accountId,
        tokens: Number(r.tokens),
        requests: Number(r.requests),
      })),
    };
  });
}
