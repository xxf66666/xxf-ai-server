export default function UsersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
        <p className="text-sm text-muted-foreground">
          Downstream consumers and contributors. Implemented in P3.
        </p>
      </div>
      <div className="rounded-lg border border-border p-8 text-center text-sm text-muted-foreground">
        No users yet.
      </div>
    </div>
  );
}
