import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { record } from '../../core/audit/log.js';
import { requireRole } from '../../middleware/rbac.js';
import { PROVIDERS, getProviderBySlug } from '../../core/providers/registry.js';
import {
  clearCredential,
  getCredential,
  listStatus,
  recordTest,
  setCredential,
  setEnabled,
} from '../../core/providers/store.js';
import { logger } from '../../utils/logger.js';

const SetSchema = z.object({
  apiKey: z.string().min(8).max(2048),
  baseUrlOverride: z.string().url().nullable().optional(),
});

const ToggleSchema = z.object({ enabled: z.boolean() });

export async function registerAdminProviders(app: FastifyInstance): Promise<void> {
  // List all providers (registry merged with DB status). Admin-only —
  // this surfaces credential metadata even though the secret itself is
  // never returned.
  app.get('/admin/v1/providers', async (req, reply) => {
    if (!requireRole(req, reply, ['admin'])) return;
    const status = await listStatus();
    const byslug = new Map(status.map((s) => [s.slug, s]));
    return {
      data: PROVIDERS.map((p) => {
        const s = byslug.get(p.slug);
        return {
          slug: p.slug,
          displayName: p.displayName,
          tagline: p.tagline,
          baseUrl: p.baseUrl,
          modelPrefixes: p.modelPrefixes,
          openaiCompat: p.openaiCompat,
          configured: s?.configured ?? false,
          enabled: s?.enabled ?? true,
          baseUrlOverride: s?.baseUrlOverride ?? null,
          lastTestedAt: s?.lastTestedAt ?? null,
          lastTestOk: s?.lastTestOk ?? null,
        };
      }),
    };
  });

  app.put('/admin/v1/providers/:slug', async (req, reply) => {
    if (!requireRole(req, reply, ['admin'])) return;
    const slug = (req.params as { slug: string }).slug;
    if (!getProviderBySlug(slug)) {
      return reply.code(404).send({
        type: 'error',
        error: { type: 'invalid_request_error', message: 'unknown provider' },
      });
    }
    const parsed = SetSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        type: 'error',
        error: { type: 'invalid_request_error', message: parsed.error.message },
      });
    }
    await setCredential(
      slug,
      parsed.data.apiKey,
      parsed.data.baseUrlOverride ?? null,
    );
    await record(req, {
      action: 'provider.configure',
      entityType: 'provider',
      entityId: slug,
      detail: { hasOverride: !!parsed.data.baseUrlOverride },
    });
    return { ok: true };
  });

  app.delete('/admin/v1/providers/:slug', async (req, reply) => {
    if (!requireRole(req, reply, ['admin'])) return;
    const slug = (req.params as { slug: string }).slug;
    await clearCredential(slug);
    await record(req, {
      action: 'provider.clear',
      entityType: 'provider',
      entityId: slug,
    });
    return { ok: true };
  });

  app.patch('/admin/v1/providers/:slug', async (req, reply) => {
    if (!requireRole(req, reply, ['admin'])) return;
    const slug = (req.params as { slug: string }).slug;
    const parsed = ToggleSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        type: 'error',
        error: { type: 'invalid_request_error', message: 'enabled boolean required' },
      });
    }
    await setEnabled(slug, parsed.data.enabled);
    await record(req, {
      action: parsed.data.enabled ? 'provider.enable' : 'provider.disable',
      entityType: 'provider',
      entityId: slug,
    });
    return { ok: true };
  });

  // Hit a tiny chat completion against the configured provider to make
  // sure the key works. Records the result for the UI status dot.
  app.post('/admin/v1/providers/:slug/test', async (req, reply) => {
    if (!requireRole(req, reply, ['admin'])) return;
    const slug = (req.params as { slug: string }).slug;
    const provider = getProviderBySlug(slug);
    if (!provider) {
      return reply.code(404).send({
        type: 'error',
        error: { type: 'invalid_request_error', message: 'unknown provider' },
      });
    }
    if (!provider.openaiCompat) {
      return reply.code(400).send({
        type: 'error',
        error: {
          type: 'invalid_request_error',
          message: 'test endpoint only works for openai-compatible providers',
        },
      });
    }
    const cred = await getCredential(slug);
    if (!cred) {
      return reply.code(400).send({
        type: 'error',
        error: { type: 'invalid_request_error', message: 'provider not configured' },
      });
    }
    const url = `${cred.baseUrlOverride || provider.baseUrl}${provider.chatPath}`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (provider.authHeader) headers[provider.authHeader] = cred.apiKey;
    else headers['Authorization'] = `Bearer ${cred.apiKey}`;
    // Use a tiny non-streaming call. Most providers accept the same
    // model id slug as the canonical default; we leave model unspecified
    // and let the provider 400 on missing-model rather than hard-coding
    // a guess that may not exist on every account.
    const start = Date.now();
    let ok = false;
    let status = 0;
    let body = '';
    try {
      const probe = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: req.body && (req.body as Record<string, unknown>).model
            ? ((req.body as Record<string, unknown>).model as string)
            : provider.modelPrefixes[0] + 'test',
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 4,
        }),
      });
      status = probe.status;
      body = (await probe.text()).slice(0, 500);
      // 401 / 403 → key bad; 400 invalid_model is fine, means the key works
      // but the model id wasn't real. Anything 2xx → ok.
      ok = probe.ok || (probe.status === 400 && /model/i.test(body));
    } catch (err) {
      logger.warn({ err, slug }, 'provider test failed');
    }
    await recordTest(slug, ok);
    return { ok, status, latencyMs: Date.now() - start, body };
  });
}
