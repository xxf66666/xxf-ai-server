'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { apiFetch } from '../../../lib/api';
import { useT } from '../../../lib/i18n/context';

interface AuditRow {
  id: string;
  actorEmail: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  detail: Record<string, unknown>;
  createdAt: string;
}

// Well-known action families — used to colour the action badge.
const actionTone: Record<string, string> = {
  'user.register': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'user.login': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'user.email_verified': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'user.password_reset': 'bg-amber-50 text-amber-700 border-amber-200',
  'user.login_failed': 'bg-red-50 text-red-700 border-red-200',
  'user.delete': 'bg-red-50 text-red-700 border-red-200',
  'user.update': 'bg-sky-50 text-sky-700 border-sky-200',
  'user.balance_adjust': 'bg-violet-50 text-violet-700 border-violet-200',
  'user.email_verify_resend': 'bg-sky-50 text-sky-700 border-sky-200',
};

export default function AuditPage() {
  const t = useT();
  const [actionFilter, setActionFilter] = useState('');
  const [actorFilter, setActorFilter] = useState('');

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['audit', actionFilter, actorFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (actionFilter) params.set('action', actionFilter);
      if (actorFilter) params.set('actor', actorFilter);
      params.set('limit', '200');
      const qs = params.toString();
      return apiFetch<{ data: AuditRow[] }>(`/admin/v1/audit${qs ? `?${qs}` : ''}`);
    },
    refetchInterval: 20_000,
  });

  const knownActions = useMemo(() => {
    const s = new Set<string>();
    for (const r of data?.data ?? []) s.add(r.action);
    return Array.from(s).sort();
  }, [data]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('audit.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('audit.subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="rounded-md border border-border px-3 py-1.5 text-xs disabled:opacity-60"
        >
          {isFetching ? t('common.loading') : t('audit.refresh')}
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border p-4">
        <label className="space-y-1 text-sm">
          <span className="text-xs font-medium">{t('audit.filter.action')}</span>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          >
            <option value="">{t('audit.filter.all')}</option>
            {knownActions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <label className="flex-1 space-y-1 text-sm">
          <span className="text-xs font-medium">{t('audit.filter.actor')}</span>
          <input
            value={actorFilter}
            onChange={(e) => setActorFilter(e.target.value)}
            placeholder="email fragment"
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          />
        </label>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">{t('audit.col.time')}</th>
              <th className="px-4 py-2 font-medium">{t('audit.col.actor')}</th>
              <th className="px-4 py-2 font-medium">{t('audit.col.action')}</th>
              <th className="px-4 py-2 font-medium">{t('audit.col.entity')}</th>
              <th className="px-4 py-2 font-medium">{t('audit.col.detail')}</th>
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
                  {t('audit.empty')}
                </td>
              </tr>
            )}
            {data?.data.map((r) => (
              <tr key={r.id} className="border-t border-border align-top">
                <td className="whitespace-nowrap px-4 py-2 text-xs text-muted-foreground">
                  {new Date(r.createdAt).toLocaleString()}
                </td>
                <td className="px-4 py-2 font-mono text-xs">
                  {r.actorEmail ?? <span className="text-muted-foreground">—</span>}
                </td>
                <td className="px-4 py-2">
                  <span
                    className={`inline-block rounded-full border px-2 py-0.5 text-xs ${
                      actionTone[r.action] ?? 'bg-muted text-muted-foreground border-border'
                    }`}
                  >
                    {r.action}
                  </span>
                </td>
                <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                  {r.entityType}
                  {r.entityId ? (
                    <span className="ml-1 text-[10px] text-muted-foreground/70">
                      {r.entityId.slice(0, 8)}…
                    </span>
                  ) : null}
                </td>
                <td className="max-w-lg break-words px-4 py-2">
                  {Object.keys(r.detail ?? {}).length > 0 ? (
                    <pre className="whitespace-pre-wrap break-words rounded bg-muted/40 p-1.5 font-mono text-[10px] text-muted-foreground">
                      {JSON.stringify(r.detail)}
                    </pre>
                  ) : (
                    <span className="text-xs text-muted-foreground">{t('common.none')}</span>
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
