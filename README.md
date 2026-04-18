# Nexa

> **AI 网关**：把 Claude / ChatGPT 订阅账号通过 OAuth 聚合成统一 API，给 AI 编码工具
> （Claude Code、Cline、Cursor 等）使用。

面向小团队自用 + 可对外售卖。把多名成员贡献的订阅账号放进池子，按健康度 + 剩余窗口配额
调度到传入请求，提供 Web 管理后台和消费者控制台，支持按 token 计费（内置折扣，送 $5
体验额度）。

> 仓库历史名 `xxf-ai-server`；对外品牌 / 站名为 **Nexa**。包名 `@xxf/*` 保持不变。

**线上实例**: https://claude.xxflk.cn

---

## 核心能力

- **OAuth 上游**：用 Claude Code / Codex CLI 的 OAuth token，不做网页逆向 —— 返回格式贴近
  官方 API，流式稳定。
- **多人账号池**：多个用户可把自己的订阅挂进来，自选"私有 / 共享到池子"。
- **双协议兼容**：`POST /v1/messages`（Anthropic）+ `POST /v1/chat/completions`（OpenAI，
  翻译到 Claude 上游）。
- **后台 + 控制台**：Next.js 15 管理后台（B 端）+ 消费者控制台（C 端），中英双语切换。
- **邀请码注册 + 邮箱硬门槛**：registration 受邀请码限制；注册后账号处于 `pending_verification`
  状态，必须点邮件里的链接激活才能登录 / 调 API。
- **完整用户生命周期**：`pending_verification` / `active` / `suspended` 三态；管理员可
  强制激活、禁用、解禁。
- **暴力登录防护**：5 次失败自动锁 15 分钟，管理员可一键解锁。
- **忘记密码自助重置**：公开接口发重置链接（60 分钟有效），反枚举响应。
- **按 token 计费 + 双币展示**：每次请求算成本（micro-USD 精度），UI 双币显示，
  注册送 $5 体验额度，统一 85 折（15% 优惠）。
- **卡密充值**：管理员批量铸造卡密，消费者在钱包自助兑换。
- **运维能力**：5 小时滚动窗口配额、token 自动刷新、上游错误分级 + 冷却、
  断路器、per-account 代理绑定、Prometheus `/metrics`、Grafana 可接。
- **审计日志**：所有账户事件（登录 / 失败登录 / 注册 / 验证 / 重置 / 管理写操作）全部落表，
  管理员页带筛选。
- **安全**：AES-256-GCM token 静态加密、argon2id 密码、JWT cookie、RBAC。

---

## 仓库布局

```
xxf-ai-server/            # 仓库名（历史），品牌是 Nexa
├── apps/
│   ├── server/           Fastify API 网关（TypeScript + Drizzle + Redis）
│   └── web/              Next.js 15 管理台 + 消费者控制台（Tailwind + shadcn 样式）
├── packages/
│   └── shared/           跨端共用 TS 类型
├── docs/                 架构、路线图、API、部署、运维、安全、ADR
├── docker-compose.yml
├── Caddyfile
└── .env.example
```

**关键文档**：
- [架构总览](docs/architecture.md)
- [分阶段路线图](docs/roadmap.md)
- [API 参考](docs/api.md)
- [部署指南](docs/deployment.md)
- [运维手册](docs/operations.md)
- [快速上手](docs/quickstart.md)

---

## 快速开始（本地开发）

前置：Node.js 20+、pnpm 9+、Docker。

```bash
cp .env.example .env
# 生成本地密钥
echo "ENCRYPTION_KEY=$(openssl rand -hex 32)" >> .env.local
echo "JWT_SECRET=$(openssl rand -hex 48)" >> .env.local
echo "ADMIN_BOOTSTRAP_TOKEN=$(openssl rand -hex 24)" >> .env.local

# 把 .env.local 里的值合并到 .env（或直接编辑 .env）

# 启 Postgres + Redis
docker compose up -d postgres redis

# 安装依赖、构建 shared 包
pnpm install
pnpm --filter @xxf/shared build

# 开发模式
pnpm dev
```

- API 网关：http://localhost:8787
- 管理台 / C 端：http://localhost:3000

**邮箱验证兜底**：`.env` 中不配 `SMTP_*` 时，注册会直接把用户置为 `active` 以便本地开发
跑通全流程；一旦配上 SMTP，注册就自动切换成"pending 等验证邮件"的硬门槛。

