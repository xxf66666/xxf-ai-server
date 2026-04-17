'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiFetch } from '../../../lib/api';

interface Proxy {
  id: string;
  label: string;
  url: string;
  region: string | null;
  maxConcurrency: number;
  enabled: boolean;
  createdAt: string;
}

export default function ProxiesPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['proxies'],
    queryFn: () => apiFetch<{ data: Proxy[] }>('/admin/v1/proxies'),
  });

  const [form, setForm] = useState({ label: '', url: '', region: '' });
  const create = useMutation({
    mutationFn: (body: typeof form) =>
      apiFetch('/admin/v1/proxies', {
        method: 'POST',
        body: JSON.stringify({
          label: body.label,
          url: body.url,
          region: body.region || undefined,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['proxies'] });
      setForm({ label: '', url: '', region: '' });
    },
  });

  const toggle = useMutation({
    mutationFn: (p: Proxy) =>
      apiFetch(`/admin/v1/proxies/${p.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled: !p.enabled }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['proxies'] }),
  });

  const del = useMutation({
    mutationFn: (id: string) => apiFetch(`/admin/v1/proxies/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['proxies'] }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Egress proxies</h1>
        <p className="text-sm text-muted-foreground">
          Residential / mobile proxies that individual accounts route through. Bind an account
          to one on the Accounts page.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate(form);
        }}
        className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-3"
      >
        <label className="space-y-1 text-sm">
          <span className="text-xs font-medium">Label</span>
          <input
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
            required
            className="w-full rounded-md border border-border bg-background px-2 py-1.5"
            placeholder="iproyal-us-east"
          />
        </label>
        <label className="space-y-1 text-sm sm:col-span-2">
          <span className="text-xs font-medium">URL</span>
          <input
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
            required
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 font-mono text-xs"
            placeholder="http://user:pass@host:port"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-xs font-medium">Region</span>
          <input
            value={form.region}
            onChange={(e) => setForm({ ...form, region: e.target.value })}
            className="w-full rounded-md border border-border bg-background px-2 py-1.5"
            placeholder="us / tw / jp"
          />
        </label>
        <div className="sm:col-span-3">
          <button
            type="submit"
            disabled={create.isPending}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {create.isPending ? 'adding…' : 'Add proxy'}
          </button>
        </div>
      </form>

      <div className="rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Label</th>
              <th className="px-4 py-2 font-medium">URL</th>
              <th className="px-4 py-2 font-medium">Region</th>
              <th className="px-4 py-2 font-medium">Enabled</th>
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
            {!isLoading && (data?.data.length ?? 0) === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                  No proxies yet.
                </td>
              </tr>
            )}
            {data?.data.map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="px-4 py-2">{p.label}</td>
                <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                  {p.url.replace(/:[^@]+@/, ':***@')}
                </td>
                <td className="px-4 py-2">{p.region ?? '—'}</td>
                <td className="px-4 py-2">
                  <button
                    type="button"
                    onClick={() => toggle.mutate(p)}
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      p.enabled ? 'bg-green-100 text-green-800' : 'bg-muted'
                    }`}
                  >
                    {p.enabled ? 'on' : 'off'}
                  </button>
                </td>
                <td className="px-4 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Delete ${p.label}?`)) del.mutate(p.id);
                    }}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Delete
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
