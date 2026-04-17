'use client';

import { useQuery } from '@tanstack/react-query';
import { Activity, CircleDollarSign, KeyRound, Send, TrendingDown, Wallet, Zap } from 'lucide-react';
import { apiFetch } from '../../../lib/api';
import { useT } from '../../../lib/i18n/context';
import type { DictKey } from '../../../lib/i18n/dict';
import { ConsoleAnalytics, type Breakdown } from '../../../components/charts/ConsoleAnalytics';

interface Overview {
  email: string;
  role: string;
  activeKeys: number;
  tokens24h: number;
  requests24h: number;
  usedMonthly: number;
  balanceMud: number;
  spentMud: number;
  timeseries: Array<{ ts: string; tokens: number; requests: number }>;
}

const fmt = new Intl.NumberFormat();
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const mudToUsd = (mud: number) => mud / 1_000_000;

function greetingKey(): DictKey {
  const h = new Date().getHours();
  if (h < 6) return 'console.greeting.night';
  if (h < 12) return 'console.greeting.morning';
  if (h < 18) return 'console.greeting.afternoon';
  return 'console.greeting.evening';
}

export default function ConsoleDashboardPage() {
  const t = useT();
  const { data: overview } = useQuery({
    queryKey: ['console', 'overview'],
    queryFn: () => apiFetch<Overview>('/v1/console/overview'),
    refetchInterval: 10_000,
  });
  const { data: breakdown } = useQuery({
    queryKey: ['console', 'breakdown'],
    queryFn: () => apiFetch<Breakdown>('/v1/console/breakdown'),
    refetchInterval: 15_000,
  });

  const cards = [
    {
      label: t('console.card.balance'),
      value: overview ? usd.format(mudToUsd(overview.balanceMud)) : t('common.dash'),
      icon: Wallet,
      tint: 'bg-teal-500/10 text-teal-600',
    },
    {
      label: t('console.card.spent'),
      value: overview ? usd.format(mudToUsd(overview.spentMud)) : t('common.dash'),
      icon: CircleDollarSign,
      tint: 'bg-violet-500/10 text-violet-600',
    },
    {
      label: t('console.card.activeKeys'),
      value: overview ? String(overview.activeKeys) : t('common.dash'),
      icon: KeyRound,
      tint: 'bg-indigo-500/10 text-indigo-600',
    },
    {
      label: t('console.card.requests24h'),
      value: overview ? fmt.format(overview.requests24h) : t('common.dash'),
      icon: Send,
      tint: 'bg-emerald-500/10 text-emerald-600',
    },
    {
      label: t('console.card.tokens24h'),
      value: overview ? fmt.format(overview.tokens24h) : t('common.dash'),
      icon: Zap,
      tint: 'bg-amber-500/10 text-amber-600',
    },
    {
      label: t('console.card.usedMonthly'),
      value: overview ? fmt.format(overview.usedMonthly) : t('common.dash'),
      icon: Activity,
      tint: 'bg-rose-500/10 text-rose-600',
    },
  ];

  // Suppress unused-import warning in case icon tree-shakes
  void TrendingDown;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          👋 {t(greetingKey())}
          {overview?.email ? `，${overview.email}` : ''}
        </h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
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

      <ConsoleAnalytics
        data={breakdown ?? { byModel: [], byKey: [], byStatus: [], trend: [] }}
      />
    </div>
  );
}
