import type {
  AccountPlan,
  AccountStatus,
  ApiKeyStatus,
  Provider,
  UserRole,
} from './enums.js';

// Data shapes exchanged between @xxf/server (HTTP) and @xxf/web (admin UI).
// Keep minimal, DTO-flavored — not a mirror of the DB schema.

export interface AccountDTO {
  id: string;
  provider: Provider;
  ownerUserId: string | null;
  ownerEmail: string | null;
  shared: boolean;
  label: string | null;
  plan: AccountPlan;
  status: AccountStatus;
  windowTokensUsed: number;
  windowLimit: number | null;
  coolingUntil: string | null;
  lastUsedAt: string | null;
  proxyId: string | null;
  createdAt: string;
}

export interface AttachAccountInput {
  provider: Provider;
  plan: AccountPlan;
  label?: string;
  shared?: boolean;
  oauthAccessToken: string;
  oauthRefreshToken?: string;
  tokenExpiresAt?: string;
}

export interface UserDTO {
  id: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

export interface ApiKeyDTO {
  id: string;
  userId: string;
  name: string;
  keyPreview: string;
  quotaMonthlyTokens: number | null;
  usedMonthlyTokens: number;
  status: ApiKeyStatus;
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

export interface ApiKeyMintedDTO extends ApiKeyDTO {
  // Plaintext key — returned ONCE at mint time, never persisted.
  key: string;
}

export interface StatsOverviewDTO {
  activeAccounts: number;
  tokensLast24h: number;
  requestsLast24h: number;
  poolUtilization: number; // 0..1
  timeseries: Array<{ ts: string; tokens: number; requests: number }>;
}
