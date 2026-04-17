# 快速上手

两条路径：**运维方**（要自己部一套）和**消费者**（要调现成的服务）。

---

## 路径 A — 运维方（10 分钟部一套）

### 前置

- 一台 Debian 12 / Ubuntu 24.04 LTS 云主机（≥ 2 vCPU / 4 GB RAM）
- 一个指向该主机的域名
- Docker 26+ 和 Docker Compose v2
- 防火墙放通 80 / 443

### 第 1 步：装 Docker

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
exit   # 再登一次让组生效
```

### 第 2 步：拉代码 + 配 .env

```bash
git clone https://github.com/xxf66666/xxf-ai-server.git
cd xxf-ai-server
cp .env.example .env

# 生成 3 个密钥
ENC=$(openssl rand -hex 32)
JWT=$(openssl rand -hex 48)
BOOT=$(openssl rand -hex 24)
sed -i "s|^ENCRYPTION_KEY=.*|ENCRYPTION_KEY=$ENC|" .env
sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$JWT|" .env
sed -i "s|^ADMIN_BOOTSTRAP_TOKEN=.*|ADMIN_BOOTSTRAP_TOKEN=$BOOT|" .env
sed -i "s|^NODE_ENV=.*|NODE_ENV=production|" .env

# 改 Caddyfile 里的域名（把示例 claude.xxflk.cn 改成你的）
sed -i "s|claude.xxflk.cn|你的域名.com|g" Caddyfile
```

### 第 3 步：启动

```bash
sudo docker compose up -d
# 等 2-3 分钟首次构建
sudo docker compose logs -f server
# 看到 "xxf-ai-server listening" 就好
```

Caddy 首次启动会自动签 Let's Encrypt 证书（需要 80 端口能连）。

### 第 4 步：建 admin

```bash
sudo docker compose exec server node dist/cli/create-admin.js \
  --email admin@你的域名 --password '强密码'
```

### 第 5 步：登录 + 挂上游账号

1. 浏览器打开 `https://你的域名`，点 **Sign in**
2. 用刚才建的 email / password 登录
3. 进 `/accounts` → **Attach account**
4. 贡献者在自己机器上跑 `claude setup-token`，拿到 `sk-ant-oat01-...` token
5. 粘贴到表单，填 plan（max20x 等），保存
6. 点这个账号的 **Probe** 按钮验证可用

### 第 6 步：发邀请码给消费者

1. 进 `/invites` 页
2. 点 **Mint invite**，复制生成的 `XXFAI-XXXXXXXX`
3. 发给朋友 / 同事，让他们去 `/register`

**完成**。你的中转服务已经上线。

---

## 路径 B — 消费者（5 分钟开始用）

### 第 1 步：注册

1. 问运营方要一个邀请码
2. 打开 `https://claude.你的域名/register`
3. 填邮箱、密码、邀请码

### 第 2 步：铸 API Key

注册后自动跳到 `/console/dashboard`。点侧栏 **API Keys**：

1. 输个名字（e.g. `claude-code-work`）
2. 点 **Mint key**
3. **立刻复制** 弹出的 `sk-xxf-xxxxxxxx`（只显示一次）

### 第 3 步：接入工具

#### Claude Code

```bash
export ANTHROPIC_BASE_URL=https://claude.你的域名
export ANTHROPIC_AUTH_TOKEN=sk-xxf-xxxxxxxx
```

或者 `~/.claude/settings.json`：

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://claude.你的域名",
    "ANTHROPIC_AUTH_TOKEN": "sk-xxf-xxxxxxxx"
  }
}
```

跑一下：

```bash
claude code
```

#### Cline（VSCode）

打开 Cline 设置 → API Provider 选 **Anthropic**：

```
Base URL:  https://claude.你的域名
API Key:   sk-xxf-xxxxxxxx
Model:     claude-sonnet-4-6
```

#### Cursor

Settings → Models → Override OpenAI Base URL：

```
OpenAI Base URL:  https://claude.你的域名/v1
OpenAI API Key:   sk-xxf-xxxxxxxx
Model:            gpt-4o   # 服务端自动映射到 claude-sonnet-4-6
```

### 第 4 步：观察

`/console/dashboard` 看余额 + 24 小时用量；`/console/usage` 看每次请求明细；
`/console/settings` 改密码。

---

## 常见问题

### 请求返 503 `no upstream claude account available`

运维方还没挂上游账号，或者池子里的账号都冷却中 / 被封禁。联系他们。

### 请求返 429 `rate limited`

默认 60 请求/分钟/key。若业务真要更高频，让运维方调 `RATE_LIMIT_MAX`。

### 请求返 429 `monthly token quota exhausted`

你这把 key 铸造时带了月配额且已用完。去 `/console/keys` 铸新 key（没配额上限）或
让运维调你的 key 上限。

### 余额扣到 0 还能用吗

**目前能**（welcome credit 只是体验意义，不硬 gate）。未来接 Stripe 后会强制。

### 我的 Claude Code 流式响应卡顿

检查网络：`claude.你的域名/healthz` 从你的客户端应该秒返。如果慢，是你到网关的
链路问题；如果 /healthz 快但流式慢，是网关到 Anthropic 上游 + 你跨洲导致。部署在
台湾的网关对中国大陆用户延迟最低。

---

## 下一步

- 运维方：读 [operations.md](operations.md) 学日常管理
- 消费者：看 [/docs 公开页](https://claude.xxflk.cn/docs) 学更多客户端接入
- 技术决策：读 [adr/](adr/) 下的 7 份架构决策记录
