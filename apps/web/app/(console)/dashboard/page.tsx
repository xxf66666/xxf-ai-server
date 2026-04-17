'use client';

import { useQuery } from '@tanstack/react-query';
import { Activity, KeyRound, Send, Zap } from 'lucide-react';
import { apiFetch } from '../../../lib/api';
import { useT } from '../../../lib/i18n/context';
import type { DictKey } from '../../../lib/i18n/dict';

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
  const { data } = useQuery({
    queryKey: ['console', 'overview'],
    queryFn: () => apiFetch<Overview>('/v1/console/overview'),
    refetchInterval: 10_000,
  });

  const cards = [
    {
      label: t('console.card.activeKeys'),
      value: data ? String(data.activeKeys) : t('common.dash'),
      icon: KeyRound,
      tint: 'bg-indigo-500/10 text-indigo-600',
    },
    {
      label: t('console.card.requests24h'),
      value: data ? fmt.format(data.requests24h) : t('common.dash'),
      icon: Send,
      tint: 'bg-emerald-500/10 text-emerald-600',
    },
    {
      label: t('console.card.tokens24h'),
      value: data ? fmt.format(data.tokens24h) : t('common.dash'),
      icon: Zap,
      tint: 'bg-amber-500/10 text-amber-600',
    },
    {
      label: t('console.card.usedMonthly'),
      value: data ? fmt.format(data.usedMonthly) : t('common.dash'),
      icon: Activity,
      tint: 'bg-rose-500/10 text-rose-600',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          👋 {t(greetingKey())}
          {data?.email ? `，${data.email}` : ''}
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

      {data && data.timeseries.length > 0 && (
        <div className="rounded-lg border border-border bg-background p-4">
          <div className="mb-3 text-sm font-medium">{t('console.card.chart')}</div>
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
            className="flex-1 rounded-sm bg-indigo-500/70"
            style={{ height: `${Math.max(2, h)}%` }}
            title={`${new Date(p.ts).toLocaleString()} — ${fmt.format(p.tokens)} tokens`}
          />
        );
      })}
    </div>
  );
}
