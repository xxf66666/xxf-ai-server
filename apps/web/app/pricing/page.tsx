'use client';

import { useQuery } from '@tanstack/react-query';
import { Sparkles, TrendingUp } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { useT } from '../../lib/i18n/context';
import { MarketingHeader } from '../../components/MarketingHeader';
import { MarketingFooter } from '../../components/MarketingFooter';
import { ProviderIcon } from '../../components/ProviderIcon';

interface CatalogModel {
  id: string;
  tier: string | null;
  officialInputUsdPerM: number;
  officialOutputUsdPerM: number;
  ourInputUsdPerM: number;
  ourOutputUsdPerM: number;
  cacheReadUsdPerM: number | null;
}

interface CatalogProvider {
  slug: string;
  displayName: string;
  tagline: string;
  state: 'pool' | 'live' | 'pending';
  models: CatalogModel[];
}

interface CatalogResponse {
  markupRate: number;
  usdToCnyRate: number;
  data: CatalogProvider[];
}

const fmtUsd = (n: number) => (n < 0.01 ? '$' + n.toFixed(4) : '$' + n.toFixed(2));

const TIER_BADGE: Record<string, string> = {
  flagship: 'border-violet-200 bg-violet-50 text-violet-700',
  opus: 'border-violet-200 bg-violet-50 text-violet-700',
  sonnet: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  reasoning: 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700',
  codex: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  mid: 'border-sky-200 bg-sky-50 text-sky-700',
  haiku: 'border-cyan-200 bg-cyan-50 text-cyan-700',
  small: 'border-amber-200 bg-amber-50 text-amber-700',
};

// Volume-based rebate tiers — currently a teaser; activated once
// commercial billing kicks in. Numbers picked to be slightly less
// aggressive than OfoxAI to leave headroom on margin.
const REBATE_TIERS = [
  { label: 'Bronze', spend: 500, rebate: 3 },
  { label: 'Silver', spend: 2000, rebate: 5 },
  { label: 'Gold', spend: 5000, rebate: 7 },
  { label: 'Platinum', spend: 20000, rebate: 10 },
];

