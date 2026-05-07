import type { Metadata } from 'next';
import Script from 'next/script';

export const metadata: Metadata = {
  title: 'API Reference — Nexa',
  description:
    'Interactive Nexa Gateway API reference. OpenAI- and Anthropic-compatible relay endpoints, public catalog, and console schemas.',
};

// Scalar API Reference (https://github.com/scalar/scalar) loaded as a
// standalone UMD bundle from jsDelivr. The bundle auto-initializes
// when it sees a <script id="api-reference" type="application/json">
// holding its config + a <div id="api-reference"> mount target. We
// keep the standard Nexa header/footer off this page so the
// generated TOC + search are the only navigation; a tiny "← Nexa"
// pill in the top-right is the way out.
const SCALAR_CONFIG = {
  url: '/openapi.json',
  theme: 'default',
  layout: 'modern',
  hideTestRequestButton: false,
  defaultHttpClient: { targetKey: 'shell', clientKey: 'curl' },
  customCss: `
    :root {
      --scalar-color-1: #0a0f1e;
      --scalar-color-accent: #6366f1;
      --scalar-font: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
    }
  `.replace(/\s+/g, ' '),
};

export default function ApiReferencePage() {
  return (
    <div className="relative min-h-screen bg-background">
      <a
        href="/"
        className="absolute right-4 top-4 z-50 rounded-md border border-border bg-background/80 px-3 py-1.5 text-xs font-medium backdrop-blur hover:bg-background"
      >
        ← Nexa
      </a>
      <Script
        id="api-reference"
        type="application/json"
        // Config lives in the script's text body, parsed by Scalar at boot.
        // dangerouslySetInnerHTML is fine here — JSON.stringify guarantees
        // there's no breakout from a <script type="application/json"> block.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(SCALAR_CONFIG) }}
      />
      <Script
        src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"
        strategy="afterInteractive"
      />
    </div>
  );
}
