import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { theme } from '../shared/theme.js';
import { ArrowLeft, ArrowRight, Play, Pause, CornersOut, CornersIn, Sparkle } from '@phosphor-icons/react';

// ─── Vibrant gradient backgrounds (one per slide type) ────────────────────────
const VBG = {
  title:       'linear-gradient(135deg, #150025 0%, #4a0060 50%, #b5007f 100%)',
  participate: 'linear-gradient(135deg, #0a1628 0%, #1e3a5f 50%, #1e40af 100%)',
  numbers:     'linear-gradient(135deg, #001a12 0%, #003822 50%, #065f46 100%)',
  sides:       'linear-gradient(135deg, #1a0a2e 0%, #4a1060 50%, #6d28d9 100%)',
  clusters:    'linear-gradient(135deg, #1a0a00 0%, #7c2d12 50%, #c2410c 100%)',
  words:       'linear-gradient(135deg, #0c1445 0%, #1e1b4b 50%, #4338ca 100%)',
  emoji:       'linear-gradient(135deg, #0f172a 0%, #164e63 50%, #0e7490 100%)',
  awards: [
    'linear-gradient(135deg, #1a1000 0%, #713f12 50%, #b45309 100%)',
    'linear-gradient(135deg, #0a1628 0%, #0c4a6e 50%, #0369a1 100%)',
    'linear-gradient(135deg, #001a00 0%, #14532d 50%, #166534 100%)',
    'linear-gradient(135deg, #1a0028 0%, #581c87 50%, #7e22ce 100%)',
    'linear-gradient(135deg, #1a0a00 0%, #7f1d1d 50%, #dc2626 100%)',
  ],
  silence:     'linear-gradient(135deg, #0f0f0f 0%, #3b0a0a 50%, #7f1d1d 100%)',
  thanks:      'linear-gradient(135deg, #2d0a1e 0%, #831843 50%, #be185d 100%)',
};

const VIBRANT_WORD_COLORS = ['#f9a8d4', '#c4b5fd', '#6ee7b7', '#7dd3fc', '#fbbf24', '#f87171'];

