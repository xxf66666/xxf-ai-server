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
import { consumeVerificationToken, createVerificationToken } from '../../core/email/verify.js';
import { MAIL_ENABLED, sendVerificationEmail } from '../../core/email/sender.js';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

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
    // Hard gate: only active users may log in. Pending / suspended get
    // distinct error codes so the UI can render the right prompt.
    if (user.status === 'pending_verification') {
      return reply.code(403).send({
        type: 'error',
        error: {
          type: 'email_not_verified',
          message: 'please verify your email before signing in',
          email: user.email,
        },
      });
    }
    if (user.status === 'suspended') {
      return reply.code(403).send({
        type: 'error',
        error: {
          type: 'account_suspended',
          message: 'this account has been suspended — contact the administrator',
        },
      });
    }
    // Any role may login; RBAC on protected routes handles access control.
    const token = await reply.jwtSign(
      { sub: user.id, email: user.email, role: user.role },
      { expiresIn: '7d' },
    );
    reply.setCookie(COOKIE_NAME, token, cookieOpts);
    // Best-effort lastLoginAt; failure here must not block login.
    void db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, user.id))
      .catch(() => {});
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
    // Status: pending_verification when email is enabled (hard gate).
    // When email is not configured, auto-activate so the project remains
    // usable in dev without SMTP — same graceful-degrade story as before.
    const initialStatus = MAIL_ENABLED ? 'pending_verification' : 'active';
    const [created] = await db
      .insert(users)
      .values({
        email,
        passwordHash,
        role: 'consumer',
        status: initialStatus,
        emailVerified: !MAIL_ENABLED,
        emailVerifiedAt: MAIL_ENABLED ? null : new Date(),
      })
      .returning();
    if (!created) return reply.code(500).send({ error: 'insert_failed' });
    // Seed the welcome credit; non-blocking — if settings are missing we
    // still let them in with balance=0.
    const welcome = Number(await getSetting('pricing.welcomeCreditMud')) || 0;
    if (welcome > 0) await seedWelcomeCredit(created.id, welcome).catch(() => {});

    await record(req, {
      action: 'user.register',
      entityType: 'user',
      entityId: created.id,
      detail: { email: created.email, status: initialStatus },
    });

    if (!MAIL_ENABLED) {
      // No email provider — return immediately verified. Caller should go
      // straight to /login.
      return reply
        .code(201)
        .send({
          id: created.id,
          email: created.email,
          role: created.role,
          status: 'active' as const,
          verificationSent: false,
        });
    }

    // Send verification email synchronously so we can tell the client
    // whether delivery worked. If SMTP fails we still return 201 but with
    // verificationSent=false; UI shows a "something went wrong, click
    // resend" hint. Worst case the user can ask admin for a force-verify.
    let verificationSent = false;
    try {
      const token = await createVerificationToken(created.id);
      const url = `${env.PUBLIC_WEB_URL}/verify-email?token=${encodeURIComponent(token)}`;
      const res = await sendVerificationEmail(created.email, url);
      verificationSent = res.ok;
      if (!res.ok) {
        logger.warn(
          { userId: created.id, error: res.error },
          'verification email send failed',
        );
      }
    } catch (err) {
      logger.warn({ err, userId: created.id }, 'verification email flow errored');
    }

    // IMPORTANT: no cookie is set. User must verify + login separately.
    return reply.code(201).send({
      id: created.id,
      email: created.email,
      role: created.role,
      status: 'pending_verification' as const,
      verificationSent,
    });
  });

  // Public: resend verification email BEFORE first login. Deliberately
  // always returns {ok:true} regardless of whether the email exists, to
  // avoid giving attackers a user-enumeration oracle. Rate-limited by
  // the global /admin rate limiter; plus we only send if the user is
  // actually in pending_verification state (verified/suspended users
  // get silently skipped).
  app.post('/admin/v1/auth/verify-email/request', async (req, reply) => {
    const parsed = z
      .object({ email: z.string().email() })
      .safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        type: 'error',
        error: { type: 'invalid_request_error', message: 'email required' },
      });
    }
    if (!MAIL_ENABLED) {
      return reply.code(503).send({
        type: 'error',
        error: { type: 'api_error', message: 'email service not configured on server' },
      });
    }
    const [u] = await db
      .select()
      .from(users)
      .where(eq(users.email, parsed.data.email))
      .limit(1);
    if (u && u.status === 'pending_verification') {
      try {
        const token = await createVerificationToken(u.id);
        const url = `${env.PUBLIC_WEB_URL}/verify-email?token=${encodeURIComponent(token)}`;
        const res = await sendVerificationEmail(u.email, url);
        if (!res.ok) {
          logger.warn({ userId: u.id, error: res.error }, 'resend verification email failed');
        }
      } catch (err) {
        logger.warn({ err }, 'resend verification email threw');
      }
    }
    return { ok: true };
  });

  // Public: confirm token (user clicks the email link).
  app.post('/admin/v1/auth/verify-email/confirm', async (req, reply) => {
    const parsed = z.object({ token: z.string().min(1) }).safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        type: 'error',
        error: { type: 'invalid_request_error', message: 'missing token' },
      });
    }
    const userId = await consumeVerificationToken(parsed.data.token);
    if (!userId) {
      return reply.code(400).send({
        type: 'error',
        error: { type: 'invalid_request_error', message: 'invalid or expired token' },
      });
    }
    await record(req, { action: 'user.email_verified', entityType: 'user', entityId: userId });
    return { ok: true };
  });

  // Authenticated: re-send verification (banner button on console).
  app.post('/admin/v1/auth/verify-email/send', async (req, reply) => {
    if (!req.adminSession || req.adminSession.sub === 'bootstrap') {
      return reply.code(401).send({ error: 'unauth' });
    }
    const uid = req.adminSession.sub;
    const [me] = await db.select().from(users).where(eq(users.id, uid)).limit(1);
    if (!me) return reply.code(404).send({ error: 'not_found' });
    if (me.emailVerified) return { ok: true, alreadyVerified: true };
    if (!MAIL_ENABLED) {
      return reply.code(503).send({
        type: 'error',
        error: { type: 'api_error', message: 'email service not configured on server' },
      });
    }
    const token = await createVerificationToken(uid);
    const url = `${env.PUBLIC_WEB_URL}/verify-email?token=${encodeURIComponent(token)}`;
    const res = await sendVerificationEmail(me.email, url);
    if (!res.ok) {
      return reply.code(502).send({
        type: 'error',
        error: { type: 'api_error', message: res.error ?? 'send failed' },
      });
    }
    await record(req, {
      action: 'user.email_verify_resend',
      entityType: 'user',
      entityId: uid,
    });
    return { ok: true };
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
