import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="container flex min-h-screen flex-col items-center justify-center gap-6 py-16">
      <div className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight">xxf-ai-server</h1>
        <p className="mt-2 text-muted-foreground">
          AI relay gateway — admin console
        </p>
      </div>
      <div className="flex gap-3">
        <Link
          href="/login"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Sign in
        </Link>
        <Link
          href="/dashboard"
          className="rounded-md border border-border px-4 py-2 text-sm font-medium"
        >
          Go to dashboard
        </Link>
      </div>
    </main>
  );
}
