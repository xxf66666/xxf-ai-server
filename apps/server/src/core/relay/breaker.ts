import type { Provider } from '@xxf/shared';
import { redis } from '../../cache/redis.js';
import { logger } from '../../utils/logger.js';

// Sliding 60s window: count total requests + error requests per provider.
// If errorRate > threshold and volume > minSamples, open the circuit for
// OPEN_SECONDS; during that window relay short-circuits to 503.

const WINDOW_SECONDS = 60;
const OPEN_SECONDS = 30;
const ERROR_RATE_THRESHOLD = 0.2;
const MIN_SAMPLES = 10;

function totalKey(p: Provider): string {
  return `cb:${p}:total`;
}
function errorKey(p: Provider): string {
  return `cb:${p}:errors`;
}
function openKey(p: Provider): string {
  return `cb:${p}:open`;
}

async function bump(key: string): Promise<void> {
  await redis
    .multi()
    .incr(key)
    .expire(key, WINDOW_SECONDS, 'NX')
    .exec();
}

export async function recordRequest(provider: Provider, isError: boolean): Promise<void> {
  await bump(totalKey(provider));
  if (isError) await bump(errorKey(provider));
  // Decide whether to open.
  const [totalStr, errorStr] = await Promise.all([
    redis.get(totalKey(provider)),
    redis.get(errorKey(provider)),
  ]);
  const total = Number(totalStr ?? 0);
  const errors = Number(errorStr ?? 0);
  if (total >= MIN_SAMPLES && errors / total >= ERROR_RATE_THRESHOLD) {
    const existing = await redis.get(openKey(provider));
    if (!existing) {
      await redis.set(openKey(provider), '1', 'EX', OPEN_SECONDS);
      logger.warn({ provider, total, errors }, 'circuit breaker opened');
    }
  }
}

export async function isOpen(provider: Provider): Promise<boolean> {
  return Boolean(await redis.get(openKey(provider)));
}
