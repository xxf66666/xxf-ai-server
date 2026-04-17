# ADR 0004 — Next.js 15 for the admin UI

- **Status:** Accepted
- **Date:** 2026-04-17
- **Deciders:** xxf

## Context

The gateway needs a web admin UI: account lifecycle, users and API keys, usage
dashboards, settings. Options considered: Next.js (App Router), Vite + React SPA,
Refine.dev, Remix.

## Decision

**Next.js 15 App Router** with **Tailwind CSS** and **shadcn/ui** components.

## Consequences

**Positive**

- App Router + Server Components reduce hand-rolled data-fetching glue for list/table
  pages.
- `shadcn/ui` provides production-grade components that the team copy-pastes rather than
  depending on a UI library — very low lock-in.
- Large community template pool (`shadcn-admin`, `next-shadcn-dashboard`) to bootstrap
  from.
- Same Node.js toolchain as the server — one `pnpm install`, one Dockerfile per app, one
  CI pipeline.

**Negative**

- Next.js image is heavier than a pure-static Vite SPA; containers are ~100 MB larger.
  Mitigated by standalone output (`output: 'standalone'`) and running in the same
  Docker Compose stack behind Caddy.
- App Router's server-components model requires discipline on the server/client
  boundary; we will avoid putting API-key secrets into server components that might leak
  into RSC payloads.

## Alternatives considered

- **Vite + React SPA** — lighter and simpler, but loses App Router's data-fetch
  ergonomics, and the team would reinvent layouts / auth boundary that Next gives for
  free.
- **Refine.dev** — fast CRUD scaffolding, but it's a framework-on-a-framework and the
  admin surface here is small enough that Next + shadcn hand-rolling stays cleaner.
- **Remix** — comparable to Next, but smaller template pool for admin dashboards, and
  the team is more familiar with Next.

## Out of scope

No public-facing web surface is planned for now — any end-user chat UI stays out, per
[architecture.md §7](../architecture.md#7-non-goals-for-now).
