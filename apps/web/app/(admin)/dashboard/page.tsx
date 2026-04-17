'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../../lib/api';
import { useT } from '../../../lib/i18n/context';

interface Overview {
  activeAccounts: number;
  tokensLast24h: number;
  requestsLast24h: number;
  poolUtilization: number;
  timeseries: Array<{ ts: string; tokens: number; requests: number }>;
}

const fmt = new Intl.NumberFormat();

export default function DashboardPage() {
  const t = useT();
  const { data, isLoading, error } = useQuery({
    queryKey: ['stats', 'overview'],
    queryFn: () => apiFetch<Overview>('/admin/v1/stats/overview'),
    refetchInterval: 10_000,
  });

  const cards = [
    { label: t('dashboard.card.activeAccounts'), value: data ? String(data.activeAccounts) : t('common.dash') },
    { label: t('dashboard.card.tokens24h'), value: data ? fmt.format(data.tokensLast24h) : t('common.dash') },
    { label: t('dashboard.card.requests24h'), value: data ? fmt.format(data.requestsLast24h) : t('common.dash') },
    {
      label: t('dashboard.card.poolUtilization'),
      value: data ? `${Math.round(data.poolUtilization * 100)}%` : t('common.dash'),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('dashboard.title')}</h1>
        <p className="text-sm text-muted-foreground">
          {isLoading
            ? t('common.loading')
            : error
              ? `${t('dashboard.error')} ${(error as Error).message}`
              : t('dashboard.live')}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg border border-border bg-background p-4">
            <div className="text-xs text-muted-foreground">{c.label}</div>
            <div className="mt-1 text-2xl font-semibold">{c.value}</div>
          </div>
        ))}
      </div>
      {data && data.timeseries.length > 0 && (
        <div className="rounded-lg border border-border p-4">
          <div className="mb-3 text-sm font-medium">{t('dashboard.chart.title')}</div>
          <Timeseries points={data.timeseries} />
        </div>
      )}
    </div>
  );
}

function Timeseries({ points }: { points: Overview['timeseries'] }) {
  const max = Math.max(1, ...points.map((p) => p.tokens));
  return (
    <div className="flex h-32 items-end gap-1">
      {points.map((p) => {
        const h = Math.round((p.tokens / max) * 100);
        return (
          <div
            key={p.ts}
            className="flex-1 rounded-sm bg-primary/70"
            style={{ height: `${Math.max(2, h)}%` }}
            title={`${new Date(p.ts).toLocaleString()} — ${fmt.format(p.tokens)} tokens`}
          />
        );
      })}
    </div>
  );
}
