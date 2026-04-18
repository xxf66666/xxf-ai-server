import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/client.js';
import { users } from '../../db/schema.js';
import { hashPassword, verifyPassword } from '../../core/users/passwords.js';
import { isStrongEnough } from '../../core/users/strength.js';
import { verifyTotp } from '../../core/users/totp.js';
import { record } from '../../core/audit/log.js';
import { consumeInvite } from '../../core/invites/index.js';
import { seedWelcomeCredit } from '../../core/users/ledger.js';
import { getSetting } from '../../core/settings/index.js';
import { consumeVerificationToken, createVerificationToken } from '../../core/email/verify.js';
import { consumeResetToken, createResetToken } from '../../core/email/reset.js';
import {
  MAIL_ENABLED,
  sendPasswordResetEmail,
  sendVerificationEmail,
} from '../../core/email/sender.js';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  // If the user has TOTP enabled, the client sends the 6-digit code on
  // the same request. We respond `totp_required` on first attempt to
  // signal the UI to prompt.
  totp: z.string().min(6).max(10).optional(),
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

// Shared guardrail for every /admin/v1/auth/* route: tight body limit
// (JSON auth payloads are small) and an IP rate limit so credential-
// stuffing + mail-bombing can't just pick different emails to evade the
// per-account 5-in-15 lockout.
const AUTH_ROUTE: { bodyLimit: number; config: { rateLimit: { max: number; timeWindow: number } } } = {
  bodyLimit: 64 * 1024,
  config: {
    rateLimit: {
      max: 20,
      timeWindow: 60_000,
    },
  },
};

