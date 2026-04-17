export default function DashboardPage() {
  const cards = [
    { label: 'Active accounts', value: '—' },
    { label: 'Tokens (24h)', value: '—' },
    { label: 'Requests (24h)', value: '—' },
    { label: 'Pool utilization', value: '—' },
  ];
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Live view of the gateway — wired up in phase P3.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg border border-border bg-background p-4">
            <div className="text-xs text-muted-foreground">{c.label}</div>
            <div className="mt-1 text-2xl font-semibold">{c.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
