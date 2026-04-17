import argon2 from 'argon2';

// Defaults calibrated to ~100ms on modern hardware. Tune via ARGON2_* env
// if we ever need to slow down for security or speed up for tests.
const ARGON2_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 19456, // 19 MiB (OWASP minimum)
  timeCost: 2,
  parallelism: 1,
};

export async function hashPassword(plaintext: string): Promise<string> {
  return argon2.hash(plaintext, ARGON2_OPTIONS);
}

export async function verifyPassword(hash: string, plaintext: string): Promise<boolean> {
  if (!hash || hash === '!' || !hash.startsWith('$argon2')) return false;
  try {
    return await argon2.verify(hash, plaintext);
  } catch {
    return false;
  }
}