// ─── Participation commentary (mirrored from stats engine) ────────────────────
function participationComment(rate, count) {
  if (count === 0)  return "Everyone came for the food, apparently 🍽️";
  if (rate === 1)   return "Every. Single. Guest. You are SO loved 🥹";
  if (rate >= 0.85) return "Basically everyone had something to say — you are well loved 🥹";
  if (rate >= 0.65) return "Your guests really showed up for you 💝";
  if (rate >= 0.50) return "More than half your guests wrote something 🎉";
  if (rate >= 0.35) return "A solid group had things to say ✍️";
  if (rate >= 0.15) return "A few kind souls took a moment to write 💬";
  return "Seems like most guests were here for the food... and that's okay 🍽️";
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const wwStyles = theme + `
  /* ── Theme custom properties ── */
  .ww-page {
    height: 100svh;
    display: flex;
    flex-direction: column;
    background: #1a1208;
    overflow: hidden;
    position: relative;
    --ww-text:   var(--gold-light);
    --ww-accent: var(--gold);
    --ww-muted:  rgba(232,213,163,0.45);
    --ww-card:   rgba(255,255,255,0.03);
    --ww-border: rgba(201,168,76,0.2);
    --ww-quote:  rgba(232,213,163,0.75);
  }

  /* Vibrant theme overrides */
  .ww-page.vibrant {
    background: #000;
    --ww-text:   #ffffff;
    --ww-accent: rgba(255,255,255,0.95);
    --ww-muted:  rgba(255,255,255,0.5);
    --ww-card:   rgba(255,255,255,0.1);
    --ww-border: rgba(255,255,255,0.18);
    --ww-quote:  rgba(255,255,255,0.8);
  }
  .ww-page.vibrant .ww-slide-title {
    font-family: 'DM Sans', sans-serif;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: -0.02em;
  }
  .ww-page.vibrant .ww-number-value {
    font-family: 'DM Sans', sans-serif;
    font-weight: 700;
    letter-spacing: -0.03em;
  }
  .ww-page.vibrant .ww-slide-label   { color: var(--ww-muted); }
  .ww-page.vibrant .ww-controls      { background: rgba(0,0,0,0.7); border-color: rgba(255,255,255,0.14); }
  .ww-page.vibrant .ww-btn           { border-color: rgba(255,255,255,0.2); color: rgba(255,255,255,0.8); }
  .ww-page.vibrant .ww-btn:hover:not(:disabled) { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.5); }
  .ww-page.vibrant .ww-btn.active    { background: rgba(255,255,255,0.15); border-color: white; color: white; }
  .ww-page.vibrant .ww-counter       { color: rgba(255,255,255,0.45); }
  .ww-page.vibrant .ww-sep           { background: rgba(255,255,255,0.14); }
  .ww-page.vibrant .ww-award-name   { font-family: 'DM Sans', sans-serif; font-weight: 700; }
  .ww-page.vibrant .ww-award-quote  { font-family: 'DM Sans', sans-serif; }
  .ww-page.vibrant .ww-word         { font-family: 'DM Sans', sans-serif; font-weight: 600; }
  .ww-page.vibrant .ww-thanks-names { font-family: 'DM Sans', sans-serif; font-weight: 700; }

  /* ── Midnight Bloom theme ── */
  .ww-page.midnight {
    background: #06080f;
    --ww-text:   #eef0f4;
    --ww-accent: #f9a8b8;
    --ww-muted:  rgba(238,240,244,0.38);
    --ww-card:   rgba(255,255,255,0.04);
    --ww-border: rgba(249,168,184,0.14);
    --ww-quote:  rgba(238,240,244,0.72);
  }
  /* Lateral crossfade — feels like a page turn */
  @keyframes wwFadeInX {
    from { opacity: 0; transform: translateX(14px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes wwFadeOutX {
    from { opacity: 1; transform: translateX(0); }
    to   { opacity: 0; transform: translateX(-10px); }
  }
  .ww-page.midnight .ww-slide { animation-name: wwFadeInX; }
  .ww-page.midnight .ww-slide-wrapper.ww-exiting .ww-slide { animation-name: wwFadeOutX; }
  /* Thin blush rule above slide labels */
  .ww-page.midnight .ww-slide-label::before {
    content: ''; display: block;
    width: 32px; height: 1px;
    background: #f9a8b8; opacity: 0.4;
    margin: 0 auto 12px;
  }
  /* Numbers: tabular DM Sans — punchy without serif */
  .ww-page.midnight .ww-number-value {
    font-family: 'DM Sans', sans-serif;
    font-weight: 700; letter-spacing: -0.03em;
    font-variant-numeric: tabular-nums;
  }
  /* Title: Cormorant slightly heavier on this cold bg */
  .ww-page.midnight .ww-slide-title  { font-weight: 400; }
  /* Award name: DM Sans bold for impact */
  .ww-page.midnight .ww-award-name   { font-family: 'DM Sans', sans-serif; font-weight: 700; }
  /* Controls */
  .ww-page.midnight .ww-controls     { background: rgba(6,8,15,0.9); border-color: rgba(249,168,184,0.18); }
  .ww-page.midnight .ww-btn          { border-color: rgba(249,168,184,0.2); color: rgba(238,240,244,0.8); }
  .ww-page.midnight .ww-btn:hover:not(:disabled) { background: rgba(249,168,184,0.1); border-color: #f9a8b8; }
  .ww-page.midnight .ww-btn.active   { background: rgba(249,168,184,0.15); border-color: #f9a8b8; color: #f9a8b8; }
  .ww-page.midnight .ww-counter      { color: rgba(238,240,244,0.35); }
  .ww-page.midnight .ww-sep          { background: rgba(249,168,184,0.14); }

  .ww-slide {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 80px;
    text-align: center;
    animation: wwFadeIn 0.55s ease;
  }
  @keyframes wwFadeIn {
    from { opacity: 0; transform: translateY(22px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes wwFadeOut {
    from { opacity: 1; transform: translateY(0); }
    to   { opacity: 0; transform: translateY(-14px); }
  }
  .ww-slide-wrapper { display: contents; }
  .ww-slide-wrapper.ww-exiting .ww-slide { animation: wwFadeOut 0.15s ease forwards; }

  .ww-slide-emoji { font-size: 64px; margin-bottom: 24px; line-height: 1; }
  .ww-slide-label {
    font-family: 'DM Sans', sans-serif;
    font-size: 13px; letter-spacing: 0.2em; text-transform: uppercase;
    color: var(--ww-accent); margin-bottom: 24px;
  }
  .ww-slide-title {
    font-family: 'Cormorant Garamond', serif;
    font-size: clamp(44px, 8vw, 96px);
    font-weight: 300; color: var(--ww-text);
    line-height: 1.1; margin-bottom: 16px;
  }
  .ww-slide-subtitle {
    font-family: 'Cormorant Garamond', serif;
    font-size: clamp(22px, 3.5vw, 40px);
    color: var(--ww-accent); font-style: italic; margin-bottom: 28px;
  }
  .ww-slide-meta {
    font-family: 'DM Sans', sans-serif;
    font-size: 16px; color: var(--ww-muted); letter-spacing: 0.05em;
  }

  /* ── Numbers ── */
  .ww-numbers {
    display: flex; gap: 32px; align-items: stretch; justify-content: center; flex-wrap: wrap;
    margin-top: 8px;
  }
  .ww-number-card {
    display: flex; flex-direction: column; align-items: center; gap: 10px;
    padding: 28px 36px;
    border: 1px solid var(--ww-border);
    border-radius: 16px;
    background: var(--ww-card);
    min-width: 150px;
  }
  .ww-number-icon { font-size: 30px; }
  .ww-number-value {
    font-family: 'Cormorant Garamond', serif;
    font-size: clamp(44px, 7vw, 80px);
    color: var(--ww-text); line-height: 1; font-weight: 300;
  }
  .ww-number-label {
    font-family: 'DM Sans', sans-serif;
    font-size: 11px; letter-spacing: 0.15em; text-transform: uppercase;
    color: var(--ww-muted);
  }

  /* ── Word cloud ── */
  .ww-word-cloud {
    display: flex; flex-wrap: wrap; gap: 10px 16px;
    align-items: center; justify-content: center;
    max-width: 900px; padding: 8px 0;
  }
  .ww-word {
    font-family: 'Cormorant Garamond', serif;
    color: var(--ww-text); line-height: 1.2;
    animation: wwFadeIn 0.5s ease both;
    animation-delay: calc(var(--i, 0) * 40ms);
  }

  /* ── Award ── */
  .ww-award-badge {
    font-family: 'DM Sans', sans-serif;
    font-size: 13px; letter-spacing: 0.2em; text-transform: uppercase;
    color: var(--ww-accent); margin-bottom: 16px;
  }
  .ww-award-name {
    font-family: 'Cormorant Garamond', serif;
    font-size: clamp(34px, 5.5vw, 68px);
    color: var(--ww-text); margin-bottom: 24px; line-height: 1.1;
  }
  .ww-award-quote {
    font-family: 'Cormorant Garamond', serif;
    font-size: clamp(18px, 2.2vw, 26px);
    color: var(--ww-quote); font-style: italic;
    max-width: 680px; line-height: 1.7; margin-bottom: 28px;
  }
  .ww-award-stat {
    display: inline-flex; align-items: center; gap: 8px;
    background: var(--ww-card); border: 1px solid var(--ww-border);
    padding: 8px 22px; border-radius: 24px;
    font-family: 'DM Sans', sans-serif;
    font-size: 14px; color: var(--ww-accent); letter-spacing: 0.04em;
  }

  /* ── Thank you ── */
  .ww-heart {
    font-size: 80px; margin-bottom: 32px;
    display: inline-block; animation: wwPulse 2.5s ease-in-out infinite;
  }
  @keyframes wwPulse {
    0%, 100% { transform: scale(1); }
    50%       { transform: scale(1.1); }
  }
  .ww-thanks-from {
    font-family: 'DM Sans', sans-serif;
    font-size: 14px; letter-spacing: 0.18em; text-transform: uppercase;
    color: var(--ww-muted); margin-bottom: 18px;
  }
  .ww-thanks-names {
    font-family: 'Cormorant Garamond', serif;
    font-size: clamp(36px, 6vw, 72px);
    color: var(--ww-text); font-weight: 300; margin-bottom: 12px;
  }
  .ww-thanks-date {
    font-family: 'Cormorant Garamond', serif;
    font-size: clamp(18px, 2.8vw, 32px);
    color: var(--ww-accent); font-style: italic;
  }
  .ww-thanks-closer {
    font-family: 'DM Sans', sans-serif;
    font-size: clamp(12px, 1.4vw, 15px);
    color: var(--ww-muted);
    letter-spacing: 0.14em; text-transform: uppercase;
    margin-top: 24px;
  }

  /* ── Controls ── */
  .ww-controls {
    position: fixed; bottom: 28px; left: 50%; transform: translateX(-50%);
    display: flex; align-items: center; gap: 6px;
    background: rgba(20, 13, 4, 0.88);
    border: 1px solid rgba(201,168,76,0.18);
    border-radius: 40px; padding: 7px 14px;
    backdrop-filter: blur(10px); z-index: 100;
  }
  .ww-btn {
    width: 36px; height: 36px; border-radius: 50%;
    border: 1.5px solid rgba(201,168,76,0.22);
    background: transparent; color: var(--ww-text);
    cursor: pointer; font-size: 15px;
    display: flex; align-items: center; justify-content: center;
    transition: all 0.15s; flex-shrink: 0; line-height: 1;
  }
  .ww-btn:hover:not(:disabled) { background: rgba(201,168,76,0.14); border-color: var(--gold); }
  .ww-btn:disabled { opacity: 0.28; cursor: default; }
  .ww-btn.active { background: rgba(201,168,76,0.18); border-color: var(--gold); color: var(--gold); }
  .ww-counter {
    font-family: 'DM Sans', sans-serif;
    font-size: 12px; color: var(--ww-muted);
    letter-spacing: 0.1em; min-width: 50px; text-align: center;
  }
  .ww-sep { width: 1px; height: 20px; background: rgba(201,168,76,0.14); margin: 0 3px; }

  /* ── Progress bar ── */
  .ww-progress {
    position: fixed; top: 0; left: 0; right: 0;
    display: flex; gap: 4px;
    padding: 10px 12px 6px;
    z-index: 99; pointer-events: none;
  }
  .ww-progress-seg {
    flex: 1; height: 3px; border-radius: 2px;
    background: rgba(255,255,255,0.15); overflow: hidden;
  }
  .ww-progress-fill {
    height: 100%; border-radius: 2px;
    background: var(--ww-accent);
  }
  .ww-fill-done   { width: 100%; }
  .ww-fill-active { width: 0%; animation: wwProgressFill 8s linear forwards; }
  .ww-fill-static { width: 100%; opacity: 0.4; }
  @keyframes wwProgressFill {
    from { width: 0%; }
    to   { width: 100%; }
  }

  /* ── No-data ── */
  .ww-no-data {
    height: 100svh; display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    background: #1a1208; text-align: center; gap: 16px; padding: 32px;
  }
  .ww-no-data .ww-nd-title {
    font-family: 'Cormorant Garamond', serif;
    font-size: 28px; color: var(--gold-light);
  }
  .ww-no-data .ww-nd-sub {
    font-family: 'DM Sans', sans-serif;
    font-size: 15px; color: rgba(232,213,163,0.45); max-width: 360px; line-height: 1.6;
  }

  @media (max-width: 640px) {
    .ww-slide { padding: 40px 24px 100px; }
    .ww-numbers { gap: 16px; }
    .ww-number-card { padding: 18px 22px; min-width: 120px; }
  }

  @media (prefers-reduced-motion: reduce) {
    .ww-slide,
    .ww-slide-wrapper.ww-exiting .ww-slide { animation: none; }
    .ww-heart { animation: none; }
    .ww-word  { animation: none; }
    .ww-progress-fill { animation: none; width: 100%; }
  }
`;

// ─── SLIDE COMPONENTS ────────────────────────────────────────────────────────

function TitleSlide({ wedding, totalWishes, bg }) {
  const names = wedding?.bride_name && wedding?.groom_name
    ? `${wedding.bride_name} & ${wedding.groom_name}` : null;
  return (
    <div className="ww-slide" style={bg ? { background: bg } : {}}>
      <Sparkle size={52} color="var(--ww-accent)" weight="light" style={{ marginBottom: 20, opacity: 0.85 }} />
      <div className="ww-slide-label">Your Wedding</div>
      <div className="ww-slide-title">
        Wedding Wishes<br />Wrapped
      </div>
      {names && <div className="ww-slide-subtitle">{names}</div>}
      <div className="ww-slide-meta">
        {totalWishes} heartfelt {totalWishes === 1 ? 'message' : 'messages'} from your guests
      </div>
    </div>
  );
}

function ParticipationSlide({ totalWishes, totalGuests, participationRate, topOpeningWord, bg }) {
  const pct   = Math.round((participationRate ?? 0) * 100);
  const comment = participationComment(participationRate ?? 0, totalWishes);
  const silent  = totalGuests - totalWishes;

  return (
    <div className="ww-slide" style={bg ? { background: bg } : {}}>
      <div className="ww-slide-label">Who Left Well Wishes</div>

      {/* Fraction */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '14px', lineHeight: 1, marginBottom: '8px' }}>
        <span className="ww-number-value" style={{ fontSize: 'clamp(80px, 14vw, 140px)' }}>
          {totalWishes}
        </span>
        <span style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 'clamp(18px, 3vw, 34px)',
          color: 'var(--ww-muted)',
          paddingBottom: 'clamp(12px, 2vw, 22px)',
        }}>
          / {totalGuests} guests
        </span>
      </div>

      {/* Percentage */}
      <div className="ww-slide-title" style={{ fontSize: 'clamp(60px, 10vw, 110px)', marginBottom: '20px' }}>
        {pct}%
      </div>

      {/* Witty comment */}
      <div style={{
        fontFamily: "'Cormorant Garamond', serif",
        fontSize: 'clamp(20px, 2.8vw, 32px)',
        color: 'var(--ww-accent)', fontStyle: 'italic',
        marginBottom: silent > 0 ? '20px' : '0',
      }}>
        {comment}
      </div>

      {silent > 0 && (
        <div className="ww-slide-meta">
          {silent} guest{silent !== 1 ? 's' : ''} came but said nothing 🤐
        </div>
      )}

      {topOpeningWord && (
        <div className="ww-slide-meta" style={{ marginTop: '16px' }}>
          {topOpeningWord.count} guests opened with "{topOpeningWord.word}"
        </div>
      )}
    </div>
  );
}

