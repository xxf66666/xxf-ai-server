'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiFetch } from '../../../lib/api';
import { useT } from '../../../lib/i18n/context';

interface User {
  id: string;
  email: string;
  role: string;
  createdAt: string;
}

export default function UsersPage() {
  const qc = useQueryClient();
  const t = useT();
  const { data, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => apiFetch<{ data: User[] }>('/admin/v1/users'),
  });

  const [form, setForm] = useState({ email: '', role: 'consumer' });
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

      <div className="rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">{t('users.col.email')}</th>
              <th className="px-4 py-2 font-medium">{t('users.col.role')}</th>
              <th className="px-4 py-2 font-medium">{t('users.col.created')}</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td className="px-4 py-6 text-center text-muted-foreground" colSpan={4}>
                  {t('common.loading')}
                </td>
              </tr>
            )}
            {data?.data.map((u) => (
              <tr key={u.id} className="border-t border-border">
                <td className="px-4 py-2 font-mono text-xs">{u.email}</td>
                <td className="px-4 py-2">{u.role}</td>
                <td className="px-4 py-2 text-xs text-muted-foreground">
                  {new Date(u.createdAt).toLocaleString()}
                </td>
                <td className="px-4 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(t('users.confirm.delete', { email: u.email }))) del.mutate(u.id);
                    }}
                    className="text-xs text-red-600 hover:underline"
                  >
                    {t('common.delete')}
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
