import { eq } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { accounts, type Account } from '../../db/schema.js';
import { logger } from '../../utils/logger.js';

export type Classification =
  | { kind: 'ok' }
  | { kind: 'rate_limited'; coolingUntil: Date }
  | { kind: 'needs_reauth' }
  | { kind: 'banned' }
  | { kind: 'transient' };

// Default cool-off when Retry-After isn't present.
const DEFAULT_COOL_SECONDS = 5 * 60;

export function classifyUpstream(status: number, retryAfter: string | null, body: string): Classification {
  if (status >= 200 && status < 300) return { kind: 'ok' };

  if (status === 429) {
    const seconds = parseRetryAfter(retryAfter) ?? DEFAULT_COOL_SECONDS;
    return { kind: 'rate_limited', coolingUntil: new Date(Date.now() + seconds * 1000) };
  }
  if (status === 401) {
    return { kind: 'needs_reauth' };
  }
  if (status === 403) {
    // 403 with an Anthropic "suspended"/"abuse" error is terminal — owner
    // has to argue with support. Otherwise it's likely a scope issue; we
    // treat it as needs_reauth so the human can re-authorize.
    if (/suspend|abuse|terminated/i.test(body)) return { kind: 'banned' };
    return { kind: 'needs_reauth' };
  }
  if (status >= 500) return { kind: 'transient' };
  return { kind: 'transient' };
}

function parseRetryAfter(header: string | null): number | null {
  if (!header) return null;
  const n = Number(header);
  if (Number.isFinite(n)) return n;
  const date = Date.parse(header);
  if (!Number.isNaN(date)) return Math.max(0, Math.floor((date - Date.now()) / 1000));
  return null;
}

export async function applyClassification(account: Account, c: Classification): Promise<void> {
  if (c.kind === 'ok' || c.kind === 'transient') return;
  const patch: Partial<Account> = { updatedAt: new Date() };
  if (c.kind === 'rate_limited') {
    patch.status = 'rate_limited';
    patch.coolingUntil = c.coolingUntil;
  } else if (c.kind === 'needs_reauth') {
    patch.status = 'needs_reauth';
  } else if (c.kind === 'banned') {
    patch.status = 'banned';
  }
  logger.warn({ accountId: account.id, kind: c.kind }, 'account status transition');
  await db.update(accounts).set(patch).where(eq(accounts.id, account.id));
}
