# API 参考

网关共 5 个对外 API 面：

1. **Anthropic 兼容** `/v1/messages` —— 主要 API
2. **OpenAI 兼容** `/v1/chat/completions` —— 给 Cursor 等客户端
3. **公开接口** `/v1/pricing` `/healthz` `/readyz` `/version` `/metrics`
4. **消费者控制台** `/v1/console/*`（JWT cookie 鉴权）
5. **管理台** `/admin/v1/*`（JWT cookie 或 `X-Admin-Token` 引导令牌鉴权）

所有消费者 API 都用 Bearer key：

```
Authorization: Bearer sk-xxf-<密钥>
```

管理台用登录后的 httpOnly JWT cookie，或 `X-Admin-Token: <引导令牌>` 头。

---

## 1. Anthropic 兼容

### `POST /v1/messages`

请求体 / 响应体对齐 [Anthropic Messages
API](https://docs.anthropic.com/en/api/messages)。支持字段：

- `model` —— 直传（`claude-sonnet-4-6`、`claude-opus-4-7`、`claude-haiku-4-5-20251001`…）
- `messages` —— role/content 对数组
- `system` —— 字符串或数组
- `max_tokens` —— 整数，**必填**
- `stream` —— 布尔；`true` 返回 `text/event-stream`
- `temperature` `top_p` `stop_sequences` `tools`（透传）

**非流式示例**：

```bash
curl https://claude.xxflk.cn/v1/messages \
  -H 'Authorization: Bearer sk-xxf-...' \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "claude-sonnet-4-6",
    "max_tokens": 256,
    "messages": [{ "role": "user", "content": "你好" }]
  }'
```

**流式响应**遵循 Anthropic 的 SSE 事件命名：`message_start`、`content_block_start`、
`content_block_delta`、`content_block_stop`、`message_delta`、`message_stop`。网关
逐字节透传，内部从 `message_delta.usage` 提取 token 数用于计费。

### 错误信封

```json
{
  "type": "error",
  "error": {
    "type": "rate_limit_error",
    "message": "monthly token quota exhausted"
  }
}
```

| `error.type` | HTTP | 含义 |
|---|---|---|
| `authentication_error` | 401 | 缺失或无效的 API Key |
| `permission_error` | 403 | Key 无权访问该模型 |
| `not_found_error` | 404 | 模型不可用 |
| `rate_limit_error` | 429 | 速率 / 月配额超限 |
| `api_error` | 502 | 上游不可达 / 错误 |
| `overloaded_error` | 503 | 池子全部冷却 或 熔断开路 |
| `invalid_request_error` | 400 | 请求体校验失败 |

---

## 2. OpenAI 兼容

### `POST /v1/chat/completions`

实现 [OpenAI Chat Completions
API](https://platform.openai.com/docs/api-reference/chat) 的子集。**请求翻译到 Claude
上游**；响应翻译回 `chat.completion` / `chat.completion.chunk` 格式。

模型名自动映射（服务端）：

| 客户端传入 | 实际上游 |
|---|---|
| `gpt-4o` | `claude-sonnet-4-6` |
| `gpt-4o-mini` | `claude-haiku-4-5-20251001` |
| `gpt-4-turbo` / `gpt-4` | `claude-sonnet-4-6` |
| `gpt-3.5-turbo` | `claude-haiku-4-5-20251001` |
| `o1` | `claude-opus-4-7` |
| `o1-mini` | `claude-sonnet-4-6` |
| `claude-*` | （原样直传）|
| 未知 | `claude-sonnet-4-6` |

可在 `/settings` 调整或让管理员改价目表。

---

## 3. 公开接口

### `GET /v1/pricing`

返回所有模型的官方价和本站价，**双币**。

```json
{
  "markupRate": 0.85,
  "usdToCnyRate": 7.2,
  "data": [
    {
      "modelId": "claude-sonnet-4-6",
      "provider": "claude",
      "tier": "sonnet",
      "officialInputUsdPerM": 3,
      "officialOutputUsdPerM": 15,
      "ourInputUsdPerM": 2.55,
      "ourOutputUsdPerM": 12.75,
      "ourInputCnyPerM": 18.36,
      "ourOutputCnyPerM": 91.8
    }
  ]
}
```

缓存头 `cache-control: public, max-age=60`。

### `GET /healthz`

liveness，返回 `{ "ok": true }`。

### `GET /readyz`

readiness，校验 DB + Redis 可达：

```json
{ "ok": true, "checks": { "db": "ok", "redis": "ok" } }
```

### `GET /version`

构建元信息（name / version / commit）。

### `GET /metrics`

Prometheus 格式。暴露 `xxf_relay_requests_total{provider,route,outcome}`、
`xxf_relay_latency_ms_bucket{...}`、`xxf_relay_tokens_total{direction}`，以及
Node.js 默认指标。**无鉴权**；用 Caddy IP 白名单保护。

---

## 4. 消费者控制台 `/v1/console/*`

所有端点要求 JWT cookie（登录后自动附）。所有返回的数据**都按 session 用户 scope**。

| 方法 | 路径 | 作用 |
|---|---|---|
| GET | `/v1/console/overview` | 汇总：`activeKeys`、`tokens24h`、`requests24h`、`usedMonthly`、`balanceMud`、`spentMud`、`timeseries[]` |
| GET | `/v1/console/breakdown` | 近 24h 按模型/密钥/状态聚合 + 每小时趋势 |
| GET | `/v1/console/keys` | 我的 API Key 列表 |
| POST | `/v1/console/keys` | 自己铸一把；返回体含 **plaintext key**（只此一次） |
| DELETE | `/v1/console/keys/:id` | 撤销自己的 key |
| GET | `/v1/console/usage?limit=50` | 最近 N 次请求明细（默认 50、最多 200） |
| GET | `/v1/console/models` | 可用模型列表 |
| PATCH | `/v1/console/me/password` | 改密码（需 `currentPassword` + `newPassword`） |

---

## 5. 管理台 API

所有 `/admin/v1/*` 端点都通过 `preHandler` hook 检查 JWT cookie 或引导令牌。
**例外**（公开）：login / register / 邮箱验证 / 密码重置 四组路径。

### 认证 + 账户生命周期

| 方法 | 路径 | 作用 |
|---|---|---|
| POST | `/admin/v1/auth/login` | email + password → JWT cookie；角色随 payload 返回。**失败码**：`401 authentication_error`、`403 email_not_verified`（body 带 email）、`403 account_suspended`、`423 account_locked`（body 带 `retryAfterSec`） |
| POST | `/admin/v1/auth/register` | 公开；需 `inviteCode`；建 consumer + 赠 welcome credit；**不发 cookie**。返回 `{ status, verificationSent }`：SMTP 已配 → `pending_verification`，无 SMTP → 降级 `active` |
| POST | `/admin/v1/auth/verify-email/request` | 公开；body `{ email }`；对已注册 pending 用户发重置邮件；**无论命中与否都返回 `{ok:true}` 反枚举** |
| POST | `/admin/v1/auth/verify-email/confirm` | 公开；body `{ token }`；消费 token 并原子地把 `pending → active` |
| POST | `/admin/v1/auth/verify-email/send` | 登录用户手动重发（dashboard 上的"重发"按钮用这个） |
| POST | `/admin/v1/auth/password-reset/request` | 公开；body `{ email }`；反枚举；60 分钟 TTL token |
| POST | `/admin/v1/auth/password-reset/confirm` | 公开；body `{ token, password }`；消费 token + 更新密码 + 清零失败计数 / 锁定 |
| POST | `/admin/v1/auth/logout` | 清 cookie |
| GET | `/admin/v1/auth/me` | 返回当前 session（sub/email/role/exp） |

### 账号池

| 方法 | 路径 | 作用 |
|---|---|---|
| GET | `/admin/v1/accounts` | 列表（contributor 仅见自己拥有的） |
| POST | `/admin/v1/accounts` | 挂号（粘 OAuth token） |
| PATCH | `/admin/v1/accounts/:id` | 改状态 / cooling / shared / proxyId / label |
| DELETE | `/admin/v1/accounts/:id` | 解绑 |
| POST | `/admin/v1/accounts/:id/probe` | 立刻探活（1-token 请求） |

### 用户（admin-only）

| 方法 | 路径 | 作用 |
|---|---|---|
| GET | `/admin/v1/users` | 列表；每条带 `status`、`emailVerified`、`lastLoginAt`、`lastLoginIp`、`failedLoginCount`、`locked`、`lockedUntil` |
| POST | `/admin/v1/users` | 新建 |
| PATCH | `/admin/v1/users/:id` | 改 role / 重置密码 / 改 status（`active` / `pending_verification` / `suspended`）/ `unlock:true` 清暴力失败计数。改到 `active` 会同时把 `emailVerified=true`（"强制激活"语义） |
| PATCH | `/admin/v1/users/:id/balance` | 调整余额（`deltaMud` + `reason`） |
| DELETE | `/admin/v1/users/:id` | 删除 |

### API Key

| 方法 | 路径 | 作用 |
|---|---|---|
| GET | `/admin/v1/users/:userId/keys` | 列指定用户的 keys |
| POST | `/admin/v1/keys` | 给任意用户铸 key |
| DELETE | `/admin/v1/keys/:id` | 撤销 |

### 邀请码（admin-only）

| 方法 | 路径 | 作用 |
|---|---|---|
| GET | `/admin/v1/invites` | 列出所有邀请码 |
| POST | `/admin/v1/invites` | 铸造（note、maxUses、expiresAt 可选） |
| POST | `/admin/v1/invites/:id/reset` | **重新生成 code 字符串** + 重置 useCount + 解除 revoked |
| POST | `/admin/v1/invites/:id/revoke` | 标记失效（保留记录） |
| DELETE | `/admin/v1/invites/:id` | 删除 |

### 代理池（admin-only）

| 方法 | 路径 | 作用 |
|---|---|---|
| GET | `/admin/v1/proxies` | 列表 |
| POST | `/admin/v1/proxies` | 添加 |
| PATCH | `/admin/v1/proxies/:id` | 启/停、改 URL/region/maxConcurrency |
| DELETE | `/admin/v1/proxies/:id` | 删除 |

### 系统设置

| 方法 | 路径 | 作用 |
|---|---|---|
| GET | `/admin/v1/settings` | 返回所有已知键 + 当前值 |
| PATCH | `/admin/v1/settings` | admin-only；批量更新（unknown 键被拒） |

可调键：`pool.utilizationTarget`、`pool.minRemainingTokens`、`models.allow`、
`pricing.markupRate`、`pricing.welcomeCreditMud`、`pricing.usdToCnyRate`。

### 统计

| 方法 | 路径 | 作用 |
|---|---|---|
| GET | `/admin/v1/stats/overview` | 系统级总览：activeAccounts、tokensLast24h、requestsLast24h、poolUtilization、24h 时序 |
| GET | `/admin/v1/stats/by-account` | 24h 按账号聚合 |
| GET | `/admin/v1/stats/by-key` | 24h 按 API Key 聚合 |

### 审计日志（admin-only）

| 方法 | 路径 | 作用 |
|---|---|---|
| GET | `/admin/v1/audit?limit=100` | 最近 N 条（最多 500） |

---

## 客户端接入速查

**Claude Code / Cline**（Anthropic 模式）：

```bash
export ANTHROPIC_BASE_URL=https://claude.xxflk.cn
export ANTHROPIC_AUTH_TOKEN=sk-xxf-...
```

**Cursor**（OpenAI 模式）：

```
OpenAI Base URL:  https://claude.xxflk.cn/v1
OpenAI API Key:   sk-xxf-...
```

详见 [公开 /docs 页面](https://claude.xxflk.cn/docs)。
