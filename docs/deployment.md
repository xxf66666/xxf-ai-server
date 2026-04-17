# 部署

目标平台：**单台 VPS + Docker Compose**。推荐 GCP asia-east1（台湾，低延迟且是 Claude
官方支持地区），或任何 ≥ 2 vCPU / 4 GB RAM / 20 GB 磁盘的云主机。

当前线上实例：https://claude.xxflk.cn（GCP `34.80.10.199`）。

## 1. 前置

- Debian 12 / Ubuntu 24.04 LTS
- Docker 26+ 和 Docker Compose v2（或 Buildx 包）
- 域名，A/AAAA 记录指向 VM 外网 IP
- **放通 80 / 443** 入站（GCP 控制台勾选"Allow HTTP / HTTPS"或用 gcloud 加防火墙规则）

## 2. 首次部署

```bash
# 装 Docker（官方一键脚本）
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
# 重新登录以让组生效

# 拉代码
git clone https://github.com/xxf66666/xxf-ai-server.git
cd xxf-ai-server

# 生成 .env
cp .env.example .env
ENC=$(openssl rand -hex 32)
JWT=$(openssl rand -hex 48)
BOOT=$(openssl rand -hex 24)
sed -i "s|^ENCRYPTION_KEY=.*|ENCRYPTION_KEY=$ENC|" .env
sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$JWT|" .env
sed -i "s|^ADMIN_BOOTSTRAP_TOKEN=.*|ADMIN_BOOTSTRAP_TOKEN=$BOOT|" .env
sed -i "s|^NODE_ENV=.*|NODE_ENV=production|" .env
sed -i "s|^PUBLIC_API_URL=.*|PUBLIC_API_URL=https://claude.你的域名|" .env
sed -i "s|^PUBLIC_WEB_URL=.*|PUBLIC_WEB_URL=https://claude.你的域名|" .env

# Caddyfile 改域名
sed -i "s|ai.example.com|claude.你的域名|g" Caddyfile

# 启动
docker compose up -d

# 查日志
docker compose logs -f server
```

首次启动时 Caddy 会用 HTTP-01 challenge 自动签 Let's Encrypt 证书（**必须 80 端口能连到**）。

## 3. 建首个 admin 账号

```bash
docker compose exec server node dist/cli/create-admin.js \
  --email you@你的域名 --password '强密码'
```

用这个账号从浏览器登录管理台，进 `/invites` 铸邀请码发给消费者。

## 4. Compose 服务概览

| 服务 | 作用 | 内网端口 |
|---|---|---|
| `caddy` | TLS + 反代 | 80 / 443 |
| `server` | Fastify API 网关 | 8787 |
| `web` | Next.js 前端（管理台 + 消费者控制台） | 3000 |
| `postgres` | 数据存储 | 5432（仅内网） |
| `redis` | 缓存 / 限流 / 配额窗口 / 互斥锁 | 6379（仅内网） |

Caddy 路由：

- `https://<domain>/v1/*` → `server:8787`
- `https://<domain>/admin/*` → `server:8787`
- `https://<domain>/healthz /readyz /version /metrics` → `server:8787`
- 其余 → `web:3000`

## 5. 必需的环境变量

| 变量 | 说明 |
|---|---|
| `NODE_ENV` | `production`（生产） / `development`（本地） |
| `DATABASE_URL` | Postgres 连接串；compose 里通过 service name 连 |
| `REDIS_URL` | Redis 连接串 |
| `ENCRYPTION_KEY` | **32 字节十六进制**（64 字符），AES-GCM 静态加密 token |
| `JWT_SECRET` | **至少 32 字符**随机串 |
| `ADMIN_BOOTSTRAP_TOKEN` | **至少 16 字符**，引导令牌，首次部署 / 应急用 |
| `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_SECONDS` | 默认 60 req / 60 s |
| `HTTPS_PROXY` / `NO_PROXY` | 本地开发绕火墙；生产通常为空 |

## 6. 升级

```bash
git pull
docker compose pull    # 如果有上游镜像改动
docker compose up -d --build
```

Drizzle 迁移在 server 启动时**自动执行**（见 `src/db/migrate.ts`）。如果失败，容器
会 FATAL 退出，看日志定位。

## 7. 备份

每天用 `pg_dump` 导一次，推到对象存储（R2 / S3）：

```bash
docker compose exec -T postgres \
  pg_dump -U xxfai xxfai | gzip > backup-$(date +%F).sql.gz
```

**把备份加密存**：虽然 OAuth token 在数据库里是 AES-GCM 密文，但 `ENCRYPTION_KEY`
一旦泄露，密文就解得开。

Redis 存的是短生命周期状态（窗口计数、限流桶），**不需要备份**。

## 8. 监控接入

### Prometheus

server 的 `/metrics` 是明文 Prometheus exposition：

```yaml
scrape_configs:
  - job_name: 'xxf-ai-server'
    metrics_path: '/metrics'
    static_configs:
      - targets: ['claude.你的域名']
    scheme: https
```

**强烈建议**：在 Caddy 里给 `/metrics` 加 IP 白名单（只让监控机 IP 访问）。

### Grafana 推荐面板

- `rate(xxf_relay_requests_total[5m])` 按 outcome 分栏，观察错误率
- `histogram_quantile(0.95, rate(xxf_relay_latency_ms_bucket[5m]))` 观察 p95 延迟
- `rate(xxf_relay_tokens_total[1h])` 观察流量

## 9. 垂直扩容建议

目前为单节点：

- 2 vCPU / 4 GB 够跑 ~百个并发流
- 数据库 / Redis 压力大时可迁到托管服务（无代码改动，只改 `DATABASE_URL` / `REDIS_URL`）
- 一旦要水平扩（多个 server 实例），需要给 rate-limit 和 circuit breaker 共享 Redis
  命名空间（目前已共享，天然支持）

## 10. 防火墙策略

推荐外部只开：

- `80` 用于 Let's Encrypt HTTP-01（Caddy 自动）
- `443` 对外 HTTPS
- `22` SSH（最好改默认端口或走 Cloudflare Tunnel）

**不要**暴露 `8787` `3000` `5432` `6379` 任何一个到公网。
