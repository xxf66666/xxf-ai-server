'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CheckCircle2, MailCheck } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { useT } from '../../lib/i18n/context';
import { AuthShell } from '../../components/AuthShell';
import { PasswordStrength, scoreStrength } from '../../components/PasswordStrength';

interface RegisterResponse {
  id: string;
  email: string;
  role: string;
  status: 'pending_verification' | 'active';
  verificationSent: boolean;
}

export default function RegisterPage() {
  const router = useRouter();
  const t = useT();
  const [form, setForm] = useState({
    email: '',
    password: '',
    passwordConfirm: '',
    inviteCode: '',
    agreeTerms: false,
    agreePrivacy: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<RegisterResponse | null>(null);
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent'>('idle');

  useEffect(() => {
    void apiFetch('/admin/v1/auth/me')
      .then(() => router.replace('/console/dashboard' as never))
      .catch(() => {});
  }, [router]);

  const pwMatch = form.password.length > 0 && form.password === form.passwordConfirm;
  const pwStrong = scoreStrength(form.password) >= 2;
  const canSubmit =
    !!form.email &&
    form.password.length >= 8 &&
    pwMatch &&
    pwStrong &&
    form.inviteCode.length >= 4 &&
    form.agreeTerms &&
    form.agreePrivacy;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!pwMatch) {
      setError(t('register.err.mismatch'));
      return;
    }
    if (!pwStrong) {
      setError(t('register.err.weak'));
      return;
    }
    if (!form.agreeTerms || !form.agreePrivacy) {
      setError(t('register.err.agree'));
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiFetch<RegisterResponse>('/admin/v1/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          inviteCode: form.inviteCode,
        }),
      });
      if (res.status === 'active') {
        // No email provider — server skipped verification, go sign in.
        router.replace('/login' as never);
        return;
      }
      setDone(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.unknown'));
    } finally {
      setSubmitting(false);
    }
  };

  const onResend = async () => {
    if (!done) return;
    setResendState('sending');
    try {
      await apiFetch('/admin/v1/auth/verify-email/request', {
        method: 'POST',
        body: JSON.stringify({ email: done.email }),
      });
      setResendState('sent');
    } catch {
      setResendState('idle');
    }
  };

  if (done) {
    return (
      <AuthShell title={t('register.done.title')} subtitle={t('register.done.sub')}>
        <div className="space-y-5">
          <div className="flex items-start gap-3 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            <MailCheck className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <div className="font-medium">
                {done.verificationSent
                  ? t('register.done.sentTitle')
                  : t('register.done.sendFailedTitle')}
              </div>
              <div className="mt-1 text-xs">
                {done.verificationSent
                  ? t('register.done.sentDesc').replace('{email}', done.email)
                  : t('register.done.sendFailedDesc')}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onResend}
            disabled={resendState !== 'idle'}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-border bg-background px-4 py-2.5 text-sm font-medium hover:bg-muted disabled:opacity-60"
          >
            {resendState === 'sent' ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                {t('register.done.resent')}
              </>
            ) : resendState === 'sending' ? (
              t('register.done.resending')
            ) : (
              t('register.done.resend')
            )}
          </button>

          <Link
            href="/login"
            className="block w-full rounded-md bg-primary px-4 py-2.5 text-center text-sm font-medium text-primary-foreground"
          >
            {t('register.done.goLogin')}
          </Link>

          <p className="text-center text-xs text-muted-foreground">
            {t('register.done.hint')}
          </p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={t('register.title')} subtitle={t('register.subtitle')}>
      <form onSubmit={onSubmit} className="space-y-4">
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
            autoComplete="new-password"
            minLength={8}
            required
            className="w-full rounded-md border border-border bg-background px-3 py-2 outline-none ring-primary/30 focus:ring-2"
          />
          <PasswordStrength password={form.password} />
        </label>

        <label className="block space-y-1 text-sm">
          <span className="text-xs font-medium">{t('register.passwordConfirm')}</span>
          <input
            value={form.passwordConfirm}
            onChange={(e) => setForm({ ...form, passwordConfirm: e.target.value })}
            type="password"
            autoComplete="new-password"
            required
            aria-invalid={form.passwordConfirm.length > 0 && !pwMatch}
            className={`w-full rounded-md border bg-background px-3 py-2 outline-none ring-primary/30 focus:ring-2 ${
              form.passwordConfirm.length > 0 && !pwMatch ? 'border-red-400' : 'border-border'
            }`}
          />
          {form.passwordConfirm.length > 0 && !pwMatch && (
            <p className="text-xs text-red-600">{t('register.err.mismatch')}</p>
          )}
        </label>

        <label className="block space-y-1 text-sm">
          <span className="text-xs font-medium">{t('register.inviteCode')}</span>
          <input
            value={form.inviteCode}
            onChange={(e) => setForm({ ...form, inviteCode: e.target.value.trim() })}
            type="text"
            required
            minLength={4}
            className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs outline-none ring-primary/30 focus:ring-2"
            placeholder="XXFAI-XXXXXXXX"
          />
          <p className="text-xs text-muted-foreground">{t('register.inviteCode.hint')}</p>
        </label>

        <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3 text-xs">
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={form.agreeTerms}
              onChange={(e) => setForm({ ...form, agreeTerms: e.target.checked })}
              className="mt-0.5"
              required
            />
            <span>
              {t('register.agree.terms.pre')}{' '}
              <Link
                href={'/terms' as never}
                target="_blank"
                className="text-primary hover:underline"
              >
                {t('footer.terms')}
              </Link>
            </span>
          </label>
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={form.agreePrivacy}
              onChange={(e) => setForm({ ...form, agreePrivacy: e.target.checked })}
              className="mt-0.5"
              required
            />
            <span>
              {t('register.agree.privacy.pre')}{' '}
              <Link
                href={'/privacy' as never}
                target="_blank"
                className="text-primary hover:underline"
              >
                {t('footer.privacy')}
              </Link>
            </span>
          </label>
        </div>

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
          {submitting ? t('register.submitting') : t('register.submit')}
        </button>

        <div className="text-center text-xs text-muted-foreground">
          {t('register.haveAccount')}{' '}
          <Link href="/login" className="text-primary hover:underline">
            {t('register.signin')}
          </Link>
        </div>
      </form>
    </AuthShell>
  );
}
