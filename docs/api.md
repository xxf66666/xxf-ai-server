# API

The gateway exposes three API surfaces:

1. **Anthropic-compatible** (`/v1/messages`) — primary, P1.
2. **OpenAI-compatible** (`/v1/chat/completions`) — P4.
3. **Admin** (`/admin/v1/*`) — internal, consumed by the admin UI.

All public requests are authenticated with a Bearer API key:

```
Authorization: Bearer sk-xxf-<key>
```

Admin requests use a short-lived JWT cookie issued by `/admin/v1/auth/login`.

---

## 1. Anthropic-compatible

### POST `/v1/messages`

Request and response bodies mirror the [Anthropic Messages
API](https://docs.anthropic.com/en/api/messages). Supported fields in P1:

- `model` — string, passed through (`claude-sonnet-4-6`, `claude-opus-4-7`, …)
- `messages` — array of role/content pairs
- `system` — string or array
- `max_tokens` — integer, required
- `stream` — boolean; `true` returns `text/event-stream`

Non-streaming example:

```bash
curl https://ai.example.com/v1/messages \
  -H 'Authorization: Bearer sk-xxf-...' \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "claude-sonnet-4-6",
    "max_tokens": 256,
    "messages": [{ "role": "user", "content": "Hi" }]
  }'
```

Streaming follows Anthropic's SSE event names (`message_start`, `content_block_delta`,
`message_delta`, `message_stop`). The gateway forwards events verbatim and attaches usage
fields from `message_delta` to the internal ledger.

### Error envelope

```json
{
  "type": "error",
  "error": {
    "type": "rate_limit_error",
    "message": "No upstream account available; retry in 42s"
  }
}
```

Error `type` values:

| `type`               | HTTP | Meaning                                          |
| -------------------- | ---- | ------------------------------------------------ |
| `authentication_error` | 401  | Missing or invalid API key                      |
| `permission_error`     | 403  | Key lacks access to requested model             |
| `not_found_error`      | 404  | Model not available                              |
| `rate_limit_error`     | 429  | Key quota exceeded, or pool temporarily dry     |
| `api_error`            | 502  | Upstream returned unrecoverable error           |
| `overloaded_error`     | 503  | All accounts rate-limited; try later            |

---

## 2. OpenAI-compatible (P4)

### POST `/v1/chat/completions`

Implements the subset of the [OpenAI Chat Completions
API](https://platform.openai.com/docs/api-reference/chat) needed by Cursor and similar
clients. Model names are mapped server-side to upstream providers — see
`settings → model mappings` in the admin UI.

---

## 3. Admin API

All admin endpoints require a logged-in admin JWT and live under `/admin/v1/`. Shapes are
defined in `packages/shared/src/admin.ts` and consumed directly by the Next.js UI.

### Accounts

| Method | Path                              | Purpose                              |
| ------ | --------------------------------- | ------------------------------------ |
| GET    | `/admin/v1/accounts`              | List attached accounts with health   |
| POST   | `/admin/v1/accounts`              | Attach: paste OAuth token + metadata |
| PATCH  | `/admin/v1/accounts/:id`          | Update (shared flag, proxy binding)  |
| DELETE | `/admin/v1/accounts/:id`          | Detach                               |
| POST   | `/admin/v1/accounts/:id/probe`    | Run a live health check              |

### Users & API keys

| Method | Path                                 | Purpose                         |
| ------ | ------------------------------------ | ------------------------------- |
| GET    | `/admin/v1/users`                    | List users                      |
| POST   | `/admin/v1/users`                    | Create downstream consumer      |
| POST   | `/admin/v1/users/:id/keys`           | Mint API key (returns once)     |
| DELETE | `/admin/v1/users/:id/keys/:keyId`    | Revoke                          |

### Stats

| Method | Path                         | Purpose                                 |
| ------ | ---------------------------- | --------------------------------------- |
| GET    | `/admin/v1/stats/overview`   | Totals + last-24h time series           |
| GET    | `/admin/v1/stats/by-account` | Token spend per account                 |
| GET    | `/admin/v1/stats/by-key`     | Token spend per API key                 |

### Health / system

| Method | Path             | Purpose                           |
| ------ | ---------------- | --------------------------------- |
| GET    | `/healthz`       | Liveness                          |
| GET    | `/readyz`        | Readiness (DB + Redis reachable)  |
| GET    | `/version`       | Build / commit metadata           |
