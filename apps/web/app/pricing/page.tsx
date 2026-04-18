'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';
import { useT } from '../../lib/i18n/context';
import { MarketingHeader } from '../../components/MarketingHeader';
import { MarketingFooter } from '../../components/MarketingFooter';
import { ProviderIcon } from '../../components/ProviderIcon';

interface PricingRow {
  modelId: string;
  provider: string;
  tier: string | null;
  officialInputUsdPerM: number;
  officialOutputUsdPerM: number;
  ourInputUsdPerM: number;
  ourOutputUsdPerM: number;
  ourInputCnyPerM: number;
  ourOutputCnyPerM: number;
}
interface PricingResponse {
  markupRate: number;
  usdToCnyRate: number;
  data: PricingRow[];
}

const fmtUsd = (n: number) => (n < 0.01 ? '$' + n.toFixed(4) : '$' + n.toFixed(2));
const fmtCny = (n: number) => (n < 0.1 ? '¥' + n.toFixed(3) : '¥' + n.toFixed(2));

const TIER_BADGE: Record<string, string> = {
  opus: 'bg-violet-500/10 text-violet-700 border border-violet-200',
  sonnet: 'bg-indigo-500/10 text-indigo-700 border border-indigo-200',
  haiku: 'bg-cyan-500/10 text-cyan-700 border border-cyan-200',
  flagship: 'bg-emerald-500/10 text-emerald-700 border border-emerald-200',
  small: 'bg-amber-500/10 text-amber-700 border border-amber-200',
};

export default function PricingPage() {
  const t = useT();
  const { data, isLoading } = useQuery({
    queryKey: ['public', 'pricing'],
    queryFn: () => apiFetch<PricingResponse>('/v1/pricing'),
  });

  const savingsPct = data ? Math.round((1 - data.markupRate) * 100) : 15;

  const byProvider = (data?.data ?? []).reduce<Record<string, PricingRow[]>>((acc, r) => {
    (acc[r.provider] ??= []).push(r);
    return acc;
  }, {});
  const providerOrder = ['claude', 'openai'];

  return (
    <main className="min-h-screen bg-background">
      <MarketingHeader active="pricing" />
      <section className="container mx-auto max-w-6xl px-4 py-12">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{t('pricing.title')}</h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground">
            {t('pricing.subtitle', { markup: Math.round((data?.markupRate ?? 0.85) * 100) })}
          </p>
          <p className="mt-2 text-xs text-emerald-700">{t('pricing.pagePlans')}</p>
        </div>

        {isLoading && (
          <div className="mt-12 text-center text-sm text-muted-foreground">
            {t('common.loading')}
          </div>
        )}

        <div className="mt-10 space-y-10">
          {providerOrder
            .filter((p) => byProvider[p])
            .map((p) => (
              <section key={p}>
                <div className="mb-4 flex items-center gap-2">
                  <ProviderIcon provider={p} size={24} />
                  <h2 className="text-lg font-semibold capitalize">{p}</h2>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {byProvider[p]!.map((m) => (
                    <article
                      key={m.modelId}
                      className="relative overflow-hidden rounded-xl border border-border bg-background p-5 shadow-sm transition-shadow hover:shadow-md"
                    >
                      <div className="absolute right-4 top-4 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                        {t('pricing.savings', { pct: savingsPct })}
                      </div>
                      <div className="flex items-center gap-2 pr-20">
                        <ProviderIcon provider={p} size={26} />
                        <code className="truncate font-mono text-sm font-semibold">
                          {m.modelId}
                        </code>
                      </div>
                      {m.tier && (
                        <div className="mt-2">
                          <span
                            className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                              TIER_BADGE[m.tier] ?? 'bg-muted text-muted-foreground'
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
                              {fmtUsd(m.officialInputUsdPerM)} <span className="text-[10px]">{t('pricing.unit')}</span>
                            </div>
                            <div className="font-mono text-sm font-semibold">
                              {fmtUsd(m.ourInputUsdPerM)}{' '}
                              <span className="text-[10px] font-normal text-muted-foreground">
                                {t('pricing.unit')}
                              </span>
                              <span className="ml-1 text-xs text-muted-foreground">
                                / {fmtCny(m.ourInputCnyPerM)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-baseline justify-between border-t border-border pt-3">
                          <div className="text-xs uppercase tracking-wide text-muted-foreground">
                            {t('pricing.output')}
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-muted-foreground line-through">
                              {fmtUsd(m.officialOutputUsdPerM)} <span className="text-[10px]">{t('pricing.unit')}</span>
                            </div>
                            <div className="font-mono text-sm font-semibold">
                              {fmtUsd(m.ourOutputUsdPerM)}{' '}
                              <span className="text-[10px] font-normal text-muted-foreground">
                                {t('pricing.unit')}
                              </span>
                              <span className="ml-1 text-xs text-muted-foreground">
                                / {fmtCny(m.ourOutputCnyPerM)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
        </div>

        <p className="mt-10 text-center text-xs text-muted-foreground">
          1 USD ≈ {data?.usdToCnyRate ?? 7.2} CNY · {t('pricing.discount')} {savingsPct}%
        </p>
      </section>
      <MarketingFooter />
    </main>
  );
}
