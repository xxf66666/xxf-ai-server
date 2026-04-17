import { eq, sql } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { apiKeys, type ApiKey } from '../../db/schema.js';

/** True if a key has spent its monthly allowance. `quota=null` means unlimited. */
export function isOverQuota(key: ApiKey): boolean {
  if (key.quotaMonthlyTokens == null) return false;
  return key.usedMonthlyTokens >= key.quotaMonthlyTokens;
}

/** Record usage against a key atomically. Best-effort — log + swallow failures. */
export async function recordKeyUsage(apiKeyId: string, tokens: number): Promise<void> {
  if (tokens <= 0) {
    await db
      .update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, apiKeyId));
    return;
  }
  await db
    .update(apiKeys)
    .set({
      usedMonthlyTokens: sql`${apiKeys.usedMonthlyTokens} + ${tokens}`,
      lastUsedAt: new Date(),
    })
    .where(eq(apiKeys.id, apiKeyId));
}
