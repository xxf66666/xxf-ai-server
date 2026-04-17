// Token-at-rest helpers: wrap AES-GCM seal/open into opaque strings so
// callers don't have to know about the envelope shape.
import { open, seal } from '../../utils/crypto.js';

export function sealToken(plaintext: string): string {
  const envelope = seal(plaintext);
  return [envelope.nonce, envelope.ciphertext, envelope.tag].join('.');
}

export function openToken(stored: string): string {
  const [nonce, ciphertext, tag] = stored.split('.');
  if (!nonce || !ciphertext || !tag) {
    throw new Error('invalid sealed token format');
  }
  return open({ nonce, ciphertext, tag });
}
