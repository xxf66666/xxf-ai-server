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

const DEFAULT_TIMEOUT_MS = 30_000;

export async function apiFetch<T = unknown>(
  path: string,
  init: RequestInit & { token?: string | null; timeoutMs?: number } = {},
): Promise<T> {
  // Prefer JWT cookie (credentials: 'include'); also attach bootstrap token
  // if one is stored, for first-run / emergency access.
  const bootstrap = init.token ?? getBootstrapToken();
  const headers = new Headers(init.headers ?? {});
  if (bootstrap) headers.set('X-Admin-Token', bootstrap);
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');

  // Timeout via AbortController so a hung server / network stall doesn't
  // leave the UI spinning forever. If the caller already passed a signal,
  // chain ours after it so either can cancel.
  const { timeoutMs = DEFAULT_TIMEOUT_MS, signal: callerSignal, ...rest } = init;
  const controller = new AbortController();
  const onCallerAbort = () => controller.abort(callerSignal?.reason);
  callerSignal?.addEventListener('abort', onCallerAbort, { once: true });
  const timeoutHandle = setTimeout(() => controller.abort(new Error('request timeout')), timeoutMs);

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...rest,
      headers,
      credentials: 'include',
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ApiError(0, `request timeout after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutHandle);
    callerSignal?.removeEventListener('abort', onCallerAbort);
  }

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
