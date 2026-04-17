import type { FastifyReply, FastifyRequest } from 'fastify';
import { eq } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { users, type ApiKey, type User } from '../../db/schema.js';
import { findActiveByPlaintext } from './keys.js';
import { isOverQuota } from './quota.js';

declare module 'fastify' {
  interface FastifyRequest {
    apiKey?: ApiKey;
    apiUser?: User | null;
  }
}

function extractBearer(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(authHeader);
  return match?.[1] ?? null;
}

// Fastify preHandler: authenticate a downstream caller via sk-xxf-... bearer.
export async function requireApiKey(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const token = extractBearer(req.headers.authorization);
  if (!token) {
    return void reply
      .code(401)
      .send({ type: 'error', error: { type: 'authentication_error', message: 'missing Bearer token' } });
  }
  const key = await findActiveByPlaintext(token);
  if (!key) {
    return void reply
      .code(401)
      .send({ type: 'error', error: { type: 'authentication_error', message: 'invalid api key' } });
  }
  if (isOverQuota(key)) {
    return void reply.code(429).send({
      type: 'error',
      error: { type: 'rate_limit_error', message: 'monthly token quota exhausted' },
    });
  }
  const owner = (await db.select().from(users).where(eq(users.id, key.userId)).limit(1))[0] ?? null;
  // Balance gate: only `consumer` accounts are charged. Admin + contributor
  // may use the API without prepaid balance (they operate the gateway).
  // Hard-cut at <= 0: last request can overshoot by one call since we debit
  // after the response, but no new requests after that.
  if (owner && owner.role === 'consumer' && Number(owner.balanceMud) <= 0) {
    return void reply.code(402).send({
      type: 'error',
      error: {
        type: 'permission_error',
        message: 'account balance depleted; contact the operator to top up',
      },
    });
  }
  req.apiKey = key;
  req.apiUser = owner;
}
