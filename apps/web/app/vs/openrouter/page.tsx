'use client';

import Link from 'next/link';
import { ArrowRight, Check, Minus, X } from 'lucide-react';
import { Instrument_Serif } from 'next/font/google';
import { useT } from '../../../lib/i18n/context';
import { MarketingHeader } from '../../../components/MarketingHeader';
import { MarketingFooter } from '../../../components/MarketingFooter';

const headlineSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  style: 'italic',
  display: 'swap',
});

type Cell =
  | { kind: 'check'; note?: string }
  | { kind: 'cross'; note?: string }
  | { kind: 'partial'; note?: string }
  | { kind: 'text'; value: string };

interface Row {
  feature: string;
  detail?: string;
  nexa: Cell;
  competitor: Cell;
}

function CellView({ c }: { c: Cell }) {
  const t = useT();
  if (c.kind === 'check')
    return (
      <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
        <Check className="h-4 w-4" />
        <span className="text-xs">{c.note ?? t('common.yes')}</span>
      </span>
    );
  if (c.kind === 'cross')
    return (
      <span className="inline-flex items-center gap-1.5 text-rose-700 dark:text-rose-300">
        <X className="h-4 w-4" />
        <span className="text-xs">{c.note ?? t('common.no')}</span>
      </span>
    );
  if (c.kind === 'partial')
    return (
      <span className="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
        <Minus className="h-4 w-4" />
        <span className="text-xs">{c.note ?? '—'}</span>
      </span>
    );
  return <span className="text-xs font-mono">{c.value}</span>;
}

