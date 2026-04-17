# ADR 0001 — Use OAuth (Claude Code / Codex CLI) rather than web-interface scraping

- **Status:** Accepted
- **Date:** 2026-04-17
- **Deciders:** xxf

## Context

To aggregate Claude Pro / Max and ChatGPT Plus / Pro subscriptions and re-expose them as
a unified API, we need a transport that can talk to the upstream provider *on behalf of*
the subscriber. Two paths exist:

1. **Web scraping** — drive `claude.ai` / `chatgpt.com` as a headless browser session,
   maintain cookies, bypass Cloudflare challenges, parse HTML / WS frames.
2. **OAuth via first-party CLIs** — the same OAuth flow Claude Code and Codex CLI use to
   authenticate their API calls. The resulting access token can be used against upstream
   API endpoints that return structured JSON / SSE.

## Decision

Use the **OAuth path**. Ship no scraper.

## Consequences

**Positive**

- Responses are already structured (same shape as the public API). No HTML parsing
  fragility.
- SSE streaming is native and stable — no wrestling with WS framing or chunked HTML.
- Token lifecycle is explicit and refreshable — no cookie jar complexity, no CF clearance
  loop.
- Surface area for detection is smaller; the upstream sees something that looks like its
  own first-party client.

**Negative**

- Tied to the OAuth app registrations used by those CLIs. If upstream revokes or rotates
  that `client_id`, we must follow.
- The subset of models and features may lag the web interface slightly.
- Still outside ToS for aggregation — see [security.md](../security.md). OAuth is *not* a
  compliance fix; it is a stability fix.

## Alternatives considered

- **Web scraping** — rejected primarily for operational cost; every provider UI change is
  an outage. Secondarily because concurrent headless Chromium is expensive.
- **Official API keys with subscriber reimbursement** — rejected by user: the whole point
  of this gateway is to avoid API-pricing economics.
