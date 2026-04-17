import type { FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../config/env.js';

// P1/P2 admin gate: a single bootstrap token shared via env, supplied by the
// operator as `X-Admin-Token: <value>` (or `Authorization: Bearer <value>`).
// Proper user+password admin login (argon2 + JWT) lands in P3.
export async function requireAdmin(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const configured = env.ADMIN_BOOTSTRAP_TOKEN;
  if (!configured) {
    return void reply
      .code(503)
      .send({ type: 'error', error: { type: 'api_error', message: 'admin disabled: set ADMIN_BOOTSTRAP_TOKEN' } });
  }
  const header =
    req.headers['x-admin-token'] ??
    (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
  const provided = Array.isArray(header) ? header[0] : header;
  if (!provided || provided !== configured) {
    return void reply
      .code(401)
      .send({ type: 'error', error: { type: 'authentication_error', message: 'admin token required' } });
  }
}
