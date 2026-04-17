import type { FastifyInstance } from 'fastify';
import { db } from '../db/client.js';
import { redis } from '../cache/redis.js';
import { sql } from 'drizzle-orm';
import { registry } from '../utils/metrics.js';

export async function registerHealth(app: FastifyInstance): Promise<void> {
  app.get('/healthz', async () => ({ ok: true }));

  app.get('/readyz', async (_req, reply) => {
    const checks: Record<string, 'ok' | 'fail'> = { db: 'fail', redis: 'fail' };

    try {
      await db.execute(sql`select 1`);
      checks.db = 'ok';
    } catch {
      // noop
    }

    try {
      await redis.ping();
      checks.redis = 'ok';
    } catch {
      // noop
    }

    const ok = Object.values(checks).every((v) => v === 'ok');
    return reply.code(ok ? 200 : 503).send({ ok, checks });
  });

  app.get('/version', async () => ({
    name: 'xxf-ai-server',
    version: process.env.npm_package_version ?? '0.0.0',
    commit: process.env.GIT_COMMIT ?? 'unknown',
  }));

  // Prometheus scrape target. Deliberately NOT behind admin auth — put it
  // behind a separate Caddy path rule if you want IP-allowlisting.
  app.get('/metrics', async (_req, reply) => {
    const body = await registry.metrics();
    return reply.header('content-type', registry.contentType).send(body);
  });
}
