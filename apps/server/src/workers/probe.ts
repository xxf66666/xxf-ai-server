import { and, eq, isNull, or, lt } from 'drizzle-orm';
import { db } from '../db/client.js';
import { accounts } from '../db/schema.js';
import { probeAccount } from '../core/accounts/probe.js';
import { logger } from '../utils/logger.js';

// Don't re-probe an account that was probed recently.
const MIN_PROBE_INTERVAL_MS = 15 * 60 * 1000;

export async function probeTick(): Promise<void> {
  const cutoff = new Date(Date.now() - MIN_PROBE_INTERVAL_MS);
  const due = await db
    .select()
    .from(accounts)
    .where(
      and(
        eq(accounts.status, 'active'),
        or(isNull(accounts.lastProbeAt), lt(accounts.lastProbeAt, cutoff)),
      ),
    );
  if (due.length === 0) return;
  logger.info({ count: due.length }, 'probe worker: probing accounts');
  for (const acct of due) {
    try {
      await probeAccount(acct);
    } catch (err) {
      logger.warn({ err, accountId: acct.id }, 'probe tick failed for account');
    }
  }
}
