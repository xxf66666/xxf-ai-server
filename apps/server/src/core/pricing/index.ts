import { eq } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { modelPricing, type ModelPricing } from '../../db/schema.js';
import { getSetting } from '../settings/index.js';
import { redis } from '../../cache/redis.js';

// Pricing cache: small, changes rarely (operator edits). 5-minute Redis
// TTL keeps the relay hot path DB-free.
const CACHE_TTL_SECONDS = 300;
const cacheKey = (modelId: string) => `pricing:model:${modelId}`;

interface CachedPricing {
  modelId: string;
  provider: string;
  inputMudPerM: number;
  outputMudPerM: number;
  cacheReadMudPerM: number | null;
  cacheCreationMudPerM: number | null;
  tier: string | null;
}

async function fetchPricing(modelId: string): Promise<CachedPricing | null> {
  const cached = await redis.get(cacheKey(modelId));
  if (cached) return JSON.parse(cached) as CachedPricing;
  const [row] = await db
    .select()
    .from(modelPricing)
    .where(eq(modelPricing.modelId, modelId))
    .limit(1);
  if (!row) return null;
  const payload: CachedPricing = {
    modelId: row.modelId,
    provider: row.provider,
    inputMudPerM: row.inputMudPerM,
    outputMudPerM: row.outputMudPerM,
    cacheReadMudPerM: row.cacheReadMudPerM,
    cacheCreationMudPerM: row.cacheCreationMudPerM,
    tier: row.tier,
  };
  await redis.set(cacheKey(modelId), JSON.stringify(payload), 'EX', CACHE_TTL_SECONDS);
  return payload;
}

export interface ComputeCostInput {
  inputTokens: number;
  outputTokens: number;
  /** Replayed from prompt cache. Billed at cache_read rate. */
  cacheReadTokens?: number;
  /** Written into cache this turn. Billed at cache_creation rate. */
  cacheCreationTokens?: number;
}

/**
 * Compute the cost charged to the user for one request, in micro-USD.
 * Cache reads and cache creations are billed at their own rates; if a
 * model has no cache pricing configured (nullable columns), those
 * token buckets fall back to the flat input rate.
 *
 * Unknown models return 0 — we never fail a request just because
 * pricing isn't seeded. Operators see zero-cost rows and fix the
 * pricing table.
 */
export async function computeCost(
  modelId: string,
  input: ComputeCostInput,
): Promise<number>;
// Back-compat overload so old call sites keep compiling during rollout.
export async function computeCost(
  modelId: string,
  inputTokens: number,
  outputTokens: number,
): Promise<number>;
export async function computeCost(
  modelId: string,
  arg2: number | ComputeCostInput,
  arg3?: number,
): Promise<number> {
  const pricing = await fetchPricing(modelId);
  if (!pricing) return 0;
  const markup = Number(await getSetting('pricing.markupRate')) || 1;

  const tokens: ComputeCostInput =
    typeof arg2 === 'number'
      ? { inputTokens: arg2, outputTokens: arg3 ?? 0 }
      : arg2;

  const cacheReadRate = pricing.cacheReadMudPerM ?? pricing.inputMudPerM;
  const cacheCreationRate = pricing.cacheCreationMudPerM ?? pricing.inputMudPerM;

  const raw =
    (pricing.inputMudPerM * tokens.inputTokens +
      cacheReadRate * (tokens.cacheReadTokens ?? 0) +
      cacheCreationRate * (tokens.cacheCreationTokens ?? 0) +
      pricing.outputMudPerM * tokens.outputTokens) /
    1_000_000;
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
