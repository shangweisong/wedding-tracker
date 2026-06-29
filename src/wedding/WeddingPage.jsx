import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { sb, isDemoMode } from "../lib/supabase.js";
import { theme } from "../shared/theme.js";

const FUN_QUESTIONS = [
  { id: "how_met",     q: "How did you two meet?" },
  { id: "proposal",   q: "How did the proposal happen?" },
  { id: "first_ily",  q: "Who said 'I love you' first?" },
  { id: "best_cook",  q: "Who's the better cook?" },
  { id: "funnier",    q: "Who's funnier?" },
  { id: "fiercer",    q: "Who's fiercer?" },
  { id: "best_memory",q: "What's your favourite memory together?" },
  { id: "first_date", q: "What happened on your first date?" },
];

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
};

const styles = theme + `
  .wp { min-height: 100vh; position: relative; }

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

  .wp-section { padding: 64px 0; border-bottom: 1px solid rgba(201,168,76,0.15); }
  .wp-section:last-child { border-bottom: none; }

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
  .wp-qa-grid { display: flex; flex-direction: column; gap: 24px; }
  .wp-qa-item {
    display: grid; grid-template-columns: 1fr;
    padding: 20px 24px; border-radius: 12px;
    background: white; border: 1px solid rgba(201,168,76,0.15);
    box-shadow: var(--shadow);
  }
  .wp-qa-q {
    font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase;
    color: var(--gold-dark); font-weight: 500; margin-bottom: 8px;
  }
  .wp-qa-a {
    font-family: 'Cormorant Garamond', serif; font-size: 19px;
    color: var(--charcoal); line-height: 1.4; font-style: italic;
  }

  /* ── THE BIG DAY ── */
  .wp-events { display: flex; flex-direction: column; gap: 16px; }
  .wp-event {
    display: flex; align-items: flex-start; gap: 16px;
    padding: 20px 24px; border-radius: 12px;
    background: white; border: 1px solid rgba(201,168,76,0.15);
    box-shadow: var(--shadow);
  }
  .wp-event-icon {
    font-size: 22px; flex-shrink: 0; width: 36px;
    text-align: center; line-height: 1;
  }
  .wp-event-body {}
  .wp-event-label {
    font-size: 10px; letter-spacing: 0.2em; text-transform: uppercase;
    color: var(--gold-dark); font-weight: 500; margin-bottom: 4px;
  }
  .wp-event-value {
    font-size: 18px; font-family: 'Cormorant Garamond', serif;
    color: var(--charcoal); font-weight: 500;
  }
  .wp-event-sub { font-size: 13px; color: var(--brown); opacity: 0.7; margin-top: 2px; line-height: 1.5; }
  .wp-dress-badge {
    display: inline-block; margin-top: 20px;
    padding: 6px 16px; border-radius: 20px;
    background: var(--warm-white); border: 1px solid rgba(201,168,76,0.25);
    font-size: 13px; color: var(--brown);
  }
  .wp-dress-badge strong { color: var(--gold-dark); margin-right: 4px; }

  /* ── RSVP CTA ── */
  .wp-cta { text-align: center; }
  .wp-cta-title {
    font-family: 'Cormorant Garamond', serif; font-size: clamp(32px, 6vw, 48px);
    color: var(--charcoal); margin-bottom: 12px;
  }
  .wp-cta-deadline {
    font-size: 14px; color: var(--brown); opacity: 0.65; margin-bottom: 28px;
  }
  .wp-cta-btn {
    display: inline-block; padding: 18px 56px;
    background: var(--charcoal); color: var(--gold-light);
    border-radius: 50px; text-decoration: none;
    font-family: 'DM Sans', sans-serif; font-size: 15px; font-weight: 500;
    letter-spacing: 0.1em; text-transform: uppercase;
    transition: background 0.2s, transform 0.15s;
  }
  .wp-cta-btn:hover { background: #3a2d1a; transform: translateY(-1px); }

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

function fmt12h(t) {
  if (!t) return "";
  const [hStr, mStr] = t.split(":");
  const h = parseInt(hStr, 10);
  const period = h < 12 ? "AM" : "PM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${mStr} ${period}`;
}

function formatLongDate(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const dow = new Date(y, m - 1, d).getDay();
  return `${days[dow]}, ${d} ${months[m - 1]} ${y}`;
}

