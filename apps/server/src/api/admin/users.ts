import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../../db/client.js';
import { users, type User } from '../../db/schema.js';
import { USER_ROLES } from '@xxf/shared';
import { eq } from 'drizzle-orm';
import { hashPassword } from '../../core/users/passwords.js';
import { record } from '../../core/audit/log.js';
import { requireRole } from '../../middleware/rbac.js';

const CreateSchema = z.object({
  email: z.string().email(),
  role: z.enum(USER_ROLES).default('consumer'),
  password: z.string().min(8).optional(),
});

const UpdateSchema = z.object({
  role: z.enum(USER_ROLES).optional(),
  password: z.string().min(8).optional(),
});

function toDto(u: User) {
  return {
    id: u.id,
    email: u.email,
    role: u.role,
    createdAt: u.createdAt.toISOString(),
  };
}

export async function registerAdminUsers(app: FastifyInstance): Promise<void> {
  app.get('/admin/v1/users', async (req, reply) => {
    if (!requireRole(req, reply, ['admin'])) return;
    const rows = await db.select().from(users);
    return { data: rows.map(toDto) };
  });

  app.post('/admin/v1/users', async (req, reply) => {
    if (!requireRole(req, reply, ['admin'])) return;
    const parsed = CreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        type: 'error',
        error: { type: 'invalid_request_error', message: parsed.error.message },
      });
    }
    const passwordHash = parsed.data.password
      ? await hashPassword(parsed.data.password)
      : '!'; // sentinel: cannot log in until password is set
    const [row] = await db
      .insert(users)
      .values({
        email: parsed.data.email,
        role: parsed.data.role,
        passwordHash,
      })
      .returning();
    if (!row) return reply.code(500).send({ error: 'insert_failed' });
    await record(req, {
      action: 'user.create',
      entityType: 'user',
      entityId: row.id,
      detail: { email: row.email, role: row.role },
    });
    return reply.code(201).send(toDto(row));
  });

  app.patch('/admin/v1/users/:id', async (req, reply) => {
    if (!requireRole(req, reply, ['admin'])) return;
    const id = (req.params as { id: string }).id;
    const parsed = UpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        type: 'error',
        error: { type: 'invalid_request_error', message: parsed.error.message },
      });
    }
    const patch: Partial<User> = { updatedAt: new Date() };
    if (parsed.data.role) patch.role = parsed.data.role;
    if (parsed.data.password) patch.passwordHash = await hashPassword(parsed.data.password);
    await db.update(users).set(patch).where(eq(users.id, id));
    const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!row) return reply.code(404).send({ error: 'not_found' });
    await record(req, {
      action: 'user.update',
      entityType: 'user',
      entityId: id,
      detail: { role: parsed.data.role ?? undefined, passwordChanged: Boolean(parsed.data.password) },
    });
    return toDto(row);
  });

  app.delete('/admin/v1/users/:id', async (req, reply) => {
    if (!requireRole(req, reply, ['admin'])) return;
    const id = (req.params as { id: string }).id;
    await db.delete(users).where(eq(users.id, id));
    await record(req, { action: 'user.delete', entityType: 'user', entityId: id });
    return reply.code(204).send();
  });
}
