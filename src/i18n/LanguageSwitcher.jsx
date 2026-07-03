import { LOCALES, useLocale } from "./index.jsx";

// A compact EN | 中文 toggle for the public pages. Self-styled (inline) so it
// works on any page/theme without extra CSS.
export default function LanguageSwitcher({ style }) {
  const { locale, setLocale, t } = useLocale();
  const codes = Object.keys(LOCALES);
  if (codes.length < 2) return null;

  return (
    <div
      role="group"
      aria-label={t("common.language")}
      style={{
        display: "inline-flex",
        gap: 2,
        padding: 3,
        borderRadius: 999,
        background: "rgba(0,0,0,0.06)",
        backdropFilter: "blur(4px)",
        ...style,
      }}
    >
      {codes.map((code) => {
        const active = code === locale;
        return (
          <button
            key={code}
            type="button"
            onClick={() => setLocale(code)}
            aria-pressed={active}
            style={{
              border: "none",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
              lineHeight: 1,
              padding: "6px 12px",
              borderRadius: 999,
              color: active ? "#fff" : "inherit",
              background: active ? "rgba(0,0,0,0.55)" : "transparent",
              transition: "background 0.15s, color 0.15s",
            }}
          >
            {LOCALES[code].label}
          </button>
        );
      })}
    </div>
  );
}
