'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { en, zh, type Dict, type DictKey } from './dict';

export type Locale = 'en' | 'zh';
export const LOCALES: readonly Locale[] = ['en', 'zh'] as const;

const dicts: Record<Locale, Dict> = { en, zh };
const STORAGE_KEY = 'xxf-admin-locale';

interface I18nContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: DictKey, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function detectInitialLocale(): Locale {
  if (typeof window === 'undefined') return 'en';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === 'zh' || stored === 'en') return stored;
  const nav = window.navigator.language?.toLowerCase() ?? '';
  return nav.startsWith('zh') ? 'zh' : 'en';
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  // Render English on SSR to match server output; flip to the detected
  // locale after mount to avoid hydration mismatch warnings.
  const [locale, setLocaleState] = useState<Locale>('en');

  useEffect(() => {
    setLocaleState(detectInitialLocale());
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, l);
  }, []);

  const t = useCallback(
    (key: DictKey, params?: Record<string, string | number>) => {
      const template = dicts[locale][key] ?? dicts.en[key] ?? key;
      if (!params) return template;
      return template.replace(/\{(\w+)\}/g, (_, k: string) =>
        params[k] !== undefined ? String(params[k]) : `{${k}}`,
      );
    },
    [locale],
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>');
  return ctx;
}

export function useT() {
  return useI18n().t;
}
