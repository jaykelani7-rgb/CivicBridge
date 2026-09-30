"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { publicMessages, type PublicLocale, type PublicMessageKey } from "@/lib/i18n/public-messages";
import { StaticUiLocalizer } from "./static-ui-localizer";

const localeStorageKey = "civicbridge:ui-locale";
type LocaleContextValue = { locale: PublicLocale; setLocale: (locale: PublicLocale) => void; t: (key: PublicMessageKey) => string };
const LocaleContext = createContext<LocaleContextValue | null>(null);

export function PublicLocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<PublicLocale>("en");
  useEffect(() => {
    const stored = window.localStorage.getItem(localeStorageKey);
    if (stored !== "hi" && stored !== "pt") return;
    const timer = window.setTimeout(() => setLocaleState(stored), 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale === "hi" ? "hi" : locale === "pt" ? "pt-BR" : "en";
  }, [locale]);

  function setLocale(nextLocale: PublicLocale) {
    window.localStorage.setItem(localeStorageKey, nextLocale);
    setLocaleState(nextLocale);
  }

  const value = useMemo<LocaleContextValue>(() => ({
    locale,
    setLocale,
    t: (key) => publicMessages[locale][key] ?? publicMessages.en[key],
  }), [locale]);
  return <LocaleContext.Provider value={value}><StaticUiLocalizer locale={locale}/>{children}</LocaleContext.Provider>;
}

export function usePublicLocale() {
  const value = useContext(LocaleContext);
  if (!value) throw new Error("usePublicLocale must be used inside PublicLocaleProvider");
  return value;
}
