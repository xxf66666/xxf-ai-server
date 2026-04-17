# Contributing

Thanks for considering a contribution! This document captures the conventions the project
follows. For context, start with the [README](README.md) and
[architecture doc](docs/architecture.md).

## Development setup

1. Install **Node.js 20+** and **pnpm 9+**.
2. `cp .env.example .env` and fill in values where needed.
3. `docker compose up -d postgres redis`.
4. `pnpm install && pnpm dev`.

## Branching

- `main` — always deployable. Protected; only PR merges.
- `dev` — integration branch for in-progress features.
- `feature/<slug>`, `fix/<slug>`, `chore/<slug>` — short-lived topic branches.

## Commit messages — Conventional Commits

Use the [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>(<scope>): <short imperative summary>

<body — the WHY, not the what>

<footer — breaking changes, refs>
```

Common types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`, `build`, `ci`.

Examples:

- `feat(accounts): add 5h rolling-window quota tracker`
- `fix(relay): prevent SSE chunk splitting across buffers`
- `docs(adr): record decision to use Drizzle over Prisma`

## Pull requests

- Keep PRs focused. One feature / fix / refactor per PR.
- Include a short description: problem, approach, tradeoffs.
- Update docs and CHANGELOG when behaviour changes.
- Pass `pnpm lint`, `pnpm typecheck`, `pnpm test` locally before requesting review.

## Code style

- TypeScript strict mode everywhere.
- Prefer small, composable modules over large service classes.
- Write comments only when the *why* is non-obvious — avoid narrating *what*.
- No mock DBs in integration tests — hit a real Postgres via Docker.

## Architecture Decision Records

For any decision that's hard to reverse (stack choice, protocol choice, data model), add an
ADR under `docs/adr/`. Copy `docs/adr/0001-oauth-over-web-scraping.md` as a template. Number
sequentially, never delete — supersede instead.

## Security

Never commit `.env` files, OAuth tokens, or production secrets. If you discover a security
issue, please open a **private** report rather than a public issue.
