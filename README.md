<p align="center">
  <img src="apps/web/public/logo.svg" width="72" height="72" alt="Nexa" />
</p>

<h1 align="center">Nexa</h1>

<p align="center">
  <b>面向 Claude Code / Cline / Cursor 的 AI 网关。</b><br/>
  把你的 Claude + ChatGPT 订阅聚合在一个 OpenAI / Anthropic 兼容的 API 背后。<br/>
  卡密按量付费，对比官方价打 85 折，新注册送 $5 体验额度。
</p>

<p align="center">
  <a href="https://claude.xxflk.cn"><b>🌐 线上 — claude.xxflk.cn</b></a> ·
  <a href="docs/quickstart.md">快速上手</a> ·
  <a href="docs/api.md">API</a> ·
  <a href="docs/deployment.md">部署</a> ·
  <a href="docs/security.md">安全</a>
</p>

<p align="center">
  <sub>仓库名沿用 <code>xxf-ai-server</code>；对外品牌 / 站名为 <b>Nexa</b>。<code>@xxf/*</code> 包名不变。</sub>
</p>

---

## 做什么

你把自己的 Claude Code OAuth token（可多个）挂进来，它对外暴露：

- `POST /v1/messages` — Anthropic 原生格式
- `POST /v1/chat/completions` — OpenAI 格式（翻译到 Claude 上游）

在控制台铸一把 `sk-xxf-…` key，把 Claude Code / Cline / Cursor 指到
`https://<你的域名>/v1` 就能用。流式 / 工具调用 / `anthropic-beta` 头全部透传。

幕后调度器按 5 小时滚动窗口在池子里分配请求，自动刷新 OAuth token、冷却遇到限流的
账号、以 micro-USD 精度给每次请求做账。

## 30 秒消费者 demo

```bash
# 1. 去 https://claude.xxflk.cn/register 注册（需要邀请码）
# 2. 点邮箱里的验证链接
# 3. 登录后在 /console/keys 铸一把 key

curl https://claude.xxflk.cn/v1/messages \
  -H 'Authorization: Bearer sk-xxf-你的密钥' \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "claude-sonnet-4-6",
    "max_tokens": 128,
    "messages": [{"role": "user", "content": "你好"}]
  }'
```

任何说 Anthropic 或 OpenAI chat-completions 的客户端都能直接用。
Claude Code 的接法：
`ANTHROPIC_BASE_URL=https://claude.xxflk.cn/v1` + `ANTHROPIC_AUTH_TOKEN=sk-xxf-…`

## 核心能力

| | |
|---|---|
| 🔌 **OAuth 上游** | 用 Claude Code / Codex CLI 的 OAuth token，不做网页逆向；返回格式贴近官方 API，流式稳定 |
| 🌊 **多人账号池** | 多位贡献者挂自己的订阅，每个账号可选"私有 / 共享到池子" |
| 🔄 **双协议** | Anthropic `/v1/messages` + OpenAI `/v1/chat/completions`（翻译层） |
| 🎛️ **管理台 + 控制台** | Next.js 15 管理台（B 端）+ 消费者仪表盘（C 端），中英文切换 |
| 🔐 **硬门槛鉴权** | 邀请码注册 → 邮箱验证 → 激活；5 次密码错锁 15 分钟；忘记密码自助重置 |
| 👮 **生命周期 + 审计** | `pending_verification` / `active` / `suspended` 三态；登录 / 注册 / 验证 / 重置每次都入 `audit_log`（带 IP） |
| 💰 **按 token 计费** | micro-USD 精度，8 个模型预置 85 折价目，赠 $5 欢迎额度，USD + CNY 双币展示 |
| 🎟️ **卡密充值** | 管理员批量铸造，用户在 `/console/wallet` 自助兑换 |
| 🛡️ **韧性** | 5 小时滚动窗口、OAuth 自动刷新、上游错误分级 + 冷却、按 provider 熔断、per-account 出口代理 |
| 📊 **可观测** | Prometheus `/metrics`、pino 结构化日志、审计页支持筛选 |
| 🔒 **安全** | OAuth token 静态 AES-256-GCM、argon2id 密码、JWT cookie 会话、每个写接口 RBAC |

## 架构鸟瞰

```
          ┌───────────────────────────────────────────────────────┐
 客户端   │  Claude Code · Cline · Cursor · curl                  │
          └──────────┬────────────────────────────────────────────┘
                     │  sk-xxf-…  HTTPS
                     ▼
          ┌──────────────────────────────────────────┐
 Caddy ◀──┤  :443  TLS / HSTS / Let's Encrypt 自动续 │
          └──────────┬───────────────────────────────┘
                     ▼
          ┌──────────────────────────────────────────┐
          │ Fastify 5 网关（TS 严格模式）            │
          │  • /v1/*           中转 + 计费           │
          │  • /admin/v1/*     管理 + 认证           │
          │  • /v1/console/*   C 端                  │
          │  • workers: oauth 刷新、探活、清理       │
          └─────┬──────────────────┬─────────────────┘
                │                  │
                ▼                  ▼
         ┌─────────────┐   ┌──────────────┐
         │ Postgres 16 │   │  Redis 7     │
         │ Drizzle ORM │   │ 限流、窗口   │
         │ 11 张表     │   │ 计数、熔断   │
         │ + 迁移       │   │ 互斥锁       │
         └─────────────┘   └──────────────┘
                                  │
                                  ▼ 出口代理（可 per-account）
          ┌──────────────────────────────────────────┐
          │ Anthropic · OpenAI（OAuth Bearer）       │
          └──────────────────────────────────────────┘
```

## 仓库布局

```
apps/server/        Fastify 网关（TypeScript + Drizzle + Redis）
apps/web/           Next.js 15 App Router（落地页 + 管理台 + 控制台）
packages/shared/    跨端共享的 TS 类型
docs/               架构、API、部署、运维、安全、ADR
docker-compose.yml  完整生产栈（caddy + postgres + redis + server + web）
.env.example        所有可配项带注释
```

## 本地开发

需要 Node 20+、pnpm 9+、Docker。

```bash
cp .env.example .env
echo "ENCRYPTION_KEY=$(openssl rand -hex 32)" >> .env
echo "JWT_SECRET=$(openssl rand -hex 48)" >> .env
echo "ADMIN_BOOTSTRAP_TOKEN=$(openssl rand -hex 24)" >> .env

docker compose up -d postgres redis
pnpm install
pnpm --filter @xxf/shared build
pnpm dev
```

- API: <http://localhost:8787>
- Web: <http://localhost:3000>

`.env` 不填 `SMTP_*` 时注册会跳过邮箱验证（直接激活），方便本地断网调试全流程。

建首个管理员：

```bash
pnpm --filter @xxf/server admin:create \
  --email admin@example.com --password '强密码'
```

然后在 `/invites` 铸邀请码发给首批消费者。

## 路由地图

| 场景 | 路径 | 用途 |
|---|---|---|
| 公开页 | `/` `/pricing` `/docs` `/terms` `/privacy` | 品牌 / 文档 |
| 公开鉴权 | `/login` `/register` `/forgot-password` `/reset-password?token=…` `/verify-email?token=…` | 注册 / 登录 / 重置 / 验证 |
| 公开 API | `/v1/pricing` `/healthz` `/readyz` `/version` `/metrics` | 状态 + 价目 |
| 消费者 | `/console/{dashboard,keys,models,usage,wallet,settings}` | C 端 |
| 管理 / 贡献者 | `/{dashboard,accounts,users,keys,invites,redeem-codes,proxies,stats,audit,settings}` | 运营 |
| 对外中转 | `/v1/messages` · `/v1/chat/completions` | 客户端用 `sk-xxf-…` 调 |

## 账户生命周期

```
  register   ┌──────────────────────┐  点邮箱验证链接
 ──────────▶ │ pending_verification │ ──────────────────▶ ┌────────┐
             └──────────────────────┘                    │ active │
                     ▲                                   └────┬───┘
                     │     管理员"强制激活"                   │
                     │ ◀──────────────────────────────────────┤
                     │                                         │
                     │     管理员禁用 / 解禁                   ▼
                     │                                   ┌──────────┐
                     └─────────────────────────────────── │suspended │
                                                         └──────────┘
```

只有 `active` 能登录和调 API。5 次密码错 → `locked_until = now() + 15 分钟`，
登录响应 `423` 带 `retryAfterSec`。重置密码 / 管理员"解锁"都会清零失败计数。

## 计费模型

- 预置 8 个模型官方价 —— Claude Opus / Sonnet / Haiku + GPT-4o / o1 / 4o-mini / 4-turbo / 3.5。
- 全线统一 **85 折**（对比官方价打 15% 优惠），可在 `/settings` 改 `pricing.markupRate`。
- 输入 / 输出 token 分开计费，精度 micro-USD（10⁻⁶ USD）。
- 新账号送 $5 体验额度（`pricing.welcomeCreditMud` 可调）。
- CNY 展示按 `pricing.usdToCnyRate`（默认 7.2）换算。
- 充值：管理员在 `/redeem-codes` 批量铸卡密，用户在 `/console/wallet` 自助兑换。

## 状态

生产环境运行中 —— [claude.xxflk.cn](https://claude.xxflk.cn)。路线图 P0–P5 +
用户管理加强（Phase 1+2）全部完成并部署。未完成项见
[roadmap.md](docs/roadmap.md)。

## 联系 / 支持

- 📮 邮箱: **xixiyeyu@gmail.com**
- 💬 微信:

<p align="left">
  <img src="apps/web/public/relation/wechat.jpg" width="220" alt="WeChat QR" />
</p>

<sub>线上入口：[claude.xxflk.cn](https://claude.xxflk.cn) 页脚，登录后 `/console/dashboard` 右下方也有。</sub>

## 合规声明

把个人订阅聚合后再 API 化给别人用，**通常不符合 Anthropic / OpenAI 个人订阅
条款**。账号封禁是真实风险。威胁模型详见 [docs/security.md](docs/security.md)。
运营方需要自行承担所在司法区域的合规责任。

## 许可

MIT —— 详见 [LICENSE](LICENSE)。