export default function VsOpenRouterPage() {
  const t = useT();

  const rows: Row[] = [
    {
      feature: t('vs.row.markup.feature'),
      detail: t('vs.row.markup.detail'),
      nexa: { kind: 'text', value: t('vs.row.markup.nexa') },
      competitor: { kind: 'text', value: '5%' },
    },
    {
      feature: t('vs.row.claudePool.feature'),
      detail: t('vs.row.claudePool.detail'),
      nexa: { kind: 'check', note: t('vs.row.claudePool.nexa') },
      competitor: { kind: 'cross', note: 'API only' },
    },
    {
      feature: t('vs.row.protocol.feature'),
      detail: t('vs.row.protocol.detail'),
      nexa: { kind: 'check', note: t('vs.row.protocol.nexa') },
      competitor: { kind: 'partial', note: 'OpenAI only' },
    },
    {
      feature: t('vs.row.welcome.feature'),
      detail: t('vs.row.welcome.detail'),
      nexa: { kind: 'text', value: '$5' },
      competitor: { kind: 'text', value: '$0' },
    },
    {
      feature: t('vs.row.privacy.feature'),
      detail: t('vs.row.privacy.detail'),
      nexa: { kind: 'check', note: t('vs.row.privacy.nexa') },
      competitor: { kind: 'partial', note: t('vs.row.privacy.them') },
    },
    {
      feature: t('vs.row.caps.feature'),
      detail: t('vs.row.caps.detail'),
      nexa: { kind: 'check', note: t('vs.row.caps.nexa') },
      competitor: { kind: 'cross' },
    },
    {
      feature: t('vs.row.cache.feature'),
      detail: t('vs.row.cache.detail'),
      nexa: { kind: 'check', note: t('vs.row.cache.nexa') },
      competitor: { kind: 'partial', note: t('vs.row.cache.them') },
    },
    {
      feature: t('vs.row.providers.feature'),
      detail: t('vs.row.providers.detail'),
      nexa: { kind: 'text', value: t('vs.row.providers.nexa') },
      competitor: { kind: 'text', value: t('vs.row.providers.them') },
    },
    {
      feature: t('vs.row.payments.feature'),
      detail: t('vs.row.payments.detail'),
      nexa: { kind: 'check', note: t('vs.row.payments.nexa') },
      competitor: { kind: 'partial', note: 'Stripe / crypto' },
    },
    {
      feature: t('vs.row.uptime.feature'),
      detail: t('vs.row.uptime.detail'),
      nexa: { kind: 'check', note: '/status' },
      competitor: { kind: 'check', note: 'status.openrouter.ai' },
    },
  ];

  return (
    <main className="min-h-screen bg-background">
      <MarketingHeader />

      <section className="container mx-auto max-w-5xl px-4 py-16">
        <div className="text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs">
            <span className="font-mono">Nexa</span>
            <span className="text-muted-foreground">vs.</span>
            <span className="font-mono">OpenRouter</span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">
            <span className={`${headlineSerif.className} text-primary`}>{t('vs.title.lead')}</span>{' '}
            {t('vs.title.tail')}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm text-muted-foreground md:text-base">
            {t('vs.subtitle')}
          </p>
        </div>

        {/* TL;DR strip */}
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          <ValueCard
            big={t('vs.tldr.markup.big')}
            small={t('vs.tldr.markup.small')}
            tone="from-emerald-500/15 to-teal-500/10 text-emerald-700"
          />
          <ValueCard
            big={t('vs.tldr.claude.big')}
            small={t('vs.tldr.claude.small')}
            tone="from-violet-500/15 to-indigo-500/10 text-violet-700"
          />
          <ValueCard
            big={t('vs.tldr.protocol.big')}
            small={t('vs.tldr.protocol.small')}
            tone="from-amber-500/15 to-orange-500/10 text-amber-700"
          />
        </div>

        {/* Comparison table */}
        <div className="mt-12 overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">{t('vs.table.feature')}</th>
                <th className="px-4 py-3 text-foreground">Nexa</th>
                <th className="px-4 py-3">OpenRouter</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.feature} className="align-top">
                  <td className="px-4 py-3">
                    <div className="font-medium">{r.feature}</div>
                    {r.detail && (
                      <div className="mt-0.5 max-w-md text-xs text-muted-foreground">
                        {r.detail}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <CellView c={r.nexa} />
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <CellView c={r.competitor} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* When to choose what — be honest */}
        <div className="mt-12 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-5 dark:border-emerald-900/40 dark:bg-emerald-950/20">
            <div className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
              {t('vs.when.nexa.title')}
            </div>
            <ul className="mt-3 space-y-1.5 text-xs text-emerald-900/90 dark:text-emerald-100/90">
              <li>{t('vs.when.nexa.b1')}</li>
              <li>{t('vs.when.nexa.b2')}</li>
              <li>{t('vs.when.nexa.b3')}</li>
              <li>{t('vs.when.nexa.b4')}</li>
            </ul>
          </div>
          <div className="rounded-xl border border-border bg-muted/20 p-5">
            <div className="text-sm font-semibold">{t('vs.when.them.title')}</div>
            <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
              <li>{t('vs.when.them.b1')}</li>
              <li>{t('vs.when.them.b2')}</li>
              <li>{t('vs.when.them.b3')}</li>
            </ul>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-12 flex flex-wrap justify-center gap-3">
          <Link
            href={'/register' as never}
            className="group inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-medium text-primary-foreground hover:shadow-md"
          >
            {t('vs.cta.try')}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            href={'/pricing' as never}
            className="rounded-md border border-border bg-background px-5 py-3 text-sm font-medium hover:bg-muted"
          >
            {t('vs.cta.pricing')}
          </Link>
        </div>
        <p className="mt-4 text-center text-[10px] text-muted-foreground">
          {t('vs.disclaimer')}
        </p>
      </section>

      <MarketingFooter />
    </main>
  );
}

function ValueCard({ big, small, tone }: { big: string; small: string; tone: string }) {
  return (
    <div className={`rounded-xl border border-border bg-gradient-to-br ${tone} p-5`}>
      <div className="text-2xl font-semibold tracking-tight">{big}</div>
      <div className="mt-1 text-xs">{small}</div>
    </div>
  );
}
