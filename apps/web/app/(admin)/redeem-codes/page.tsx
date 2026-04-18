'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiFetch } from '../../../lib/api';
import { useT } from '../../../lib/i18n/context';

interface RedeemCode {
  id: string;
  code: string;
  valueMud: number;
  note: string | null;
  redeemedByUserId: string | null;
  redeemedAt: string | null;
  revoked: boolean;
  createdAt: string;
}

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const mudToUsd = (mud: number) => mud / 1_000_000;

function statusOf(r: RedeemCode): 'active' | 'revoked' | 'redeemed' {
  if (r.revoked) return 'revoked';
  if (r.redeemedByUserId) return 'redeemed';
  return 'active';
}

const statusClass: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  redeemed: 'bg-muted text-muted-foreground',
  revoked: 'bg-red-100 text-red-800',
};

export default function RedeemCodesPage() {
  const qc = useQueryClient();
  const t = useT();
  const { data, isLoading } = useQuery({
    queryKey: ['redeem-codes'],
    queryFn: () => apiFetch<{ data: RedeemCode[] }>('/admin/v1/redeem-codes'),
  });

  const [form, setForm] = useState({ valueUsd: 5, count: 10, note: '' });
  const [lastBatch, setLastBatch] = useState<RedeemCode[] | null>(null);

  const mint = useMutation({
    mutationFn: (body: typeof form) =>
      apiFetch<{ data: RedeemCode[] }>('/admin/v1/redeem-codes', {
        method: 'POST',
        body: JSON.stringify({
          valueUsd: body.valueUsd,
          count: body.count,
          note: body.note || undefined,
        }),
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['redeem-codes'] });
      setLastBatch(res.data);
    },
  });
  const revoke = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/admin/v1/redeem-codes/${id}/revoke`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['redeem-codes'] }),
  });
  const del = useMutation({
    mutationFn: (id: string) => apiFetch(`/admin/v1/redeem-codes/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['redeem-codes'] }),
  });

  const copyAll = () => {
    if (!lastBatch) return;
    const text = lastBatch
      .map((c) => `${c.code}\t${usd.format(mudToUsd(c.valueMud))}`)
      .join('\n');
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('redeem.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('redeem.subtitle')}</p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          mint.mutate(form);
        }}
        className="rounded-lg border border-border p-4"
      >
        <div className="grid gap-3 sm:grid-cols-4">
          <label className="space-y-1 text-sm">
            <span className="text-xs font-medium">{t('redeem.form.value')}</span>
            <div className="mb-1 flex gap-1">
              {[1, 5, 10, 20, 50].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setForm({ ...form, valueUsd: v })}
                  className={`rounded border px-2 py-0.5 text-xs ${
                    form.valueUsd === v
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground'
                  }`}
                >
                  ${v}
                </button>
              ))}
            </div>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={form.valueUsd}
              onChange={(e) => setForm({ ...form, valueUsd: Number(e.target.value) })}
              required
              className="w-full rounded-md border border-border bg-background px-2 py-1.5"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-xs font-medium">{t('redeem.form.count')}</span>
            <input
              type="number"
              min="1"
              max="200"
              value={form.count}
              onChange={(e) => setForm({ ...form, count: Number(e.target.value) })}
              required
              className="w-full rounded-md border border-border bg-background px-2 py-1.5"
            />
          </label>
          <label className="space-y-1 text-sm sm:col-span-2">
            <span className="text-xs font-medium">{t('redeem.form.note')}</span>
            <input
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder={t('redeem.form.note.placeholder')}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5"
            />
          </label>
        </div>
        <div className="mt-3 flex items-center gap-3 text-sm">
          <button
            type="submit"
            disabled={mint.isPending}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {mint.isPending ? t('redeem.form.minting') : t('redeem.form.mint')}
          </button>
          <span className="text-xs text-muted-foreground">
            {usd.format(form.valueUsd)} × {form.count} = {usd.format(form.valueUsd * form.count)}
          </span>
        </div>
      </form>

      {lastBatch && lastBatch.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="flex items-center justify-between">
            <div className="font-medium">
              {t('redeem.minted.title', { count: lastBatch.length })}
            </div>
            <button
              type="button"
              onClick={copyAll}
              className="rounded border border-amber-400 px-2 py-1 text-xs hover:bg-amber-100"
            >
              {t('redeem.copyAll')}
            </button>
          </div>
          <ul className="mt-2 space-y-1 font-mono text-xs">
            {lastBatch.map((c) => (
              <li key={c.id}>
                {c.code}
                <span className="ml-3 text-amber-700">
                  {usd.format(mudToUsd(c.valueMud))}
                </span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setLastBatch(null)}
            className="mt-2 text-xs text-amber-700 hover:underline"
          >
            {t('common.dismiss')}
          </button>
        </div>
      )}

      <div className="rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">{t('redeem.col.code')}</th>
              <th className="px-4 py-2 text-right font-medium">{t('redeem.col.value')}</th>
              <th className="px-4 py-2 font-medium">{t('redeem.col.note')}</th>
              <th className="px-4 py-2 font-medium">{t('redeem.col.status')}</th>
              <th className="px-4 py-2 font-medium">{t('redeem.col.created')}</th>
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
                  {t('redeem.empty')}
                </td>
              </tr>
            )}
            {data?.data.map((r) => {
              const s = statusOf(r);
              return (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-4 py-2">
                    <button
                      type="button"
                      onClick={() => navigator.clipboard.writeText(r.code)}
                      className="font-mono text-xs hover:underline"
                      title={r.code}
                    >
                      {r.code}
                    </button>
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-xs">
                    {usd.format(mudToUsd(r.valueMud))}
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    {r.note ?? t('common.dash')}
                  </td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${statusClass[s]}`}>
                      {t(`redeem.status.${s}` as 'redeem.status.active')}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    {new Date(r.createdAt).toLocaleString()}
                  </td>
                  <td className="space-x-3 px-4 py-2 text-right">
                    {s === 'active' && (
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(t('redeem.confirm.revoke', { code: r.code })))
                            revoke.mutate(r.id);
                        }}
                        className="text-xs text-amber-700 hover:underline"
                      >
                        {t('redeem.action.revoke')}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(t('redeem.confirm.delete', { code: r.code }))) del.mutate(r.id);
                      }}
                      className="text-xs text-red-600 hover:underline"
                    >
                      {t('redeem.action.delete')}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
