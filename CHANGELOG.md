# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added — P1 (MVP relay)

- `POST /v1/messages` Anthropic-compatible endpoint: authenticates via
  `sk-xxf-…` API key, picks a healthy Claude account from the pool, forwards
  to the upstream OAuth endpoint, and streams SSE back verbatim.
- AES-256-GCM token-at-rest sealing for upstream OAuth tokens
  (`nonce.ciphertext.tag` envelope, single `ENCRYPTION_KEY` env).
- Admin API under `/admin/v1/*` gated by `X-Admin-Token` bootstrap bearer:
  `users`, `accounts`, `keys` CRUD. Proper login lands in P3.
- API key minting: random 24-byte secret, SHA-256 hash at rest, plaintext
  returned once.
- Pool scheduler v1: owner-match > shared pool, ordered by windowTokensUsed.
- Usage accounting: per-request `usage_log` entries with input/output token
  counts; per-account rolling `windowTokensUsed` counter.
- Drizzle initial migration (`0000_init.sql`, 5 tables); migrations run
  automatically on server boot.

### Added — P0 (scaffolding)

- Initial monorepo scaffold: `apps/server`, `apps/web`, `packages/shared`.
- Project documentation skeleton under `docs/` including architecture, roadmap, API,
  deployment, operations, security, and ADRs 0001–0004.
- Docker Compose dev stack (Postgres + Redis + server + web + Caddy).
- Fastify server with `/healthz`, Drizzle schema placeholders, and module stubs for
  OAuth, account pool, relay, users, and billing.
- Next.js 15 admin UI skeleton with login, dashboard, accounts, users, keys, stats,
  and settings route placeholders.

## [0.0.1] - 2026-04-17

- Repository initialized.
