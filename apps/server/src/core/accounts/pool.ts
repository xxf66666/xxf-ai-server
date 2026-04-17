import { and, asc, eq, or } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { accounts, type Account } from '../../db/schema.js';
import type { AccountPlan, Provider } from '@xxf/shared';
import { getWindowUsage, PLAN_WINDOW_LIMIT } from './quota.js';

export interface PickInput {
  provider: Provider;
  ownerUserId: string | null;
}

// Owner-match wins over shared pool; inside each bucket, prefer the account
// with most remaining window budget. `status=active` filter excludes cooling
// / rate_limited / needs_reauth / banned accounts.
export async function pickAccount(input: PickInput): Promise<Account | null> {
  const now = new Date();
  const base = and(eq(accounts.provider, input.provider), eq(accounts.status, 'active'));
  const ownership = input.ownerUserId
    ? or(eq(accounts.ownerUserId, input.ownerUserId), eq(accounts.shared, true))
    : eq(accounts.shared, true);

  const candidates = await db
    .select()
    .from(accounts)
    .where(and(base, ownership))
    .orderBy(asc(accounts.lastUsedAt));

  // Skip accounts still cooling.
  const live = candidates.filter((c) => !c.coolingUntil || c.coolingUntil <= now);
  if (live.length === 0) return null;

  // Compute remaining-in-window for each; sort desc, tiebreak by lastUsedAt asc.
  const withRemaining = await Promise.all(
    live.map(async (c) => {
      const used = await getWindowUsage(c.id);
      const limit = PLAN_WINDOW_LIMIT[c.plan as AccountPlan];
      return { account: c, remaining: Math.max(0, limit - used), used };
    }),
  );
  withRemaining.sort((a, b) => b.remaining - a.remaining);

  if (input.ownerUserId) {
    const owned = withRemaining.find(
      (x) => x.account.ownerUserId === input.ownerUserId && x.remaining > 0,
    );
    if (owned) return owned.account;
  }
  const shared = withRemaining.find((x) => x.remaining > 0);
  return shared?.account ?? null;
}
