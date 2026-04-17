// Claude Code OAuth client.
// Phase P1: implement token exchange + refresh against the Claude Code OAuth endpoints.
// For now, this is a typed placeholder so other modules can import.

export interface ClaudeOAuthToken {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
}

export async function refreshToken(_refreshToken: string): Promise<ClaudeOAuthToken> {
  throw new Error('not implemented: refreshToken (P1)');
}
