# 路线图

按阶段递进交付。每个阶段的退出标准是**端到端跑通一件事**，而不是任务列表。

| 阶段 | 主题 | 退出标准 | 状态 |
|---|---|---|---|
| **P0** | 脚手架 | `pnpm dev` 启动，`/healthz` 返回 ok | ✅ 完成 |
| **P1** | MVP 中转 | Claude Code / Cline 挂单账号能打通流式响应 | ✅ 完成 |
| **P2** | 账号池韧性 | 多账号轮转、token 自刷新、封号自动冷却 | ✅ 完成 |
| **P3** | 用户 + API Key + 管理 UI | 非 admin 能自助挂号、拿 key、管理台全部走真数据 | ✅ 完成 |
| **P4** | OpenAI 兼容 + ChatGPT | Cursor 端到端跑通（经 Claude 上游翻译） | ✅ 完成（OpenAI 兼容层）／ ⏸ ChatGPT 真上游未做 |
| **P5** | 计费 + 可观测 + 代理池 | Stripe 或卡密计费、Prometheus 看板、告警 | ⚠️ 部分完成：metrics ✅、proxies ✅、计费内部账本 ✅；Stripe / 告警未接 |
| **扩展** | 消费者 C 端 + 双语 + 邀请码 + 文档页 | 对外可访问、可注册、有价目、有文档 | ✅ 完成 |

## 已完成的 P0

- pnpm monorepo + TS strict 配置
- Fastify server + `/healthz` `/readyz`
- Next.js 15 管理台骨架
- Drizzle schema 占位
- Docker Compose 开发栈（server + web + postgres + redis + caddy）

## 已完成的 P1（MVP 中转）

- `POST /v1/messages` Anthropic 兼容 + SSE 透传
- AES-GCM token 静态加密
- admin/v1/{users,accounts,keys} 由引导令牌保护的 CRUD
- 按 owner/shared 两路的简单调度
- 单元测试骨架（crypto + 翻译 + 分级）

## 已完成的 P2（韧性）

- Redis 5h 滚动窗口配额追踪
- OAuth refresh（Redis mutex + 重试退避）
- 上游错误分级 → 冷却 / needs_reauth / banned / transient
- proactive 后台 worker（refresh 60s + probe 10min）
- API Key 月配额 + `@fastify/rate-limit`
- 上游 circuit breaker（60s 滑窗，错误率触发）

## 已完成的 P3（UI + 鉴权）

- argon2id + JWT cookie 登录；引导令牌保留做应急
- RBAC（admin / contributor / consumer 三级）
- 审计日志
- 8 个管理页全部接后端
- system_settings + 可编辑页
- `admin:create` CLI

## 已完成的 P4（OpenAI 兼容）

- `POST /v1/chat/completions` 翻译到 Claude 上游
- 模型名映射表（gpt-4o → sonnet-4-6 等）
- 流式 chunk 翻译

## P4 剩余（ChatGPT 真上游）

- Codex CLI OAuth 客户端未实装（客户端用 ChatGPT Plus/Pro 订阅的流程尚未公开）
- 目前所有 OpenAI 请求实际走 Claude 上游；短期看这样够用

## 已完成的 P5（部分）

- 出口代理池：schema + admin CRUD + UI + relay 绑定
- Prometheus `/metrics` 端点
- Grafana dashboard 可接（未预配置）

## P5 剩余

- **Stripe 或卡密计费** —— 当前只内部扣余额、不硬 gate
- **告警** —— 账号封禁、池耗尽、错误率尖刺；目前靠人肉查
- **自动备份脚本** —— docs 有命令但没 cron

## 扩展阶段（已完成）

- 双币展示 + 85 折（`pricing.markupRate` 可调）
- 邀请码限制注册 + admin CRUD（铸 / 重置 / 撤销 / 删）
- 注册送 $5 welcome credit
- 公开 `/pricing`、`/docs`（Claude Code 一等公民 + Cline + Cursor）
- C 端控制台 5 页 + 6 张卡片 + 5 标签图表
- 中英双语切换（EN / 中），200+ 字典键

## 下一阶段候选（按价值排序）

1. **Stripe 充值或卡密** —— 有了收益模型后才有真商业化
2. **ChatGPT 真上游**（Codex OAuth，或放弃只走翻译层）
3. **告警通道**（邮件 / Slack / webhook）
4. **按模型报价 UI** —— 让 admin 在 `/settings` 改每个模型的官方价 + 档次
5. **真实的 UI 烟测**（Playwright / Cypress）
6. **多区域部署**（不急，小团队够用）
