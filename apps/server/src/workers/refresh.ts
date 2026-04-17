import { and, isNotNull, lt } from 'drizzle-orm';
import { db } from '../db/client.js';
import { accounts } from '../db/schema.js';
import { ensureFreshAccessToken } from '../core/oauth/refresh.js';
import { logger } from '../utils/logger.js';

const REFRESH_AHEAD_SECONDS = 10 * 60; // refresh anything expiring in the next 10 min

export async function refreshTick(): Promise<void> {
  const threshold = new Date(Date.now() + REFRESH_AHEAD_SECONDS * 1000);
  const due = await db
    .select()
    .from(accounts)
    .where(and(isNotNull(accounts.tokenExpiresAt), lt(accounts.tokenExpiresAt, threshold)));
  if (due.length === 0) return;
  logger.info({ count: due.length }, 'refresh worker: refreshing accounts');
  for (const acct of due) {
    try {
      await ensureFreshAccessToken(acct);
    } catch (err) {
      logger.warn({ err, accountId: acct.id }, 'refresh tick failed for account');
    }
  }
}
