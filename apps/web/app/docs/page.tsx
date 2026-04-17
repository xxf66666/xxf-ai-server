'use client';

import Link from 'next/link';
import { useT } from '../../lib/i18n/context';
import { LocaleSwitcher } from '../../lib/i18n/LocaleSwitcher';

const BASE = 'https://claude.xxflk.cn';

function Code({ children }: { children: React.ReactNode }) {
  return (
    <pre className="mt-2 overflow-x-auto rounded-md bg-muted px-4 py-3 font-mono text-xs leading-relaxed">
      <code>{children}</code>
    </pre>
  );
}

export default function DocsPage() {
  const t = useT();
  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container flex max-w-4xl items-center justify-between py-4">
          <Link href="/" className="text-sm font-semibold">
            xxf-ai-server
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <Link href={'/pricing' as never} className="text-muted-foreground hover:text-foreground">{t('nav.pricing')}</Link>
            <Link href={'/docs' as never} className="text-primary">{t('nav.docs')}</Link>
            <Link href="/login" className="text-muted-foreground hover:text-foreground">
              {t('home.signin')}
            </Link>
            <Link href={'/register' as never} className="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground">
              {t('register.submit')}
            </Link>
            <LocaleSwitcher />
          </div>
        </div>
      </header>

      <article className="container max-w-4xl space-y-10 py-10">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{t('docs.title')}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t('docs.subtitle')}</p>
          <p className="mt-2 text-sm">{t('docs.register')}</p>
        </div>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t('docs.claudeCode.h')}</h2>
          <p className="text-sm">{t('docs.envvars')}</p>
          <Code>
{`export ANTHROPIC_BASE_URL=${BASE}
export ANTHROPIC_AUTH_TOKEN=sk-xxf-...your-key...`}
          </Code>
          <p className="text-sm">{t('docs.settingsFile', { file: '~/.claude/settings.json' })}</p>
          <Code>
{`{
  "env": {
    "ANTHROPIC_BASE_URL": "${BASE}",
    "ANTHROPIC_AUTH_TOKEN": "sk-xxf-...your-key..."
  }
}`}
          </Code>
          <p className="text-sm">{t('docs.verify')}</p>
          <Code>
{`claude code
# or a one-shot prompt:
claude -p "say hello"`}
          </Code>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t('docs.cline.h')}</h2>
          <p className="text-sm">
            VSCode → Cline settings → API Provider = <strong>Anthropic</strong>
          </p>
          <Code>
{`Base URL:      ${BASE}
API Key:       sk-xxf-...your-key...
Model:         claude-sonnet-4-6`}
          </Code>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t('docs.cursor.h')}</h2>
          <p className="text-sm">
            Cursor → Settings → Models → Override OpenAI base URL.
          </p>
          <Code>
{`OpenAI Base URL:  ${BASE}/v1
OpenAI API Key:   sk-xxf-...your-key...
# Model:           gpt-4o  (auto-mapped to claude-sonnet-4-6 server-side)`}
          </Code>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t('docs.generic.h')}</h2>
          <p className="text-sm">{t('docs.verify')}</p>
          <Code>
{`curl ${BASE}/v1/messages \\
  -H "Authorization: Bearer sk-xxf-...your-key..." \\
  -H "content-type: application/json" \\
  -d '{
    "model": "claude-sonnet-4-6",
    "max_tokens": 64,
    "messages": [{"role":"user","content":"hello"}]
  }'`}
          </Code>
          <Code>
{`curl ${BASE}/v1/chat/completions \\
  -H "Authorization: Bearer sk-xxf-...your-key..." \\
  -H "content-type: application/json" \\
  -d '{
    "model": "gpt-4o",
    "messages": [{"role":"user","content":"hello"}]
  }'`}
          </Code>
        </section>
      </article>
    </main>
  );
}
