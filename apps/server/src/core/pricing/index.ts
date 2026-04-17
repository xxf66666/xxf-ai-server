import { eq } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { modelPricing, type ModelPricing } from '../../db/schema.js';
import { getSetting } from '../settings/index.js';
import { redis } from '../../cache/redis.js';

// Pricing cache: small, changes rarely (operator edits). 5-minute Redis
// TTL keeps the relay hot path DB-free.
const CACHE_TTL_SECONDS = 300;
const cacheKey = (modelId: string) => `pricing:model:${modelId}`;

export interface PricingMeta {
  inputMudPerM: number;
  outputMudPerM: number;
  markupRate: number; // 0..1, <1 = discount
}

async function fetchPricing(modelId: string): Promise<Omit<ModelPricing, 'id' | 'updatedAt'> | null> {
  const cached = await redis.get(cacheKey(modelId));
  if (cached) return JSON.parse(cached);
  const [row] = await db
    .select()
    .from(modelPricing)
    .where(eq(modelPricing.modelId, modelId))
    .limit(1);
  if (!row) return null;
  const payload = {
    modelId: row.modelId,
    provider: row.provider,
    inputMudPerM: row.inputMudPerM,
    outputMudPerM: row.outputMudPerM,
    tier: row.tier,
  };
  await redis.set(cacheKey(modelId), JSON.stringify(payload), 'EX', CACHE_TTL_SECONDS);
  return payload;
}

/**
 * Compute the cost charged to the user for one request, in micro-USD
 * (10^-6 USD). Unknown models return 0 — we never fail a request just
 * because pricing isn't seeded. Operator sees zero-cost rows and fixes
 * the pricing table.
 */
export async function computeCost(
  modelId: string,
  inputTokens: number,
  outputTokens: number,
): Promise<number> {
  const pricing = await fetchPricing(modelId);
  if (!pricing) return 0;
  const markup = Number(await getSetting('pricing.markupRate')) || 1;
  const raw =
    (pricing.inputMudPerM * inputTokens + pricing.outputMudPerM * outputTokens) / 1_000_000;
  return Math.round(raw * markup);
}

export async function invalidatePricing(modelId: string): Promise<void> {
  await redis.del(cacheKey(modelId));
}

// Micro-USD (mud) conversion helpers. Treat as read-only primitives.
export const MUD_PER_USD = 1_000_000;
export const MUD_PER_CENT = 10_000;

export function mudToUsd(mud: number): number {
  return mud / MUD_PER_USD;
}
