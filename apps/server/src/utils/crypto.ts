import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { env } from '../config/env.js';

const KEY = Buffer.from(env.ENCRYPTION_KEY, 'hex');
const ALG = 'aes-256-gcm';

export interface Sealed {
  nonce: string;
  ciphertext: string;
  tag: string;
}

export function seal(plaintext: string): Sealed {
  const nonce = randomBytes(12);
  const cipher = createCipheriv(ALG, KEY, nonce);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return {
    nonce: nonce.toString('base64'),
    ciphertext: enc.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
  };
}

export function open(sealed: Sealed): string {
  const decipher = createDecipheriv(ALG, KEY, Buffer.from(sealed.nonce, 'base64'));
  decipher.setAuthTag(Buffer.from(sealed.tag, 'base64'));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(sealed.ciphertext, 'base64')),
    decipher.final(),
  ]);
  return dec.toString('utf8');
}
