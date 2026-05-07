'use client';

import { useState } from 'react';
import { Loader2, Play, Square } from 'lucide-react';
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

// Three cheap-to-mid models so the demo can't cost more than a cent
// even if abused. The /v1/chat/completions endpoint already uses the
// caller's own key for billing — there is no shared demo quota.
const TRY_IT_MODELS = ['deepseek-chat', 'gpt-5', 'claude-sonnet-4-6'];

function TryIt() {
  const t = useT();
  const [model, setModel] = useState(TRY_IT_MODELS[0]);
  const [apiKey, setApiKey] = useState('');
  const [prompt, setPrompt] = useState('Write a 4-line haiku about prompt caching.');
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [controller, setController] = useState<AbortController | null>(null);

  async function run() {
    if (running) return;
    if (!apiKey.trim()) {
      setError(t('docs.sdk.tryit.err.noKey'));
      return;
    }
    setOutput('');
    setError(null);
    const ac = new AbortController();
    setController(ac);
    setRunning(true);
    try {
      const res = await fetch(`${BASE}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${apiKey.trim()}`,
        },
        body: JSON.stringify({
          model,
          stream: true,
          messages: [{ role: 'user', content: prompt }],
        }),
        signal: ac.signal,
      });
      if (!res.ok || !res.body) {
        const txt = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status} — ${txt.slice(0, 220) || res.statusText}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      let acc = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf('\n\n')) >= 0) {
          const event = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          for (const line of event.split('\n')) {
            if (!line.startsWith('data:')) continue;
            const data = line.slice(5).trim();
            if (data === '[DONE]') continue;
            try {
              const j = JSON.parse(data);
              const delta = j.choices?.[0]?.delta?.content ?? '';
              if (delta) {
                acc += delta;
                setOutput(acc);
              }
            } catch {
              // ignore non-JSON keepalive lines
            }
          }
        }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes('aborted')) setError(msg);
    } finally {
      setRunning(false);
      setController(null);
    }
  }

  function stop() {
    controller?.abort();
  }

  return (
    <div className="rounded-xl border border-border bg-muted/20 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">{t('docs.sdk.tryit.title')}</div>
          <div className="text-xs text-muted-foreground">{t('docs.sdk.tryit.subtitle')}</div>
        </div>
        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
          live
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs">
          <span className="mb-1 block font-medium text-muted-foreground">
            {t('docs.sdk.tryit.field.model')}
          </span>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            disabled={running}
            className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 font-mono text-xs"
          >
            {TRY_IT_MODELS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs">
          <span className="mb-1 block font-medium text-muted-foreground">
            {t('docs.sdk.tryit.field.key')}
          </span>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            disabled={running}
            placeholder="sk-xxf-..."
            className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 font-mono text-xs"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
      </div>

      <label className="mt-3 block text-xs">
        <span className="mb-1 block font-medium text-muted-foreground">
          {t('docs.sdk.tryit.field.prompt')}
        </span>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={running}
          rows={2}
          className="w-full resize-y rounded-md border border-border bg-background px-2.5 py-1.5 text-xs"
        />
      </label>

      <div className="mt-3 flex items-center gap-2">
        {!running ? (
          <button
            type="button"
            onClick={run}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Play className="h-3.5 w-3.5" />
            {t('docs.sdk.tryit.run')}
          </button>
        ) : (
          <button
            type="button"
            onClick={stop}
            className="inline-flex items-center gap-1.5 rounded-md bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/20"
          >
            <Square className="h-3.5 w-3.5" />
            {t('docs.sdk.tryit.stop')}
          </button>
        )}
        <span className="text-[10px] text-muted-foreground">{t('docs.sdk.tryit.note')}</span>
      </div>

      {error && (
        <div className="mt-3 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      {(output || running) && (
        <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-md bg-background p-3 font-mono text-xs leading-relaxed">
          {output || (
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              {t('docs.sdk.tryit.waiting')}
            </span>
          )}
        </pre>
      )}
    </div>
  );
}

export default function SdkPage() {
  const t = useT();
  return (
    <DocLayout title={t('docs.sdk.title')}>
      <p>{t('docs.sdk.intro')}</p>

      <TryIt />

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
