import { redis } from '../../cache/redis.js';
import type { ApiKey } from '../../db/schema.js';

// Three rolling windows kept as Redis counters keyed by api_key_id.
// We pick FIXED windows (calendar day in UTC, ISO week, calendar month)
// rather than sliding ones so the user's "$5/day" budget resets
// cleanly at midnight and matches what they expect.
//
// Implementation: each window has a deterministic Redis key that
// contains the window identifier (e.g. spend:day:<keyId>:2026-04-19).
// TTL is set to the remaining seconds of the window, so expired counters
// are reaped automatically without a sweeper.

type Window = 'day' | 'week' | 'month';

function dayKey(d: Date): string {
  // YYYY-MM-DD UTC
  return d.toISOString().slice(0, 10);
}

function weekKey(d: Date): string {
  // ISO 8601 year-week. Approximation: Thursday determines the year of
  // the week. Good enough for cap accounting.
  const dt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((dt.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${dt.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function monthKey(d: Date): string {
  return d.toISOString().slice(0, 7); // YYYY-MM
}

function redisKey(window: Window, apiKeyId: string, bucket: string): string {
  return `spend:${window}:${apiKeyId}:${bucket}`;
}

function ttlSecondsForWindow(window: Window, now: Date): number {
  if (window === 'day') {
    const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    return Math.max(60, Math.floor((tomorrow.getTime() - now.getTime()) / 1000));
  }
  if (window === 'week') {
    // 7 days max; over-provisioned is fine, the new bucket key naturally
    // takes over at the next ISO week.
    return 7 * 24 * 3600;
  }
  // month: end of current calendar month UTC
  const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return Math.max(60, Math.floor((nextMonth.getTime() - now.getTime()) / 1000));
}

export interface SpendingState {
  dayMud: number;
  weekMud: number;
  monthMud: number;
}

export async function readSpending(apiKeyId: string): Promise<SpendingState> {
  const now = new Date();
  const [d, w, m] = await Promise.all([
    redis.get(redisKey('day', apiKeyId, dayKey(now))),
    redis.get(redisKey('week', apiKeyId, weekKey(now))),
    redis.get(redisKey('month', apiKeyId, monthKey(now))),
  ]);
  return {
    dayMud: Number(d ?? 0),
    weekMud: Number(w ?? 0),
    monthMud: Number(m ?? 0),
  };
}

/**
 * Increment all three windows by `mud`. Done after a successful relay
 * so every cap window stays consistent. Each INCRBY is a single Redis
 * round-trip; we set TTL with EXPIRE NX so we don't accidentally extend
 * the expiry on subsequent calls within the same window.
 */
export async function recordSpending(apiKeyId: string, mud: number): Promise<void> {
  if (mud <= 0) return;
  const now = new Date();
  const windows: { window: Window; key: string }[] = [
    { window: 'day', key: redisKey('day', apiKeyId, dayKey(now)) },
    { window: 'week', key: redisKey('week', apiKeyId, weekKey(now)) },
    { window: 'month', key: redisKey('month', apiKeyId, monthKey(now)) },
  ];
  await Promise.all(
    windows.map(async ({ window, key }) => {
      await redis.incrby(key, mud);
      await redis.expire(key, ttlSecondsForWindow(window, now), 'NX');
    }),
  );
}

export interface CapViolation {
  window: Window;
  capMud: number;
  spentMud: number;
  resetAtUtc: string; // ISO of when this window ends
}

/**
 * Check the configured caps against current spending. Returns null if
 * all windows are within budget, or the worst-violated window. Called
 * by requireApiKey before relaying so we 402 cheaply rather than
 * burning an upstream call.
 */
export async function checkCaps(key: ApiKey): Promise<CapViolation | null> {
  const caps: { window: Window; cap: number | null }[] = [
    { window: 'day', cap: key.dailyCapMud },
    { window: 'week', cap: key.weeklyCapMud },
    { window: 'month', cap: key.monthlyCapMud },
  ];
  if (caps.every((c) => !c.cap || c.cap <= 0)) return null;
  const state = await readSpending(key.id);
  const now = new Date();
  for (const { window, cap } of caps) {
    if (!cap || cap <= 0) continue;
    const spent =
      window === 'day' ? state.dayMud : window === 'week' ? state.weekMud : state.monthMud;
    if (spent >= cap) {
      return {
        window,
        capMud: cap,
        spentMud: spent,
        resetAtUtc: resetAt(window, now).toISOString(),
      };
    }
  }
  return null;
}

function resetAt(window: Window, now: Date): Date {
  if (window === 'day') {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  }
  if (window === 'week') {
    const days = 7 - ((now.getUTCDay() + 6) % 7); // days until next ISO Monday
    return new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + days),
    );
  }
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}
