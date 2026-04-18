'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  BookOpen,
  Boxes,
  ExternalLink,
  KeyRound,
  LayoutDashboard,
  ListOrdered,
  LogOut,
  Settings as SettingsIcon,
  Wallet,
} from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { clearBootstrapToken } from '../../lib/auth';
import { useT } from '../../lib/i18n/context';
import { LocaleSwitcher } from '../../lib/i18n/LocaleSwitcher';
import { NexaLogo } from '../../components/NexaLogo';
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
  const t = useT();
  const [me, setMe] = useState<Me | null>(null);
  const [ready, setReady] = useState(false);

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

  return (
    <div className="flex min-h-screen bg-muted/10">
      <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-background p-4">
        <div className="mb-6 flex items-start justify-between gap-2 px-2">
          <div>
            <NexaLogo size={24} withWordmark />
            <div className="mt-1 text-xs text-muted-foreground">{t('console.title')}</div>
          </div>
          <LocaleSwitcher />
        </div>
        <nav className="flex-1 space-y-1">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href as never}
              className="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted"
            >
              <Icon className="h-4 w-4" />
              <span>{t(label)}</span>
            </Link>
          ))}
          <div className="pt-2 mt-2 border-t border-border">
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
      </aside>
      <main className="flex-1 overflow-y-auto">
        <div className="container max-w-6xl py-8">{children}</div>
      </main>
    </div>
  );
}
