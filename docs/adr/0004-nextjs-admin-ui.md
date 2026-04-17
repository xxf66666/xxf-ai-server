# ADR 0004 — 选 Next.js 15 做管理 UI

- **状态**：已采纳
- **日期**：2026-04-17
- **决策人**：xxf

## 背景

网关需要一个 Web 管理 UI：账号生命周期、用户和 API Key、用量看板、设置。备选：
Next.js（App Router）、Vite + React SPA、Refine.dev、Remix。

## 决策

**Next.js 15 App Router**，搭配 **Tailwind CSS** 和 **shadcn/ui** 风格组件。

## 后果

**优点**

- App Router + Server Components 给列表 / 表格页省去大量数据获取胶水。
- `shadcn/ui` 提供生产级组件，团队是 copy-paste 而非依赖一个 UI 库 —— 锁定度极低。
- 社区模板池大（`shadcn-admin`、`next-shadcn-dashboard`）可启动参考。
- 和 server 同 Node.js 工具链 —— 一次 `pnpm install`、每 app 一个 Dockerfile、
  同一条 CI。

**缺点**

- Next.js 镜像比纯静态 Vite SPA 重；容器大 ~100 MB。用 `output: 'standalone'`
  + 放同一个 Docker Compose 栈里 Caddy 后，能接受。
- App Router 的 server-components 模型要求严格的 server/client 边界约束；我们刻意
  不把 API Key 密文放 server component，避免漏到 RSC payload。

## 备选方案

- **Vite + React SPA**：更轻更简，但失去 App Router 的数据获取符号学，团队得自己实现
  Next 免费给的 layout / auth boundary。
- **Refine.dev**：CRUD 快手，但它是"框架-上-框架"。我们这管理面够小，Next + shadcn
  手卷更干净。
- **Remix**：对比 Next 旗鼓相当，但管理台模板池小，团队更熟 Next。

## 后续扩展

之后多了**消费者 C 端**（`/console/*`），也用同一个 Next app 宿主 —— 两个路由组
共享 i18n、React Query、provider、组件 —— 没有因为 B 端 + C 端分开而引入框架双栈，
验证了 Next.js 的选择合理。

## 非目标

目前不做面向终端用户的聊天 UI —— 任何端到端 Chat UI 都不在当前范围，见
[architecture.md §7](../architecture.md#7-非目标)。
