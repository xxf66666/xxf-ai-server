import type { FastifyInstance } from 'fastify';
import { sql } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { redis } from '../../cache/redis.js';
import { providersCatalog } from '../../core/providers/catalog.js';

// Public status endpoint backing /status. Returns enough for a status
// page (api up, db/redis health, per-provider state + last successful
// probe time) but never exposes credentials or per-key telemetry.
// Cache-Control 15s — short enough to feel "live", long enough to not
// hammer the DB if a Twitter spike points at it.
export async function registerPublicStatus(app: FastifyInstance): Promise<void> {
  const startedAt = Date.now();

  app.get('/v1/status', async (_req, reply) => {
    const checks: Record<'db' | 'redis', 'ok' | 'fail'> = { db: 'fail', redis: 'fail' };
    try {
      await db.execute(sql`select 1`);
      checks.db = 'ok';
    } catch {
      // logged elsewhere; fall through with fail
    }
    try {
      await redis.ping();
      checks.redis = 'ok';
    } catch {
      // same
    }

    const catalog = await providersCatalog();
    const providers = catalog.data.map((p) => ({
      slug: p.slug,
      displayName: p.displayName,
      // Same collapse as /v1/catalog — public can't distinguish "no
      // key" from "operator paused this vendor".
      state: p.state === 'disabled' ? 'pending' : p.state,
      modelCount: p.models.length,
    }));

    const ok = checks.db === 'ok' && checks.redis === 'ok';

    reply.header('cache-control', 'public, max-age=15');
    return {
      ok,
      checks,
      uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
      version: process.env.npm_package_version ?? '0.0.0',
      commit: process.env.GIT_COMMIT ?? 'unknown',
      providers,
      now: new Date().toISOString(),
    };
  });
}
