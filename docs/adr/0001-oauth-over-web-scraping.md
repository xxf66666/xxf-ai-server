# ADR 0001 — 选 OAuth 而非 claude.ai / chatgpt.com 网页逆向

- **状态**：已采纳
- **日期**：2026-04-17
- **决策人**：xxf

## 背景

要把 Claude Pro / Max 和 ChatGPT Plus / Pro 订阅聚合成统一 API，需要一条"代表订阅者"
与上游说话的传输通道。两条路径：

1. **网页逆向**：跑 headless 浏览器控制 `claude.ai` / `chatgpt.com`，维护 cookie，
   过 Cloudflare 挑战，解析 HTML / WS 帧。
2. **经第一方 CLI 的 OAuth**：Claude Code 和 Codex CLI 在做 API 调用时走的 OAuth
   流程。拿到的 access token 能对打上游返回结构化 JSON / SSE 的 API 端点。

## 决策

**走 OAuth**。不做任何爬虫。

## 后果

**优点**

- 响应已是结构化（和公开 API 同 shape）。没有 HTML 解析脆弱性。
- SSE 流式是原生的 —— 不用跟 WS 帧 / HTML chunk 格斗。
- Token 生命周期显式且可 refresh —— 没有 cookie 池、没有 CF clearance 循环。
- 检测面积更小；上游看到的像是它自己的第一方客户端。

**缺点**

- 绑死在 CLI 用的 OAuth 应用注册。如果上游撤销 / 旋转 `client_id`，我们要跟进。
- 模型 / feature 支持可能略滞后于网页端。
- 聚合仍然在 ToS 之外（见 [security.md](../security.md)）。OAuth **不是**合规修复；
  它是稳定性修复。

## 备选方案

- **网页逆向**：主要因运维成本被拒 —— 每次上游 UI 改版都是一次故障。其次并发
  headless Chromium 资源开销大。
- **官方 API Key + 订阅者报销**：用户明确放弃的路径 —— 做这个网关的主要意义就是绕开
  API 按量定价经济。
