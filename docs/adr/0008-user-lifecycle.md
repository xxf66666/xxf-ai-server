# 0008 — 用户生命周期 + 邮箱验证硬门槛 + 暴力登录防护

**状态**: Accepted · 2026-04-18

## 背景

早期版本里注册 = 立刻进控制台 + 软 banner 提示"去验证邮箱"。这个设计有两个问题：

1. 验证是软性的 —— 假邮箱随便填都能注册并用 $5 体验额度，刷子成本接近零
2. 一旦用户滥用 / 欠费 / 需要下线，代码里**没有"禁用"动作** —— 只能 `DELETE`，
   但删了就丢余额、丢审计、丢卡密历史

同时发现了相关问题：没有暴力登录防护，没有忘记密码，没有登录 IP 审计。

## 决策

### 1. 用 `users.status` 三态枚举统管账户生命周期

```
pending_verification ─验证邮件─▶ active ─ 管理员suspend ─▶ suspended
                                    ▲                          │
                                    └── 管理员reactivate ───────┘
```

`pending_verification` 和 `suspended` 都在登录和 API 鉴权处直接拒。这把
"是否可登录" / "API 是否可用" 两件事**合并成单一字段**，避免散落在 n 个 boolean 里
互相不一致。

### 2. 注册不自动登录

注册端点只返回 `{ status, verificationSent }` —— **不下发 JWT cookie**。用户
**必须**去邮箱点链接把状态切到 `active`，再走登录。

邮箱没配 SMTP 时优雅降级：`status = 'active'` 直接落库（为本地开发和无邮箱的私有
部署保留使用路径）。生产环境必须配 `SMTP_*`。

### 3. 反枚举的重发接口

`/admin/v1/auth/verify-email/request` 和 `/admin/v1/auth/password-reset/request`
**对任何输入都返回 `{ok:true}`**，不区分"此邮箱存在"vs"不存在"。避免攻击者
拿接口当用户名枚举 oracle。

### 4. 5 + 15 暴力防护

- 5 次密码错 → 锁 15 分钟
- 失败计数存在 `users.failed_login_count`
- 锁定期记在 `users.locked_until`
- 锁检查放在 `verifyPassword` **之前**（避免给攻击者 argon2 时序 oracle）
- 成功登录清零；管理员可一键"解锁"清零
- 密码重置也清零（重置就是在说"这个人就是本人"）

### 5. 审计扩展

`user.login` / `user.login_failed` / `user.password_reset` 三个新 action 进
`audit_log`，带 IP。配合 `/audit` 页，运营可以直接看"这个号最近登录 IP"、
"谁在暴力尝试"。

## 其他选择与为什么没选

### 选项 A: Redis-based rate limit 按 (email, IP) 双键

每次登录在 Redis 做滑窗计数。优点：比 DB 写便宜，不占 users 列。
缺点：

- 单次登录本来就要读 users 行（拿 password hash），再多一个 DB 写无所谓
- Redis 重启就丢了锁状态（虽然概率低但尴尬）
- 管理员要看某用户锁定时间，要额外去 Redis 查

DB 方案的额外 UPDATE 在失败路径才触发，loss-case 写 + happy-path 无增量 —— 代价
可接受。

### 选项 B: 分离 `pending_users` 表，验证后才插 `users`

理论上更干净（未验证用户不占 users 空间）。实际上：

- 邀请码消费点在哪？两个地方都得处理就绕
- Welcome credit 在哪时点种？又要区分两阶段
- 统计 `COUNT(users)` 口径突然要 JOIN pending 表
- 切状态 > 搬行，事务更简单

一个字段 + CASE WHEN 做状态机，简单可演进。

### 选项 C: 撤销已发 JWT（重置密码时）

技术上可以：把 `password_changed_at` 塞进 JWT claims，每次请求比对 user 的当前
值。拒掉过期 token。

没做的原因是要给所有 request path 都加一个 users 表读（目前消费 API 只读一次
users），性能影响要度量。现阶段依赖 cookie 7 天过期作为兜底，后续真的出事再补。

## 迁移

- Migration `0005_*`：加 `users.status` 默认 `pending_verification` + `last_login_at`;
  **backfill: 所有存量 users → `active`**（避免存量被误锁）
- Migration `0006_*`：加 `password_reset_tokens` 表 + `failed_login_count` /
  `locked_until` / `last_login_ip`

已在生产（https://claude.xxflk.cn）验证 5 失败 = 锁 15 分、reset 走通、pending
用户登录被拒。

## 审计开销

额外写：
- 每次 login 成功: 1 row audit + 1 update users
- 每次 login 失败: 1 row audit + 1 update users
- 每次 register: 1 row audit
- 每次 email_verified: 1 row audit
- 每次 password_reset: 1 row audit

对比交易量（每账户 ~10 login/day）忽略不计。
