'use client';

import { useT } from '../../../lib/i18n/context';
import { Code, DocLayout, H2, H3 } from '../../../components/DocLayout';

const BASE = 'https://claude.xxflk.cn';

// Tiny header for "label this code block" — saves us from a full
// tab-component when each section just shows three blocks (curl /
// Python / Node) one after another.
function Lang({ children }: { children: React.ReactNode }) {
  return (
    <div className="-mb-2 inline-flex items-center gap-1 rounded-t-md border border-b-0 border-border bg-background px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
      {children}
    </div>
  );
}

export default function SdkPage() {
  const t = useT();
  return (
    <DocLayout title={t('docs.sdk.title')}>
      <p>{t('docs.sdk.intro')}</p>

      <H2>{t('docs.sdk.auth.heading')}</H2>
      <p>
        {t('docs.sdk.auth.body1')}{' '}
        <code className="rounded bg-muted px-1">Authorization: Bearer sk-xxf-…</code>{' '}
        {t('docs.sdk.auth.body2')}
      </p>
      <ul className="ml-6 list-disc space-y-1.5">
        <li>
          <strong>BASE</strong> = <code className="rounded bg-muted px-1">{BASE}/v1</code>{' '}
          {t('docs.sdk.auth.note.base')}
        </li>
        <li>{t('docs.sdk.auth.note.scope')}</li>
        <li>{t('docs.sdk.auth.note.streaming')}</li>
      </ul>

      <H2>{t('docs.sdk.openai.heading')}</H2>
      <p>{t('docs.sdk.openai.intro')}</p>

      <H3>Python</H3>
      <Lang>pip install openai</Lang>
      <Code>{`from openai import OpenAI

client = OpenAI(
    base_url="${BASE}/v1",
    api_key="sk-xxf-..."  # the Nexa key, NOT a real OpenAI key
)

# Anthropic-via-OpenAI shape — switch model id and you're on Claude
res = client.chat.completions.create(
    model="claude-sonnet-4-6",
    messages=[{"role": "user", "content": "hi"}],
)
print(res.choices[0].message.content)

# Same client, DeepSeek upstream
res = client.chat.completions.create(
    model="deepseek-chat",
    messages=[{"role": "user", "content": "hi"}],
)
print(res.choices[0].message.content)`}</Code>

      <Lang>streaming</Lang>
      <Code>{`stream = client.chat.completions.create(
    model="deepseek-chat",
    messages=[{"role": "user", "content": "explain prompt caching in 2 lines"}],
    stream=True,
)
for chunk in stream:
    print(chunk.choices[0].delta.content or "", end="", flush=True)`}</Code>

      <H3>Node.js / TypeScript</H3>
      <Lang>npm install openai</Lang>
      <Code>{`import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: '${BASE}/v1',
  apiKey: process.env.NEXA_KEY!,  // sk-xxf-...
});

const res = await client.chat.completions.create({
  model: 'claude-sonnet-4-6',
  messages: [{ role: 'user', content: 'hi' }],
});
console.log(res.choices[0].message.content);`}</Code>

      <Lang>streaming</Lang>
      <Code>{`const stream = await client.chat.completions.create({
  model: 'gpt-5.4',
  messages: [{ role: 'user', content: 'count to 5' }],
  stream: true,
});
for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content ?? '');
}`}</Code>

      <H2>{t('docs.sdk.anthropic.heading')}</H2>
      <p>{t('docs.sdk.anthropic.intro')}</p>

      <H3>Python</H3>
      <Lang>pip install anthropic</Lang>
      <Code>{`from anthropic import Anthropic

client = Anthropic(
    base_url="${BASE}",          # NO trailing /v1 — the SDK adds /v1/messages
    api_key="sk-xxf-...",
)

msg = client.messages.create(
    model="claude-opus-4-7",
    max_tokens=512,
    messages=[{"role": "user", "content": "design a 3-table schema for a chat app"}],
)
print(msg.content[0].text)`}</Code>

      <Lang>streaming</Lang>
      <Code>{`with client.messages.stream(
    model="claude-sonnet-4-6",
    max_tokens=1024,
    messages=[{"role": "user", "content": "tell me a haiku"}],
) as stream:
    for text in stream.text_stream:
        print(text, end="", flush=True)`}</Code>

      <H3>Node.js / TypeScript</H3>
      <Lang>npm install @anthropic-ai/sdk</Lang>
      <Code>{`import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  baseURL: '${BASE}',
  apiKey: process.env.NEXA_KEY!,
});

const msg = await client.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 512,
  messages: [{ role: 'user', content: 'hi' }],
});
console.log(msg.content[0].type === 'text' ? msg.content[0].text : '');`}</Code>

      <H2>{t('docs.sdk.envvars.heading')}</H2>
      <p>{t('docs.sdk.envvars.intro')}</p>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-left text-muted-foreground">
            <tr>
              <th className="px-3 py-2">{t('docs.sdk.envvars.col.tool')}</th>
              <th className="px-3 py-2">{t('docs.sdk.envvars.col.envBase')}</th>
              <th className="px-3 py-2">{t('docs.sdk.envvars.col.envKey')}</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-border">
              <td className="px-3 py-2">Claude Code (CLI)</td>
              <td className="px-3 py-2 font-mono">ANTHROPIC_BASE_URL</td>
              <td className="px-3 py-2 font-mono">ANTHROPIC_AUTH_TOKEN</td>
            </tr>
            <tr className="border-t border-border">
              <td className="px-3 py-2">Anthropic SDK (Python/JS)</td>
              <td className="px-3 py-2 font-mono">ANTHROPIC_BASE_URL</td>
              <td className="px-3 py-2 font-mono">ANTHROPIC_API_KEY</td>
            </tr>
            <tr className="border-t border-border">
              <td className="px-3 py-2">OpenAI SDK (Python/JS)</td>
              <td className="px-3 py-2 font-mono">OPENAI_BASE_URL</td>
              <td className="px-3 py-2 font-mono">OPENAI_API_KEY</td>
            </tr>
            <tr className="border-t border-border">
              <td className="px-3 py-2">Cline (OpenAI mode)</td>
              <td className="px-3 py-2 font-mono">OpenAI Base URL setting</td>
              <td className="px-3 py-2 font-mono">OpenAI Key setting</td>
            </tr>
            <tr className="border-t border-border">
              <td className="px-3 py-2">Cursor</td>
              <td className="px-3 py-2 font-mono">Override OpenAI Base URL</td>
              <td className="px-3 py-2 font-mono">OpenAI API Key</td>
            </tr>
          </tbody>
        </table>
      </div>

      <H2>{t('docs.sdk.gotchas.heading')}</H2>
      <ul className="ml-6 list-disc space-y-2">
        <li>
          <strong>{t('docs.sdk.gotcha.baseUrl.title')}</strong>{' '}
          {t('docs.sdk.gotcha.baseUrl.body')}
        </li>
        <li>
          <strong>{t('docs.sdk.gotcha.timeout.title')}</strong>{' '}
          {t('docs.sdk.gotcha.timeout.body')}
        </li>
        <li>
          <strong>{t('docs.sdk.gotcha.retry.title')}</strong>{' '}
          {t('docs.sdk.gotcha.retry.body')}
        </li>
        <li>
          <strong>{t('docs.sdk.gotcha.cache.title')}</strong>{' '}
          {t('docs.sdk.gotcha.cache.body')}
        </li>
        <li>
          <strong>{t('docs.sdk.gotcha.tools.title')}</strong>{' '}
          {t('docs.sdk.gotcha.tools.body')}
        </li>
      </ul>

      <H2>{t('docs.sdk.migration.heading')}</H2>
      <p>{t('docs.sdk.migration.body')}</p>
      <Code>{`# Before — direct OpenAI
- OpenAI(api_key=os.environ["OPENAI_API_KEY"])
+ # After — Nexa
+ OpenAI(api_key=os.environ["OPENAI_API_KEY"], base_url="${BASE}/v1")

# That's literally the entire diff.`}</Code>
    </DocLayout>
  );
}
