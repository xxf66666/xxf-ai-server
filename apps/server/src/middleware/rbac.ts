import type { FastifyReply, FastifyRequest } from 'fastify';

// Access policy for the admin API:
//   admin        — full access
//   contributor  — may attach/detach/probe own accounts; mint own keys;
//                  cannot see or touch other users' data
//   consumer     — no admin access at all (handled by login route)
//
// This module exposes small guards that read req.adminSession. Each admin
// handler applies the guards it needs; we keep them explicit rather than
// wrapping routes in a decorator so a reader can see "who is allowed here"
// at the call site.

export function requireRole(req: FastifyRequest, reply: FastifyReply, roles: Array<string>): boolean {
  const role = req.adminSession?.role;
  if (!role || !roles.includes(role)) {
    reply.code(403).send({
      type: 'error',
      error: { type: 'permission_error', message: `requires role: ${roles.join(' or ')}` },
    });
    return false;
  }
  return true;
}

export function isAdmin(req: FastifyRequest): boolean {
  return req.adminSession?.role === 'admin';
}

/** Returns the logged-in user id, or null if the session is the bootstrap shortcut. */
export function sessionUserId(req: FastifyRequest): string | null {
  const sub = req.adminSession?.sub;
  if (!sub || sub === 'bootstrap') return null;
  return sub;
}
