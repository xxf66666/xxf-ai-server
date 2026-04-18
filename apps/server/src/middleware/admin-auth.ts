import { timingSafeEqual } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { eq } from 'drizzle-orm';
import { env } from '../config/env.js';
import { db } from '../db/client.js';
import { users } from '../db/schema.js';
import type { UserRole } from '@xxf/shared';

declare module 'fastify' {
  interface FastifyRequest {
    adminSession?: AdminSession;
  }
}

export interface AdminSession {
  sub: string;
  email: string;
  role: UserRole;
  iat?: number;
}

// Admin access = (valid JWT cookie) OR (ADMIN_BOOTSTRAP_TOKEN header). The
// bootstrap path stays so operators can recover or run ops against a fresh
// DB before any user exists. A populated JWT wins: we prefer that because
// we get the user's identity for RBAC + audit.
//
// On top of a valid signature, a JWT session is only honoured if:
//   - the backing user still exists
//   - user.status === 'active' (instant suspend / pending flip)
//   - JWT iat >= floor(user.password_changed_at) (password change kills
//     all outstanding sessions)
// These add one small DB read per authenticated request. For the admin
// surface that's fine; at higher volume a 30-second Redis cache of
// (status, password_changed_at) per user would amortise it.
export async function requireAdmin(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  // 1. Try JWT cookie via @fastify/jwt.
  try {
    const payload = (await req.jwtVerify({ onlyCookie: true })) as AdminSession;
    const check = await validateSession(payload);
    if (check.ok) {
      req.adminSession = payload;
      return;
    }
    return void reply.code(401).send({
      type: 'error',
      error: { type: 'authentication_error', message: check.reason },
    });
  } catch {
    // fall through to bootstrap token
  }

  // 2. Bootstrap token fallback — constant-time compared so response-time
  // differences can't leak prefix bytes.
  const configured = env.ADMIN_BOOTSTRAP_TOKEN;
  if (configured) {
    const header =
      req.headers['x-admin-token'] ??
      (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
    const provided = Array.isArray(header) ? header[0] : header;
    if (provided && constantTimeEqual(provided, configured)) {
      req.adminSession = { sub: 'bootstrap', email: 'bootstrap', role: 'admin' };
      return;
    }
  }

  return void reply.code(401).send({
    type: 'error',
    error: { type: 'authentication_error', message: 'admin login required' },
  });
}

type ValidateResult = { ok: true } | { ok: false; reason: string };

async function validateSession(payload: AdminSession): Promise<ValidateResult> {
  const [u] = await db
    .select({
      id: users.id,
      status: users.status,
      passwordChangedAt: users.passwordChangedAt,
    })
    .from(users)
    .where(eq(users.id, payload.sub))
    .limit(1);
  if (!u) return { ok: false, reason: 'account not found' };
  if (u.status !== 'active') return { ok: false, reason: `account not active (${u.status})` };
  const iatSec = typeof payload.iat === 'number' ? payload.iat : 0;
  const pwdChangedSec = Math.floor(u.passwordChangedAt.getTime() / 1000);
  if (iatSec < pwdChangedSec) {
    return { ok: false, reason: 'session invalidated by password change' };
  }
  return { ok: true };
}

function constantTimeEqual(a: string, b: string): boolean {
  // timingSafeEqual requires equal length. Reject early on mismatch to
  // avoid an OOB read; that itself isn't a timing oracle because an
  // attacker already knows the configured token length is fixed.
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
