import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { sb, isDemoMode } from "../lib/supabase.js";
import { theme } from "../shared/theme.js";
import { useLocale } from "../i18n/index.jsx";
import { localizeWedding } from "../i18n/content.js";
import { sanitizeThemeTokens, isCompleteThemeTokens, themeTokenStyle } from "../lib/themeTokens.js";
import { normalizeSectionPhotos } from "../lib/sectionPhotos.js";
import LanguageSwitcher from "../i18n/LanguageSwitcher.jsx";

// Maps a fun-fact id to the i18n key for its fallback question (used only when
// the couple didn't supply their own question text).
const FUN_QUESTION_KEYS = {
  how_met:     "wedding.funq.meet",
  proposal:    "wedding.funq.proposal",
  first_ily:   "wedding.funq.iloveyou",
  best_cook:   "wedding.funq.cook",
  funnier:     "wedding.funq.funnier",
  fiercer:     "wedding.funq.fiercer",
  best_memory: "wedding.funq.memory",
  first_date:  "wedding.funq.firstdate",
};

const DEMO_WEDDING = {
  bride_name: "Siew Yong",
  groom_name: "Wei Ming",
  wedding_date: "2026-12-27",
  venue_name: "The Grand Ballroom",
  venue_address: "123 Orchard Road, Singapore 238858",
  ceremony_time: "14:00",
  dinner_time: "19:00",
  tea_ceremony_time: "10:00",
  slug: "wei-ming-and-siew-yong",
  love_story: "We met at a mutual friend's birthday party in 2019. Wei Ming spilled a drink on Siew Yong's dress and offered to buy her dinner to apologise. She said yes, mostly for the free food. Five years later, here we are.",
  dress_code: "Smart Casual — think garden party chic!",
  hero_image_url: "",
  fun_qa: [
    { id: "who_proposed", answer: "Wei Ming proposed at Botanic Gardens, fumbling the ring box for a full 30 seconds while Siew Yong pretended not to notice." },
    { id: "best_cook",    answer: "Wei Ming cooks, Siew Yong eats. This is a system that works." },
    { id: "funnier",      answer: "Siew Yong tells the jokes. Wei Ming laughs at his own jokes." },
    { id: "fiercer",      answer: "100% Siew Yong. Wei Ming has never won an argument." },
  ],
  rsvp_deadline: "2026-10-31",
  is_published: true,
  meal_options: "Chicken,Fish,Vegetarian",
  getting_there: "By MRT: Alight at Orchard MRT (NS22 / TE14), take Exit B and walk 5 minutes along Orchard Road.\n\nBy car: Parking available at the hotel basement. Enter via Orchard Road. First 2 hours complimentary for wedding guests.\n\nDrop-off: Use the main hotel entrance on Orchard Road — our wedding team will be there to welcome you.",
  section_photos: {},
};