首次登录：用 `.env` 里的 `ADMIN_BOOTSTRAP_TOKEN` 走 login 页的 "Bootstrap token" 标签，
或运行 CLI 建 admin：

```bash
pnpm --filter @xxf/server admin:create \
  --email admin@你的域名 --password 强密码
```

然后 `/admin/v1/invites` 生成邀请码分发给消费者。

---

## URL 地图

### 公开（无需登录）
- `/` 品牌落地页
- `/pricing` 双币价目表（带"/ 1M tokens"单位）
- `/docs` Claude Code / Cline / Cursor 接入指南
- `/login` 登录（含"忘记密码"入口）
- `/register` 邀请码注册（密码强度 + 双协议勾选 + 邮箱验证硬门槛）
- `/forgot-password` 申请重置链接
- `/reset-password?token=...` 重置密码
- `/verify-email?token=...` 邮箱验证回调
- `/terms` `/privacy` 条款 / 隐私
- `/v1/pricing` 公开 JSON 价目
- `/healthz` `/readyz` `/version` `/metrics`

### 消费者 C 端（登录后）
- `/console/dashboard` 6 张卡片 + 5 标签图表 + 联系方式卡
- `/console/keys` 我的 API 密钥（铸造 + 撤销）
- `/console/models` 可用模型（带官方价 vs 本站价）
- `/console/usage` 最近 50 次请求明细
- `/console/wallet` 钱包（余额 + 卡密兑换）
- `/console/settings` 改密码

### 管理台 B 端（admin / contributor）
- `/dashboard` 系统级看板
- `/accounts` 上游订阅账号池
- `/users` 用户管理（状态 / 强制激活 / 禁用 / 解禁 / 解锁）
- `/keys` 所有 API 密钥
- `/invites` 邀请码（含"一键复制邀请文案"）
- `/redeem-codes` 卡密批量铸造
- `/proxies` 出口代理池
- `/stats` 按账号 / 按密钥 / 按用户统计
- `/audit` 审计日志（按 action / actor / 时间筛选）
- `/settings` 系统配置（折扣率、欢迎额度、汇率、池调度）

### 对外 API（需 `sk-xxf-...` Bearer）
- `POST /v1/messages` Anthropic 兼容
- `POST /v1/chat/completions` OpenAI 兼容

---

## 账户生命周期

```
  register  ┌──────────────────────┐  click verify link
 ─────────▶ │ pending_verification │──────────────────────┐
            └──────────────────────┘                      │
                                                          ▼
                   admin force-activate          ┌────────────┐
            ──────────────────────────────────▶ │   active   │
                                                 └─────┬──────┘
                                                       │
                                      admin suspend    │
                                            ▼          │ admin reactivate
                                      ┌──────────┐     │
                                      │ suspended│◀────┘
                                      └──────────┘
```

- 只有 `active` 能登录和调 API；其他两态在登录 / API 鉴权处直接拒。
- 5 次密码错误 → `locked_until = now() + 15 分钟`，用户端 423 响应带 `retryAfterSec`。
- 重置密码 / 管理员"解锁"按钮都会清零失败计数。

---

## 计费模型

- 内置 8 个模型官方价（Claude Opus / Sonnet / Haiku；GPT-4o / o1 / 4o-mini / 4-turbo / 3.5）。
- 所有模型**统一 85 折**（可在 `/settings` 改 `pricing.markupRate`）。
- 实际扣费按**输入/输出 token 分别计费**，精度 10⁻⁶ USD。
- 新注册账号**自动送 $5** 体验额度（`pricing.welcomeCreditMud` 可改）。
- CNY 展示按 `pricing.usdToCnyRate`（默认 7.2）换算。
- 充值入口：管理员批量铸造卡密（`/redeem-codes`），消费者在 `/console/wallet` 自助兑换。

---

## 状态

生产环境已上线（https://claude.xxflk.cn）。主要功能模块 P0–P5 + 用户管理加强（Phase 1+2）
全部完成并部署。还未做的见 [roadmap.md](docs/roadmap.md)。

## 合规声明

把订阅账号聚合后再 API 化给别人用，**通常不符合 Anthropic / OpenAI 对个人订阅的使用
条款**。存在账号被封禁的风险。详见 [docs/security.md](docs/security.md) 的威胁模型部分。
使用者自行承担在所在司法区域内的合规责任。

## 许可

MIT，见 [LICENSE](LICENSE)。
