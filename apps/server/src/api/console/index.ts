// Consumer-facing (/console/*) API surface. Every endpoint is scoped to
// req.adminSession.sub — an authenticated user sees only their own keys,
// usage, balance, etc. No RBAC gate is needed: admins + contributors can
// access this surface too (to see their personal stats).
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { and, count, desc, eq, gte, sql } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { apiKeys, usageLog, users } from '../../db/schema.js';
import {
  listApiKeys,
  mintApiKey,
  revokeApiKey,
} from '../../core/users/keys.js';
import { consumeRedeemCode, listMyRedeemed } from '../../core/redeem/index.js';
import { hashPassword, verifyPassword } from '../../core/users/passwords.js';
import { isStrongEnough } from '../../core/users/strength.js';
import { generateTotpSecret, totpUri, verifyTotp } from '../../core/users/totp.js';
import { getAllSettings } from '../../core/settings/index.js';
import { record } from '../../core/audit/log.js';
import { requireAdmin } from '../../middleware/admin-auth.js';

// Fallback model list when operator hasn't pinned one via settings.
// Mirrors the actual 2026-04 Codex CLI model picker + Claude Code.
const DEFAULT_MODELS = [
  { id: 'claude-opus-4-7', provider: 'claude', tier: 'opus' },
  { id: 'claude-sonnet-4-6', provider: 'claude', tier: 'sonnet' },
  { id: 'claude-haiku-4-5-20251001', provider: 'claude', tier: 'haiku' },
  { id: 'gpt-5.4', provider: 'openai', tier: 'flagship' },
  { id: 'gpt-5.4-mini', provider: 'openai', tier: 'mid' },
  { id: 'gpt-5.3-codex', provider: 'openai', tier: 'codex' },
  { id: 'gpt-5.2-codex', provider: 'openai', tier: 'codex' },
  { id: 'gpt-5.2', provider: 'openai', tier: 'mid' },
  { id: 'gpt-5.1-codex-max', provider: 'openai', tier: 'codex' },
  { id: 'gpt-5.1-codex-mini', provider: 'openai', tier: 'small' },
];

const MintSchema = z.object({
  name: z.string().min(1).max(120),
  allowedModels: z.array(z.string().min(1).max(120)).nullable().optional(),
});

const PasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

const RedeemSchema = z.object({
  code: z.string().min(4).max(64),
});

function sessionUser(req: Parameters<typeof requireAdmin>[0]): string | null {
  const sub = req.adminSession?.sub;
  if (!sub || sub === 'bootstrap') return null;
  return sub;
}

