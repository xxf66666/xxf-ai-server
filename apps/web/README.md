# @xxf/web

Admin console for `xxf-ai-server`. Next.js 15 App Router, Tailwind, shadcn-style primitives
(copied in rather than depended on).

## Scripts

| Command         | Purpose                                     |
| --------------- | ------------------------------------------- |
| `pnpm dev`      | Dev server on :3000                         |
| `pnpm build`    | Production build (`output: 'standalone'`)   |
| `pnpm start`    | Serve the production build                  |
| `pnpm typecheck`| Strict TS pass                              |

## Routes

| Route         | Purpose                                      | Phase |
| ------------- | -------------------------------------------- | ----- |
| `/`           | Public landing / deep-link to sign-in        | P0    |
| `/login`      | Admin sign-in (argon2 + JWT)                 | P3    |
| `/dashboard`  | Health + usage summary                       | P3    |
| `/accounts`   | Attach / detach / share subscription accounts| P1/P3 |
| `/users`      | Downstream users & contributors              | P3    |
| `/keys`       | API key CRUD                                 | P3    |
| `/stats`      | Usage charts                                 | P3    |
| `/settings`   | System configuration                         | P5    |

All data-bound pages call the gateway's `/admin/v1/*` API — see
[../../docs/api.md](../../docs/api.md).
