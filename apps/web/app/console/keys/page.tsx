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
                <td className="px-4 py-2 text-right">
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
    </div>
  );
}
