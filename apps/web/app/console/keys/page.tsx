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
  createdAt: string;
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

  const [name, setName] = useState('');
  const [minted, setMinted] = useState<string | null>(null);

  const mint = useMutation({
    mutationFn: (n: string) =>
      apiFetch<{ key: string }>('/v1/console/keys', {
        method: 'POST',
        body: JSON.stringify({ name: n }),
      }),
    onSuccess: (res) => {
      setMinted(res.key);
      setName('');
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
        className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-background p-4"
      >
        <label className="flex-1 space-y-1 text-sm">
          <span className="text-xs font-medium">{t('keys.form.name')}</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('keys.form.name.placeholder')}
            required
            className="w-full rounded-md border border-border bg-background px-2 py-1.5"
          />
        </label>
        <button
          type="submit"
          disabled={mint.isPending}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {mint.isPending ? t('keys.form.minting') : t('keys.form.mint')}
        </button>
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
              <th className="px-4 py-2 font-medium text-right">{t('keys.col.used')}</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                  {t('common.loading')}
                </td>
              </tr>
            )}
            {!isLoading && (data?.data.length ?? 0) === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
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
