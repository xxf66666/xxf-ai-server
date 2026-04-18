# 安全与风险模型

本文档**如实**说明把订阅账号聚合后以 API 形式再暴露，并非这些订阅的原本意图。我们
记录风险边界，方便运营方自行做知情决策。

## 1. 法律 / ToS 风险

- Claude Pro / Max 条款限定使用者为本人。把多个订阅 token 聚合成 API 池供他人使用，
  可能违反 [Anthropic 使用策略](https://www.anthropic.com/legal/aup) 和商业条款。
- OpenAI ChatGPT 订阅条款同样严格。
- 潜在代价：账号封禁、索赔（相当于观测到的 API 使用费）、极端情况下民事诉讼。

**缓解**：

- 运营群体保持**小而可信**；优先自用，其次代销。
- 若代销，避免在营销中强调"等价于官方 API"或"大幅低于官方价"这类易引起关注的话术。
- 任何账号被要求撤下时**保证快速解绑 + 删除数据**的能力（`/admin/v1/accounts/:id`
  DELETE 立即生效）。

## 2. 封号检测风险（云 IP + 多账号）

| 风险 | 严重度 | 缓解 |
|---|---|---|
| 云厂商 IP 可识别 | 低 | 低账号数时可接受 |
| 多账号从同一 IP 出站 | **高** | per-account 绑定独立住宅代理 |
| 账号 IP 地理漂移 | 中 | 每账号锁定稳定出口 IP |
| 单账号并发 burst | 中 | 池子目标 80% 窗口利用率，平滑流量 |

推荐代理源：IPRoyal、Bright Data，或自建住宅 / 移动代理池。**绝不**一天内把单个账号
在多个代理之间切换。

## 3. Token 静态加密

- 算法：**AES-256-GCM**，每次加密 96-bit 随机 nonce，auth tag 内联存储。
- 密钥：`ENCRYPTION_KEY`（32 字节十六进制）从进程环境读取。**永远不入库、不入仓**。
- 存储格式：`nonce.ciphertext.tag`（三段 base64，`.` 分隔）。

### 密钥轮换流程

1. 生成 `ENCRYPTION_KEY_NEXT` 和旧 key 同时部署。
2. 运行 re-encrypt CLI（TODO：目前未实装，手动 SQL 重加密）：
   把所有 accounts 的 oauth_access_token / oauth_refresh_token 用旧 key 解密、用新
   key 再加密、写回。
3. 全部迁完后，把 `KEY_NEXT` 升级为 `ENCRYPTION_KEY`，下次部署删掉旧变量。

## 4. 下游鉴权

- API Key 是 **24 字节随机值**，前缀 `sk-xxf-`，仅 SHA-256 哈希入库。明文**只在
  铸造时返回一次**。
- 管理台密码 argon2id 哈希（19 MiB memory cost，2 rounds，OWASP 最低推荐）。
- 会话用 `@fastify/jwt` + cookie：
  - `httpOnly: true; secure: production; sameSite: 'lax'; maxAge: 7d`
  - 签名密钥 `JWT_SECRET` 至少 32 字符
- 无长期 session；7 天不活动后强制重登。
- 引导令牌 `ADMIN_BOOTSTRAP_TOKEN`：仅用于首次部署 / 恢复，生产环境应该在建 admin 后
  **从 `.env` 删除**。

### 4.1 账户生命周期硬门槛

见 [ADR 0008](adr/0008-user-lifecycle.md)。要点：

- 用户三态 `pending_verification` / `active` / `suspended`；**只有 active 能登录和调 API**。
- 注册完不自动登录 —— 必须点验证邮件里的链接才能切到 `active`。
- `/admin/v1/auth/verify-email/request` 是公开重发接口，对未注册邮箱和已注册邮箱返回
  完全相同的 200 `{ok:true}`，避免用户枚举。
- 验证 token 48 小时 TTL，单次消费（`used_at` 原子更新）。
- token 被消费后走 `pending_verification → active` 迁移，但 **`suspended` 不会**被
  过期 token 反激活（CASE WHEN 防御）。

### 4.2 暴力登录防护

- 5 次失败密码 → `locked_until = now() + 15 min`。触发锁定那次直接 423 响应，带
  `retryAfterSec`。
- 锁定检查在密码 verify **之前**：防止攻击者利用 argon2 的 CPU 成本做放大/时序攻击。
- 未注册邮箱不计数器、不泄露"此邮箱是否存在"的信息 —— verify 仍然走一次 bogus hash
  保持时序一致。
- 成功登录清零计数器，`last_login_at` / `last_login_ip` 落库便于审计。
- 管理员在 `/users` 页可一键解锁（PATCH 带 `unlock:true`）。

### 4.3 密码重置

- 公开接口 `/admin/v1/auth/password-reset/request` 发重置邮件，反枚举。
- token 60 分钟 TTL（比 email 验证更严，重置是高危动作）。
- `/admin/v1/auth/password-reset/confirm` 原子地：消费 token → 更新密码哈希 →
  清零失败计数 / 锁定时间。
- ⚠️ **已知妥协**：重置后已签发的 JWT cookie **不会失效**（无状态 session 的代价）
  —— 被攻击者抢先拿到密码的窗口内仍能用旧 session。缓解方式在 roadmap：按 user 的
  `password_changed_at` 戳在 JWT claims 里比对。

### 4.4 审计日志

所有账号事件落 `audit_log`：

| action | 触发 |
|---|---|
| `user.register` | 注册成功 |
| `user.email_verified` | 邮箱验证链接点成功 |
| `user.email_verify_resend` | 控制台重发验证信 |
| `user.login` | 登录成功（带 IP） |
| `user.login_failed` | 密码错（带失败次数 / IP / 是否触发锁定） |
| `user.password_reset` | 重置完成 |
| `user.update` / `user.delete` | 管理员改角色 / 状态 / 密码 / 删除 |
| `user.balance_adjust` | 余额调整（含 delta + 备注） |
| `redeem.*` / `invites.*` | 卡密 / 邀请码生命周期 |

管理员 `/audit` 页按 action / actor / 时间筛选，20 秒自动刷新。

## 5. 传输层

- 仅 TLS 1.3（Caddy 默认）。
- HSTS: `max-age=31536000; includeSubDomains`（可在生产稳定后开 preload）。
- Caddy 自动签 Let's Encrypt 证书。

## 6. 数据保留

| 数据 | 保留期 | 原因 |
|---|---|---|
| OAuth token | 账号生命周期 | 业务必需 |
| 用量日志（usage_log） | 90 天 | 计费窗口 + 审计 |
| 请求 / 响应体 | **不保留** | 减少数据泄露影响面 |
| 审计日志（audit_log） | 365 天 | 合规留痕 |
| 邀请码 | 管理员删除前持久化 | 审计 |

## 7. 威胁模型 —— 我们防的

- **外部攻击者试扫 API**：按 key 指纹限流（`@fastify/rate-limit` + Redis）；连续 401
  按 IP 额外限流（未实装，计划中）。
- **Key 泄露**：消费者可在 `/console/keys` 自行撤销 + 重铸；月配额上限控制爆炸半径。
- **数据库泄露**：OAuth token 都是密文；没有 `ENCRYPTION_KEY` 就解不开。
- **邀请码泄露**：管理员可在 `/invites` 点 "Reset" 一键更新码值。
- **管理员账号被盗**：审计日志 + JWT 会话可按 user 全部失效（改密码后旧 token 仍有效
  直到过期，这是当前设计妥协）。

## 8. 威胁模型 —— 我们不防的

- **主机被拿**（VM root）：攻击者拿到 `.env` + 数据库，游戏结束。缓解：SSH key-only
  登录、fail2ban、磁盘加密、云厂商最小角色权限 —— 标准 hygiene。
- **npm 供应链**：`pnpm-lock.yaml` 固定版本有帮助，但没做深度审计。Node 依赖是已知的
  供应链面。

## 9. 合规建议

如果把本站作为**商业产品**运营（即使只是给小圈子代销）：

- 在 `/` 和 `/pricing` 页加**显式免责声明**：服务基于第三方 API 订阅聚合，存在供应商
  策略变更导致服务中断的风险；用户数据处理方式；如何联系运营方取消账号等
- 考虑**实名登记运营主体**（公司 / 个体工商）并注册域名 ICP 备案（中国大陆部署）
- 使用条款（ToS）中明确**不含内容保证**、不承担下游用户滥用的连带责任

这些不是代码能解决的 —— 是公司运营的事。
