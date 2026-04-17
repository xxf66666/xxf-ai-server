export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          System configuration — proxies, model mappings, pool utilization target.
        </p>
      </div>
      <div className="rounded-lg border border-border p-8 text-center text-sm text-muted-foreground">
        Settings editor lands in P5.
      </div>
    </div>
  );
}
