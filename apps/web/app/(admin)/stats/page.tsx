export default function StatsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Stats</h1>
        <p className="text-sm text-muted-foreground">
          Usage over time, per account / key / model. Live data in P3.
        </p>
      </div>
      <div className="rounded-lg border border-border p-8 text-center text-sm text-muted-foreground">
        Charts coming soon.
      </div>
    </div>
  );
}
