'use client';

import { useT } from '../../../lib/i18n/context';
import { Code, DocLayout, H2, H3 } from '../../../components/DocLayout';

export default function CostGuidePage() {
  const t = useT();
  return (
    <DocLayout title={t('docs.cost.title')}>
      <p>{t('docs.cost.intro')}</p>

      <H2>{t('docs.cost.heading.cheatsheet')}</H2>
      <p>{t('docs.cost.cheatsheet.intro')}</p>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-left text-muted-foreground">
            <tr>
              <th className="px-3 py-2">{t('docs.cost.col.task')}</th>
              <th className="px-3 py-2">{t('docs.cost.col.pick')}</th>
              <th className="px-3 py-2">{t('docs.cost.col.why')}</th>
              <th className="px-3 py-2 text-right">{t('docs.cost.col.cost')}</th>
            </tr>
          </thead>
          <tbody>
            {[
              {
                task: t('docs.cost.row.tabComplete'),
                pick: 'gpt-5.1-codex-mini',
                why: t('docs.cost.row.tabComplete.why'),
                cost: '~$0.0001',
              },
              {
                task: t('docs.cost.row.shortChat'),
                pick: 'deepseek-chat',
                why: t('docs.cost.row.shortChat.why'),
                cost: '~$0.001',
              },
              {
                task: t('docs.cost.row.refactor'),
                pick: 'claude-sonnet-4-6',
                why: t('docs.cost.row.refactor.why'),
                cost: '~$0.05',
              },
              {
                task: t('docs.cost.row.bigContext'),
                pick: 'kimi-k2-0905-preview',
                why: t('docs.cost.row.bigContext.why'),
                cost: '~$0.10',
              },
              {
                task: t('docs.cost.row.architecture'),
                pick: 'claude-opus-4-7',
                why: t('docs.cost.row.architecture.why'),
                cost: '~$0.50',
              },
              {
                task: t('docs.cost.row.reasoning'),
                pick: 'deepseek-reasoner',
                why: t('docs.cost.row.reasoning.why'),
                cost: '~$0.02',
              },
            ].map((r) => (
              <tr key={r.task} className="border-t border-border align-top">
                <td className="px-3 py-2">{r.task}</td>
                <td className="px-3 py-2 font-mono text-[11px]">{r.pick}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.why}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-[11px]">
                  {r.cost}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">{t('docs.cost.cheatsheet.footnote')}</p>

      <H2>{t('docs.cost.heading.byProvider')}</H2>
      <p>{t('docs.cost.byProvider.intro')}</p>

      <H3>DeepSeek — {t('docs.cost.deepseek.tag')}</H3>
      <p>{t('docs.cost.deepseek.desc')}</p>
      <Code>{`// Claude Code style (.claude/settings.json)
{
  "ANTHROPIC_BASE_URL": "https://claude.xxflk.cn/v1",
  "ANTHROPIC_AUTH_TOKEN": "sk-xxf-...",
  "ANTHROPIC_MODEL": "deepseek-chat"
}

// OpenAI SDK (Cursor / Cline OpenAI mode)
{
  "openai.baseURL": "https://claude.xxflk.cn/v1",
  "openai.apiKey":  "sk-xxf-...",
  "openai.model":   "deepseek-chat"
}`}</Code>

      <H3>Anthropic Claude — {t('docs.cost.claude.tag')}</H3>
      <p>{t('docs.cost.claude.desc')}</p>
      <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
        {t('docs.cost.claude.tip')}
      </p>

      <H3>Kimi (Moonshot) — {t('docs.cost.kimi.tag')}</H3>
      <p>{t('docs.cost.kimi.desc')}</p>

      <H3>Qwen / GLM / Doubao — {t('docs.cost.cn.tag')}</H3>
      <p>{t('docs.cost.cn.desc')}</p>

      <H2>{t('docs.cost.heading.budgeting')}</H2>
      <p>{t('docs.cost.budgeting.intro')}</p>
      <ul className="ml-6 list-disc space-y-1.5">
        <li>{t('docs.cost.budgeting.b1')}</li>
        <li>{t('docs.cost.budgeting.b2')}</li>
        <li>{t('docs.cost.budgeting.b3')}</li>
      </ul>

      <H2>{t('docs.cost.heading.formulas')}</H2>
      <p>{t('docs.cost.formulas.intro')}</p>
      <Code>{`cost_usd = (
    input_tokens         * input_rate
  + cache_read_tokens    * cache_read_rate     // ≈ 10% input rate
  + cache_creation_tokens * cache_creation_rate // ≈ 125% input rate
  + output_tokens        * output_rate
) / 1_000_000

charged_usd = cost_usd * markupRate   // 0.85 by default = 15% off`}</Code>
      <p className="text-xs text-muted-foreground">
        {t('docs.cost.formulas.note')}
      </p>
    </DocLayout>
  );
}
