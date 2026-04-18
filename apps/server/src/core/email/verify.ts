import { randomBytes } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { emailVerificationTokens, users } from '../../db/schema.js';

const TTL_HOURS = 48;

function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

export async function createVerificationToken(userId: string): Promise<string> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + TTL_HOURS * 60 * 60 * 1000);
  await db.insert(emailVerificationTokens).values({ userId, token, expiresAt });
  return token;
}

/**
 * Atomic consume: mark token used, flip email_verified, AND promote
 * pending_verification → active in one flow. Returns userId on success
 * or null for not-found / expired / already-used.
 *
 * Status transitions:
 *   pending_verification → active  (fresh-register happy path)
 *   active               → active  (re-verify, no-op change)
 *   suspended            → suspended  (NEVER auto-reactivate a banned
 *                                      account from a stale token — admin
 *                                      must explicitly reactivate)
 */
export async function consumeVerificationToken(token: string): Promise<string | null> {
  const claimed = await db.execute<{ user_id: string }>(sql`
    UPDATE ${emailVerificationTokens}
       SET used_at = now()
     WHERE token = ${token}
       AND used_at IS NULL
       AND expires_at > now()
    RETURNING user_id
  `);
  const userId = claimed[0]?.user_id;
  if (!userId) return null;
  await db.execute(sql`
    UPDATE ${users}
       SET email_verified = true,
           email_verified_at = now(),
           status = CASE
             WHEN status = 'pending_verification' THEN 'active'::user_status
             ELSE status
           END,
           updated_at = now()
     WHERE id = ${userId}
  `);
  return userId;
}
