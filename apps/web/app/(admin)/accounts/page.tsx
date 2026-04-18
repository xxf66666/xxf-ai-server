'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Flame,
  ShieldOff,
  Snowflake,
} from 'lucide-react';
import { apiFetch } from '../../../lib/api';
import { useT } from '../../../lib/i18n/context';
import type { DictKey } from '../../../lib/i18n/dict';

type AccountStatus =
  | 'active'
  | 'cooling'
  | 'rate_limited'
  | 'needs_reauth'
  | 'banned';

interface Account {
  id: string;
  provider: 'claude' | 'chatgpt';
  plan: string;
  label: string | null;
  ownerUserId: string | null;
  shared: boolean;
  status: AccountStatus;
  windowTokensUsed: number;
  windowTokensUsedLive: number;
  windowLimit: number | null;
  tokenExpiresAt: string | null;
  lastUsedAt: string | null;
  lastProbeAt: string | null;
  lastProbeOk: boolean | null;
  coolingUntil: string | null;
  createdAt: string;
}

interface User {
  id: string;
  email: string;
  role: string;
}

const fmt = new Intl.NumberFormat();

const STATUS_META: Record<
  AccountStatus,
  { label: DictKey; cls: string; Icon: typeof CheckCircle2 }
> = {
  active: {
    label: 'accounts.status.active',
    cls: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    Icon: CheckCircle2,
  },
  cooling: {
    label: 'accounts.status.cooling',
    cls: 'border-sky-200 bg-sky-50 text-sky-700',
    Icon: Snowflake,
  },
  rate_limited: {
    label: 'accounts.status.rate_limited',
    cls: 'border-amber-200 bg-amber-50 text-amber-800',
    Icon: Flame,
  },
  needs_reauth: {
    label: 'accounts.status.needs_reauth',
    cls: 'border-red-200 bg-red-50 text-red-700',
    Icon: AlertCircle,
  },
  banned: {
    label: 'accounts.status.banned',
    cls: 'border-red-300 bg-red-100 text-red-900',
    Icon: ShieldOff,
  },
};

function fmtCountdown(ms: number): string {
  if (ms <= 0) return '0s';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m < 60) return r ? `${m}m ${r}s` : `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

// Tick every second so cooling countdowns refresh smoothly. Poll the
// API separately every 15s to pick up status transitions.
function useTick(intervalMs = 1000): number {
  const [, setN] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setN((n) => n + 1), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return Date.now();
}

function StatusBadge({
  status,
  coolingUntil,
  nowMs,
}: {
  status: AccountStatus;
  coolingUntil: string | null;
  nowMs: number;
}) {
  const t = useT();
  const meta = STATUS_META[status] ?? STATUS_META.active;
  const Icon = meta.Icon;
  const coolRemainMs = coolingUntil ? new Date(coolingUntil).getTime() - nowMs : 0;
  const showCountdown =
    (status === 'cooling' || status === 'rate_limited') && coolRemainMs > 0;
  return (
    <div className="inline-flex flex-col items-start gap-0.5">
      <span
        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${meta.cls}`}
      >
        <Icon className="h-3 w-3" />
        {t(meta.label)}
      </span>
      {showCountdown && (
        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
          <Clock className="h-2.5 w-2.5" />
          {t('accounts.coolingIn').replace('{time}', fmtCountdown(coolRemainMs))}
        </span>
      )}
    </div>
  );
}

