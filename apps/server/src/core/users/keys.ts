import { createHash, randomBytes } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { apiKeys, type ApiKey } from '../../db/schema.js';

const PREFIX = 'sk-xxf-';

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function mintSecret(): string {
  // 24 random bytes → 32 base64url chars. Total key len = "sk-xxf-" + 32 = 39.
  return PREFIX + randomBytes(24).toString('base64url');
}

export interface MintInput {
  userId: string;
  name: string;
  quotaMonthlyTokens?: number | null;
  expiresAt?: Date | null;
  allowedModels?: string[] | null;
}

export interface MintResult {
  record: ApiKey;
  plaintext: string; // Return ONCE; never persisted.
}

export async function mintApiKey(input: MintInput): Promise<MintResult> {
  const plaintext = mintSecret();
  const keyHash = sha256(plaintext);
  // Deliberately narrow: `sk-xxf-…xxxx` — enough for the user to
  // recognise which key is which, but without leaking 48 bits of
  // entropy like the old "first 10 + last 4" preview did.
  const keyPreview = `sk-xxf-…${plaintext.slice(-4)}`;
  const [row] = await db
    .insert(apiKeys)
    .values({
      userId: input.userId,
      name: input.name,
      keyHash,
      keyPreview,
      quotaMonthlyTokens: input.quotaMonthlyTokens ?? null,
      expiresAt: input.expiresAt ?? null,
      allowedModels: input.allowedModels ?? null,
    })
    .returning();
  if (!row) throw new Error('failed to insert api_key');
  return { record: row, plaintext };
}

export async function findActiveByPlaintext(plaintext: string): Promise<ApiKey | null> {
  if (!plaintext.startsWith(PREFIX)) return null;
  const hash = sha256(plaintext);
  const rows = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.keyHash, hash), eq(apiKeys.status, 'active')))
    .limit(1);
  return rows[0] ?? null;
}

export async function listApiKeys(userId: string): Promise<ApiKey[]> {
  return db.select().from(apiKeys).where(eq(apiKeys.userId, userId));
}

export async function revokeApiKey(id: string): Promise<void> {
  await db.update(apiKeys).set({ status: 'revoked' }).where(eq(apiKeys.id, id));
}

/**
 * Returns true if the key is allowed to use the given model. `null` /
 * empty allowedModels means unrestricted (the historical default).
 */
export function keyAllowsModel(key: ApiKey, model: string): boolean {
  const allow = key.allowedModels;
  if (!allow || allow.length === 0) return true;
  return allow.includes(model);
}
