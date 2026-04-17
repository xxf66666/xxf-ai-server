'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiFetch } from '../../../lib/api';
import { useT } from '../../../lib/i18n/context';

interface User {
  id: string;
  email: string;
}

interface ApiKey {
  id: string;
  userId: string;
  name: string;
  keyPreview: string;
  status: 'active' | 'revoked';
  quotaMonthlyTokens: number | null;
  usedMonthlyTokens: number;
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

const fmt = new Intl.NumberFormat();

export default function KeysPage() {
  const qc = useQueryClient();
  const t = useT();
  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: () => apiFetch<{ data: User[] }>('/admin/v1/users'),
  });
  const users = usersData?.data ?? [];
  const [selectedUser, setSelectedUser] = useState<string>('');
  const activeUser = selectedUser || users[0]?.id || '';

  const { data: keysData, isLoading } = useQuery({
    queryKey: ['keys', activeUser],
    queryFn: () =>
      activeUser
        ? apiFetch<{ data: ApiKey[] }>(`/admin/v1/users/${activeUser}/keys`)
        : Promise.resolve({ data: [] }),
    enabled: Boolean(activeUser),
  });

  const [mintName, setMintName] = useState('');
  const [lastMinted, setLastMinted] = useState<string | null>(null);
  const mint = useMutation({
    mutationFn: (name: string) =>
      apiFetch<ApiKey & { key: string }>('/admin/v1/keys', {
        method: 'POST',
        body: JSON.stringify({ userId: activeUser, name }),
      }),
    onSuccess: (res) => {
      setLastMinted(res.key);
      setMintName('');
      qc.invalidateQueries({ queryKey: ['keys'] });
    },
  });
  const revoke = useMutation({
    mutationFn: (id: string) => apiFetch(`/admin/v1/keys/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['keys'] }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('keys.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('keys.subtitle')}</p>
      </div>

      {users.length === 0 ? (
        <div className="rounded-lg border border-border p-8 text-center text-sm text-muted-foreground">
          {t('keys.empty.noUsers')}
        </div>
      ) : (
        <>
          <div className="flex items-end gap-3">
            <label className="flex-1 space-y-1 text-sm">
              <span className="text-xs font-medium">{t('keys.owner')}</span>
              <select
                value={activeUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.email}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (mintName.trim()) mint.mutate(mintName.trim());
            }}
            className="flex flex-wrap items-end gap-3 rounded-lg border border-border p-4"
          >
            <label className="flex-1 space-y-1 text-sm">
              <span className="text-xs font-medium">{t('keys.form.name')}</span>
              <input
                value={mintName}
                onChange={(e) => setMintName(e.target.value)}
                placeholder={t('keys.form.name.placeholder')}
                required
                className="w-full rounded-md border border-border bg-background px-2 py-1.5"
              />
            </label>
            <button
              type="submit"
              disabled={mint.isPending}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {mint.isPending ? t('keys.form.minting') : t('keys.form.mint')}
            </button>
          </form>

          {lastMinted && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
              <div className="font-medium">{t('keys.minted.title')}</div>
              <div className="mt-2 flex items-center gap-2">
                <code className="flex-1 break-all rounded bg-white px-2 py-1 font-mono text-xs">{lastMinted}</code>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(lastMinted)}
                  className="rounded border border-amber-400 px-2 py-1 text-xs hover:bg-amber-100"
                >
                  {t('common.copy')}
                </button>
                <button
                  type="button"
                  onClick={() => setLastMinted(null)}
                  className="rounded border border-amber-400 px-2 py-1 text-xs hover:bg-amber-100"
                >
                  {t('common.dismiss')}
                </button>
              </div>
            </div>
          )}

          <div className="rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">{t('keys.col.name')}</th>
                  <th className="px-4 py-2 font-medium">{t('keys.col.key')}</th>
                  <th className="px-4 py-2 font-medium">{t('keys.col.status')}</th>
                  <th className="px-4 py-2 font-medium text-right">{t('keys.col.used')}</th>
                  <th className="px-4 py-2"></th>
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
                {(keysData?.data ?? []).map((k) => (
                  <tr key={k.id} className="border-t border-border">
                    <td className="px-4 py-2">{k.name}</td>
                    <td className="px-4 py-2 font-mono text-xs">{k.keyPreview}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          k.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-muted'
                        }`}
                      >
                        {k.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">{fmt.format(k.usedMonthlyTokens)}</td>
                    <td className="px-4 py-2 text-right">
                      {k.status === 'active' && (
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(t('keys.confirm.revoke', { name: k.name }))) revoke.mutate(k.id);
                          }}
                          className="text-xs text-red-600 hover:underline"
                        >
                          {t('common.revoke')}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
