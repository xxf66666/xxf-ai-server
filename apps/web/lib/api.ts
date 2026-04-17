import { getAdminToken } from './auth';

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
  const token = init.token ?? getAdminToken();
  const headers = new Headers(init.headers ?? {});
  if (token) headers.set('X-Admin-Token', token);
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');

  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers });
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
