import type { FastifyInstance } from 'fastify';
import { db } from '../../db/client.js';
import { modelPricing } from '../../db/schema.js';
import { getSetting } from '../../core/settings/index.js';

// Public: model prices + operator markup + USD→CNY rate. Anyone can GET —
// this is the landing page table. Cached for 60s via Cache-Control so
// a flood of pricing-page visitors doesn't pound the DB.
export async function registerPublicPricing(app: FastifyInstance): Promise<void> {
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
