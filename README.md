# xxf-ai-server

> **AI relay gateway** aggregating Claude / ChatGPT subscription accounts via OAuth, exposing
> OpenAI- and Anthropic-compatible APIs for AI coding tools (Claude Code, Cline, Cursor, …).

A small-team-friendly gateway that pools multiple subscription accounts contributed by trusted
users, routes incoming API calls to a healthy account with remaining quota, and provides a
web admin UI for managing accounts, downstream API keys, usage and billing.

---

## Highlights

- **OAuth-based upstream** — uses Claude Code / Codex CLI OAuth tokens, not fragile web scraping.
- **Multi-tenant account pool** — multiple users can contribute their own Claude Pro / Max or
  ChatGPT Plus / Pro subscriptions; each account can be kept private or shared with the pool.
- **OpenAI & Anthropic compatible** — drop-in endpoint for any tool that speaks those APIs.
- **Streaming-first** — SSE pass-through with per-request token accounting.
- **Ready for ops** — Postgres + Redis + Caddy, Docker Compose deployable, per-account egress
  proxy slot for abuse-risk isolation.
- **Admin UI** — Next.js 15 + shadcn/ui: accounts, users, API keys, usage dashboards, settings.

## Repository layout

```
xxf-ai-server/
├── apps/
│   ├── server/      # Fastify API gateway (TypeScript, Drizzle, Redis)
│   └── web/         # Next.js 15 admin UI (Tailwind, shadcn/ui)
├── packages/
│   └── shared/      # Shared TS types & constants
├── docs/            # Architecture, roadmap, API, deployment, ops, security, ADRs
├── docker-compose.yml
├── Caddyfile
└── .env.example
```

See **[docs/architecture.md](docs/architecture.md)** for the system design and
**[docs/roadmap.md](docs/roadmap.md)** for the phased delivery plan.

## Quick start (development)

Requirements: Node.js 20+, pnpm 9+, Docker.

```bash
cp .env.example .env
# Boot Postgres + Redis locally:
docker compose up -d postgres redis
pnpm install
pnpm dev
```

The API gateway comes up on `http://localhost:8787` and the admin UI on `http://localhost:3000`.

## Status

Early scaffolding (phase P0). Subsequent phases are tracked in
[docs/roadmap.md](docs/roadmap.md).

## Legal

Operating this gateway against provider subscription accounts carries ToS risk — see
[docs/security.md](docs/security.md) for the risk model and mitigations. Users are
responsible for compliance within their own jurisdictions.

## License

MIT. See [LICENSE](LICENSE).