export default function PricingPage() {
  const t = useT();
  const { data, isLoading } = useQuery({
    queryKey: ['public', 'catalog'],
    queryFn: () => apiFetch<CatalogResponse>('/v1/catalog'),
  });

  const savingsPct = data ? Math.round((1 - data.markupRate) * 100) : 15;
  const totalModels = (data?.data ?? []).reduce((acc, p) => acc + p.models.length, 0);
  const liveProviders = (data?.data ?? []).filter(
    (p) => (p.state === 'pool' || p.state === 'live') && p.models.length > 0,
  );
  const pendingProviders = (data?.data ?? []).filter(
    (p) => p.state === 'pending' && p.models.length > 0,
  );

  return (
    <main className="min-h-screen bg-background">
      <MarketingHeader active="pricing" />

      <section className="container mx-auto max-w-6xl px-4 py-12">
        <div className="text-center">
          <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-3 py-1 text-xs">
            <Sparkles className="h-3 w-3 text-primary" />
            {t('pricing.hero.tag')
              .replace('{providers}', String(data?.data.length ?? 9))
              .replace('{models}', String(totalModels))}
          </div>
          <h1 className="text-3xl font-bold tracking-tight md:text-5xl">
            {t('pricing.title')}
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground md:text-base">
            {t('pricing.subtitle', { markup: Math.round((data?.markupRate ?? 0.85) * 100) })}
          </p>
          <p className="mt-2 text-xs text-emerald-700">{t('pricing.pagePlans')}</p>
        </div>

        {/* Volume rebate strip */}
        <div className="mt-10 rounded-2xl border border-border bg-gradient-to-br from-emerald-50/50 via-background to-violet-50/30 p-6">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-700" />
            <h2 className="text-sm font-semibold">{t('pricing.rebate.title')}</h2>
            <span className="text-xs text-muted-foreground">{t('pricing.rebate.subtitle')}</span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {REBATE_TIERS.map((tier) => (
              <div
                key={tier.label}
                className="rounded-lg border border-border bg-background px-3 py-2.5"
              >
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {tier.label}
                </div>
                <div className="mt-0.5 text-lg font-semibold tabular-nums">
                  -{tier.rebate}%
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {t('pricing.rebate.threshold').replace('{n}', `$${tier.spend.toLocaleString()}`)}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[10px] text-muted-foreground">
            {t('pricing.rebate.note')}
          </p>
        </div>

        {isLoading && (
          <div className="mt-12 text-center text-sm text-muted-foreground">
            {t('common.loading')}
          </div>
        )}

        {/* Live providers */}
        {liveProviders.length > 0 && (
          <div className="mt-12 space-y-10">
            {liveProviders.map((provider) => (
              <ProviderSection
                key={provider.slug}
                provider={provider}
                savingsPct={savingsPct}
              />
            ))}
          </div>
        )}

        {/* Coming soon */}
        {pendingProviders.length > 0 && (
          <section className="mt-16 space-y-4">
            <h2 className="text-sm font-semibold text-muted-foreground">
              {t('pricing.comingSoon')}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {pendingProviders.map((p) => (
                <div
                  key={p.slug}
                  className="rounded-lg border border-dashed border-border bg-muted/20 p-4 opacity-70"
                >
                  <div className="flex items-center gap-2">
                    <ProviderIcon provider={p.slug} size={20} />
                    <div className="text-sm font-semibold">{p.displayName}</div>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{p.tagline}</div>
                  <div className="mt-2 text-[10px] text-muted-foreground">
                    {p.models.length} {t('pricing.modelsCount')}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <p className="mt-12 text-center text-xs text-muted-foreground">
          1 USD ≈ {data?.usdToCnyRate ?? 7.2} CNY · {t('pricing.discount')} {savingsPct}%
        </p>
      </section>

      <MarketingFooter />
    </main>
  );
}

function ProviderSection({
  provider,
  savingsPct,
}: {
  provider: CatalogProvider;
  savingsPct: number;
}) {
  const t = useT();
  return (
    <section>
      <div className="mb-4 flex items-center gap-3">
        <ProviderIcon provider={provider.slug} size={28} />
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">{provider.displayName}</h2>
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
              {provider.state === 'pool' ? t('pricing.state.pool') : t('pricing.state.live')}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">{provider.tagline}</p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {provider.models.map((m) => (
          <article
            key={m.id}
            className="relative overflow-hidden rounded-xl border border-border bg-background p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="absolute right-4 top-4 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
              {t('pricing.savings', { pct: savingsPct })}
            </div>
            <div className="pr-20">
              <code className="break-all font-mono text-sm font-semibold">{m.id}</code>
            </div>
            {m.tier && (
              <div className="mt-2">
                <span
                  className={`inline-block rounded px-2 py-0.5 text-xs font-medium border ${
                    TIER_BADGE[m.tier] ?? 'border-border bg-muted text-muted-foreground'
                  }`}
                >
                  {m.tier}
                </span>
              </div>
            )}
            <div className="mt-4 space-y-3">
              <div className="flex items-baseline justify-between">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t('pricing.input')}
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground line-through">
                    {fmtUsd(m.officialInputUsdPerM)}
                  </div>
                  <div className="font-mono text-sm font-semibold">
                    {fmtUsd(m.ourInputUsdPerM)}
                    <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                      {t('pricing.unit')}
                    </span>
                  </div>
                </div>
              </div>
              {m.cacheReadUsdPerM !== null && (
                <div className="flex items-baseline justify-between border-t border-border pt-3">
                  <div className="text-xs uppercase tracking-wide text-emerald-700">
                    {t('pricing.cacheRead')}
                  </div>
                  <div className="text-right font-mono text-sm font-semibold text-emerald-700">
                    {fmtUsd(m.cacheReadUsdPerM)}
                    <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                      {t('pricing.unit')}
                    </span>
                  </div>
                </div>
              )}
              <div className="flex items-baseline justify-between border-t border-border pt-3">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t('pricing.output')}
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground line-through">
                    {fmtUsd(m.officialOutputUsdPerM)}
                  </div>
                  <div className="font-mono text-sm font-semibold">
                    {fmtUsd(m.ourOutputUsdPerM)}
                    <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                      {t('pricing.unit')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
