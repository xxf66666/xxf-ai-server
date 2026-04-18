// Provider brand marks. We intentionally use simplified, stylized
// shapes rather than verbatim reproductions of Anthropic / OpenAI
// trademarks — enough visual identity to signal provenance without
// confusingly passing as official.

export function ProviderIcon({
  provider,
  size = 20,
  className = '',
}: {
  provider: 'claude' | 'openai' | string;
  size?: number;
  className?: string;
}) {
  if (provider === 'claude') {
    return (
      <svg
        viewBox="0 0 32 32"
        width={size}
        height={size}
        className={className}
        aria-label="Anthropic / Claude"
      >
        <defs>
          <linearGradient id="claudeG" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#e09a6a" />
            <stop offset="100%" stopColor="#c86a3f" />
          </linearGradient>
        </defs>
        {/* Stylized 8-pointed starburst suggestive of Anthropic's asterisk */}
        <g fill="url(#claudeG)">
          <path d="M16 3 L17.8 12.5 L16 12.5 L14.2 12.5 Z" />
          <path d="M16 29 L14.2 19.5 L16 19.5 L17.8 19.5 Z" />
          <path d="M3 16 L12.5 14.2 L12.5 16 L12.5 17.8 Z" />
          <path d="M29 16 L19.5 17.8 L19.5 16 L19.5 14.2 Z" />
          <path d="M6.6 6.6 L13.2 13.2 L13.2 13.2 L11.9 11.9 Z" transform="rotate(0 16 16)" />
          <circle cx="16" cy="16" r="4.5" />
        </g>
      </svg>
    );
  }
  if (provider === 'openai') {
    return (
      <svg
        viewBox="0 0 32 32"
        width={size}
        height={size}
        className={className}
        aria-label="OpenAI"
      >
        {/* Simplified hexagonal knot */}
        <g fill="none" stroke="#10a37f" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 4 L26 10 L26 22 L16 28 L6 22 L6 10 Z" />
          <path d="M16 11 L21 14 L21 20 L16 23 L11 20 L11 14 Z" opacity="0.7" />
        </g>
      </svg>
    );
  }
  return (
    <div
      className={`rounded-full bg-muted ${className}`}
      style={{ width: size, height: size }}
      aria-label={provider}
    />
  );
}
