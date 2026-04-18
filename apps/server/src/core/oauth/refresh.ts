import { eq } from 'drizzle-orm';
import { redis } from '../../cache/redis.js';
import { db } from '../../db/client.js';
import { accounts, type Account } from '../../db/schema.js';
import { decryptAccessToken, decryptRefreshToken } from '../accounts/registry.js';
import { sealToken } from '../accounts/token.js';
import { logger } from '../../utils/logger.js';
import { refreshToken } from './claude.js';
import { refreshChatgptToken } from './chatgpt.js';

// Refresh if we're within this window of expiry. Gives us a cushion for
// clock skew and in-flight requests.
const REFRESH_AHEAD_MS = 60 * 1000; // 60s
const LOCK_TTL_SECONDS = 30;

function lockKey(accountId: string): string {
  return `oauth:refresh:lock:${accountId}`;
}

function tokenExpiringSoon(account: Account): boolean {
  if (!account.tokenExpiresAt) return false;
  return account.tokenExpiresAt.getTime() - Date.now() <= REFRESH_AHEAD_MS;
}

/**
 * Return a fresh access token for the account. If the stored token is about
 * to expire and we have a refresh token, attempt a single refresh under a
 * Redis mutex. On invalid_grant, mark the account needs_reauth and return
 * null so the caller routes around it.
 */
export async function ensureFreshAccessToken(account: Account): Promise<string | null> {
  if (!tokenExpiringSoon(account)) {
    return decryptAccessToken(account);
  }
  const refresh = decryptRefreshToken(account);
  if (!refresh) {
    // Nothing to refresh with — use what we have and let the relay fail
    // naturally, then classify on the error path.
    return decryptAccessToken(account);
  }

  const gotLock = await redis.set(lockKey(account.id), '1', 'EX', LOCK_TTL_SECONDS, 'NX');
  if (gotLock !== 'OK') {
    // Another worker is refreshing. Wait briefly and re-read from DB.
    await new Promise((r) => setTimeout(r, 300));
    const fresh = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, account.id))
      .limit(1);
    const latest = fresh[0];
    if (!latest) return null;
    return decryptAccessToken(latest);
  }

  try {
    const result =
      account.provider === 'chatgpt'
        ? await refreshChatgptToken(refresh)
        : await refreshToken(refresh);
    if (!result.ok) {
      logger.warn(
        { accountId: account.id, status: result.status, needsReauth: result.needsReauth },
        'token refresh failed',
      );
      if (result.needsReauth) {
        await db
          .update(accounts)
          .set({ status: 'needs_reauth', updatedAt: new Date() })
          .where(eq(accounts.id, account.id));
        return null;
      }
      // Transient failure — fall back to current token.
      return decryptAccessToken(account);
    }
    await db
      .update(accounts)
      .set({
        oauthAccessToken: sealToken(result.accessToken),
        oauthRefreshToken: result.refreshToken ? sealToken(result.refreshToken) : account.oauthRefreshToken,
        tokenExpiresAt: result.expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(accounts.id, account.id));
    return result.accessToken;
  } finally {
    await redis.del(lockKey(account.id)).catch(() => {});
  }
}
