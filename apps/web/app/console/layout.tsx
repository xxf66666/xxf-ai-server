'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  BookOpen,
  Boxes,
  ExternalLink,
  KeyRound,
  LayoutDashboard,
  ListOrdered,
  LogOut,
  Menu,
  Settings as SettingsIcon,
  Wallet,
  X,
} from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { clearBootstrapToken } from '../../lib/auth';
import { useT } from '../../lib/i18n/context';
import { LocaleSwitcher } from '../../lib/i18n/LocaleSwitcher';
import { NexaLogo } from '../../components/NexaLogo';
import { AnnouncementBanner } from '../../components/AnnouncementBanner';
import type { DictKey } from '../../lib/i18n/dict';

interface Me {
  sub: string;
  email: string;
  role: 'admin' | 'contributor' | 'consumer';
}

const nav: Array<{ href: string; label: DictKey; icon: typeof LayoutDashboard }> = [
  { href: '/console/dashboard', label: 'console.nav.dashboard', icon: LayoutDashboard },
  { href: '/console/wallet', label: 'nav.wallet', icon: Wallet },
  { href: '/console/keys', label: 'console.nav.keys', icon: KeyRound },
  { href: '/console/models', label: 'console.nav.models', icon: Boxes },
  { href: '/console/usage', label: 'console.nav.usage', icon: ListOrdered },
  { href: '/console/settings', label: 'console.nav.settings', icon: SettingsIcon },
];

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const t = useT();
  const [me, setMe] = useState<Me | null>(null);
  const [ready, setReady] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  // Close the mobile drawer on every route change. Without this, the
  // drawer stays open after a click and overlays the new page.
  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    apiFetch<Me>('/admin/v1/auth/me')
      .then((data) => {
        setMe(data);
        setReady(true);
      })
      .catch(() => {
        router.replace('/login');
      });
  }, [router]);

  if (!ready || !me) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        {t('common.loading')}
      </div>
    );
  }

  const onLogout = async () => {
    await apiFetch('/admin/v1/auth/logout', { method: 'POST' }).catch(() => {});
    clearBootstrapToken();
    router.replace('/login');
  };

  // Sidebar body is the same on desktop (always visible) and mobile (in
  // a slide-in drawer). Extracting it into a closure keeps the JSX
  // shorter than duplicating the nav.
  const sidebarBody = (
    <>
      <div className="mb-6 flex items-start justify-between gap-2 px-2">
        <div>
          <NexaLogo size={24} withWordmark />
          <div className="mt-1 text-xs text-muted-foreground">{t('console.title')}</div>
        </div>
        <LocaleSwitcher />
      </div>
      <nav className="flex-1 space-y-1">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname?.startsWith(href);
          return (
            <Link
              key={href}
              href={href as never}
              className={`flex items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors ${
                active ? 'bg-primary/10 font-medium text-primary' : 'hover:bg-muted'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{t(label)}</span>
            </Link>
          );
        })}
        <div className="mt-2 border-t border-border pt-2">
          <a
            href="/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <BookOpen className="h-4 w-4" />
            <span>{t('nav.docs')}</span>
            <ExternalLink className="ml-auto h-3 w-3 opacity-60" />
          </a>
        </div>
      </nav>
      <div className="mt-4 space-y-2 border-t border-border pt-4">
        <div className="px-2 text-xs">
          <div className="truncate font-medium">{me.email}</div>
          <div className="text-muted-foreground">{me.role}</div>
        </div>
        {me.role !== 'consumer' && (
          <Link
            href={'/dashboard' as never}
            className="flex items-center gap-2 rounded-md px-2 py-2 text-xs text-primary hover:bg-muted"
          >
            → admin
          </Link>
        )}
        <button
          type="button"
          onClick={onLogout}
          className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-muted-foreground hover:bg-muted"
        >
          <LogOut className="h-4 w-4" />
          <span>{t('nav.signout')}</span>
        </button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-muted/10">
      {/* Desktop sidebar — always visible at md+ */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-background p-4 md:flex">
        {sidebarBody}
      </aside>

      {/* Mobile drawer — slides in from the left when navOpen is true. */}
      {navOpen && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setNavOpen(false)}
            aria-hidden
          />
          <aside className="absolute inset-y-0 left-0 flex w-60 flex-col border-r border-border bg-background p-4 shadow-xl">
            <button
              type="button"
              onClick={() => setNavOpen(false)}
              className="absolute right-2 top-2 rounded p-1 text-muted-foreground hover:bg-muted"
              aria-label="close menu"
            >
              <X className="h-4 w-4" />
            </button>
            {sidebarBody}
          </aside>
        </div>
      )}

      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        {/* Mobile top bar — only visible below md. Mirrors the desktop
            sidebar's logo so the page never looks unbranded. */}
        <header className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b border-border bg-background/90 px-4 py-2 backdrop-blur md:hidden">
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            className="rounded-md p-2 hover:bg-muted"
            aria-label="open menu"
          >
            <Menu className="h-4 w-4" />
          </button>
          <NexaLogo size={20} withWordmark />
          <LocaleSwitcher />
        </header>

        <div className="container max-w-6xl space-y-4 px-4 py-6 md:py-8">
          <AnnouncementBanner />
          {children}
        </div>
      </main>
    </div>
  );
}
