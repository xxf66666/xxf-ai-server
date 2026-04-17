export default function LoginPage() {
  return (
    <main className="container flex min-h-screen items-center justify-center py-16">
      <form className="w-full max-w-sm space-y-4 rounded-lg border border-border p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Sign in</h1>
        <p className="text-sm text-muted-foreground">Admin access only (P3).</p>
        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            placeholder="you@example.com"
            disabled
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            disabled
          />
        </div>
        <button
          type="button"
          className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground opacity-60"
          disabled
        >
          Sign in (coming in P3)
        </button>
      </form>
    </main>
  );
}
