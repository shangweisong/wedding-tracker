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
import zhCN from "./locales/zh-CN.js";
import ms from "./locales/ms.js";
import ja from "./locales/ja.js";
import ko from "./locales/ko.js";

// The single source of truth for supported locales. `label` is the native name
// shown in the LanguageSwitcher; add a locale here + a matching catalog under
// ./locales and it appears everywhere automatically (parity enforced by tests).
export const LOCALES = {
  en: { label: "English", messages: en },
  "zh-TW": { label: "繁體中文", messages: zhTW },
  "zh-CN": { label: "简体中文", messages: zhCN },
  ms: { label: "Bahasa Melayu", messages: ms },
  ja: { label: "日本語", messages: ja },
  ko: { label: "한국어", messages: ko },
};
export const DEFAULT_LOCALE = "en";
const STORAGE_KEY = "wt_locale";

// Best-effort map from the browser's language tag to one of our locales.
// Returns null when nothing sensible matches (caller falls back to English).
function sniffNavigatorLocale() {
  if (typeof navigator === "undefined") return null;
  const lang = (navigator.language || "").toLowerCase();
  if (/^zh-(tw|hk|mo|hant)\b/.test(lang)) return "zh-TW";
  if (/^zh\b/.test(lang)) return "zh-CN"; // zh, zh-cn, zh-sg, zh-hans → Simplified
  if (/^(ms|id)\b/.test(lang)) return "ms"; // Malay (Indonesian is close enough)
  if (/^ja\b/.test(lang)) return "ja";
  if (/^ko\b/.test(lang)) return "ko";
  return null;
}

function readInitialLocale() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && LOCALES[stored]) return stored;
  } catch {
    /* localStorage may be unavailable (private mode) */
  }
  try {
    const sniffed = sniffNavigatorLocale();
    if (sniffed && LOCALES[sniffed]) return sniffed;
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
