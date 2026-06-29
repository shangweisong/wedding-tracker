import { useState, useMemo } from 'react';
import { computeWrapped } from './wishesWrapped.js';

export default function WishesWrappedTab({ guests, wedding }) {
  const [wrappedData, setWrappedData] = useState(null);

  const wishers = useMemo(
    () => guests.filter(g => (g.rsvp_message || '').trim().length > 0),
    [guests],
  );

  const generate = () => {
    setWrappedData(computeWrapped(guests));
  };

  const openPresentation = () => {
    if (!wrappedData) return;
    localStorage.setItem('wishesWrappedSession', JSON.stringify({ wrapped: wrappedData, wedding: wedding ?? null }));
    window.open('/wishes-wrapped', '_blank', 'noopener,noreferrer');
  };

  if (wishers.length === 0) {
    return (
      <div className="content">
        <div className="empty">
          <div className="empty-icon">💌</div>
          <div className="empty-text">No messages yet</div>
          <div className="empty-sub">
            Once guests RSVP with well wishes, they'll appear here for Wishes Wrapped.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="content">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '22px', color: 'var(--charcoal)', fontWeight: 500, margin: 0 }}>
            ✨ Wedding Wishes Wrapped
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--brown)', opacity: 0.7, marginTop: '4px' }}>
            {wishers.length} guest{wishers.length !== 1 ? 's' : ''} left well wishes
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button className="btn btn-outline" onClick={generate}>
            {wrappedData ? '↺ Regenerate' : '✨ Generate Wrapped'}
          </button>
          {wrappedData && (
            <button className="btn btn-gold" onClick={openPresentation}>
              ▶ Open Presentation
            </button>
          )}
        </div>
      </div>

      {/* Pre-generate placeholder */}
      {!wrappedData ? (
        <div style={{
          textAlign: 'center', padding: '52px 24px',
          border: '2px dashed rgba(201,168,76,0.2)', borderRadius: '16px',
          color: 'var(--brown)',
        }}>
          <div style={{ fontSize: '40px', marginBottom: '14px' }}>✨</div>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '20px', marginBottom: '8px' }}>
            Ready to generate your Wrapped
          </div>
          <div style={{ fontSize: '13px', opacity: 0.65 }}>
            Click "Generate Wrapped" to analyse {wishers.length} guest {wishers.length === 1 ? 'message' : 'messages'}
          </div>
        </div>
      ) : (
        <>
          {/* Stats strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '24px' }}>
            {[
              { icon: '💬', value: wrappedData.totalWishes,                 label: 'Wishes' },
              { icon: '📝', value: wrappedData.totalWords.toLocaleString(), label: 'Total words' },
              { icon: '✍️', value: wrappedData.avgLength,                   label: 'Avg. length' },
              { icon: '🏆', value: Object.keys(wrappedData.awards).length,  label: 'Awards' },
            ].map(({ icon, value, label }) => (
              <div key={label} style={{
                background: 'white', borderRadius: '12px', padding: '18px 16px',
                border: '1.5px solid rgba(201,168,76,0.15)',
                boxShadow: 'var(--shadow)', textAlign: 'center',
              }}>
                <div style={{ fontSize: '26px', marginBottom: '6px' }}>{icon}</div>
                <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '30px', color: 'var(--charcoal)' }}>{value}</div>
                <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--brown)', opacity: 0.55, marginTop: '2px' }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Top words */}
          {wrappedData.topWords.length > 0 && (
            <div style={{
              background: 'white', borderRadius: '12px', padding: '18px 22px',
              border: '1.5px solid rgba(201,168,76,0.15)', boxShadow: 'var(--shadow)', marginBottom: '20px',
            }}>
              <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--brown)', opacity: 0.55, marginBottom: '12px' }}>
                Top Words
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {wrappedData.topWords.slice(0, 16).map(({ word, count }) => (
                  <span key={word} style={{
                    background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.22)',
                    padding: '4px 12px', borderRadius: '20px',
                    fontSize: `${Math.max(12, Math.min(20, 10 + count * 2))}px`,
                    color: 'var(--brown)', fontFamily: "'Cormorant Garamond', serif",
                    display: 'inline-flex', alignItems: 'center', gap: '5px',
                  }}>
                    {word}
                    <span style={{ fontSize: '10px', opacity: 0.5, fontFamily: "'DM Sans', sans-serif" }}>{count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Messages list */}
          <div style={{
            background: 'white', borderRadius: '12px',
            border: '1.5px solid rgba(201,168,76,0.15)', boxShadow: 'var(--shadow)', overflow: 'hidden',
          }}>
            <div style={{
              padding: '14px 22px', borderBottom: '1px solid rgba(201,168,76,0.1)',
              fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--brown)', opacity: 0.55,
            }}>
              All Messages ({wishers.length})
            </div>
            <div style={{ maxHeight: '420px', overflowY: 'auto' }}>
              {wishers.map((g) => (
                <div key={g.id} style={{
                  padding: '13px 22px', borderBottom: '1px solid rgba(201,168,76,0.07)',
                  display: 'flex', gap: '14px', alignItems: 'flex-start',
                }}>
                  <div style={{ flexShrink: 0, fontWeight: 500, fontSize: '13px', color: 'var(--charcoal)', minWidth: '130px', paddingTop: '1px' }}>
                    {g.name}
                  </div>
                  <div style={{ fontSize: '14px', color: 'var(--brown)', fontStyle: 'italic', lineHeight: 1.55 }}>
                    "{g.rsvp_message}"
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
