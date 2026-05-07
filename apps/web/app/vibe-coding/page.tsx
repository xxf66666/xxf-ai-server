'use client';

import Link from 'next/link';
import { ArrowRight, Coffee, Cpu, Terminal, Workflow, Zap } from 'lucide-react';
import { Instrument_Serif } from 'next/font/google';
import { useT } from '../../lib/i18n/context';
import { MarketingHeader } from '../../components/MarketingHeader';
import { MarketingFooter } from '../../components/MarketingFooter';

const headlineSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  style: 'italic',
  display: 'swap',
});

interface ToolConfig {
  name: string;
  filename: string;
  body: string;
}

const TOOL_CONFIGS: ToolConfig[] = [
  {
    name: 'Claude Code',
    filename: '~/.claude/settings.json',
    body: `{
  "ANTHROPIC_BASE_URL": "https://claude.xxflk.cn",
  "ANTHROPIC_AUTH_TOKEN": "sk-xxf-...",
  "ANTHROPIC_MODEL": "claude-sonnet-4-6"
}`,
  },
  {
    name: 'Cline (Anthropic mode)',
    filename: 'VS Code → Cline settings',
    body: `Provider:   Anthropic
Base URL:   https://claude.xxflk.cn
API Key:    sk-xxf-...
Model:      claude-sonnet-4-6`,
  },
  {
    name: 'Cursor (OpenAI mode)',
    filename: 'Cursor → Settings → Models',
    body: `Override OpenAI Base URL:  https://claude.xxflk.cn/v1
OpenAI API Key:            sk-xxf-...
Model name:                claude-sonnet-4-6
                            (or deepseek-chat, gpt-5.4, etc.)`,
  },
  {
    name: 'OpenCode (terminal IDE)',
    filename: '~/.opencode/config.toml',
    body: `[provider]
base_url = "https://claude.xxflk.cn"
api_key  = "sk-xxf-..."
model    = "claude-sonnet-4-6"`,
  },
];

