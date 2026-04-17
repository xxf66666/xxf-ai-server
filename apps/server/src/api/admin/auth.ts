import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/client.js';
import { users } from '../../db/schema.js';
import { hashPassword, verifyPassword } from '../../core/users/passwords.js';
import { record } from '../../core/audit/log.js';
import { consumeInvite } from '../../core/invites/index.js';
import { seedWelcomeCredit } from '../../core/users/ledger.js';
import { getSetting } from '../../core/settings/index.js';

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'password must be at least 8 chars'),
  inviteCode: z.string().min(4, 'invite code required'),
});

const COOKIE_NAME = 'xxf_admin_session';

// Cookie settings shared by login + register. secure=false in dev so the
// cookie works over plain http://localhost; prod Caddy terminates TLS so
// `secure` is safe.
const cookieOpts = {
  path: '/',
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60,
};

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
    // Any role may login; RBAC on protected routes handles access control.
    const token = await reply.jwtSign(
      { sub: user.id, email: user.email, role: user.role },
      { expiresIn: '7d' },
    );
    reply.setCookie(COOKIE_NAME, token, cookieOpts);
    return { id: user.id, email: user.email, role: user.role };
  });

  app.post('/admin/v1/auth/register', async (req, reply) => {
    const parsed = RegisterSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        type: 'error',
        error: { type: 'invalid_request_error', message: parsed.error.message },
      });
    }
    const { email, password, inviteCode } = parsed.data;
    const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing.length > 0) {
      return reply.code(409).send({
        type: 'error',
        error: { type: 'invalid_request_error', message: 'email already registered' },
      });
    }
    const invite = await consumeInvite(inviteCode.trim());
    if (!invite) {
      return reply.code(400).send({
        type: 'error',
        error: { type: 'invalid_request_error', message: 'invalid or exhausted invite code' },
      });
    }
    const passwordHash = await hashPassword(password);
    const [created] = await db
      .insert(users)
      .values({ email, passwordHash, role: 'consumer' })
      .returning();
    if (!created) return reply.code(500).send({ error: 'insert_failed' });
    // Seed the welcome credit; non-blocking — if settings are missing we
    // still let them in with balance=0.
    const welcome = Number(await getSetting('pricing.welcomeCreditMud')) || 0;
    if (welcome > 0) await seedWelcomeCredit(created.id, welcome).catch(() => {});
    // Auto-login: set cookie so the freshly-registered user lands in /console.
    const token = await reply.jwtSign(
      { sub: created.id, email: created.email, role: created.role },
      { expiresIn: '7d' },
    );
    reply.setCookie(COOKIE_NAME, token, cookieOpts);
    await record(req, {
      action: 'user.register',
      entityType: 'user',
      entityId: created.id,
      detail: { email: created.email },
    });
    return reply.code(201).send({ id: created.id, email: created.email, role: created.role });
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
