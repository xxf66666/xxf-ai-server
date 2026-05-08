'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react';

type ToastTone = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  tone: ToastTone;
  title: string;
  detail?: string;
}

interface ToastApi {
  push: (t: { tone: ToastTone; title: string; detail?: string; ttlMs?: number }) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback<ToastApi['push']>((t) => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev, { id, tone: t.tone, title: t.title, detail: t.detail }]);
    const ttl = t.ttlMs ?? 6000;
    if (ttl > 0) {
      setTimeout(() => setItems((prev) => prev.filter((x) => x.id !== id)), ttl);
    }
  }, []);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4">
        {items.map((it) => (
          <ToastView key={it.id} item={it} onDismiss={() => setItems((prev) => prev.filter((x) => x.id !== it.id))} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Fallback for code paths that import the hook before the provider
    // mounts (e.g., during prerender). Console.warn is more useful than
    // a throw because it doesn't break a partially hydrated tree.
    return {
      push: ({ title, detail }) => {
        // eslint-disable-next-line no-console
        console.warn('[toast] no provider mounted:', title, detail);
      },
    };
  }
  return ctx;
}

function ToastView({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    // Triggers the slide-up animation on first paint.
    requestAnimationFrame(() => setOpen(true));
  }, []);

  const tone =
    item.tone === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/80 dark:text-emerald-100'
      : item.tone === 'error'
        ? 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/80 dark:text-rose-100'
        : 'border-border bg-background text-foreground';
  const Icon = item.tone === 'success' ? CheckCircle2 : item.tone === 'error' ? XCircle : Info;

  return (
    <div
      className={`pointer-events-auto w-full max-w-md rounded-lg border px-4 py-3 shadow-lg backdrop-blur transition-all duration-200 ${tone}`}
      style={{
        opacity: open ? 1 : 0,
        transform: open ? 'translateY(0)' : 'translateY(8px)',
      }}
      role="status"
      aria-live="polite"
    >
      <div className="flex gap-3">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="flex-1">
          <div className="text-sm font-medium">{item.title}</div>
          {item.detail && (
            <div className="mt-0.5 break-words font-mono text-[11px] opacity-80">
              {item.detail}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded p-0.5 opacity-60 hover:bg-background/50 hover:opacity-100"
          aria-label="dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