function formatShortDate(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${d} ${months[m - 1]} ${y}`;
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  const today = new Date();
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const weddingUtc = Date.UTC(y, m - 1, d);
  return Math.round((weddingUtc - todayUtc) / 86_400_000);
}

function countdownLabel(days) {
  if (days === null) return null;
  if (days === 0) return "Today! 🎊";
  if (days > 0) return `${days} day${days === 1 ? "" : "s"} to go`;
  return `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago`;
}

export default function WeddingPage() {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [wedding, setWedding] = useState(null);
  const [loading, setLoading]  = useState(true);

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
      document.title = `${wedding.bride_name} & ${wedding.groom_name} · Wedding`;
    }
  }, [wedding]);

  const rsvpHref = token ? `/rsvp?token=${token}` : "/rsvp";
  const days = daysUntil(wedding?.wedding_date);

  const answeredQA = (() => {
    if (!wedding?.fun_qa) return [];
    const qaArr = Array.isArray(wedding.fun_qa) ? wedding.fun_qa : [];
    return FUN_QUESTIONS
      .map((q) => ({ ...q, answer: (qaArr.find((a) => a.id === q.id) || {}).answer }))
      .filter((q) => q.answer);
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
          <div className="wp-notfound-title">Page not found</div>
          <div className="wp-notfound-sub">This wedding page doesn't exist or hasn't been set up yet.</div>
        </div>
      </>
    );
  }

  const { bride_name, groom_name, wedding_date, venue_name, venue_address,
          ceremony_time, dinner_time, tea_ceremony_time, love_story, dress_code,
          hero_image_url, rsvp_deadline, is_published, getting_there,
          theme: pageTheme = "minimal" } = wedding;

  const coupleNames = `${groom_name} & ${bride_name}`;

  return (
    <>
      <style>{styles}</style>
      <div className="wp" data-theme={pageTheme}>

        {pageTheme === "garden" && (
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
            Preview — this page isn't published yet. Only you can see this link.
          </div>
        )}

        {/* ── HERO ── */}
        <section
          className="wp-hero"
          style={{
            backgroundImage: hero_image_url
              ? `linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.45) 100%), url(${hero_image_url})`
              : heroGradient(pageTheme),
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundColor: heroBgColor(pageTheme),
          }}
        >

          <div className="wp-hero-content">
            <div className="wp-invite-tag">— — — You are cordially invited — — —</div>

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
                ✦ &nbsp;{countdownLabel(days)}
              </div>
            )}

            <a className="wp-rsvp-btn" href={rsvpHref}>RSVP Now</a>
          </div>

          <div className="wp-scroll-hint">↓</div>
        </section>

        {/* ── CONTENT SECTIONS ── */}
        <div className="wp-content">

          {/* Our Story */}
          {love_story && (
            <section className="wp-section">
              <div className="wp-section-eyebrow">Our Story</div>
              <div className="wp-section-title">How it all began</div>
              <p className="wp-story-text">{love_story}</p>
            </section>
          )}

          {/* Fun Q&A */}
          {answeredQA.length > 0 && (
            <section className="wp-section">
              <div className="wp-section-eyebrow">Fun Facts</div>
              <div className="wp-section-title">A little about us</div>
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

          {/* The Big Day */}
          <section className="wp-section">
            <div className="wp-section-eyebrow">The Big Day</div>
            <div className="wp-section-title">Event details</div>
            <div className="wp-events">
              {tea_ceremony_time && (
                <div className="wp-event">
                  <div className="wp-event-icon">🍵</div>
                  <div className="wp-event-body">
                    <div className="wp-event-label">Tea Ceremony</div>
                    <div className="wp-event-value">{fmt12h(tea_ceremony_time)}</div>
                    {wedding_date && <div className="wp-event-sub">{formatLongDate(wedding_date)}</div>}
                  </div>
                </div>
              )}
              {ceremony_time && (
                <div className="wp-event">
                  <div className="wp-event-icon">💍</div>
                  <div className="wp-event-body">
                    <div className="wp-event-label">Solemnisation</div>
                    <div className="wp-event-value">{fmt12h(ceremony_time)}</div>
                    {!tea_ceremony_time && wedding_date && <div className="wp-event-sub">{formatLongDate(wedding_date)}</div>}
                  </div>
                </div>
              )}
              {dinner_time && (
                <div className="wp-event">
                  <div className="wp-event-icon">🍽</div>
                  <div className="wp-event-body">
                    <div className="wp-event-label">Dinner Reception</div>
                    <div className="wp-event-value">{fmt12h(dinner_time)}</div>
                  </div>
                </div>
              )}
              {(venue_name || venue_address) && (
                <div className="wp-event">
                  <div className="wp-event-icon">📍</div>
                  <div className="wp-event-body">
                    <div className="wp-event-label">Venue</div>
                    {venue_name && <div className="wp-event-value">{venue_name}</div>}
                    {venue_address && (
                      <div className="wp-event-sub">
                        <a
                          href={`https://maps.google.com/?q=${encodeURIComponent(venue_address)}`}
                          target="_blank" rel="noopener noreferrer"
                          style={{ color: "var(--gold-dark)", textDecoration: "none" }}
                        >
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
                <strong>Dress code:</strong> {dress_code}
              </div>
            )}
          </section>

          {/* Getting There */}
          {getting_there && (
            <section className="wp-section">
              <div className="wp-section-eyebrow">Getting There</div>
              <div className="wp-section-title">Plan your journey</div>
              <p className="wp-story-text">{getting_there}</p>
              {venue_address && (
                <div style={{ marginTop: 20 }}>
                  <a
                    href={`https://maps.google.com/?q=${encodeURIComponent(venue_address)}`}
                    target="_blank" rel="noopener noreferrer"
                    className="wp-rsvp-btn"
                    style={{ fontSize: 13, padding: "12px 28px", letterSpacing: "0.06em" }}
                  >
                    Open in Google Maps ↗
                  </a>
                </div>
              )}
            </section>
          )}

          {/* RSVP CTA */}
          <section className="wp-section wp-cta">
            <div className="wp-section-eyebrow">Join Us</div>
            <div className="wp-cta-title">Hope to see you there!</div>
            {rsvp_deadline && (
              <div className="wp-cta-deadline">
                Kindly RSVP by {formatShortDate(rsvp_deadline)}
              </div>
            )}
            <a className="wp-cta-btn" href={rsvpHref}>{coupleNames} are waiting for your RSVP →</a>
          </section>

        </div>
      </div>
    </>
  );
}
