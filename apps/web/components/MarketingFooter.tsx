'use client';

import Link from 'next/link';
import { useT } from '../lib/i18n/context';

export function MarketingFooter() {
  const t = useT();
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-border bg-muted/20">
      <div className="container mx-auto grid max-w-6xl gap-8 py-10 sm:grid-cols-2 md:grid-cols-4">
        <div>
          <div className="mb-2 text-sm font-semibold">xxf-ai-server</div>
          <p className="text-xs text-muted-foreground">{t('home.tagline')}</p>
        </div>
        <div>
          <div className="mb-2 text-xs font-medium uppercase text-muted-foreground">
            {t('footer.product')}
          </div>
          <ul className="space-y-1 text-sm">
            <li><Link href={'/pricing' as never} className="text-muted-foreground hover:text-foreground">{t('nav.pricing')}</Link></li>
            <li><Link href={'/docs' as never} className="text-muted-foreground hover:text-foreground">{t('nav.docs')}</Link></li>
          </ul>
        </div>
        <div>
          <div className="mb-2 text-xs font-medium uppercase text-muted-foreground">
            {t('footer.legal')}
          </div>
          <ul className="space-y-1 text-sm">
            <li><Link href={'/terms' as never} className="text-muted-foreground hover:text-foreground">{t('footer.terms')}</Link></li>
            <li><Link href={'/privacy' as never} className="text-muted-foreground hover:text-foreground">{t('footer.privacy')}</Link></li>
          </ul>
        </div>
        <div>
          <div className="mb-2 text-xs font-medium uppercase text-muted-foreground">
            {t('footer.account')}
          </div>
          <ul className="space-y-1 text-sm">
            <li><Link href="/login" className="text-muted-foreground hover:text-foreground">{t('home.signin')}</Link></li>
            <li><Link href={'/register' as never} className="text-muted-foreground hover:text-foreground">{t('register.submit')}</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border py-4">
        <div className="container mx-auto max-w-6xl text-xs text-muted-foreground">
          © {year} xxf-ai-server · {t('footer.disclaimer')}
        </div>
      </div>
    </footer>
  );
}
