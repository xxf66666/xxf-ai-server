'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiFetch } from '../../../lib/api';
import { useT } from '../../../lib/i18n/context';

interface Account {
  id: string;
  provider: 'claude' | 'chatgpt';
  plan: string;
  label: string | null;
  ownerUserId: string | null;
  shared: boolean;
  status: string;
  windowTokensUsed: number;
  lastUsedAt: string | null;
  coolingUntil: string | null;
  createdAt: string;
}

interface User {
  id: string;
  email: string;
  role: string;
}

const fmt = new Intl.NumberFormat();

const statusColor: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  cooling: 'bg-amber-100 text-amber-800',
  rate_limited: 'bg-amber-100 text-amber-800',
  needs_reauth: 'bg-red-100 text-red-800',
  banned: 'bg-red-200 text-red-900',
};

export default function AccountsPage() {
  const qc = useQueryClient();
  const t = useT();
  const [showForm, setShowForm] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => apiFetch<{ data: Account[] }>('/admin/v1/accounts'),
  });
  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: () => apiFetch<{ data: User[] }>('/admin/v1/users'),
  });

  const del = useMutation({
    mutationFn: (id: string) => apiFetch(`/admin/v1/accounts/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts'] }),
  });
  const probe = useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ ok: boolean; status: number; classification: string; latencyMs: number }>(
        `/admin/v1/accounts/${id}/probe`,
        { method: 'POST' },
      ),
    onSuccess: (res, id) => {
      qc.invalidateQueries({ queryKey: ['accounts'] });
      alert(
        `probe ${id.slice(0, 8)}…\nHTTP ${res.status} → ${res.classification}\n${res.latencyMs}ms`,
      );
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('accounts.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('accounts.subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
        >
          {t('accounts.attach')}
        </button>
      </div>

      {showForm && (
        <AttachForm users={usersData?.data ?? []} onClose={() => setShowForm(false)} />
      )}

      <div className="rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">{t('accounts.col.label')}</th>
              <th className="px-4 py-2 font-medium">{t('accounts.col.provider')}</th>
              <th className="px-4 py-2 font-medium">{t('accounts.col.plan')}</th>
              <th className="px-4 py-2 font-medium">{t('accounts.col.shared')}</th>
              <th className="px-4 py-2 font-medium">{t('accounts.col.status')}</th>
              <th className="px-4 py-2 font-medium text-right">{t('accounts.col.window')}</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td className="px-4 py-6 text-center text-muted-foreground" colSpan={7}>
                  {t('common.loading')}
                </td>
              </tr>
            )}
            {!isLoading && (data?.data.length ?? 0) === 0 && (
              <tr>
                <td className="px-4 py-6 text-center text-muted-foreground" colSpan={7}>
                  {t('accounts.empty')}
                </td>
              </tr>
            )}
            {data?.data.map((a) => (
              <tr key={a.id} className="border-t border-border">
                <td className="px-4 py-2">
                  {a.label ?? <span className="text-muted-foreground">{t('common.dash')}</span>}
                </td>
                <td className="px-4 py-2">{a.provider}</td>
                <td className="px-4 py-2">{a.plan}</td>
                <td className="px-4 py-2">{a.shared ? t('common.yes') : t('common.no')}</td>
                <td className="px-4 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${statusColor[a.status] ?? 'bg-muted'}`}>
                    {a.status}
                  </span>
                </td>
                <td className="px-4 py-2 text-right">{fmt.format(a.windowTokensUsed)}</td>
                <td className="space-x-3 px-4 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => probe.mutate(a.id)}
                    disabled={probe.isPending}
                    className="text-xs text-primary hover:underline disabled:opacity-60"
                  >
                    {t('accounts.action.probe')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(t('accounts.confirm.detach', { name: a.label ?? a.id }))) del.mutate(a.id);
                    }}
                    className="text-xs text-red-600 hover:underline"
                  >
                    {t('accounts.action.detach')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AttachForm({ users, onClose }: { users: User[]; onClose: () => void }) {
  const qc = useQueryClient();
  const t = useT();
  const [form, setForm] = useState({
    provider: 'claude',
    plan: 'max20x',
    label: '',
    ownerUserId: users[0]?.id ?? '',
    shared: true,
    oauthAccessToken: '',
    oauthRefreshToken: '',
  });
  const [error, setError] = useState<string | null>(null);

  const attach = useMutation({
    mutationFn: (body: typeof form) =>
      apiFetch('/admin/v1/accounts', {
        method: 'POST',
        body: JSON.stringify({
          provider: body.provider,
          plan: body.plan,
          label: body.label || undefined,
          ownerUserId: body.ownerUserId || undefined,
          shared: body.shared,
          oauthAccessToken: body.oauthAccessToken,
          oauthRefreshToken: body.oauthRefreshToken || undefined,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['accounts'] });
      onClose();
    },
    onError: (err) => setError(err instanceof Error ? err.message : t('common.unknown')),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        attach.mutate(form);
      }}
      className="space-y-3 rounded-lg border border-border bg-muted/20 p-4"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="text-xs font-medium">{t('accounts.attach.provider')}</span>
          <select
            value={form.provider}
            onChange={(e) => setForm({ ...form, provider: e.target.value })}
            className="w-full rounded-md border border-border bg-background px-2 py-1.5"
          >
            <option value="claude">claude</option>
            <option value="chatgpt">chatgpt</option>
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-xs font-medium">{t('accounts.attach.plan')}</span>
          <select
            value={form.plan}
            onChange={(e) => setForm({ ...form, plan: e.target.value })}
            className="w-full rounded-md border border-border bg-background px-2 py-1.5"
          >
            <option value="pro">pro</option>
            <option value="max5x">max5x</option>
            <option value="max20x">max20x</option>
            <option value="plus">plus</option>
            <option value="pro_chatgpt">pro_chatgpt</option>
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-xs font-medium">{t('accounts.attach.label')}</span>
          <input
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
            className="w-full rounded-md border border-border bg-background px-2 py-1.5"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-xs font-medium">{t('accounts.attach.owner')}</span>
          <select
            value={form.ownerUserId}
            onChange={(e) => setForm({ ...form, ownerUserId: e.target.value })}
            className="w-full rounded-md border border-border bg-background px-2 py-1.5"
          >
            <option value="">{t('common.none')}</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.email}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.shared}
          onChange={(e) => setForm({ ...form, shared: e.target.checked })}
        />
        {t('accounts.attach.shared')}
      </label>
      <label className="block space-y-1 text-sm">
        <span className="text-xs font-medium">{t('accounts.attach.accessToken')}</span>
        <textarea
          rows={2}
          value={form.oauthAccessToken}
          onChange={(e) => setForm({ ...form, oauthAccessToken: e.target.value })}
          required
          className="w-full rounded-md border border-border bg-background px-2 py-1.5 font-mono text-xs"
          placeholder="sk-ant-oat01-…"
        />
      </label>
      <label className="block space-y-1 text-sm">
        <span className="text-xs font-medium">{t('accounts.attach.refreshToken')}</span>
        <textarea
          rows={2}
          value={form.oauthRefreshToken}
          onChange={(e) => setForm({ ...form, oauthRefreshToken: e.target.value })}
          className="w-full rounded-md border border-border bg-background px-2 py-1.5 font-mono text-xs"
        />
      </label>
      {error && <div className="text-xs text-red-700">{error}</div>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-md border border-border px-3 py-1.5 text-sm">
          {t('common.cancel')}
        </button>
        <button
          type="submit"
          disabled={attach.isPending}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {attach.isPending ? t('accounts.attach.submitting') : t('accounts.attach.submit')}
        </button>
      </div>
    </form>
  );
}
