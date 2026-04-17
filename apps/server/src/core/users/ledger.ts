import { eq, sql } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { apiKeys, users } from '../../db/schema.js';

/**
 * Debit a user for one request. We allow balance to go negative because
 * there is no real recharge yet — the $5 welcome credit is a signal, not
 * a hard gate. Treat it as a tracker the user can see on their dashboard.
 *
 * The update joins api_keys → users to find the right account without a
 * lookup round trip.
 */
export async function debitForRequest(apiKeyId: string, costMud: number): Promise<void> {
  if (costMud <= 0) return;
  // users is updated via a subquery on api_keys so we need only one SQL call.
  await db.execute(sql`
    UPDATE ${users}
       SET balance_mud = balance_mud - ${costMud},
           spent_mud   = spent_mud   + ${costMud},
           updated_at  = now()
     WHERE id = (SELECT user_id FROM ${apiKeys} WHERE id = ${apiKeyId})
  `);
}

export async function seedWelcomeCredit(userId: string, mud: number): Promise<void> {
  if (mud <= 0) return;
  await db.update(users).set({ balanceMud: mud }).where(eq(users.id, userId));
}
