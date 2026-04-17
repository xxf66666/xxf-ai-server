import type { Metadata } from 'next';
import { Providers } from '../lib/providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'xxf-ai-server — admin',
  description: 'AI relay gateway admin console',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
