import type { FastifyRequest } from 'fastify';
import { db } from '../../db/client.js';
import { auditLog } from '../../db/schema.js';
import { logger } from '../../utils/logger.js';

export interface AuditEvent {
  action: string;
  entityType?: string;
  entityId?: string;
  detail?: Record<string, unknown>;
}

export async function record(req: FastifyRequest, event: AuditEvent): Promise<void> {
  const session = req.adminSession;
  try {
    await db.insert(auditLog).values({
      actorUserId: session?.sub === 'bootstrap' ? null : session?.sub ?? null,
      actorEmail: session?.email ?? null,
      action: event.action,
      entityType: event.entityType ?? null,
      entityId: event.entityId ?? null,
      detail: event.detail ?? {},
    });
  } catch (err) {
    // Never fail the caller on audit-log write failures.
    logger.warn({ err, event }, 'audit log write failed');
  }
}
