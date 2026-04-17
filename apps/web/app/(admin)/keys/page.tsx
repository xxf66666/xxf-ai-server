export default function KeysPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">API keys</h1>
        <p className="text-sm text-muted-foreground">
          Keys used by clients (Claude Code, Cline, Cursor…) to call the gateway.
        </p>
      </div>
      <div className="rounded-lg border border-border p-8 text-center text-sm text-muted-foreground">
        Key CRUD implemented in P3.
      </div>
    </div>
  );
}
