# 安全与风险模型

本文档**如实**说明把订阅账号聚合后以 API 形式再暴露，并非这些订阅的原本意图。我们
记录风险边界，方便运营方自行做知情决策。

## 1. 法律 / ToS 风险

- Claude Pro / Max 条款限定使用者为本人。把多个订阅 token 聚合成 API 池供他人使用，
  可能违反 [Anthropic 使用策略](https://www.anthropic.com/legal/aup) 和商业条款。
- OpenAI ChatGPT 订阅条款同样严格。
- 潜在代价：账号封禁、索赔（相当于观测到的 API 使用费）、极端情况下民事诉讼。

**缓解**：

- 运营群体保持**小而可信**；优先自用，其次代销。
- 若代销，避免在营销中强调"等价于官方 API"或"大幅低于官方价"这类易引起关注的话术。
- 任何账号被要求撤下时**保证快速解绑 + 删除数据**的能力（`/admin/v1/accounts/:id`
  DELETE 立即生效）。

## 2. 封号检测风险（云 IP + 多账号）

| 风险 | 严重度 | 缓解 |
|---|---|---|
| 云厂商 IP 可识别 | 低 | 低账号数时可接受 |
| 多账号从同一 IP 出站 | **高** | per-account 绑定独立住宅代理 |
| 账号 IP 地理漂移 | 中 | 每账号锁定稳定出口 IP |
| 单账号并发 burst | 中 | 池子目标 80% 窗口利用率，平滑流量 |

推荐代理源：IPRoyal、Bright Data，或自建住宅 / 移动代理池。**绝不**一天内把单个账号
在多个代理之间切换。

## 3. Token 静态加密

- 算法：**AES-256-GCM**，每次加密 96-bit 随机 nonce，auth tag 内联存储。
- 密钥：`ENCRYPTION_KEY`（32 字节十六进制）从进程环境读取。**永远不入库、不入仓**。
- 存储格式：`nonce.ciphertext.tag`（三段 base64，`.` 分隔）。

### 密钥轮换流程

1. 生成 `ENCRYPTION_KEY_NEXT` 和旧 key 同时部署。
2. 运行 re-encrypt CLI（TODO：目前未实装，手动 SQL 重加密）：
   把所有 accounts 的 oauth_access_token / oauth_refresh_token 用旧 key 解密、用新
   key 再加密、写回。
3. 全部迁完后，把 `KEY_NEXT` 升级为 `ENCRYPTION_KEY`，下次部署删掉旧变量。

## 4. 下游鉴权

- API Key 是 **24 字节随机值**，前缀 `sk-xxf-`，仅 SHA-256 哈希入库。明文**只在
  铸造时返回一次**。
- 管理台密码 argon2id 哈希（19 MiB memory cost，2 rounds，OWASP 最低推荐）。
- 会话用 `@fastify/jwt` + cookie：
  - `httpOnly: true; secure: production; sameSite: 'lax'; maxAge: 7d`
  - 签名密钥 `JWT_SECRET` 至少 32 字符
- 无长期 session；7 天不活动后强制重登。
- 引导令牌 `ADMIN_BOOTSTRAP_TOKEN`：仅用于首次部署 / 恢复，生产环境应该在建 admin 后
  **从 `.env` 删除**。

## 5. 传输层

- 仅 TLS 1.3（Caddy 默认）。
- HSTS: `max-age=31536000; includeSubDomains`（可在生产稳定后开 preload）。
- Caddy 自动签 Let's Encrypt 证书。

## 6. 数据保留

| 数据 | 保留期 | 原因 |
|---|---|---|
| OAuth token | 账号生命周期 | 业务必需 |
| 用量日志（usage_log） | 90 天 | 计费窗口 + 审计 |
| 请求 / 响应体 | **不保留** | 减少数据泄露影响面 |
| 审计日志（audit_log） | 365 天 | 合规留痕 |
| 邀请码 | 管理员删除前持久化 | 审计 |

## 7. 威胁模型 —— 我们防的

- **外部攻击者试扫 API**：按 key 指纹限流（`@fastify/rate-limit` + Redis）；连续 401
  按 IP 额外限流（未实装，计划中）。
- **Key 泄露**：消费者可在 `/console/keys` 自行撤销 + 重铸；月配额上限控制爆炸半径。
- **数据库泄露**：OAuth token 都是密文；没有 `ENCRYPTION_KEY` 就解不开。
- **邀请码泄露**：管理员可在 `/invites` 点 "Reset" 一键更新码值。
- **管理员账号被盗**：审计日志 + JWT 会话可按 user 全部失效（改密码后旧 token 仍有效
  直到过期，这是当前设计妥协）。

## 8. 威胁模型 —— 我们不防的

- **主机被拿**（VM root）：攻击者拿到 `.env` + 数据库，游戏结束。缓解：SSH key-only
  登录、fail2ban、磁盘加密、云厂商最小角色权限 —— 标准 hygiene。
- **npm 供应链**：`pnpm-lock.yaml` 固定版本有帮助，但没做深度审计。Node 依赖是已知的
  供应链面。

## 9. 合规建议

如果把本站作为**商业产品**运营（即使只是给小圈子代销）：

- 在 `/` 和 `/pricing` 页加**显式免责声明**：服务基于第三方 API 订阅聚合，存在供应商
  策略变更导致服务中断的风险；用户数据处理方式；如何联系运营方取消账号等
- 考虑**实名登记运营主体**（公司 / 个体工商）并注册域名 ICP 备案（中国大陆部署）
- 使用条款（ToS）中明确**不含内容保证**、不承担下游用户滥用的连带责任

这些不是代码能解决的 —— 是公司运营的事。
