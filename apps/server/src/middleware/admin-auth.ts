import type { FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../config/env.js';
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
}

// Admin access = (valid JWT cookie) OR (ADMIN_BOOTSTRAP_TOKEN header). The
// bootstrap path stays so operators can recover or run ops against a fresh
// DB before any user exists. A populated JWT wins: we prefer that because
// we get the user's identity for RBAC + audit.
export async function requireAdmin(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  // 1. Try JWT cookie via @fastify/jwt.
  try {
    const payload = (await req.jwtVerify({ onlyCookie: true })) as AdminSession;
    req.adminSession = payload;
    return;
  } catch {
    // fall through to bootstrap token
  }

  // 2. Bootstrap token fallback.
  const configured = env.ADMIN_BOOTSTRAP_TOKEN;
  if (configured) {
    const header =
      req.headers['x-admin-token'] ??
      (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
    const provided = Array.isArray(header) ? header[0] : header;
    if (provided && provided === configured) {
      req.adminSession = { sub: 'bootstrap', email: 'bootstrap', role: 'admin' };
      return;
    }
  }

  return void reply.code(401).send({
    type: 'error',
    error: { type: 'authentication_error', message: 'admin login required' },
  });
}
