import type { FastifyInstance } from 'fastify';
import { desc } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { auditLog } from '../../db/schema.js';

export async function registerAdminAudit(app: FastifyInstance): Promise<void> {
  app.get('/admin/v1/audit', async (req) => {
    const { limit = '100' } = (req.query ?? {}) as { limit?: string };
    const rows = await db
      .select()
      .from(auditLog)
      .orderBy(desc(auditLog.createdAt))
      .limit(Math.min(500, Number(limit) || 100));
    return {
      data: rows.map((r) => ({
        id: r.id,
        actorEmail: r.actorEmail,
        action: r.action,
        entityType: r.entityType,
        entityId: r.entityId,
        detail: r.detail,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  });
}
