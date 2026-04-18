'use client';

import { Code, DocLayout, H2, H3 } from '../../../components/DocLayout';

const BASE = 'https://claude.xxflk.cn';

export default function ClaudeCodeDocs() {
  return (
    <DocLayout title="Claude Code">
      <p>
        Claude Code 是 Anthropic 官方 CLI，是本站的主推客户端。下面是端到端接入步骤 ——
        覆盖 macOS / Linux / Windows。
      </p>

      <H2>1. 注册账号 + 铸 API Key</H2>
      <p>
        去 <a href="/register" className="text-primary hover:underline">/register</a>{' '}
        用邀请码注册。登录后进 <strong>控制台 → API 密钥</strong>，点 <strong>Mint key</strong>，
        复制弹出的 <code className="rounded bg-muted px-1">sk-xxf-...</code>（只显示这一次）。
      </p>

      <H2>2. 配置 Claude Code</H2>

      <H3>方案 A：环境变量（推荐）</H3>
      <p>macOS / Linux：把下面两行加到 <code>~/.zshrc</code> 或 <code>~/.bashrc</code>：</p>
      <Code>{`export ANTHROPIC_BASE_URL=${BASE}
export ANTHROPIC_AUTH_TOKEN=sk-xxf-...你的密钥...`}</Code>

      <p>Windows（PowerShell 永久设置）：</p>
      <Code>{`[Environment]::SetEnvironmentVariable('ANTHROPIC_BASE_URL', '${BASE}', 'User')
[Environment]::SetEnvironmentVariable('ANTHROPIC_AUTH_TOKEN', 'sk-xxf-...你的密钥...', 'User')`}</Code>

      <H3>方案 B：settings.json</H3>
      <p>
        编辑 <code>~/.claude/settings.json</code>（没有就新建）：
      </p>
      <Code>{`{
  "env": {
    "ANTHROPIC_BASE_URL": "${BASE}",
    "ANTHROPIC_AUTH_TOKEN": "sk-xxf-...你的密钥..."
  }
}`}</Code>
      <p className="text-xs text-muted-foreground">
        ⚠ <strong>BASE_URL 不要带 /v1 后缀</strong> —— Claude Code 自己会拼。带了会 404。
      </p>

      <H2>3. 验证</H2>
      <Code>{`claude -p "回我一句：pong"`}</Code>
      <p>如果看到 Claude 的回复就是通了。或者跑 <code>claude code</code> 进交互模式。</p>

      <H2>4. 选模型</H2>
      <p>
        Claude Code 默认用 Sonnet。改默认可在 <code>settings.json</code> 里加：
      </p>
      <Code>{`{
  "env": {
    "ANTHROPIC_BASE_URL": "${BASE}",
    "ANTHROPIC_AUTH_TOKEN": "sk-xxf-...",
    "ANTHROPIC_MODEL": "claude-opus-4-7"
  }
}`}</Code>
      <p>
        可用模型：<code>claude-opus-4-7</code>、<code>claude-sonnet-4-6</code>、
        <code>claude-haiku-4-5-20251001</code>。价格差 3-15 倍，请按需选。
      </p>

      <H2>5. 观察花费</H2>
      <p>
        在本站 <a href="/console/usage" className="text-primary hover:underline">控制台 → 使用日志</a>{' '}
        里能看到每次请求的 token 数 + 精确成本。余额在{' '}
        <a href="/console/wallet" className="text-primary hover:underline">钱包</a>{' '}
        页，快没了可以去兑换卡密补上。
      </p>

      <H2>FAQ</H2>
      <H3>报错 "context_management: Extra inputs are not permitted"</H3>
      <p>
        已修复。如仍遇到，检查 Claude Code 版本是否太旧或太新 —— 极新的版本可能发送了上游还不支持的 beta
        字段。联系我反馈。
      </p>
      <H3>报错 "account balance depleted"</H3>
      <p>
        余额扣完了。去 <a href="/console/wallet" className="text-primary hover:underline">钱包</a>{' '}
        兑换卡密充值即可。
      </p>
      <H3>报错 "no upstream claude account available"</H3>
      <p>
        池子临时耗尽或全部冷却中 —— 等几分钟重试。如果长时间不恢复请联系管理员。
      </p>
    </DocLayout>
  );
}
