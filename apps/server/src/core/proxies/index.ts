import { eq } from 'drizzle-orm';
import { ProxyAgent } from 'undici';
import type { Dispatcher } from 'undici';
import { db } from '../../db/client.js';
import { proxies, type Proxy } from '../../db/schema.js';

// Cache ProxyAgent instances per proxy row so we reuse connections. The
// agent is rebuilt when the proxy URL changes — admin CRUD invalidates
// explicitly via `invalidateDispatcher`.
const cache = new Map<string, { url: string; agent: ProxyAgent }>();

export async function listProxies(): Promise<Proxy[]> {
  return db.select().from(proxies);
}

export async function createProxy(input: {
  label: string;
  url: string;
  region?: string | null;
  maxConcurrency?: number;
}): Promise<Proxy> {
  const [row] = await db
    .insert(proxies)
    .values({
      label: input.label,
      url: input.url,
      region: input.region ?? null,
      maxConcurrency: input.maxConcurrency ?? 4,
    })
    .returning();
  if (!row) throw new Error('failed to insert proxy');
  return row;
}

export async function updateProxy(
  id: string,
  patch: Partial<Pick<Proxy, 'label' | 'url' | 'region' | 'maxConcurrency' | 'enabled'>>,
): Promise<void> {
  await db.update(proxies).set(patch).where(eq(proxies.id, id));
  cache.delete(id);
}

export async function deleteProxy(id: string): Promise<void> {
  await db.delete(proxies).where(eq(proxies.id, id));
  cache.delete(id);
}

/**
 * Returns a Dispatcher for the given proxy id. Returns null if the proxy
 * isn't found or is disabled (caller should fall back to the global
 * dispatcher, i.e. direct / env proxy).
 */
export async function getDispatcher(proxyId: string | null): Promise<Dispatcher | null> {
  if (!proxyId) return null;
  const cached = cache.get(proxyId);
  const rows = await db.select().from(proxies).where(eq(proxies.id, proxyId)).limit(1);
  const row = rows[0];
  if (!row || !row.enabled) {
    cache.delete(proxyId);
    return null;
  }
  if (cached && cached.url === row.url) return cached.agent;
  const agent = new ProxyAgent(row.url);
  cache.set(proxyId, { url: row.url, agent });
  return agent;
}

export function invalidateDispatcher(proxyId: string): void {
  cache.delete(proxyId);
}
