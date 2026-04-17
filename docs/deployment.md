# Deployment

Target platform: **single-VPS Docker Compose** on GCP (Taiwan region, `asia-east1`), or any
equivalent cloud VM with ≥ 2 vCPU / 4 GB RAM / 40 GB disk.

## 1. Prerequisites

- Ubuntu 24.04 LTS (or similar)
- Docker 26+ and Docker Compose v2
- A domain name with A/AAAA records pointing to the VM
- Ports **80** and **443** open on the VM firewall

## 2. Initial bring-up

```bash
git clone <repo> xxf-ai-server
cd xxf-ai-server
cp .env.example .env
# Generate a 32-byte encryption key:
openssl rand -hex 32   # → paste into ENCRYPTION_KEY
openssl rand -hex 48   # → paste into JWT_SECRET
# Set your domain in Caddyfile:
sed -i 's/ai.example.com/your.domain.tld/g' Caddyfile
docker compose up -d
docker compose logs -f server
```

Caddy will provision a Let's Encrypt certificate automatically on first boot.

## 3. Services in the compose stack

| Service     | Role                      | Internal port |
| ----------- | ------------------------- | ------------- |
| `caddy`     | TLS + reverse proxy       | 80 / 443      |
| `server`    | Fastify API gateway       | 8787          |
| `web`       | Next.js admin UI          | 3000          |
| `postgres`  | Primary data store        | 5432          |
| `redis`     | Cache, rate limit, locks  | 6379          |

Caddy routes:

- `https://<domain>/v1/*` → `server:8787`
- `https://<domain>/admin/*` → `server:8787`
- `https://<domain>/*` (everything else) → `web:3000`

## 4. First admin user

```bash
docker compose exec server node dist/cli/create-admin.js \
  --email you@example.com --password <strong-pass>
```

(The CLI is delivered in P3; before that, seed via SQL.)

## 5. Upgrades

```bash
git pull
docker compose pull
docker compose up -d --build
```

Migrations run automatically on `server` start via Drizzle's `migrate()` runner. Rollbacks
require a DB restore — see [operations.md](operations.md#backup-and-restore).

## 6. Backups

Recommended daily: `pg_dump` to an object-storage bucket (R2 / S3). Redis state is
ephemeral — no backup needed.

```bash
docker compose exec -T postgres \
  pg_dump -U xxfai xxfai | gzip > backup-$(date +%F).sql.gz
```

Store the backup **encrypted at rest** — it contains encrypted OAuth tokens, but the
encryption key lives in `.env`, so leaks would still be exploitable once paired.

## 7. Scaling notes

The stack is single-node by design. For more throughput:

- Vertical scale first — API gateway is I/O-bound; 4 vCPU serves a few hundred
  concurrent streams.
- Redis and Postgres can be moved to managed services without code changes.
- The server is stateless except for the Redis session cache, so horizontal scaling is
  possible once you add a shared-egress proxy layer (P5+).
