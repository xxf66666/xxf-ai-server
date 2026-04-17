export default function AccountsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Accounts</h1>
          <p className="text-sm text-muted-foreground">
            Subscription accounts attached to the pool.
          </p>
        </div>
        <button
          type="button"
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground opacity-60"
          disabled
        >
          Attach account (P1)
        </button>
      </div>
      <div className="rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Label</th>
              <th className="px-4 py-2 font-medium">Provider</th>
              <th className="px-4 py-2 font-medium">Plan</th>
              <th className="px-4 py-2 font-medium">Owner</th>
              <th className="px-4 py-2 font-medium">Shared</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Window usage</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="px-4 py-6 text-center text-muted-foreground" colSpan={7}>
                No accounts yet. Data layer lands in P1.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
