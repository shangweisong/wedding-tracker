import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { sb } from "../lib/supabase.js";
import { theme } from "../shared/theme.js";

const styles = theme + `
  .rs-page {
    min-height: 100vh;
    background: var(--warm-white);
    font-family: 'Inter', 'Segoe UI', sans-serif;
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
    font-size: 12px;
    color: rgba(255,255,255,0.45);
    text-transform: uppercase;
    letter-spacing: 0.12em;
    margin-bottom: 10px;
  }
  .rs-page-meta {
    font-size: 13px;
    color: rgba(255,255,255,0.5);
  }

  .rs-page-content {
    max-width: 1100px;
    margin: 0 auto;
    padding: 28px 16px 48px;
  }

  .rs-page-table-wrap {
    overflow-x: auto;
    background: white;
    border-radius: var(--radius);
    box-shadow: var(--shadow);
  }

  .rs-page-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
    min-width: 700px;
  }

  .rs-page-table thead tr { background: var(--charcoal); }
  .rs-page-table thead th {
    color: var(--gold-light);
    text-transform: uppercase;
    font-size: 11px;
    letter-spacing: 0.08em;
    padding: 12px 14px;
    text-align: left;
    font-weight: 500;
  }

  .rs-page-table tbody tr { border-bottom: 1px solid rgba(201,168,76,0.1); }
  .rs-page-table tbody tr:last-child { border-bottom: none; }
  .rs-page-table tbody tr:hover { background: rgba(201,168,76,0.04); }

  .rs-page-table td {
    padding: 10px 14px;
    vertical-align: top;
    color: var(--charcoal);
    line-height: 1.5;
  }

  .rs-page-table td.rs-td-time {
    width: 90px;
    white-space: nowrap;
    font-weight: 500;
    color: var(--brown);
  }
  .rs-page-table td.rs-td-event { width: 200px; }
  .rs-page-table td.rs-td-duration {
    width: 80px;
    white-space: nowrap;
    color: var(--brown);
    opacity: 0.7;
  }
  .rs-page-table td.rs-td-involved { width: 160px; }
  .rs-page-table td.rs-td-comments {
    white-space: pre-wrap;
    font-size: 12px;
    color: rgba(60,50,40,0.7);
  }

  .rs-page-empty {
    text-align: center;
    padding: 60px 20px;
    color: var(--brown);
    opacity: 0.45;
  }
  .rs-page-empty-icon { font-size: 36px; margin-bottom: 10px; }
  .rs-page-empty-text { font-size: 15px; }

  .rs-page-footer {
    text-align: center;
    padding: 24px;
    font-size: 11px;
    color: var(--brown);
    opacity: 0.35;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .rs-loading, .rs-not-found {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: var(--warm-white);
    gap: 12px;
  }
  .rs-not-found-icon { font-size: 40px; opacity: 0.4; }
  .rs-not-found-text {
    font-size: 16px;
    color: var(--charcoal);
    opacity: 0.5;
    font-family: 'Cormorant Garamond', serif;
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
        <div style={{ color: "var(--brown)", opacity: 0.5, fontSize: 14 }}>Loading…</div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="rs-not-found">
        <style>{styles}</style>
        <div className="rs-not-found-icon">📋</div>
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
        <div className="rs-page-table-wrap">
          <table className="rs-page-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Event</th>
                <th>Duration</th>
                <th>Involved</th>
                <th>Comments</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <div className="rs-page-empty">
                      <div className="rs-page-empty-icon">📋</div>
                      <div className="rs-page-empty-text">No runsheet items yet</div>
                    </div>
                  </td>
                </tr>
              ) : items.map((item) => (
                <tr key={item.id}>
                  <td className="rs-td-time">{item.time}</td>
                  <td className="rs-td-event">{item.event}</td>
                  <td className="rs-td-duration">{item.duration}</td>
                  <td className="rs-td-involved">{item.involved}</td>
                  <td className="rs-td-comments">{item.comments}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <footer className="rs-page-footer">Wedding Tracker</footer>
    </div>
  );
}