export default function VibeCodingPage() {
  const t = useT();

  const benefits = [
    {
      icon: Zap,
      title: t('vibe.benefit.cheap.title'),
      desc: t('vibe.benefit.cheap.desc'),
      tone: 'from-emerald-500/15 to-teal-500/10 text-emerald-700',
    },
    {
      icon: Workflow,
      title: t('vibe.benefit.context.title'),
      desc: t('vibe.benefit.context.desc'),
      tone: 'from-violet-500/15 to-indigo-500/10 text-violet-700',
    },
    {
      icon: Coffee,
      title: t('vibe.benefit.long.title'),
      desc: t('vibe.benefit.long.desc'),
      tone: 'from-amber-500/15 to-orange-500/10 text-amber-700',
    },
    {
      icon: Cpu,
      title: t('vibe.benefit.tools.title'),
      desc: t('vibe.benefit.tools.desc'),
      tone: 'from-pink-500/15 to-rose-500/10 text-pink-700',
    },
  ];

  return (
    <main className="min-h-screen bg-background">
      <MarketingHeader />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute -left-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-gradient-to-br from-violet-400/20 via-indigo-400/15 to-transparent blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 top-20 h-[26rem] w-[26rem] rounded-full bg-gradient-to-tl from-emerald-400/15 via-teal-300/10 to-transparent blur-3xl"
        />

        <div className="container relative mx-auto max-w-5xl px-4 py-20 md:py-24">
          <div className="text-center">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1 text-xs backdrop-blur">
              <Terminal className="h-3.5 w-3.5" />
              <span className="text-muted-foreground">{t('vibe.hero.badge')}</span>
            </div>
            <h1 className="text-4xl font-semibold tracking-tight md:text-6xl">
              <span className={`${headlineSerif.className} text-primary`}>
                {t('vibe.hero.title.lead')}
              </span>
              <br />
              {t('vibe.hero.title.tail')}
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base text-muted-foreground md:text-lg">
              {t('vibe.hero.pitch')}
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                href={'/register' as never}
                className="group inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-medium text-primary-foreground hover:shadow-md"
              >
                {t('vibe.hero.cta')}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <a
                href="#configs"
                className="rounded-md border border-border bg-background px-5 py-3 text-sm font-medium hover:bg-muted"
              >
                {t('vibe.hero.skip')}
              </a>
            </div>
          </div>

          {/* Big stat trio */}
          <div className="mt-16 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Stat big="~50%" small={t('vibe.stat.discount')} accent="text-emerald-700" />
            <Stat big="8h+" small={t('vibe.stat.session')} accent="text-violet-700" />
            <Stat big="1 key" small={t('vibe.stat.oneKey')} accent="text-indigo-700" />
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="border-t border-border bg-gradient-to-b from-muted/30 via-background to-background">
        <div className="container mx-auto max-w-5xl px-4 py-16">
          <h2 className="mx-auto max-w-2xl text-center text-2xl font-semibold tracking-tight md:text-3xl">
            {t('vibe.benefits.heading')}
          </h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {benefits.map((b) => {
              const Icon = b.icon;
              return (
                <div
                  key={b.title}
                  className="rounded-xl border border-border bg-background p-5 transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${b.tone}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-sm font-semibold">{b.title}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{b.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Configs */}
      <section id="configs" className="border-t border-border">
        <div className="container mx-auto max-w-5xl px-4 py-16">
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
            {t('vibe.configs.heading')}
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{t('vibe.configs.intro')}</p>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {TOOL_CONFIGS.map((c) => (
              <div key={c.name} className="rounded-xl border border-border bg-background p-5">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">{c.name}</div>
                  <code className="font-mono text-[10px] text-muted-foreground">{c.filename}</code>
                </div>
                <pre className="mt-3 overflow-x-auto rounded-md bg-muted px-3 py-2.5 font-mono text-[11px] leading-relaxed">
                  <code>{c.body}</code>
                </pre>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            {t('vibe.configs.footnote')}{' '}
            <Link href={'/docs/sdk' as never} className="text-primary hover:underline">
              /docs/sdk
            </Link>
            .
          </p>
        </div>
      </section>

      {/* Habits */}
      <section className="border-t border-border bg-muted/20">
        <div className="container mx-auto max-w-3xl px-4 py-16">
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
            {t('vibe.habits.heading')}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">{t('vibe.habits.intro')}</p>
          <ol className="mt-6 space-y-4">
            <Habit n="1" title={t('vibe.habits.h1.title')} body={t('vibe.habits.h1.body')} />
            <Habit n="2" title={t('vibe.habits.h2.title')} body={t('vibe.habits.h2.body')} />
            <Habit n="3" title={t('vibe.habits.h3.title')} body={t('vibe.habits.h3.body')} />
            <Habit n="4" title={t('vibe.habits.h4.title')} body={t('vibe.habits.h4.body')} />
          </ol>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border">
        <div className="container mx-auto max-w-4xl px-4 py-20">
          <div className="rounded-2xl border border-border bg-gradient-to-br from-violet-500/10 via-indigo-500/10 to-emerald-500/10 p-12 text-center md:p-16">
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
              <span className={`${headlineSerif.className} text-primary`}>
                {t('vibe.cta.heading')}
              </span>
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-sm text-muted-foreground md:text-base">
              {t('vibe.cta.sub')}
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                href={'/register' as never}
                className="group inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:shadow-md"
              >
                {t('vibe.cta.primary')}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href={'/docs/claude-code' as never}
                className="rounded-md border border-border bg-background/60 px-6 py-3 text-sm font-medium backdrop-blur hover:bg-muted"
              >
                {t('vibe.cta.docs')}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </main>
  );
}

function Stat({ big, small, accent }: { big: string; small: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-5 text-center">
      <div className={`text-3xl font-semibold tracking-tight md:text-4xl ${accent ?? ''}`}>
        {big}
      </div>
      <div className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">{small}</div>
    </div>
  );
}

function Habit({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <li className="flex gap-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 font-mono text-sm font-semibold text-primary">
        {n}
      </div>
      <div>
        <div className="text-sm font-semibold">{title}</div>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{body}</p>
      </div>
    </li>
  );
}
