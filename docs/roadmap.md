# Roadmap

Work is organized into incremental phases. Each phase ends with a merge to `main` and a
CHANGELOG entry. The phase exit criteria are the thing that has to work end-to-end — not a
task list.

| Phase  | Theme                         | Exit criterion                                               |
| ------ | ----------------------------- | ------------------------------------------------------------ |
| **P0** | Scaffolding                   | `pnpm dev` boots server + web; `/healthz` returns ok         |
| **P1** | MVP relay                     | Claude Code / Cline can hit our endpoint with one attached account and stream a response |
| **P2** | Account pool + resilience     | Multiple accounts rotate, token auto-refreshes, bans cool    |
| **P3** | Users & API keys + admin UI   | Non-admins can attach accounts and get a key via the UI      |
| **P4** | OpenAI compatibility + ChatGPT | Cursor works end-to-end through a ChatGPT account            |
| **P5** | Billing, observability, polish | Stripe or voucher billing live; Prometheus/Grafana dashboard |

## P0 — Scaffolding (current)

- pnpm monorepo with workspaces
- TS strict mode, Prettier, shared tsconfig base
- Fastify server skeleton with `/healthz`
- Next.js 15 admin UI skeleton
- Drizzle schema placeholder for primary tables
- Docker Compose dev stack (server + web + postgres + redis + caddy)
- Docs: architecture, roadmap, api, deployment, operations, security, ADRs 0001–0004

## P1 — MVP relay

- `POST /v1/messages` Anthropic-compatible, streaming passthrough
- Token paste flow: attach a Claude OAuth token via admin API
- AES-GCM encryption of tokens at rest
- Request/response token accounting
- Integration test: real Postgres, real Redis, mock upstream

## P2 — Account pool + resilience

- Scheduler: health + remaining-window-tokens + last-used
- 5-hour rolling window quota tracker per account + plan
- Token refresh worker (before expiry)
- Health probe: classify rate-limited / cooling / banned
- Automatic cool-off when upstream returns 429 / 4xx abuse signals

## P3 — Users, API keys, admin UI

- Admin login (email + password, argon2 hash)
- Contributor role: can attach own account, cannot see others' stats
- API key CRUD with monthly quota
- Pages: Accounts, Users, Keys, Dashboard, Stats, Settings
- Audit log of admin actions

## P4 — OpenAI compat + ChatGPT

- `POST /v1/chat/completions` translation layer
- Codex CLI OAuth integration for ChatGPT Plus/Pro accounts
- Model mapping table (`gpt-4o` → upstream, etc.)
- Cursor compatibility test

## P5 — Billing & polish

- Egress proxy management UI, per-account binding
- Stripe metered billing OR voucher / card-key model
- Prometheus metrics + basic Grafana dashboard
- Alerting: account banned, pool exhausted, error rate spike
- Backup & restore runbook
