'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { useT } from '../../lib/i18n/context';
import { AuthShell } from '../../components/AuthShell';
import { PasswordStrength, scoreStrength } from '../../components/PasswordStrength';

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<AuthShell title="Reset password">{null}</AuthShell>}>
      <ResetPasswordInner />
    </Suspense>
  );
}

function ResetPasswordInner() {
  const t = useT();
  const params = useSearchParams();
  const token = params.get('token');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!token) {
    return (
      <AuthShell title={t('reset.title')}>
        <div className="flex items-start gap-3 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <XCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <div className="font-medium">{t('reset.err.noToken')}</div>
            <div className="mt-1 text-xs">{t('reset.err.noTokenDesc')}</div>
          </div>
        </div>
        <Link
          href={'/forgot-password' as never}
          className="mt-4 block w-full rounded-md bg-primary px-4 py-2.5 text-center text-sm font-medium text-primary-foreground"
        >
          {t('reset.requestNew')}
        </Link>
      </AuthShell>
    );
  }

  const match = pw.length > 0 && pw === pw2;
  const strong = scoreStrength(pw) >= 2;
  const canSubmit = pw.length >= 8 && match && strong;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!match) return setError(t('register.err.mismatch'));
    if (!strong) return setError(t('register.err.weak'));
    setSubmitting(true);
    try {
      await apiFetch('/admin/v1/auth/password-reset/confirm', {
        method: 'POST',
        body: JSON.stringify({ token, password: pw }),
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.unknown'));
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <AuthShell title={t('reset.done.title')} subtitle={t('reset.done.sub')}>
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
            <div>{t('reset.done.msg')}</div>
          </div>
          <Link
            href="/login"
            className="block w-full rounded-md bg-primary px-4 py-2.5 text-center text-sm font-medium text-primary-foreground"
          >
            {t('reset.done.cta')}
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={t('reset.title')} subtitle={t('reset.sub')}>
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block space-y-1 text-sm">
          <span className="text-xs font-medium">{t('reset.newPassword')}</span>
          <input
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            className="w-full rounded-md border border-border bg-background px-3 py-2 outline-none ring-primary/30 focus:ring-2"
          />
          <PasswordStrength password={pw} />
        </label>

        <label className="block space-y-1 text-sm">
          <span className="text-xs font-medium">{t('register.passwordConfirm')}</span>
          <input
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
            type="password"
            autoComplete="new-password"
            required
            aria-invalid={pw2.length > 0 && !match}
            className={`w-full rounded-md border bg-background px-3 py-2 outline-none ring-primary/30 focus:ring-2 ${
              pw2.length > 0 && !match ? 'border-red-400' : 'border-border'
            }`}
          />
          {pw2.length > 0 && !match && (
            <p className="text-xs text-red-600">{t('register.err.mismatch')}</p>
          )}
        </label>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || !canSubmit}
          className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {submitting ? t('reset.submitting') : t('reset.submit')}
        </button>
      </form>
    </AuthShell>
  );
}
