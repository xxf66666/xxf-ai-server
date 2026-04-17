import { eq } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { systemSettings } from '../../db/schema.js';

// Known settings keys + their default values. Settings not in this map are
// rejected by the admin API so we don't accumulate dead/typo'd keys.
export const SETTING_DEFAULTS = {
  'pool.utilizationTarget': 0.8,
  'pool.minRemainingTokens': 1000,
  'models.allow': [] as string[], // empty = allow all
} as const;

export type SettingKey = keyof typeof SETTING_DEFAULTS;

export async function getAllSettings(): Promise<Record<SettingKey, unknown>> {
  const rows = await db.select().from(systemSettings);
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  const out = {} as Record<SettingKey, unknown>;
  for (const [k, def] of Object.entries(SETTING_DEFAULTS) as Array<[SettingKey, unknown]>) {
    out[k] = byKey.has(k) ? byKey.get(k) : def;
  }
  return out;
}

export async function getSetting<K extends SettingKey>(key: K): Promise<unknown> {
  const rows = await db.select().from(systemSettings).where(eq(systemSettings.key, key)).limit(1);
  return rows[0]?.value ?? SETTING_DEFAULTS[key];
}

export async function setSetting(key: SettingKey, value: unknown): Promise<void> {
  await db
    .insert(systemSettings)
    .values({ key, value })
    .onConflictDoUpdate({
      target: systemSettings.key,
      set: { value, updatedAt: new Date() },
    });
}
