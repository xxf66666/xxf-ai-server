# 架构

## 1. 目标

提供**统一 API 端点**给 AI 编码工具（Claude Code、Cline、Cursor…）调用，背后是一池由
可信用户贡献的**订阅账号 OAuth token**。附带每账号配额、健康监控、按 token 计费和
Web 管理 / 消费者控制台。

## 2. 高层拓扑

```
                 ┌──────────────────────────────────────────────┐
                 │                 公网                         │
                 └──────────────────┬───────────────────────────┘
                                    │ HTTPS
                      ┌─────────────▼─────────────┐
                      │  Caddy（TLS、反代、       │
                      │  限流、路径分发）          │
                      └──────┬──────────┬─────────┘
                             │          │
                ┌────────────▼──┐   ┌───▼──────────────┐
                │  apps/server  │   │   apps/web       │
                │  Fastify API  │   │  Next.js 前端    │
                │  :8787        │   │  :3000           │
                └──┬─────────┬──┘   └────────┬─────────┘
                   │         │               │
           ┌───────▼──┐   ┌──▼────┐      （调 server）
           │ Postgres │   │ Redis │
           └──────────┘   └───────┘
                   │
    ┌──────────────┴──────────────┐
    │ 直连出站 或 per-account 代理 │
    └──────────────┬──────────────┘
                   │
          ┌────────▼─────────┐
          │  上游 OAuth      │
          │  （Anthropic /   │
          │   OpenAI）       │
          └──────────────────┘
```

## 3. 组件

### 3.1 `apps/server`（Fastify + TypeScript）

#### API 层（`src/api/*`）

- `anthropic/messages.ts` — `POST /v1/messages`（Anthropic 兼容）
- `openai/chat.ts` — `POST /v1/chat/completions`（OpenAI 兼容，翻译到 Claude 上游）
- `public/pricing.ts` — `GET /v1/pricing`（公开双币价目）
- `console/index.ts` — `/v1/console/*`，消费者自己的数据：
  overview / breakdown / keys / usage / models / me/password
- `admin/*` — `/admin/v1/*`，管理台 JSON API：
  auth / accounts / api-keys / users / invites / proxies / settings / stats / audit
- `health.ts` — `/healthz` `/readyz` `/version` `/metrics`

#### 核心模块（`src/core/*`）

- `oauth/` — Claude Code OAuth 客户端 + token 刷新
- `accounts/` — 账号注册、调度、健康分级、窗口配额、探活
- `relay/` — 上游 fetch + SSE 透传 + 熔断器 + OpenAI→Anthropic 翻译
- `users/` — API Key 铸造、认证、月配额、argon2 密码、余额账本（ledger）
- `pricing/` — 按模型查价 + 计算 `cost_mud`（缓存 5 分钟）
- `invites/` — 邀请码生成 / 原子消费 / 重置 / 撤销
- `settings/` — 类型化键值对读写
- `proxies/` — per-account `undici.ProxyAgent` 缓存
- `audit/` — 管理动作写 `audit_log`

#### 基础设施

- `db/` — Drizzle schema + 迁移
- `cache/` — Redis 客户端（窗口计数、token 缓存、速率限制、分布式锁）
- `middleware/` — admin-auth、rbac
- `utils/` — pino 日志、AES-GCM 加密、出站代理 dispatcher、Prometheus registry
- `workers/` — 后台 refresh + probe tick

### 3.2 `apps/web`（Next.js 15）

#### 公开（无需登录）
- `/` `/pricing` `/docs` `/login` `/register`

#### 消费者控制台 `/console/*`
仪表盘 + 自己的密钥/模型/用量/设置。

#### 管理台 `(admin)/*`（URL 不带路由组）
8 个页面，RBAC 控制可见性。admin 看全部；contributor 仅自己拥有的账号/密钥；
consumer 禁访（登录后被重定向到 `/console`）。

