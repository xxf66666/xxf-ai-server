'use client';

import { useQuery } from '@tanstack/react-query';
import { Activity, KeyRound, Send, Zap } from 'lucide-react';
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
  timeseries: Array<{ ts: string; tokens: number; requests: number }>;
}

const fmt = new Intl.NumberFormat();

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          👋 {t(greetingKey())}
          {overview?.email ? `，${overview.email}` : ''}
        </h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
