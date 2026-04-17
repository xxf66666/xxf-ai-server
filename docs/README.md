# 文档中心

`xxf-ai-server` 文档集的索引。

## 所有人读

- [architecture.md](architecture.md) — 系统架构、组件、数据流、数据模型
- [roadmap.md](roadmap.md) — 分阶段路线图 P0–P5 + 扩展
- [quickstart.md](quickstart.md) — 10 分钟快速上手（运维方 + 消费者双路径）

## 开发者读

- [api.md](api.md) — 完整 API 端点参考（Anthropic、OpenAI、公开、控制台、管理台）
- [../CONTRIBUTING.md](../CONTRIBUTING.md) — 分支策略、commit 规范、代码风格

## 运维读

- [deployment.md](deployment.md) — 单机 VPS 部署（Docker Compose + Caddy）
- [operations.md](operations.md) — 日常运维：邀请码分发、账号冷却、代理轮换、应急处置
- [security.md](security.md) — 威胁模型、加密 / RBAC / 审计、ToS 风险

## 架构决策记录（ADR）

决策成本高难撤销，每个决策留一份追溯：

- [0001 — OAuth 而非网页逆向](adr/0001-oauth-over-web-scraping.md)
- [0002 — Node.js + Fastify + Drizzle 技术栈](adr/0002-nodejs-fastify-stack.md)
- [0003 — 多人共享账号池](adr/0003-multi-user-pool.md)
- [0004 — Next.js 15 作为管理 UI 框架](adr/0004-nextjs-admin-ui.md)
- [0005 — 计费模型：统一折扣 + micro-USD + 欢迎额度](adr/0005-pricing-model.md)
- [0006 — 邀请码限制注册](adr/0006-invite-gated-registration.md)
- [0007 — i18n 扁平化字典方案](adr/0007-i18n-approach.md)

新决策应追加下一个编号的 ADR；已过期的 ADR 标注 **superseded** 并链接到新的，
**不删除**。
