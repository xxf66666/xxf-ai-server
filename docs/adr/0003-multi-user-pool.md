# ADR 0003 — Multi-user contributed account pool

- **Status:** Accepted
- **Date:** 2026-04-17
- **Deciders:** xxf

## Context

The gateway is designed for a small team where several members already hold Claude Pro /
Max or ChatGPT Plus / Pro subscriptions. The question is: should each member's account
stay scoped to themselves, or should they pool into shared capacity?

## Decision

Support **both**, per account, via a boolean `shared` flag and an `owner_user_id`
reference.

- `shared = false` — the account is usable **only** by API keys owned by
  `owner_user_id`. Personal-use mode.
- `shared = true` — the account joins a public pool; any API key in the system can route
  through it. Contributor mode.

Scheduling preference: when selecting for a request, **owner-matched accounts win over
shared-pool accounts**, all else equal. This prevents a contributor's own calls from
being starved by other users when their account is healthy.

## Consequences

**Positive**

- Non-committal onboarding: a new contributor can attach their account in "private" mode
  first, get comfortable, then flip the share toggle later.
- Accountability: every account has a human owner reachable for reauth / ban recovery.
- Abuse isolation: when reselling, operator can price shared-pool access higher and gate
  it per-key.

**Negative**

- Scheduler logic is slightly more complex — must compute two candidate sets per request.
- UI must render the private / shared distinction clearly to avoid surprises
  ("why is my account being used?").

## Implementation notes

- The `owner_user_id` is set at attach time and immutable.
- Toggling `shared` is a simple UI action, takes effect immediately (new requests pick it
  up; in-flight requests are unaffected).
- When `shared` flips **off**, in-flight requests that chose this account finish; no
  forced disconnect.

## Alternatives considered

- **Always shared** — simpler but deters contributors worried about quota being drained.
- **Always private** — loses the network-effect benefit of pooling capacity, and the
  "resale" use case becomes impossible.
- **Per-key allowlist of accounts** — more granular but adds a many-to-many table and
  admin overhead. Revisit if we get a concrete need for it.
