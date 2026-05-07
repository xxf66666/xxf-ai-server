'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Check, CheckCircle2, Circle, Plug, Plus, Trash2, X } from 'lucide-react';
import { apiFetch } from '../../../lib/api';
import { useT } from '../../../lib/i18n/context';

interface Provider {
  slug: string;
  displayName: string;
  tagline: string;
  baseUrl: string;
  modelPrefixes: string[];
  openaiCompat: boolean;
  configured: boolean;
  enabled: boolean;
  baseUrlOverride: string | null;
  lastTestedAt: string | null;
  lastTestOk: boolean | null;
}

export default function ProvidersAdminPage() {
  const qc = useQueryClient();
  const t = useT();
  const { data, isLoading } = useQuery({
    queryKey: ['providers'],
    queryFn: () => apiFetch<{ data: Provider[] }>('/admin/v1/providers'),
    refetchInterval: 30_000,
  });
  const [editing, setEditing] = useState<Provider | null>(null);

  const setKey = useMutation({
    mutationFn: ({ slug, apiKey, baseUrlOverride }: { slug: string; apiKey: string; baseUrlOverride: string | null }) =>
      apiFetch(`/admin/v1/providers/${slug}`, {
        method: 'PUT',
        body: JSON.stringify({ apiKey, baseUrlOverride }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['providers'] });
      setEditing(null);
    },
  });
  const clearKey = useMutation({
    mutationFn: (slug: string) =>
      apiFetch(`/admin/v1/providers/${slug}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['providers'] }),
  });
  const toggle = useMutation({
    mutationFn: ({ slug, enabled }: { slug: string; enabled: boolean }) =>
      apiFetch(`/admin/v1/providers/${slug}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['providers'] }),
  });
  const probe = useMutation({
    mutationFn: (slug: string) =>
      apiFetch<{ ok: boolean; status: number; latencyMs: number; body: string }>(
        `/admin/v1/providers/${slug}/test`,
        { method: 'POST' },
      ),
    onSuccess: (r, slug) => {
      qc.invalidateQueries({ queryKey: ['providers'] });
      alert(`${slug}\n\nHTTP ${r.status} · ${r.ok ? 'OK' : 'FAILED'} · ${r.latencyMs}ms\n\n${r.body.slice(0, 200)}`);
    },
  });

  const summary = (data?.data ?? []).reduce(
    (acc, p) => {
      acc.total += 1;
      if (p.configured) acc.configured += 1;
      if (p.configured && p.enabled) acc.live += 1;
      return acc;
    },
    { total: 0, configured: 0, live: 0 },
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('providers.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('providers.subtitle')}</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <SummaryCard label={t('providers.summary.total')} value={summary.total} />
        <SummaryCard label={t('providers.summary.configured')} value={summary.configured} accent="text-emerald-700" />
        <SummaryCard label={t('providers.summary.live')} value={summary.live} accent={summary.live > 0 ? 'text-emerald-700' : ''} />
      </div>

      {isLoading && <div className="text-sm text-muted-foreground">{t('common.loading')}</div>}

      <div className="grid gap-3 md:grid-cols-2">
        {(data?.data ?? []).map((p) => (
          <div key={p.slug} className="rounded-lg border border-border bg-background p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <StatusDot configured={p.configured} enabled={p.enabled} testOk={p.lastTestOk} />
                  <h3 className="text-sm font-semibold">{p.displayName}</h3>
                  <code className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {p.slug}
                  </code>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{p.tagline}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {p.modelPrefixes.map((px) => (
                    <span key={px} className="rounded-full border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                      {px}*
                    </span>
                  ))}
                </div>
              </div>
              <span
                className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                  p.configured && p.enabled
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : p.configured
                      ? 'border-amber-200 bg-amber-50 text-amber-700'
                      : 'border-border bg-muted text-muted-foreground'
                }`}
              >
                {p.configured && p.enabled
                  ? t('providers.state.live')
                  : p.configured
                    ? t('providers.state.disabled')
                    : t('providers.state.notConfigured')}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <button
                type="button"
                onClick={() => setEditing(p)}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 hover:bg-muted"
              >
                {p.configured ? <Plug className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                {p.configured ? t('providers.action.update') : t('providers.action.configure')}
              </button>
              {p.configured && p.openaiCompat && (
                <button
                  type="button"
                  onClick={() => probe.mutate(p.slug)}
                  disabled={probe.isPending}
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 hover:bg-muted disabled:opacity-50"
                >
                  {t('providers.action.test')}
                </button>
              )}
              {p.configured && (
                <button
                  type="button"
                  onClick={() => toggle.mutate({ slug: p.slug, enabled: !p.enabled })}
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 hover:bg-muted"
                >
                  {p.enabled ? t('providers.action.disable') : t('providers.action.enable')}
                </button>
              )}
              {p.configured && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(t('providers.confirm.clear', { name: p.displayName }))) clearKey.mutate(p.slug);
                  }}
                  className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-background px-2.5 py-1 text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-3 w-3" />
                  {t('providers.action.clear')}
                </button>
              )}
            </div>

            {p.lastTestedAt && (
              <div className="mt-2 text-[10px] text-muted-foreground">
                {t('providers.lastTested')}{' '}
                {new Date(p.lastTestedAt).toLocaleString()}
                {' · '}
                {p.lastTestOk ? '✓' : '✗'}
              </div>
            )}
          </div>
        ))}
      </div>

      {editing && (
        <ConfigureModal
          provider={editing}
          onClose={() => setEditing(null)}
          onSubmit={(apiKey, baseUrlOverride) =>
            setKey.mutate({ slug: editing.slug, apiKey, baseUrlOverride })
          }
          submitting={setKey.isPending}
        />
      )}
    </div>
  );
}

function StatusDot({
  configured,
  enabled,
  testOk,
}: {
  configured: boolean;
  enabled: boolean;
  testOk: boolean | null;
}) {
  if (!configured) return <Circle className="h-3 w-3 text-muted-foreground" />;
  if (!enabled) return <Circle className="h-3 w-3 text-amber-500" fill="currentColor" />;
  if (testOk === false) return <X className="h-3 w-3 text-red-600" />;
  return <CheckCircle2 className="h-3 w-3 text-emerald-600" />;
}

function SummaryCard({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-2xl font-semibold tabular-nums ${accent ?? ''}`}>{value}</div>
    </div>
  );
}

function ConfigureModal({
  provider,
  onClose,
  onSubmit,
  submitting,
}: {
  provider: Provider;
  onClose: () => void;
  onSubmit: (apiKey: string, baseUrlOverride: string | null) => void;
  submitting: boolean;
}) {
  const t = useT();
  const [apiKey, setApiKey] = useState('');
  const [override, setOverride] = useState(provider.baseUrlOverride ?? '');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (!apiKey) return;
          onSubmit(apiKey, override.trim() || null);
        }}
        className="w-full max-w-lg space-y-4 rounded-2xl border border-border bg-background p-6 shadow-xl"
      >
        <div>
          <h2 className="text-lg font-semibold">{provider.displayName}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('providers.modal.subtitle')}{' '}
            <code className="rounded bg-muted px-1 py-0.5">{provider.baseUrl}</code>
          </p>
        </div>
        <label className="block space-y-1 text-sm">
          <span className="text-xs font-medium">{t('providers.modal.apiKey')}</span>
          <input
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            type="password"
            autoComplete="off"
            required
            placeholder="sk-…"
            className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs"
          />
          <p className="text-[10px] text-muted-foreground">
            {t('providers.modal.apiKey.hint')}
          </p>
        </label>
        <label className="block space-y-1 text-sm">
          <span className="text-xs font-medium">{t('providers.modal.baseUrl')}</span>
          <input
            value={override}
            onChange={(e) => setOverride(e.target.value)}
            placeholder={provider.baseUrl}
            className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs"
          />
          <p className="text-[10px] text-muted-foreground">
            {t('providers.modal.baseUrl.hint')}
          </p>
        </label>
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-3 py-1.5 text-sm"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={submitting || !apiKey}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            <Check className="h-3.5 w-3.5" />
            {submitting ? t('common.saving') : t('providers.modal.save')}
          </button>
        </div>
      </form>
    </div>
  );
}
