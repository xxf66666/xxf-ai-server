import type { FastifyInstance } from 'fastify';
import { and, desc, eq, gt, isNull, lte, or } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/client.js';
import { announcements, type Announcement } from '../../db/schema.js';
import { record } from '../../core/audit/log.js';
import { requireRole } from '../../middleware/rbac.js';

const CreateSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(4000),
  severity: z.enum(['info', 'warning', 'critical']).default('info'),
  active: z.boolean().default(true),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
});
const UpdateSchema = CreateSchema.partial();

function toDto(a: Announcement) {
  return {
    id: a.id,
    title: a.title,
    body: a.body,
    severity: a.severity,
    active: a.active,
    startsAt: a.startsAt?.toISOString() ?? null,
    endsAt: a.endsAt?.toISOString() ?? null,
    createdByUserId: a.createdByUserId,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  };
}

export async function registerAdminAnnouncements(app: FastifyInstance): Promise<void> {
  app.get('/admin/v1/announcements', async (req, reply) => {
    if (!requireRole(req, reply, ['admin', 'contributor'])) return;
    const rows = await db
      .select()
      .from(announcements)
      .orderBy(desc(announcements.createdAt));
    return { data: rows.map(toDto) };
  });

  app.post('/admin/v1/announcements', async (req, reply) => {
    if (!requireRole(req, reply, ['admin'])) return;
    const parsed = CreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        type: 'error',
        error: { type: 'invalid_request_error', message: parsed.error.message },
      });
    }
    const [row] = await db
      .insert(announcements)
      .values({
        title: parsed.data.title,
        body: parsed.data.body,
        severity: parsed.data.severity,
        active: parsed.data.active,
        startsAt: parsed.data.startsAt ? new Date(parsed.data.startsAt) : null,
        endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
        createdByUserId: req.adminSession?.sub === 'bootstrap' ? null : (req.adminSession?.sub ?? null),
      })
      .returning();
    if (!row) return reply.code(500).send({ error: 'insert_failed' });
    await record(req, {
      action: 'announcement.create',
      entityType: 'announcement',
      entityId: row.id,
      detail: { title: row.title, severity: row.severity },
    });
    return reply.code(201).send(toDto(row));
  });

  app.patch('/admin/v1/announcements/:id', async (req, reply) => {
    if (!requireRole(req, reply, ['admin'])) return;
    const id = (req.params as { id: string }).id;
    const parsed = UpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        type: 'error',
        error: { type: 'invalid_request_error', message: parsed.error.message },
      });
    }
    const patch: Partial<Announcement> = { updatedAt: new Date() };
    if (parsed.data.title !== undefined) patch.title = parsed.data.title;
    if (parsed.data.body !== undefined) patch.body = parsed.data.body;
    if (parsed.data.severity !== undefined) patch.severity = parsed.data.severity;
    if (parsed.data.active !== undefined) patch.active = parsed.data.active;
    if (parsed.data.startsAt !== undefined)
      patch.startsAt = parsed.data.startsAt ? new Date(parsed.data.startsAt) : null;
    if (parsed.data.endsAt !== undefined)
      patch.endsAt = parsed.data.endsAt ? new Date(parsed.data.endsAt) : null;
    await db.update(announcements).set(patch).where(eq(announcements.id, id));
    const [row] = await db.select().from(announcements).where(eq(announcements.id, id)).limit(1);
    if (!row) return reply.code(404).send({ error: 'not_found' });
    await record(req, {
      action: 'announcement.update',
      entityType: 'announcement',
      entityId: id,
      detail: parsed.data as Record<string, unknown>,
    });
    return toDto(row);
  });

  app.delete('/admin/v1/announcements/:id', async (req, reply) => {
    if (!requireRole(req, reply, ['admin'])) return;
    const id = (req.params as { id: string }).id;
    await db.delete(announcements).where(eq(announcements.id, id));
    await record(req, {
      action: 'announcement.delete',
      entityType: 'announcement',
      entityId: id,
    });
    return reply.code(204).send();
  });

  // Public-to-logged-in-users: the subset of announcements currently
  // "live". This is used by both /console and /admin layouts to render
  // the top banner.
  app.get('/admin/v1/announcements/active', async () => {
    const now = new Date();
    const rows = await db
      .select()
      .from(announcements)
      .where(
        and(
          eq(announcements.active, true),
          or(isNull(announcements.startsAt), lte(announcements.startsAt, now)),
          or(isNull(announcements.endsAt), gt(announcements.endsAt, now)),
        ),
      )
      .orderBy(desc(announcements.createdAt));
    return { data: rows.map(toDto) };
  });
}
