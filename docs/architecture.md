# Architecture

## 1. Goal

Provide a **single API endpoint** that AI coding tools (Claude Code, Cline, Cursor, …) can
call, backed by a pool of **subscription-account** OAuth tokens contributed by trusted
users, with per-account quota tracking, health monitoring, and a web admin UI.

## 2. High-level topology

```
                 ┌──────────────────────────────────────────────┐
                 │                 Public internet              │
                 └──────────────────┬───────────────────────────┘
                                    │ HTTPS
                      ┌─────────────▼─────────────┐
                      │     Caddy (TLS, reverse   │
                      │     proxy, rate limit)    │
                      └──────┬──────────┬─────────┘
                             │          │
                ┌────────────▼──┐   ┌───▼──────────────┐
                │  apps/server  │   │    apps/web      │
                │  Fastify API  │   │  Next.js admin   │
                │  :8787        │   │  :3000           │
                └──┬─────────┬──┘   └────────┬─────────┘
                   │         │               │
           ┌───────▼──┐   ┌──▼────┐      (calls server)
           │ Postgres │   │ Redis │
           └──────────┘   └───────┘
                   │
    ┌──────────────┴──────────────┐
    │ Egress via direct or proxy  │ (per-account binding)
    └──────────────┬──────────────┘
                   │
          ┌────────▼─────────┐
          │  Upstream OAuth  │
          │  (Anthropic /    │
          │   OpenAI)        │
          └──────────────────┘
```

## 3. Components

### 3.1 `apps/server` (Fastify, TypeScript)

- **API layer** (`src/api/*`)
  - `anthropic/messages.ts` — `POST /v1/messages`, Anthropic-compatible.
  - `openai/chat.ts` — `POST /v1/chat/completions`, OpenAI-compatible.
  - `admin/*` — JSON CRUD for the admin UI.
- **Core** (`src/core/*`)
  - `oauth/` — Claude Code and Codex CLI OAuth flows; token refresh.
  - `accounts/` — pool scheduler, registry, health probe, quota windows.
  - `relay/` — upstream call + SSE streaming pass-through with token accounting.
  - `users/` — downstream user auth, API key management, per-user quota.
  - `billing/` — usage ledger, aggregation for invoicing (P5+).
- **Infrastructure**
  - `db/` — Drizzle schema, migrations.
  - `cache/` — Redis client; used for token TTL, rate limiters, session cache.
  - `middleware/` — API key auth, rate limit, error envelope, request logging.
  - `utils/` — pino logger, AES-GCM crypto for token-at-rest.

### 3.2 `apps/web` (Next.js 15)

Admin UI only (no public-facing surface). Routes:

- `/login` — admin auth.
- `/dashboard` — live health + usage summary.
- `/accounts` — list / attach / detach / share subscription accounts.
- `/users` — downstream tenants and their API keys.
- `/keys` — API key CRUD with quota.
- `/stats` — usage over time, per account/user/model.
- `/settings` — system configuration (proxy pool, models enabled).

### 3.3 `packages/shared`

Zero-runtime package: shared TypeScript types (request/response DTOs, enums) consumed by
both `server` and `web` to keep the contract single-sourced.

## 4. Data model (primary tables)

See [../apps/server/src/db/schema.ts](../apps/server/src/db/schema.ts) for canonical
definitions. Summary:

| Table        | Purpose                                                        |
| ------------ | -------------------------------------------------------------- |
| `users`      | Admin and contributor accounts (UI auth)                       |
| `accounts`   | Upstream subscription accounts (owner + shared flag + tokens)  |
| `api_keys`   | Credentials for downstream API callers with quota              |
| `usage_log`  | Per-request usage record (for billing, analytics, audit)       |
| `proxies`    | Egress proxy pool, bound per-account                           |

Key invariant: **`accounts.owner_user_id`** identifies who attached the subscription.
When `shared=false` only that owner's API keys may route through it; otherwise the account
is in the shared pool.

## 5. Request lifecycle (streaming completion)

```
Client (Cline)
   │  POST /v1/messages  (Bearer <api_key>)
   ▼
auth middleware       — look up api_key, check quota
   │
account scheduler     — pick healthiest account in window for (owner + shared)
   │
oauth client          — refresh if token near expiry; attach Bearer
   │
upstream (Anthropic)  — SSE stream
   │
relay.stream          — forward chunks to client, count tokens
   │
on-finish hook        — write usage_log, decrement api_key quota,
                        advance account window usage
   ▼
Client
```

## 6. Key cross-cutting concerns

- **Token at rest** — AES-256-GCM with a single `ENCRYPTION_KEY` env var. Rotation via dual
  re-encryption (new key set, backfill, flip).
- **Abuse-risk isolation** — each account has an optional `proxies.id` binding. When set,
  all egress for that account goes through that proxy. See
  [operations.md](operations.md#egress-proxy) and
  [adr/0003-multi-user-pool.md](adr/0003-multi-user-pool.md).
- **Observability** — pino JSON logs with `reqId`; latency and token counts emitted to
  Prometheus (planned P5).
- **Backpressure** — Redis-based token bucket per API key; server returns HTTP 429 with
  standard `Retry-After` header.

## 7. Non-goals (for now)

- Running on serverless (Cloudflare Workers etc.) — SSE time limits and stateful pool
  scheduling don't fit.
- Multi-region active-active — single-region is enough for the small-team + resale target.
- End-user chat UI — consumers bring their own client; we're a gateway.
