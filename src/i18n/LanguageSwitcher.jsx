import { LOCALES, useLocale } from "./index.jsx";

// Language selector for the public pages. Self-styled (inline) so it works on
// any page/theme without extra CSS. Renders a compact pill toggle for a couple
// of locales, and switches to a dropdown once there are enough (>3) that pills
// would overflow on small screens.
export default function LanguageSwitcher({ style }) {
  const { locale, setLocale, t } = useLocale();
  const codes = Object.keys(LOCALES);
  if (codes.length < 2) return null;

  if (codes.length > 3) {
    return (
      <select
        aria-label={t("common.language")}
        value={locale}
        onChange={(e) => setLocale(e.target.value)}
        style={{
          border: "none",
          cursor: "pointer",
          fontSize: 13,
          fontWeight: 600,
          lineHeight: 1,
          padding: "8px 30px 8px 14px",
          borderRadius: 999,
          color: "inherit",
          background:
            "rgba(0,0,0,0.06) url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23555' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E\") no-repeat right 12px center",
          backdropFilter: "blur(4px)",
          appearance: "none",
          WebkitAppearance: "none",
          MozAppearance: "none",
          ...style,
        }}
      >
        {codes.map((code) => (
          <option key={code} value={code}>
            {LOCALES[code].label}
          </option>
        ))}
      </select>
    );
  }

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
