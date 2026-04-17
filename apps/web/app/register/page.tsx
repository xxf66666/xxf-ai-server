'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { useT } from '../../lib/i18n/context';
import { LocaleSwitcher } from '../../lib/i18n/LocaleSwitcher';

export default function RegisterPage() {
  const router = useRouter();
  const t = useT();
  const [form, setForm] = useState({ email: '', password: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void apiFetch('/admin/v1/auth/me')
      .then(() => router.replace('/console/dashboard' as never))
      .catch(() => {});
  }, [router]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch('/admin/v1/auth/register', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      router.replace('/console/dashboard' as never);
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
          <h1 className="text-xl font-semibold">{t('register.title')}</h1>
          <p className="mt-1 text-xs text-muted-foreground">{t('register.subtitle')}</p>
        </div>

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
            autoComplete="new-password"
            minLength={8}
            required
            className="w-full rounded-md border border-border bg-background px-3 py-2"
          />
        </label>

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
          {submitting ? t('register.submitting') : t('register.submit')}
        </button>

        <div className="text-center text-xs text-muted-foreground">
          {t('register.haveAccount')}{' '}
          <Link href="/login" className="text-primary hover:underline">
            {t('register.signin')}
          </Link>
        </div>
      </form>
    </main>
  );
}
