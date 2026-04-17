'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { getAdminToken, setAdminToken } from '../../lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (getAdminToken()) router.replace('/dashboard');
  }, [router]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      // Validate the token by making an authenticated admin call.
      await apiFetch('/admin/v1/users', { token });
      setAdminToken(token);
      router.replace('/dashboard');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown error';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="container flex min-h-screen items-center justify-center py-16">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-4 rounded-lg border border-border p-6 shadow-sm"
      >
        <div>
          <h1 className="text-xl font-semibold">Sign in</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Paste the <code>ADMIN_BOOTSTRAP_TOKEN</code> configured on the server.
          </p>
        </div>
        <div className="space-y-2">
          <label htmlFor="token" className="text-sm font-medium">
            Admin token
          </label>
          <input
            id="token"
            name="token"
            type="password"
            autoComplete="off"
            required
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm"
            placeholder="xxxxxxxxxxxxxxxx"
          />
        </div>
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {submitting ? 'verifying…' : 'Sign in'}
        </button>
      </form>
    </main>
  );
}
