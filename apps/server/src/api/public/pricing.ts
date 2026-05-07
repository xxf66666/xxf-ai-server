import type { FastifyInstance } from 'fastify';
import { db } from '../../db/client.js';
import { modelPricing } from '../../db/schema.js';
import { getSetting } from '../../core/settings/index.js';
import { providersCatalog } from '../../core/providers/catalog.js';

// Public: model prices + operator markup + USD→CNY rate. Anyone can GET —
// this is the landing page table. Cached for 60s via Cache-Control so
// a flood of pricing-page visitors doesn't pound the DB.
export async function registerPublicPricing(app: FastifyInstance): Promise<void> {
  // Provider-grouped catalog. Public — same data the console page uses,
  // but trimmed: never reveals which providers are actually configured
  // (state is collapsed to "live" / "pool" / "pending"). Honest enough
  // for landing/pricing without leaking ops state.
  app.get('/v1/catalog', async (_req, reply) => {
    const [catalog, markup, usdToCny] = await Promise.all([
      providersCatalog(),
      getSetting('pricing.markupRate').then((v) => Number(v) || 1),
      getSetting('pricing.usdToCnyRate').then((v) => Number(v) || 7.2),
    ]);
    reply.header('cache-control', 'public, max-age=60');
    return {
      markupRate: markup,
      usdToCnyRate: usdToCny,
      data: catalog.data.map((p) => ({
        slug: p.slug,
        displayName: p.displayName,
        tagline: p.tagline,
        // collapse "disabled" → "pending" so the public can't tell the
        // difference between "no key" and "key set but paused".
        state: p.state === 'disabled' ? 'pending' : p.state,
        models: p.models.map((m) => ({
          id: m.id,
          tier: m.tier,
          officialInputUsdPerM: m.inputUsdPerM,
          officialOutputUsdPerM: m.outputUsdPerM,
          ourInputUsdPerM: +(m.inputUsdPerM * markup).toFixed(6),
          ourOutputUsdPerM: +(m.outputUsdPerM * markup).toFixed(6),
          cacheReadUsdPerM:
            m.cacheReadUsdPerM !== null ? +(m.cacheReadUsdPerM * markup).toFixed(6) : null,
        })),
      })),
    };
  });

  app.get('/v1/pricing', async (_req, reply) => {
    const rows = await db.select().from(modelPricing);
    const markup = Number(await getSetting('pricing.markupRate')) || 1;
    const usdToCny = Number(await getSetting('pricing.usdToCnyRate')) || 7.2;
    reply.header('cache-control', 'public, max-age=60');
    return {
      markupRate: markup,
      usdToCnyRate: usdToCny,
      data: rows.map((r) => {
        const officialInputUsdPerM = r.inputMudPerM / 1_000_000;
        const officialOutputUsdPerM = r.outputMudPerM / 1_000_000;
        const ourInputUsdPerM = +(officialInputUsdPerM * markup).toFixed(6);
        const ourOutputUsdPerM = +(officialOutputUsdPerM * markup).toFixed(6);
        return {
          modelId: r.modelId,
          provider: r.provider,
          tier: r.tier,
          officialInputUsdPerM,
          officialOutputUsdPerM,
          ourInputUsdPerM,
          ourOutputUsdPerM,
          ourInputCnyPerM: +(ourInputUsdPerM * usdToCny).toFixed(4),
          ourOutputCnyPerM: +(ourOutputUsdPerM * usdToCny).toFixed(4),
        };
      }),
    };
  });
}
