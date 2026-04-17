# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

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
