'use client';

import { useT } from '../lib/i18n/context';
import type { DictKey } from '../lib/i18n/dict';

// Crude heuristic strength — just enough signal for users to avoid the
// single-word/single-number passwords. 0-4.
export function scoreStrength(pw: string): number {
  if (!pw || pw.length < 4) return 0;
  let s = 0;
  if (pw.length >= 8) s += 1;
  if (pw.length >= 12) s += 1;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s += 1;
  if (/\d/.test(pw)) s += 1;
  if (/[^a-zA-Z0-9]/.test(pw)) s += 1;
  return Math.min(4, s);
}

const COLORS = [
  'bg-muted',
  'bg-red-500',
  'bg-amber-500',
  'bg-sky-500',
  'bg-emerald-500',
];
const LABELS: DictKey[] = [
  'pwStrength.none',
  'pwStrength.weak',
  'pwStrength.fair',
  'pwStrength.good',
  'pwStrength.strong',
];

export function PasswordStrength({ password }: { password: string }) {
  const t = useT();
  const score = scoreStrength(password);
  return (
    <div className="mt-1">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full ${i <= score ? COLORS[score]! : 'bg-muted'}`}
          />
        ))}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        {password.length === 0 ? t('pwStrength.hint') : t(LABELS[score]!)}
      </div>
    </div>
  );
}
