'use client';

import { Code, DocLayout, H2 } from '../../../components/DocLayout';

const BASE = 'https://claude.xxflk.cn';

export default function CursorDocs() {
  return (
    <DocLayout title="Cursor">
      <p>
        <a
          href="https://cursor.com"
          className="text-primary hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          Cursor
        </a>{' '}
        是 VSCode fork 的 AI 编辑器，原生走 OpenAI 协议。本站的{' '}
        <code>/v1/chat/completions</code> 端点会把 OpenAI 请求翻译到 Claude 上游，所以 Cursor
        里输入 <code>gpt-4o</code> 实际会被转发到 <code>claude-sonnet-4-6</code>。
      </p>

      <H2>1. 配置</H2>
      <ol className="list-decimal space-y-2 pl-6">
        <li>
          Cursor → <strong>Settings</strong>（⌘ ,）→ <strong>Models</strong>
        </li>
        <li>勾上 <strong>Override OpenAI Base URL</strong></li>
        <li>
          OpenAI Base URL 填：
          <Code>{`${BASE}/v1`}</Code>
          （注意 Cursor 这里需要带 <code>/v1</code>，和 Claude Code 不同）
        </li>
        <li>
          OpenAI API Key 填：<code>sk-xxf-...你的密钥...</code>
        </li>
        <li>Verify 或直接跑一次 Cursor Chat 试一下</li>
      </ol>

      <H2>2. 可用模型名</H2>
      <p>Cursor 的模型下拉里选 OpenAI 模型，本站自动映射：</p>
      <Code>{`gpt-4o           → claude-sonnet-4-6
gpt-4o-mini      → claude-haiku-4-5-20251001
o1               → claude-opus-4-7
gpt-4-turbo      → claude-sonnet-4-6`}</Code>
      <p>
        如果想**直接**指定 Claude 模型，在模型名输入框里手输 <code>claude-sonnet-4-6</code>{' '}
        等原生 ID，Cursor 会原样传过来。
      </p>

      <H2>3. 小贴士</H2>
      <ul className="list-disc space-y-1 pl-6">
        <li>
          Cursor 的 <strong>Composer</strong>（⌘ I）和 <strong>Tab 补全</strong>都走同一个 API，
          花费都会累计
        </li>
        <li>
          <strong>Tab 补全非常消耗 token</strong> —— 如果预算紧建议关掉或只保留 Chat
        </li>
        <li>
          Cursor 里的"工具调用 / Agent 模式"目前经我们翻译层会退化为文本回复 —— 高级场景
          建议转用 Claude Code
        </li>
      </ul>
    </DocLayout>
  );
}
