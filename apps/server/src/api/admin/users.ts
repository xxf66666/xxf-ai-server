import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../../db/client.js';
import { users, type User } from '../../db/schema.js';
import { USER_ROLES } from '@xxf/shared';
import { eq } from 'drizzle-orm';

const CreateSchema = z.object({
  email: z.string().email(),
  role: z.enum(USER_ROLES).default('consumer'),
  // P3 will enforce argon2 hashing + password input. For P1 we accept a
  // pre-hashed blank to keep the row creatable without a full auth stack.
  passwordHash: z.string().optional(),
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
  app.get('/admin/v1/users', async () => {
    const rows = await db.select().from(users);
    return { data: rows.map(toDto) };
  });

  app.post('/admin/v1/users', async (req, reply) => {
    const parsed = CreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        type: 'error',
        error: { type: 'invalid_request_error', message: parsed.error.message },
      });
    }
    const [row] = await db
      .insert(users)
      .values({
        email: parsed.data.email,
        role: parsed.data.role,
        passwordHash: parsed.data.passwordHash ?? '!',
      })
      .returning();
    if (!row) return reply.code(500).send({ error: 'insert_failed' });
    return reply.code(201).send(toDto(row));
  });

  app.delete('/admin/v1/users/:id', async (req, reply) => {
    const id = (req.params as { id: string }).id;
    await db.delete(users).where(eq(users.id, id));
    return reply.code(204).send();
  });
}