const styles = theme + `
  .wp { min-height: 100vh; position: relative; }

  /* Section photo galleries (#71) */
  .wp-gallery-grid { display: grid; gap: 12px; }
  .wp-gallery-img {
    width: 100%; height: 100%; aspect-ratio: 1 / 1;
    object-fit: cover; border-radius: 12px; display: block;
  }
  @media (max-width: 640px) {
    .wp-gallery-grid { grid-template-columns: repeat(2, 1fr) !important; }
  }

  /* ── GARDEN LEAVES ── */
  .wp-leaves-bg {
    position: absolute; inset: 0; overflow: hidden;
    pointer-events: none; z-index: 0;
  }
  .wp-leaf {
    position: absolute; opacity: 0.13;
  }

  /* ── PREVIEW BANNER ── */
  .wp-preview-banner {
    background: var(--gold); color: white;
    text-align: center; padding: 10px 16px; font-size: 13px;
    font-weight: 500; letter-spacing: 0.02em;
    position: sticky; top: 0; z-index: 200;
  }

  /* ── HERO ── */
  .wp-hero {
    min-height: 100vh; display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    position: relative; overflow: hidden; z-index: 1;
    padding: 60px 24px; background-color: #1a1008;
  }
  .wp-hero::before {
    content: ''; position: absolute; inset: 0; z-index: 1; pointer-events: none;
    background: radial-gradient(ellipse 70% 50% at 50% 42%, rgba(201,168,76,0.09) 0%, transparent 68%);
  }
  [data-theme="garden"] .wp-hero::before {
    background: radial-gradient(ellipse 70% 50% at 50% 42%, rgba(107,158,78,0.14) 0%, transparent 68%);
  }
  [data-theme="chinese"] .wp-hero::before {
    background: radial-gradient(ellipse 70% 50% at 50% 42%, rgba(201,100,0,0.1) 0%, transparent 68%);
  }
  .wp-hero-content {
    position: relative; z-index: 10;
    text-align: center; max-width: 680px;
    display: flex; flex-direction: column; align-items: center; gap: 0;
  }
  .wp-invite-tag {
    font-size: 10px; letter-spacing: 0.35em; text-transform: uppercase;
    color: var(--gold-light); opacity: 0.8; margin-bottom: 28px;
  }
  .wp-couple {
    font-family: 'Cormorant Garamond', serif;
    font-size: clamp(42px, 8vw, 72px); font-weight: 300;
    color: white; line-height: 1.1; letter-spacing: 0.02em;
    margin-bottom: 8px;
  }
  .wp-couple-amp {
    color: var(--gold-light); font-style: italic;
    display: block; font-size: 0.7em; margin-bottom: 4px;
  }
  .wp-hero-divider {
    width: 48px; height: 1px; background: var(--gold); opacity: 0.6;
    margin: 24px 0;
  }
  .wp-date {
    font-size: 12px; letter-spacing: 0.3em; text-transform: uppercase;
    color: var(--gold-light); margin-bottom: 6px;
  }
  .wp-venue {
    font-size: 14px; color: rgba(255,255,255,0.6);
    margin-bottom: 28px; line-height: 1.5;
  }
  .wp-countdown {
    display: inline-flex; align-items: center; gap: 8px;
    background: rgba(255,255,255,0.08); border: 1px solid rgba(201,168,76,0.3);
    border-radius: 20px; padding: 8px 18px; font-size: 13px;
    color: var(--gold-light); margin-bottom: 36px;
  }
  .wp-rsvp-btn {
    display: inline-block; padding: 16px 48px;
    background: var(--gold); color: white;
    border-radius: 50px; text-decoration: none;
    font-family: 'DM Sans', sans-serif; font-size: 15px; font-weight: 500;
    letter-spacing: 0.08em; text-transform: uppercase;
    transition: background 0.2s, transform 0.15s;
  }
  .wp-rsvp-btn:hover { background: var(--gold-dark); transform: translateY(-1px); }
  .wp-scroll-hint {
    position: absolute; bottom: 28px; left: 50%; transform: translateX(-50%);
    color: rgba(255,255,255,0.3); font-size: 20px; animation: bounce 2s infinite;
  }
  @keyframes bounce {
    0%, 100% { transform: translateX(-50%) translateY(0); }
    50%       { transform: translateX(-50%) translateY(6px); }
  }

  /* ── CONTENT SECTIONS ── */
  .wp-content { max-width: 720px; margin: 0 auto; padding: 0 24px 80px; position: relative; z-index: 1; }

  .wp-section {
    padding: 64px 0; border-bottom: 1px solid rgba(201,168,76,0.15);
    opacity: 0; transform: translateY(24px);
    transition: opacity 0.6s ease, transform 0.6s ease;
  }
  .wp-section:last-child { border-bottom: none; }
  .wp-section.wp-visible { opacity: 1; transform: translateY(0); }

  .wp-section-eyebrow {
    font-size: 10px; letter-spacing: 0.35em; text-transform: uppercase;
    color: var(--gold); font-weight: 500; margin-bottom: 16px;
  }
  .wp-section-title {
    font-family: 'Cormorant Garamond', serif;
    font-size: clamp(28px, 5vw, 38px); font-weight: 400;
    color: var(--charcoal); line-height: 1.2; margin-bottom: 28px;
  }
  .wp-story-text {
    font-size: 16px; line-height: 1.85; color: var(--brown);
    white-space: pre-line;
  }

  /* ── FUN Q&A ── */
  .wp-qa-grid { display: flex; flex-direction: column; gap: 20px; }
  .wp-qa-item {
    display: grid; grid-template-columns: 1fr;
    padding: 24px 28px; border-radius: 12px;
    background: white; border: 1px solid rgba(201,168,76,0.15);
    box-shadow: var(--shadow);
  }
  .wp-qa-q {
    font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase;
    color: var(--gold-dark); font-weight: 600; margin-bottom: 10px;
  }
  .wp-qa-a {
    font-family: 'Cormorant Garamond', serif; font-size: clamp(18px, 2.2vw, 22px);
    color: var(--charcoal); line-height: 1.5; font-style: italic;
    position: relative; padding-left: 28px;
  }
  .wp-qa-a::before {
    content: '"'; font-size: 52px; font-style: normal; line-height: 1;
    position: absolute; top: -6px; left: -4px;
    color: var(--gold); opacity: 0.28;
  }

  /* ── THE BIG DAY — TIMELINE ── */
  .wp-timeline { display: flex; flex-direction: column; }
  .wp-tl-item { display: flex; gap: 20px; align-items: flex-start; }
  .wp-tl-node { display: flex; flex-direction: column; align-items: center; flex-shrink: 0; }
  .wp-tl-icon {
    width: 46px; height: 46px; border-radius: 50%;
    background: white; border: 1.5px solid rgba(201,168,76,0.25);
    display: flex; align-items: center; justify-content: center;
    font-size: 20px; box-shadow: var(--shadow); z-index: 1; flex-shrink: 0;
  }
  .wp-tl-connector { flex: 1; width: 1px; background: rgba(201,168,76,0.22); min-height: 24px; }
  .wp-tl-item:last-child .wp-tl-connector { display: none; }
  .wp-tl-body { padding: 10px 0 28px; }
  .wp-tl-label {
    font-size: 10px; letter-spacing: 0.2em; text-transform: uppercase;
    color: var(--gold-dark); font-weight: 500; margin-bottom: 4px;
  }
  .wp-tl-value { font-size: 20px; font-family: 'Cormorant Garamond', serif; color: var(--charcoal); font-weight: 500; }
  .wp-tl-sub { font-size: 13px; color: var(--brown); opacity: 0.7; margin-top: 3px; line-height: 1.5; }

  /* ── GETTING THERE ── */
  .wp-getting-there { display: flex; flex-direction: column; gap: 20px; }
  .wp-getting-there-block { display: flex; gap: 14px; align-items: flex-start; }
  .wp-getting-there-icon { font-size: 22px; flex-shrink: 0; margin-top: 1px; }
  .wp-dress-badge {
    display: inline-block; margin-top: 20px;
    padding: 6px 16px; border-radius: 20px;
    background: var(--warm-white); border: 1px solid rgba(201,168,76,0.25);
    font-size: 13px; color: var(--brown);
  }
  .wp-dress-badge strong { color: var(--gold-dark); margin-right: 4px; }

  /* ── RSVP CTA ── */
  .wp-cta {
    text-align: center; border: none !important;
    background: linear-gradient(160deg, #2c2416 0%, #1a1008 60%, #3a2a10 100%);
    border-radius: 20px; padding: 56px 32px;
  }
  .wp-cta .wp-section-eyebrow { color: var(--gold-light); opacity: 0.75; }
  .wp-cta-title {
    font-family: 'Cormorant Garamond', serif; font-size: clamp(30px, 5.5vw, 44px);
    color: white; margin-bottom: 12px;
  }
  .wp-cta-deadline { font-size: 14px; color: rgba(255,255,255,0.55); margin-bottom: 28px; }
  .wp-cta-btn {
    display: inline-block; padding: 18px 56px;
    background: var(--gold); color: white;
    border-radius: 50px; text-decoration: none;
    font-family: 'DM Sans', sans-serif; font-size: 15px; font-weight: 500;
    letter-spacing: 0.1em; text-transform: uppercase;
    transition: background 0.2s, transform 0.15s;
  }
  .wp-cta-btn:hover { background: var(--gold-dark); transform: translateY(-1px); }

  /* ── NOT FOUND ── */
  .wp-notfound {
    min-height: 100vh; display: flex; flex-direction: column;
    align-items: center; justify-content: center; text-align: center; padding: 40px;
  }
  .wp-notfound-title {
    font-family: 'Cormorant Garamond', serif; font-size: 36px;
    color: var(--charcoal); margin-bottom: 12px;
  }
  .wp-notfound-sub { font-size: 15px; color: var(--brown); opacity: 0.65; }

  @media (max-width: 560px) {
    .wp-hero { padding: 80px 20px 60px; }
    .wp-content { padding: 0 16px 60px; }
    .wp-section { padding: 48px 0; }
    .wp-cta-btn { padding: 16px 40px; }
  }
  @media (max-width: 560px) and (orientation: portrait) {
    .wp-hero {
      background-size: contain !important;
      background-position: top center !important;
      min-height: 100svh;
    }
  }

  /* ── GARDEN THEME ─────────────────────────────────────────────────────────── */
  [data-theme="garden"].wp { background: #f1f7ed; }
  [data-theme="garden"] {
    --gold:       #6b9e4e;
    --gold-light: #b8d9a0;
    --gold-dark:  #3d6b2a;
    --charcoal:   #1a3310;
    --brown:      #4a6b35;
    --warm-white: #f0f5ec;
  }
  [data-theme="garden"] .wp-couple,
  [data-theme="garden"] .wp-section-title,
  [data-theme="garden"] .wp-cta-title,
  [data-theme="garden"] .wp-qa-a,
  [data-theme="garden"] .wp-event-value {
    font-family: 'Libre Baskerville', serif;
  }
  [data-theme="garden"] .wp-section   { border-bottom-color: rgba(107,158,78,0.2); }
  [data-theme="garden"] .wp-qa-item   { border-color: rgba(107,158,78,0.2); }
  [data-theme="garden"] .wp-event     { border-color: rgba(107,158,78,0.2); }
  [data-theme="garden"] .wp-dress-badge { border-color: rgba(107,158,78,0.25); }
  [data-theme="garden"] .wp-countdown  { border-color: rgba(107,158,78,0.35); }
  [data-theme="garden"] .wp-cta-btn:hover { background: #1a3310; }
  [data-theme="garden"] .wp-cta { background: linear-gradient(160deg, #1a3310 0%, #0f2208 60%, #2a4a1c 100%); }
  [data-theme="garden"] .wp-tl-connector { background: rgba(107,158,78,0.28); }
  [data-theme="garden"] .wp-tl-icon { border-color: rgba(107,158,78,0.3); }

  /* ── CHINESE (RED & GOLD) THEME ────────────────────────────────────────────── */
  [data-theme="chinese"].wp {
    background-color: #fff5f5;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Ctext x='12' y='80' font-family='serif' font-size='72' font-weight='900' fill='%23c9a84c' opacity='0.1' transform='rotate(-10 52 64)'%3E%E5%96%9C%3C/text%3E%3Ctext x='94' y='162' font-family='serif' font-size='72' font-weight='900' fill='%23c9a84c' opacity='0.1' transform='rotate(8 134 146)'%3E%E5%96%9C%3C/text%3E%3C/svg%3E");
    background-size: 180px 180px;
  }
  [data-theme="chinese"] {
    --gold:       #c9a84c;
    --gold-light: #f5dc80;
    --gold-dark:  #a07830;
    --charcoal:   #6b0000;
    --brown:      #8b1a1a;
    --warm-white: #fff5f5;
  }
  [data-theme="chinese"] .wp-section   { border-bottom-color: rgba(180,0,0,0.12); }
  [data-theme="chinese"] .wp-qa-item   { border-color: rgba(180,0,0,0.12); }
  [data-theme="chinese"] .wp-event     { border-color: rgba(180,0,0,0.12); }
  [data-theme="chinese"] .wp-dress-badge { border-color: rgba(180,0,0,0.18); background: #fff5f5; }
  [data-theme="chinese"] .wp-countdown  { border-color: rgba(201,168,76,0.4); }
  [data-theme="chinese"] .wp-cta-btn   { background: #6b0000; }
  [data-theme="chinese"] .wp-cta-btn:hover { background: #4a0000; }
  [data-theme="chinese"] .wp-rsvp-btn  { background: #c9a84c; color: #3a1a00; }
  [data-theme="chinese"] .wp-rsvp-btn:hover { background: #a07830; }
  [data-theme="chinese"] .wp-cta { background: linear-gradient(160deg, #7a0a0a 0%, #5c0000 60%, #8b1515 100%); }
  [data-theme="chinese"] .wp-cta .wp-cta-btn { background: var(--gold); color: #3a1a00; }
  [data-theme="chinese"] .wp-tl-connector { background: rgba(180,0,0,0.15); }
  [data-theme="chinese"] .wp-tl-icon { border-color: rgba(180,0,0,0.18); }
`;

