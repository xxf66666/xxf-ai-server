'use client';

import { Code, DocLayout, H2, H3 } from '../../../components/DocLayout';

const BASE = 'https://claude.xxflk.cn';

export default function ApiDocs() {
  return (
    <DocLayout title="Raw API">
      <p>
        本站对外提供两个协议，URL 和字段都对齐官方；你可以用任何客户端调用。所有请求都需要
        <code className="rounded bg-muted px-1">Authorization: Bearer sk-xxf-...</code> 头。
      </p>

      <H2>Anthropic：/v1/messages</H2>
      <H3>非流式</H3>
      <Code>{`curl ${BASE}/v1/messages \\
  -H "Authorization: Bearer sk-xxf-..." \\
  -H "content-type: application/json" \\
  -d '{
    "model": "claude-sonnet-4-6",
    "max_tokens": 128,
    "messages": [
      {"role": "user", "content": "hello"}
    ]
  }'`}</Code>

      <H3>流式</H3>
      <Code>{`curl -N ${BASE}/v1/messages \\
  -H "Authorization: Bearer sk-xxf-..." \\
  -H "content-type: application/json" \\
  -d '{
    "model": "claude-sonnet-4-6",
    "max_tokens": 128,
    "stream": true,
    "messages": [
      {"role": "user", "content": "hello"}
    ]
  }'`}</Code>
      <p className="text-xs text-muted-foreground">
        SSE 事件完全对齐 Anthropic：<code>message_start</code>、
        <code>content_block_delta</code>、<code>message_delta</code>、<code>message_stop</code>。
      </p>

      <H2>OpenAI：/v1/chat/completions</H2>
      <Code>{`curl ${BASE}/v1/chat/completions \\
  -H "Authorization: Bearer sk-xxf-..." \\
  -H "content-type: application/json" \\
  -d '{
    "model": "gpt-4o",
    "messages": [
      {"role": "user", "content": "hello"}
    ]
  }'`}</Code>
      <p>模型名自动映射（gpt-4o → claude-sonnet-4-6），也可传 <code>claude-*</code> 原生 ID。</p>

      <H2>错误响应</H2>
      <p>所有错误都返 Anthropic 风格信封：</p>
      <Code>{`{
  "type": "error",
  "error": {
    "type": "rate_limit_error",
    "message": "monthly token quota exhausted"
  }
}`}</Code>

      <H2>HTTP 状态码</H2>
      <ul className="list-disc space-y-1 pl-6 text-xs">
        <li><code>200</code> —— 正常</li>
        <li><code>400</code> —— 请求格式错 / 模型名错 / 参数无效</li>
        <li><code>401</code> —— 没带 Key 或 Key 无效 / 被撤销</li>
        <li><code>402</code> —— 余额耗尽（去{' '}
          <a href="/console/wallet" className="text-primary hover:underline">钱包</a>{' '}
          充值）</li>
        <li><code>403</code> —— Key 无权访问该模型</li>
        <li><code>429</code> —— 速率限制（每分钟 60 次）或月配额超限</li>
        <li><code>502</code> —— 上游 Anthropic 不可达</li>
        <li><code>503</code> —— 池子全部冷却 / 断路器开路</li>
      </ul>

      <H2>限流</H2>
      <p>
        默认每个 API Key <strong>60 req / 60s</strong>，按 key 指纹计。需要更高限额找管理员调。
      </p>

      <H2>计费</H2>
      <p>
        每次请求按 <code>输入 token × 输入单价 + 输出 token × 输出单价</code>，
        所有模型在官方价基础上打 <strong>85 折</strong>（可在 <a href="/pricing" className="text-primary hover:underline">/pricing</a> 看表）。
      </p>
      <p className="text-xs text-muted-foreground">
        错误（4xx / 5xx）**不计费**。仅 2xx 成功请求扣余额。
      </p>
    </DocLayout>
  );
}
