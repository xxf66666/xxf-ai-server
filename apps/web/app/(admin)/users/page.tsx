'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiFetch } from '../../../lib/api';
import { useT } from '../../../lib/i18n/context';

interface User {
  id: string;
  email: string;
  role: string;
  balanceMud: number;
  spentMud: number;
  createdAt: string;
}

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const mudToUsd = (mud: number) => mud / 1_000_000;

export default function UsersPage() {
  const qc = useQueryClient();
  const t = useT();
  const { data, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => apiFetch<{ data: User[] }>('/admin/v1/users'),
  });

  const [form, setForm] = useState({ email: '', role: 'consumer' });
  const [topupTarget, setTopupTarget] = useState<User | null>(null);

  const create = useMutation({
    mutationFn: (body: typeof form) =>
      apiFetch('/admin/v1/users', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      setForm({ email: '', role: 'consumer' });
    },
  });
  const del = useMutation({
    mutationFn: (id: string) => apiFetch(`/admin/v1/users/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('users.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('users.subtitle')}</p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate(form);
        }}
        className="flex flex-wrap items-end gap-3 rounded-lg border border-border p-4"
      >
        <label className="flex-1 space-y-1 text-sm">
          <span className="text-xs font-medium">{t('users.form.email')}</span>
          <input
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            type="email"
            required
            className="w-full rounded-md border border-border bg-background px-2 py-1.5"
            placeholder="user@example.com"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-xs font-medium">{t('users.form.role')}</span>
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            className="rounded-md border border-border bg-background px-2 py-1.5"
          >
            <option value="consumer">{t('users.role.consumer')}</option>
            <option value="contributor">{t('users.role.contributor')}</option>
            <option value="admin">{t('users.role.admin')}</option>
          </select>
        </label>
        <button
          type="submit"
          disabled={create.isPending}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {create.isPending ? t('common.creating') : t('users.form.create')}
        </button>
      </form>

      {topupTarget && (
        <TopupModal user={topupTarget} onClose={() => setTopupTarget(null)} />
      )}

      <div className="rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">{t('users.col.email')}</th>
              <th className="px-4 py-2 font-medium">{t('users.col.role')}</th>
              <th className="px-4 py-2 text-right font-medium">{t('users.col.balance')}</th>
              <th className="px-4 py-2 text-right font-medium">{t('users.col.spent')}</th>
              <th className="px-4 py-2 font-medium">{t('users.col.created')}</th>
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
            {data?.data.map((u) => {
              const isConsumer = u.role === 'consumer';
              const bal = mudToUsd(u.balanceMud);
              const balClass =
                !isConsumer ? 'text-muted-foreground'
                  : bal <= 0 ? 'text-red-600 font-medium'
                    : bal < 1 ? 'text-amber-600'
                      : 'text-emerald-700';
              return (
                <tr key={u.id} className="border-t border-border">
                  <td className="px-4 py-2 font-mono text-xs">{u.email}</td>
                  <td className="px-4 py-2">{u.role}</td>
                  <td className={`px-4 py-2 text-right font-mono text-xs ${balClass}`}>
                    {isConsumer ? usd.format(bal) : t('common.dash')}
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-xs text-muted-foreground">
                    {usd.format(mudToUsd(u.spentMud))}
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    {new Date(u.createdAt).toLocaleString()}
                  </td>
                  <td className="space-x-3 px-4 py-2 text-right">
                    {isConsumer && (
                      <button
                        type="button"
                        onClick={() => setTopupTarget(u)}
                        className="text-xs text-primary hover:underline"
                      >
                        {t('users.action.topup')}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(t('users.confirm.delete', { email: u.email }))) del.mutate(u.id);
                      }}
                      className="text-xs text-red-600 hover:underline"
                    >
                      {t('common.delete')}
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

function TopupModal({ user, onClose }: { user: User; onClose: () => void }) {
  const qc = useQueryClient();
  const t = useT();
  const [amount, setAmount] = useState('5');
  const [reason, setReason] = useState('');

  const mutate = useMutation({
    mutationFn: () => {
      const deltaMud = Math.round(parseFloat(amount) * 1_000_000);
      return apiFetch(`/admin/v1/users/${user.id}/balance`, {
        method: 'PATCH',
        body: JSON.stringify({ deltaMud, reason: reason || undefined }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      onClose();
    },
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          mutate.mutate();
        }}
        className="w-full max-w-sm space-y-4 rounded-lg border border-border bg-background p-6 shadow-lg"
      >
        <div>
          <h2 className="text-lg font-semibold">{t('users.topup.title', { email: user.email })}</h2>
          <div className="mt-1 text-xs text-muted-foreground">
            {t('users.col.balance')}:{' '}
            <span className="font-mono">{usd.format(user.balanceMud / 1_000_000)}</span>
          </div>
        </div>
        <label className="block space-y-1 text-sm">
          <span className="text-xs font-medium">{t('users.topup.amount')}</span>
          <input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            className="w-full rounded-md border border-border bg-background px-3 py-2"
          />
          <p className="text-xs text-muted-foreground">{t('users.topup.amount.hint')}</p>
        </label>
        <label className="block space-y-1 text-sm">
          <span className="text-xs font-medium">{t('users.topup.reason')}</span>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2"
          />
        </label>
        {mutate.isError && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {mutate.error instanceof Error ? mutate.error.message : t('common.unknown')}
          </div>
        )}
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
            disabled={mutate.isPending}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {mutate.isPending ? t('users.topup.submitting') : t('users.topup.submit')}
          </button>
        </div>
      </form>
    </div>
  );
}
