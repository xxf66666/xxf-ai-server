import { randomBytes } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { passwordResetTokens, users } from '../../db/schema.js';
import { hashPassword } from '../users/passwords.js';

const TTL_MINUTES = 60;

function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

export async function createResetToken(userId: string): Promise<string> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + TTL_MINUTES * 60 * 1000);
  await db.insert(passwordResetTokens).values({ userId, token, expiresAt });
  return token;
}

/**
 * Atomic: claim the token AND write the new password hash. Resets the
 * failed-login counter / lock so a legitimate user who locked themselves
 * out via a guessing storm can get back in by completing a reset.
 *
 * Returns userId on success; null if the token is missing / expired /
 * already used (each is indistinguishable to the caller by design).
 */
export async function consumeResetToken(
  token: string,
  newPassword: string,
): Promise<string | null> {
  const claimed = await db.execute<{ user_id: string }>(sql`
    UPDATE ${passwordResetTokens}
       SET used_at = now()
     WHERE token = ${token}
       AND used_at IS NULL
       AND expires_at > now()
    RETURNING user_id
  `);
  const userId = claimed[0]?.user_id;
  if (!userId) return null;
  const hash = await hashPassword(newPassword);
  await db.execute(sql`
    UPDATE ${users}
       SET password_hash = ${hash},
           password_changed_at = now(),
           failed_login_count = 0,
           locked_until = NULL,
           updated_at = now()
     WHERE id = ${userId}
  `);
  return userId;
}