function LeafIcon({ style }) {
  return (
    <svg viewBox="0 0 30 50" style={style} className="wp-leaf" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
      <path d="M15,3 C22,6 26,22 20,40 Q18,45 15,47 Q12,45 10,40 C4,22 8,6 15,3Z" fill="#3d6b2a" />
      <path d="M15,5 Q17,26 14,46" stroke="#2d5020" strokeWidth="0.9" fill="none" strokeLinecap="round" />
    </svg>
  );
}

const GARDEN_LEAVES = [
  { top: "20%",  left: "-20px",  rot: 15,   w: 74,  h: 122 },
  { top: "26%",  right: "-18px", rot: -150, w: 61,  h: 101 },
  { top: "37%",  left: "-16px",  rot: 40,   w: 51,  h: 85  },
  { top: "43%",  right: "-16px", rot: 175,  w: 80,  h: 133 },
  { top: "55%",  left: "-22px",  rot: -25,  w: 67,  h: 112 },
  { top: "61%",  right: "-14px", rot: 95,   w: 58,  h: 96  },
  { top: "70%",  left: "-14px",  rot: 130,  w: 48,  h: 80  },
  { top: "78%",  right: "-20px", rot: -70,  w: 70,  h: 117 },
  { top: "87%",  left: "-18px",  rot: 200,  w: 61,  h: 101 },
  { top: "93%",  right: "-16px", rot: 120,  w: 54,  h: 90  },
  { top: "48%",  left: "12px",   rot: 60,   w: 33,  h: 54  },
  { top: "66%",  right: "10px",  rot: -40,  w: 30,  h: 50  },
];

