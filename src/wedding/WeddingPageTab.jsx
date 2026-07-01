import { useState, useEffect, useRef } from "react";
import { supabase, isDemoMode } from "../lib/supabase.js";

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

const FUN_QUESTIONS_BY_ID = Object.fromEntries(FUN_QUESTIONS.map((q) => [q.id, q.q]));

const styles = `
  .wpt { display: flex; flex-direction: column; gap: 20px; padding: 20px 24px 40px; max-width: 780px; }

  .wpt-card {
    background: white; border-radius: 12px; padding: 24px 28px;
    box-shadow: 0 2px 16px rgba(44,36,22,0.07);
    border: 1px solid rgba(201,168,76,0.12);
  }
  .wpt-card-title {
    font-size: 15px; font-weight: 600; color: var(--charcoal);
    margin-bottom: 4px;
  }
  .wpt-card-sub {
    font-size: 12px; color: var(--brown); opacity: 0.6; margin-bottom: 20px; line-height: 1.5;
  }

  .wpt-field { margin-bottom: 16px; }
  .wpt-field:last-child { margin-bottom: 0; }
  .wpt-label {
    display: block; font-size: 11px; text-transform: uppercase;
    letter-spacing: 0.1em; color: var(--brown); font-weight: 500; margin-bottom: 6px;
  }
  .wpt-label-opt { opacity: 0.5; font-weight: 400; margin-left: 4px; text-transform: none; letter-spacing: 0; }
  .wpt-input, .wpt-textarea, .wpt-select {
    width: 100%; padding: 10px 12px;
    border: 1.5px solid rgba(201,168,76,0.3); border-radius: 8px;
    font-family: 'DM Sans', sans-serif; font-size: 14px; color: var(--charcoal);
    outline: none; background: var(--warm-white); transition: border-color 0.15s;
    box-sizing: border-box;
  }
  .wpt-input:focus, .wpt-textarea:focus, .wpt-select:focus {
    border-color: var(--gold); background: white;
  }
  .wpt-textarea { resize: vertical; min-height: 96px; line-height: 1.6; }

  /* URL row */
  .wpt-url-row {
    display: flex; gap: 8px; align-items: center;
  }
  .wpt-url-prefix {
    font-size: 13px; color: var(--brown); opacity: 0.5; white-space: nowrap; flex-shrink: 0;
  }
  .wpt-url-input {
    flex: 1; padding: 10px 12px;
    border: 1.5px solid rgba(201,168,76,0.3); border-radius: 8px;
    font-family: 'DM Sans', sans-serif; font-size: 13px; color: var(--charcoal);
    outline: none; background: var(--warm-white); transition: border-color 0.15s;
  }
  .wpt-url-input:focus { border-color: var(--gold); background: white; }
  .wpt-copy-btn {
    padding: 10px 14px; border-radius: 8px; border: 1.5px solid rgba(201,168,76,0.3);
    background: white; cursor: pointer; font-size: 12px; color: var(--brown);
    font-family: 'DM Sans', sans-serif; transition: all 0.15s; white-space: nowrap;
  }
  .wpt-copy-btn:hover { border-color: var(--gold); color: var(--gold-dark); }
  .wpt-preview-link {
    display: block; margin-top: 8px; font-size: 12px;
    color: var(--gold-dark); text-decoration: none;
  }
  .wpt-preview-link:hover { text-decoration: underline; }

  /* Q&A grid */
  .wpt-qa-grid { display: flex; flex-direction: column; gap: 14px; }
  .wpt-qa-item {
    display: grid; grid-template-columns: 1fr 1.5fr auto; gap: 12px;
    align-items: start; padding: 14px 16px;
    background: var(--warm-white); border-radius: 10px;
    border: 1px solid rgba(201,168,76,0.15);
  }
  .wpt-qa-answer {
    resize: vertical; min-height: 72px; line-height: 1.5;
  }
  .wpt-qa-delete {
    padding: 9px 10px; border-radius: 8px; border: 1.5px solid rgba(192,57,43,0.2);
    background: white; cursor: pointer; font-size: 13px; color: rgba(192,57,43,0.6);
    font-family: 'DM Sans', sans-serif; line-height: 1; transition: all 0.15s;
    margin-top: 1px;
  }
  .wpt-qa-delete:hover { border-color: rgba(192,57,43,0.5); color: rgb(192,57,43); background: rgba(192,57,43,0.04); }
  .wpt-qa-add {
    margin-top: 10px; width: 100%; padding: 10px 16px; border-radius: 8px;
    border: 1.5px dashed rgba(201,168,76,0.4); background: white; cursor: pointer;
    font-family: 'DM Sans', sans-serif; font-size: 13px; color: var(--brown);
    transition: all 0.15s; text-align: center;
  }
  .wpt-qa-add:hover { border-color: var(--gold); color: var(--gold-dark); background: rgba(201,168,76,0.04); }

  /* Hero image */
  .wpt-hero-row { display: flex; gap: 12px; align-items: flex-start; }
  .wpt-hero-preview {
    width: 80px; height: 80px; border-radius: 8px;
    object-fit: cover; flex-shrink: 0;
    border: 1.5px solid rgba(201,168,76,0.2);
  }
  .wpt-hero-placeholder {
    width: 80px; height: 80px; border-radius: 8px; flex-shrink: 0;
    background: var(--warm-white); border: 1.5px dashed rgba(201,168,76,0.3);
    display: flex; align-items: center; justify-content: center;
    font-size: 24px;
  }
  .wpt-hero-actions { flex: 1; display: flex; flex-direction: column; gap: 8px; }
  .wpt-upload-btn {
    padding: 9px 16px; border-radius: 8px; cursor: pointer;
    border: 1.5px solid rgba(201,168,76,0.3); background: white;
    font-family: 'DM Sans', sans-serif; font-size: 13px; color: var(--brown);
    transition: all 0.15s; text-align: center;
  }
  .wpt-upload-btn:hover { border-color: var(--gold); color: var(--gold-dark); }
  .wpt-upload-btn:disabled { opacity: 0.5; cursor: default; }

  /* Publish toggle */
  .wpt-publish-row {
    display: flex; align-items: center; justify-content: space-between;
    gap: 16px;
  }
  .wpt-publish-info {}
  .wpt-publish-title { font-size: 14px; font-weight: 500; color: var(--charcoal); margin-bottom: 2px; }
  .wpt-publish-desc { font-size: 12px; color: var(--brown); opacity: 0.6; }
  .wpt-toggle {
    position: relative; width: 48px; height: 26px; flex-shrink: 0;
    cursor: pointer;
  }
  .wpt-toggle input { opacity: 0; width: 0; height: 0; }
  .wpt-toggle-track {
    position: absolute; inset: 0; border-radius: 13px;
    background: rgba(201,168,76,0.2); transition: background 0.2s;
  }
  .wpt-toggle input:checked + .wpt-toggle-track { background: var(--gold); }
  .wpt-toggle-thumb {
    position: absolute; top: 3px; left: 3px;
    width: 20px; height: 20px; border-radius: 50%;
    background: white; transition: transform 0.2s;
    box-shadow: 0 1px 4px rgba(0,0,0,0.2);
  }
  .wpt-toggle input:checked ~ .wpt-toggle-thumb { transform: translateX(22px); }
  .wpt-published-badge {
    display: inline-flex; align-items: center; gap: 6px;
    margin-top: 10px; padding: 5px 12px; border-radius: 20px;
    background: rgba(45,106,79,0.08); border: 1px solid rgba(45,106,79,0.2);
    font-size: 12px; color: var(--green);
  }

  /* Theme picker */
  .wpt-theme-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 10px; margin-top: 4px; }
  .wpt-theme-opt {
    border: 1.5px solid rgba(201,168,76,0.2); border-radius: 12px;
    padding: 14px 10px 12px; cursor: pointer; text-align: center;
    background: white; transition: border-color 0.15s, box-shadow 0.15s;
  }
  .wpt-theme-opt:hover { border-color: var(--gold); }
  .wpt-theme-opt.active {
    border-color: var(--gold); background: rgba(201,168,76,0.06);
    box-shadow: 0 0 0 2px rgba(201,168,76,0.2);
  }
  .wpt-theme-swatch {
    width: 100%; height: 36px; border-radius: 8px; margin-bottom: 8px;
  }
  .wpt-theme-name { font-size: 12px; font-weight: 500; color: var(--charcoal); }
  .wpt-theme-sub  { font-size: 11px; color: var(--brown); opacity: 0.6; margin-top: 2px; }

  /* Save button */
  .wpt-save-row { display: flex; justify-content: flex-end; padding-top: 4px; }
  .btn-gold {
    padding: 11px 28px; border-radius: 10px; border: none;
    background: var(--gold); color: white; cursor: pointer;
    font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 500;
    transition: background 0.15s; letter-spacing: 0.02em;
  }
  .btn-gold:hover { background: var(--gold-dark); }
  .btn-gold:disabled { opacity: 0.6; cursor: default; }

  @media (max-width: 600px) {
    .wpt { padding: 16px 16px 40px; }
    .wpt-qa-item { grid-template-columns: 1fr auto; }
    .wpt-qa-item .wpt-input:first-child { grid-column: 1 / -1; }
    .wpt-url-prefix { display: none; }
  }
`;

