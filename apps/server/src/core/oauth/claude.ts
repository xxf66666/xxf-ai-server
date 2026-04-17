// Upstream endpoint + headers used to call Anthropic on behalf of a
// Claude Code / Claude Max OAuth-authenticated subscriber.
//
// The beta header identifies the caller as the Claude Code OAuth client.
// If Anthropic rotates that beta tag, update CLAUDE_OAUTH_BETA here; it is
// deliberately NOT an env var — a rotated tag is a code change, not config.

const DEFAULT_UPSTREAM = 'https://api.anthropic.com';

export const CLAUDE_UPSTREAM_BASE = process.env.CLAUDE_UPSTREAM_BASE ?? DEFAULT_UPSTREAM;
export const CLAUDE_MESSAGES_PATH = '/v1/messages';
export const CLAUDE_ANTHROPIC_VERSION = '2023-06-01';
export const CLAUDE_OAUTH_BETA = 'oauth-2025-04-20';

export function claudeAuthHeaders(accessToken: string): Record<string, string> {
  return {
    'Authorization': `Bearer ${accessToken}`,
    'anthropic-version': CLAUDE_ANTHROPIC_VERSION,
    'anthropic-beta': CLAUDE_OAUTH_BETA,
    'Content-Type': 'application/json',
  };
}

export interface ClaudeOAuthToken {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
}

// Refresh flow implemented in P2. For P1 the pasted access token is used
// directly — it's valid for hours, enough for an MVP smoke test.
export async function refreshToken(_refreshToken: string): Promise<ClaudeOAuthToken> {
  throw new Error('not implemented: refreshToken (P2)');
}
