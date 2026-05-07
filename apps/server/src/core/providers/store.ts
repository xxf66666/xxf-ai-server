import { eq } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { providerConfigs, type ProviderConfig } from '../../db/schema.js';
import { open, seal, type Sealed } from '../../utils/crypto.js';
import { redis } from '../../cache/redis.js';

const CACHE_TTL_SECONDS = 60;
const cacheKey = (slug: string) => `provider:cred:${slug}`;

/** Plaintext credential view used at the relay hot path. */
export interface ProviderCredential {
  slug: string;
  apiKey: string;
  baseUrlOverride: string | null;
  enabled: boolean;
}

function unseal(raw: string): string | null {
  try {
    const parsed = JSON.parse(raw) as Sealed;
    return open(parsed);
  } catch {
    return null;
  }
}

/** Returns the configured credential for a vendor, or null if not set
 * (or sealed value couldn't be decrypted, e.g. ENCRYPTION_KEY rotation). */
export async function getCredential(slug: string): Promise<ProviderCredential | null> {
  const cached = await redis.get(cacheKey(slug));
  if (cached) return JSON.parse(cached) as ProviderCredential;

  const [row] = await db
    .select()
    .from(providerConfigs)
    .where(eq(providerConfigs.slug, slug))
    .limit(1);
  if (!row || !row.apiKeySealed) return null;
  const apiKey = unseal(row.apiKeySealed);
  if (!apiKey) return null;
  const cred: ProviderCredential = {
    slug,
    apiKey,
    baseUrlOverride: row.baseUrlOverride,
    enabled: row.enabled,
  };
  await redis.set(cacheKey(slug), JSON.stringify(cred), 'EX', CACHE_TTL_SECONDS);
  return cred;
}

export async function setCredential(
  slug: string,
  apiKey: string,
  baseUrlOverride: string | null = null,
): Promise<void> {
  const sealed = JSON.stringify(seal(apiKey));
  const now = new Date();
  await db
    .insert(providerConfigs)
    .values({
      slug,
      apiKeySealed: sealed,
      baseUrlOverride,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: providerConfigs.slug,
      set: {
        apiKeySealed: sealed,
        baseUrlOverride,
        updatedAt: now,
      },
    });
  await redis.del(cacheKey(slug));
}

export async function clearCredential(slug: string): Promise<void> {
  await db
    .update(providerConfigs)
    .set({ apiKeySealed: null, lastTestedAt: null, lastTestOk: null, updatedAt: new Date() })
    .where(eq(providerConfigs.slug, slug));
  await redis.del(cacheKey(slug));
}

export async function setEnabled(slug: string, enabled: boolean): Promise<void> {
  await db
    .update(providerConfigs)
    .set({ enabled, updatedAt: new Date() })
    .where(eq(providerConfigs.slug, slug));
  await redis.del(cacheKey(slug));
}

export async function recordTest(slug: string, ok: boolean): Promise<void> {
  await db
    .update(providerConfigs)
    .set({ lastTestedAt: new Date(), lastTestOk: ok, updatedAt: new Date() })
    .where(eq(providerConfigs.slug, slug));
}

/** Admin-facing summary; never returns the actual key. */
export interface ProviderStatusRow {
  slug: string;
  configured: boolean;
  enabled: boolean;
  baseUrlOverride: string | null;
  lastTestedAt: string | null;
  lastTestOk: boolean | null;
}

export async function listStatus(): Promise<ProviderStatusRow[]> {
  const rows = await db.select().from(providerConfigs);
  return rows.map((r: ProviderConfig) => ({
    slug: r.slug,
    configured: !!r.apiKeySealed,
    enabled: r.enabled,
    baseUrlOverride: r.baseUrlOverride,
    lastTestedAt: r.lastTestedAt?.toISOString() ?? null,
    lastTestOk: r.lastTestOk,
  }));
}
