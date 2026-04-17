import { and, asc, eq, or } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { accounts, type Account } from '../../db/schema.js';
import type { Provider } from '@xxf/shared';

export interface PickInput {
  provider: Provider;
  ownerUserId: string | null;
}

// P1 scheduler: prefer owner-matched accounts, fall back to the shared pool.
// Among candidates, pick the one with the least windowTokensUsed so load
// spreads roughly evenly. Health/window/cooling checks are simplistic — a
// real cooling-aware scheduler lands in P2.
export async function pickAccount(input: PickInput): Promise<Account | null> {
  const base = and(eq(accounts.provider, input.provider), eq(accounts.status, 'active'));
  const ownership = input.ownerUserId
    ? or(eq(accounts.ownerUserId, input.ownerUserId), eq(accounts.shared, true))
    : eq(accounts.shared, true);

  const candidates = await db
    .select()
    .from(accounts)
    .where(and(base, ownership))
    .orderBy(asc(accounts.windowTokensUsed), asc(accounts.lastUsedAt));

  if (candidates.length === 0) return null;

  if (input.ownerUserId) {
    const owned = candidates.find((c) => c.ownerUserId === input.ownerUserId);
    if (owned) return owned;
  }
  return candidates[0] ?? null;
}