function SilenceSlide({ silentGuests, bg }) {
  return (
    <div className="ww-slide" style={bg ? { background: bg } : {}}>
      <div className="ww-slide-emoji">🤐</div>
      <div className="ww-slide-label">Hall of Silence</div>
      <div className="ww-slide-title" style={{ fontSize: 'clamp(28px, 4.5vw, 56px)', marginBottom: '10px' }}>
        These guests came,<br />ate the food, and...
      </div>
      <div className="ww-slide-subtitle" style={{ fontStyle: 'normal', marginBottom: '36px' }}>
        said absolutely nothing
      </div>

      <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '40px' }}>
        {silentGuests.map((g, i) => (
          <div key={g.id ?? i} style={{
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '10px', padding: '12px 22px',
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 'clamp(18px, 2.8vw, 34px)',
            color: 'var(--ww-muted)', lineHeight: 1.2,
          }}>
            {g.name}
          </div>
        ))}
      </div>

      <div style={{
        fontFamily: "'DM Sans', sans-serif",
        fontSize: 'clamp(15px, 1.8vw, 20px)',
        color: 'var(--ww-accent)', letterSpacing: '0.05em',
      }}>
        🎤 MC — time to give them the mike!
      </div>
    </div>
  );
}

function NumbersSlide({ totalWishes, totalWords, avgLength, novelPages, bg }) {
  return (
    <div className="ww-slide" style={bg ? { background: bg } : {}}>
      <div className="ww-slide-label">By the Numbers</div>
      <div className="ww-slide-subtitle" style={{ fontStyle: 'normal', marginBottom: '36px' }}>
        Your guests really showed up in words
      </div>
      <div className="ww-numbers">
        {[
          { icon: '💬', value: totalWishes,                  label: 'Wishes written' },
          { icon: '📝', value: totalWords.toLocaleString(),  label: 'Total words' },
          { icon: '✍️', value: avgLength,                    label: 'Words on average' },
        ].map(({ icon, value, label }) => (
          <div key={label} className="ww-number-card">
            <div className="ww-number-icon">{icon}</div>
            <div className="ww-number-value">{value}</div>
            <div className="ww-number-label">{label}</div>
          </div>
        ))}
      </div>
      {novelPages >= 1 && (
        <div className="ww-slide-meta" style={{ marginTop: '28px' }}>
          That's {novelPages} page{novelPages !== 1 ? 's' : ''} of a novel — your love story continues 📖
        </div>
      )}
    </div>
  );
}

