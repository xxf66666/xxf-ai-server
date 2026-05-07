'use client';

import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Circle, Sparkles } from 'lucide-react';
import { apiFetch } from '../../../lib/api';
import { useT } from '../../../lib/i18n/context';
import type { DictKey } from '../../../lib/i18n/dict';
import { ProviderIcon } from '../../../components/ProviderIcon';

type State = 'pool' | 'live' | 'pending' | 'disabled';

interface Model {
  id: string;
  tier: string | null;
  inputUsdPerM: number;
  outputUsdPerM: number;
  cacheReadUsdPerM: number | null;
  cacheCreationUsdPerM: number | null;
}

interface ProviderGroup {
  slug: string;
  displayName: string;
  tagline: string;
  state: State;
  models: Model[];
}

const STATE_LABEL: Record<State, DictKey> = {
  pool: 'console.catalog.state.pool',
  live: 'console.catalog.state.live',
  pending: 'console.catalog.state.pending',
  disabled: 'console.catalog.state.disabled',
};

const STATE_CLASS: Record<State, string> = {
  pool: 'border-violet-200 bg-violet-50 text-violet-800',
  live: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  pending: 'border-border bg-muted text-muted-foreground',
  disabled: 'border-amber-200 bg-amber-50 text-amber-800',
};

const TIER_BADGE: Record<string, string> = {
  flagship: 'border-violet-200 bg-violet-50 text-violet-700',
  opus: 'border-violet-200 bg-violet-50 text-violet-700',
  sonnet: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  reasoning: 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700',
  codex: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  mid: 'border-sky-200 bg-sky-50 text-sky-700',
  haiku: 'border-cyan-200 bg-cyan-50 text-cyan-700',
  small: 'border-amber-200 bg-amber-50 text-amber-700',
};

const fmtUsd = (n: number) => (n < 0.01 ? '$' + n.toFixed(4) : '$' + n.toFixed(2));

export default function ConsoleModelsPage() {
  const t = useT();
  const { data, isLoading } = useQuery({
    queryKey: ['console', 'catalog'],
    queryFn: () => apiFetch<{ data: ProviderGroup[] }>('/v1/console/catalog'),
    refetchInterval: 60_000,
  });

  const visible = (data?.data ?? []).filter((p) => p.models.length > 0 || p.state === 'pool');
  const live = visible.filter((p) => p.state === 'live' || p.state === 'pool');
  const pending = visible.filter((p) => p.state === 'pending' || p.state === 'disabled');

  const totalModels = visible.reduce((acc, p) => acc + p.models.length, 0);
  const liveModels = live.reduce((acc, p) => acc + p.models.length, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('console.catalog.title')}</h1>
        <p className="text-sm text-muted-foreground">
          {t('console.catalog.subtitle')
            .replace('{total}', String(totalModels))
            .replace('{live}', String(liveModels))
            .replace('{providers}', String(visible.length))}
        </p>
      </div>

      {isLoading && <div className="text-sm text-muted-foreground">{t('common.loading')}</div>}

      {/* Live / pool providers first */}
      {live.length > 0 && (
        <section className="space-y-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
            <Sparkles className="h-4 w-4" />
            {t('console.catalog.liveSection')}
          </h2>
          <div className="space-y-4">
            {live.map((p) => (
              <ProviderCard key={p.slug} group={p} />
            ))}
          </div>
        </section>
      )}

      {/* Coming soon (pending / disabled) — greyed grid */}
      {pending.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">
            {t('console.catalog.comingSoonSection')}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pending.map((p) => (
              <div
                key={p.slug}
                className="rounded-lg border border-dashed border-border bg-muted/20 p-4 opacity-70"
              >
                <div className="flex items-center gap-2">
                  <ProviderIcon provider={p.slug} size={18} monochrome />
                  <span className="text-sm font-semibold">{p.displayName}</span>
                  <span
                    className={`ml-auto inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${STATE_CLASS[p.state]}`}
                  >
                    <Circle className="h-2 w-2" />
                    {t(STATE_LABEL[p.state])}
                  </span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{p.tagline}</div>
                <div className="mt-2 text-[10px] text-muted-foreground">
                  {p.models.length} {t('console.catalog.modelsCount')}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ProviderCard({ group }: { group: ProviderGroup }) {
  const t = useT();
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-background">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/30 px-4 py-3">
        <ProviderIcon provider={group.slug} size={20} />
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">{group.displayName}</span>
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${STATE_CLASS[group.state]}`}
            >
              <CheckCircle2 className="h-2.5 w-2.5" />
              {t(STATE_LABEL[group.state])}
            </span>
          </div>
          <div className="text-[11px] text-muted-foreground">{group.tagline}</div>
        </div>
      </div>
      {group.models.length === 0 ? (
        <div className="px-4 py-3 text-xs text-muted-foreground">
          {t('console.catalog.noModelsHere')}
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-muted/20 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">{t('console.catalog.col.model')}</th>
              <th className="px-4 py-2 font-medium">{t('console.catalog.col.tier')}</th>
              <th className="px-4 py-2 text-right font-medium">{t('console.catalog.col.input')}</th>
              <th className="px-4 py-2 text-right font-medium">{t('console.catalog.col.cacheRead')}</th>
              <th className="px-4 py-2 text-right font-medium">{t('console.catalog.col.output')}</th>
            </tr>
          </thead>
          <tbody>
            {group.models.map((m) => (
              <tr key={m.id} className="border-t border-border">
                <td className="px-4 py-2 font-mono text-xs">{m.id}</td>
                <td className="px-4 py-2">
                  {m.tier ? (
                    <span
                      className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium border ${
                        TIER_BADGE[m.tier] ?? 'border-border bg-muted text-muted-foreground'
                      }`}
                    >
                      {m.tier}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">{t('common.dash')}</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-right font-mono text-xs">
                  {fmtUsd(m.inputUsdPerM)}{' '}
                  <span className="text-[10px] text-muted-foreground">{t('pricing.unit')}</span>
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-right font-mono text-xs text-emerald-700">
                  {m.cacheReadUsdPerM !== null
                    ? fmtUsd(m.cacheReadUsdPerM)
                    : t('common.dash')}
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-right font-mono text-xs">
                  {fmtUsd(m.outputUsdPerM)}{' '}
                  <span className="text-[10px] text-muted-foreground">{t('pricing.unit')}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
