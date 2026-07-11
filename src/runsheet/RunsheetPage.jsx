import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { sb } from "../lib/supabase.js";
import { theme } from "../shared/theme.js";
import { ClipboardText } from "@phosphor-icons/react";

const styles = theme + `
  .rs-page {
    min-height: 100svh;
    background: var(--warm-white);
    font-family: 'DM Sans', sans-serif;
  }

  .rs-page-header {
    background: var(--charcoal);
    padding: 32px 24px;
    text-align: center;
    box-shadow: 0 2px 20px rgba(0,0,0,0.25);
  }
  .rs-page-couple {
    font-family: 'Cormorant Garamond', serif;
    font-size: 32px;
    font-weight: 400;
    color: var(--gold-light);
    letter-spacing: 0.05em;
    margin-bottom: 4px;
  }
  .rs-page-subtitle {
    font-size: 11px;
    color: rgba(255,255,255,0.35);
    text-transform: uppercase;
    letter-spacing: 0.15em;
    margin-bottom: 10px;
  }
  .rs-page-meta {
    font-size: 13px;
    color: rgba(255,255,255,0.45);
  }

  .rs-page-content {
    max-width: 760px;
    margin: 0 auto;
    padding: 32px 16px 56px;
  }

  /* ── Timeline ── */
  .rs-timeline {
    background: white;
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    overflow: hidden;
  }

  .rs-tl-item {
    display: flex;
    gap: 0;
    border-bottom: 1px solid rgba(201,168,76,0.1);
    transition: background 0.15s;
  }
  .rs-tl-item:last-child { border-bottom: none; }
  .rs-tl-item:hover { background: rgba(201,168,76,0.03); }

  .rs-tl-time {
    width: 76px;
    flex-shrink: 0;
    font-size: 12px;
    font-weight: 600;
    color: var(--gold-dark);
    text-align: right;
    padding: 18px 14px 18px 16px;
    line-height: 1.3;
  }

  .rs-tl-gutter {
    width: 20px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding-top: 21px;
  }
  .rs-tl-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--gold);
    flex-shrink: 0;
  }
  .rs-tl-vline {
    width: 1px;
    flex: 1;
    background: rgba(201,168,76,0.18);
    margin-top: 5px;
    margin-bottom: -1px;
  }
  .rs-tl-item:last-child .rs-tl-vline { display: none; }

  .rs-tl-body {
    flex: 1;
    min-width: 0;
    padding: 16px 20px 16px 10px;
  }

  .rs-tl-event {
    font-size: 14px;
    font-weight: 500;
    color: var(--charcoal);
    line-height: 1.3;
    margin-bottom: 3px;
  }

  .rs-tl-meta {
    font-size: 11px;
    color: var(--brown);
    opacity: 0.55;
  }

  .rs-tl-comments {
    font-size: 12px;
    color: var(--brown);
    opacity: 0.5;
    font-style: italic;
    margin-top: 6px;
    white-space: pre-wrap;
    line-height: 1.55;
  }

  /* ── Empty state ── */
  .rs-page-empty {
    text-align: center;
    padding: 60px 20px;
    color: var(--brown);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    background: white;
    border-radius: var(--radius);
    box-shadow: var(--shadow);
  }
  .rs-page-empty-text { font-size: 14px; opacity: 0.45; }

  /* ── Footer ── */
  .rs-page-footer {
    text-align: center;
    padding: 20px;
    font-size: 20px;
    color: var(--gold);
    opacity: 0.25;
  }

  /* ── Loading / not found ── */
  .rs-loading, .rs-not-found {
    min-height: 100svh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: var(--warm-white);
    gap: 14px;
  }
  .rs-not-found-text {
    font-size: 16px;
    color: var(--charcoal);
    opacity: 0.45;
    font-family: 'Cormorant Garamond', serif;
  }

  @media (max-width: 480px) {
    .rs-tl-time { width: 60px; font-size: 11px; padding: 16px 10px 16px 12px; }
    .rs-tl-body { padding: 14px 16px 14px 8px; }
  }
`;

function formatDate(dateStr) {
  if (!dateStr) return "";
  try {
    return new Date(dateStr + "T00:00:00").toLocaleDateString("en-SG", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export default function RunsheetPage() {
  const { slug } = useParams();
  const [wedding, setWedding] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const rows = await sb.rpc("get_public_runsheet", { p_slug: slug });
        if (Array.isArray(rows) && rows.length > 0 && rows[0].is_runsheet_published) {
          setWedding(rows[0]);
        } else {
          setNotFound(true);
        }
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [slug]);

  if (loading) {
    return (
      <div className="rs-loading">
        <style>{styles}</style>
        <div style={{ color: "var(--brown)", opacity: 0.4, fontSize: 14 }}>Loading…</div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="rs-not-found">
        <style>{styles}</style>
        <ClipboardText size={36} color="var(--brown)" style={{ opacity: 0.3 }} />
        <div className="rs-not-found-text">This runsheet is not available.</div>
      </div>
    );
  }

  const items = Array.isArray(wedding.runsheet) ? wedding.runsheet : [];

  return (
    <div className="rs-page">
      <style>{styles}</style>

      <header className="rs-page-header">
        <div className="rs-page-subtitle">Wedding Day Runsheet</div>
        <div className="rs-page-couple">{wedding.bride_name} &amp; {wedding.groom_name}</div>
        <div className="rs-page-meta">
          {formatDate(wedding.wedding_date)}{wedding.venue_name ? ` · ${wedding.venue_name}` : ""}
        </div>
      </header>

      <div className="rs-page-content">
        {items.length === 0 ? (
          <div className="rs-page-empty">
            <ClipboardText size={36} color="var(--brown)" style={{ opacity: 0.3 }} />
            <div className="rs-page-empty-text">No runsheet items yet</div>
          </div>
        ) : (
          <div className="rs-timeline">
            {items.map((item) => (
              <div key={item.id} className="rs-tl-item">
                <div className="rs-tl-time">{item.time}</div>
                <div className="rs-tl-gutter">
                  <div className="rs-tl-dot" />
                  <div className="rs-tl-vline" />
                </div>
                <div className="rs-tl-body">
                  <div className="rs-tl-event">{item.event}</div>
                  {(item.duration || item.involved) && (
                    <div className="rs-tl-meta">
                      {[item.duration, item.involved].filter(Boolean).join(" · ")}
                    </div>
                  )}
                  {item.comments?.trim() && (
                    <div className="rs-tl-comments">{item.comments}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <footer className="rs-page-footer">♡</footer>
    </div>
  );
}