// RFC 4180 CSV escape: wrap in quotes if the value contains comma, quote,
// or newline; inner double-quotes are doubled.
function csvCell(v: string | number): string {
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function registerConsole(app: FastifyInstance): Promise<void> {
  // All console routes require a logged-in session (JWT cookie). We
  // reuse requireAdmin here — its JWT cookie verification works for any
  // role, and we DON'T gate by role, so consumers pass through.
  app.addHook('preHandler', async (req, reply) => {
    if (req.url.startsWith('/v1/console/')) {
      await requireAdmin(req, reply);
    }
  });

  app.get('/v1/console/overview', async (req, reply) => {
    const uid = sessionUser(req);
    if (!uid) return reply.code(401).send({ error: 'unauth' });
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const myKeys = await db
      .select({
        id: apiKeys.id,
        used: apiKeys.usedMonthlyTokens,
        quotaMonthlyTokens: apiKeys.quotaMonthlyTokens,
        status: apiKeys.status,
      })
      .from(apiKeys)
      .where(eq(apiKeys.userId, uid));
    const activeKeys = myKeys.filter((k) => k.status === 'active').length;
    const usedMonthly = myKeys.reduce((acc, k) => acc + Number(k.used ?? 0), 0);

    const keyIds = myKeys.map((k) => k.id);
    let tokens24h = 0;
    let requests24h = 0;
    let timeseries: Array<{ ts: string; tokens: number; requests: number }> = [];
    if (keyIds.length > 0) {
      const [totals] = await db
        .select({
          tokens: sql<string>`coalesce(sum(${usageLog.inputTokens} + ${usageLog.outputTokens}), 0)`,
          requests: count(),
        })
        .from(usageLog)
        .where(
          and(
            gte(usageLog.createdAt, since24h),
            sql`${usageLog.apiKeyId} IN (${sql.join(
              keyIds.map((id) => sql`${id}`),
              sql`, `,
            )})`,
          ),
        );
      tokens24h = Number(totals?.tokens ?? 0);
      requests24h = Number(totals?.requests ?? 0);

      const rows = await db
        .select({
          ts: sql<string>`date_trunc('hour', ${usageLog.createdAt})`,
          tokens: sql<string>`coalesce(sum(${usageLog.inputTokens} + ${usageLog.outputTokens}), 0)`,
          requests: count(),
        })
        .from(usageLog)
        .where(
          and(
            gte(usageLog.createdAt, since24h),
            sql`${usageLog.apiKeyId} IN (${sql.join(
              keyIds.map((id) => sql`${id}`),
              sql`, `,
            )})`,
          ),
        )
        .groupBy(sql`date_trunc('hour', ${usageLog.createdAt})`)
        .orderBy(sql`date_trunc('hour', ${usageLog.createdAt})`);
      timeseries = rows.map((r) => ({
        ts: new Date(r.ts).toISOString(),
        tokens: Number(r.tokens),
        requests: Number(r.requests),
      }));
    }

    const [meRow] = await db
      .select({
        balanceMud: users.balanceMud,
        spentMud: users.spentMud,
        emailVerified: users.emailVerified,
        totpEnabled: users.totpEnabled,
      })
      .from(users)
      .where(eq(users.id, uid))
      .limit(1);

    // Derived UI alerts. Surfaced on dashboard as coloured banners so
    // the user sees "balance low" / "key near quota" without having to
    // hunt for it in the numbers.
    const balanceMud = Number(meRow?.balanceMud ?? 0);
    const spentMud = Number(meRow?.spentMud ?? 0);
    const alerts: Array<{
      kind: 'balance_depleted' | 'balance_low' | 'key_quota_high';
      level: 'warning' | 'critical';
      detail?: { keyId?: string; usedPct?: number };
    }> = [];
    // Only consumers are billed on balance — admins / contributors
    // bypass the balance gate on the relay.
    const isConsumer = req.adminSession?.role === 'consumer';
    if (isConsumer) {
      if (balanceMud <= 0) {
        alerts.push({ kind: 'balance_depleted', level: 'critical' });
      } else if (balanceMud < 1_000_000) {
        // < $1 → warn.
        alerts.push({ kind: 'balance_low', level: 'warning' });
      }
    }
    for (const k of myKeys) {
      const q = Number((k as { quotaMonthlyTokens?: unknown }).quotaMonthlyTokens ?? 0);
      if (q > 0) {
        const used = Number(k.used ?? 0);
        const pct = used / q;
        if (pct >= 0.8) {
          alerts.push({
            kind: 'key_quota_high',
            level: pct >= 1 ? 'critical' : 'warning',
            detail: { keyId: k.id, usedPct: Math.round(pct * 100) },
          });
        }
      }
    }

    return {
      email: req.adminSession?.email ?? '',
      role: req.adminSession?.role ?? 'consumer',
      activeKeys,
      tokens24h,
      requests24h,
      usedMonthly,
      balanceMud,
      spentMud,
      emailVerified: Boolean(meRow?.emailVerified),
      totpEnabled: Boolean(meRow?.totpEnabled),
      timeseries,
      alerts,
    };
  });

  app.get('/v1/console/keys', async (req, reply) => {
    const uid = sessionUser(req);
    if (!uid) return reply.code(401).send({ error: 'unauth' });
    const rows = await listApiKeys(uid);
    return {
      data: rows.map((k) => ({
        id: k.id,
        name: k.name,
        keyPreview: k.keyPreview,
        status: k.status,
        quotaMonthlyTokens: k.quotaMonthlyTokens,
        usedMonthlyTokens: k.usedMonthlyTokens,
        allowedModels: k.allowedModels ?? null,
        expiresAt: k.expiresAt?.toISOString() ?? null,
        lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
        createdAt: k.createdAt.toISOString(),
      })),
    };
  });

  app.post('/v1/console/keys', async (req, reply) => {
    const uid = sessionUser(req);
    if (!uid) return reply.code(401).send({ error: 'unauth' });
    const parsed = MintSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        type: 'error',
        error: { type: 'invalid_request_error', message: parsed.error.message },
      });
    }
    const result = await mintApiKey({
      userId: uid,
      name: parsed.data.name,
      allowedModels: parsed.data.allowedModels ?? null,
    });
    await record(req, {
      action: 'key.mint',
      entityType: 'api_key',
      entityId: result.record.id,
      detail: { via: 'console', name: parsed.data.name },
    });
    return reply.code(201).send({
      id: result.record.id,
      name: result.record.name,
      keyPreview: result.record.keyPreview,
      key: result.plaintext,
      status: result.record.status,
      createdAt: result.record.createdAt.toISOString(),
    });
  });

  app.delete('/v1/console/keys/:id', async (req, reply) => {
    const uid = sessionUser(req);
    if (!uid) return reply.code(401).send({ error: 'unauth' });
    const id = (req.params as { id: string }).id;
    const [k] = await db.select().from(apiKeys).where(eq(apiKeys.id, id)).limit(1);
    if (!k) return reply.code(404).send({ error: 'not_found' });
    if (k.userId !== uid) return reply.code(403).send({ error: 'forbidden' });
    await revokeApiKey(id);
    await record(req, { action: 'key.revoke', entityType: 'api_key', entityId: id, detail: { via: 'console' } });
    return reply.code(204).send();
  });

  app.get('/v1/console/usage', async (req, reply) => {
    const uid = sessionUser(req);
    if (!uid) return reply.code(401).send({ error: 'unauth' });
    const query = (req.query ?? {}) as { limit?: string };
    const limit = Math.min(200, Math.max(1, Number(query.limit ?? 50)));
    // Join usage_log → api_keys on key ownership = current user.
    const rows = await db
      .select({
        id: usageLog.id,
        createdAt: usageLog.createdAt,
        provider: usageLog.provider,
        model: usageLog.model,
        inputTokens: usageLog.inputTokens,
        outputTokens: usageLog.outputTokens,
        latencyMs: usageLog.latencyMs,
        status: usageLog.status,
        errorCode: usageLog.errorCode,
        costMud: usageLog.costMud,
        keyName: apiKeys.name,
      })
      .from(usageLog)
      .innerJoin(apiKeys, eq(usageLog.apiKeyId, apiKeys.id))
      .where(eq(apiKeys.userId, uid))
      .orderBy(desc(usageLog.createdAt))
      .limit(limit);
    return {
      data: rows.map((r) => ({
        id: r.id,
        createdAt: r.createdAt.toISOString(),
        provider: r.provider,
        model: r.model,
        inputTokens: r.inputTokens,
        outputTokens: r.outputTokens,
        latencyMs: r.latencyMs,
        status: r.status,
        errorCode: r.errorCode,
        costMud: Number(r.costMud ?? 0),
        keyName: r.keyName,
      })),
    };
  });

  // CSV export of this user's usage_log. Hard-capped at 5000 rows so a
  // malicious client can't ask for the whole table. Query param `days`
  // (default 30, max 90) scopes the time window.
  app.get('/v1/console/usage.csv', async (req, reply) => {
    const uid = sessionUser(req);
    if (!uid) return reply.code(401).send({ error: 'unauth' });
    const q = (req.query ?? {}) as { days?: string };
    const days = Math.min(90, Math.max(1, Number(q.days ?? 30)));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const rows = await db
      .select({
        createdAt: usageLog.createdAt,
        provider: usageLog.provider,
        model: usageLog.model,
        inputTokens: usageLog.inputTokens,
        outputTokens: usageLog.outputTokens,
        latencyMs: usageLog.latencyMs,
        status: usageLog.status,
        errorCode: usageLog.errorCode,
        costMud: usageLog.costMud,
        keyName: apiKeys.name,
      })
      .from(usageLog)
      .innerJoin(apiKeys, eq(usageLog.apiKeyId, apiKeys.id))
      .where(and(eq(apiKeys.userId, uid), gte(usageLog.createdAt, since)))
      .orderBy(desc(usageLog.createdAt))
      .limit(5000);

    // Manual CSV serialization — no streaming library needed at this
    // row count. Escape double-quotes by doubling them (RFC 4180).
    const header = [
      'timestamp_utc',
      'provider',
      'model',
      'key_name',
      'input_tokens',
      'output_tokens',
      'latency_ms',
      'http_status',
      'error_code',
      'cost_usd',
    ].join(',');
    const lines = rows.map((r) => {
      const cost = Number(r.costMud ?? 0) / 1_000_000;
      const fields: Array<string | number> = [
        r.createdAt.toISOString(),
        r.provider,
        r.model,
        r.keyName ?? '',
        r.inputTokens,
        r.outputTokens,
        r.latencyMs,
        r.status,
        r.errorCode ?? '',
        cost.toFixed(6),
      ];
      return fields.map(csvCell).join(',');
    });
    const body = [header, ...lines].join('\n') + '\n';
    const filename = `nexa-usage-${new Date().toISOString().slice(0, 10)}.csv`;
    return reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .send(body);
  });

  app.get('/v1/console/breakdown', async (req, reply) => {
    const uid = sessionUser(req);
    if (!uid) return reply.code(401).send({ error: 'unauth' });
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const myKeys = await db
      .select({ id: apiKeys.id, name: apiKeys.name })
      .from(apiKeys)
      .where(eq(apiKeys.userId, uid));
    if (myKeys.length === 0) {
      return { byModel: [], byKey: [], byStatus: [], trend: [] };
    }
    const keyIds = myKeys.map((k) => k.id);
    const keyIdFilter = sql`${usageLog.apiKeyId} IN (${sql.join(
      keyIds.map((id) => sql`${id}`),
      sql`, `,
    )})`;
    const whereScope = and(gte(usageLog.createdAt, since), keyIdFilter);

    const byModel = await db
      .select({
        model: usageLog.model,
        tokens: sql<string>`coalesce(sum(${usageLog.inputTokens} + ${usageLog.outputTokens}), 0)`,
        requests: count(),
      })
      .from(usageLog)
      .where(whereScope)
      .groupBy(usageLog.model);

    const byKey = await db
      .select({
        keyId: usageLog.apiKeyId,
        tokens: sql<string>`coalesce(sum(${usageLog.inputTokens} + ${usageLog.outputTokens}), 0)`,
        requests: count(),
      })
      .from(usageLog)
      .where(whereScope)
      .groupBy(usageLog.apiKeyId);

    const byStatus = await db
      .select({
        bucket: sql<string>`
          case
            when ${usageLog.status} >= 200 and ${usageLog.status} < 300 then '2xx'
            when ${usageLog.status} >= 300 and ${usageLog.status} < 400 then '3xx'
            when ${usageLog.status} >= 400 and ${usageLog.status} < 500 then '4xx'
            when ${usageLog.status} >= 500 then '5xx'
            else 'other'
          end`,
        requests: count(),
      })
      .from(usageLog)
      .where(whereScope)
      .groupBy(sql`1`);

    const trend = await db
      .select({
        ts: sql<string>`date_trunc('hour', ${usageLog.createdAt})`,
        inputTokens: sql<string>`coalesce(sum(${usageLog.inputTokens}), 0)`,
        outputTokens: sql<string>`coalesce(sum(${usageLog.outputTokens}), 0)`,
        requests: count(),
      })
      .from(usageLog)
      .where(whereScope)
      .groupBy(sql`date_trunc('hour', ${usageLog.createdAt})`)
      .orderBy(sql`date_trunc('hour', ${usageLog.createdAt})`);

    const keyName = new Map(myKeys.map((k) => [k.id, k.name]));
    return {
      byModel: byModel.map((r) => ({
        model: r.model,
        tokens: Number(r.tokens),
        requests: Number(r.requests),
      })),
      byKey: byKey.map((r) => ({
        keyId: r.keyId,
        keyName: r.keyId ? (keyName.get(r.keyId) ?? null) : null,
        tokens: Number(r.tokens),
        requests: Number(r.requests),
      })),
      byStatus: byStatus.map((r) => ({ bucket: r.bucket, requests: Number(r.requests) })),
      trend: trend.map((r) => ({
        ts: new Date(r.ts).toISOString(),
        inputTokens: Number(r.inputTokens),
        outputTokens: Number(r.outputTokens),
        requests: Number(r.requests),
      })),
    };
  });

  app.get('/v1/console/models', async () => {
    const settings = await getAllSettings();
    const allow = Array.isArray(settings['models.allow']) ? (settings['models.allow'] as string[]) : [];
    if (allow.length === 0) return { data: DEFAULT_MODELS };
    return {
      data: allow.map((id) => ({ id, provider: id.startsWith('claude-') ? 'claude' : 'openai', tier: null })),
    };
  });

  app.post('/v1/console/redeem', async (req, reply) => {
    const uid = sessionUser(req);
    if (!uid) return reply.code(401).send({ error: 'unauth' });
    const parsed = RedeemSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        type: 'error',
        error: { type: 'invalid_request_error', message: parsed.error.message },
      });
    }
    const result = await consumeRedeemCode(parsed.data.code, uid);
    if (!result.ok) {
      await record(req, {
        action: 'redeem.attempt_failed',
        entityType: 'redeem_code',
        detail: { reason: result.reason },
      });
      const message =
        result.reason === 'not_found'
          ? 'redeem code not found'
          : result.reason === 'revoked'
            ? 'redeem code has been revoked'
            : 'redeem code already used';
      return reply
        .code(400)
        .send({ type: 'error', error: { type: 'invalid_request_error', message } });
    }
    await record(req, {
      action: 'redeem.consume',
      entityType: 'redeem_code',
      detail: { valueMud: result.valueMud },
    });
    return { ok: true, valueMud: result.valueMud };
  });

  app.get('/v1/console/redeem/history', async (req, reply) => {
    const uid = sessionUser(req);
    if (!uid) return reply.code(401).send({ error: 'unauth' });
    const rows = await listMyRedeemed(uid);
    return {
      data: rows.map((r) => ({
        id: r.id,
        codePreview: `${r.code.slice(0, 4)}…${r.code.slice(-4)}`,
        valueMud: Number(r.valueMud),
        redeemedAt: r.redeemedAt?.toISOString() ?? null,
      })),
    };
  });

  // 2FA enrollment. Step 1: user POSTs, server generates a fresh secret,
  // stores it sealed (but totp_enabled stays false until confirm), and
  // returns the otpauth URI so the client can render a QR. Subsequent
  // enroll calls replace the pending secret — a partial enrollment
  // can't lock anyone out.
  app.post('/v1/console/me/totp/enroll', async (req, reply) => {
    const uid = sessionUser(req);
    if (!uid) return reply.code(401).send({ error: 'unauth' });
    const [me] = await db.select().from(users).where(eq(users.id, uid)).limit(1);
    if (!me) return reply.code(404).send({ error: 'not_found' });
    if (me.totpEnabled) {
      return reply.code(400).send({
        type: 'error',
        error: { type: 'invalid_request_error', message: 'totp already enabled' },
      });
    }
    const { base32, storedValue } = generateTotpSecret();
    await db.update(users).set({ totpSecret: storedValue }).where(eq(users.id, uid));
    return { uri: totpUri(me.email, base32), secret: base32 };
  });

  // 2FA enrollment. Step 2: user sends the 6-digit code they see in
  // their authenticator. On success we flip totpEnabled → true; from
  // the next login onwards, the user will be prompted for a code.
  app.post('/v1/console/me/totp/confirm', async (req, reply) => {
    const uid = sessionUser(req);
    if (!uid) return reply.code(401).send({ error: 'unauth' });
    const parsed = z
      .object({ code: z.string().min(6).max(10) })
      .safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        type: 'error',
        error: { type: 'invalid_request_error', message: 'code required' },
      });
    }
    const [me] = await db.select().from(users).where(eq(users.id, uid)).limit(1);
    if (!me || !me.totpSecret) {
      return reply.code(400).send({
        type: 'error',
        error: { type: 'invalid_request_error', message: 'enroll first' },
      });
    }
    if (!verifyTotp(me.totpSecret, parsed.data.code)) {
      return reply.code(400).send({
        type: 'error',
        error: { type: 'invalid_request_error', message: 'invalid code' },
      });
    }
    await db.update(users).set({ totpEnabled: true }).where(eq(users.id, uid));
    await record(req, { action: 'user.totp_enabled', entityType: 'user', entityId: uid });
    return { ok: true };
  });

  // Turn 2FA off — requires the user's current password so an attacker
  // who steals the JWT alone can't disable it.
  app.post('/v1/console/me/totp/disable', async (req, reply) => {
    const uid = sessionUser(req);
    if (!uid) return reply.code(401).send({ error: 'unauth' });
    const parsed = z
      .object({ password: z.string().min(1) })
      .safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        type: 'error',
        error: { type: 'invalid_request_error', message: 'password required' },
      });
    }
    const [me] = await db.select().from(users).where(eq(users.id, uid)).limit(1);
    if (!me) return reply.code(404).send({ error: 'not_found' });
    if (!(await verifyPassword(me.passwordHash, parsed.data.password))) {
      return reply.code(401).send({
        type: 'error',
        error: { type: 'authentication_error', message: 'current password incorrect' },
      });
    }
    await db
      .update(users)
      .set({ totpEnabled: false, totpSecret: null })
      .where(eq(users.id, uid));
    await record(req, { action: 'user.totp_disabled', entityType: 'user', entityId: uid });
    return { ok: true };
  });

  // Revoke all other sessions — bumps password_changed_at so every
  // existing JWT becomes invalid on next request. Reuses the same
  // mechanism the password change flow uses.
  app.post('/v1/console/me/sessions/revoke-others', async (req, reply) => {
    const uid = sessionUser(req);
    if (!uid) return reply.code(401).send({ error: 'unauth' });
    await db
      .update(users)
      .set({ passwordChangedAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, uid));
    await record(req, {
      action: 'user.sessions_revoked',
      entityType: 'user',
      entityId: uid,
      detail: { via: 'self' },
    });
    // Current cookie was signed BEFORE the new password_changed_at; to
    // keep the caller logged in, issue a fresh JWT now. We can reuse
    // reply.jwtSign because @fastify/jwt is registered on the app.
    const fresh = await reply.jwtSign(
      {
        sub: uid,
        email: req.adminSession?.email ?? '',
        role: req.adminSession?.role ?? 'consumer',
      },
      { expiresIn: '7d' },
    );
    reply.setCookie('xxf_admin_session', fresh, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
    });
    return { ok: true };
  });

  app.patch('/v1/console/me/password', async (req, reply) => {
    const uid = sessionUser(req);
    if (!uid) return reply.code(401).send({ error: 'unauth' });
    const parsed = PasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        type: 'error',
        error: { type: 'invalid_request_error', message: parsed.error.message },
      });
    }
    if (!isStrongEnough(parsed.data.newPassword)) {
      return reply.code(400).send({
        type: 'error',
        error: {
          type: 'invalid_request_error',
          message: 'new password too weak — mix letters, digits and symbols',
        },
      });
    }
    const [me] = await db.select().from(users).where(eq(users.id, uid)).limit(1);
    if (!me) return reply.code(404).send({ error: 'not_found' });
    if (!(await verifyPassword(me.passwordHash, parsed.data.currentPassword))) {
      return reply.code(401).send({
        type: 'error',
        error: { type: 'authentication_error', message: 'current password incorrect' },
      });
    }
    await db
      .update(users)
      .set({
        passwordHash: await hashPassword(parsed.data.newPassword),
        passwordChangedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, uid));
    await record(req, { action: 'user.password_change', entityType: 'user', entityId: uid });
    return reply.code(204).send();
  });
}
