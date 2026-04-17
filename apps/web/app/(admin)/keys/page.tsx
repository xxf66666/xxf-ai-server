'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiFetch } from '../../../lib/api';

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
        <h1 className="text-2xl font-semibold tracking-tight">API keys</h1>
        <p className="text-sm text-muted-foreground">
          Bearer keys clients (Claude Code, Cline, Cursor) use to call the gateway.
        </p>
      </div>

      {users.length === 0 ? (
        <div className="rounded-lg border border-border p-8 text-center text-sm text-muted-foreground">
          Create a user first, then mint keys for them.
        </div>
      ) : (
        <>
          <div className="flex items-end gap-3">
            <label className="flex-1 space-y-1 text-sm">
              <span className="text-xs font-medium">Owner</span>
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
              <span className="text-xs font-medium">Name</span>
              <input
                value={mintName}
                onChange={(e) => setMintName(e.target.value)}
                placeholder="e.g. cline-laptop"
                required
                className="w-full rounded-md border border-border bg-background px-2 py-1.5"
              />
            </label>
            <button
              type="submit"
              disabled={mint.isPending}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {mint.isPending ? 'minting…' : 'Mint key'}
            </button>
          </form>

          {lastMinted && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
              <div className="font-medium">Copy this key now — it won't be shown again:</div>
              <div className="mt-2 flex items-center gap-2">
                <code className="flex-1 break-all rounded bg-white px-2 py-1 font-mono text-xs">{lastMinted}</code>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(lastMinted)}
                  className="rounded border border-amber-400 px-2 py-1 text-xs hover:bg-amber-100"
                >
                  Copy
                </button>
                <button
                  type="button"
                  onClick={() => setLastMinted(null)}
                  className="rounded border border-amber-400 px-2 py-1 text-xs hover:bg-amber-100"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          <div className="rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">Key</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium text-right">Used</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                      loading…
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
                            if (confirm(`Revoke ${k.name}?`)) revoke.mutate(k.id);
                          }}
                          className="text-xs text-red-600 hover:underline"
                        >
                          Revoke
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
