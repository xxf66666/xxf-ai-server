'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { setBootstrapToken } from '../../lib/auth';
import { useT } from '../../lib/i18n/context';
import { LocaleSwitcher } from '../../lib/i18n/LocaleSwitcher';

type Mode = 'password' | 'bootstrap';

interface Me {
  sub: string;
  email: string;
  role: 'admin' | 'contributor' | 'consumer';
}

function landingFor(role: Me['role']): string {
  return role === 'consumer' ? '/console/dashboard' : '/dashboard';
}

export default function LoginPage() {
  const router = useRouter();
  const t = useT();
  const [mode, setMode] = useState<Mode>('password');
  const [form, setForm] = useState({ email: '', password: '', token: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void apiFetch<Me>('/admin/v1/auth/me')
      .then((me) => router.replace(landingFor(me.role) as never))
      .catch(() => {});
  }, [router]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      let role: Me['role'] = 'consumer';
      if (mode === 'password') {
        const res = await apiFetch<{ role: Me['role'] }>('/admin/v1/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email: form.email, password: form.password }),
        });
        role = res.role;
      } else {
        await apiFetch('/admin/v1/users', { token: form.token });
        setBootstrapToken(form.token);
        role = 'admin';
      }
      router.replace(landingFor(role) as never);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.unknown'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="container flex min-h-screen items-center justify-center py-16">
      <div className="absolute right-4 top-4">
        <LocaleSwitcher />
      </div>
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 rounded-lg border border-border p-6 shadow-sm">
        <div>
          <h1 className="text-xl font-semibold">{t('login.title')}</h1>
          <p className="mt-1 text-xs text-muted-foreground">{t('login.subtitle')}</p>
        </div>

        <div className="flex gap-1 rounded-md bg-muted p-1 text-xs">
          <button
            type="button"
            onClick={() => setMode('password')}
            className={`flex-1 rounded py-1 ${mode === 'password' ? 'bg-background shadow-sm' : ''}`}
          >
            {t('login.tab.password')}
          </button>
          <button
            type="button"
            onClick={() => setMode('bootstrap')}
            className={`flex-1 rounded py-1 ${mode === 'bootstrap' ? 'bg-background shadow-sm' : ''}`}
          >
            {t('login.tab.bootstrap')}
          </button>
        </div>

        {mode === 'password' ? (
          <>
            <label className="block space-y-1 text-sm">
              <span className="text-xs font-medium">{t('login.email')}</span>
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
              <span className="text-xs font-medium">{t('login.password')}</span>
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
            <span className="text-xs font-medium">{t('login.token')}</span>
            <input
              value={form.token}
              onChange={(e) => setForm({ ...form, token: e.target.value })}
              type="password"
              required
              className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs"
              placeholder="ADMIN_BOOTSTRAP_TOKEN"
            />
            <p className="text-xs text-muted-foreground">{t('login.token.hint')}</p>
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
          {submitting ? t('login.verifying') : t('login.submit')}
        </button>

        {mode === 'password' && (
          <div className="text-center text-xs text-muted-foreground">
            {t('login.noAccount')}{' '}
            <Link href={'/register' as never} className="text-primary hover:underline">
              {t('login.register')}
            </Link>
          </div>
        )}
      </form>
    </main>
  );
}
