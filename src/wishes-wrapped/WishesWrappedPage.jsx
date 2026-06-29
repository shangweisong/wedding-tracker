import { useState, useEffect, useCallback, useMemo } from 'react';
import { theme } from '../shared/theme.js';

const wwStyles = theme + `
  html, body { height: 100%; overflow: hidden; background: #1a1208; }

  .ww-page {
    height: 100vh;
    display: flex;
    flex-direction: column;
    background: #1a1208;
    overflow: hidden;
    position: relative;
  }

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

  .ww-slide-emoji { font-size: 64px; margin-bottom: 24px; line-height: 1; }
  .ww-slide-label {
    font-family: 'DM Sans', sans-serif;
    font-size: 13px; letter-spacing: 0.2em; text-transform: uppercase;
    color: var(--gold); margin-bottom: 24px;
  }
  .ww-slide-title {
    font-family: 'Cormorant Garamond', serif;
    font-size: clamp(44px, 8vw, 96px);
    font-weight: 300; color: var(--gold-light);
    line-height: 1.1; margin-bottom: 16px;
  }
  .ww-slide-subtitle {
    font-family: 'Cormorant Garamond', serif;
    font-size: clamp(22px, 3.5vw, 40px);
    color: var(--gold); font-style: italic; margin-bottom: 28px;
  }
  .ww-slide-meta {
    font-family: 'DM Sans', sans-serif;
    font-size: 16px; color: rgba(232,213,163,0.45); letter-spacing: 0.05em;
  }

  /* ── Numbers ── */
  .ww-numbers {
    display: flex; gap: 32px; align-items: stretch; justify-content: center; flex-wrap: wrap;
    margin-top: 8px;
  }
  .ww-number-card {
    display: flex; flex-direction: column; align-items: center; gap: 10px;
    padding: 28px 36px;
    border: 1px solid rgba(201,168,76,0.2);
    border-radius: 16px;
    background: rgba(255,255,255,0.03);
    min-width: 150px;
  }
  .ww-number-icon { font-size: 30px; }
  .ww-number-value {
    font-family: 'Cormorant Garamond', serif;
    font-size: clamp(44px, 7vw, 80px);
    color: var(--gold-light); line-height: 1; font-weight: 300;
  }
  .ww-number-label {
    font-family: 'DM Sans', sans-serif;
    font-size: 11px; letter-spacing: 0.15em; text-transform: uppercase;
    color: rgba(232,213,163,0.45);
  }

  /* ── Word cloud ── */
  .ww-word-cloud {
    display: flex; flex-wrap: wrap; gap: 10px 16px;
    align-items: center; justify-content: center;
    max-width: 900px; padding: 8px 0;
  }
  .ww-word {
    font-family: 'Cormorant Garamond', serif;
    color: var(--gold-light); line-height: 1.2;
  }

  /* ── Award ── */
  .ww-award-badge {
    font-family: 'DM Sans', sans-serif;
    font-size: 13px; letter-spacing: 0.2em; text-transform: uppercase;
    color: var(--gold); margin-bottom: 16px;
  }
  .ww-award-name {
    font-family: 'Cormorant Garamond', serif;
    font-size: clamp(34px, 5.5vw, 68px);
    color: var(--gold-light); margin-bottom: 24px; line-height: 1.1;
  }
  .ww-award-quote {
    font-family: 'Cormorant Garamond', serif;
    font-size: clamp(18px, 2.2vw, 26px);
    color: rgba(232,213,163,0.75); font-style: italic;
    max-width: 680px; line-height: 1.7; margin-bottom: 28px;
    position: relative; padding: 0 20px;
  }
  .ww-award-quote::before {
    content: '"';
    font-size: 80px; font-style: normal;
    position: absolute; top: -16px; left: -8px;
    color: var(--gold); opacity: 0.25; line-height: 1;
  }
  .ww-award-stat {
    display: inline-flex; align-items: center; gap: 8px;
    background: rgba(201,168,76,0.1); border: 1px solid rgba(201,168,76,0.22);
    padding: 8px 22px; border-radius: 24px;
    font-family: 'DM Sans', sans-serif;
    font-size: 14px; color: var(--gold); letter-spacing: 0.04em;
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
    color: rgba(232,213,163,0.4); margin-bottom: 18px;
  }
  .ww-thanks-names {
    font-family: 'Cormorant Garamond', serif;
    font-size: clamp(36px, 6vw, 72px);
    color: var(--gold-light); font-weight: 300; margin-bottom: 12px;
  }
  .ww-thanks-date {
    font-family: 'Cormorant Garamond', serif;
    font-size: clamp(18px, 2.8vw, 32px);
    color: var(--gold); font-style: italic;
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
    background: transparent; color: var(--gold-light);
    cursor: pointer; font-size: 15px;
    display: flex; align-items: center; justify-content: center;
    transition: all 0.15s; flex-shrink: 0; line-height: 1;
  }
  .ww-btn:hover:not(:disabled) { background: rgba(201,168,76,0.14); border-color: var(--gold); }
  .ww-btn:disabled { opacity: 0.28; cursor: default; }
  .ww-btn.active { background: rgba(201,168,76,0.18); border-color: var(--gold); color: var(--gold); }
  .ww-counter {
    font-family: 'DM Sans', sans-serif;
    font-size: 12px; color: rgba(232,213,163,0.45);
    letter-spacing: 0.1em; min-width: 50px; text-align: center;
  }
  .ww-sep { width: 1px; height: 20px; background: rgba(201,168,76,0.14); margin: 0 3px; }

  /* ── No-data ── */
  .ww-no-data {
    height: 100vh; display: flex; flex-direction: column;
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
`;

