// Upstream endpoint + headers used to call Anthropic on behalf of a
// Claude Code / Claude Max OAuth-authenticated subscriber.
//
// CLAUDE_OAUTH_BETA identifies the caller as the Claude Code OAuth client.
// If Anthropic rotates this beta tag we'll need a code change, not config.
// CLAUDE_OAUTH_CLIENT_ID is the public client_id Claude Code uses; it's
// not a secret.

const DEFAULT_UPSTREAM = 'https://api.anthropic.com';
const DEFAULT_OAUTH_BASE = 'https://console.anthropic.com';

export const CLAUDE_UPSTREAM_BASE = process.env.CLAUDE_UPSTREAM_BASE ?? DEFAULT_UPSTREAM;
export const CLAUDE_OAUTH_BASE = process.env.CLAUDE_OAUTH_BASE ?? DEFAULT_OAUTH_BASE;
export const CLAUDE_MESSAGES_PATH = '/v1/messages';
export const CLAUDE_TOKEN_PATH = '/v1/oauth/token';
export const CLAUDE_ANTHROPIC_VERSION = '2023-06-01';
export const CLAUDE_OAUTH_BETA = 'oauth-2025-04-20';
export const CLAUDE_OAUTH_CLIENT_ID =
  process.env.CLAUDE_OAUTH_CLIENT_ID ?? '9d1c250a-e61b-44d9-88ed-5944d1962f5e';

export function claudeAuthHeaders(
  accessToken: string,
  clientBeta?: string | string[],
): Record<string, string> {
  // Merge whatever beta tags the client sent with our required oauth beta.
  // Claude Code sends a comma-joined list like
  //   `claude-code-20250219,fine-grained-tool-streaming-2025-05-14,...`
  // — dropping these makes Anthropic reject fields like `context_management`
  // with a 400 "Extra inputs are not permitted" validation error.
  const clientList = Array.isArray(clientBeta)
    ? clientBeta.join(',')
    : clientBeta ?? '';
  const parts = clientList
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!parts.includes(CLAUDE_OAUTH_BETA)) parts.push(CLAUDE_OAUTH_BETA);
  return {
    'Authorization': `Bearer ${accessToken}`,
    'anthropic-version': CLAUDE_ANTHROPIC_VERSION,
    'anthropic-beta': parts.join(','),
    'Content-Type': 'application/json',
  };
}

export interface ClaudeOAuthToken {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
}

export interface RefreshFailure {
  ok: false;
  status: number;
  body: string;
  // Anthropic returns `{ error: "invalid_grant" }` when the refresh token
  // itself has been revoked — we surface that distinctly so the caller can
  // mark the account `needs_reauth` rather than retrying forever.
  needsReauth: boolean;
}

export type RefreshResult = ({ ok: true } & ClaudeOAuthToken) | RefreshFailure;

export async function refreshToken(refresh: string): Promise<RefreshResult> {
  let res: Response;
  try {
    res = await fetch(`${CLAUDE_OAUTH_BASE}${CLAUDE_TOKEN_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: refresh,
        client_id: CLAUDE_OAUTH_CLIENT_ID,
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
