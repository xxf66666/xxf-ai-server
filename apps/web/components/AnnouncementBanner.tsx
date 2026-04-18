'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { AlertTriangle, Info, Siren, X } from 'lucide-react';
import { apiFetch } from '../lib/api';

interface Announcement {
  id: string;
  title: string;
  body: string;
  severity: 'info' | 'warning' | 'critical';
}

// Session-scoped dismissal — stashes announcement ids the user has
// clicked "dismiss" on into sessionStorage, so they don't keep yelling
// on every page navigation within the same browser tab. Re-appears on
// new tabs / new sessions so operators aren't silenced forever.
const DISMISS_KEY = 'nexa.announcements.dismissed';
function getDismissed(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    return new Set(JSON.parse(sessionStorage.getItem(DISMISS_KEY) ?? '[]'));
  } catch {
    return new Set();
  }
}

const SEVERITY_STYLE: Record<Announcement['severity'], { container: string; Icon: typeof Info }> = {
  info: {
    container: 'border-sky-200 bg-sky-50 text-sky-900',
    Icon: Info,
  },
  warning: {
    container: 'border-amber-300 bg-amber-50 text-amber-900',
    Icon: AlertTriangle,
  },
  critical: {
    container: 'border-red-300 bg-red-50 text-red-900',
    Icon: Siren,
  },
};

export function AnnouncementBanner() {
  const [dismissed, setDismissed] = useState<Set<string>>(() => getDismissed());
  const { data } = useQuery({
    queryKey: ['announcements', 'active'],
    queryFn: () => apiFetch<{ data: Announcement[] }>('/admin/v1/announcements/active'),
    // Cheap — ~5 rows of JSON. Refresh every minute so "maintenance at
    // 22:00" updates land without a page reload.
    refetchInterval: 60_000,
    retry: false,
  });

  const dismiss = (id: string) => {
    const next = new Set(dismissed);
    next.add(id);
    setDismissed(next);
    try {
      sessionStorage.setItem(DISMISS_KEY, JSON.stringify(Array.from(next)));
    } catch {
      /* sessionStorage blocked — ignore */
    }
  };

  const visible = (data?.data ?? []).filter((a) => !dismissed.has(a.id));
  if (visible.length === 0) return null;

  return (
    <div className="space-y-2">
      {visible.map((a) => {
        const { container, Icon } = SEVERITY_STYLE[a.severity];
        return (
          <div
            key={a.id}
            className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${container}`}
            role={a.severity === 'critical' ? 'alert' : 'status'}
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="flex-1">
              <div className="font-medium">{a.title}</div>
              {a.body && <div className="mt-1 text-xs opacity-90">{a.body}</div>}
            </div>
            <button
              type="button"
              onClick={() => dismiss(a.id)}
              className="rounded-md p-1 hover:bg-black/5"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
