import type { FastifyInstance } from 'fastify';
import { and, desc, eq, gt, like } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { auditLog } from '../../db/schema.js';
import { requireRole } from '../../middleware/rbac.js';

export async function registerAdminAudit(app: FastifyInstance): Promise<void> {
  app.get('/admin/v1/audit', async (req, reply) => {
    if (!requireRole(req, reply, ['admin'])) return;
    const q = (req.query ?? {}) as {
      limit?: string;
      action?: string;
      actor?: string;
      since?: string;
    };
    const limit = Math.min(500, Math.max(1, Number(q.limit) || 100));
    const conds = [] as ReturnType<typeof eq>[];
    if (q.action) conds.push(eq(auditLog.action, q.action));
    if (q.actor) conds.push(like(auditLog.actorEmail, `%${q.actor}%`));
    if (q.since) {
      const d = new Date(q.since);
      if (!Number.isNaN(d.getTime())) conds.push(gt(auditLog.createdAt, d));
    }
    const where = conds.length > 0 ? and(...conds) : undefined;
    const rows = await db
      .select()
      .from(auditLog)
      .where(where)
      .orderBy(desc(auditLog.createdAt))
      .limit(limit);
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