function WindowBar({
  used,
  limit,
}: {
  used: number;
  limit: number | null;
}) {
  if (!limit) return <span className="text-xs text-muted-foreground">—</span>;
  const pct = Math.min(100, Math.round((used / limit) * 100));
  const color =
    pct >= 95 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : pct >= 50 ? 'bg-sky-500' : 'bg-emerald-500';
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between font-mono text-[11px]">
        <span>{fmt.format(used)}</span>
        <span className="text-muted-foreground">/ {fmt.format(limit)}</span>
      </div>
      <div className="h-1.5 w-36 rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function AccountsPage() {
  const qc = useQueryClient();
  const t = useT();
  const [showForm, setShowForm] = useState(false);
  const nowMs = useTick(1000);

  const { data, isLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => apiFetch<{ data: Account[] }>('/admin/v1/accounts'),
    refetchInterval: 15_000,
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
  const patch = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      apiFetch(`/admin/v1/accounts/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts'] }),
  });

  // Totals for the summary strip.
  const summary = (data?.data ?? []).reduce(
    (acc, a) => {
      acc.total += 1;
      if (a.status === 'active') acc.active += 1;
      else if (a.status === 'cooling' || a.status === 'rate_limited') acc.cooling += 1;
      else if (a.status === 'needs_reauth') acc.reauth += 1;
      else if (a.status === 'banned') acc.banned += 1;
      return acc;
    },
    { total: 0, active: 0, cooling: 0, reauth: 0, banned: 0 },
  );

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

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <SummaryCard label={t('accounts.summary.total')} value={summary.total} />
        <SummaryCard
          label={t('accounts.summary.active')}
          value={summary.active}
          accent="text-emerald-700"
        />
        <SummaryCard
          label={t('accounts.summary.cooling')}
          value={summary.cooling}
          accent={summary.cooling > 0 ? 'text-amber-700' : ''}
        />
        <SummaryCard
          label={t('accounts.summary.reauth')}
          value={summary.reauth}
          accent={summary.reauth > 0 ? 'text-red-700' : ''}
        />
        <SummaryCard
          label={t('accounts.summary.banned')}
          value={summary.banned}
          accent={summary.banned > 0 ? 'text-red-700' : ''}
        />
      </div>

      {showForm && (
        <AttachForm users={usersData?.data ?? []} onClose={() => setShowForm(false)} />
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">{t('accounts.col.label')}</th>
              <th className="px-4 py-2 font-medium">{t('accounts.col.provider')}</th>
              <th className="px-4 py-2 font-medium">{t('accounts.col.plan')}</th>
              <th className="px-4 py-2 font-medium">{t('accounts.col.status')}</th>
              <th className="px-4 py-2 font-medium">{t('accounts.col.window')}</th>
              <th className="px-4 py-2 font-medium">{t('accounts.col.lastUsed')}</th>
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
              <tr key={a.id} className="border-t border-border align-top">
                <td className="px-4 py-3">
                  <div className="font-medium">
                    {a.label ?? <span className="text-muted-foreground">—</span>}
                  </div>
                  {a.shared && (
                    <div className="mt-0.5 text-[10px] text-muted-foreground">
                      {t('accounts.col.shared')} · {t('common.yes')}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">{a.provider}</td>
                <td className="px-4 py-3 font-mono text-xs">{a.plan}</td>
                <td className="px-4 py-3">
                  <StatusBadge
                    status={a.status}
                    coolingUntil={a.coolingUntil}
                    nowMs={nowMs}
                  />
                </td>
                <td className="px-4 py-3">
                  <WindowBar used={a.windowTokensUsedLive} limit={a.windowLimit} />
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {a.lastUsedAt ? new Date(a.lastUsedAt).toLocaleString() : t('common.dash')}
                </td>
                <td className="space-x-3 whitespace-nowrap px-4 py-3 text-right">
                  {(a.status === 'cooling' || a.status === 'rate_limited') && (
                    <button
                      type="button"
                      onClick={() =>
                        patch.mutate({
                          id: a.id,
                          body: { status: 'active', coolingUntil: null },
                        })
                      }
                      className="text-xs text-primary hover:underline"
                    >
                      {t('accounts.action.forceActive')}
                    </button>
                  )}
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

function SummaryCard({
  label,
  value,
  accent = '',
}: {
  label: string;
  value: number;
  accent?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-xl font-semibold tabular-nums ${accent}`}>{value}</div>
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
