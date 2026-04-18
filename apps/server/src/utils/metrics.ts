import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

export const registry = new Registry();
collectDefaultMetrics({ register: registry });

export const relayRequests = new Counter({
  name: 'xxf_relay_requests_total',
  help: 'Total upstream relay requests, labeled by provider, route and outcome.',
  labelNames: ['provider', 'route', 'outcome'],
  registers: [registry],
});

export const relayLatencyMs = new Histogram({
  name: 'xxf_relay_latency_ms',
  help: 'Latency (ms) from gateway receiving the request to upstream finishing.',
  labelNames: ['provider', 'route'],
  buckets: [25, 50, 100, 250, 500, 1000, 2500, 5000, 10_000, 30_000, 60_000],
  registers: [registry],
});

export const relayTokens = new Counter({
  name: 'xxf_relay_tokens_total',
  help: 'Total tokens consumed via the relay, by provider and direction.',
  labelNames: ['provider', 'direction'],
  registers: [registry],
});

export const accountStatus = new Gauge({
  name: 'xxf_accounts_by_status',
  help: 'Number of upstream accounts in each status bucket.',
  labelNames: ['status'],
  registers: [registry],
});

export const circuitOpen = new Gauge({
  name: 'xxf_circuit_open',
  help: 'Whether the per-provider circuit breaker is currently open (1) or closed (0).',
  labelNames: ['provider'],
  registers: [registry],
});

export const billingDebitFailures = new Counter({
  name: 'xxf_billing_debit_failed_total',
  help: 'Count of debit_failed events — billed requests whose balance debit did NOT persist. Watch for drift and reconcile.',
  registers: [registry],
});