// ─── SLIDE COMPONENTS ────────────────────────────────────────────────────────

function TitleSlide({ wedding, totalWishes }) {
  const names = wedding?.bride_name && wedding?.groom_name
    ? `${wedding.bride_name} & ${wedding.groom_name}` : null;
  return (
    <div className="ww-slide">
      <div className="ww-slide-emoji">✨</div>
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

function NumbersSlide({ totalWishes, totalWords, avgLength }) {
  return (
    <div className="ww-slide">
      <div className="ww-slide-label">By the Numbers</div>
      <div className="ww-slide-subtitle" style={{ fontStyle: 'normal', marginBottom: '36px' }}>
        Your guests really showed up in words
      </div>
      <div className="ww-numbers">
        {[
          { icon: '💬', value: totalWishes, label: 'Wishes written' },
          { icon: '📝', value: totalWords.toLocaleString(), label: 'Total words' },
          { icon: '✍️', value: avgLength, label: 'Words on average' },
        ].map(({ icon, value, label }) => (
          <div key={label} className="ww-number-card">
            <div className="ww-number-icon">{icon}</div>
            <div className="ww-number-value">{value}</div>
            <div className="ww-number-label">{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function WordCloudSlide({ topWords }) {
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
    <div className="ww-slide">
      <div className="ww-slide-label">Most Mentioned Words</div>
      <div className="ww-slide-subtitle" style={{ fontStyle: 'normal', marginBottom: '32px' }}>
        The words your guests kept coming back to
      </div>
      <div className="ww-word-cloud">
        {ordered.map(({ word, count }) => (
          <span
            key={word}
            className="ww-word"
            style={{ fontSize: `${scale(count)}px`, opacity: opacity(count) }}
          >
            {word}
          </span>
        ))}
      </div>
    </div>
  );
}

function AwardSlide({ icon, title, award }) {
  const preview = (award.guest.rsvp_message || '').length > 220
    ? award.guest.rsvp_message.slice(0, 217) + '…'
    : award.guest.rsvp_message;
  return (
    <div className="ww-slide">
      <div className="ww-slide-emoji">{icon}</div>
      <div className="ww-award-badge">{title}</div>
      <div className="ww-award-name">{award.guest.name}</div>
      {preview && <div className="ww-award-quote">{preview}</div>}
      <div className="ww-award-stat">{award.value} {award.label}</div>
    </div>
  );
}

function ThankYouSlide({ wedding }) {
  const names = wedding?.bride_name && wedding?.groom_name
    ? `${wedding.bride_name} & ${wedding.groom_name}` : null;
  const date = wedding?.wedding_date
    ? new Date(wedding.wedding_date + 'T00:00:00').toLocaleDateString('en-SG', {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    : null;
  return (
    <div className="ww-slide">
      <div className="ww-heart">♡</div>
      <div className="ww-thanks-from">From everyone who loves you</div>
      {names && <div className="ww-thanks-names">{names}</div>}
      {date && <div className="ww-thanks-date">{date}</div>}
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

function buildSlides(data, wedding) {
  const slides = [
    <TitleSlide   key="title"   wedding={wedding} totalWishes={data.totalWishes} />,
    <NumbersSlide key="numbers" totalWishes={data.totalWishes} totalWords={data.totalWords} avgLength={data.avgLength} />,
  ];

  if (data.topWords.length >= 3) {
    slides.push(<WordCloudSlide key="words" topWords={data.topWords} />);
  }

  for (const { key, icon, title } of AWARD_DEFS) {
    if (data.awards[key]) {
      slides.push(<AwardSlide key={key} icon={icon} title={title} award={data.awards[key]} />);
    }
  }

  slides.push(<ThankYouSlide key="thanks" wedding={wedding} />);
  return slides;
}

// ─── MAIN PAGE ───────────────────────────────────────────────────────────────

export default function WishesWrappedPage() {
  const [data, setData]           = useState(null);
  const [wedding, setWedding]     = useState(null);
  const [idx, setIdx]             = useState(0);
  const [autoPlay, setAutoPlay]   = useState(false);
  const [isFullscreen, setFs]     = useState(false);
  const [loaded, setLoaded]       = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('wishesWrappedSession');
      if (raw) {
        const parsed = JSON.parse(raw);
        setData(parsed.wrapped);
        setWedding(parsed.wedding ?? null);
      }
    } catch { /* malformed storage — show no-data screen */ }
    setLoaded(true);
    document.title = 'Wedding Wishes Wrapped ✨';
  }, []);

  const slides = useMemo(
    () => (data ? buildSlides(data, wedding) : []),
    [data, wedding],
  );

  const prev = useCallback(() => setIdx(i => Math.max(0, i - 1)), []);
  const next = useCallback(
    () => setIdx(i => (slides.length ? Math.min(slides.length - 1, i + 1) : i)),
    [slides.length],
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
      setIdx(i => {
        if (i >= slides.length - 1) { setAutoPlay(false); return i; }
        return i + 1;
      });
    }, 8000);
    return () => clearInterval(timer);
  }, [autoPlay, slides.length]);

  useEffect(() => {
    const handler = () => setFs(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const toggleFs = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => {});
  };

  if (!loaded) return null;

  if (!data) {
    return (
      <>
        <style>{wwStyles}</style>
        <div className="ww-no-data">
          <div className="ww-slide-emoji">✨</div>
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
      <div className="ww-page">
        {slides[idx] ?? null}

        <div className="ww-controls">
          <button className="ww-btn" onClick={prev} disabled={idx === 0} title="Previous (←)">←</button>
          <span className="ww-counter">{idx + 1} / {slides.length}</span>
          <button className="ww-btn" onClick={next} disabled={idx === slides.length - 1} title="Next (→)">→</button>
          <div className="ww-sep" />
          <button
            className={`ww-btn ${autoPlay ? 'active' : ''}`}
            onClick={() => setAutoPlay(v => !v)}
            title={autoPlay ? 'Pause' : 'Auto-advance (8s)'}
          >
            {autoPlay ? '⏸' : '▶'}
          </button>
          <button className="ww-btn" onClick={toggleFs} title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
            {isFullscreen ? '⤡' : '⤢'}
          </button>
        </div>
      </div>
    </>
  );
}
