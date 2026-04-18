// Matches the client-side PasswordStrength meter: returns 0–4. ≥ 2 is the
// minimum we accept. The server runs this too so register / reset / admin
// set / console change all enforce the same bar — the web meter alone is
// hint, not gate.

export function scorePasswordStrength(pw: string): number {
  if (pw.length < 8) return 0;
  let score = 0;
  if (/[a-z]/.test(pw)) score += 1;
  if (/[A-Z]/.test(pw)) score += 1;
  if (/[0-9]/.test(pw)) score += 1;
  if (/[^a-zA-Z0-9]/.test(pw)) score += 1;
  if (pw.length >= 12) score += 1;
  return Math.min(4, score);
}

export function isStrongEnough(pw: string): boolean {
  return scorePasswordStrength(pw) >= 2;
}