function slugify(s) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function defaultSlug(bride, groom) {
  if (!bride || !groom) return "";
  return `${slugify(groom)}-and-${slugify(bride)}`;
}

function buildCustomQA(funQa) {
  const arr = Array.isArray(funQa) ? funQa : [];
  if (arr.length === 0) {
    return FUN_QUESTIONS.map((q) => ({ id: q.id, q: q.q, answer: "" }));
  }
  return arr.map((item) => ({
    id: item.id,
    q: item.q || FUN_QUESTIONS_BY_ID[item.id] || "",
    answer: item.answer || "",
  }));
}

export default function WeddingPageTab({ wedding, onSave, showToast }) {
  const fileInputRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [copied, setCopied] = useState(false);

  const [slug, setSlug]            = useState("");
  const [loveStory, setLoveStory]  = useState("");
  const [dresscode, setDresscode]  = useState("");
  const [heroUrl, setHeroUrl]      = useState("");
  const [rsvpDeadline, setRsvpDeadline] = useState("");
  const [mealOptions, setMealOptions]   = useState("");
  const [gettingThere, setGettingThere] = useState("");
  const [isPublished, setIsPublished]   = useState(false);
  const [pageTheme, setPageTheme]       = useState("minimal");
  const [customQA, setCustomQA]    = useState([]);

  useEffect(() => {
    if (!wedding) return;
    const auto = defaultSlug(wedding.bride_name, wedding.groom_name);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSlug(wedding.slug || auto);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoveStory(wedding.love_story || "");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDresscode(wedding.dress_code || "");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHeroUrl(wedding.hero_image_url || "");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRsvpDeadline(wedding.rsvp_deadline || "");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMealOptions(wedding.meal_options || "");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGettingThere(wedding.getting_there || "");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsPublished(wedding.is_published || false);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPageTheme(wedding.theme || "minimal");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCustomQA(buildCustomQA(wedding.fun_qa));
  }, [wedding]);

  if (wedding === undefined) {
    return (
      <>
        <style>{styles}</style>
        <div style={{ padding: 40, textAlign: "center", color: "var(--brown)", opacity: 0.5 }}>Loading…</div>
      </>
    );
  }

  const pageUrl = `${window.location.origin}/wedding/${slug}`;

  const copyUrl = () => {
    navigator.clipboard.writeText(pageUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const uploadHeroImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast("Please select an image file");
      return;
    }
    if (isDemoMode || !supabase) {
      showToast("Image upload not available in demo mode");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop().toLowerCase();
      const path = `hero.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("wedding-photos")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("wedding-photos").getPublicUrl(path);
      setHeroUrl(data.publicUrl);
      showToast("Photo uploaded!");
    } catch (err) {
      console.error("[WeddingPageTab] upload error:", err);
      showToast(`Upload failed: ${err?.message || err?.error || JSON.stringify(err)}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const save = async () => {
    const funQa = customQA
      .filter((item) => item.answer?.trim())
      .map((item) => ({ id: item.id, q: item.q.trim(), answer: item.answer.trim() }));

    setSaving(true);
    await onSave({
      slug: slug.trim() || defaultSlug(wedding?.bride_name, wedding?.groom_name),
      love_story:      loveStory.trim(),
      dress_code:      dresscode.trim(),
      hero_image_url:  heroUrl.trim(),
      fun_qa:          funQa,
      rsvp_deadline:   rsvpDeadline || null,
      is_published:    isPublished,
      meal_options:    mealOptions.trim(),
      getting_there:   gettingThere.trim(),
      theme:           pageTheme,
    });
    setSaving(false);
  };

  return (
    <>
      <style>{styles}</style>
      <div className="wpt">

        {/* ── PAGE URL ── */}
        <div className="wpt-card">
          <div className="wpt-card-title">Your Wedding Page URL</div>
          <div className="wpt-card-sub">
            Guests visit this link to read your story and RSVP.
            The slug is auto-generated from your names — you can customise it.
          </div>

          <div className="wpt-field">
            <label className="wpt-label">Page URL</label>
            <div className="wpt-url-row">
              <span className="wpt-url-prefix">{window.location.origin}/wedding/</span>
              <input
                className="wpt-url-input"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/--+/g, "-"))}
                placeholder="your-names-here"
              />
              <button className="wpt-copy-btn" onClick={copyUrl}>
                {copied ? "Copied!" : "Copy link"}
              </button>
            </div>
            {slug && (
              <a className="wpt-preview-link" href={`/wedding/${slug}`} target="_blank" rel="noopener noreferrer">
                Preview page ↗
              </a>
            )}
          </div>

          <div className="wpt-field">
            <label className="wpt-label">RSVP Deadline <span className="wpt-label-opt">(optional)</span></label>
            <input className="wpt-input" type="date" value={rsvpDeadline} onChange={(e) => setRsvpDeadline(e.target.value)} />
          </div>

          <div className="wpt-field">
            <label className="wpt-label">Meal Options <span className="wpt-label-opt">(comma-separated, shown on RSVP form)</span></label>
            <input
              className="wpt-input"
              value={mealOptions}
              onChange={(e) => setMealOptions(e.target.value)}
              placeholder="e.g. Chicken, Fish, Vegetarian"
            />
          </div>

          <div className="wpt-field">
            <label className="wpt-label">Dress Code <span className="wpt-label-opt">(optional)</span></label>
            <input
              className="wpt-input"
              value={dresscode}
              onChange={(e) => setDresscode(e.target.value)}
              placeholder="e.g. Smart Casual, Black Tie Optional"
            />
          </div>
        </div>

        {/* ── HERO PHOTO ── */}
        <div className="wpt-card">
          <div className="wpt-card-title">Hero Photo</div>
          <div className="wpt-card-sub">
            Displayed as the background of your wedding page header.
            Looks best as a landscape photo (min 1200px wide).
          </div>

          <div className="wpt-hero-row">
            {heroUrl
              ? <img src={heroUrl} alt="Hero" className="wpt-hero-preview" />
              : <div className="wpt-hero-placeholder">📸</div>
            }
            <div className="wpt-hero-actions">
              <input
                ref={fileInputRef}
                type="file" accept="image/*"
                style={{ display: "none" }}
                onChange={uploadHeroImage}
              />
              <button
                className="wpt-upload-btn"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploading ? "Uploading…" : heroUrl ? "Replace photo" : "Upload photo"}
              </button>
              {heroUrl && (
                <button
                  className="wpt-upload-btn"
                  style={{ color: "var(--red)", borderColor: "rgba(192,57,43,0.3)" }}
                  onClick={() => setHeroUrl("")}
                >
                  Remove photo
                </button>
              )}
              <div style={{ fontSize: 11, color: "var(--brown)", opacity: 0.5, lineHeight: 1.4 }}>
                JPG or PNG · Max ~5MB · Requires Supabase storage bucket setup
              </div>
            </div>
          </div>
        </div>

        {/* ── YOUR STORY ── */}
        <div className="wpt-card">
          <div className="wpt-card-title">Your Story</div>
          <div className="wpt-card-sub">Tell guests how you met. Leave blank to hide this section.</div>
          <textarea
            className="wpt-textarea"
            style={{ minHeight: 140 }}
            value={loveStory}
            onChange={(e) => setLoveStory(e.target.value)}
            placeholder="We met at a mutual friend's party in 2019. Wei Ming spilled a drink on Siew Yong's dress…"
            maxLength={5000}
          />
          <div style={{ fontSize: 11, color: "var(--brown)", opacity: 0.4, textAlign: "right", marginTop: 4 }}>
            {loveStory.length} / 5000
          </div>
        </div>

        {/* ── GETTING THERE ── */}
        <div className="wpt-card">
          <div className="wpt-card-title">Getting There</div>
          <div className="wpt-card-sub">
            Help guests find the venue — MRT stops, bus routes, parking, or any special entry notes.
            Leave blank to hide this section.
          </div>
          <textarea
            className="wpt-textarea"
            style={{ minHeight: 120 }}
            value={gettingThere}
            onChange={(e) => setGettingThere(e.target.value)}
            placeholder={"By MRT: Alight at Orchard station (NS22), take Exit B and walk 5 minutes.\nBy car: Parking is available at [Car Park Name]. Enter via [Street Name].\nDrop-off: Use the main entrance on [Street]."}
            maxLength={2000}
          />
          <div style={{ fontSize: 11, color: "var(--brown)", opacity: 0.4, textAlign: "right", marginTop: 4 }}>
            {gettingThere.length} / 2000
          </div>
        </div>

        {/* ── FUN Q&A ── */}
        <div className="wpt-card">
          <div className="wpt-card-title">Fun Facts About You</div>
          <div className="wpt-card-sub">
            Customise the questions and answers your guests will see. Leave the answer blank to hide a question.
          </div>
          <div className="wpt-qa-grid">
            {customQA.map((item, idx) => (
              <div key={item.id} className="wpt-qa-item">
                <input
                  className="wpt-input"
                  value={item.q}
                  onChange={(e) => setCustomQA((prev) =>
                    prev.map((r, i) => i === idx ? { ...r, q: e.target.value } : r)
                  )}
                  placeholder="Your question…"
                />
                <textarea
                  className="wpt-input wpt-qa-answer"
                  value={item.answer}
                  onChange={(e) => setCustomQA((prev) =>
                    prev.map((r, i) => i === idx ? { ...r, answer: e.target.value } : r)
                  )}
                  placeholder="Your answer…"
                  rows={3}
                />
                <button
                  type="button"
                  className="wpt-qa-delete"
                  onClick={() => setCustomQA((prev) => prev.filter((_, i) => i !== idx))}
                  aria-label="Remove question"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="wpt-qa-add"
            onClick={() => setCustomQA((prev) => [
              ...prev,
              { id: `custom_${Date.now()}`, q: "", answer: "" },
            ])}
          >
            + Add question
          </button>
        </div>

        {/* ── THEME ── */}
        <div className="wpt-card">
          <div className="wpt-card-title">Page Theme</div>
          <div className="wpt-card-sub">
            Applies to your public wedding page and the RSVP form. The rest of the app is unaffected.
          </div>
          <div className="wpt-theme-grid">
            {[
              { id: "minimal", name: "Minimal",  sub: "Dark gold",     swatch: "linear-gradient(135deg,#2c2416 0%,#1a1008 60%,#3a2a10 100%)" },
              { id: "garden",  name: "Garden",   sub: "Forest & sage", swatch: "linear-gradient(135deg,#1b3d13 0%,#0f2208 60%,#2a4a1c 100%)" },
              { id: "chinese", name: "Traditional",sub: "Red & gold",  swatch: "linear-gradient(135deg,#7a0a0a 0%,#5c0000 60%,#8b1515 100%)" },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                className={`wpt-theme-opt${pageTheme === t.id ? " active" : ""}`}
                onClick={() => setPageTheme(t.id)}
              >
                <div className="wpt-theme-swatch" style={{ background: t.swatch }} />
                <div className="wpt-theme-name">{t.name}</div>
                <div className="wpt-theme-sub">{t.sub}</div>
              </button>
            ))}
          </div>
        </div>

        {/* ── PUBLISH ── */}
        <div className="wpt-card">
          <div className="wpt-card-title">Publish Settings</div>
          <div className="wpt-card-sub">
            Once published, guests can find and view your wedding page.
            You can unpublish at any time.
          </div>

          <div className="wpt-publish-row">
            <div className="wpt-publish-info">
              <div className="wpt-publish-title">
                {isPublished ? "Page is published" : "Page is not published"}
              </div>
              <div className="wpt-publish-desc">
                {isPublished
                  ? "Your wedding page is live and visible to anyone with the link."
                  : "Your page is in preview mode — only you can see it."}
              </div>
            </div>
            <label className="wpt-toggle">
              <input type="checkbox" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} />
              <div className="wpt-toggle-track" />
              <div className="wpt-toggle-thumb" />
            </label>
          </div>

          {isPublished && slug && (
            <div className="wpt-published-badge">
              ✓ Live at &nbsp;<a href={`/wedding/${slug}`} target="_blank" rel="noopener noreferrer" style={{ color: "inherit" }}>{pageUrl}</a>
            </div>
          )}
        </div>

        {/* ── SAVE ── */}
        <div className="wpt-save-row">
          <button className="btn-gold" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save wedding page"}
          </button>
        </div>

      </div>
    </>
  );
}
