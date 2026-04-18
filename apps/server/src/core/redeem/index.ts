import { randomBytes } from 'node:crypto';
import { desc, eq, sql } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { redeemCodes, users, type RedeemCode } from '../../db/schema.js';

/**
 * 16-char base32-ish code, hyphenated as XXFR-XXXX-XXXX-XXXX.
 * ~80 bits entropy (32^16 ≈ 1.2×10^24). Safe to hand out publicly since
 * it's the shared secret between admin + holder.
 */
export function generateRedeemCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const raw = randomBytes(16);
  let s = '';
  for (let i = 0; i < 16; i++) s += alphabet[raw[i]! % alphabet.length]!;
  return `XXFR-${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}`;
}

export interface MintInput {
  valueMud: number;
  count?: number; // default 1; max 200
  note?: string | null;
  createdByUserId?: string | null;
}

export async function mintBatch(input: MintInput): Promise<RedeemCode[]> {
  const count = Math.max(1, Math.min(200, input.count ?? 1));
  const rows = Array.from({ length: count }, () => ({
    code: generateRedeemCode(),
    valueMud: input.valueMud,
    note: input.note ?? null,
    createdByUserId: input.createdByUserId ?? null,
  }));
  const inserted = await db.insert(redeemCodes).values(rows).returning();
  return inserted;
}

export async function listCodes(): Promise<RedeemCode[]> {
  return db.select().from(redeemCodes).orderBy(desc(redeemCodes.createdAt));
}

export async function listMyRedeemed(userId: string): Promise<RedeemCode[]> {
  return db
    .select()
    .from(redeemCodes)
    .where(eq(redeemCodes.redeemedByUserId, userId))
    .orderBy(desc(redeemCodes.redeemedAt));
}

export async function revokeCode(id: string): Promise<void> {
  await db.update(redeemCodes).set({ revoked: true }).where(eq(redeemCodes.id, id));
}

export async function deleteCode(id: string): Promise<void> {
  await db.delete(redeemCodes).where(eq(redeemCodes.id, id));
}

/**
 * Attempt to redeem. Returns { ok: true, value } on success, or an error
 * kind describing why it failed.
 *
 * Transactional: both the claim UPDATE and the user balance increment
 * run in a single db.transaction() so a process crash between them
 * cannot leave a code "redeemed" while the user never received credit.
 * Inside the tx, the claim UPDATE guards on `redeemed_by IS NULL AND
 * revoked = false` so concurrent redemptions all-but-one see 0 rows.
 */
export type RedeemResult =
  | { ok: true; valueMud: number }
  | { ok: false; reason: 'not_found' | 'revoked' | 'already_redeemed' };

export async function consumeRedeemCode(
  code: string,
  userId: string,
): Promise<RedeemResult> {
  // Normalize input: users paste with / without spaces / different case.
  const normalized = code.trim().toUpperCase().replace(/\s+/g, '');

  return db.transaction(async (tx) => {
    // Fast-path a friendly error for the revoked case. Missing code and
    // already-redeemed both come back as 0-row UPDATE below; `revoked`
    // needs a read to distinguish (UI wants to surface "revoked" vs
    // "already redeemed" vs "not found" differently).
    const [existing] = await tx
      .select({ revoked: redeemCodes.revoked })
      .from(redeemCodes)
      .where(eq(redeemCodes.code, normalized))
      .limit(1);
    if (existing?.revoked) return { ok: false as const, reason: 'revoked' as const };

    const claimed = await tx.execute<{ value_mud: number }>(sql`
      UPDATE ${redeemCodes}
         SET redeemed_by_user_id = ${userId},
             redeemed_at = now()
       WHERE code = ${normalized}
         AND redeemed_by_user_id IS NULL
         AND revoked = false
      RETURNING value_mud
    `);
    if (claimed.length === 0) {
      return {
        ok: false as const,
        reason: existing ? ('already_redeemed' as const) : ('not_found' as const),
      };
    }
    const value = Number(claimed[0]!.value_mud);
    await tx
      .update(users)
      .set({
        balanceMud: sql`${users.balanceMud} + ${value}`,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
    return { ok: true as const, valueMud: value };
  });
}

