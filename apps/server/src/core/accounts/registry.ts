import { and, eq, sql } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { accounts, type Account, type NewAccount } from '../../db/schema.js';
import { openToken, sealToken } from './token.js';
import type { AccountPlan, Provider } from '@xxf/shared';

export interface AttachInput {
  provider: Provider;
  plan: AccountPlan;
  label?: string | null;
  ownerUserId?: string | null;
  shared?: boolean;
  oauthAccessToken: string;
  oauthRefreshToken?: string | null;
  tokenExpiresAt?: Date | null;
}

export async function attachAccount(input: AttachInput): Promise<Account> {
  const row: NewAccount = {
    provider: input.provider,
    plan: input.plan,
    label: input.label ?? null,
    ownerUserId: input.ownerUserId ?? null,
    shared: input.shared ?? false,
    oauthAccessToken: sealToken(input.oauthAccessToken),
    oauthRefreshToken: input.oauthRefreshToken ? sealToken(input.oauthRefreshToken) : null,
    tokenExpiresAt: input.tokenExpiresAt ?? null,
    status: 'active',
  };
  const [created] = await db.insert(accounts).values(row).returning();
  if (!created) throw new Error('failed to insert account');
  return created;
}

export async function listAccounts(): Promise<Account[]> {
  return db.select().from(accounts);
}

export async function getAccount(id: string): Promise<Account | null> {
  const rows = await db.select().from(accounts).where(eq(accounts.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function deleteAccount(id: string): Promise<void> {
  await db.delete(accounts).where(eq(accounts.id, id));
}

export async function setAccountStatus(
  id: string,
  status: Account['status'],
  coolingUntil?: Date | null,
): Promise<void> {
  await db
    .update(accounts)
    .set({ status, coolingUntil: coolingUntil ?? null, updatedAt: new Date() })
    .where(eq(accounts.id, id));
}

// Extract the decrypted bearer for upstream use. Callers must NOT persist or log.
export function decryptAccessToken(account: Account): string {
  return openToken(account.oauthAccessToken);
}

export function decryptRefreshToken(account: Account): string | null {
  return account.oauthRefreshToken ? openToken(account.oauthRefreshToken) : null;
}

export async function incrementWindowUsage(accountId: string, tokens: number): Promise<void> {
  // P2 will replace this with a Redis-backed rolling window. For P1 we just
  // bump the DB counter so the admin UI shows activity.
  await db
    .update(accounts)
    .set({
      windowTokensUsed: sql`${accounts.windowTokensUsed} + ${tokens}`,
      lastUsedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(accounts.id, accountId)));
}
