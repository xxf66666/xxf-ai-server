# ADR 0005 — 计费模型：统一折扣、micro-USD 精度、欢迎额度

- **状态**：已采纳
- **日期**：2026-04-18
- **决策人**：xxf

## 背景

网关转售订阅账号，需要一个让用户能直观比价、运营方也能明确控成本的计费模型。四个
关键选择：

1. **折扣策略**：统一折扣 / 分级折扣 / 加价模式
2. **计量单位**：token / 请求次数 / 两者都支持
3. **货币**：USD / CNY / 双币展示
4. **预充值**：真充值（Stripe）/ 免费体验 / 预付卡密

## 决策

- **统一 85 折**（折扣率存 `system_settings.pricing.markupRate`，默认 0.85）。
  不分模型档次，运营可以用一个数字调整全局定价。
- **按 token 计费**（不按请求次数）。每次请求算 `input × 输入价 + output × 输出价`，
  再乘 markup。
- **精度：micro-USD**（10⁻⁶ USD）。`bigint` 存储避免浮点漂移。`$5` = `5_000_000 mud`。
- **双币展示**。价目页同时渲染 USD 和 CNY（按 `pricing.usdToCnyRate` 换算，默认 7.2）。
  **内部结算只用 USD**，CNY 仅为展示。
- **免费 $5 欢迎额度**（`pricing.welcomeCreditMud`）。
- **不做真实充值**。余额可以为负，仅用于展示 + 运营侧观察。当接入 Stripe 时再开启
  硬 gate。

## 后果

**优点**

- `markupRate` 一个数字调全站，不用改 9 个模型行。
- micro-USD `bigint` 让 `$0.15 / 1M token` 这种小粒度价格在单次请求级别也能精确累加。
- 双币让中文用户直接看懂，不用心算汇率。
- 欢迎额度 = 新用户无成本试用 + 验证自己的接入；5 美元约够发 10-20 条 Claude Sonnet
  请求。
- 不硬 gate 让早期用户体验顺滑；后期接 Stripe 只要加一行 `if (balance <= 0) reject`。

**缺点**

- 统一折扣剥夺了"推你用便宜模型"的杠杆（Haiku 和 Opus 折扣率相同）。
- micro-USD 需要 SQL `bigint` + UI 转换代码；比直接 `numeric(10,6)` 多一层心智。
- CNY 固定汇率意味着汇率大幅波动时运营要手动改 setting。

## 实现

相关文件：
- `apps/server/src/core/pricing/index.ts`（`computeCost()` 含 Redis 缓存）
- `apps/server/src/core/users/ledger.ts`（`debitForRequest()` 原子更新）
- `apps/server/src/db/schema.ts`（`users.balance_mud`、`users.spent_mud`、
  `usage_log.cost_mud`、`model_pricing`）
- 迁移 `drizzle/0002_pricing_invites_balance.sql` 种子 8 条模型价
- `apps/server/src/api/public/pricing.ts`（公开 `/v1/pricing` 双币输出）

## 备选方案

- **分级折扣**（Haiku 9 折、Sonnet 7 折、Opus 6 折）：被拒。小团队没必要这么精细，
  且价目页展示复杂化。
- **按请求次数计费**：被拒。Claude Code 的请求动辄 10k+ token，按次数定价会让大请求
  显得太便宜。
- **单币 CNY**：被拒。Claude Code / Cursor 等客户端的付款文化是美元，单币 CNY
  让客户感知价格偏贵。