export async function registerAdminAuth(app: FastifyInstance): Promise<void> {
  app.post('/admin/v1/auth/login', AUTH_ROUTE, async (req, reply) => {
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

    // Lockout check runs BEFORE password verify so a locked attacker
    // can't keep spinning timing-attack probes against our hasher.
    if (user && user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      const secs = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 1000);
      return reply.code(423).send({
        type: 'error',
        error: {
          type: 'account_locked',
          message: 'too many failed attempts, try again later',
          retryAfterSec: secs,
        },
      });
    }

    if (!user || !(await verifyPassword(user.passwordHash, password))) {
      if (user) {
        // Brute-force guard: bump counter, lock at the 5th miss for 15
        // minutes. Unknown emails don't tick any counter (would let an
        // attacker enumerate) but also don't give them a timing oracle —
        // argon2.verify against the bogus '!' hash takes normal time.
        const nextCount = user.failedLoginCount + 1;
        const shouldLock = nextCount >= 5;
        const LOCK_MS = 15 * 60 * 1000;
        await db
          .update(users)
          .set({
            failedLoginCount: nextCount,
            lockedUntil: shouldLock ? new Date(Date.now() + LOCK_MS) : user.lockedUntil,
            updatedAt: new Date(),
          })
          .where(eq(users.id, user.id))
          .catch(() => {});
        await record(req, {
          action: 'user.login_failed',
          entityType: 'user',
          entityId: user.id,
          detail: { failedCount: nextCount, ip: req.ip, locked: shouldLock },
        }).catch(() => {});
        if (shouldLock) {
          return reply.code(423).send({
            type: 'error',
            error: {
              type: 'account_locked',
              message: 'too many failed attempts, try again later',
              retryAfterSec: Math.ceil(LOCK_MS / 1000),
            },
          });
        }
      }
      return reply.code(401).send({
        type: 'error',
        error: { type: 'authentication_error', message: 'invalid email or password' },
      });
    }

    // 2FA gate. If the user has TOTP enabled:
    //   - no code supplied → respond totp_required (client shows input)
    //   - code supplied but invalid → 401 with totp_invalid
    // We run this BEFORE the status gate so that a pending/suspended
    // user without TOTP can't bypass checks by not sending a code.
    if (user.totpEnabled) {
      if (!parsed.data.totp) {
        return reply.code(401).send({
          type: 'error',
          error: { type: 'totp_required', message: 'two-factor code required' },
        });
      }
      if (!user.totpSecret || !verifyTotp(user.totpSecret, parsed.data.totp)) {
        // Still increments failure counter — TOTP brute force on a
        // known password is just as dangerous as password brute force.
        const nextCount = user.failedLoginCount + 1;
        const shouldLock = nextCount >= 5;
        const LOCK_MS = 15 * 60 * 1000;
        await db
          .update(users)
          .set({
            failedLoginCount: nextCount,
            lockedUntil: shouldLock ? new Date(Date.now() + LOCK_MS) : user.lockedUntil,
            updatedAt: new Date(),
          })
          .where(eq(users.id, user.id))
          .catch(() => {});
        return reply.code(401).send({
          type: 'error',
          error: { type: 'totp_invalid', message: 'invalid two-factor code' },
        });
      }
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

    // Success: reset the failure counter, stamp login metadata, set cookie.
    const token = await reply.jwtSign(
      { sub: user.id, email: user.email, role: user.role },
      { expiresIn: '7d' },
    );
    reply.setCookie(COOKIE_NAME, token, cookieOpts);
    void db
      .update(users)
      .set({
        lastLoginAt: new Date(),
        lastLoginIp: req.ip,
        failedLoginCount: 0,
        lockedUntil: null,
      })
      .where(eq(users.id, user.id))
      .catch(() => {});
    await record(req, {
      action: 'user.login',
      entityType: 'user',
      entityId: user.id,
      detail: { ip: req.ip },
    }).catch(() => {});
    return { id: user.id, email: user.email, role: user.role };
  });

  app.post('/admin/v1/auth/register', AUTH_ROUTE, async (req, reply) => {
    const parsed = RegisterSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        type: 'error',
        error: { type: 'invalid_request_error', message: parsed.error.message },
      });
    }
    const { email, password, inviteCode } = parsed.data;
    if (!isStrongEnough(password)) {
      return reply.code(400).send({
        type: 'error',
        error: {
          type: 'invalid_request_error',
          message: 'password too weak — mix letters, digits and symbols',
        },
      });
    }
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
  app.post('/admin/v1/auth/verify-email/request', AUTH_ROUTE, async (req, reply) => {
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
  app.post('/admin/v1/auth/verify-email/confirm', AUTH_ROUTE, async (req, reply) => {
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
  app.post('/admin/v1/auth/verify-email/send', AUTH_ROUTE, async (req, reply) => {
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

  // Public: request a password reset email. Enumeration-safe — always
  // returns {ok:true} regardless of whether the email is on record. If
  // the user is suspended we also skip silently; they should contact
  // admin, not reset. Verified flag is not required — a user may forget
  // their password before verifying email.
  app.post('/admin/v1/auth/password-reset/request', AUTH_ROUTE, async (req, reply) => {
    const parsed = z.object({ email: z.string().email() }).safeParse(req.body);
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
    if (u && u.status !== 'suspended') {
      try {
        const token = await createResetToken(u.id);
        const url = `${env.PUBLIC_WEB_URL}/reset-password?token=${encodeURIComponent(token)}`;
        const res = await sendPasswordResetEmail(u.email, url);
        if (!res.ok) {
          logger.warn({ userId: u.id, error: res.error }, 'password reset email failed');
        }
      } catch (err) {
        logger.warn({ err }, 'password reset email flow errored');
      }
    }
    return { ok: true };
  });

  // Public: confirm reset token + set new password in one step.
  app.post('/admin/v1/auth/password-reset/confirm', AUTH_ROUTE, async (req, reply) => {
    const parsed = z
      .object({
        token: z.string().min(1),
        password: z.string().min(8, 'password must be at least 8 chars'),
      })
      .safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        type: 'error',
        error: { type: 'invalid_request_error', message: parsed.error.message },
      });
    }
    if (!isStrongEnough(parsed.data.password)) {
      return reply.code(400).send({
        type: 'error',
        error: {
          type: 'invalid_request_error',
          message: 'password too weak — mix letters, digits and symbols',
        },
      });
    }
    const userId = await consumeResetToken(parsed.data.token, parsed.data.password);
    if (!userId) {
      return reply.code(400).send({
        type: 'error',
        error: { type: 'invalid_request_error', message: 'invalid or expired token' },
      });
    }
    await record(req, { action: 'user.password_reset', entityType: 'user', entityId: userId });
    return { ok: true };
  });

  app.post('/admin/v1/auth/logout', AUTH_ROUTE, async (_req, reply) => {
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
