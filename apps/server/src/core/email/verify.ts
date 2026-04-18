import { randomBytes } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
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
 * Atomic consume: mark token used AND flip users.email_verified in one
 * call. Returns the userId on success or null for not-found / expired /
 * already-used.
 */
export async function consumeVerificationToken(token: string): Promise<string | null> {
  // Claim the token; guard so parallel clicks only one succeeds.
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
  await db
    .update(users)
    .set({ emailVerified: true, emailVerifiedAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, userId));
  return userId;
}
