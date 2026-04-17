import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'xxf-ai-server — admin',
  description: 'AI relay gateway admin console',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background antialiased">{children}</body>
    </html>
  );
}
