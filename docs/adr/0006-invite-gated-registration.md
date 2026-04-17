# ADR 0006 — 注册由邀请码管控

- **状态**：已采纳
- **日期**：2026-04-18
- **决策人**：xxf

## 背景

做成**自助注册**能让朋友 / 同事很快上手，但副作用是：

- 站点被爬虫 / 黑产批量注册薅 welcome credit
- 没有管控的用户名单导致 abuse 风险扩散（一旦某账号被黑产调用触发了上游封禁，
  整个池子连坐）
- 对外运营时，"有邀请码才能注册"制造稀缺感

我们需要一个**轻量**的准入控制机制，不想引入邮箱验证、验证码等复杂链路。

## 决策

- 注册时**必须**提交邀请码（`inviteCode` 字段）。
- 邀请码由 admin 在管理台 `/invites` 页**铸造**。表 `invite_codes`：code + note +
  maxUses + useCount + revoked + expiresAt + createdBy。
- 一个邀请码可以指定**多次使用**（`maxUses`，默认 1），譬如给一个小团队共用。
- admin 可以：
  - **铸造**：新建一条（code 随机生成 `XXFAI-XXXXXXXX`）
  - **重置**：重新生成 code 字符串 + 重置 useCount + 清 revoked。
    场景：码被泄露了 / 要给这个名额换个人用。
  - **撤销**：标记 `revoked=true`，保留记录（审计留痕）。
  - **删除**：彻底删行（不推荐，留审计）。
- `consumeInvite` 用**原子 UPDATE**（WHERE 带防抢护栏）防止并发抢注。

## 后果

**优点**

- 简单：一个字段、一个表、一个 UPDATE 原子操作，没有外部依赖。
- 可追溯：每个注册用户都能回溯到邀请码 → 谁铸的 → 什么备注。
- 灵活：一人一码（maxUses=1，防传播）或团队码（maxUses=20，社区使用）都支持。
- 运营友好：被泄露了一键 reset，不用拉新表。

**缺点**

- 管理员手动分发成本。没法做到"朋友介绍链接"。未来想自动化可加"推荐人"字段。
- 没做邮箱验证，邀请码 + 邮箱组合就够。未来接入重型 anti-abuse 要额外做。

## 实现

相关文件：
- `apps/server/src/core/invites/index.ts`：`generateCode()`、`consumeInvite()`、
  `createInvite()`、`resetInvite()`、`revokeInvite()`、`deleteInvite()`
- `apps/server/src/api/admin/invites.ts`：REST CRUD
- `apps/server/src/api/admin/auth.ts::register`：把 `consumeInvite` 接进来
- `apps/web/app/(admin)/invites/page.tsx`：管理 UI
- `apps/web/app/register/page.tsx`：前端表单

## 备选方案

- **邮箱 OTP 验证**：重；需要 SMTP / 邮件服务；本站目标用户是已知小团队，OTP 是
  过度工程。
- **Cloudflare Turnstile / reCAPTCHA**：防爬虫有效，但不能选择性**拉新**（每个能过
  验证码的人都能注册）。
- **开放注册 + IP 速率限制**：快被薅干，且小成本就能换 IP。

## 相关 ADR

- ADR 0005（welcome credit $5）：welcome 额度的存在让不做邀请码会被薅空。
- ADR 0002（Node.js + Fastify）：实现复杂度契合当前技术栈。
