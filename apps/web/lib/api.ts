import { getBootstrapToken } from './auth';

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8787');

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
  ) {
    super(message);
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  init: RequestInit & { token?: string | null } = {},
): Promise<T> {
  // Prefer JWT cookie (credentials: 'include'); also attach bootstrap token
  // if one is stored, for first-run / emergency access.
  const bootstrap = init.token ?? getBootstrapToken();
  const headers = new Headers(init.headers ?? {});
  if (bootstrap) headers.set('X-Admin-Token', bootstrap);
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');

  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });
  const text = await res.text();
  const json = text ? safeJson(text) : null;
  if (!res.ok) {
    const message =
      (json as { error?: { message?: string } } | null)?.error?.message ??
      `HTTP ${res.status}`;
    throw new ApiError(res.status, message, json ?? text);
  }
  return json as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
