import { EnvHttpProxyAgent, setGlobalDispatcher } from 'undici';
import { logger } from './logger.js';

/**
 * Wire up an outbound HTTP proxy for Node's native fetch.
 * Honors HTTPS_PROXY / HTTP_PROXY / NO_PROXY (and lowercase variants),
 * which is the Unix convention. Called once at boot.
 *
 * Motivation: when the server runs behind a firewall that requires a
 * forward proxy to reach api.anthropic.com, native `fetch` needs an
 * explicit dispatcher — there is no automatic env-based routing.
 */
export function installOutboundProxy(): void {
  const any = Boolean(
    process.env.HTTPS_PROXY ||
      process.env.https_proxy ||
      process.env.HTTP_PROXY ||
      process.env.http_proxy,
  );
  if (!any) return;
  setGlobalDispatcher(new EnvHttpProxyAgent());
  logger.info(
    {
      HTTPS_PROXY: process.env.HTTPS_PROXY ?? process.env.https_proxy ?? null,
      HTTP_PROXY: process.env.HTTP_PROXY ?? process.env.http_proxy ?? null,
      NO_PROXY: process.env.NO_PROXY ?? process.env.no_proxy ?? null,
    },
    'outbound proxy dispatcher installed',
  );
}
