'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useT } from '../lib/i18n/context';
import { MarketingHeader } from './MarketingHeader';
import { MarketingFooter } from './MarketingFooter';

export function DocLayout({ title, children }: { title: string; children: React.ReactNode }) {
  const t = useT();
  return (
    <main className="min-h-screen bg-background">
      <MarketingHeader active="docs" />
      <article className="container mx-auto max-w-3xl space-y-6 px-4 py-10">
        <div>
          <Link
            href={'/docs' as never}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" />
            {t('docs.title')}
          </Link>
          <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">{title}</h1>
        </div>
        <div className="doc-body space-y-5 text-sm leading-relaxed">{children}</div>
      </article>
      <MarketingFooter />
    </main>
  );
}

export function Code({ children }: { children: React.ReactNode }) {
  return (
    <pre className="overflow-x-auto rounded-md bg-muted px-4 py-3 font-mono text-xs leading-relaxed">
      <code>{children}</code>
    </pre>
  );
}

export function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-8 text-xl font-semibold">{children}</h2>;
}

export function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="mt-6 text-base font-semibold">{children}</h3>;
}
