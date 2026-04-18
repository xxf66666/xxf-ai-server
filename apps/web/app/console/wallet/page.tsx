'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiFetch } from '../../../lib/api';
import { useT } from '../../../lib/i18n/context';

interface Overview {
  balanceMud: number;
  spentMud: number;
}
interface HistoryRow {
  id: string;
  codePreview: string;
  valueMud: number;
  redeemedAt: string | null;
}

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const mudToUsd = (mud: number) => mud / 1_000_000;

export default function WalletPage() {
  const qc = useQueryClient();
  const t = useT();

  const { data: overview } = useQuery({
    queryKey: ['console', 'overview'],
    queryFn: () => apiFetch<Overview>('/v1/console/overview'),
    refetchInterval: 5_000,
  });
  const { data: history } = useQuery({
    queryKey: ['console', 'redeem-history'],
    queryFn: () => apiFetch<{ data: HistoryRow[] }>('/v1/console/redeem/history'),
  });

  const [code, setCode] = useState('');
  const [success, setSuccess] = useState<number | null>(null);

  const redeem = useMutation({
    mutationFn: (c: string) =>
      apiFetch<{ valueMud: number }>('/v1/console/redeem', {
        method: 'POST',
        body: JSON.stringify({ code: c }),
      }),
    onSuccess: (res) => {
      setSuccess(res.valueMud);
      setCode('');
      qc.invalidateQueries({ queryKey: ['console', 'overview'] });
      qc.invalidateQueries({ queryKey: ['console', 'redeem-history'] });
    },
  });

  const balance = overview ? mudToUsd(overview.balanceMud) : 0;
  const balClass = balance <= 0 ? 'text-red-600' : balance < 1 ? 'text-amber-600' : 'text-emerald-700';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('wallet.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('wallet.subtitle')}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-background p-6">
          <div className="text-xs text-muted-foreground">{t('wallet.balance')}</div>
          <div className={`mt-1 text-3xl font-semibold ${balClass}`}>
            {overview ? usd.format(balance) : t('common.dash')}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-background p-6">
          <div className="text-xs text-muted-foreground">{t('wallet.spent')}</div>
          <div className="mt-1 text-3xl font-semibold text-muted-foreground">
            {overview ? usd.format(mudToUsd(overview.spentMud)) : t('common.dash')}
          </div>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setSuccess(null);
          if (code.trim()) redeem.mutate(code.trim());
        }}
        className="rounded-lg border border-border bg-background p-4"
      >
        <div className="mb-2 text-sm font-medium">{t('wallet.redeem.title')}</div>
        <div className="flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={t('wallet.redeem.placeholder')}
            required
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 font-mono text-sm"
          />
          <button
            type="submit"
            disabled={redeem.isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {redeem.isPending ? t('wallet.redeem.submitting') : t('wallet.redeem.submit')}
          </button>
        </div>
        {success !== null && (
          <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {t('wallet.redeem.success', { amount: usd.format(mudToUsd(success)) })}
          </div>
        )}
        {redeem.isError && (
          <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {redeem.error instanceof Error ? redeem.error.message : t('common.unknown')}
          </div>
        )}
      </form>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">{t('wallet.history.title')}</h2>
        <div className="rounded-lg border border-border bg-background">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">{t('wallet.history.col.code')}</th>
                <th className="px-4 py-2 text-right font-medium">{t('wallet.history.col.value')}</th>
                <th className="px-4 py-2 font-medium">{t('wallet.history.col.time')}</th>
              </tr>
            </thead>
            <tbody>
              {(history?.data.length ?? 0) === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">
                    {t('wallet.history.empty')}
                  </td>
                </tr>
              )}
              {history?.data.map((h) => (
                <tr key={h.id} className="border-t border-border">
                  <td className="px-4 py-2 font-mono text-xs">{h.codePreview}</td>
                  <td className="px-4 py-2 text-right font-mono text-xs text-emerald-700">
                    +{usd.format(mudToUsd(h.valueMud))}
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    {h.redeemedAt ? new Date(h.redeemedAt).toLocaleString() : t('common.dash')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
