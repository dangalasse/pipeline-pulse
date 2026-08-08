import { useCallback, useEffect, useState } from 'react';
import { type Locale, copyFor, isEnglish, normalizeLocale } from '../i18n';

const STORAGE_KEY = 'pipeview-locale';

function readQueryLocale(): Locale | null {
  if (typeof window === 'undefined') return null;
  const raw = new URLSearchParams(window.location.search).get('lang');
  return raw ? normalizeLocale(raw) : null;
}

function readStoredLocale(): Locale | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? normalizeLocale(raw) : null;
}

function resolveInitialLocale(): Locale {
  return readQueryLocale() ?? readStoredLocale() ?? 'pt-BR';
}

export function useLocale() {
  const [locale, setLocaleState] = useState<Locale>(resolveInitialLocale);
  const t = copyFor(locale);
  const otherLocale: Locale = isEnglish(locale) ? 'pt-BR' : 'en-US';
  const otherLabel = isEnglish(locale) ? t.localePt : t.localeEn;
  const currentLabel = isEnglish(locale) ? t.localeEn : t.localePt;

  useEffect(() => {
    document.documentElement.lang = locale;
    localStorage.setItem(STORAGE_KEY, locale);
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(normalizeLocale(next));
  }, []);

  const toggleHref = `/?lang=${otherLocale}`;

  return {
    locale,
    setLocale,
    t,
    otherLocale,
    otherLabel,
    currentLabel,
    toggleHref,
  };
}
