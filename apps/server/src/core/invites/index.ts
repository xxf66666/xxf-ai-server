import { randomBytes } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { inviteCodes, type InviteCode } from '../../db/schema.js';

/** 12 upper-case base32-ish chars, e.g. `XXFAI-8GZK3M`. */
export function generateCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const raw = randomBytes(8);
  let out = 'XXFAI-';
  for (let i = 0; i < 8; i++) {
    out += alphabet[raw[i]! % alphabet.length]!;
  }
  return out;
}

export interface CreateInput {
  note?: string | null;
  maxUses?: number;
  createdByUserId?: string | null;
  expiresAt?: Date | null;
}

export async function createInvite(input: CreateInput): Promise<InviteCode> {
  const code = generateCode();
  const [row] = await db
    .insert(inviteCodes)
    .values({
      code,
      note: input.note ?? null,
      maxUses: input.maxUses ?? 1,
      createdByUserId: input.createdByUserId ?? null,
      expiresAt: input.expiresAt ?? null,
    })
    .returning();
  if (!row) throw new Error('failed to insert invite_code');
  return row;
}

/**
 * Try to consume an invite on behalf of a registration. Returns the row on
 * success (use_count was incremented) or null if the code is invalid /
 * revoked / expired / exhausted. Uses an atomic UPDATE with guarded WHERE
 * to avoid races when two registrations try the same code simultaneously.
 */
export async function consumeInvite(code: string): Promise<InviteCode | null> {
  const now = new Date();
  const result = await db.execute<{
    id: string;
    code: string;
    note: string | null;
    created_by_user_id: string | null;
    max_uses: number;
    use_count: number;
    revoked: boolean;
    expires_at: Date | null;
    created_at: Date;
  }>(sql`
    UPDATE ${inviteCodes}
       SET use_count = use_count + 1
     WHERE code = ${code}
       AND revoked = false
       AND use_count < max_uses
       AND (expires_at IS NULL OR expires_at > ${now})
    RETURNING *
  `);
  const row = result[0];
  if (!row) return null;
  return {
    id: row.id,
    code: row.code,
    note: row.note,
    createdByUserId: row.created_by_user_id,
    maxUses: row.max_uses,
    useCount: row.use_count,
    revoked: row.revoked,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

export async function listInvites(): Promise<InviteCode[]> {
  return db.select().from(inviteCodes);
}

/** Revoke an invite — doesn't delete the row, just marks it unusable. */
export async function revokeInvite(id: string): Promise<void> {
  await db.update(inviteCodes).set({ revoked: true }).where(eq(inviteCodes.id, id));
}

/**
 * Reset an invite: regenerate its code string and reset use_count + revoked.
 * Preserves id + note + max_uses + created_by so admin can re-issue to the
 * same person without another table row.
 */
export async function resetInvite(id: string): Promise<InviteCode | null> {
  const code = generateCode();
  await db
    .update(inviteCodes)
    .set({ code, useCount: 0, revoked: false })
    .where(eq(inviteCodes.id, id));
  const rows = await db
    .select()
    .from(inviteCodes)
    .where(eq(inviteCodes.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function deleteInvite(id: string): Promise<void> {
  await db.delete(inviteCodes).where(eq(inviteCodes.id, id));
}
