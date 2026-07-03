/* eslint-disable react-refresh/only-export-components -- this module intentionally
   co-locates the LocaleProvider with its useLocale hook and message helpers. */
// ─── LIGHTWEIGHT I18N ─────────────────────────────────────────────────────────
// A tiny message-catalog i18n for the public pages (WeddingPage, RsvpPage).
// No dependency: a React context exposes { locale, setLocale, t }. `t(key, vars)`
// looks up the key in the active locale, falls back to English, then to the key
// itself, and interpolates {var} placeholders. Admin UI and emails are English.
import { createContext, useContext, useMemo, useState, useCallback } from "react";
import en from "./locales/en.js";
import zhTW from "./locales/zh-TW.js";

export const LOCALES = {
  en: { label: "EN", messages: en },
  "zh-TW": { label: "中文", messages: zhTW },
};
export const DEFAULT_LOCALE = "en";
const STORAGE_KEY = "wt_locale";

function readInitialLocale() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && LOCALES[stored]) return stored;
  } catch {
    /* localStorage may be unavailable (private mode) */
  }
  try {
    // Only auto-pick Traditional Chinese for Traditional locales (TW/HK/Hant);
    // Simplified (zh-CN, zh-SG, zh-Hans) falls through to English until we ship it.
    if (typeof navigator !== "undefined" && /^zh-(tw|hk|hant)\b/i.test(navigator.language || "")) {
      return "zh-TW";
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_LOCALE;
}

// Interpolate {name} placeholders from `vars`.
function interpolate(str, vars) {
  if (!vars || typeof str !== "string") return str;
  return str.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

// Resolve a key against a locale, falling back to English, then the key.
export function translate(locale, key, vars) {
  const active = LOCALES[locale]?.messages;
  const raw =
    (active && active[key] != null ? active[key] : undefined) ??
    (en[key] != null ? en[key] : undefined) ??
    key;
  return interpolate(raw, vars);
}

const LocaleContext = createContext({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  t: (key, vars) => translate(DEFAULT_LOCALE, key, vars),
});

export function LocaleProvider({ children }) {
  const [locale, setLocaleState] = useState(readInitialLocale);

  const setLocale = useCallback((next) => {
    if (!LOCALES[next]) return;
    setLocaleState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore persistence failures */
    }
  }, []);

  const value = useMemo(
    () => ({ locale, setLocale, t: (key, vars) => translate(locale, key, vars) }),
    [locale, setLocale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  return useContext(LocaleContext);
}
