import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  getAllSettings,
  setSetting,
  SETTING_DEFAULTS,
  type SettingKey,
} from '../../core/settings/index.js';
import { record } from '../../core/audit/log.js';
import { requireRole } from '../../middleware/rbac.js';

const VALID_KEYS = Object.keys(SETTING_DEFAULTS) as SettingKey[];

const PatchSchema = z.record(z.string(), z.unknown());

export async function registerAdminSettings(app: FastifyInstance): Promise<void> {
  app.get('/admin/v1/settings', async () => {
    return { data: await getAllSettings() };
  });

  app.patch('/admin/v1/settings', async (req, reply) => {
    if (!requireRole(req, reply, ['admin'])) return;
    const parsed = PatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        type: 'error',
        error: { type: 'invalid_request_error', message: parsed.error.message },
      });
    }
    for (const [k, v] of Object.entries(parsed.data)) {
      if (!VALID_KEYS.includes(k as SettingKey)) {
        return reply.code(400).send({
          type: 'error',
          error: { type: 'invalid_request_error', message: `unknown setting: ${k}` },
        });
      }
      await setSetting(k as SettingKey, v);
    }
    await record(req, {
      action: 'settings.update',
      detail: { keys: Object.keys(parsed.data) },
    });
    return { data: await getAllSettings() };
  });
}
