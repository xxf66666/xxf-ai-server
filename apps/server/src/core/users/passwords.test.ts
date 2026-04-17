import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './passwords.js';

describe('hashPassword / verifyPassword', () => {
  it('verifies the right password', async () => {
    const hash = await hashPassword('s0m3-s3cur3-p4ss');
    expect(hash.startsWith('$argon2id')).toBe(true);
    expect(await verifyPassword(hash, 's0m3-s3cur3-p4ss')).toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await hashPassword('right');
    expect(await verifyPassword(hash, 'wrong')).toBe(false);
  });

  it('rejects the sentinel hash `!`', async () => {
    expect(await verifyPassword('!', 'anything')).toBe(false);
  });

  it('rejects an empty stored hash', async () => {
    expect(await verifyPassword('', 'anything')).toBe(false);
  });

  it('returns false on a malformed stored hash instead of throwing', async () => {
    expect(await verifyPassword('not-a-real-hash', 'x')).toBe(false);
  });
});
