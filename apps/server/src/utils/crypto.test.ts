import { describe, expect, it } from 'vitest';
import { open, seal } from './crypto.js';

describe('crypto.seal / crypto.open (AES-256-GCM)', () => {
  it('round-trips arbitrary text', () => {
    const plaintext = 'sk-ant-oat01-this-is-a-real-token-lookalike';
    const sealed = seal(plaintext);
    expect(open(sealed)).toBe(plaintext);
  });

  it('produces a different nonce + ciphertext each call (non-deterministic)', () => {
    const a = seal('secret');
    const b = seal('secret');
    expect(a.nonce).not.toBe(b.nonce);
    expect(a.ciphertext).not.toBe(b.ciphertext);
    // Both still open to the same plaintext.
    expect(open(a)).toBe('secret');
    expect(open(b)).toBe('secret');
  });

  it('rejects a corrupted ciphertext (auth tag mismatch)', () => {
    const sealed = seal('secret');
    const tampered = { ...sealed, ciphertext: flipByteBase64(sealed.ciphertext) };
    expect(() => open(tampered)).toThrow();
  });

  it('rejects a swapped auth tag', () => {
    const sealed = seal('secret');
    const tampered = { ...sealed, tag: flipByteBase64(sealed.tag) };
    expect(() => open(tampered)).toThrow();
  });

  it('handles empty string', () => {
    const sealed = seal('');
    expect(open(sealed)).toBe('');
  });
});

function flipByteBase64(s: string): string {
  const buf = Buffer.from(s, 'base64');
  buf[0] = buf[0]! ^ 0x01;
  return buf.toString('base64');
}
