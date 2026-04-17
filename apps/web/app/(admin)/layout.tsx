import Link from 'next/link';
import { BarChart3, Boxes, KeyRound, LayoutDashboard, Settings, Users } from 'lucide-react';

const nav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/accounts', label: 'Accounts', icon: Boxes },
  { href: '/users', label: 'Users', icon: Users },
  { href: '/keys', label: 'API keys', icon: KeyRound },
  { href: '/stats', label: 'Stats', icon: BarChart3 },
  { href: '/settings', label: 'Settings', icon: Settings },
] as const;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-60 shrink-0 border-r border-border bg-muted/30 p-4">
        <div className="mb-6 px-2">
          <div className="text-sm font-semibold">xxf-ai-server</div>
          <div className="text-xs text-muted-foreground">admin console</div>
        </div>
        <nav className="space-y-1">
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
      </aside>
      <main className="flex-1 overflow-y-auto">
        <div className="container max-w-6xl py-8">{children}</div>
      </main>
    </div>
  );
}
