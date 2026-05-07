import { desc } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { modelPricing } from '../../db/schema.js';
import { PROVIDERS } from './registry.js';
import { listStatus } from './store.js';

export interface CatalogModel {
  id: string;
  tier: string | null;
  inputUsdPerM: number;
  outputUsdPerM: number;
  cacheReadUsdPerM: number | null;
  cacheCreationUsdPerM: number | null;
}

export interface CatalogProvider {
  slug: string;
  displayName: string;
  tagline: string;
  /**
   *  pool      — Claude Code OAuth pool (we always ship; account
   *              availability is the gating factor on this site)
   *  live      — operator configured an API key + provider is enabled
   *  pending   — registry knows about it but no key yet
   *  disabled  — key set but operator paused it
   */
  state: 'pool' | 'live' | 'pending' | 'disabled';
  models: CatalogModel[];
}

/**
 * Map provider_configs DB rows + registry definitions + model_pricing
 * rows into the layout the /console/models page wants. Pure aggregation;
 * cheap enough to call on every page render.
 */
export async function providersCatalog(): Promise<{ data: CatalogProvider[] }> {
  const [pricing, status] = await Promise.all([
    db
      .select({
        modelId: modelPricing.modelId,
        provider: modelPricing.provider,
        tier: modelPricing.tier,
        inputMudPerM: modelPricing.inputMudPerM,
        outputMudPerM: modelPricing.outputMudPerM,
        cacheReadMudPerM: modelPricing.cacheReadMudPerM,
        cacheCreationMudPerM: modelPricing.cacheCreationMudPerM,
      })
      .from(modelPricing)
      .orderBy(desc(modelPricing.inputMudPerM)),
    listStatus(),
  ]);
  const statusBySlug = new Map(status.map((s) => [s.slug, s]));
  const modelsBySlug = new Map<string, CatalogModel[]>();
  for (const row of pricing) {
    const list = modelsBySlug.get(row.provider) ?? [];
    list.push({
      id: row.modelId,
      tier: row.tier,
      inputUsdPerM: Number(row.inputMudPerM) / 1_000_000,
      outputUsdPerM: Number(row.outputMudPerM) / 1_000_000,
      cacheReadUsdPerM:
        row.cacheReadMudPerM !== null ? Number(row.cacheReadMudPerM) / 1_000_000 : null,
      cacheCreationUsdPerM:
        row.cacheCreationMudPerM !== null
          ? Number(row.cacheCreationMudPerM) / 1_000_000
          : null,
    });
    modelsBySlug.set(row.provider, list);
  }
  // Sort each vendor's models by input price desc (flagship first).
  for (const list of modelsBySlug.values()) {
    list.sort((a, b) => b.inputUsdPerM - a.inputUsdPerM);
  }
  const data: CatalogProvider[] = PROVIDERS.map((p) => {
    const s = statusBySlug.get(p.slug);
    let state: CatalogProvider['state'];
    if (p.slug === 'claude') state = 'pool';
    else if (!s?.configured) state = 'pending';
    else if (!s.enabled) state = 'disabled';
    else state = 'live';
    return {
      slug: p.slug,
      displayName: p.displayName,
      tagline: p.tagline,
      state,
      models: modelsBySlug.get(p.slug) ?? [],
    };
  });
  return { data };
}
