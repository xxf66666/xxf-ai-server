'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { setBootstrapToken } from '../../lib/auth';

type Mode = 'password' | 'bootstrap';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('password');
  const [form, setForm] = useState({ email: '', password: '', token: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void apiFetch('/admin/v1/auth/me')
      .then(() => router.replace('/dashboard'))
      .catch(() => {});
  }, [router]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'password') {
        await apiFetch('/admin/v1/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email: form.email, password: form.password }),
        });
      } else {
        await apiFetch('/admin/v1/users', { token: form.token });
        setBootstrapToken(form.token);
      }
      router.replace('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'unknown error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="container flex min-h-screen items-center justify-center py-16">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 rounded-lg border border-border p-6 shadow-sm">
        <div>
          <h1 className="text-xl font-semibold">Sign in</h1>
          <p className="mt-1 text-xs text-muted-foreground">xxf-ai-server admin</p>
        </div>

        <div className="flex gap-1 rounded-md bg-muted p-1 text-xs">
          <button
            type="button"
            onClick={() => setMode('password')}
            className={`flex-1 rounded py-1 ${mode === 'password' ? 'bg-background shadow-sm' : ''}`}
          >
            Email + password
          </button>
          <button
            type="button"
            onClick={() => setMode('bootstrap')}
            className={`flex-1 rounded py-1 ${mode === 'bootstrap' ? 'bg-background shadow-sm' : ''}`}
          >
            Bootstrap token
          </button>
        </div>

        {mode === 'password' ? (
          <>
            <label className="block space-y-1 text-sm">
              <span className="text-xs font-medium">Email</span>
              <input
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                type="email"
                autoComplete="email"
                required
                className="w-full rounded-md border border-border bg-background px-3 py-2"
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="text-xs font-medium">Password</span>
              <input
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                type="password"
                autoComplete="current-password"
                required
                className="w-full rounded-md border border-border bg-background px-3 py-2"
              />
            </label>
          </>
        ) : (
          <label className="block space-y-1 text-sm">
            <span className="text-xs font-medium">Bootstrap token</span>
            <input
              value={form.token}
              onChange={(e) => setForm({ ...form, token: e.target.value })}
              type="password"
              required
              className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs"
              placeholder="ADMIN_BOOTSTRAP_TOKEN"
            />
            <p className="text-xs text-muted-foreground">
              Use only when no admin user exists yet — after bootstrap, prefer email/password.
            </p>
          </label>
        )}

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
