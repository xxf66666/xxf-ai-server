import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const providerEnum = pgEnum('provider', ['claude', 'chatgpt']);
export const accountStatusEnum = pgEnum('account_status', [
  'active',
  'cooling',
  'rate_limited',
  'needs_reauth',
  'banned',
]);
export const planEnum = pgEnum('account_plan', ['pro', 'max5x', 'max20x', 'plus', 'pro_chatgpt']);
export const userRoleEnum = pgEnum('user_role', ['admin', 'contributor', 'consumer']);
export const apiKeyStatusEnum = pgEnum('api_key_status', ['active', 'revoked']);

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 320 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: userRoleEnum('role').notNull().default('consumer'),
  // Balance & lifetime spend, stored in micro-USD (10^-6 USD).
  // $5 welcome credit = 5_000_000 mud. New users get seeded at register time.
  balanceMud: bigint('balance_mud', { mode: 'number' }).default(0).notNull(),
  spentMud: bigint('spent_mud', { mode: 'number' }).default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const proxies = pgTable('proxies', {
  id: uuid('id').defaultRandom().primaryKey(),
  label: varchar('label', { length: 120 }).notNull(),
  url: text('url').notNull(),
  region: varchar('region', { length: 32 }),
  maxConcurrency: integer('max_concurrency').default(4).notNull(),
  enabled: boolean('enabled').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const accounts = pgTable('accounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  provider: providerEnum('provider').notNull(),
  ownerUserId: uuid('owner_user_id')
    .references(() => users.id, { onDelete: 'set null' }),
  shared: boolean('shared').default(false).notNull(),
  label: varchar('label', { length: 120 }),
  plan: planEnum('plan').notNull(),
  status: accountStatusEnum('status').default('active').notNull(),

  // Token (encrypted at rest, base64 sealed JSON: {nonce,ciphertext,tag})
  oauthAccessToken: text('oauth_access_token').notNull(),
  oauthRefreshToken: text('oauth_refresh_token'),
  tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true }),

  // 5-hour rolling window accounting
  windowStart: timestamp('window_start', { withTimezone: true }),
  windowTokensUsed: bigint('window_tokens_used', { mode: 'number' }).default(0).notNull(),

  coolingUntil: timestamp('cooling_until', { withTimezone: true }),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  lastProbeAt: timestamp('last_probe_at', { withTimezone: true }),
  lastProbeOk: boolean('last_probe_ok'),

  // Egress binding (null = direct)
  proxyId: uuid('proxy_id').references(() => proxies.id, { onDelete: 'set null' }),

  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const apiKeys = pgTable('api_keys', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 120 }).notNull(),
  keyHash: text('key_hash').notNull().unique(),
  keyPreview: varchar('key_preview', { length: 16 }).notNull(), // "sk-xxf-…ab12"
  quotaMonthlyTokens: bigint('quota_monthly_tokens', { mode: 'number' }),
  usedMonthlyTokens: bigint('used_monthly_tokens', { mode: 'number' }).default(0).notNull(),
  status: apiKeyStatusEnum('status').default('active').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const usageLog = pgTable('usage_log', {
  id: uuid('id').defaultRandom().primaryKey(),
  apiKeyId: uuid('api_key_id').references(() => apiKeys.id, { onDelete: 'set null' }),
  accountId: uuid('account_id').references(() => accounts.id, { onDelete: 'set null' }),
  provider: providerEnum('provider').notNull(),
  model: varchar('model', { length: 120 }).notNull(),
  inputTokens: integer('input_tokens').default(0).notNull(),
  outputTokens: integer('output_tokens').default(0).notNull(),
  latencyMs: integer('latency_ms').default(0).notNull(),
  status: integer('status').notNull(), // HTTP status
  errorCode: varchar('error_code', { length: 64 }),
  // Cost charged to the api_key's user for this request, in micro-USD
  // (10^-6 USD). Includes the operator's markup; 0 for errors that we
  // choose not to bill for.
  costMud: bigint('cost_mud', { mode: 'number' }).default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .default(sql`now()`)
    .notNull(),
});

export const auditLog = pgTable('audit_log', {
  id: uuid('id').defaultRandom().primaryKey(),
  actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
  actorEmail: varchar('actor_email', { length: 320 }),
  action: varchar('action', { length: 64 }).notNull(),
  entityType: varchar('entity_type', { length: 64 }),
  entityId: varchar('entity_id', { length: 64 }),
  detail: jsonb('detail').$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .default(sql`now()`)
    .notNull(),
});

export const systemSettings = pgTable('system_settings', {
  key: varchar('key', { length: 64 }).primaryKey(),
  value: jsonb('value').$type<unknown>().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type SystemSetting = typeof systemSettings.$inferSelect;
export type NewSystemSetting = typeof systemSettings.$inferInsert;

// Per-model pricing. Stored in micro-USD per 1M tokens ("mud"):
// $15/M → 15_000_000. Bigint avoids float drift when summing at the
// per-request scale.
export const modelPricing = pgTable('model_pricing', {
  id: uuid('id').defaultRandom().primaryKey(),
  modelId: varchar('model_id', { length: 120 }).notNull().unique(),
  provider: varchar('provider', { length: 16 }).notNull(),
  inputMudPerM: bigint('input_mud_per_m', { mode: 'number' }).notNull(),
  outputMudPerM: bigint('output_mud_per_m', { mode: 'number' }).notNull(),
  tier: varchar('tier', { length: 32 }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
export type ModelPricing = typeof modelPricing.$inferSelect;
export type NewModelPricing = typeof modelPricing.$inferInsert;

// Invite codes: registration is gated. A valid, non-revoked, non-exhausted
// code is required. Admin mints / resets / revokes via /admin/v1/invites.
export const inviteCodes = pgTable('invite_codes', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: varchar('code', { length: 32 }).notNull().unique(),
  note: varchar('note', { length: 120 }),
  createdByUserId: uuid('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  maxUses: integer('max_uses').default(1).notNull(),
  useCount: integer('use_count').default(0).notNull(),
  revoked: boolean('revoked').default(false).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
export type InviteCode = typeof inviteCodes.$inferSelect;
export type NewInviteCode = typeof inviteCodes.$inferInsert;

export type AuditLogEntry = typeof auditLog.$inferSelect;
export type NewAuditLogEntry = typeof auditLog.$inferInsert;

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;
export type UsageLog = typeof usageLog.$inferSelect;
export type NewUsageLog = typeof usageLog.$inferInsert;
export type Proxy = typeof proxies.$inferSelect;
export type NewProxy = typeof proxies.$inferInsert;
