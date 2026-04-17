import { eq } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { accounts, type Account } from '../../db/schema.js';
import {
  CLAUDE_MESSAGES_PATH,
  CLAUDE_UPSTREAM_BASE,
  claudeAuthHeaders,
} from '../oauth/claude.js';
import { ensureFreshAccessToken } from '../oauth/refresh.js';
import { applyClassification, classifyUpstream, type Classification } from './health.js';
import { getDispatcher } from '../proxies/index.js';
import { logger } from '../../utils/logger.js';

export interface ProbeResult {
  ok: boolean;
  status: number;
  classification: Classification['kind'];
  latencyMs: number;
  body?: string;
}

/**
 * Send a minimal /v1/messages request to Anthropic to classify the account.
 * Uses max_tokens=1 + a trivial prompt — cheap but exercises the auth path.
 *
 * Side-effect: applies the resulting classification to the DB row, and
 * stamps last_probe_at / last_probe_ok.
 */
export async function probeAccount(account: Account): Promise<ProbeResult> {
  const startedAt = Date.now();
  const accessToken = await ensureFreshAccessToken(account);
  if (!accessToken) {
    await stampProbe(account.id, false);
    return { ok: false, status: 0, classification: 'needs_reauth', latencyMs: 0 };
  }

  const dispatcher = await getDispatcher(account.proxyId);
  let res: Response;
  try {
    res = await fetch(`${CLAUDE_UPSTREAM_BASE}${CLAUDE_MESSAGES_PATH}`, {
      method: 'POST',
      headers: claudeAuthHeaders(accessToken),
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }],
      }),
      ...(dispatcher ? { dispatcher } : {}),
    } as RequestInit);
  } catch (err) {
    logger.warn({ err, accountId: account.id }, 'probe fetch failed');
    await stampProbe(account.id, false);
    return { ok: false, status: 0, classification: 'transient', latencyMs: Date.now() - startedAt };
  }
  const body = await res.text();
  const classification = classifyUpstream(res.status, res.headers.get('retry-after'), body);
  await Promise.all([
    applyClassification(account, classification),
    stampProbe(account.id, classification.kind === 'ok'),
  ]);
  return {
    ok: classification.kind === 'ok',
    status: res.status,
    classification: classification.kind,
    latencyMs: Date.now() - startedAt,
    body: classification.kind === 'ok' ? undefined : body.slice(0, 500),
  };
}

async function stampProbe(accountId: string, ok: boolean): Promise<void> {
  await db
    .update(accounts)
    .set({ lastProbeAt: new Date(), lastProbeOk: ok, updatedAt: new Date() })
    .where(eq(accounts.id, accountId));
}
