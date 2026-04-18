'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { CheckCircle2, KeyRound, ShieldCheck, ShieldOff } from 'lucide-react';
import { apiFetch } from '../../../lib/api';
import { useT } from '../../../lib/i18n/context';

interface Me {
  sub: string;
  email: string;
  role: string;
}

interface Overview {
  email: string;
  role: string;
  totpEnabled: boolean;
}

export default function ConsoleSettingsPage() {
  const t = useT();
  const qc = useQueryClient();
  const { data: me } = useQuery({
    queryKey: ['console', 'me'],
    queryFn: () => apiFetch<Me>('/admin/v1/auth/me'),
  });
  const { data: overview } = useQuery({
    queryKey: ['console', 'overview'],
    queryFn: () => apiFetch<Overview>('/v1/console/overview'),
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
        <div className="mb-2 text-sm font-semibold">{t('console.settings.changePw')}</div>
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

      <TwoFactorSection
        enabled={overview?.totpEnabled ?? false}
        onChange={() => qc.invalidateQueries({ queryKey: ['console', 'overview'] })}
      />

      <SessionsSection />
    </div>
  );
}

function TwoFactorSection({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: () => void;
}) {
  const t = useT();
  const [enrollData, setEnrollData] = useState<{ uri: string; secret: string } | null>(null);
  const [code, setCode] = useState('');
  const [disablePw, setDisablePw] = useState('');

  const enroll = useMutation({
    mutationFn: () =>
      apiFetch<{ uri: string; secret: string }>('/v1/console/me/totp/enroll', {
        method: 'POST',
      }),
    onSuccess: (d) => setEnrollData(d),
  });
  const confirmEnroll = useMutation({
    mutationFn: () =>
      apiFetch('/v1/console/me/totp/confirm', {
        method: 'POST',
        body: JSON.stringify({ code }),
      }),
    onSuccess: () => {
      setEnrollData(null);
      setCode('');
      onChange();
    },
  });
  const disable = useMutation({
    mutationFn: () =>
      apiFetch('/v1/console/me/totp/disable', {
        method: 'POST',
        body: JSON.stringify({ password: disablePw }),
      }),
    onSuccess: () => {
      setDisablePw('');
      onChange();
    },
  });

  return (
    <div className="space-y-3 rounded-lg border border-border bg-background p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            {enabled ? (
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
            ) : (
              <ShieldOff className="h-4 w-4 text-muted-foreground" />
            )}
            {t('console.settings.totp.title')}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {enabled ? t('console.settings.totp.on') : t('console.settings.totp.off')}
          </p>
        </div>
        {!enabled && !enrollData && (
          <button
            type="button"
            onClick={() => enroll.mutate()}
            disabled={enroll.isPending}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-60"
          >
            {enroll.isPending ? t('common.loading') : t('console.settings.totp.enable')}
          </button>
        )}
      </div>

      {!enabled && enrollData && (
        <div className="mt-3 space-y-3 rounded-md border border-border bg-muted/30 p-4">
          <div className="text-xs font-medium">{t('console.settings.totp.step1')}</div>
          <div className="break-all rounded border border-border bg-background p-2 font-mono text-[11px]">
            {enrollData.uri}
          </div>
          <p className="text-xs text-muted-foreground">
            {t('console.settings.totp.manualSecret')}{' '}
            <code className="rounded bg-background px-1 py-0.5 font-mono text-[11px]">
              {enrollData.secret}
            </code>
          </p>
          <div className="text-xs font-medium">{t('console.settings.totp.step2')}</div>
          <div className="flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\s+/g, ''))}
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={10}
              placeholder="123456"
              className="flex-1 rounded-md border border-border bg-background px-3 py-2 font-mono tracking-widest"
            />
            <button
              type="button"
              onClick={() => confirmEnroll.mutate()}
              disabled={confirmEnroll.isPending || code.length < 6}
              className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {confirmEnroll.isPending ? t('common.loading') : t('console.settings.totp.confirm')}
            </button>
          </div>
          {confirmEnroll.isError && (
            <div className="text-xs text-red-700">{t('login.totp.invalid')}</div>
          )}
        </div>
      )}

      {enabled && (
        <div className="mt-3 space-y-3 rounded-md border border-border bg-muted/30 p-4">
          <div className="flex items-center gap-2 text-xs font-medium">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            {t('console.settings.totp.active')}
          </div>
          <div className="flex gap-2">
            <input
              value={disablePw}
              onChange={(e) => setDisablePw(e.target.value)}
              type="password"
              placeholder={t('console.settings.totp.confirmPw')}
              className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => {
                if (confirm(t('console.settings.totp.confirmDisable'))) disable.mutate();
              }}
              disabled={disable.isPending || !disablePw}
              className="rounded-md border border-red-300 bg-background px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
            >
              {disable.isPending ? t('common.loading') : t('console.settings.totp.disable')}
            </button>
          </div>
          {disable.isError && (
            <div className="text-xs text-red-700">
              {disable.error instanceof Error ? disable.error.message : t('common.unknown')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SessionsSection() {
  const t = useT();
  const revoke = useMutation({
    mutationFn: () =>
      apiFetch('/v1/console/me/sessions/revoke-others', { method: 'POST' }),
  });
  return (
    <div className="rounded-lg border border-border bg-background p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <KeyRound className="h-4 w-4" />
            {t('console.settings.sessions.title')}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('console.settings.sessions.desc')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (confirm(t('console.settings.sessions.confirm'))) revoke.mutate();
          }}
          disabled={revoke.isPending}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-60"
        >
          {revoke.isPending
            ? t('common.loading')
            : revoke.isSuccess
              ? t('console.settings.sessions.done')
              : t('console.settings.sessions.cta')}
        </button>
      </div>
    </div>
  );
}
