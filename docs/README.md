# Documentation

Navigation hub for the `xxf-ai-server` documentation set.

## For everyone

- [architecture.md](architecture.md) — System overview, components, data flow, data model.
- [roadmap.md](roadmap.md) — Phased delivery plan P0 → P5.

## For developers

- [api.md](api.md) — Public API surface (Anthropic & OpenAI compatibility) and admin API.
- [../CONTRIBUTING.md](../CONTRIBUTING.md) — Workflow, commit style, review conventions.

## For operators

- [deployment.md](deployment.md) — Deploy on a single VPS with Docker Compose + Caddy.
- [operations.md](operations.md) — Day-two runbook: rotating proxies, cooling accounts,
  handling bans, capacity planning.
- [security.md](security.md) — Threat model, token-at-rest encryption, ToS risk posture.

## Decisions

Architecture Decision Records ([ADRs](adr/)) capture choices that are costly to reverse:

- [0001 — OAuth over web scraping](adr/0001-oauth-over-web-scraping.md)
- [0002 — Node.js + Fastify + Drizzle stack](adr/0002-nodejs-fastify-stack.md)
- [0003 — Multi-user contributed account pool](adr/0003-multi-user-pool.md)
- [0004 — Next.js 15 admin UI](adr/0004-nextjs-admin-ui.md)

New decisions should add a sequentially numbered ADR; obsoleted ones are **superseded**
(linked forward), never deleted.
