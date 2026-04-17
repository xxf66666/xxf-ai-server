# 贡献指南

感谢愿意参与！本文档记录项目遵循的工程规范。先看 [README](README.md) 和
[架构文档](docs/architecture.md) 了解背景。

## 开发环境

1. 装 **Node.js 20+** 和 **pnpm 9+**
2. `cp .env.example .env`，按需改
3. `docker compose up -d postgres redis`
4. `pnpm install && pnpm --filter @xxf/shared build && pnpm dev`

## 分支策略

- `main` —— 任意时刻可部署，受保护；只允 PR 合入
- `dev` —— 进行中 feature 的集成分支
- `feature/<slug>`、`fix/<slug>`、`chore/<slug>` —— 短命主题分支

## Commit 规范 —— Conventional Commits

采用 [Conventional Commits](https://www.conventionalcommits.org/zh-hans/) 格式：

```
<type>(<scope>): <简短祈使句>

<正文 —— 说 WHY，不是 what>

<脚注 —— breaking change、引用>
```

常用 type：`feat`、`fix`、`docs`、`refactor`、`test`、`chore`、`perf`、`build`、`ci`。

示例：

- `feat(accounts): add 5h rolling-window quota tracker`
- `fix(relay): prevent SSE chunk splitting across buffers`
- `docs(adr): record decision to use Drizzle over Prisma`

## Pull Request

- 聚焦：一个 feature / fix / refactor 一个 PR
- 包含简短描述：问题、方案、取舍
- 行为改动同步更新 docs 和 CHANGELOG
- 本地跑绿 `pnpm lint`、`pnpm typecheck`、`pnpm test` 再请 review

## 代码风格

- 所有 TS 开 strict
- 偏小而组合的模块，不堆大 service 类
- **默认不写注释**。只有 *why* 非显然时才加一条 —— 避免叙述 *what*
- 集成测试**不 mock DB**，用 Docker 起真 Postgres

## 架构决策记录（ADR）

涉及难以撤销的决策（栈选型、协议选型、数据模型）要加 ADR 到 `docs/adr/`。
拷贝 `docs/adr/0001-oauth-over-web-scraping.md` 做模板。顺序编号，**不删除** —— 过期的
标 superseded。

## 安全

永远不提交 `.env`、OAuth token、生产密钥。发现安全问题请走**私下上报**而非公开 issue。
