import type { FastifyInstance } from 'fastify';
import { requireAdmin } from '../../middleware/admin-auth.js';
import { registerAdminAccounts } from './accounts.js';
import { registerAdminApiKeys } from './api-keys.js';
import { registerAdminAudit } from './audit.js';
import { registerAdminAuth } from './auth.js';
import { registerAdminProxies } from './proxies.js';
import { registerAdminSettings } from './settings.js';
import { registerAdminStats } from './stats.js';
import { registerAdminUsers } from './users.js';

// Paths under /admin/ that do NOT require a logged-in session:
// the login endpoint itself (how else would you log in?) and readiness.
const PUBLIC_PATHS = new Set(['/admin/v1/auth/login', '/admin/v1/auth/register']);

export async function registerAdmin(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', async (req, reply) => {
    if (!req.url.startsWith('/admin/')) return;
    if (PUBLIC_PATHS.has(req.url.split('?')[0] ?? '')) return;
    await requireAdmin(req, reply);
  });

  await registerAdminAuth(app);
  await registerAdminAccounts(app);
  await registerAdminApiKeys(app);
  await registerAdminAudit(app);
  await registerAdminProxies(app);
  await registerAdminSettings(app);
  await registerAdminStats(app);
  await registerAdminUsers(app);
}
