# ADR 0002 — Node.js + Fastify + Drizzle + Postgres + Redis

- **状态**：已采纳
- **日期**：2026-04-17
- **决策人**：xxf

## 背景

API 网关的语言 / 框架选型。短名单：Node.js（Fastify / Hono）、Go（chi / echo）、
Python（FastAPI）。

## 决策

- **Node.js 20 LTS + TypeScript（strict）**
- **Fastify** 做 HTTP 框架
- **Drizzle** 做 ORM，**Postgres 16** 做主存
- **Redis 7** 做缓存 / 限流 / 协调态
- **pino** 做日志

## 后果

### 为什么 Node.js / TypeScript

- 这一领域最大的两个开源参考 —— `claude-relay-service` 和 `new-api` / `one-api`
  分别活在 JS 和 Go 生态。JS 在模式可移植性（第一个参考很多代码可抄）和社区熟悉度
  上都胜一筹。
- 一流的 SSE / streams 支持；relay 最热的路径是流转发。
- `apps/server` 和 `apps/web` 共享 TypeScript 类型消除一整类契约 bug。

### 为什么 Fastify（不是 Hono / Express）

- Express 基本停更，性能也差。Hono 很棒但偏 edge runtime，而我们刻意瞄准有状态的
  VM（见 ADR 0001 的假设）。
- Fastify 有成熟的插件生态（auth、rate-limit、CORS、multipart）和一流的 SSE 支持，
  不需要框架级 hack。

### 为什么 Drizzle（不是 Prisma）

- 无 codegen 步骤卡 CI。
- SQL-first —— 要做 query planner 提示时能轻松下到裸 SQL。
- 运行时更小；纯 TS 即可。

### 为什么 Postgres

- 调度器"选当前用量最少的健康账号"需要行级锁。
- `jsonb` 用于灵活的 settings blob。
- 备份 / HA 路径成熟。

### 为什么 Redis

- 5 小时滚动窗口计数用 `INCRBY` + key TTL 自然实现。
- Token 刷新要分布式锁防惊群。
- API Key 限流桶。

## 备选方案

- **Go (chi + sqlc)**：性能诱人但被拒，因为这一 OAuth-relay 领域 Go 参考更弱，且为
  了 TS 生态优势愿意付些 CPU。
- **Python (FastAPI + SQLAlchemy)**：被拒；SSE 故事更粗糙，async 分叉脚下的坑比 Node
  的 streams 多。
