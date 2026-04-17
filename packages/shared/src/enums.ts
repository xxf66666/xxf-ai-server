export const PROVIDERS = ['claude', 'chatgpt'] as const;
export type Provider = (typeof PROVIDERS)[number];

export const ACCOUNT_STATUSES = [
  'active',
  'cooling',
  'rate_limited',
  'needs_reauth',
  'banned',
] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const ACCOUNT_PLANS = ['pro', 'max5x', 'max20x', 'plus', 'pro_chatgpt'] as const;
export type AccountPlan = (typeof ACCOUNT_PLANS)[number];

export const USER_ROLES = ['admin', 'contributor', 'consumer'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const API_KEY_STATUSES = ['active', 'revoked'] as const;
export type ApiKeyStatus = (typeof API_KEY_STATUSES)[number];
