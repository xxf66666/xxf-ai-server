'use client';

import Link from 'next/link';
import { LocaleSwitcher } from '../lib/i18n/LocaleSwitcher';

// Shared glassy card shell for /login and /register. Keeps a single
// visual identity across auth surfaces — gradient background blob,
// top-right locale + link back to home, centered card with shadow.
export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-12">
      {/* gradient blobs */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 top-0 h-96 w-96 rounded-full bg-gradient-to-br from-indigo-300/40 via-violet-200/30 to-transparent blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 bottom-0 h-96 w-96 rounded-full bg-gradient-to-tr from-emerald-300/30 via-sky-200/30 to-transparent blur-3xl"
      />

      <div className="absolute left-4 top-4 flex items-center gap-2">
        <Link
          href="/"
          className="rounded-md border border-border bg-background/80 px-3 py-1.5 text-xs font-medium backdrop-blur hover:bg-background"
        >
          ← xxf-ai-server
        </Link>
      </div>
      <div className="absolute right-4 top-4">
        <LocaleSwitcher />
      </div>

      <section className="w-full max-w-md">
        <div className="rounded-2xl border border-border bg-background/80 p-8 shadow-xl backdrop-blur">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          {children}
        </div>
      </section>
    </main>
  );
}
