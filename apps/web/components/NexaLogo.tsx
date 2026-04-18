import { memo } from 'react';
import { Instrument_Serif } from 'next/font/google';

const wordmarkFont = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  style: 'italic',
  display: 'swap',
});

interface NexaLogoProps {
  size?: number;
  className?: string;
  withWordmark?: boolean;
}

// Monochrome mark: black rounded square with an italic-leaning white "N".
// Paired wordmark uses Instrument Serif Italic for a display-serif feel
// that contrasts with Inter body text.
export const NexaLogo = memo(function NexaLogo({
  size = 28,
  className,
  withWordmark = false,
}: NexaLogoProps) {
  const mark = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="7.5" fill="#0A0F1E" />
      <g fill="#ffffff" transform="translate(1.5 0) skewX(-6)">
        <rect x="9" y="8" width="3.5" height="16" />
        <rect x="19.5" y="8" width="3.5" height="16" />
        <path d="M 12.5 8 L 16 8 L 23 24 L 19.5 24 Z" />
      </g>
    </svg>
  );

  if (!withWordmark) {
    return <span className={className}>{mark}</span>;
  }
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ''}`}>
      {mark}
      <span
        className={`${wordmarkFont.className} tracking-tight`}
        style={{ fontSize: size * 0.95, lineHeight: 1 }}
      >
        Nexa
      </span>
    </span>
  );
});
