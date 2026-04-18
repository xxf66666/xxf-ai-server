import { Secret, TOTP } from 'otpauth';
import { seal, open, type Sealed } from '../../utils/crypto.js';

const ISSUER = 'Nexa';

// 2FA secret is AES-GCM-sealed at rest (same envelope format as OAuth
// tokens). The Sealed object is JSON.stringify'd into users.totp_secret.
export function encodeSealed(s: Sealed): string {
  return JSON.stringify(s);
}

export function decodeSealed(raw: string): Sealed | null {
  try {
    return JSON.parse(raw) as Sealed;
  } catch {
    return null;
  }
}

export function generateTotpSecret(): { base32: string; storedValue: string } {
  // otpauth's Secret() picks 20 random bytes and gives a base32 view.
  const sec = new Secret({ size: 20 });
  return { base32: sec.base32, storedValue: encodeSealed(seal(sec.base32)) };
}

export function totpUri(email: string, base32: string): string {
  const totp = new TOTP({
    issuer: ISSUER,
    label: email,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: Secret.fromBase32(base32),
  });
  return totp.toString(); // otpauth://totp/... URI suitable for a QR code
}

export function verifyTotp(storedSealedValue: string, code: string): boolean {
  const sealed = decodeSealed(storedSealedValue);
  if (!sealed) return false;
  let base32: string;
  try {
    base32 = open(sealed);
  } catch {
    return false;
  }
  const totp = new TOTP({
    issuer: ISSUER,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: Secret.fromBase32(base32),
  });
  // window: ±1 step (±30s) to tolerate clock skew but reject replays > 1 minute off.
  const delta = totp.validate({ token: code.replace(/\s+/g, ''), window: 1 });
  return delta !== null;
}
