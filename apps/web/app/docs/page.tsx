'use client';

import Link from 'next/link';
import { BookOpen, Box, Code2, Terminal } from 'lucide-react';
import { useT } from '../../lib/i18n/context';
import { MarketingHeader } from '../../components/MarketingHeader';
import { MarketingFooter } from '../../components/MarketingFooter';
import type { DictKey } from '../../lib/i18n/dict';

interface Card {
  href: string;
  icon: typeof BookOpen;
  titleKey: DictKey;
  descKey: DictKey;
}

const cards: Card[] = [
  { href: '/docs/claude-code', icon: Terminal, titleKey: 'docs.index.cc.title', descKey: 'docs.index.cc.desc' },
  { href: '/docs/cline', icon: Code2, titleKey: 'docs.index.cline.title', descKey: 'docs.index.cline.desc' },
  { href: '/docs/cursor', icon: Box, titleKey: 'docs.index.cursor.title', descKey: 'docs.index.cursor.desc' },
  { href: '/docs/api', icon: BookOpen, titleKey: 'docs.index.api.title', descKey: 'docs.index.api.desc' },
];

export default function DocsIndex() {
  const t = useT();
  return (
    <main className="min-h-screen bg-background">
      <MarketingHeader active="docs" />
      <section className="container mx-auto max-w-5xl px-4 py-12">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{t('docs.title')}</h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground">{t('docs.subtitle')}</p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {cards.map((c) => {
            const Icon = c.icon;
            return (
              <Link
                key={c.href}
                href={c.href as never}
                className="group block rounded-xl border border-border bg-background p-6 transition-shadow hover:shadow-md"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-lg font-semibold">{t(c.titleKey)}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{t(c.descKey)}</p>
                <div className="mt-3 text-sm text-primary opacity-0 transition-opacity group-hover:opacity-100">
                  {t('docs.read')} →
                </div>
              </Link>
            );
          })}
        </div>
      </section>
      <MarketingFooter />
    </main>
  );
}
