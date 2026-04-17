# 变更日志

本项目的所有重要变更都记录在此。格式遵循
[Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循
[语义化版本](https://semver.org/lang/zh-CN/spec/v2.0.0.html)。

## [未发布]

### 新增 — 计费 / 邀请码 / 公开文档页

- **模型价格表** `model_pricing`：初始化 8 个模型的官方价（Claude Opus 4.7 $15/$75 per 1M
  输入/输出，Sonnet 4.6 $3/$15，Haiku 4.5 $1/$5，GPT-4o $2.50/$10，o1 $15/$60 等）。
- **成本计量单位：微 USD (micro-USD)**。每次成功请求计算
  `input × 输入价 + output × 输出价`，再乘 `settings.pricing.markupRate`（默认 0.85，
  相当于 **8.5 折**）。结果写入 `usage_log.cost_mud`，同时从 `users.balance_mud` 扣减。
- **注册赠送 $5 体验额度**，在 `balance_mud` 字段落账。
- **邀请码限制注册**：新增 `invite_codes` 表；无有效邀请码的请求被拒。管理员专属
  `/admin/v1/invites` CRUD，支持 `reset`（重新生成邀请码字符串）和 `revoke`（标记失效但保留记录）。
- 公开接口 `/v1/pricing` + 页面 `/pricing`：**双币（USD + CNY）**价目表，官方价划线 +
  本站折扣价并列。
- 公开页面 `/docs`：Claude Code、Cline、Cursor 接入指南 + 原生 curl 示例。
- C 端仪表盘新增"余额"和"累计消费"卡片（按 USD 格式化）。
- 顶部公开导航（Pricing / Docs / Sign in / Register）在 `/pricing` 和 `/docs` 页可见。

### 新增 — 仪表盘图表

- **管理台仪表盘**：带颜色图标的统计卡片；AreaChart 趋势图（token）叠加 Line（请求数）；
  水平条形图 Top 账号 token 排行。
- **C 端仪表盘**：5 个标签的分析卡片（消耗趋势面积图 / 模型分布饼 / 按密钥请求分布饼 /
  Top 密钥条形 / 状态分布饼），数据来自新接口 `/v1/console/breakdown`。
- 图表库：**recharts**。

### 新增 — C 端（消费者）控制台

- `/register` 自助注册页（需邀请码）；注册后自动落在 `/console/*`。
- `/console` 路由组，独立 layout + 侧栏（仪表盘 / API 密钥 / 可用模型 / 使用日志 / 个人设置）。
- `/v1/console/*` 接口：`overview`、自己的密钥 CRUD、`usage`（最近 50 条，按
  api_keys.user_id 过滤）、`models`、`me/password`（argon2 校验后修改）。
- 问候卡片根据时段显示"早上好/下午好/晚上好"；用量分解只见自己的数据。

### 新增 — 中英双语 UI

- 扁平化 dict（`en` + `zh`，约 200 键）；`I18nProvider` Context + `useT()` hook；
  `<LocaleSwitcher>` EN / 中 两格切换。SSR 固定渲染英文避免 hydration 冲突，挂载后
  根据 `localStorage` → `navigator.language` 切换。

### 新增 — P4 OpenAI 兼容

- `POST /v1/chat/completions`（非流式 + SSE）把 OpenAI 格式请求翻译为 Anthropic
  `/v1/messages`，响应再翻译回 `chat.completion` / `chat.completion.chunk`。
  模型名映射：`gpt-4o` → `claude-sonnet-4-6`，`o1` → `claude-opus-4-7` 等。

### 新增 — P5 代理池 + 指标

- `proxies` 表 + `/admin/v1/proxies` CRUD + 管理页 `/proxies`。每个账号可通过
  `accounts.proxy_id` 绑定代理；relay / probe / refresh 经缓存的 per-account undici
  `ProxyAgent` 出站。
- Prometheus `/metrics`：`xxf_relay_requests_total` 按 provider/route/outcome 计数，
  `xxf_relay_latency_ms` 直方图，`xxf_relay_tokens_total` 按方向计数；另含 Node.js
  默认指标。

### 新增 — P3 管理台 UI + 真正的登录

- **argon2id 密码哈希** + `@fastify/jwt` cookie 会话。端点
  `/admin/v1/auth/{login,logout,me,register}`。`X-Admin-Token` 引导令牌保留为首次
  部署 / 紧急恢复通道。
- **RBAC 中间件**：admin 看全部；contributor 仅自己的账号/密钥；consumer 禁访管理路径。
- **审计日志**（`audit_log` 表 + `record()` 助手），所有管理写操作留痕；
  `/admin/v1/audit` 列表接口。
- **系统设置**（`system_settings`）含类型化键；`/admin/v1/settings` + 可编辑的
  `/settings` 页。
- 统计分维度：`/admin/v1/stats/by-account`、`/admin/v1/stats/by-key`，加原有
  `/overview`。
- 管理台所有页（statistics / accounts / users / keys / proxies）全部接入真数据
  （React Query）。
- `admin:create` CLI（`tsx src/cli/create-admin.ts`）：首次部署建首个 admin。

### 新增 — P2 韧性

- **5 小时滚动窗口**（Redis 键 `window:tokens:<id>`）。各套餐上限：Pro 60k、Max5x
  300k、Max20x 1.2M、Plus 40k、Pro-ChatGPT 200k。
- **OAuth token 自动刷新**（`console.anthropic.com/v1/oauth/token`），Redis 互斥锁防
  风暴；`invalid_grant` 转为 `needs_reauth`。
- **上游错误分级**：429 → `rate_limited` + `cooling_until`；401 → `needs_reauth`；
  403 带封禁文案 → `banned`；5xx → `transient`。
- 调度器跳过非 active 或仍冷却中的账号；优先 owner 匹配，按剩余窗口配额排序。
- **API Key 月配额**（`api_keys.quota_monthly_tokens` / `used_monthly_tokens`）；
  超限 429。
- `@fastify/rate-limit` 挂 `/v1/messages` 和 `/v1/chat/completions`，按
  Authorization 头 SHA-256 指纹做 key，Redis 存储。
- `POST /admin/v1/accounts/:id/probe` —— 1-token 探针，分级 + 应用状态。
- **后台 worker**：refresh（60 秒）+ probe（10 分钟），`DISABLE_WORKERS=1` 可关。
- **上游熔断**：per-provider 60 秒滑窗，≥10 样本且错误率 ≥20% 时断路 30 秒。

### 新增 — P1 MVP 中转

- `POST /v1/messages` Anthropic 兼容，流式 SSE 透传 + 每请求用量计算。
- **AES-256-GCM token 静态加密**（`nonce.ciphertext.tag` 信封）。
- 管理 API 由 `X-Admin-Token` 引导令牌保护：`/admin/v1/{users,accounts,keys}` CRUD。
- API Key 铸造：24 字节随机秘钥，仅 SHA-256 哈希入库，明文一次性返回。
- 调度器 v1（owner-match > 共享池），初始 Drizzle 迁移。

### 新增 — 测试 + CI

- Vitest 39 个单元测试覆盖：crypto seal/open、token envelope、`classifyUpstream`
  （7 个分支）、SSE 用量累加器、OpenAI 请求/响应/流事件翻译、argon2 密码校验。
- GitHub Actions CI：pnpm install（Postgres 16 + Redis 7 服务容器），shared build，
  server + web typecheck，单元测试，server + web build，Prettier 格式检查。

### 新增 — P0 脚手架

- pnpm monorepo：`apps/server`、`apps/web`、`packages/shared`。
- 文档骨架 `docs/`：架构、路线图、API、部署、运维、安全，以及 ADR 0001–0004。
- Docker Compose 开发栈（Postgres + Redis + server + web + Caddy）。
- Fastify 服务器含 `/healthz` `/readyz` `/version`，Drizzle schema 占位。
- Next.js 15 管理台 UI 骨架。

## [0.0.1] - 2026-04-17

- 项目初始化。
