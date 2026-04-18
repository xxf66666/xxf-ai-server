import { eq, sql } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { apiKeys, users } from '../../db/schema.js';
import { logger } from '../../utils/logger.js';
import { billingDebitFailures } from '../../utils/metrics.js';

/**
 * Debit a user for one request. Balance is allowed to go negative — the
 * upstream hard-gate lives in requireApiKey, which rejects new calls
 * when balance <= 0.
 *
 * Failures must NOT be swallowed: previously the call sites wrapped this
 * in `.catch(() => {})`, which meant a transient DB blip would quietly
 * lose a billing entry. Now we throw; callers log + bump a metric so
 * drift is visible and a reconciliation job can find it.
 */
export async function debitForRequest(apiKeyId: string, costMud: number): Promise<void> {
  if (costMud <= 0) return;
  // Single SQL call: users is updated via a subquery on api_keys so we
  // don't need a second round trip to look up the owner.
  await db.execute(sql`
    UPDATE ${users}
       SET balance_mud = balance_mud - ${costMud},
           spent_mud   = spent_mud   + ${costMud},
           updated_at  = now()
     WHERE id = (SELECT user_id FROM ${apiKeys} WHERE id = ${apiKeyId})
  `);
}

/**
 * Run debitForRequest but never reject; on failure we log loudly and
 * bump the billing_debit_failed metric so we can spot drift. Use this
 * in the relay hot path (where we already sent the user their bytes
 * and must not crash a streaming finally block).
 */
export async function debitForRequestSafe(apiKeyId: string, costMud: number): Promise<void> {
  try {
    await debitForRequest(apiKeyId, costMud);
  } catch (err) {
    billingDebitFailures.inc();
    logger.error(
      { err, apiKeyId, costMud },
      'debit_failed — billing drift until reconciled',
    );
  }
}

export async function seedWelcomeCredit(userId: string, mud: number): Promise<void> {
  if (mud <= 0) return;
  await db.update(users).set({ balanceMud: mud }).where(eq(users.id, userId));
}