#### 基础设施
- `lib/i18n/` — 中英字典 + Context + LocaleSwitcher
- `lib/api.ts` — 带 cookie + Bootstrap token 的 fetch 封装
- `lib/providers.tsx` — React Query + I18nProvider 根组件
- `components/charts/` — recharts 封装

### 3.3 `packages/shared`

零运行时包，只提供 TS 类型：DTO、枚举常量（`PROVIDERS`、`USER_ROLES` 等），
`server` 和 `web` 共用。

## 4. 数据模型

当前 9 张表，按领域分组：

| 表 | 作用 |
|---|---|
| `users` | 管理员、贡献者、消费者统一表；含 argon2 `password_hash`、`role`、`balance_mud`、`spent_mud` |
| `accounts` | 上游 OAuth 订阅账号；含 AES-GCM 加密的 access/refresh token、归属 owner、是否共享、状态、5h 窗口用量、可绑代理 |
| `api_keys` | 消费者调用 API 的 Bearer key；仅 SHA-256 哈希入库；含月配额 |
| `usage_log` | 每次请求一行；含 tokens、延迟、HTTP 状态、`cost_mud`、错误码 |
| `model_pricing` | 按模型存 `input_mud_per_m` / `output_mud_per_m`（官方价）|
| `invite_codes` | 邀请码：code、备注、最大使用、已用、撤销状态、过期时间 |
| `system_settings` | 键值对：`pricing.markupRate`、`pricing.welcomeCreditMud`、`pricing.usdToCnyRate`、`pool.utilizationTarget` 等 |
| `audit_log` | 管理写操作审计：actor、action、entity、detail JSON |
| `proxies` | 出口代理；`accounts.proxy_id` 可引用 |

详细字段见 [`apps/server/src/db/schema.ts`](../apps/server/src/db/schema.ts)。

## 5. 请求生命周期（流式 /v1/messages）

```
客户端（Cline）
   │  POST /v1/messages  (Bearer sk-xxf-...)
   ▼
rate-limit 插件      — 按 key 指纹限流
   │
api-key 中间件       — 查 api_keys，验状态、月配额
   │
熔断器检查           — per-provider，断路则 503
   │
调度器 pickAccount   — owner-match > 共享；按剩余窗口排序
   │
oauth refresh        — token 接近过期时 Redis 锁 + 刷新
   │
代理 dispatcher      — account.proxy_id 有绑定则走 undici ProxyAgent
   │
上游 fetch (Anthropic)  — SSE
   │
relay 透传           — byte-by-byte 转给客户端；沿途累积 usage
   │
请求完成钩子         — 写 usage_log（含 cost_mud）、
                        users.balance_mud -= cost、
                        users.spent_mud += cost、
                        account 窗口用量、metrics、api_key.used_monthly
   ▼
客户端
```

## 6. 横切关注点

- **token 静态加密**：AES-256-GCM，`nonce.ciphertext.tag` 拼接入库；单一
  `ENCRYPTION_KEY` 环境变量。
- **出口代理**：每个账号可绑独立代理（`accounts.proxy_id` → `proxies`），
  relay + probe 经缓存的 per-account `ProxyAgent` 出站。避免多账号共用 GCP IP
  触发风控。
- **可观测**：pino JSON 日志含 `reqId`；Prometheus `/metrics` 提供请求数 / 延迟
  直方图 / token 计数。
- **背压**：按 API Key 指纹的 Redis token bucket 限流；超限返 Anthropic 风格
  `rate_limit_error` + `Retry-After`。
- **计费精度**：内部统一 micro-USD（10⁻⁶ USD），`bigint` 存储避免浮点漂移。

## 7. 非目标

- Serverless（Cloudflare Workers 之流）—— SSE 时间限制 + 有状态调度不合适。
- 多区域 active-active —— 单区域满足小团队 + 代销目标。
- 端到端 Chat UI —— 由客户端自带，本站不提供。
- 支付充值 —— 当前计费只展示，不真扣；接 Stripe 或卡密是下阶段事。
