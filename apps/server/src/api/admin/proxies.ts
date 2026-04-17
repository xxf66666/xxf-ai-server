import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createProxy, deleteProxy, listProxies, updateProxy } from '../../core/proxies/index.js';
import { record } from '../../core/audit/log.js';
import { requireRole } from '../../middleware/rbac.js';

const CreateSchema = z.object({
  label: z.string().min(1).max(120),
  url: z.string().url(),
  region: z.string().max(32).optional(),
  maxConcurrency: z.number().int().min(1).max(64).optional(),
});

const UpdateSchema = z.object({
  label: z.string().min(1).max(120).optional(),
  url: z.string().url().optional(),
  region: z.string().max(32).nullable().optional(),
  maxConcurrency: z.number().int().min(1).max(64).optional(),
  enabled: z.boolean().optional(),
});

export async function registerAdminProxies(app: FastifyInstance): Promise<void> {
  app.get('/admin/v1/proxies', async (req, reply) => {
    if (!requireRole(req, reply, ['admin'])) return;
    const rows = await listProxies();
    return {
      data: rows.map((p) => ({
        id: p.id,
        label: p.label,
        url: p.url,
        region: p.region,
        maxConcurrency: p.maxConcurrency,
        enabled: p.enabled,
        createdAt: p.createdAt.toISOString(),
      })),
    };
  });

  app.post('/admin/v1/proxies', async (req, reply) => {
    if (!requireRole(req, reply, ['admin'])) return;
    const parsed = CreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        type: 'error',
        error: { type: 'invalid_request_error', message: parsed.error.message },
      });
    }
    const row = await createProxy(parsed.data);
    await record(req, {
      action: 'proxy.create',
      entityType: 'proxy',
      entityId: row.id,
      detail: { label: row.label, region: row.region },
    });
    return reply.code(201).send({
      id: row.id,
      label: row.label,
      url: row.url,
      region: row.region,
      maxConcurrency: row.maxConcurrency,
      enabled: row.enabled,
      createdAt: row.createdAt.toISOString(),
    });
  });

  app.patch('/admin/v1/proxies/:id', async (req, reply) => {
    if (!requireRole(req, reply, ['admin'])) return;
    const id = (req.params as { id: string }).id;
    const parsed = UpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        type: 'error',
        error: { type: 'invalid_request_error', message: parsed.error.message },
      });
    }
    await updateProxy(id, parsed.data);
    await record(req, { action: 'proxy.update', entityType: 'proxy', entityId: id });
    return reply.code(204).send();
  });

  app.delete('/admin/v1/proxies/:id', async (req, reply) => {
    if (!requireRole(req, reply, ['admin'])) return;
    const id = (req.params as { id: string }).id;
    await deleteProxy(id);
    await record(req, { action: 'proxy.delete', entityType: 'proxy', entityId: id });
    return reply.code(204).send();
  });
}
