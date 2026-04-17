'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { apiFetch } from '../../../lib/api';

interface Settings {
  'pool.utilizationTarget': number;
  'pool.minRemainingTokens': number;
  'models.allow': string[];
}

export default function SettingsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => apiFetch<{ data: Settings }>('/admin/v1/settings'),
  });

  const [form, setForm] = useState<Settings | null>(null);
  useEffect(() => {
    if (data) setForm(data.data);
  }, [data]);

  const save = useMutation({
    mutationFn: (body: Partial<Settings>) =>
      apiFetch('/admin/v1/settings', { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  });

  if (isLoading || !form) {
    return <div className="text-sm text-muted-foreground">loading…</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">System configuration.</p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate(form);
        }}
        className="space-y-4 rounded-lg border border-border p-6"
      >
        <label className="block space-y-1 text-sm">
          <span className="font-medium">Pool utilization target</span>
          <span className="block text-xs text-muted-foreground">
            Fraction of each account's 5h window we'll use before preferring a different account (0-1).
          </span>
          <input
            type="number"
            step={0.05}
            min={0}
            max={1}
            value={form['pool.utilizationTarget']}
            onChange={(e) =>
              setForm({ ...form, 'pool.utilizationTarget': Number(e.target.value) })
            }
            className="mt-1 w-full max-w-xs rounded-md border border-border bg-background px-3 py-2"
          />
        </label>

        <label className="block space-y-1 text-sm">
          <span className="font-medium">Min remaining tokens</span>
          <span className="block text-xs text-muted-foreground">
            Skip an account in scheduling when it has fewer tokens left in the current window.
          </span>
          <input
            type="number"
            min={0}
            value={form['pool.minRemainingTokens']}
            onChange={(e) =>
              setForm({ ...form, 'pool.minRemainingTokens': Number(e.target.value) })
            }
            className="mt-1 w-full max-w-xs rounded-md border border-border bg-background px-3 py-2"
          />
        </label>

        <label className="block space-y-1 text-sm">
          <span className="font-medium">Allowed models</span>
          <span className="block text-xs text-muted-foreground">
            One per line; leave empty to allow all models.
          </span>
          <textarea
            rows={4}
            value={form['models.allow'].join('\n')}
            onChange={(e) =>
              setForm({
                ...form,
                'models.allow': e.target.value
                  .split(/\n+/)
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs"
          />
        </label>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={save.isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {save.isPending ? 'saving…' : 'Save'}
          </button>
          {save.isSuccess && <span className="text-xs text-green-700">saved ✓</span>}
          {save.isError && (
            <span className="text-xs text-red-700">
              {save.error instanceof Error ? save.error.message : 'save failed'}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
