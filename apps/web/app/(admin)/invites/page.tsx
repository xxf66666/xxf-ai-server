'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiFetch } from '../../../lib/api';
import { useT } from '../../../lib/i18n/context';

interface Invite {
  id: string;
  code: string;
  note: string | null;
  maxUses: number;
  useCount: number;
  revoked: boolean;
  expiresAt: string | null;
  createdAt: string;
}

function statusOf(i: Invite): 'active' | 'revoked' | 'exhausted' {
  if (i.revoked) return 'revoked';
  if (i.useCount >= i.maxUses) return 'exhausted';
  return 'active';
}

export default function InvitesPage() {
  const qc = useQueryClient();
  const t = useT();
  const { data, isLoading } = useQuery({
    queryKey: ['invites'],
    queryFn: () => apiFetch<{ data: Invite[] }>('/admin/v1/invites'),
  });

  const [form, setForm] = useState({ note: '', maxUses: 1 });
  const create = useMutation({
    mutationFn: (body: typeof form) =>
      apiFetch<Invite>('/admin/v1/invites', {
        method: 'POST',
        body: JSON.stringify({
          note: body.note || undefined,
          maxUses: body.maxUses,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invites'] });
      setForm({ note: '', maxUses: 1 });
    },
  });
  const reset = useMutation({
    mutationFn: (id: string) => apiFetch(`/admin/v1/invites/${id}/reset`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invites'] }),
  });
  const revoke = useMutation({
    mutationFn: (id: string) => apiFetch(`/admin/v1/invites/${id}/revoke`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invites'] }),
  });
  const del = useMutation({
    mutationFn: (id: string) => apiFetch(`/admin/v1/invites/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invites'] }),
  });

  const statusClass: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    revoked: 'bg-red-100 text-red-800',
    exhausted: 'bg-muted text-muted-foreground',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('invites.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('invites.subtitle')}</p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate(form);
        }}
        className="flex flex-wrap items-end gap-3 rounded-lg border border-border p-4"
      >
        <label className="flex-1 space-y-1 text-sm">
          <span className="text-xs font-medium">{t('invites.form.note')}</span>
          <input
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            placeholder={t('invites.form.note.placeholder')}
            className="w-full rounded-md border border-border bg-background px-2 py-1.5"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-xs font-medium">{t('invites.form.maxUses')}</span>
          <input
            type="number"
            min={1}
            max={1000}
            value={form.maxUses}
            onChange={(e) => setForm({ ...form, maxUses: Number(e.target.value) })}
            className="w-24 rounded-md border border-border bg-background px-2 py-1.5"
          />
        </label>
        <button
          type="submit"
          disabled={create.isPending}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {create.isPending ? t('common.creating') : t('invites.form.create')}
        </button>
      </form>

      <div className="rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">{t('invites.col.code')}</th>
              <th className="px-4 py-2 font-medium">{t('invites.col.note')}</th>
              <th className="px-4 py-2 font-medium">{t('invites.col.uses')}</th>
              <th className="px-4 py-2 font-medium">{t('invites.col.status')}</th>
              <th className="px-4 py-2 font-medium">{t('invites.col.created')}</th>
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
                  {t('invites.empty')}
                </td>
              </tr>
            )}
            {data?.data.map((i) => {
              const s = statusOf(i);
              return (
                <tr key={i.id} className="border-t border-border">
                  <td className="px-4 py-2">
                    <button
                      type="button"
                      onClick={() => navigator.clipboard.writeText(i.code)}
                      className="font-mono text-xs hover:underline"
                      title={t('invites.copied')}
                    >
                      {i.code}
                    </button>
                  </td>
                  <td className="px-4 py-2">{i.note ?? t('common.dash')}</td>
                  <td className="px-4 py-2">
                    {i.useCount} / {i.maxUses}
                  </td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${statusClass[s]}`}>
                      {t(`invites.status.${s}` as any)}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    {new Date(i.createdAt).toLocaleString()}
                  </td>
                  <td className="space-x-3 px-4 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(t('invites.confirm.reset', { code: i.code }))) reset.mutate(i.id);
                      }}
                      className="text-xs text-primary hover:underline"
                    >
                      {t('invites.action.reset')}
                    </button>
                    {!i.revoked && (
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(t('invites.confirm.revoke', { code: i.code }))) revoke.mutate(i.id);
                        }}
                        className="text-xs text-amber-700 hover:underline"
                      >
                        {t('invites.action.revoke')}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(t('invites.confirm.delete', { code: i.code }))) del.mutate(i.id);
                      }}
                      className="text-xs text-red-600 hover:underline"
                    >
                      {t('invites.action.delete')}
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
