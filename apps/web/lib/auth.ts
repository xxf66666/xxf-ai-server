// Session state for the admin UI. Two auth paths:
//   1. Email + password login sets an httpOnly JWT cookie (preferred).
//   2. Bootstrap token in localStorage (legacy; useful when no user exists
//      yet). Gets sent as X-Admin-Token on every request.

const STORAGE_KEY = 'xxf-admin-bootstrap-token';

export function getBootstrapToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

export function setBootstrapToken(token: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, token);
}

export function clearBootstrapToken(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
}

// Kept for backward-compat with pages that still import the old names.
export const getAdminToken = getBootstrapToken;
export const setAdminToken = setBootstrapToken;
export const clearAdminToken = clearBootstrapToken;
