'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { AuthShell } from '../../components/AuthShell';
import { useT } from '../../lib/i18n/context';

type State = 'loading' | 'ok' | 'fail';

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<AuthShell title="Verify your email">{null}</AuthShell>}>
      <VerifyEmailInner />
    </Suspense>
  );
}

function VerifyEmailInner() {
  const params = useSearchParams();
  const token = params.get('token');
  const t = useT();
  const [state, setState] = useState<State>('loading');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!token) {
      setState('fail');
      setError(t('verify.err.noToken'));
      return;
    }
    void apiFetch('/admin/v1/auth/verify-email/confirm', {
      method: 'POST',
      body: JSON.stringify({ token }),
    })
      .then(() => setState('ok'))
      .catch((err) => {
        setState('fail');
        setError(err instanceof Error ? err.message : t('common.unknown'));
      });
  }, [token, t]);

  return (
    <AuthShell
      title={state === 'ok' ? t('verify.ok.title') : t('verify.title')}
      subtitle={state === 'ok' ? t('verify.ok.sub') : undefined}
    >
      {state === 'loading' && (
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          {t('verify.loading')}
        </div>
      )}
      {state === 'ok' && (
        <div className="space-y-4 text-sm">
          <div className="flex items-start gap-3 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
            <div>{t('verify.ok.msg')}</div>
          </div>
          <Link
            href="/login"
            className="block w-full rounded-md bg-primary px-4 py-2.5 text-center text-sm font-medium text-primary-foreground"
          >
            {t('verify.ok.cta')}
          </Link>
        </div>
      )}
      {state === 'fail' && (
        <div className="space-y-4 text-sm">
          <div className="flex items-start gap-3 rounded-md border border-red-200 bg-red-50 p-4 text-red-800">
            <XCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>{error || t('verify.err.generic')}</div>
          </div>
          <Link
            href="/login"
            className="block w-full rounded-md border border-border px-4 py-2.5 text-center text-sm font-medium"
          >
            {t('home.signin')}
          </Link>
        </div>
      )}
    </AuthShell>
  );
}
