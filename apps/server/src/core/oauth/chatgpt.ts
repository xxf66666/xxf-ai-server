// Codex CLI OAuth client. Codex uses the ChatGPT Plus subscriber's
// login to mint tokens against `auth.openai.com`; the resulting
// `access_token` has `aud: https://api.openai.com/v1` and scopes
// `api.connectors.{read,invoke}` — the same surface the desktop
// ChatGPT app uses.
//
// We only implement the refresh-token half here. Enrollment is done
// manually: the operator pastes a Codex-cli refresh_token + account_id
// into the admin UI (same flow as Claude Code OAuth accounts).

const DEFAULT_AUTH_BASE = 'https://auth.openai.com';
// Codex CLI's public client_id — pulled from the `client_id` claim in a
// real Codex access_token. Overridable via env so we can track rotations.
const DEFAULT_CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann';

// Use `||` rather than `??` so an empty-string env (common when a compose
// file passes through a blank default) still falls back to the baked-in
// values; `??` would treat '' as "explicitly set" and try to fetch from "".
export const CHATGPT_AUTH_BASE = process.env.CHATGPT_AUTH_BASE || DEFAULT_AUTH_BASE;
export const CHATGPT_OAUTH_CLIENT_ID =
  process.env.CHATGPT_OAUTH_CLIENT_ID || DEFAULT_CLIENT_ID;
export const CHATGPT_TOKEN_PATH = '/oauth/token';

// Upstream for the actual Codex Responses API. The exact host is in
// flux — we let operators override via env. Default matches what Codex
// CLI 2026-04 binaries call.
export const CHATGPT_UPSTREAM_BASE =
  process.env.CHATGPT_UPSTREAM_BASE || 'https://chatgpt.com';
export const CHATGPT_RESPONSES_PATH =
  process.env.CHATGPT_RESPONSES_PATH || '/backend-api/codex/responses';

export interface ChatgptAuthExtras {
  /** Required header — identifies which ChatGPT account to bill. */
  chatgptAccountId: string;
}

export function chatgptAuthHeaders(
  accessToken: string,
  extras: ChatgptAuthExtras,
): Record<string, string> {
  return {
    'Authorization': `Bearer ${accessToken}`,
    'ChatGPT-Account-Id': extras.chatgptAccountId,
    'OpenAI-Beta': 'responses=v1',
    'Content-Type': 'application/json',
  };
}

export interface ChatgptOAuthToken {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
}

export type ChatgptRefreshResult =
  | ({ ok: true } & ChatgptOAuthToken)
  | { ok: false; status: number; body: string; needsReauth: boolean };

export async function refreshChatgptToken(
  refresh: string,
): Promise<ChatgptRefreshResult> {
  let res: Response;
  try {
    res = await fetch(`${CHATGPT_AUTH_BASE}${CHATGPT_TOKEN_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: refresh,
        client_id: CHATGPT_OAUTH_CLIENT_ID,
      }),
    });
  } catch {
    return { ok: false, status: 0, body: 'network error', needsReauth: false };
  }

  const text = await res.text();
  if (!res.ok) {
    const needsReauth =
      res.status === 400 &&
      /invalid_grant|invalid_token|revoked/i.test(text);
    return { ok: false, status: res.status, body: text, needsReauth };
  }

  let json: Record<string, unknown>;
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { ok: false, status: res.status, body: text, needsReauth: false };
  }

  const accessToken = typeof json.access_token === 'string' ? json.access_token : null;
  if (!accessToken) {
    return { ok: false, status: res.status, body: text, needsReauth: false };
  }
  const refreshToken =
    typeof json.refresh_token === 'string' ? json.refresh_token : null;
  const expiresIn = typeof json.expires_in === 'number' ? json.expires_in : null;
  return {
    ok: true,
    accessToken,
    refreshToken,
    expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : null,
  };
}

/**
 * Pull the ChatGPT account id out of an access_token's JWT payload
 * (field `https://api.openai.com/auth.chatgpt_account_id`). We save it
 * alongside the access_token so the relay can send the right header.
 */
export function extractChatgptAccountId(accessToken: string): string | null {
  try {
    const [, payload] = accessToken.split('.');
    if (!payload) return null;
    const decoded = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8'),
    ) as Record<string, unknown>;
    const auth = decoded['https://api.openai.com/auth'] as
      | Record<string, unknown>
      | undefined;
    const id = auth?.['chatgpt_account_id'];
    return typeof id === 'string' ? id : null;
  } catch {
    return null;
  }
}
