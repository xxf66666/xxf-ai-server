'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { apiFetch } from '../../../lib/api';
import { useT } from '../../../lib/i18n/context';

interface Settings {
  'pool.utilizationTarget': number;
  'pool.minRemainingTokens': number;
  'models.allow': string[];
  'pricing.markupRate': number;
  'pricing.welcomeCreditMud': number;
  'pricing.usdToCnyRate': number;
}

const mudToUsd = (mud: number) => mud / 1_000_000;
const usdToMud = (usd: number) => Math.round(usd * 1_000_000);

export default function SettingsPage() {
  const qc = useQueryClient();
  const t = useT();
  const { data, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => apiFetch<{ data: Settings }>('/admin/v1/settings'),
  });

  const [form, setForm] = useState<Settings | null>(null);
  useEffect(() => {
    if (data) setForm(data.data);
  }, [data]);

  const save = useMutation({
    mutationFn: (body: Partial<Settings>) =>
      apiFetch('/admin/v1/settings', { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  });

  if (isLoading || !form) {
    return <div className="text-sm text-muted-foreground">{t('common.loading')}</div>;
  }

  const discountPct = Math.round((1 - form['pricing.markupRate']) * 100);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('settings.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('settings.subtitle')}</p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate(form);
        }}
        className="space-y-8"
      >
        {/* Pricing section */}
        <section className="space-y-4 rounded-xl border border-border bg-background p-6">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-primary">
              {t('settings.group.pricing')}
            </h2>
            <p className="text-xs text-muted-foreground">{t('settings.group.pricing.desc')}</p>
          </div>

          <label className="block space-y-1 text-sm">
            <span className="font-medium">
              {t('settings.markupRate')}{' '}
              <span className="ml-2 rounded bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-700">
                {t('pricing.savings', { pct: discountPct })}
              </span>
            </span>
            <span className="block text-xs text-muted-foreground">
              {t('settings.markupRate.desc')}
            </span>
            <div className="mt-1 flex items-center gap-3">
              <input
                type="range"
                min={0.5}
                max={1}
                step={0.01}
                value={form['pricing.markupRate']}
                onChange={(e) =>
                  setForm({ ...form, 'pricing.markupRate': Number(e.target.value) })
                }
                className="flex-1"
              />
              <input
                type="number"
                step="0.01"
                min="0.01"
                max="2"
                value={form['pricing.markupRate']}
                onChange={(e) =>
                  setForm({ ...form, 'pricing.markupRate': Number(e.target.value) })
                }
                className="w-24 rounded-md border border-border bg-background px-3 py-1.5 font-mono text-sm"
              />
              <span className="text-sm tabular-nums text-muted-foreground">
                {Math.round(form['pricing.markupRate'] * 100)}%
              </span>
            </div>
          </label>

          <label className="block space-y-1 text-sm">
            <span className="font-medium">{t('settings.welcomeCredit')}</span>
            <span className="block text-xs text-muted-foreground">
              {t('settings.welcomeCredit.desc')}
            </span>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-sm text-muted-foreground">$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                max="1000"
                value={mudToUsd(form['pricing.welcomeCreditMud']).toFixed(2)}
                onChange={(e) =>
                  setForm({
                    ...form,
                    'pricing.welcomeCreditMud': usdToMud(Number(e.target.value)),
                  })
                }
                className="w-36 rounded-md border border-border bg-background px-3 py-1.5 font-mono text-sm"
              />
            </div>
          </label>

          <label className="block space-y-1 text-sm">
            <span className="font-medium">{t('settings.usdToCny')}</span>
            <span className="block text-xs text-muted-foreground">
              {t('settings.usdToCny.desc')}
            </span>
            <input
              type="number"
              step="0.01"
              min="0"
              max="20"
              value={form['pricing.usdToCnyRate']}
              onChange={(e) =>
                setForm({ ...form, 'pricing.usdToCnyRate': Number(e.target.value) })
              }
              className="mt-1 w-36 rounded-md border border-border bg-background px-3 py-1.5 font-mono text-sm"
            />
          </label>
        </section>

        {/* Pool section */}
        <section className="space-y-4 rounded-xl border border-border bg-background p-6">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-primary">
              {t('settings.group.pool')}
            </h2>
            <p className="text-xs text-muted-foreground">{t('settings.group.pool.desc')}</p>
          </div>

          <label className="block space-y-1 text-sm">
            <span className="font-medium">{t('settings.utilTarget')}</span>
            <span className="block text-xs text-muted-foreground">
              {t('settings.utilTarget.desc')}
            </span>
            <input
              type="number"
              step={0.05}
              min={0}
              max={1}
              value={form['pool.utilizationTarget']}
              onChange={(e) =>
                setForm({ ...form, 'pool.utilizationTarget': Number(e.target.value) })
              }
              className="mt-1 w-36 rounded-md border border-border bg-background px-3 py-1.5 font-mono text-sm"
            />
          </label>

          <label className="block space-y-1 text-sm">
            <span className="font-medium">{t('settings.minRemaining')}</span>
            <span className="block text-xs text-muted-foreground">
              {t('settings.minRemaining.desc')}
            </span>
            <input
              type="number"
              min={0}
              value={form['pool.minRemainingTokens']}
              onChange={(e) =>
                setForm({ ...form, 'pool.minRemainingTokens': Number(e.target.value) })
              }
              className="mt-1 w-36 rounded-md border border-border bg-background px-3 py-1.5 font-mono text-sm"
            />
          </label>

          <label className="block space-y-1 text-sm">
            <span className="font-medium">{t('settings.models')}</span>
            <span className="block text-xs text-muted-foreground">{t('settings.models.desc')}</span>
            <textarea
              rows={4}
              value={form['models.allow'].join('\n')}
              onChange={(e) =>
                setForm({
                  ...form,
                  'models.allow': e.target.value
                    .split(/\n+/)
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs"
            />
          </label>
        </section>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={save.isPending}
            className="rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {save.isPending ? t('common.saving') : t('common.save')}
          </button>
          {save.isSuccess && <span className="text-xs text-green-700">{t('common.saved')}</span>}
          {save.isError && (
            <span className="text-xs text-red-700">
              {save.error instanceof Error ? save.error.message : t('settings.saveFail')}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
