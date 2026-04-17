'use client';

import { useI18n, LOCALES } from './context';

const LABEL: Record<(typeof LOCALES)[number], string> = {
  en: 'EN',
  zh: '中',
};

export function LocaleSwitcher() {
  const { locale, setLocale } = useI18n();
  return (
    <div className="flex overflow-hidden rounded-md border border-border text-xs">
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLocale(l)}
          className={`px-2 py-1 ${
            l === locale ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'
          }`}
          aria-pressed={l === locale}
        >
          {LABEL[l]}
        </button>
      ))}
    </div>
  );
}
