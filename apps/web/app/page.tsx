'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Cpu, Gauge, Receipt, Tag, Sparkles } from 'lucide-react';
import { Instrument_Serif } from 'next/font/google';
import { apiFetch } from '../lib/api';
import { useT } from '../lib/i18n/context';
import { FollowingEyes } from '../components/FollowingEyes';
import { MarketingHeader } from '../components/MarketingHeader';
import { MarketingFooter } from '../components/MarketingFooter';
import { ProviderIcon } from '../components/ProviderIcon';

const headlineSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  style: 'italic',
  display: 'swap',
});

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
  const modelCount = pricing?.data.length ?? 8;

  const features = [
    {
      icon: Tag,
      title: t('home.feat.cheap.title'),
      desc: t('home.feat.cheap.desc'),
      tone: 'from-emerald-500/20 to-teal-500/10 text-emerald-700',
    },
    {
      icon: Cpu,
      title: t('home.feat.compat.title'),
      desc: t('home.feat.compat.desc'),
      tone: 'from-indigo-500/20 to-violet-500/10 text-indigo-700',
    },
    {
      icon: Gauge,
      title: t('home.feat.fast.title'),
      desc: t('home.feat.fast.desc'),
      tone: 'from-amber-500/20 to-orange-500/10 text-amber-700',
    },
    {
      icon: Receipt,
      title: t('home.feat.transparent.title'),
      desc: t('home.feat.transparent.desc'),
      tone: 'from-pink-500/20 to-rose-500/10 text-pink-700',
    },
  ];

  return (
    <main className="min-h-screen bg-background">
      <MarketingHeader />

      {/* Hero */}
      <section className="relative overflow-hidden">
        {/* Background blobs */}
        <div
          aria-hidden
          className="pointer-events-none absolute -left-32 -top-32 h-[32rem] w-[32rem] rounded-full bg-gradient-to-br from-indigo-400/20 via-violet-400/15 to-transparent blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 top-20 h-[28rem] w-[28rem] rounded-full bg-gradient-to-tl from-pink-400/15 via-rose-300/10 to-transparent blur-3xl"
        />

        <div className="container relative mx-auto max-w-6xl px-4 py-20 md:py-28">
          <div className="grid items-center gap-12 md:grid-cols-[1.25fr,1fr]">
            <div className="animate-[fadeUp_0.6s_ease-out]">
              {/* Live-dot mini badge */}
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1 text-xs backdrop-blur">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                <span className="text-muted-foreground">
                  {t('home.hero.badge').replace('{pct}', String(savingsPct))}
                </span>
              </div>

              <h1 className="text-4xl font-semibold tracking-tight md:text-6xl">
                <span className={`${headlineSerif.className} text-primary`}>Nexa</span>{' '}
                <span>—</span>
                <br />
                {t('home.hero.tagline')}
              </h1>
              <p className="mt-6 max-w-xl text-base text-muted-foreground md:text-lg">
                {t('home.hero.pitch')}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href={'/register' as never}
                  className="group inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5"
                >
                  {t('home.hero.primary')}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
                <Link
                  href={'/pricing' as never}
                  className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-5 py-3 text-sm font-medium hover:bg-muted"
                >
                  {t('home.hero.secondary')}
                </Link>
              </div>
            </div>
            <div className="flex flex-col items-center gap-4 animate-[fadeUp_0.7s_ease-out]">
              <FollowingEyes size={140} />
              <p className="max-w-xs text-center text-xs italic text-muted-foreground">
                {t('home.hero.eye.caption')}
              </p>
            </div>
          </div>

          {/* Stats strip */}
          <div className="mt-16 grid grid-cols-2 gap-4 border-t border-border pt-8 text-center md:grid-cols-4">
            <Stat big={`${modelCount}`} small={t('home.stats.models')} />
            <Stat big={`-${savingsPct}%`} small={t('home.stats.discount')} accent="text-emerald-700" />
            <Stat big="$5" small={t('home.stats.welcome')} />
            <Stat big="<100ms" small={t('home.stats.latency')} />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-border bg-gradient-to-b from-muted/30 via-background to-background">
        <div className="container mx-auto max-w-6xl px-4 py-20">
          <div className="mx-auto max-w-xl text-center">
            <Sparkles className="mx-auto mb-3 h-5 w-5 text-primary" />
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
              {t('home.feat.title')}
            </h2>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f, idx) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className="group relative overflow-hidden rounded-xl border border-border bg-background p-6 transition-all hover:-translate-y-1 hover:shadow-lg"
                  style={{ animation: `fadeUp 0.6s ease-out ${0.1 + idx * 0.08}s backwards` }}
                >
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${f.tone}`}
                  >
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-4 text-sm font-semibold">{f.title}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                    {f.desc}
                  </p>
                  {/* subtle hover bloom */}
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 -z-10 opacity-0 transition-opacity group-hover:opacity-100"
                    style={{
                      background:
                        'radial-gradient(ellipse at top, rgba(99,102,241,0.08), transparent 70%)',
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Models */}
      <section className="border-t border-border">
        <div className="container mx-auto max-w-6xl px-4 py-20">
          <div className="flex flex-col items-center text-center">
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
              {t('home.models.title')}
            </h2>
            <p className="mt-3 max-w-2xl text-sm text-muted-foreground">{t('home.models.sub')}</p>
          </div>
          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(pricing?.data ?? []).map((m) => (
              <div
                key={m.modelId}
                className="group relative rounded-xl border border-border bg-background p-4 transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-center gap-2">
                  <ProviderIcon provider={m.provider} size={22} />
                  <code className="truncate font-mono text-xs font-medium">{m.modelId}</code>
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
                      <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                        {t('pricing.unit')}
                      </span>
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
                      <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                        {t('pricing.unit')}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="absolute right-2 top-2 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                  {t('pricing.savings', { pct: savingsPct })}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link
              href={'/pricing' as never}
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              {t('home.hero.secondary')} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border">
        <div className="container mx-auto max-w-5xl px-4 py-20">
          <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-indigo-500/10 via-violet-500/10 to-pink-500/10 p-12 text-center md:p-16">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.08),transparent_70%)]"
            />
            <h2 className="relative text-3xl font-semibold tracking-tight md:text-4xl">
              <span className={`${headlineSerif.className} text-primary`}>
                {t('home.cta.title')}
              </span>
            </h2>
            <p className="relative mx-auto mt-4 max-w-xl text-sm text-muted-foreground md:text-base">
              {t('home.cta.sub')}
            </p>
            <div className="relative mt-8 flex flex-wrap justify-center gap-3">
              <Link
                href={'/register' as never}
                className="group inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5"
              >
                {t('home.cta.primary')}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/login"
                className="rounded-md border border-border bg-background/60 px-6 py-3 text-sm font-medium backdrop-blur hover:bg-muted"
              >
                {t('home.cta.secondary')}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <MarketingFooter />

      {/* Keyframes for entry animations (scoped global) */}
      <style jsx global>{`
        @keyframes fadeUp {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </main>
  );
}

function Stat({
  big,
  small,
  accent,
}: {
  big: string;
  small: string;
  accent?: string;
}) {
  return (
    <div>
      <div className={`text-2xl font-semibold tracking-tight md:text-3xl ${accent ?? ''}`}>
        {big}
      </div>
      <div className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">{small}</div>
    </div>
  );
}
