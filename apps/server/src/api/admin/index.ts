import type { FastifyInstance } from 'fastify';
import { requireAdmin } from '../../middleware/admin-auth.js';
import { registerAdminAccounts } from './accounts.js';
import { registerAdminApiKeys } from './api-keys.js';
import { registerAdminUsers } from './users.js';

export async function registerAdmin(app: FastifyInstance): Promise<void> {
  // Every /admin/v1/* route requires the bootstrap token.
  app.addHook('preHandler', async (req, reply) => {
    if (req.url.startsWith('/admin/')) {
      await requireAdmin(req, reply);
    }
  });

  await registerAdminAccounts(app);
  await registerAdminApiKeys(app);
  await registerAdminUsers(app);
}
