'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, RefreshCcw } from 'lucide-react';
import { useT } from '../../lib/i18n/context';
import { MarketingHeader } from '../../components/MarketingHeader';
import { MarketingFooter } from '../../components/MarketingFooter';
import { ProviderIcon } from '../../components/ProviderIcon';

interface StatusResponse {
  ok: boolean;
  checks: { db: 'ok' | 'fail'; redis: 'ok' | 'fail' };
  uptimeSeconds: number;
  version: string;
  commit: string;
  providers: Array<{
    slug: string;
    displayName: string;
    state: 'pool' | 'live' | 'pending';
    modelCount: number;
  }>;
  now: string;
}

function formatUptime(s: number): string {
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export default function StatusPage() {
  const t = useT();
  const [data, setData] = useState<StatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [refreshAt, setRefreshAt] = useState(Date.now());

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const t0 = performance.now();
      try {
        const res = await fetch('/v1/status', { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const j = (await res.json()) as StatusResponse;
        if (cancelled) return;
        setData(j);
        setError(null);
        setLatencyMs(Math.round(performance.now() - t0));
      } catch (e: unknown) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'fetch failed');
        setLatencyMs(null);
      }
    }
    load();
    const id = setInterval(() => {
      setRefreshAt(Date.now());
      load();
    }, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [refreshAt]);

  const apiOk = !error && data?.ok === true;
  const overallTone = apiOk
    ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-100'
    : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-100';

  return (
    <main className="min-h-screen bg-background">
      <MarketingHeader />
      <section className="container mx-auto max-w-4xl px-4 py-12">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{t('status.title')}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t('status.subtitle')}</p>

        <div className={`mt-6 flex flex-wrap items-center gap-4 rounded-xl border px-5 py-4 ${overallTone}`}>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-background/60">
            {apiOk ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
          </div>
          <div className="flex-1">
            <div className="text-base font-semibold">
              {apiOk ? t('status.banner.ok') : t('status.banner.degraded')}
            </div>
            <div className="text-xs opacity-80">
              {error ? error : t('status.banner.subtitle')}
            </div>
          </div>
          {data && (
            <div className="text-right text-xs opacity-80">
              <div>
                <span className="font-mono">{formatUptime(data.uptimeSeconds)}</span>{' '}
                {t('status.uptime')}
              </div>
              <div>
                {latencyMs !== null && (
                  <span className="font-mono">{latencyMs}ms</span>
                )}{' '}
                {t('status.probeLatency')}
              </div>
            </div>
          )}
        </div>

        {/* Component checks */}
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <Component
            name={t('status.component.api')}
            ok={apiOk}
            detail={apiOk ? `v${data?.version ?? '—'}` : t('status.component.unreachable')}
          />
          <Component
            name="Postgres"
            ok={data?.checks.db === 'ok'}
            detail={data?.checks.db ?? '—'}
          />
          <Component
            name="Redis"
            ok={data?.checks.redis === 'ok'}
            detail={data?.checks.redis ?? '—'}
          />
        </div>

        {/* Providers */}
        <h2 className="mt-10 text-xl font-semibold">{t('status.providers.heading')}</h2>
        <p className="text-xs text-muted-foreground">{t('status.providers.subtitle')}</p>
        <div className="mt-4 divide-y divide-border rounded-xl border border-border">
          {(data?.providers ?? []).map((p) => (
            <div key={p.slug} className="flex items-center gap-3 px-4 py-3">
              <ProviderIcon provider={p.slug} size={20} />
              <span className="font-medium">{p.displayName}</span>
              <span className="text-xs text-muted-foreground">
                {p.modelCount} {t('status.providers.models')}
              </span>
              <span className="ml-auto">
                <ProviderState state={p.state} />
              </span>
            </div>
          ))}
        </div>

        {/* Refresh */}
        <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
          <RefreshCcw className="h-3 w-3" />
          {t('status.refreshing')}
          <button
            type="button"
            onClick={() => setRefreshAt(Date.now())}
            className="ml-2 rounded border border-border bg-background px-2 py-0.5 hover:bg-muted"
          >
            {t('status.refreshNow')}
          </button>
        </div>
      </section>
      <MarketingFooter />
    </main>
  );
}

function Component({ name, ok, detail }: { name: string; ok: boolean | undefined; detail: string }) {
  const tone =
    ok === true
      ? 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/30 dark:border-emerald-900/50'
      : ok === false
        ? 'text-rose-700 bg-rose-50 border-rose-200 dark:text-rose-300 dark:bg-rose-950/30 dark:border-rose-900/50'
        : 'text-muted-foreground bg-muted border-border';
  return (
    <div className={`rounded-lg border px-4 py-3 ${tone}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{name}</span>
        <span className="font-mono text-xs">{ok ? '●' : ok === false ? '●' : '○'}</span>
      </div>
      <div className="mt-1 text-xs opacity-80">{detail}</div>
    </div>
  );
}

function ProviderState({ state }: { state: 'pool' | 'live' | 'pending' }) {
  const t = useT();
  if (state === 'pool') {
    return (
      <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">
        {t('status.state.pool')}
      </span>
    );
  }
  if (state === 'live') {
    return (
      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
        {t('status.state.live')}
      </span>
    );
  }
  return (
    <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
      {t('status.state.pending')}
    </span>
  );
}
