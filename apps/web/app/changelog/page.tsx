'use client';

import Link from 'next/link';
import { useT } from '../../lib/i18n/context';
import { MarketingHeader } from '../../components/MarketingHeader';
import { MarketingFooter } from '../../components/MarketingFooter';

interface ChangelogEntry {
  date: string;
  title: string;
  body: string;
  // Tag = ship category. Keep this taxonomy small or it becomes noise.
  tag: 'feature' | 'fix' | 'docs' | 'perf';
  link?: { href: string; label: string };
}

const tagStyles: Record<ChangelogEntry['tag'], string> = {
  feature:
    'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50',
  fix: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50',
  docs: 'bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-900/50',
  perf: 'bg-violet-50 text-violet-800 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-900/50',
};

// Curated user-facing changes only. Internal refactors and dependency
// bumps go in CHANGELOG.md; what shows up here is what a customer would
// notice. Newest first. Keep ~12 entries — older history lives in git.
const entries: ChangelogEntry[] = [
  {
    date: '2026-05-08',
    title: 'Drop-in /docs/sdk page with live Try-it',
    body: 'OpenAI and Anthropic SDK config in Python and Node, env-var cheat sheet for Claude Code / Cline / Cursor, and an in-page Try-it that streams a real /v1/chat/completions response.',
    tag: 'docs',
    link: { href: '/docs/sdk', label: 'Open' },
  },
  {
    date: '2026-05-08',
    title: 'Public status page + /v1/status',
    body: 'Live probes against the gateway, Postgres, Redis, plus per-provider availability. Auto-refreshes every 30 seconds.',
    tag: 'feature',
    link: { href: '/status', label: 'Open' },
  },
  {
    date: '2026-05-08',
    title: 'vs OpenRouter comparison',
    body: 'Honest head-to-head table covering markup, Claude OAuth pool, protocols, caps, prompt caching, and payment rails.',
    tag: 'docs',
    link: { href: '/vs/openrouter', label: 'Open' },
  },
  {
    date: '2026-05-08',
    title: 'Vibe-coding landing page',
    body: 'Drop-in configs for Claude Code, Cline, Cursor, and OpenCode, with four budgeting habits to keep agent bills predictable.',
    tag: 'docs',
    link: { href: '/vibe-coding', label: 'Open' },
  },
  {
    date: '2026-05-07',
    title: 'Cost guide and DeepSeek value-prop on home',
    body: 'New /docs/cost-guide cheat sheet covering tab-complete, refactors, big-context review, and reasoning. Home page surfaces the sub-cent DeepSeek price directly.',
    tag: 'docs',
    link: { href: '/docs/cost-guide', label: 'Open' },
  },
  {
    date: '2026-05-06',
    title: 'OpenAPI 3.1 spec + interactive Scalar reference',
    body: 'Hand-written 18 KB OpenAPI doc covering /v1/messages, /v1/chat/completions, /v1/catalog, /v1/pricing, /healthz, /version. Browse it interactively.',
    tag: 'docs',
    link: { href: '/docs/api-reference', label: 'Open' },
  },
  {
    date: '2026-05-05',
    title: 'Per-key spending caps (day / week / month)',
    body: 'Set hard $-caps on each API key. The gateway returns 402 instead of forwarding once a window is exhausted. Redis-backed sliding counters with calendar-aligned buckets.',
    tag: 'feature',
    link: { href: '/console/keys', label: 'Manage keys' },
  },
  {
    date: '2026-05-05',
    title: '9 providers behind one key',
    body: 'OpenAI, DeepSeek, Qwen, Kimi, GLM, Doubao, Mistral, Gemini, Anthropic. Provider-prefix dispatcher routes by model id; one Authorization header for all.',
    tag: 'feature',
    link: { href: '/pricing', label: 'See pricing' },
  },
  {
    date: '2026-05-03',
    title: 'Cache-aware billing',
    body: 'Input, cache_read, cache_creation, and output tokens are billed at separate rates exposed in /v1/pricing. cache_read at 10% input rate; cache_creation at 125%.',
    tag: 'fix',
  },
  {
    date: '2026-05-02',
    title: 'Real input-token counting + TTFB tracking',
    body: 'Replaced an estimator with the upstream-reported usage block. Stats dashboard now shows true time-to-first-token per model.',
    tag: 'perf',
  },
  {
    date: '2026-05-01',
    title: 'Account pool dashboard',
    body: 'Admin view of the Claude OAuth account pool — health, last successful relay, cooldown state, circuit-breaker history.',
    tag: 'feature',
  },
  {
    date: '2026-04-30',
    title: 'Codex CLI catalog refresh',
    body: 'Synced model_pricing with the April 2026 OpenAI codex-cli catalog. Auto-translation kicks in on /v1/messages so codex-* models work over both protocols.',
    tag: 'fix',
  },
];

export default function ChangelogPage() {
  const t = useT();
  return (
    <main className="min-h-screen bg-background">
      <MarketingHeader />
      <section className="container mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{t('changelog.title')}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t('changelog.subtitle')}</p>

        <div className="mt-10 space-y-8">
          {entries.map((e, idx) => (
            <article
              key={e.title}
              className="relative pl-8"
              style={{ animation: `fadeUp 0.4s ease-out ${idx * 0.04}s backwards` }}
            >
              <span
                aria-hidden
                className="absolute left-2 top-2 h-2 w-2 rounded-full bg-primary ring-4 ring-primary/10"
              />
              {idx < entries.length - 1 && (
                <span
                  aria-hidden
                  className="absolute left-[10px] top-5 h-full w-px -translate-x-1/2 bg-border"
                />
              )}
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">{e.date}</span>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${tagStyles[e.tag]}`}
                >
                  {e.tag}
                </span>
              </div>
              <h2 className="mt-1 text-base font-semibold">{e.title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{e.body}</p>
              {e.link && (
                <Link
                  href={e.link.href as never}
                  className="mt-2 inline-block text-xs font-medium text-primary hover:underline"
                >
                  {e.link.label} →
                </Link>
              )}
            </article>
          ))}
        </div>
      </section>
      <MarketingFooter />
      <style jsx global>{`
        @keyframes fadeUp {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </main>
  );
}
