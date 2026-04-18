'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Cpu, Gauge, Receipt, Tag } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useT } from '../lib/i18n/context';
import { FollowingEyes } from '../components/FollowingEyes';
import { MarketingHeader } from '../components/MarketingHeader';
import { MarketingFooter } from '../components/MarketingFooter';
import { ProviderIcon } from '../components/ProviderIcon';

interface PricingRow {
  modelId: string;
  provider: string;
  tier: string | null;
  officialInputUsdPerM: number;
  officialOutputUsdPerM: number;
  ourInputUsdPerM: number;
  ourOutputUsdPerM: number;
}
interface PricingResponse {
  markupRate: number;
  usdToCnyRate: number;
  data: PricingRow[];
}

const fmtUsd = (n: number) => (n < 0.01 ? '$' + n.toFixed(4) : '$' + n.toFixed(2));

export default function HomePage() {
  const t = useT();
  const { data: pricing } = useQuery({
    queryKey: ['public', 'pricing'],
    queryFn: () => apiFetch<PricingResponse>('/v1/pricing'),
  });

  const savingsPct = pricing ? Math.round((1 - pricing.markupRate) * 100) : 15;

  const features = [
    { icon: Tag, title: t('home.feat.cheap.title'), desc: t('home.feat.cheap.desc') },
    { icon: Cpu, title: t('home.feat.compat.title'), desc: t('home.feat.compat.desc') },
    { icon: Gauge, title: t('home.feat.fast.title'), desc: t('home.feat.fast.desc') },
    { icon: Receipt, title: t('home.feat.transparent.title'), desc: t('home.feat.transparent.desc') },
  ];

  return (
    <main className="min-h-screen bg-background">
      <MarketingHeader />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="container mx-auto max-w-6xl px-4 py-20 md:py-28">
          <div className="grid items-center gap-12 md:grid-cols-[1.2fr,1fr]">
            <div>
              <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
                {t('home.hero.tagline')}
              </h1>
              <p className="mt-6 max-w-xl text-base text-muted-foreground md:text-lg">
                {t('home.hero.pitch')}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href={'/register' as never}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-medium text-primary-foreground hover:opacity-90"
                >
                  {t('home.hero.primary')}
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href={'/pricing' as never}
                  className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-5 py-3 text-sm font-medium hover:bg-muted"
                >
                  {t('home.hero.secondary')}
                </Link>
              </div>
            </div>
            <div className="flex flex-col items-center gap-4">
              <FollowingEyes size={130} />
              <p className="max-w-xs text-center text-xs text-muted-foreground">
                {t('home.hero.eye.caption')}
              </p>
            </div>
          </div>
        </div>
        {/* background swirls */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-20 h-96 bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.15),transparent_60%)]"
        />
      </section>

      {/* Features */}
      <section className="border-t border-border bg-muted/20">
        <div className="container mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-center text-2xl font-semibold tracking-tight md:text-3xl">
            {t('home.feat.title')}
          </h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className="rounded-lg border border-border bg-background p-5 transition-shadow hover:shadow-md"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-3 text-sm font-semibold">{f.title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Models */}
      <section className="border-t border-border">
        <div className="container mx-auto max-w-6xl px-4 py-16">
          <div className="flex flex-col items-center text-center">
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
              {t('home.models.title')}
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{t('home.models.sub')}</p>
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(pricing?.data ?? []).map((m) => (
              <div
                key={m.modelId}
                className="relative rounded-lg border border-border bg-background p-4"
              >
                <div className="flex items-center gap-2">
                  <ProviderIcon provider={m.provider} size={22} />
                  <code className="truncate font-mono text-xs">{m.modelId}</code>
                </div>
                <div className="mt-3 flex items-end justify-between">
                  <div className="text-xs">
                    <div className="text-muted-foreground">
                      {t('pricing.input')}
                      <span className="ml-1 text-muted-foreground line-through">
                        {fmtUsd(m.officialInputUsdPerM)}
                      </span>
                    </div>
                    <div className="font-mono font-semibold text-foreground">
                      {fmtUsd(m.ourInputUsdPerM)}
                    </div>
                  </div>
                  <div className="text-right text-xs">
                    <div className="text-muted-foreground">
                      {t('pricing.output')}
                      <span className="ml-1 text-muted-foreground line-through">
                        {fmtUsd(m.officialOutputUsdPerM)}
                      </span>
                    </div>
                    <div className="font-mono font-semibold text-foreground">
                      {fmtUsd(m.ourOutputUsdPerM)}
                    </div>
                  </div>
                </div>
                <div className="absolute right-2 top-2 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                  {t('pricing.savings', { pct: savingsPct })}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 text-center">
            <Link
              href={'/pricing' as never}
              className="text-sm text-primary hover:underline"
            >
              {t('home.hero.secondary')} →
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border bg-gradient-to-b from-muted/20 to-background">
        <div className="container mx-auto max-w-3xl px-4 py-16 text-center">
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
            {t('home.cta.title')}
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">{t('home.cta.sub')}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href={'/register' as never}
              className="rounded-md bg-primary px-5 py-3 text-sm font-medium text-primary-foreground"
            >
              {t('home.cta.primary')}
            </Link>
            <Link
              href="/login"
              className="rounded-md border border-border px-5 py-3 text-sm font-medium hover:bg-muted"
            >
              {t('home.cta.secondary')}
            </Link>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </main>
  );
}
