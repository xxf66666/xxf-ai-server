'use client';

import Link from 'next/link';
import { Building2, FileText, Lock, Mail, Shield, Users } from 'lucide-react';
import { Instrument_Serif } from 'next/font/google';
import { useT } from '../../lib/i18n/context';
import { MarketingHeader } from '../../components/MarketingHeader';
import { MarketingFooter } from '../../components/MarketingFooter';

const headlineSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  style: 'italic',
  display: 'swap',
});

const CONTACT_EMAIL = 'sales@xxflk.cn';

export default function EnterprisePage() {
  const t = useT();

  const offerings = [
    {
      icon: Users,
      title: t('ent.offer.team.title'),
      desc: t('ent.offer.team.desc'),
    },
    {
      icon: Lock,
      title: t('ent.offer.privacy.title'),
      desc: t('ent.offer.privacy.desc'),
    },
    {
      icon: Shield,
      title: t('ent.offer.sla.title'),
      desc: t('ent.offer.sla.desc'),
    },
    {
      icon: FileText,
      title: t('ent.offer.invoice.title'),
      desc: t('ent.offer.invoice.desc'),
    },
  ];

  return (
    <main className="min-h-screen bg-background">
      <MarketingHeader />

      {/* Hero */}
      <section className="container mx-auto max-w-4xl px-4 py-20 text-center">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1 text-xs">
          <Building2 className="h-3.5 w-3.5" />
          {t('ent.hero.badge')}
        </div>
        <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
          <span className={`${headlineSerif.className} text-primary`}>{t('ent.hero.title.lead')}</span>{' '}
          {t('ent.hero.title.tail')}
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground md:text-lg">
          {t('ent.hero.pitch')}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <a
            href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Nexa enterprise inquiry')}`}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-medium text-primary-foreground hover:shadow-md"
          >
            <Mail className="h-4 w-4" />
            {t('ent.hero.cta.email')} {CONTACT_EMAIL}
          </a>
          <Link
            href={'/pricing' as never}
            className="rounded-md border border-border bg-background px-5 py-3 text-sm font-medium hover:bg-muted"
          >
            {t('ent.hero.cta.pricing')}
          </Link>
        </div>
      </section>

      {/* Offerings */}
      <section className="border-t border-border bg-muted/20">
        <div className="container mx-auto max-w-5xl px-4 py-16">
          <h2 className="text-center text-2xl font-semibold tracking-tight md:text-3xl">
            {t('ent.offerings.heading')}
          </h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {offerings.map((o) => {
              const Icon = o.icon;
              return (
                <div key={o.title} className="rounded-xl border border-border bg-background p-5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-3 text-sm font-semibold">{o.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{o.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Compliance / what we do not do */}
      <section className="border-t border-border">
        <div className="container mx-auto max-w-3xl px-4 py-16">
          <h2 className="text-2xl font-semibold tracking-tight">
            {t('ent.honest.heading')}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">{t('ent.honest.intro')}</p>
          <ul className="mt-6 space-y-3 text-sm">
            <li className="rounded-lg border border-border bg-muted/20 p-4">
              <div className="font-semibold">{t('ent.honest.deploy.title')}</div>
              <div className="mt-1 text-xs text-muted-foreground">{t('ent.honest.deploy.body')}</div>
            </li>
            <li className="rounded-lg border border-border bg-muted/20 p-4">
              <div className="font-semibold">{t('ent.honest.audit.title')}</div>
              <div className="mt-1 text-xs text-muted-foreground">{t('ent.honest.audit.body')}</div>
            </li>
            <li className="rounded-lg border border-border bg-muted/20 p-4">
              <div className="font-semibold">{t('ent.honest.iso.title')}</div>
              <div className="mt-1 text-xs text-muted-foreground">{t('ent.honest.iso.body')}</div>
            </li>
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border bg-muted/20">
        <div className="container mx-auto max-w-3xl px-4 py-16 text-center">
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
            {t('ent.cta.heading')}
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">{t('ent.cta.sub')}</p>
          <a
            href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Nexa enterprise inquiry')}&body=${encodeURIComponent('Team size:\nMonthly token volume:\nPreferred deployment:\nQuestions:\n')}`}
            className="mt-6 inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:shadow-md"
          >
            <Mail className="h-4 w-4" />
            {t('ent.cta.button')}
          </a>
        </div>
      </section>

      <MarketingFooter />
    </main>
  );
}
