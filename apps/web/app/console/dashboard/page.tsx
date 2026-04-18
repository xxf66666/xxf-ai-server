'use client';

import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, AlertTriangle, ArrowRight, BookOpen, CircleDollarSign, KeyRound, Mail, Send, Siren, Terminal, Wallet, Zap } from 'lucide-react';
import { apiFetch } from '../../../lib/api';
import { useT } from '../../../lib/i18n/context';
import type { DictKey } from '../../../lib/i18n/dict';
import { ConsoleAnalytics, type Breakdown } from '../../../components/charts/ConsoleAnalytics';
import { ContactCard } from '../../../components/ContactCard';

interface Overview {
  email: string;
  role: string;
  activeKeys: number;
  tokens24h: number;
  requests24h: number;
  usedMonthly: number;
  balanceMud: number;
  spentMud: number;
  emailVerified: boolean;
  timeseries: Array<{ ts: string; tokens: number; requests: number }>;
  alerts: Array<{
    kind: 'balance_depleted' | 'balance_low' | 'key_quota_high';
    level: 'warning' | 'critical';
    detail?: { keyId?: string; usedPct?: number };
  }>;
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
  const qc = useQueryClient();
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
  const resend = useMutation({
    mutationFn: () =>
      apiFetch<{ sent: boolean }>('/admin/v1/auth/verify-email/send', { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['console', 'overview'] });
    },
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

  const noKeys = overview && overview.activeKeys === 0;
  const unverified = overview && overview.emailVerified === false;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-semibold tracking-tight">
          👋 {t(greetingKey())}
          {overview?.email ? `，${overview.email}` : ''}
        </h1>
      </div>

      {(overview?.alerts ?? []).map((a, i) => {
        const critical = a.level === 'critical';
        const cls = critical
          ? 'border-red-300 bg-red-50 text-red-900'
          : 'border-amber-300 bg-amber-50 text-amber-900';
        const Icon = critical ? Siren : AlertTriangle;
        let msg = '';
        if (a.kind === 'balance_depleted') msg = t('console.alerts.balanceDepleted');
        else if (a.kind === 'balance_low') msg = t('console.alerts.balanceLow');
        else if (a.kind === 'key_quota_high') {
          const pct = a.detail?.usedPct ?? 80;
          msg = t(critical ? 'console.alerts.keyQuotaFull' : 'console.alerts.keyQuotaHigh').replace(
            '{pct}',
            String(pct),
          );
        }
        return (
          <div
            key={`${a.kind}-${i}`}
            className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${cls}`}
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="flex-1">{msg}</div>
            {(a.kind === 'balance_depleted' || a.kind === 'balance_low') && (
              <Link
                href={'/console/wallet' as never}
                className="rounded-md border border-current/30 bg-background/60 px-2 py-1 text-xs font-medium hover:bg-background"
              >
                {t('console.alerts.topup')}
              </Link>
            )}
          </div>
        );
      })}

      {unverified && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-500/20 text-amber-600">
            <Mail className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <div className="font-medium">{t('verify.banner.title')}</div>
            <div className="text-xs text-muted-foreground">
              {t('verify.banner.desc').replace('{email}', overview?.email ?? '')}
            </div>
          </div>
          <button
            type="button"
            onClick={() => resend.mutate()}
            disabled={resend.isPending || resend.isSuccess}
            className="rounded-md border border-amber-500/40 bg-background px-3 py-1.5 text-xs font-medium hover:bg-amber-500/10 disabled:opacity-60"
          >
            {resend.isSuccess
              ? t('verify.banner.resent')
              : resend.isPending
              ? t('verify.banner.sending')
              : t('verify.banner.resend')}
          </button>
        </div>
      )}

      {/* Onboarding hint for new users (no keys yet) */}
      {noKeys && (
        <Link
          href={'/docs/claude-code' as never}
          target="_blank"
          className="block overflow-hidden rounded-xl border border-primary/30 bg-gradient-to-r from-indigo-500/10 via-violet-500/10 to-pink-500/10 p-5 transition-shadow hover:shadow-md"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Terminal className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold">{t('console.onboarding.title')}</div>
              <div className="text-xs text-muted-foreground">{t('console.onboarding.desc')}</div>
            </div>
            <ArrowRight className="h-5 w-5 text-primary" />
          </div>
        </Link>
      )}

      {/* Persistent link to full docs */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <BookOpen className="h-3.5 w-3.5" />
        <a
          href="/docs"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-foreground hover:underline"
        >
          {t('console.docs.link')}
        </a>
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

      <div className="grid gap-4 md:grid-cols-[2fr,1fr]">
        <div className="hidden md:block" />
        <ContactCard />
      </div>
    </div>
  );
}