function SideVsSideSlide({ sides, wedding, bg }) {
  const brideName = wedding?.bride_name || 'Bride';
  const groomName = wedding?.groom_name || 'Groom';

  const rows = [
    { label: 'Messages',     b: sides.bride.wishers,    g: sides.groom.wishers },
    { label: 'Avg Words',    b: sides.bride.avgWords,   g: sides.groom.avgWords },
    { label: 'Total Emojis', b: sides.bride.emojiCount, g: sides.groom.emojiCount },
  ];

  let brideWins = 0, groomWins = 0;
  for (const r of rows) {
    if (r.b > r.g) brideWins++;
    else if (r.g > r.b) groomWins++;
  }

  const verdict = brideWins > groomWins
    ? `💐 ${brideName}'s side wins ${brideWins}:${groomWins}`
    : groomWins > brideWins
    ? `🤵 ${groomName}'s side wins ${groomWins}:${brideWins}`
    : 'Love wins on both sides 💝';

  const nameStyle = {
    fontFamily: "'Cormorant Garamond', serif",
    fontSize: 'clamp(20px, 3.2vw, 36px)',
    color: 'var(--ww-text)',
    paddingBottom: '16px',
  };
  const divider = <div style={{ height: '1px', background: 'var(--ww-border)', margin: '4px 0 16px' }} />;

  return (
    <div className="ww-slide" style={bg ? { background: bg } : {}}>
      <div className="ww-slide-label">Bride's Side vs Groom's Side</div>

      <div style={{ width: '100%', maxWidth: '640px', marginTop: '8px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-end', marginBottom: '4px' }}>
          <div style={{ ...nameStyle, flex: 1, textAlign: 'right' }}>💐 {brideName}</div>
          <div style={{ flex: '0 0 90px' }} />
          <div style={{ ...nameStyle, flex: 1, textAlign: 'left' }}>🤵 {groomName}</div>
        </div>

        {divider}

        {rows.map(({ label, b, g }) => {
          const bWins = b > g, gWins = g > b;
          return (
            <div key={label} style={{ display: 'flex', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{
                flex: 1, textAlign: 'right',
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: 'clamp(36px, 6vw, 68px)',
                lineHeight: 1.05,
                color: bWins ? 'var(--ww-text)' : 'var(--ww-muted)',
                fontWeight: bWins ? 600 : 300,
              }}>{b}</div>
              <div style={{
                flex: '0 0 90px', textAlign: 'center',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 'clamp(9px, 1.1vw, 12px)',
                textTransform: 'uppercase', letterSpacing: '0.1em',
                color: 'var(--ww-muted)', lineHeight: 1.3,
              }}>{label}</div>
              <div style={{
                flex: 1,
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: 'clamp(36px, 6vw, 68px)',
                lineHeight: 1.05,
                color: gWins ? 'var(--ww-text)' : 'var(--ww-muted)',
                fontWeight: gWins ? 600 : 300,
              }}>{g}</div>
            </div>
          );
        })}

        {divider}
      </div>

      <div className="ww-slide-subtitle" style={{ fontStyle: 'normal', marginBottom: 0 }}>{verdict}</div>
    </div>
  );
}

function ClustersSlide({ clusters, bg }) {
  const items = [
    { icon: '✍️', label: 'The Essayists',  desc: '40+ words',       count: clusters.essayists },
    { icon: '💬', label: 'Brief & Sweet',  desc: 'Under 10 words',  count: clusters.brief },
    { icon: '😄', label: 'Emoji People',   desc: '2+ emojis',       count: clusters.emojiLovers },
    { icon: '🎉', label: 'The Loud Ones',  desc: '2+ exclamations', count: clusters.shouty },
  ];

  return (
    <div className="ww-slide" style={bg ? { background: bg } : {}}>
      <div className="ww-slide-label">Guest Personality Report</div>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '16px', width: '100%', maxWidth: '620px', marginTop: '16px',
      }}>
        {items.map(({ icon, label, desc, count }) => (
          <div key={label} style={{
            background: 'var(--ww-card)', border: '1px solid var(--ww-border)',
            borderRadius: '16px', padding: '26px 20px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
          }}>
            <div style={{ fontSize: '36px', lineHeight: 1 }}>{icon}</div>
            <div className="ww-number-value" style={{ fontSize: 'clamp(38px, 6.5vw, 70px)' }}>{count}</div>
            <div style={{
              fontFamily: "'DM Sans', sans-serif", fontSize: '13px',
              color: 'var(--ww-accent)', fontWeight: 600, textAlign: 'center',
            }}>{label}</div>
            <div style={{
              fontFamily: "'DM Sans', sans-serif", fontSize: '11px',
              color: 'var(--ww-muted)', textTransform: 'uppercase', letterSpacing: '0.08em',
            }}>{desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function WordCloudSlide({ topWords, vibrant, bg }) {
  const maxCount = topWords[0]?.count || 1;
  const minCount = topWords[topWords.length - 1]?.count || 1;

  // Deterministic display order — stable between renders
  const ordered = useMemo(() => (
    [...topWords].sort((a, b) => {
      const ha = (a.word.charCodeAt(0) * 7 + a.word.length * 3) % 29;
      const hb = (b.word.charCodeAt(0) * 7 + b.word.length * 3) % 29;
      return ha - hb;
    })
  ), [topWords]);

  const scale = (count) => {
    if (maxCount === minCount) return 32;
    return Math.round(14 + ((count - minCount) / (maxCount - minCount)) * 52);
  };
  const opacity = (count) => {
    const ratio = (count - minCount) / Math.max(maxCount - minCount, 1);
    return 0.45 + ratio * 0.55;
  };

  return (
    <div className="ww-slide" style={bg ? { background: bg } : {}}>
      <div className="ww-slide-label">Most Mentioned Words</div>
      <div className="ww-slide-subtitle" style={{ fontStyle: 'normal', marginBottom: '32px' }}>
        The words your guests kept coming back to
      </div>
      <div className="ww-word-cloud">
        {ordered.map(({ word, count }, i) => (
          <span
            key={word}
            className="ww-word"
            style={{
              '--i':     i,
              fontSize:  `${scale(count)}px`,
              opacity:   vibrant ? undefined : opacity(count),
              color:     vibrant ? VIBRANT_WORD_COLORS[i % VIBRANT_WORD_COLORS.length] : undefined,
            }}
          >
            {word}
          </span>
        ))}
      </div>
    </div>
  );
}

function EmojiSlide({ topEmoji, topEmojiRanking, totalEmojis, bg }) {
  return (
    <div className="ww-slide" style={bg ? { background: bg } : {}}>
      <div className="ww-slide-label">The Emoji Report</div>

      <div style={{ fontSize: 'clamp(80px, 16vw, 150px)', lineHeight: 1, marginBottom: '16px' }}>
        {topEmoji.emoji}
      </div>

      <div className="ww-slide-subtitle" style={{ fontStyle: 'normal', marginBottom: '8px' }}>
        sent {topEmoji.count} {topEmoji.count === 1 ? 'time' : 'times'} — your most loved emoji
      </div>

      <div className="ww-slide-meta" style={{ marginBottom: '28px' }}>
        {totalEmojis} emojis across all messages
      </div>

      {topEmojiRanking.length > 1 && (
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
          {topEmojiRanking.map(({ emoji, count }) => (
            <div key={emoji} style={{
              background: 'var(--ww-card)', border: '1px solid var(--ww-border)',
              borderRadius: '12px', padding: '10px 16px',
              display: 'flex', alignItems: 'center', gap: '8px',
            }}>
              <span style={{ fontSize: '26px', lineHeight: 1 }}>{emoji}</span>
              <span style={{
                fontFamily: "'DM Sans', sans-serif", fontSize: '16px',
                color: 'var(--ww-accent)', fontWeight: 600,
              }}>×{count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AwardSlide({ icon, title, award, bg }) {
  const preview = (award.guest.rsvp_message || '').length > 220
    ? award.guest.rsvp_message.slice(0, 217) + '…'
    : award.guest.rsvp_message;
  return (
    <div className="ww-slide" style={bg ? { background: bg } : {}}>
      <div className="ww-slide-emoji">{icon}</div>
      <div className="ww-award-badge">{title}</div>
      <div className="ww-award-name">{award.guest.name}</div>
      {preview && <div className="ww-award-quote">{preview}</div>}
      <div className="ww-award-stat">{award.value} {award.label}</div>
    </div>
  );
}

function ThankYouSlide({ wedding, bg }) {
  const names = wedding?.bride_name && wedding?.groom_name
    ? `${wedding.bride_name} & ${wedding.groom_name}` : null;
  const date = wedding?.wedding_date
    ? new Date(wedding.wedding_date + 'T00:00:00').toLocaleDateString('en-SG', {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    : null;
  return (
    <div className="ww-slide" style={bg ? { background: bg } : {}}>
      <div className="ww-heart">♡</div>
      <div className="ww-thanks-from">From everyone who loves you</div>
      {names && <div className="ww-thanks-names">{names}</div>}
      {date && <div className="ww-thanks-date">{date}</div>}
      <div className="ww-thanks-closer">Thank you for being part of our story</div>
    </div>
  );
}

// ─── SLIDE BUILDER ───────────────────────────────────────────────────────────

const AWARD_DEFS = [
  { key: 'mostWords',        icon: '✍️',  title: 'Most Words Written' },
  { key: 'mostEnthusiastic', icon: '🎉',  title: 'Most Enthusiastic' },
  { key: 'mostEmoji',        icon: '😄',  title: 'Emoji Champion' },
  { key: 'mostPoetic',       icon: '🌸',  title: 'Most Poetic' },
  { key: 'fewestWords',      icon: '💌',  title: 'Keeping It Short & Sweet' },
];

// enabledSlides is a Set of slide keys. Empty set = show all (backwards compatible).
function buildSlides(data, wedding, theme, enabledSlides) {
  const isVibrant = theme === 'vibrant';
  const vbg = (key) => isVibrant ? (VBG[key] ?? null) : null;
  const on = (key) => !enabledSlides?.size || enabledSlides.has(key);

  const slides = [
    <TitleSlide key="title" wedding={wedding} totalWishes={data.totalWishes} bg={vbg('title')} />,
  ];

  if (on('participation')) {
    slides.push(
      <ParticipationSlide
        key="participation"
        totalWishes={data.totalWishes}
        totalGuests={data.totalGuests ?? 0}
        participationRate={data.participationRate ?? 0}
        topOpeningWord={data.topOpeningWord ?? null}
        bg={vbg('participate')}
      />
    );
  }

  // Hall of Silence — after participation for narrative flow
  if (on('silence') && (data.silentGuests?.length ?? 0) > 0) {
    slides.push(
      <SilenceSlide key="silence" silentGuests={data.silentGuests} bg={vbg('silence')} />
    );
  }

  if (on('numbers')) {
    slides.push(
      <NumbersSlide
        key="numbers"
        totalWishes={data.totalWishes}
        totalWords={data.totalWords}
        avgLength={data.avgLength}
        novelPages={data.novelPages ?? 0}
        bg={vbg('numbers')}
      />
    );
  }

  if (on('sides') && data.sides?.bride?.total > 0 && data.sides?.groom?.total > 0) {
    slides.push(<SideVsSideSlide key="sides" sides={data.sides} wedding={wedding} bg={vbg('sides')} />);
  }

  if (on('clusters') && data.totalWishes >= 3 && data.clusters) {
    slides.push(<ClustersSlide key="clusters" clusters={data.clusters} bg={vbg('clusters')} />);
  }

  if (on('words') && data.topWords.length >= 3) {
    slides.push(<WordCloudSlide key="words" topWords={data.topWords} vibrant={isVibrant} bg={vbg('words')} />);
  }

  if (on('emoji') && (data.totalEmojis ?? 0) > 0 && data.topEmoji) {
    slides.push(
      <EmojiSlide
        key="emoji"
        topEmoji={data.topEmoji}
        topEmojiRanking={data.topEmojiRanking ?? [data.topEmoji]}
        totalEmojis={data.totalEmojis}
        bg={vbg('emoji')}
      />
    );
  }

  if (on('awards')) {
    AWARD_DEFS.forEach(({ key, icon, title }, i) => {
      if (data.awards[key]) {
        slides.push(
          <AwardSlide
            key={key}
            icon={icon}
            title={title}
            award={data.awards[key]}
            bg={isVibrant ? VBG.awards[i % VBG.awards.length] : null}
          />
        );
      }
    });
  }

  slides.push(<ThankYouSlide key="thanks" wedding={wedding} bg={vbg('thanks')} />);
  return slides;
}

// ─── MAIN PAGE ───────────────────────────────────────────────────────────────

export default function WishesWrappedPage() {
  // Read localStorage once at mount via lazy initializer — avoids cascading setState calls in effects.
  const [session] = useState(() => {
    try {
      const raw = localStorage.getItem('wishesWrappedSession');
      if (raw) return JSON.parse(raw);
    } catch { /* malformed — show no-data screen */ }
    return null;
  });

  const data         = session?.wrapped  ?? null;
  const wedding      = session?.wedding  ?? null;
  const pageTheme    = session?.theme    ?? 'elegant';
  const enabledSlides = useMemo(
    () => new Set(session?.enabledSlides ?? []),
    [session],
  );

  const [idx, setIdx]           = useState(0);
  const [exiting, setExiting]   = useState(false);
  const [autoPlay, setAutoPlay] = useState(false);
  const [isFullscreen, setFs]   = useState(false);
  const exitTimer               = useRef(null);

  useEffect(() => { document.title = 'Wedding Wishes Wrapped'; }, []);

  useEffect(() => {
    const bg = pageTheme === 'vibrant' ? '#000000' : pageTheme === 'midnight' ? '#06080f' : '#1a1208';
    const prev = { overflow: document.body.style.overflow, bg: document.body.style.background };
    document.body.style.overflow = 'hidden';
    document.body.style.background = bg;
    return () => {
      document.body.style.overflow = prev.overflow;
      document.body.style.background = prev.bg;
    };
  }, [pageTheme]);

  const slides = useMemo(
    () => (data ? buildSlides(data, wedding, pageTheme, enabledSlides) : []),
    [data, wedding, pageTheme, enabledSlides],
  );

  const navigate = useCallback((newIdxFn) => {
    if (exitTimer.current) return;
    setExiting(true);
    exitTimer.current = setTimeout(() => {
      setIdx(newIdxFn);
      setExiting(false);
      exitTimer.current = null;
    }, 150);
  }, []);

  const prev = useCallback(() => navigate(i => Math.max(0, i - 1)), [navigate]);
  const next = useCallback(
    () => navigate(i => (slides.length ? Math.min(slides.length - 1, i + 1) : i)),
    [navigate, slides.length],
  );

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); next(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [next, prev]);

  useEffect(() => {
    if (!autoPlay || !slides.length) return;
    const timer = setInterval(() => {
      navigate(i => {
        if (i >= slides.length - 1) { setAutoPlay(false); return i; }
        return i + 1;
      });
    }, 8000);
    return () => clearInterval(timer);
  }, [autoPlay, slides.length, navigate]);

  useEffect(() => () => { if (exitTimer.current) clearTimeout(exitTimer.current); }, []);

  useEffect(() => {
    const handler = () => setFs(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const toggleFs = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => {});
  };

  if (!data) {
    return (
      <>
        <style>{wwStyles}</style>
        <div className="ww-no-data">
          <Sparkle size={48} color="var(--ww-accent)" weight="light" style={{ opacity: 0.6, marginBottom: 8 }} />
          <div className="ww-nd-title">No data found</div>
          <div className="ww-nd-sub">
            Open the <strong>Wishes Wrapped</strong> tab in the admin panel,
            click <em>Generate Wrapped</em>, then click <em>Open Presentation</em>.
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{wwStyles}</style>
      <div
        className={`ww-page${pageTheme === 'vibrant' ? ' vibrant' : pageTheme === 'midnight' ? ' midnight' : ''}`}
        onClick={(e) => {
          if (e.target.closest?.('.ww-controls')) return;
          if (e.clientX < window.innerWidth / 2) prev(); else next();
        }}
      >
        <div className="ww-progress">
          {slides.map((_, i) => (
            <div key={i} className="ww-progress-seg">
              {i < idx && <div className="ww-progress-fill ww-fill-done" />}
              {i === idx && autoPlay && <div className="ww-progress-fill ww-fill-active" />}
              {i === idx && !autoPlay && <div className="ww-progress-fill ww-fill-static" />}
            </div>
          ))}
        </div>

        <div className={`ww-slide-wrapper${exiting ? ' ww-exiting' : ''}`}>
          {slides[idx] ?? null}
        </div>

        <div className="ww-controls">
          <button className="ww-btn" onClick={prev} disabled={idx === 0} title="Previous (←)">
            <ArrowLeft size={15} />
          </button>
          <span className="ww-counter">{idx + 1} / {slides.length}</span>
          <button className="ww-btn" onClick={next} disabled={idx === slides.length - 1} title="Next (→)">
            <ArrowRight size={15} />
          </button>
          <div className="ww-sep" />
          <button
            className={`ww-btn ${autoPlay ? 'active' : ''}`}
            onClick={() => setAutoPlay(v => !v)}
            title={autoPlay ? 'Pause' : 'Auto-advance (8s)'}
          >
            {autoPlay ? <Pause size={14} weight="fill" /> : <Play size={14} weight="fill" />}
          </button>
          <button className="ww-btn" onClick={toggleFs} title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
            {isFullscreen ? <CornersIn size={15} /> : <CornersOut size={15} />}
          </button>
        </div>
      </div>
    </>
  );
}
