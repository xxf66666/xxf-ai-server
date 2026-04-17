import { describe, expect, it } from 'vitest';
import { openToken, sealToken } from './token.js';

describe('sealToken / openToken', () => {
  it('round-trips', () => {
    const plaintext = 'sk-ant-oat01-abc.def.ghi+/=';
    const stored = sealToken(plaintext);
    expect(openToken(stored)).toBe(plaintext);
  });

  it('stores as three dot-separated base64 segments', () => {
    const stored = sealToken('hello');
    const parts = stored.split('.');
    expect(parts).toHaveLength(3);
    for (const p of parts) expect(p.length).toBeGreaterThan(0);
  });

  it('rejects malformed envelope', () => {
    expect(() => openToken('not-valid')).toThrow();
    expect(() => openToken('a.b')).toThrow();
  });
});
