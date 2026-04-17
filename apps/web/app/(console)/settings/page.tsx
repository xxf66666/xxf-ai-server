'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { apiFetch } from '../../../lib/api';
import { useT } from '../../../lib/i18n/context';

interface Me {
  sub: string;
  email: string;
  role: string;
}

export default function ConsoleSettingsPage() {
  const t = useT();
  const { data: me } = useQuery({
    queryKey: ['console', 'me'],
    queryFn: () => apiFetch<Me>('/admin/v1/auth/me'),
  });

  const [form, setForm] = useState({ currentPassword: '', newPassword: '' });
  const change = useMutation({
    mutationFn: (body: typeof form) =>
      apiFetch('/v1/console/me/password', { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: () => setForm({ currentPassword: '', newPassword: '' }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('console.settings.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('console.settings.subtitle')}</p>
      </div>

      <div className="rounded-lg border border-border bg-background p-6 text-sm">
        <div className="space-y-3">
          <div>
            <div className="text-xs text-muted-foreground">{t('console.settings.email')}</div>
            <div className="font-mono">{me?.email ?? t('common.loading')}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">{t('console.settings.role')}</div>
            <div>{me?.role ?? t('common.dash')}</div>
          </div>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          change.mutate(form);
        }}
        className="space-y-3 rounded-lg border border-border bg-background p-6"
      >
        <label className="block space-y-1 text-sm">
          <span className="text-xs font-medium">{t('console.settings.currentPw')}</span>
          <input
            value={form.currentPassword}
            onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
            type="password"
            autoComplete="current-password"
            required
            className="w-full rounded-md border border-border bg-background px-3 py-2"
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="text-xs font-medium">{t('console.settings.newPw')}</span>
          <input
            value={form.newPassword}
            onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            className="w-full rounded-md border border-border bg-background px-3 py-2"
          />
        </label>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={change.isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {change.isPending ? t('console.settings.changing') : t('console.settings.changePw')}
          </button>
          {change.isSuccess && (
            <span className="text-xs text-green-700">{t('console.settings.pwChanged')}</span>
          )}
          {change.isError && (
            <span className="text-xs text-red-700">
              {change.error instanceof Error ? change.error.message : t('common.unknown')}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
