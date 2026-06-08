// ─── FORMATTING ───────────────────────────────────────────────────────────────
export const formatTime = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};
