'use client';

import { useQuery } from '@tanstack/react-query';
import { Activity, Boxes, CircleDollarSign, Send, Zap } from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { apiFetch } from '../../../lib/api';
import { useT } from '../../../lib/i18n/context';

interface Overview {
  activeAccounts: number;
  tokensLast24h: number;
  requestsLast24h: number;
  costLast24hMud: number;
  poolUtilization: number;
  timeseries: Array<{ ts: string; tokens: number; requests: number; costMud: number }>;
}

interface ByAccount {
  accountId: string | null;
  tokens: number;
  requests: number;
  costMud: number;
}

const fmt = new Intl.NumberFormat();
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const mudToUsd = (mud: number) => mud / 1_000_000;
const hour = new Intl.DateTimeFormat(undefined, {
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

export default function DashboardPage() {
  const t = useT();
  const { data, isLoading, error } = useQuery({
    queryKey: ['stats', 'overview'],
    queryFn: () => apiFetch<Overview>('/admin/v1/stats/overview'),
    refetchInterval: 10_000,
  });
  const { data: byAccount } = useQuery({
    queryKey: ['stats', 'by-account'],
    queryFn: () => apiFetch<{ data: ByAccount[] }>('/admin/v1/stats/by-account'),
    refetchInterval: 20_000,
  });

  const cards = [
    {
      label: t('dashboard.card.activeAccounts'),
      value: data ? String(data.activeAccounts) : t('common.dash'),
      icon: Boxes,
      tint: 'bg-indigo-500/10 text-indigo-600',
    },
    {
      label: t('dashboard.card.tokens24h'),
      value: data ? fmt.format(data.tokensLast24h) : t('common.dash'),
      icon: Zap,
      tint: 'bg-amber-500/10 text-amber-600',
    },
    {
      label: t('dashboard.card.requests24h'),
      value: data ? fmt.format(data.requestsLast24h) : t('common.dash'),
      icon: Send,
      tint: 'bg-emerald-500/10 text-emerald-600',
    },
    {
      label: t('dashboard.card.cost24h'),
      value: data ? usd.format(mudToUsd(data.costLast24hMud)) : t('common.dash'),
      icon: CircleDollarSign,
      tint: 'bg-violet-500/10 text-violet-600',
    },
    {
      label: t('dashboard.card.poolUtilization'),
      value: data ? `${Math.round(data.poolUtilization * 100)}%` : t('common.dash'),
      icon: Activity,
      tint: 'bg-rose-500/10 text-rose-600',
    },
  ];

  const trendRows = (data?.timeseries ?? []).map((p) => ({
    ts: hour.format(new Date(p.ts)),
    [t('console.charts.tokens')]: p.tokens,
    [t('console.charts.requests')]: p.requests,
  }));
  const accountRows = [...(byAccount?.data ?? [])]
    .sort((a, b) => b.tokens - a.tokens)
    .slice(0, 8)
    .map((a) => ({
      name: a.accountId ? a.accountId.slice(0, 8) + '…' : '—',
      [t('console.charts.tokens')]: a.tokens,
    }));

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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div
              key={c.label}
              className="flex items-center gap-3 rounded-lg border border-border bg-background p-4"
            >
              <div className={`flex h-10 w-10 items-center justify-center rounded-full ${c.tint}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">{c.label}</div>
                <div className="text-xl font-semibold">{c.value}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <div className="rounded-lg border border-border bg-background p-4">
          <div className="mb-3 text-sm font-medium">{t('dashboard.chart.title')}</div>
          {trendRows.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
              {t('console.charts.empty')}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={trendRows}>
                <defs>
                  <linearGradient id="dash-tokens" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="ts" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(n: number) => fmt.format(n)} />
                <Tooltip formatter={(v) => fmt.format(Number(v) || 0)} contentStyle={{ fontSize: 12 }} />
                <Area
                  type="monotone"
                  dataKey={t('console.charts.tokens')}
                  stroke="#6366f1"
                  fill="url(#dash-tokens)"
                />
                <Line
                  type="monotone"
                  dataKey={t('console.charts.requests')}
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-lg border border-border bg-background p-4">
          <div className="mb-3 text-sm font-medium">
            {t('stats.byAccount')} — {t('console.charts.tokens')}
          </div>
          {accountRows.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
              {t('console.charts.empty')}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={accountRows} layout="vertical" margin={{ left: 10 }}>
                <XAxis type="number" stroke="#94a3b8" fontSize={11} />
                <YAxis type="category" dataKey="name" stroke="#94a3b8" fontSize={11} width={80} />
                <Tooltip formatter={(v) => fmt.format(Number(v) || 0)} contentStyle={{ fontSize: 12 }} />
                <Bar dataKey={t('console.charts.tokens')} fill="#f59e0b" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
