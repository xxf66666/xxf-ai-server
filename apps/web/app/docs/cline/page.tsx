'use client';

import { Code, DocLayout, H2 } from '../../../components/DocLayout';

const BASE = 'https://claude.xxflk.cn';

export default function ClineDocs() {
  return (
    <DocLayout title="Cline（VSCode）">
      <p>
        <a
          href="https://github.com/cline/cline"
          className="text-primary hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          Cline
        </a>{' '}
        是 VSCode 的一个开源 AI 助手插件，支持 Anthropic 协议。
      </p>

      <H2>1. 安装</H2>
      <p>VSCode → Extensions → 搜索 <strong>Cline</strong> → Install。</p>

      <H2>2. 配置 API</H2>
      <p>
        打开命令面板（<kbd>⌘⇧P</kbd> / <kbd>Ctrl+Shift+P</kbd>）→ 搜索{' '}
        <code>Cline: Open Settings</code>。在 <strong>API Provider</strong> 区：
      </p>
      <ul className="list-disc space-y-1 pl-6">
        <li>
          Provider: <strong>Anthropic</strong>
        </li>
        <li>
          Anthropic Base URL: <code>{BASE}</code>
        </li>
        <li>
          Anthropic API Key: <code>sk-xxf-...你的密钥...</code>
        </li>
        <li>
          Model: <code>claude-sonnet-4-6</code>（或 opus / haiku）
        </li>
      </ul>

      <H2>3. 开始用</H2>
      <p>
        侧栏点 Cline 图标 → 输入指令，Cline 会自动调用。花费在本站的{' '}
        <a href="/console/usage" className="text-primary hover:underline">控制台 → 使用日志</a>{' '}
        可见。
      </p>

      <H2>4. 小贴士</H2>
      <ul className="list-disc space-y-1 pl-6">
        <li>Cline 默认每次会发整个仓库上下文 —— 第一次请求可能很贵，注意 prompt 长度</li>
        <li>
          建议用 <code>claude-sonnet-4-6</code> 作为日常选择；遇到复杂任务再切 Opus
        </li>
        <li>
          Cline 支持 <strong>Prompt Caching</strong>，重复调同一上下文花费会显著降低
        </li>
      </ul>

      <H2>示例 settings</H2>
      <Code>{`{
  "cline.apiProvider": "anthropic",
  "cline.anthropicBaseUrl": "${BASE}",
  "cline.apiKey": "sk-xxf-...",
  "cline.anthropicModel": "claude-sonnet-4-6"
}`}</Code>
    </DocLayout>
  );
}
