import type { AccountPlan } from '@xxf/shared';
import { redis } from '../../cache/redis.js';

// Approximate 5-hour window allowance per plan, expressed in total tokens
// (input + output). These numbers are the pool scheduler's budget, not a
// contractual promise — Anthropic doesn't publish exact numbers. Operators
// can tune via settings.pool.utilizationTarget once P5 ships.
export const PLAN_WINDOW_LIMIT: Record<AccountPlan, number> = {
  pro: 60_000,
  max5x: 300_000,
  max20x: 1_200_000,
  plus: 40_000,
  pro_chatgpt: 200_000,
};

export const WINDOW_SECONDS = 5 * 60 * 60; // 5h

function key(accountId: string): string {
  return `window:tokens:${accountId}`;
}

/**
 * Increment the rolling 5h usage counter for an account.
 * The TTL is set on first write; subsequent writes within the window don't
 * reset it, so the key naturally expires exactly WINDOW_SECONDS after the
 * first use in each window.
 */
export async function addWindowUsage(accountId: string, tokens: number): Promise<number> {
  if (tokens <= 0) return 0;
  const k = key(accountId);
  const result = await redis
    .multi()
    .incrby(k, tokens)
    .expire(k, WINDOW_SECONDS, 'NX')
    .exec();
  const total = Number(result?.[0]?.[1] ?? 0);
  return total;
}

export async function getWindowUsage(accountId: string): Promise<number> {
  const v = await redis.get(key(accountId));
  return v ? Number(v) : 0;
}

export async function remainingForPlan(accountId: string, plan: AccountPlan): Promise<number> {
  const used = await getWindowUsage(accountId);
  const limit = PLAN_WINDOW_LIMIT[plan];
  return Math.max(0, limit - used);
}

export async function resetWindow(accountId: string): Promise<void> {
  await redis.del(key(accountId));
}
