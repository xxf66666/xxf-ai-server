# @xxf/server

Fastify API gateway for `xxf-ai-server`. See the top-level [README](../../README.md) and
[architecture doc](../../docs/architecture.md) for context.

## Scripts

| Command              | Purpose                                       |
| -------------------- | --------------------------------------------- |
| `pnpm dev`           | `tsx watch` live reload on port 8787          |
| `pnpm build`         | Compile TS → `dist/`                          |
| `pnpm start`         | Run the compiled server                       |
| `pnpm typecheck`     | `tsc --noEmit`                                |
| `pnpm db:generate`   | Drizzle — generate SQL from `src/db/schema.ts`|
| `pnpm db:migrate`    | Apply pending migrations                      |

## Layout

```
src/
├── index.ts            # boot
├── config/env.ts       # zod-validated environment
├── api/                # HTTP surface
│   ├── health.ts       # /healthz, /readyz, /version
│   ├── anthropic/      # /v1/messages (P1)
│   ├── openai/         # /v1/chat/completions (P4)
│   └── admin/          # /admin/v1/* (P3)
├── core/               # business logic
│   ├── oauth/
│   ├── accounts/
│   ├── relay/
│   ├── users/
│   └── billing/
├── db/                 # Drizzle schema + client + migrate
├── cache/              # Redis client
├── middleware/         # auth / rate-limit / error
└── utils/              # logger, crypto (AES-GCM)
```
