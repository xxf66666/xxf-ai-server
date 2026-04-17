// Client-side storage of the admin bootstrap token. NOT secure auth —
// a placeholder until proper argon2 + JWT login lands.

const STORAGE_KEY = 'xxf-admin-token';

export function getAdminToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

export function setAdminToken(token: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, token);
}

export function clearAdminToken(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
}
