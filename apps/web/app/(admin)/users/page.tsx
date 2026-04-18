'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { CheckCircle2, Clock, Lock, ShieldOff } from 'lucide-react';
import { apiFetch } from '../../../lib/api';
import { useT } from '../../../lib/i18n/context';
import type { DictKey } from '../../../lib/i18n/dict';

type Status = 'pending_verification' | 'active' | 'suspended';

interface User {
  id: string;
  email: string;
  role: string;
  status: Status;
  emailVerified: boolean;
  balanceMud: number;
  spentMud: number;
  lastLoginAt: string | null;
  lastLoginIp: string | null;
  failedLoginCount: number;
  lockedUntil: string | null;
  locked: boolean;
  createdAt: string;
}

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const mudToUsd = (mud: number) => mud / 1_000_000;

const STATUS_FILTERS: Array<{ key: 'all' | Status; label: DictKey }> = [
  { key: 'all', label: 'users.filter.all' },
  { key: 'active', label: 'users.status.active' },
  { key: 'pending_verification', label: 'users.status.pending' },
  { key: 'suspended', label: 'users.status.suspended' },
];

export default function UsersPage() {
  const qc = useQueryClient();
  const t = useT();
  const { data, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => apiFetch<{ data: User[] }>('/admin/v1/users'),
  });

  const [form, setForm] = useState({ email: '', role: 'consumer' });
  const [topupTarget, setTopupTarget] = useState<User | null>(null);
  const [filter, setFilter] = useState<'all' | Status>('all');

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
  const patchStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Status }) =>
      apiFetch(`/admin/v1/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
  const unlock = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/admin/v1/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ unlock: true }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });

  const visible = useMemo(() => {
    const list = data?.data ?? [];
    if (filter === 'all') return list;
    return list.filter((u) => u.status === filter);
  }, [data, filter]);

  const counts = useMemo(() => {
    const c = { all: 0, active: 0, pending_verification: 0, suspended: 0 };
    for (const u of data?.data ?? []) {
      c.all += 1;
      c[u.status] += 1;
    }
    return c;
  }, [data]);

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

      <div className="flex flex-wrap items-center gap-1 rounded-md bg-muted/40 p-1 text-xs">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`rounded px-3 py-1.5 transition ${
              filter === f.key
                ? 'bg-background font-medium shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t(f.label)}{' '}
            <span className="ml-1 text-muted-foreground">({counts[f.key]})</span>
          </button>
        ))}
      </div>

      {topupTarget && (
        <TopupModal user={topupTarget} onClose={() => setTopupTarget(null)} />
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">{t('users.col.email')}</th>
              <th className="px-4 py-2 font-medium">{t('users.col.role')}</th>
              <th className="px-4 py-2 font-medium">{t('users.col.status')}</th>
              <th className="px-4 py-2 text-right font-medium">{t('users.col.balance')}</th>
              <th className="px-4 py-2 text-right font-medium">{t('users.col.spent')}</th>
              <th className="px-4 py-2 font-medium">{t('users.col.lastLogin')}</th>
              <th className="px-4 py-2 font-medium">{t('users.col.created')}</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-muted-foreground">
                  {t('common.loading')}
                </td>
              </tr>
            )}
            {!isLoading && visible.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-muted-foreground">
                  {t('users.empty')}
                </td>
              </tr>
            )}
            {visible.map((u) => {
              const isConsumer = u.role === 'consumer';
              const bal = mudToUsd(u.balanceMud);
              const balClass =
                !isConsumer ? 'text-muted-foreground'
                  : bal <= 0 ? 'text-red-600 font-medium'
                    : bal < 1 ? 'text-amber-600'
                      : 'text-emerald-700';
              return (
                <tr key={u.id} className="border-t border-border">
                  <td className="px-4 py-2 font-mono text-xs">
                    <div className="flex items-center gap-2">
                      <span>{u.email}</span>
                      {u.locked && (
                        <span
                          className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-700"
                          title={t('users.locked.title')}
                        >
                          <Lock className="h-2.5 w-2.5" /> {t('users.locked.badge')}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2">{u.role}</td>
                  <td className="px-4 py-2"><StatusBadge status={u.status} /></td>
                  <td className={`px-4 py-2 text-right font-mono text-xs ${balClass}`}>
                    {isConsumer ? usd.format(bal) : t('common.dash')}
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-xs text-muted-foreground">
                    {usd.format(mudToUsd(u.spentMud))}
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    {u.lastLoginAt ? (
                      <div>
                        <div>{new Date(u.lastLoginAt).toLocaleString()}</div>
                        {u.lastLoginIp && (
                          <div className="font-mono text-[10px] text-muted-foreground/70">
                            {u.lastLoginIp}
                          </div>
                        )}
                      </div>
                    ) : (
                      t('common.dash')
                    )}
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    {new Date(u.createdAt).toLocaleString()}
                  </td>
                  <td className="space-x-3 whitespace-nowrap px-4 py-2 text-right">
                    {u.locked && (
                      <button
                        type="button"
                        onClick={() => unlock.mutate(u.id)}
                        className="text-xs text-primary hover:underline"
                      >
                        {t('users.action.unlock')}
                      </button>
                    )}
                    {u.status === 'pending_verification' && (
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(t('users.confirm.forceVerify', { email: u.email })))
                            patchStatus.mutate({ id: u.id, status: 'active' });
                        }}
                        className="text-xs text-primary hover:underline"
                      >
                        {t('users.action.forceVerify')}
                      </button>
                    )}
                    {u.status === 'active' && (
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(t('users.confirm.suspend', { email: u.email })))
                            patchStatus.mutate({ id: u.id, status: 'suspended' });
                        }}
                        className="text-xs text-amber-700 hover:underline"
                      >
                        {t('users.action.suspend')}
                      </button>
                    )}
                    {u.status === 'suspended' && (
                      <button
                        type="button"
                        onClick={() => patchStatus.mutate({ id: u.id, status: 'active' })}
                        className="text-xs text-emerald-700 hover:underline"
                      >
                        {t('users.action.reactivate')}
                      </button>
                    )}
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
                        if (confirm(t('users.confirm.delete', { email: u.email })))
                          del.mutate(u.id);
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

function StatusBadge({ status }: { status: Status }) {
  const t = useT();
  const map: Record<Status, { label: DictKey; class: string; Icon: typeof CheckCircle2 }> = {
    active: {
      label: 'users.status.active',
      class: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      Icon: CheckCircle2,
    },
    pending_verification: {
      label: 'users.status.pending',
      class: 'border-amber-200 bg-amber-50 text-amber-700',
      Icon: Clock,
    },
    suspended: {
      label: 'users.status.suspended',
      class: 'border-red-200 bg-red-50 text-red-700',
      Icon: ShieldOff,
    },
  };
  const s = map[status];
  const Icon = s.Icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${s.class}`}
    >
      <Icon className="h-3 w-3" />
      {t(s.label)}
    </span>
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
