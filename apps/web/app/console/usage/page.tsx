'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../../lib/api';
import { useT } from '../../../lib/i18n/context';

interface UsageRow {
  id: string;
  createdAt: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  status: number;
  errorCode: string | null;
  costMud: number;
  keyName: string;
}

const fmt = new Intl.NumberFormat();
const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 4,
  maximumFractionDigits: 6,
});
const mudToUsd = (mud: number) => mud / 1_000_000;

function statusClass(s: number): string {
  if (s >= 200 && s < 300) return 'bg-green-100 text-green-800';
  if (s === 429) return 'bg-amber-100 text-amber-800';
  if (s >= 400) return 'bg-red-100 text-red-800';
  return 'bg-muted';
}

export default function ConsoleUsagePage() {
  const t = useT();
  const { data, isLoading } = useQuery({
    queryKey: ['console', 'usage'],
    queryFn: () => apiFetch<{ data: UsageRow[] }>('/v1/console/usage?limit=50'),
    refetchInterval: 15_000,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('console.usage.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('console.usage.subtitle')}</p>
      </div>

      <div className="rounded-lg border border-border bg-background">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">{t('console.usage.col.time')}</th>
              <th className="px-4 py-2 font-medium">{t('console.usage.col.key')}</th>
              <th className="px-4 py-2 font-medium">{t('console.usage.col.model')}</th>
              <th className="px-4 py-2 font-medium text-right">{t('console.usage.col.input')}</th>
              <th className="px-4 py-2 font-medium text-right">{t('console.usage.col.output')}</th>
              <th className="px-4 py-2 font-medium text-right">{t('console.usage.col.cost')}</th>
              <th className="px-4 py-2 font-medium text-right">{t('console.usage.col.latency')}</th>
              <th className="px-4 py-2 font-medium">{t('console.usage.col.status')}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-muted-foreground">
                  {t('common.loading')}
                </td>
              </tr>
            )}
            {!isLoading && (data?.data.length ?? 0) === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-muted-foreground">
                  {t('console.usage.empty')}
                </td>
              </tr>
            )}
            {data?.data.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-4 py-2 text-xs text-muted-foreground">
                  {new Date(r.createdAt).toLocaleString()}
                </td>
                <td className="px-4 py-2">{r.keyName}</td>
                <td className="px-4 py-2 font-mono text-xs">{r.model}</td>
                <td className="px-4 py-2 text-right">{fmt.format(r.inputTokens)}</td>
                <td className="px-4 py-2 text-right">{fmt.format(r.outputTokens)}</td>
                <td className="px-4 py-2 text-right font-mono text-xs">
                  {r.costMud > 0 ? usd.format(mudToUsd(r.costMud)) : t('common.dash')}
                </td>
                <td className="px-4 py-2 text-right">{r.latencyMs}ms</td>
                <td className="px-4 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${statusClass(r.status)}`}>
                    {r.status}
                    {r.errorCode ? ` · ${r.errorCode}` : ''}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
