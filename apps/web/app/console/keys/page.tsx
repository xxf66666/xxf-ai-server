'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiFetch } from '../../../lib/api';
import { useT } from '../../../lib/i18n/context';

interface Key {
  id: string;
  name: string;
  keyPreview: string;
  status: 'active' | 'revoked';
  usedMonthlyTokens: number;
  quotaMonthlyTokens: number | null;
  allowedModels: string[] | null;
  dailyCapUsd: number | null;
  weeklyCapUsd: number | null;
  monthlyCapUsd: number | null;
  createdAt: string;
}

interface Model {
  id: string;
  provider: string;
}

const fmt = new Intl.NumberFormat();

export default function ConsoleKeysPage() {
  const qc = useQueryClient();
  const t = useT();
  const base = typeof window !== 'undefined' ? window.location.origin : '';

  const { data, isLoading } = useQuery({
    queryKey: ['console', 'keys'],
    queryFn: () => apiFetch<{ data: Key[] }>('/v1/console/keys'),
  });
  const { data: models } = useQuery({
    queryKey: ['console', 'models-list'],
    queryFn: () => apiFetch<{ data: Model[] }>('/v1/console/models'),
  });

  const [name, setName] = useState('');
  const [allowedModels, setAllowedModels] = useState<string[]>([]);
  const [minted, setMinted] = useState<string | null>(null);
  const [editingCaps, setEditingCaps] = useState<Key | null>(null);

  const mint = useMutation({
    mutationFn: (n: string) =>
      apiFetch<{ key: string }>('/v1/console/keys', {
        method: 'POST',
        body: JSON.stringify({
          name: n,
          allowedModels: allowedModels.length === 0 ? null : allowedModels,
        }),
      }),
    onSuccess: (res) => {
      setMinted(res.key);
      setName('');
      setAllowedModels([]);
      qc.invalidateQueries({ queryKey: ['console', 'keys'] });
    },
  });
  const revoke = useMutation({
    mutationFn: (id: string) => apiFetch(`/v1/console/keys/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['console', 'keys'] }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('console.keys.title')}</h1>
        <p className="text-sm text-muted-foreground">
          {t('console.keys.subtitle', { base })}
        </p>
      </div>

      <div className="rounded-lg border border-border bg-background p-4 text-sm">
        <div className="mb-1 text-xs font-medium text-muted-foreground">{t('console.keys.endpoint')}</div>
        <code className="block break-all rounded bg-muted px-3 py-2 font-mono text-xs">{base}/v1</code>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) mint.mutate(name.trim());
        }}
        className="space-y-3 rounded-lg border border-border bg-background p-4"
      >
        <label className="block space-y-1 text-sm">
          <span className="text-xs font-medium">{t('keys.form.name')}</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('keys.form.name.placeholder')}
            required
            className="w-full rounded-md border border-border bg-background px-2 py-1.5"
          />
        </label>
        <div className="space-y-1 text-sm">
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-medium">{t('keys.form.allowedModels')}</span>
            <span className="text-[10px] text-muted-foreground">
              {allowedModels.length === 0
                ? t('keys.form.allowedModels.all')
                : t('keys.form.allowedModels.n').replace('{n}', String(allowedModels.length))}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(models?.data ?? []).map((m) => {
              const on = allowedModels.includes(m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setAllowedModels((cur) =>
                      cur.includes(m.id) ? cur.filter((x) => x !== m.id) : [...cur, m.id],
                    );
                  }}
                  className={`rounded-full border px-2.5 py-0.5 font-mono text-[11px] ${
                    on
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background hover:bg-muted'
                  }`}
                >
                  {m.id}
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-muted-foreground">
            {t('keys.form.allowedModels.hint')}
          </p>
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={mint.isPending}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {mint.isPending ? t('keys.form.minting') : t('keys.form.mint')}
          </button>
        </div>
      </form>

      {minted && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="font-medium">{t('keys.minted.title')}</div>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 break-all rounded bg-white px-2 py-1 font-mono text-xs">{minted}</code>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(minted)}
              className="rounded border border-amber-400 px-2 py-1 text-xs hover:bg-amber-100"
            >
              {t('common.copy')}
            </button>
            <button
              type="button"
              onClick={() => setMinted(null)}
              className="rounded border border-amber-400 px-2 py-1 text-xs hover:bg-amber-100"
            >
              {t('common.dismiss')}
            </button>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-border bg-background">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">{t('keys.col.name')}</th>
              <th className="px-4 py-2 font-medium">{t('keys.col.key')}</th>
              <th className="px-4 py-2 font-medium">{t('keys.col.status')}</th>
              <th className="px-4 py-2 font-medium">{t('keys.col.allowedModels')}</th>
              <th className="px-4 py-2 font-medium text-right">{t('keys.col.used')}</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                  {t('common.loading')}
                </td>
              </tr>
            )}
            {!isLoading && (data?.data.length ?? 0) === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                  {t('console.keys.none')}
                </td>
              </tr>
            )}
            {data?.data.map((k) => (
              <tr key={k.id} className="border-t border-border">
                <td className="px-4 py-2">{k.name}</td>
                <td className="px-4 py-2 font-mono text-xs">{k.keyPreview}</td>
                <td className="px-4 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      k.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-muted'
                    }`}
                  >
                    {k.status}
                  </span>
                </td>
                <td className="px-4 py-2 text-xs">
                  {!k.allowedModels || k.allowedModels.length === 0 ? (
                    <span className="text-muted-foreground">{t('keys.col.allowedModels.all')}</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {k.allowedModels.map((m) => (
                        <span
                          key={m}
                          className="rounded-full border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]"
                        >
                          {m}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-4 py-2 text-right">{fmt.format(k.usedMonthlyTokens)}</td>
                <td className="space-x-3 whitespace-nowrap px-4 py-2 text-right">
                  {k.status === 'active' && (
                    <button
                      type="button"
                      onClick={() => setEditingCaps(k)}
                      className="text-xs text-primary hover:underline"
                    >
                      {(k.dailyCapUsd ?? k.weeklyCapUsd ?? k.monthlyCapUsd) != null
                        ? t('keys.action.editCaps')
                        : t('keys.action.setCaps')}
                    </button>
                  )}
                  {k.status === 'active' && (
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(t('keys.confirm.revoke', { name: k.name }))) revoke.mutate(k.id);
                      }}
                      className="text-xs text-red-600 hover:underline"
                    >
                      {t('common.revoke')}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingCaps && (
        <CapsModal
          k={editingCaps}
          onClose={() => setEditingCaps(null)}
          onSaved={() => qc.invalidateQueries({ queryKey: ['console', 'keys'] })}
        />
      )}
    </div>
  );
}

function CapsModal({
  k,
  onClose,
  onSaved,
}: {
  k: Key;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT();
  const [day, setDay] = useState(k.dailyCapUsd === null ? '' : String(k.dailyCapUsd));
  const [week, setWeek] = useState(k.weeklyCapUsd === null ? '' : String(k.weeklyCapUsd));
  const [month, setMonth] = useState(
    k.monthlyCapUsd === null ? '' : String(k.monthlyCapUsd),
  );
  const { data: spending } = useQuery({
    queryKey: ['console', 'keys', k.id, 'spending'],
    queryFn: () =>
      apiFetch<{
        dayUsd: number;
        weekUsd: number;
        monthUsd: number;
      }>(`/v1/console/keys/${k.id}/spending`),
  });

  const save = useMutation({
    mutationFn: () =>
      apiFetch(`/v1/console/keys/${k.id}/caps`, {
        method: 'PATCH',
        body: JSON.stringify({
          dailyCapUsd: day === '' ? null : Number(day),
          weeklyCapUsd: week === '' ? null : Number(week),
          monthlyCapUsd: month === '' ? null : Number(month),
        }),
      }),
    onSuccess: () => {
      onSaved();
      onClose();
    },
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
        className="w-full max-w-md space-y-4 rounded-2xl border border-border bg-background p-6 shadow-xl"
      >
        <div>
          <h2 className="text-lg font-semibold">{t('keys.caps.title')}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('keys.caps.subtitle')} <code className="font-mono">{k.name}</code>
          </p>
        </div>
        <CapField label={t('keys.caps.day')} spent={spending?.dayUsd ?? 0} value={day} onChange={setDay} />
        <CapField label={t('keys.caps.week')} spent={spending?.weekUsd ?? 0} value={week} onChange={setWeek} />
        <CapField label={t('keys.caps.month')} spent={spending?.monthUsd ?? 0} value={month} onChange={setMonth} />
        <p className="text-[10px] text-muted-foreground">{t('keys.caps.hint')}</p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-3 py-1.5 text-sm"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={save.isPending}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {save.isPending ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </form>
    </div>
  );
}

function CapField({
  label,
  spent,
  value,
  onChange,
}: {
  label: string;
  spent: number;
  value: string;
  onChange: (v: string) => void;
}) {
  const cap = value === '' ? null : Number(value);
  const pct = cap && cap > 0 ? Math.min(100, Math.round((spent / cap) * 100)) : 0;
  const danger = cap !== null && spent >= cap;
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="font-mono text-[11px] text-muted-foreground">
          {spent < 0.01 ? '$' + spent.toFixed(4) : '$' + spent.toFixed(2)}
          {cap !== null && cap > 0 ? ' / $' + cap.toFixed(2) : ''}
        </span>
      </div>
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          type="number"
          step="0.01"
          min="0"
          placeholder="—"
          className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 font-mono text-sm"
        />
      </div>
      {cap !== null && cap > 0 && (
        <div className="h-1.5 w-full rounded-full bg-muted">
          <div
            className={`h-full rounded-full transition-all ${
              danger ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}
