# Security & Risk Model

This document is honest about the fact that aggregating subscription accounts and
re-exposing them as an API is outside the intended use of those subscriptions. We
document the risk posture so operators make informed choices.

## 1. Legal / ToS risk

- Claude Pro / Max terms restrict usage to the subscriber. Aggregating multiple
  subscribers' tokens into a shared API pool and offering it to others may violate
  Anthropic's [Usage Policy](https://www.anthropic.com/legal/aup) and commercial terms.
- OpenAI's ChatGPT subscription terms are comparably restrictive.
- Penalties: account bans, potential claims for unpaid API fees equivalent to observed
  usage, and in aggravated cases civil action.

**Mitigations:**

- Keep the operator group small and trusted; prefer self-use over public resale.
- If reselling, avoid marketing that explicitly claims API-equivalence or undercuts
  official pricing in ways likely to draw attention.
- Maintain fast detach + data-delete capability for any account on request.

## 2. Abuse-detection risk (Cloud IP + multi-account)

See the risk table in the project plan — summary:

| Risk                      | Severity | Mitigation                                          |
| ------------------------- | -------- | --------------------------------------------------- |
| Cloud IP identifiable     | Low      | Acceptable for low account counts                   |
| Many accounts → same IP   | **High** | Per-account egress proxy binding (residential)      |
| Account IP geo drift      | Medium   | Pin each account to a stable egress IP              |
| Burst concurrency per acc | Medium   | Pool targets 80 % window utilization, spreads load  |

Proxy recommendations: IPRoyal, Bright Data, or self-hosted residential/mobile pools.
**Never** rotate a single account across multiple egress IPs in the same day.

## 3. Token-at-rest encryption

- Algorithm: **AES-256-GCM**, random 96-bit nonce per encryption, auth tag stored inline.
- Key: `ENCRYPTION_KEY` (32-byte hex) in the process environment. **Never** committed.
- Rotation: see below.

### Rotation procedure

1. Generate `ENCRYPTION_KEY_NEXT` and deploy alongside the current key.
2. Run the re-encrypt CLI: `node dist/cli/reencrypt.js --from KEY --to KEY_NEXT`.
3. Once all rows migrated, promote `KEY_NEXT` → `ENCRYPTION_KEY` and drop the old var on
   the next deploy.

## 4. Downstream auth

- API keys are **randomly generated** 32-byte values, prefixed `sk-xxf-`, stored as
  **SHA-256 hash** only. The plaintext is returned once at mint time.
- Admin UI uses argon2id-hashed passwords, JWT session cookies signed with `JWT_SECRET`,
  15-minute sliding TTL, `HttpOnly; Secure; SameSite=Strict`.
- No long-lived session tokens; re-login required after 7 days of inactivity.

## 5. Transport

- TLS 1.3 only. Caddy handles certs automatically.
- HSTS: 6-month max-age, preload-eligible once production is stable.

## 6. Data retention

| Data                  | Retention                | Rationale                           |
| --------------------- | ------------------------ | ----------------------------------- |
| OAuth tokens          | Lifetime of account row  | Required for operation              |
| Usage log             | 90 days                  | Billing window + audit              |
| Request/response body | **Never persisted**      | Minimize blast radius of breach     |
| Admin audit log       | 365 days                 | Compliance posture                  |

## 7. Threat model — what we protect against

- **External attacker scraping the API** — rate-limited per key, IP-level backoff on
  repeated 401s.
- **Stolen API key** — revoke + regenerate; quota cap limits blast radius.
- **Stolen DB dump** — tokens encrypted; tokens unusable without `ENCRYPTION_KEY`.
- **Compromised admin** — audit log + JWT-based session revocation.

## 8. Threat model — what we don't protect against (yet)

- **Compromised host** (root on the VM) — attacker gets `.env` and DB, game over.
  Mitigations: minimal SSH keys, fail2ban, disk encryption — standard hygiene.
- **Supply-chain via npm** — pinning via `pnpm-lock.yaml` helps, but deep auditing of
  Node.js deps is out of scope for now.
