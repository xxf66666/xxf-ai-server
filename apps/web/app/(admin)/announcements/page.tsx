'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { AlertTriangle, Info, Siren } from 'lucide-react';
import { apiFetch } from '../../../lib/api';
import { useT } from '../../../lib/i18n/context';
import type { DictKey } from '../../../lib/i18n/dict';

type Severity = 'info' | 'warning' | 'critical';

interface Announcement {
  id: string;
  title: string;
  body: string;
  severity: Severity;
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
}

const SEVERITY_META: Record<
  Severity,
  { label: DictKey; badgeClass: string; Icon: typeof Info }
> = {
  info: {
    label: 'announcements.severity.info',
    badgeClass: 'border-sky-200 bg-sky-50 text-sky-700',
    Icon: Info,
  },
  warning: {
    label: 'announcements.severity.warning',
    badgeClass: 'border-amber-200 bg-amber-50 text-amber-700',
    Icon: AlertTriangle,
  },
  critical: {
    label: 'announcements.severity.critical',
    badgeClass: 'border-red-200 bg-red-50 text-red-700',
    Icon: Siren,
  },
};

export default function AnnouncementsAdminPage() {
  const qc = useQueryClient();
  const t = useT();
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'announcements'],
    queryFn: () => apiFetch<{ data: Announcement[] }>('/admin/v1/announcements'),
  });

  const [form, setForm] = useState({
    title: '',
    body: '',
    severity: 'info' as Severity,
    active: true,
  });

  const create = useMutation({
    mutationFn: () =>
      apiFetch('/admin/v1/announcements', {
        method: 'POST',
        body: JSON.stringify(form),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'announcements'] });
      qc.invalidateQueries({ queryKey: ['announcements', 'active'] });
      setForm({ title: '', body: '', severity: 'info', active: true });
    },
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      apiFetch(`/admin/v1/announcements/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'announcements'] });
      qc.invalidateQueries({ queryKey: ['announcements', 'active'] });
    },
  });

  const del = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/admin/v1/announcements/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'announcements'] });
      qc.invalidateQueries({ queryKey: ['announcements', 'active'] });
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('announcements.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('announcements.subtitle')}</p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
        className="space-y-3 rounded-lg border border-border p-4"
      >
        <label className="block space-y-1 text-sm">
          <span className="text-xs font-medium">{t('announcements.form.title')}</span>
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
            maxLength={200}
            placeholder={t('announcements.form.title.placeholder')}
            className="w-full rounded-md border border-border bg-background px-3 py-2"
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="text-xs font-medium">{t('announcements.form.body')}</span>
          <textarea
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            required
            maxLength={4000}
            rows={3}
            placeholder={t('announcements.form.body.placeholder')}
            className="w-full rounded-md border border-border bg-background px-3 py-2"
          />
        </label>
        <div className="flex flex-wrap items-end gap-3">
          <label className="space-y-1 text-sm">
            <span className="text-xs font-medium">{t('announcements.form.severity')}</span>
            <select
              value={form.severity}
              onChange={(e) => setForm({ ...form, severity: e.target.value as Severity })}
              className="rounded-md border border-border bg-background px-2 py-1.5"
            >
              <option value="info">{t('announcements.severity.info')}</option>
              <option value="warning">{t('announcements.severity.warning')}</option>
              <option value="critical">{t('announcements.severity.critical')}</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />
            <span>{t('announcements.form.active')}</span>
          </label>
          <button
            type="submit"
            disabled={create.isPending || !form.title || !form.body}
            className="ml-auto rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {create.isPending ? t('common.creating') : t('announcements.form.publish')}
          </button>
        </div>
      </form>

      <div className="space-y-3">
        {isLoading && (
          <div className="text-sm text-muted-foreground">{t('common.loading')}</div>
        )}
        {!isLoading && (data?.data.length ?? 0) === 0 && (
          <div className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
            {t('announcements.empty')}
          </div>
        )}
        {data?.data.map((a) => {
          const m = SEVERITY_META[a.severity];
          const Icon = m.Icon;
          return (
            <div
              key={a.id}
              className="rounded-lg border border-border bg-background p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${m.badgeClass}`}
                    >
                      <Icon className="h-3 w-3" />
                      {t(m.label)}
                    </span>
                    {!a.active && (
                      <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {t('announcements.inactive')}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {new Date(a.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-sm font-medium">{a.title}</div>
                  <div className="whitespace-pre-wrap text-xs text-muted-foreground">
                    {a.body}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col gap-1 text-xs">
                  <button
                    type="button"
                    onClick={() => toggleActive.mutate({ id: a.id, active: !a.active })}
                    className="text-primary hover:underline"
                  >
                    {a.active
                      ? t('announcements.action.deactivate')
                      : t('announcements.action.activate')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(t('announcements.confirm.delete'))) del.mutate(a.id);
                    }}
                    className="text-red-600 hover:underline"
                  >
                    {t('common.delete')}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
