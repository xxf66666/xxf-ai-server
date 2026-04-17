'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';
import { useT } from '../../lib/i18n/context';
import { LocaleSwitcher } from '../../lib/i18n/LocaleSwitcher';

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

const fmtUsd = (n: number) =>
  '$' + (n < 0.01 ? n.toFixed(4) : n.toFixed(2));
const fmtCny = (n: number) =>
  '¥' + (n < 0.1 ? n.toFixed(3) : n.toFixed(2));

export default function PricingPage() {
  const t = useT();
  const { data, isLoading } = useQuery({
    queryKey: ['public', 'pricing'],
    queryFn: () => apiFetch<PricingResponse>('/v1/pricing'),
  });

  const markupPct = data ? Math.round(data.markupRate * 100) : 85;
  const discountPct = 100 - markupPct;

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container flex max-w-6xl items-center justify-between py-4">
          <Link href="/" className="text-sm font-semibold">
            xxf-ai-server
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <Link href={'/pricing' as never} className="text-primary">{t('nav.pricing')}</Link>
            <Link href={'/docs' as never} className="text-muted-foreground hover:text-foreground">{t('nav.docs')}</Link>
            <Link href="/login" className="text-muted-foreground hover:text-foreground">
              {t('home.signin')}
            </Link>
            <Link href={'/register' as never} className="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground">
              {t('register.submit')}
            </Link>
            <LocaleSwitcher />
          </div>
        </div>
      </header>

      <section className="container max-w-6xl py-10">
        <h1 className="text-3xl font-semibold tracking-tight">{t('pricing.title')}</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          {t('pricing.subtitle', { markup: markupPct })}
        </p>
        <p className="mt-1 text-xs text-emerald-600">
          {t('pricing.welcomeCreditNote', { amount: '5.00' })}
        </p>

        <div className="mt-6 overflow-hidden rounded-lg border border-border bg-background">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">{t('pricing.col.model')}</th>
                <th className="px-4 py-2 font-medium">{t('pricing.col.provider')}</th>
                <th className="px-4 py-2 font-medium">{t('pricing.col.tier')}</th>
                <th className="px-4 py-2 text-right font-medium">{t('pricing.col.officialInput')}</th>
                <th className="px-4 py-2 text-right font-medium">{t('pricing.col.officialOutput')}</th>
                <th className="px-4 py-2 text-right font-medium">{t('pricing.col.ourInput')}</th>
                <th className="px-4 py-2 text-right font-medium">{t('pricing.col.ourOutput')}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
                    {t('common.loading')}
                  </td>
                </tr>
              )}
              {data?.data.map((r) => (
                <tr key={r.modelId} className="border-t border-border">
                  <td className="px-4 py-2 font-mono text-xs">{r.modelId}</td>
                  <td className="px-4 py-2">{r.provider}</td>
                  <td className="px-4 py-2 text-muted-foreground">{r.tier ?? '—'}</td>
                  <td className="px-4 py-2 text-right text-muted-foreground line-through">
                    {fmtUsd(r.officialInputUsdPerM)}
                  </td>
                  <td className="px-4 py-2 text-right text-muted-foreground line-through">
                    {fmtUsd(r.officialOutputUsdPerM)}
                  </td>
                  <td className="px-4 py-2 text-right font-medium">
                    <div>{fmtUsd(r.ourInputUsdPerM)}</div>
                    <div className="text-xs text-muted-foreground">{fmtCny(r.ourInputCnyPerM)}</div>
                  </td>
                  <td className="px-4 py-2 text-right font-medium">
                    <div>{fmtUsd(r.ourOutputUsdPerM)}</div>
                    <div className="text-xs text-muted-foreground">{fmtCny(r.ourOutputCnyPerM)}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          {t('pricing.discount')} — {discountPct}% off · 1 USD ≈ {data?.usdToCnyRate ?? 7.2} CNY
        </p>
      </section>
    </main>
  );
}
