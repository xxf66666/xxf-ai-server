'use client';

import Link from 'next/link';
import { useT } from '../lib/i18n/context';
import { LocaleSwitcher } from '../lib/i18n/LocaleSwitcher';

export function MarketingHeader({ active }: { active?: 'pricing' | 'docs' | null }) {
  const t = useT();
  const cls = (k: string) =>
    `text-sm hover:text-foreground ${active === k ? 'text-primary font-medium' : 'text-muted-foreground'}`;
  return (
    <header className="border-b border-border bg-background/60 backdrop-blur">
      <div className="container mx-auto flex max-w-6xl items-center justify-between py-4">
        <Link href="/" className="flex items-center gap-2 text-sm font-semibold">
          <span className="rounded bg-primary px-1.5 py-0.5 text-xs text-primary-foreground">xxf</span>
          <span>ai-server</span>
        </Link>
        <nav className="flex items-center gap-5">
          <Link href={'/pricing' as never} className={cls('pricing')}>
            {t('nav.pricing')}
          </Link>
          <Link href={'/docs' as never} className={cls('docs')}>
            {t('nav.docs')}
          </Link>
          <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground">
            {t('home.signin')}
          </Link>
          <Link
            href={'/register' as never}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
          >
            {t('register.submit')}
          </Link>
          <LocaleSwitcher />
        </nav>
      </div>
    </header>
  );
}
