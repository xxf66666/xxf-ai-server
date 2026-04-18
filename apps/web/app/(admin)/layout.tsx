'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { BarChart3, Boxes, CreditCard, KeyRound, LayoutDashboard, LogOut, Network, Settings, Ticket, Users } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { clearBootstrapToken } from '../../lib/auth';
import { useT } from '../../lib/i18n/context';
import { LocaleSwitcher } from '../../lib/i18n/LocaleSwitcher';
import type { DictKey } from '../../lib/i18n/dict';
import { NexaLogo } from '../../components/NexaLogo';

interface Me {
  sub: string;
  email: string;
  role: 'admin' | 'contributor' | 'consumer';
}

const nav: Array<{ href: string; label: DictKey; icon: typeof LayoutDashboard }> = [
  { href: '/dashboard', label: 'nav.dashboard', icon: LayoutDashboard },
  { href: '/accounts', label: 'nav.accounts', icon: Boxes },
  { href: '/users', label: 'nav.users', icon: Users },
  { href: '/keys', label: 'nav.keys', icon: KeyRound },
  { href: '/invites', label: 'nav.invites', icon: Ticket },
  { href: '/redeem-codes', label: 'nav.redeemCodes', icon: CreditCard },
  { href: '/proxies', label: 'nav.proxies', icon: Network },
  { href: '/stats', label: 'nav.stats', icon: BarChart3 },
  { href: '/settings', label: 'nav.settings', icon: Settings },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const t = useT();
  const [me, setMe] = useState<Me | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    apiFetch<Me>('/admin/v1/auth/me')
      .then((data) => {
        // Consumers don't belong in the admin surface — redirect to
        // their own console before rendering any admin chrome.
        if (data.role === 'consumer') {
          router.replace('/console/dashboard' as never);
          return;
        }
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
    <div className="flex min-h-screen">
      <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-muted/30 p-4">
        <div className="mb-6 flex items-start justify-between gap-2 px-2">
          <div>
            <NexaLogo size={24} withWordmark />
            <div className="mt-1 text-xs text-muted-foreground">{t('nav.console')}</div>
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
        </nav>
        <div className="mt-4 space-y-2 border-t border-border pt-4">
          <div className="px-2 text-xs">
            <div className="truncate font-medium">{me.email}</div>
            <div className="text-muted-foreground">{me.role}</div>
          </div>
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
