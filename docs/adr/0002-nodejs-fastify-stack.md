# ADR 0002 — Node.js + Fastify + Drizzle + Postgres + Redis

- **Status:** Accepted
- **Date:** 2026-04-17
- **Deciders:** xxf

## Context

Language / framework choice for the API gateway. Shortlist: Node.js (Fastify / Hono), Go
(chi / echo), Python (FastAPI).

## Decision

- **Node.js 20 LTS + TypeScript (strict)**
- **Fastify** as the HTTP framework
- **Drizzle** as the ORM, **Postgres 16** for primary storage
- **Redis 7** for cache, rate-limit, and coordination state
- **pino** for logging

## Consequences

**Why Node.js / TypeScript:**

- The two biggest open-source references in this domain — `claude-relay-service` and
  `new-api` / `one-api` — live in the JS and Go ecosystems respectively. JS wins on
  copyability of patterns from the first reference and on community familiarity.
- First-class SSE / streams support; the relay's hottest path is stream forwarding.
- Shared TypeScript types between server (`apps/server`) and admin UI (`apps/web`)
  eliminate a whole class of contract bugs.

**Why Fastify (not Hono / Express):**

- Express is unmaintained-ish and slow. Hono is excellent but biased toward edge
  runtimes, and we deliberately target a stateful VM (ADR 0001 assumptions).
- Fastify has mature plugin ecosystem (auth, rate-limit, CORS, multipart) and first-class
  SSE support without framework-level hacks.

**Why Drizzle (not Prisma):**

- No code generation step blocking CI.
- SQL-first — easy to drop into raw queries when query planner hints are needed.
- Smaller runtime footprint; ships as plain TS.

**Why Postgres:**

- Row-level locks for the scheduler's "pick the least-used healthy account" query.
- `jsonb` for flexible settings blobs.
- Well-understood backup / HA story.

**Why Redis:**

- Rolling 5-hour window counters via `INCRBY` + key TTL.
- Distributed locks for token refresh to avoid thundering herds when a token is near
  expiry.
- API-key rate limit buckets.

## Alternatives considered

- **Go (chi + sqlc)** — tempting for performance, rejected because the reference pool is
  weaker in Go for this specific OAuth-relay pattern, and because we trade some CPU for
  TS ecosystem leverage.
- **Python (FastAPI + SQLAlchemy)** — rejected; SSE story is rougher and async fan-out
  has more footguns than Node's straightforward streams.
