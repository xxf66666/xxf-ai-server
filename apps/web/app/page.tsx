'use client';

import Link from 'next/link';
import { useT } from '../lib/i18n/context';
import { LocaleSwitcher } from '../lib/i18n/LocaleSwitcher';

export default function HomePage() {
  const t = useT();
  return (
    <main className="container flex min-h-screen flex-col items-center justify-center gap-6 py-16">
      <div className="absolute right-4 top-4">
        <LocaleSwitcher />
      </div>
      <div className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight">xxf-ai-server</h1>
        <p className="mt-2 text-muted-foreground">{t('home.tagline')}</p>
      </div>
      <div className="flex gap-3">
        <Link
          href="/login"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          {t('home.signin')}
        </Link>
        <Link
          href={'/register' as never}
          className="rounded-md border border-border px-4 py-2 text-sm font-medium"
        >
          {t('register.submit')}
        </Link>
      </div>
    </main>
  );
}
