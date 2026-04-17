# 运维手册

生产环境的日常操作手册。

## 1. 账号池管理

### 挂一个新账号

1. 账号贡献者在**自己的机器**上跑 `claude setup-token`（Claude Code 自带命令），拿到
   OAuth access token（`sk-ant-oat01-...`）。
2. 他把 token 粘贴到管理台 `/accounts → Attach account` 表单，连同 plan（pro /
   max5x / max20x）以及是否共享（shared）。
3. 服务器用 AES-GCM 加密 token 入库。
4. **立即触发一次 probe**（`POST /admin/v1/accounts/:id/probe`）：发一个 1-token 测试
   请求验证 token 有效。失败的话 UI 会标红。

### 手动冷却账号

调度器在 429 时自动置 `status='rate_limited'` + `cooling_until`。如果要强制冷却：

```sql
UPDATE accounts
   SET status = 'cooling',
       cooling_until = NOW() + INTERVAL '2 hours'
 WHERE id = '<uuid>';
```

### 判断账号被封

上游持续返 `permission_denied` 或 refresh 时 `invalid_grant` → 健康 worker 把它置
`status='banned'`。**封禁不会自动恢复** —— 运营确认后手动解绑。

## 2. 邀请码流程

### 发码

1. admin 登录管理台 → `/invites` 页
2. 点 "铸造邀请码"，可填 `备注`（"给 Alice"）和 `最多使用次数`（默认 1；团队码可设 20）
3. 码生成后点击可复制（格式 `XXFAI-XXXXXXXX`）
4. 发给受邀人；他们去 https://claude.xxflk.cn/register 填入

### 码泄露了怎么办

在 `/invites` 列表点 **"重置"**：
- 旧码字符串立刻失效（用不了了）
- 重新生成一个新码
- 已注册用它的人不受影响（`invite_codes` 和 `users` 之间没 FK）

### 停用一个码但保留审计记录

点 **"撤销"**。`revoked=true`，但记录保留。想清理就点 **"删除"**。

### 管理员的邀请码

admin 账号**本身**不通过邀请码注册（用 `admin:create` CLI 建），所以不占邀请码。

## 3. 价格 / 折扣管理

### 改全站折扣

管理台 `/settings` → **Pool utilization target** 旁的 `pricing.markupRate`（当前 UI
里只暴露了 utilization / minRemaining / models.allow 三项；要改 markup 得走 SQL 或
用 PATCH `/admin/v1/settings`）：

```bash
curl https://claude.xxflk.cn/admin/v1/settings \
  -X PATCH \
  -H "cookie: xxf_admin_session=..." \
  -H 'content-type: application/json' \
  -d '{"pricing.markupRate": 0.75}'
```

值越小折扣越狠（0.75 = 25% off）。

### 改某个模型的官方价（当有模型涨价时）

目前需要直接改 `model_pricing` 表：

```sql
UPDATE model_pricing
   SET input_mud_per_m = 20000000,
       output_mud_per_m = 100000000
 WHERE model_id = 'claude-opus-4-7';
```

然后等 5 分钟（Redis 缓存 TTL），或手动清缓存：

```bash
docker compose exec redis redis-cli DEL 'pricing:model:claude-opus-4-7'
```

未来会加 UI（见 roadmap 的"下一阶段候选 #4"）。

### 改 CNY 汇率

```bash
curl -X PATCH https://claude.xxflk.cn/admin/v1/settings ... \
  -d '{"pricing.usdToCnyRate": 7.25}'
```

## 4. 出口代理（abuse 风险管控）

**什么时候要用**：账号数超过 3 个。云厂商 IP + 多账号聚合是最高风控信号，需要 per-account
绑定住宅代理分散出口。

1. `/proxies` 页添加代理（IPRoyal / Bright Data / 自建）
2. `/accounts` 编辑某个账号，把它绑到对应代理
3. 本站 relay / probe / refresh 从此走这把代理
4. **绑定要黏**：不要每天换一个代理给同一个账号，那等于主动触发风控

## 5. 容量规划

单账号 5 小时窗口估算（我们在调度器里用 80% 安全线）：

| 套餐 | 可用 token / 窗口 | 安全投放量 |
|---|---|---|
| Pro | ~100k | < 80k |
| Max 5× | ~500k | < 400k |
| Max 20× | ~2M | < 1.6M |

要调这个安全线，改 `settings.pool.utilizationTarget`（默认 0.8）。

## 6. 处置上游异常

- **5xx 陡增**：Circuit breaker 60s 错误率 > 20% 自动断路 30s，相应 provider 短路
  返 503。
- **Cloudflare 挑战**：OAuth 路径通常不走 CF，如果出现说明该账号被特意打标。立刻
  冷却 + 排查 + 大概率要解绑。
- **token refresh 失败**：worker 指数退避重试 5 次；仍失败就置 `needs_reauth` 通知
  owner 重新授权。

## 7. 备份和恢复

参考 [deployment.md §7](deployment.md#7-备份)。恢复：

```bash
gunzip -c backup-YYYY-MM-DD.sql.gz | \
  docker compose exec -T postgres psql -U xxfai -d xxfai
```

**永远先恢复到新库**验证，再切流量。**不要**在线库上直接覆盖。

## 8. 常见事件检查清单

### 某用户说"用不了"

1. `/admin/v1/audit` 查最近动作
2. 让他发来 key 的前 10 个字符，在 UI `/keys` 搜到他这把 key 看 `status`、`usedMonthlyTokens` 是否超额
3. 查 `users.balance_mud` 有没有 < 0（目前不硬 gate，但看得到异常消费）

### 池子全部冷却（503 overloaded）

```sql
SELECT label, status, cooling_until, window_tokens_used
  FROM accounts
 WHERE provider = 'claude'
 ORDER BY window_tokens_used;
```

- 能解冻的手动置 active
- 窗口到顶的等自动恢复（窗口键会按 5h TTL 过期）
- Probe 一下看是不是临时 429 已过冷却但状态没回来

### 怀疑有滥用

1. `/admin/v1/audit` 搜最近的 `key.mint` / `user.register`
2. `/admin/v1/stats/by-key` 查各 key 24h 用量，异常值调查
3. 撤销相关 key：`DELETE /admin/v1/keys/:id`
4. 必要时把用户置 `role=consumer` 以外（就让他没有任何面板入口）

## 9. 事件记录

所有重大事件都写一条 Markdown 笔记到 `docs/incidents/YYYY-MM-DD-<slug>.md`
（目录不自动建，首次需要 `mkdir -p docs/incidents`）。内容：

- 发生时间、发现方式
- 影响面
- 根因
- 处置措施
- 后续改进
