'use client';

import Link from 'next/link';
import { useState } from 'react';
import { CheckCircle2, MailCheck } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { useT } from '../../lib/i18n/context';
import { AuthShell } from '../../components/AuthShell';

export default function ForgotPasswordPage() {
  const t = useT();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch('/admin/v1/auth/password-reset/request', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.unknown'));
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <AuthShell title={t('forgot.sent.title')} subtitle={t('forgot.sent.sub')}>
        <div className="space-y-5">
          <div className="flex items-start gap-3 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            <MailCheck className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <div className="font-medium">{t('forgot.sent.heading')}</div>
              <div className="mt-1 text-xs">
                {t('forgot.sent.desc').replace('{email}', email)}
              </div>
            </div>
          </div>
          <Link
            href="/login"
            className="block w-full rounded-md border border-border px-4 py-2.5 text-center text-sm font-medium"
          >
            {t('forgot.backToLogin')}
          </Link>
          <p className="text-center text-xs text-muted-foreground">
            {t('forgot.sent.hint')}
          </p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={t('forgot.title')} subtitle={t('forgot.sub')}>
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block space-y-1 text-sm">
          <span className="text-xs font-medium">{t('login.email')}</span>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
            autoComplete="email"
            className="w-full rounded-md border border-border bg-background px-3 py-2 outline-none ring-primary/30 focus:ring-2"
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
          className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {submitting ? (
            t('forgot.sending')
          ) : (
            <span className="inline-flex items-center justify-center gap-2">
              <CheckCircle2 className="h-4 w-4" /> {t('forgot.submit')}
            </span>
          )}
        </button>

        <div className="text-center text-xs text-muted-foreground">
          <Link href="/login" className="text-primary hover:underline">
            {t('forgot.backToLogin')}
          </Link>
        </div>
      </form>
    </AuthShell>
  );
}
