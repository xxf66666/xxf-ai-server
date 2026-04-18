'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AlertCircle, MailWarning } from 'lucide-react';
import { ApiError, apiFetch } from '../../lib/api';
import { setBootstrapToken } from '../../lib/auth';
import { useT } from '../../lib/i18n/context';
import { AuthShell } from '../../components/AuthShell';

type Mode = 'password' | 'bootstrap';

interface Me {
  sub: string;
  email: string;
  role: 'admin' | 'contributor' | 'consumer';
}

type ApiBody = { error?: { type?: string; message?: string; email?: string } };

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
  const [pending, setPending] = useState<{ email: string } | null>(null);
  const [suspended, setSuspended] = useState(false);
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent'>('idle');

  useEffect(() => {
    void apiFetch<Me>('/admin/v1/auth/me')
      .then((me) => router.replace(landingFor(me.role) as never))
      .catch(() => {});
  }, [router]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPending(null);
    setSuspended(false);
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
      if (err instanceof ApiError) {
        const body = err.body as ApiBody | null;
        const etype = body?.error?.type;
        if (etype === 'email_not_verified') {
          setPending({ email: body?.error?.email ?? form.email });
          setResendState('idle');
          return;
        }
        if (etype === 'account_suspended') {
          setSuspended(true);
          return;
        }
      }
      setError(err instanceof Error ? err.message : t('common.unknown'));
    } finally {
      setSubmitting(false);
    }
  };

  const onResendVerify = async () => {
    if (!pending) return;
    setResendState('sending');
    try {
      await apiFetch('/admin/v1/auth/verify-email/request', {
        method: 'POST',
        body: JSON.stringify({ email: pending.email }),
      });
      setResendState('sent');
    } catch {
      setResendState('idle');
    }
  };

  return (
    <AuthShell title={t('login.title')} subtitle={t('login.subtitle')}>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="flex gap-1 rounded-md bg-muted p-1 text-xs">
          <button
            type="button"
            onClick={() => setMode('password')}
            className={`flex-1 rounded py-1.5 ${mode === 'password' ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground'}`}
          >
            {t('login.tab.password')}
          </button>
          <button
            type="button"
            onClick={() => setMode('bootstrap')}
            className={`flex-1 rounded py-1.5 ${mode === 'bootstrap' ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground'}`}
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
                className="w-full rounded-md border border-border bg-background px-3 py-2 outline-none ring-primary/30 focus:ring-2"
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
                className="w-full rounded-md border border-border bg-background px-3 py-2 outline-none ring-primary/30 focus:ring-2"
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
              className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs outline-none ring-primary/30 focus:ring-2"
              placeholder="ADMIN_BOOTSTRAP_TOKEN"
            />
            <p className="text-xs text-muted-foreground">{t('login.token.hint')}</p>
          </label>
        )}

        {pending && (
          <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
            <div className="flex items-start gap-2">
              <MailWarning className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <div className="font-medium">{t('login.pending.title')}</div>
                <div className="mt-1">
                  {t('login.pending.desc').replace('{email}', pending.email)}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onResendVerify}
              disabled={resendState !== 'idle'}
              className="w-full rounded-md border border-amber-300 bg-background px-3 py-1.5 font-medium hover:bg-amber-100 disabled:opacity-60"
            >
              {resendState === 'sent'
                ? t('login.pending.resent')
                : resendState === 'sending'
                ? t('login.pending.sending')
                : t('login.pending.resend')}
            </button>
          </div>
        )}

        {suspended && (
          <div className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 p-3 text-xs text-red-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="font-medium">{t('login.suspended.title')}</div>
              <div className="mt-1">{t('login.suspended.desc')}</div>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
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
    </AuthShell>
  );
}
