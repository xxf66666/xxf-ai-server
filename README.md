<p align="center">
  <img src="apps/web/public/logo.svg" width="72" height="72" alt="Nexa" />
</p>

<h1 align="center">Nexa</h1>

<p align="center">
  <b>AI gateway for Claude Code / Cline / Cursor.</b><br/>
  Pool your Claude + ChatGPT subscriptions behind one OpenAI / Anthropic-compatible API.<br/>
  Pay-as-you-go via redeem codes, 15% off official list, $5 welcome credit.
</p>

<p align="center">
  <a href="https://claude.xxflk.cn"><b>🌐 Live — claude.xxflk.cn</b></a> ·
  <a href="docs/quickstart.md">Quickstart</a> ·
  <a href="docs/api.md">API</a> ·
  <a href="docs/deployment.md">Deploy</a> ·
  <a href="docs/security.md">Security</a>
</p>

<p align="center">
  <sub>Repo name stays <code>xxf-ai-server</code>; brand / site is <b>Nexa</b>. Packages <code>@xxf/*</code> unchanged.</sub>
</p>

---

## What it does

You plug your Claude Code OAuth token (or multiple) in, it exposes:

- `POST /v1/messages` — Anthropic-shaped (native)
- `POST /v1/chat/completions` — OpenAI-shaped (translated onto Claude upstream)

Point Claude Code, Cline, or Cursor at `https://<your-host>/v1` with an
`sk-xxf-…` key minted in the console and you're done. Streaming, tool use,
`anthropic-beta` headers — all passthrough.

Behind the scenes a scheduler balances load across pooled accounts using a
5-hour rolling window, auto-refreshes OAuth tokens, cools off rate-limited
accounts, and bills each request to micro-USD precision.

## 30-second consumer demo

```bash
# 1. Register at https://claude.xxflk.cn/register (invite code required)
# 2. Click the verification link in your inbox
# 3. Sign in, mint a key at /console/keys

curl https://claude.xxflk.cn/v1/messages \
  -H 'Authorization: Bearer sk-xxf-YOUR-KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "claude-sonnet-4-6",
    "max_tokens": 128,
    "messages": [{"role": "user", "content": "hi"}]
  }'
```

Anything that speaks Anthropic or OpenAI chat-completions works. Point Claude
Code at it with `ANTHROPIC_BASE_URL=https://claude.xxflk.cn/v1` and your
`sk-xxf-…` as `ANTHROPIC_AUTH_TOKEN`.

## Core features

| | |
|---|---|
| 🔌 **OAuth-based upstream** | Uses Claude Code / Codex CLI OAuth tokens — not web scraping. Response shape matches official APIs; streaming is stable. |
| 🌊 **Multi-account pool** | Several contributors plug subscriptions in; each chooses "private to me" or "shared pool". |
| 🔄 **Dual protocol** | Anthropic `/v1/messages` + OpenAI `/v1/chat/completions` (translator layer). |
| 🎛️ **Admin + consumer UI** | Next.js 15 admin console (B) + end-user dashboard (C), zh/en toggle. |
| 🔐 **Hard-gate auth** | Invite-code register → email verification → active. Brute-force lockout (5 bad in 15 min). Self-serve password reset. |
| 👮 **Lifecycle + audit** | `pending_verification` / `active` / `suspended` states; every login, register, verify, reset event in `audit_log` with IP. |
| 💰 **Per-token billing** | micro-USD precision, 8 models pre-priced at 85% of list, $5 welcome credit, CNY display. |
| 🎟️ **Redeem codes** | Admin batch-mints, users self-redeem in `/console/wallet`. |
| 🛡️ **Resilience** | 5-hour rolling window, OAuth auto-refresh, upstream error classification + cooldown, per-provider circuit breaker, per-account egress proxy. |
| 📊 **Observability** | Prometheus `/metrics`, structured pino logs, 200-event audit page with filters. |
| 🔒 **Security** | AES-256-GCM at rest for OAuth tokens, argon2id passwords, JWT cookie sessions, RBAC on every write. |

## Architecture at a glance

```
          ┌───────────────────────────────────────────────────────┐
 clients  │  Claude Code · Cline · Cursor · curl                  │
          └──────────┬────────────────────────────────────────────┘
                     │  sk-xxf-…  HTTPS
                     ▼
          ┌──────────────────────────────────────────┐
 Caddy ◀──┤  :443  TLS, HSTS, LE auto-renew          │
          └──────────┬───────────────────────────────┘
                     ▼
          ┌──────────────────────────────────────────┐
          │ Fastify 5 gateway (TS strict)            │
          │  • /v1/*        relay + billing          │
          │  • /admin/v1/*  management + auth        │
          │  • /v1/console/* end-user                │
          │  • workers: oauth refresh, probe, sweep  │
          └─────┬──────────────────┬─────────────────┘
                │                  │
                ▼                  ▼
         ┌─────────────┐   ┌──────────────┐
         │ Postgres 16 │   │  Redis 7     │
         │ Drizzle ORM │   │ rate-limit,  │
         │ 8 tables    │   │ window ctr,  │
         │ (migrations)│   │ breaker      │
         └─────────────┘   └──────────────┘
                                  │
                                  ▼ egress proxies (per-account)
          ┌──────────────────────────────────────────┐
          │ Anthropic · OpenAI (OAuth bearer)        │
          └──────────────────────────────────────────┘
```

## Repo layout

```
apps/server/        Fastify gateway (TypeScript, Drizzle, Redis)
apps/web/           Next.js 15 App Router (marketing + admin + console)
packages/shared/    Shared TS types
docs/               Architecture, API, deploy, ops, security, ADRs
docker-compose.yml  Full prod stack (caddy + postgres + redis + server + web)
.env.example        All tunables with comments
```

## Run it locally

Needs Node 20+, pnpm 9+, Docker.

```bash
cp .env.example .env
echo "ENCRYPTION_KEY=$(openssl rand -hex 32)" >> .env
echo "JWT_SECRET=$(openssl rand -hex 48)" >> .env
echo "ADMIN_BOOTSTRAP_TOKEN=$(openssl rand -hex 24)" >> .env

docker compose up -d postgres redis
pnpm install
pnpm --filter @xxf/shared build
pnpm dev
```

- API: <http://localhost:8787>
- Web: <http://localhost:3000>

Leave `SMTP_*` blank in `.env` and register will skip email verification
(auto-activates), so you can develop the whole flow offline.

Create the first admin:

```bash
pnpm --filter @xxf/server admin:create \
  --email admin@example.com --password 'strongpass'
```

Then mint an invite code at `/invites` and register your first consumer.

## URL map

| Surface | Route | Purpose |
|---|---|---|
| Public | `/` `/pricing` `/docs` `/terms` `/privacy` | Marketing |
| Public | `/login` `/register` `/forgot-password` `/reset-password?token=…` `/verify-email?token=…` | Auth |
| Public API | `/v1/pricing` `/healthz` `/readyz` `/version` `/metrics` | Status + price feed |
| Consumer | `/console/{dashboard,keys,models,usage,wallet,settings}` | End-user |
| Admin / contributor | `/{dashboard,accounts,users,keys,invites,redeem-codes,proxies,stats,audit,settings}` | Operator |
| Bearer API | `/v1/messages` · `/v1/chat/completions` | For clients using `sk-xxf-…` |

## Account lifecycle

```
  register   ┌──────────────────────┐  click verify link
 ──────────▶ │ pending_verification │ ──────────────────▶ ┌────────┐
             └──────────────────────┘                    │ active │
                     ▲                                   └────┬───┘
                     │         admin force-activate           │
                     │ ◀──────────────────────────────────────┤
                     │                                         │
                     │       admin suspend / reactivate       ▼
                     │                                   ┌──────────┐
                     └────────────────────────────────── │suspended │
                                                         └──────────┘
```

Only `active` may log in or call the API. A 5-miss password cascade sets
`locked_until = now() + 15 min`; login returns `423` with `retryAfterSec`.
Password reset clears the counter; admin has a one-click **Unlock**.

## Billing model

- 8 models seeded with official list prices — Claude Opus / Sonnet / Haiku
  plus GPT-4o / o1 / 4o-mini / 4-turbo / 3.5.
- Global **85% discount** (15% off) on top of the upstream price. Adjust via
  `pricing.markupRate` in `/settings`.
- Input and output tokens billed independently in micro-USD (10⁻⁶ USD).
- New accounts get `$5` welcome credit (`pricing.welcomeCreditMud`).
- CNY display converts through `pricing.usdToCnyRate` (default 7.2).
- Top-up = admin mints redeem codes at `/redeem-codes`, users redeem in
  `/console/wallet`.

## Status

Production-live at [claude.xxflk.cn](https://claude.xxflk.cn). Roadmap phases
P0–P5 plus Phase 1+2 of user-management hardening are shipped. What's next is
in [roadmap.md](docs/roadmap.md).

## Contact / support

- 📮 Email: **xixiyeyu@gmail.com**
- 💬 WeChat QR: top of footer on [claude.xxflk.cn](https://claude.xxflk.cn),
  or `/console/dashboard` after signing in.

## Compliance note

Pooling personal subscriptions and re-exposing them as an API **generally
violates Anthropic / OpenAI personal-subscription terms**. Account bans are
a real risk. See [docs/security.md](docs/security.md) for the threat model.
Operators are responsible for their own jurisdiction's compliance.

## License

MIT — see [LICENSE](LICENSE).
