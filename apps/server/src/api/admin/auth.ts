import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/client.js';
import { users } from '../../db/schema.js';
import { verifyPassword } from '../../core/users/passwords.js';

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const COOKIE_NAME = 'xxf_admin_session';

export async function registerAdminAuth(app: FastifyInstance): Promise<void> {
  app.post('/admin/v1/auth/login', async (req, reply) => {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        type: 'error',
        error: { type: 'invalid_request_error', message: parsed.error.message },
      });
    }
    const { email, password } = parsed.data;
    const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
    const user = rows[0];
    if (!user || !(await verifyPassword(user.passwordHash, password))) {
      return reply.code(401).send({
        type: 'error',
        error: { type: 'authentication_error', message: 'invalid email or password' },
      });
    }
    if (user.role !== 'admin' && user.role !== 'contributor') {
      return reply.code(403).send({
        type: 'error',
        error: { type: 'permission_error', message: 'consumer role cannot access admin' },
      });
    }
    const token = await reply.jwtSign(
      { sub: user.id, email: user.email, role: user.role },
      { expiresIn: '7d' },
    );
    reply.setCookie(COOKIE_NAME, token, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
    });
    return { id: user.id, email: user.email, role: user.role };
  });

  app.post('/admin/v1/auth/logout', async (_req, reply) => {
    reply.clearCookie(COOKIE_NAME, { path: '/' });
    return reply.code(204).send();
  });

  app.get('/admin/v1/auth/me', async (req, reply) => {
    if (!req.adminSession) {
      return reply.code(401).send({
        type: 'error',
        error: { type: 'authentication_error', message: 'not logged in' },
      });
    }
    return req.adminSession;
  });
}
