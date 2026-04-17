# Operations Runbook

Day-two procedures for running `xxf-ai-server` in production.

## Account lifecycle

### Attach a new account

1. Ask the contributor to run, on their own machine, whatever command their tool provides
   to mint an OAuth token (e.g. `claude setup-token` for Claude Code).
2. They paste the token into the `/accounts/new` admin UI form, along with plan (`pro`,
   `max5x`, `max20x`) and whether to share to the public pool.
3. The server encrypts the token with AES-GCM before writing to `accounts.oauth_*`.
4. A **probe** runs immediately — a tiny upstream call with `max_tokens: 4` — to
   confirm the token works. If it fails, the account is created with `status='banned'`
   and flagged in the UI.

### Cool an account that just got rate-limited

The scheduler sets `status='rate_limited'` and `cooling_until=now+<window>` automatically
on a 429. Manual overrides:

```sql
UPDATE accounts
   SET status = 'cooling', cooling_until = NOW() + interval '2 hours'
 WHERE id = '<uuid>';
```

### Detect a banned account

Symptoms upstream returns `permission_denied` or repeated `invalid_grant` on refresh.
The health worker marks `status='banned'`. Bans are **not** auto-recovered — operator
must confirm and detach.

## Egress proxy

Enable per-account egress proxying once the pool exceeds ~3 accounts. Rationale and risk
model are in [security.md](security.md).

1. Add proxy rows to `proxies` (label, URL, region, max concurrency).
2. Edit an account in the UI and pick a proxy binding.
3. Server pins the account's outbound traffic to that proxy. The pin is deliberately
   **sticky** — do not rotate an account across proxies without cooling first.

## Capacity planning

Rule-of-thumb per Claude Max 20× account (single-user view):

| Plan       | ~Tokens / 5h window | Safe pool utilization |
| ---------- | ------------------- | --------------------- |
| Pro        | ~100 k              | < 80 %                |
| Max 5×     | ~500 k              | < 80 %                |
| Max 20×    | ~2 M                | < 80 %                |

Scheduler targets 80 % to leave headroom for retries and avoid the step where Anthropic
classifies the account as abusive. Tune in `settings.pool.utilizationTarget`.

## Handling upstream incidents

- **Spike of 5xx from upstream** — scheduler's circuit breaker opens at > 20 % error over
  60 s and skips the affected provider for 30 s.
- **Cloudflare challenge** — OAuth path typically avoids this; if it appears, it signals
  the account has been flagged. Cool immediately, inspect, likely detach.
- **Token refresh fails** — worker retries with exponential backoff up to 5 times; on
  final failure marks the account `needs_reauth` and notifies the owner.

## Backup and restore

See [deployment.md#backups](deployment.md#6-backups) for backup command. Restore:

```bash
gunzip -c backup-2026-04-17.sql.gz | \
  docker compose exec -T postgres psql -U xxfai -d xxfai
```

Always restore to a **new** database first, validate, then swap. Never restore over the
live DB without taking it offline.

## Incident checklist

1. Silence the noisy alert (don't disable it).
2. Identify which account(s) / API key(s) are affected via `/admin/v1/stats/by-account`.
3. If upstream is the cause, note it; no action needed.
4. If a specific account is misbehaving, cool it (`status='cooling'`) before detaching,
   to preserve window state for diagnosis.
5. Write a brief post-incident note in `docs/incidents/YYYY-MM-DD-<slug>.md`.
