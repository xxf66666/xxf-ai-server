'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../../lib/api';
import { useT } from '../../../lib/i18n/context';
import { ProviderIcon } from '../../../components/ProviderIcon';

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

const TIER_BADGE: Record<string, string> = {
  opus: 'bg-violet-500/10 text-violet-700 border border-violet-200',
  sonnet: 'bg-indigo-500/10 text-indigo-700 border border-indigo-200',
  haiku: 'bg-cyan-500/10 text-cyan-700 border border-cyan-200',
  flagship: 'bg-emerald-500/10 text-emerald-700 border border-emerald-200',
  small: 'bg-amber-500/10 text-amber-700 border border-amber-200',
};

export default function ConsoleModelsPage() {
  const t = useT();
  const { data, isLoading } = useQuery({
    queryKey: ['console', 'pricing'],
    queryFn: () => apiFetch<PricingResponse>('/v1/pricing'),
  });

  const savingsPct = data ? Math.round((1 - data.markupRate) * 100) : 15;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('console.models.title')}</h1>
        <p className="text-sm text-muted-foreground">
          {t('console.models.subtitle2').replace('{pct}', String(savingsPct))}
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-background">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">{t('console.models.col.id')}</th>
              <th className="px-4 py-2 font-medium">{t('console.models.col.provider')}</th>
              <th className="px-4 py-2 font-medium">{t('console.models.col.tier')}</th>
              <th className="px-4 py-2 text-right font-medium">
                {t('pricing.col.officialInput')}
              </th>
              <th className="px-4 py-2 text-right font-medium">{t('pricing.col.ourInput')}</th>
              <th className="px-4 py-2 text-right font-medium">
                {t('pricing.col.officialOutput')}
              </th>
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
            {data?.data.map((m) => (
              <tr key={m.modelId} className="border-t border-border">
                <td className="px-4 py-2 font-mono text-xs">{m.modelId}</td>
                <td className="px-4 py-2">
                  <span className="inline-flex items-center gap-1.5">
                    <ProviderIcon provider={m.provider} size={16} />
                    <span className="capitalize">{m.provider}</span>
                  </span>
                </td>
                <td className="px-4 py-2">
                  {m.tier ? (
                    <span
                      className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                        TIER_BADGE[m.tier] ?? 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {m.tier}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">{t('common.dash')}</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-right font-mono text-xs text-muted-foreground line-through">
                  {fmtUsd(m.officialInputUsdPerM)}{' '}
                  <span className="text-[10px]">{t('pricing.unit')}</span>
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-right font-mono text-xs font-semibold text-foreground">
                  {fmtUsd(m.ourInputUsdPerM)}{' '}
                  <span className="text-[10px] font-normal text-muted-foreground">
                    {t('pricing.unit')}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-right font-mono text-xs text-muted-foreground line-through">
                  {fmtUsd(m.officialOutputUsdPerM)}{' '}
                  <span className="text-[10px]">{t('pricing.unit')}</span>
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-right font-mono text-xs font-semibold text-foreground">
                  {fmtUsd(m.ourOutputUsdPerM)}{' '}
                  <span className="text-[10px] font-normal text-muted-foreground">
                    {t('pricing.unit')}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        {t('console.models.footnote').replace('{pct}', String(savingsPct))}
      </p>
    </div>
  );
}
