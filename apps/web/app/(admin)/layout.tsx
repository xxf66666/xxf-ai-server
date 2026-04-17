'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { BarChart3, Boxes, KeyRound, LayoutDashboard, LogOut, Settings, Users } from 'lucide-react';
import { clearAdminToken, getAdminToken } from '../../lib/auth';

const nav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/accounts', label: 'Accounts', icon: Boxes },
  { href: '/users', label: 'Users', icon: Users },
  { href: '/keys', label: 'API keys', icon: KeyRound },
  { href: '/stats', label: 'Stats', icon: BarChart3 },
  { href: '/settings', label: 'Settings', icon: Settings },
] as const;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getAdminToken()) {
      router.replace('/login');
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        loading…
      </div>
    );
  }

  const onLogout = () => {
    clearAdminToken();
    router.replace('/login');
  };

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-muted/30 p-4">
        <div className="mb-6 px-2">
          <div className="text-sm font-semibold">xxf-ai-server</div>
          <div className="text-xs text-muted-foreground">admin console</div>
        </div>
        <nav className="flex-1 space-y-1">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted"
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
        <button
          type="button"
          onClick={onLogout}
          className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-muted-foreground hover:bg-muted"
        >
          <LogOut className="h-4 w-4" />
          <span>Sign out</span>
        </button>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <div className="container max-w-6xl py-8">{children}</div>
      </main>
    </div>
  );
}