function heroGradient(t) {
  if (t === "garden")  return "linear-gradient(160deg, #1b3d13 0%, #0f2208 60%, #2a4a1c 100%)";
  if (t === "chinese") return "linear-gradient(160deg, #7a0a0a 0%, #5c0000 60%, #8b1515 100%)";
  return "linear-gradient(160deg, #2c2416 0%, #1a1008 60%, #3a2a10 100%)";
}

function heroBgColor(t) {
  if (t === "garden")  return "#0f2208";
  if (t === "chinese") return "#5c0000";
  return "#1a1008";
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  const today = new Date();
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const weddingUtc = Date.UTC(y, m - 1, d);
  return Math.round((weddingUtc - todayUtc) / 86_400_000);
}

export default function WeddingPage() {
  const { t, locale } = useLocale();

  // Date/time formatters close over the active locale. en-GB keeps the
  // day→month order used by the original hardcoded English formatting.
  const dtLocale = locale === "zh-TW" ? "zh-TW" : "en-GB";

  function fmt12h(time) {
    if (!time) return "";
    const [hStr, mStr] = time.split(":");
    const d = new Date(2000, 0, 1, parseInt(hStr, 10), parseInt(mStr, 10));
    return new Intl.DateTimeFormat(dtLocale, {
      hour: "numeric", minute: "2-digit", hour12: true,
    }).format(d);
  }

  function formatLongDate(dateStr) {
    if (!dateStr) return "";
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Intl.DateTimeFormat(dtLocale, {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    }).format(new Date(y, m - 1, d));
  }

  function formatShortDate(dateStr) {
    if (!dateStr) return "";
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Intl.DateTimeFormat(dtLocale, {
      day: "numeric", month: "short", year: "numeric",
    }).format(new Date(y, m - 1, d));
  }

  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [wedding, setWedding] = useState(null);
  const [loading, setLoading]  = useState(true);
  // Couple content in the active language (per-field fallback to English) — #53 Phase 2.
  const lw = localizeWedding(wedding, locale);

  useEffect(() => {
    if (isDemoMode) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setWedding(DEMO_WEDDING);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
      return;
    }
    sb.rpc("get_public_wedding", { p_slug: slug })
      .then((rows) => {
        setWedding(Array.isArray(rows) && rows.length ? rows[0] : null);
      })
      .catch(() => setWedding(null))
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    if (wedding?.bride_name && wedding?.groom_name) {
      document.title = t("wedding.docTitle", { bride: wedding.bride_name, groom: wedding.groom_name });
    }
  }, [wedding, t]);

  useEffect(() => {
    if (!wedding) return;
    const sections = document.querySelectorAll('.wp-section');
    const obs = new IntersectionObserver(
      (entries) => entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('wp-visible'); obs.unobserve(e.target); } }),
      { threshold: 0.08 }
    );
    sections.forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, [wedding]);

  const rsvpHref = token ? `/rsvp?token=${token}` : "/rsvp";
  const days = daysUntil(wedding?.wedding_date);

  const answeredQA = (() => {
    if (!lw?.fun_qa) return [];
    const qaArr = Array.isArray(lw.fun_qa) ? lw.fun_qa : [];
    return qaArr
      .map((item) => ({
        id: item.id,
        q: item.q || (FUN_QUESTION_KEYS[item.id] ? t(FUN_QUESTION_KEYS[item.id]) : ""),
        answer: item.answer || "",
      }))
      .filter((item) => item.answer && item.q);
  })();

  if (loading) {
    return (
      <>
        <style>{styles}</style>
        <div className="wp-notfound">
          <div style={{ fontSize: 32 }}>✦</div>
        </div>
      </>
    );
  }

  if (!wedding) {
    return (
      <>
        <style>{styles}</style>
        <div className="wp-notfound">
          <div className="wp-notfound-title">{t("wedding.notFound.title")}</div>
          <div className="wp-notfound-sub">{t("wedding.notFound.body")}</div>
        </div>
      </>
    );
  }

  const { bride_name, groom_name, wedding_date, venue_name, venue_address,
          ceremony_time, dinner_time, tea_ceremony_time, love_story, dress_code,
          hero_image_url, rsvp_deadline, is_published, getting_there,
          theme: pageTheme = "minimal", theme_tokens } = lw;

  // Optional photo galleries between sections (#71). Images are locale-shared,
  // so this comes straight off the wedding record (not the localized overlay).
  const galleries = normalizeSectionPhotos(wedding.section_photos);
  const renderGallery = (key) => {
    const g = galleries[key];
    if (!g?.enabled || g.photos.length === 0) return null;
    return (
      <section className="wp-section wp-gallery">
        <div className="wp-gallery-grid" style={{ gridTemplateColumns: `repeat(${g.cols}, 1fr)` }}>
          {g.photos.map((src) => (
            <img key={src} className="wp-gallery-img" src={src} alt="" loading="lazy" />
          ))}
        </div>
      </section>
    );
  };

  // Custom (AI-generated) theme (#60): apply the color-only palette as inline CSS
  // variable overrides. An incomplete/invalid palette falls back to the minimal
  // preset rather than half-applying.
  const customTokens = pageTheme === "custom" ? sanitizeThemeTokens(theme_tokens) : {};
  const hasCustom = isCompleteThemeTokens(customTokens);
  const effectiveTheme = pageTheme === "custom" ? (hasCustom ? "custom" : "minimal") : pageTheme;
  const customStyle = hasCustom ? themeTokenStyle(customTokens) : undefined;

  const coupleNames = `${groom_name} & ${bride_name}`;

  return (
    <>
      <style>{styles}</style>
      <div className="wp" data-theme={effectiveTheme} style={customStyle}>

        {/* Sit below the sticky preview banner (and above it in z-order) when unpublished. */}
        <LanguageSwitcher style={{ position: "absolute", top: is_published ? 16 : 52, right: 16, zIndex: 201 }} />

        {effectiveTheme === "garden" && (
          <div className="wp-leaves-bg">
            {GARDEN_LEAVES.map((l, i) => (
              <LeafIcon
                key={i}
                style={{
                  top: l.top,
                  left: l.left,
                  right: l.right,
                  width: l.w,
                  height: l.h,
                  transform: `rotate(${l.rot}deg)`,
                }}
              />
            ))}
          </div>
        )}

        {!is_published && (
          <div className="wp-preview-banner">
            {t("wedding.previewBanner")}
          </div>
        )}

        {/* ── HERO ── */}
        <section
          className="wp-hero"
          style={{
            backgroundImage: hero_image_url
              ? `linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.45) 100%), url(${hero_image_url})`
              : hasCustom
                ? `linear-gradient(160deg, ${customTokens.accentDark} 0%, ${customTokens.heading} 60%, ${customTokens.accent} 100%)`
                : heroGradient(effectiveTheme),
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundColor: hasCustom ? customTokens.heading : heroBgColor(effectiveTheme),
          }}
        >

          <div className="wp-hero-content">
            <div className="wp-invite-tag">
              {groom_name && bride_name
                ? t("wedding.inviteTag", { groom: groom_name, bride: bride_name })
                : t("wedding.inviteTagFallback")}
            </div>

            <div className="wp-couple">
              <span className="wp-couple-amp">♡</span>
              {groom_name}
              <br />& {bride_name}
            </div>

            <div className="wp-hero-divider" />

            {wedding_date && (
              <div className="wp-date">{formatLongDate(wedding_date)}</div>
            )}
            {venue_name && (
              <div className="wp-venue">{venue_name}</div>
            )}

            {days !== null && (
              <div className="wp-countdown">
                ✦ &nbsp;{
                  days === 0
                    ? t("wedding.countdown.today")
                    : days > 0
                      ? t(days === 1 ? "wedding.countdown.toGo_one" : "wedding.countdown.toGo_other", { n: days })
                      : t(Math.abs(days) === 1 ? "wedding.countdown.ago_one" : "wedding.countdown.ago_other", { n: Math.abs(days) })
                }
              </div>
            )}

            <a className="wp-rsvp-btn" href={rsvpHref}>{t("wedding.rsvpNow")}</a>
          </div>

          <div className="wp-scroll-hint">↓</div>
        </section>

        {/* ── CONTENT SECTIONS ── */}
        <div className="wp-content">

          {renderGallery("afterHero")}

          {/* Our Story */}
          {love_story && (
            <section className="wp-section">
              <div className="wp-section-eyebrow">{t("wedding.story.eyebrow")}</div>
              <div className="wp-section-title">{t("wedding.story.title")}</div>
              <p className="wp-story-text">{love_story}</p>
            </section>
          )}

          {renderGallery("afterOurStory")}

          {/* Fun Q&A */}
          {answeredQA.length > 0 && (
            <section className="wp-section">
              <div className="wp-section-eyebrow">{t("wedding.funfacts.eyebrow")}</div>
              <div className="wp-section-title">{t("wedding.funfacts.title")}</div>
              <div className="wp-qa-grid">
                {answeredQA.map((item) => (
                  <div key={item.id} className="wp-qa-item">
                    <div className="wp-qa-q">{item.q}</div>
                    <div className="wp-qa-a">"{item.answer}"</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {renderGallery("afterFunQA")}

          {/* The Big Day */}
          <section className="wp-section">
            <div className="wp-section-eyebrow">{t("wedding.bigday.eyebrow")}</div>
            <div className="wp-section-title">{t("wedding.bigday.title")}</div>
            <div className="wp-timeline">
              {tea_ceremony_time && (
                <div className="wp-tl-item">
                  <div className="wp-tl-node"><div className="wp-tl-icon">🍵</div><div className="wp-tl-connector" /></div>
                  <div className="wp-tl-body">
                    <div className="wp-tl-label">{t("wedding.timeline.tea")}</div>
                    <div className="wp-tl-value">{fmt12h(tea_ceremony_time)}</div>
                    {wedding_date && <div className="wp-tl-sub">{formatLongDate(wedding_date)}</div>}
                  </div>
                </div>
              )}
              {ceremony_time && (
                <div className="wp-tl-item">
                  <div className="wp-tl-node"><div className="wp-tl-icon">💍</div><div className="wp-tl-connector" /></div>
                  <div className="wp-tl-body">
                    <div className="wp-tl-label">{t("wedding.timeline.solemnisation")}</div>
                    <div className="wp-tl-value">{fmt12h(ceremony_time)}</div>
                    {!tea_ceremony_time && wedding_date && <div className="wp-tl-sub">{formatLongDate(wedding_date)}</div>}
                  </div>
                </div>
              )}
              {dinner_time && (
                <div className="wp-tl-item">
                  <div className="wp-tl-node"><div className="wp-tl-icon">🍽</div><div className="wp-tl-connector" /></div>
                  <div className="wp-tl-body">
                    <div className="wp-tl-label">{t("wedding.timeline.dinner")}</div>
                    <div className="wp-tl-value">{fmt12h(dinner_time)}</div>
                  </div>
                </div>
              )}
              {(venue_name || venue_address) && (
                <div className="wp-tl-item">
                  <div className="wp-tl-node"><div className="wp-tl-icon">📍</div><div className="wp-tl-connector" /></div>
                  <div className="wp-tl-body">
                    <div className="wp-tl-label">{t("wedding.timeline.venue")}</div>
                    {venue_name && <div className="wp-tl-value">{venue_name}</div>}
                    {venue_address && (
                      <div className="wp-tl-sub">
                        <a href={`https://maps.google.com/?q=${encodeURIComponent(venue_address)}`}
                          target="_blank" rel="noopener noreferrer"
                          style={{ color: "var(--gold-dark)", textDecoration: "none" }}>
                          {venue_address} ↗
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            {dress_code && (
              <div className="wp-dress-badge">
                <strong>{t("wedding.dressCodeLabel")}</strong> {dress_code}
              </div>
            )}
          </section>

          {renderGallery("afterEventDetails")}

          {/* Getting There */}
          {getting_there && (
            <section className="wp-section">
              <div className="wp-section-eyebrow">{t("wedding.gettingthere.eyebrow")}</div>
              <div className="wp-section-title">{t("wedding.gettingthere.title")}</div>
              <div className="wp-getting-there">
                {getting_there.split('\n\n').filter(p => p.trim()).map((para, i) => {
                  const text = para.trim();
                  const icon = /mrt|bus|train|transit/i.test(text) ? '🚇'
                             : /car|park|drive|taxi|grab/i.test(text) ? '🚗'
                             : /walk|drop.?off|entrance|arrive/i.test(text) ? '🚶'
                             : '📍';
                  return (
                    <div key={i} className="wp-getting-there-block">
                      <div className="wp-getting-there-icon">{icon}</div>
                      <p className="wp-story-text" style={{ margin: 0 }}>{text}</p>
                    </div>
                  );
                })}
              </div>
              {venue_address && (
                <div style={{ marginTop: 24 }}>
                  <a
                    href={`https://maps.google.com/?q=${encodeURIComponent(venue_address)}`}
                    target="_blank" rel="noopener noreferrer"
                    className="wp-rsvp-btn"
                    style={{ fontSize: 13, padding: "12px 28px", letterSpacing: "0.06em" }}
                  >
                    {t("wedding.openMaps")}
                  </a>
                </div>
              )}
            </section>
          )}

          {renderGallery("afterGettingThere")}

          {/* RSVP CTA */}
          <section className="wp-section wp-cta">
            <div className="wp-section-eyebrow">{t("wedding.join.eyebrow")}</div>
            <div className="wp-cta-title">{t("wedding.join.title")}</div>
            {rsvp_deadline && (
              <div className="wp-cta-deadline">
                {t("wedding.rsvpBy", { date: formatShortDate(rsvp_deadline) })}
              </div>
            )}
            <a className="wp-cta-btn" href={rsvpHref}>{t("wedding.ctaWaiting", { couple: coupleNames })}</a>
          </section>

        </div>
      </div>
    </>
  );
}
