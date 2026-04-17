import { describe, expect, it, vi } from 'vitest';
import { classifyUpstream } from './health.js';

describe('classifyUpstream', () => {
  it('classifies 2xx as ok', () => {
    expect(classifyUpstream(200, null, '').kind).toBe('ok');
    expect(classifyUpstream(204, null, '').kind).toBe('ok');
    expect(classifyUpstream(299, null, '').kind).toBe('ok');
  });

  it('classifies 429 as rate_limited using Retry-After seconds', () => {
    vi.useFakeTimers();
    const now = new Date('2026-04-17T14:00:00Z');
    vi.setSystemTime(now);
    const result = classifyUpstream(429, '120', 'too fast');
    expect(result.kind).toBe('rate_limited');
    if (result.kind !== 'rate_limited') throw new Error();
    expect(result.coolingUntil.getTime() - now.getTime()).toBe(120_000);
    vi.useRealTimers();
  });

  it('classifies 429 without Retry-After using a default', () => {
    vi.useFakeTimers();
    const now = new Date('2026-04-17T14:00:00Z');
    vi.setSystemTime(now);
    const result = classifyUpstream(429, null, '');
    expect(result.kind).toBe('rate_limited');
    if (result.kind !== 'rate_limited') throw new Error();
    // Default is 5 minutes; allow off-by-one in the helper.
    const deltaMs = result.coolingUntil.getTime() - now.getTime();
    expect(deltaMs).toBeGreaterThanOrEqual(60_000);
    expect(deltaMs).toBeLessThanOrEqual(10 * 60_000);
    vi.useRealTimers();
  });

  it('classifies 401 as needs_reauth', () => {
    expect(classifyUpstream(401, null, '').kind).toBe('needs_reauth');
  });

  it('classifies 403 with suspension-like body as banned', () => {
    expect(classifyUpstream(403, null, 'account suspended for abuse').kind).toBe('banned');
    expect(classifyUpstream(403, null, 'Your access has been terminated.').kind).toBe('banned');
    expect(classifyUpstream(403, null, 'policy_abuse_detected').kind).toBe('banned');
  });

  it('classifies 403 with a generic body as needs_reauth, not banned', () => {
    expect(classifyUpstream(403, null, 'insufficient scope').kind).toBe('needs_reauth');
  });

  it('classifies 5xx as transient (leave account active)', () => {
    expect(classifyUpstream(500, null, '').kind).toBe('transient');
    expect(classifyUpstream(502, null, '').kind).toBe('transient');
    expect(classifyUpstream(503, null, '').kind).toBe('transient');
  });
});
