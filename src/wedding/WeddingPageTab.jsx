import { useState, useEffect, useRef } from "react";
import { supabase, isDemoMode } from "../lib/supabase.js";
import { LOCALES } from "../i18n/index.jsx";
import { isCompleteThemeTokens } from "../lib/themeTokens.js";
import { SECTION_PHOTO_SLOTS, MAX_PHOTOS_PER_SLOT, normalizeSectionPhotos } from "../lib/sectionPhotos.js";
import { FOCAL_POINTS, normalizeFocalPoint } from "../lib/heroFocalPoint.js";

// Read a File as a base64 string (without the data: URL prefix) for the vision API.
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = String(reader.result);
      const comma = res.indexOf(",");
      resolve(comma >= 0 ? res.slice(comma + 1) : res);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Locales the couple can provide content translations for (every locale except
// the English source of truth). Drives the per-language editor below.
const TRANSLATABLE_LOCALES = Object.keys(LOCALES).filter((code) => code !== "en");

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

  /* Hero focal point (#75) — 3×3 crop-anchor grid */
  .wpt-focal { margin-top: 16px; }
  .wpt-focal-grid {
    display: grid; grid-template-columns: repeat(3, 1fr);
    gap: 6px; width: 132px;
  }
  .wpt-focal-cell {
    aspect-ratio: 1; border-radius: 6px; cursor: pointer;
    border: 1.5px solid rgba(201,168,76,0.3); background: var(--warm-white);
    display: flex; align-items: center; justify-content: center; padding: 0;
    transition: all 0.15s;
  }
  .wpt-focal-cell:hover { border-color: var(--gold); background: white; }
  .wpt-focal-cell.is-active {
    border-color: var(--gold); background: rgba(201,168,76,0.14);
  }
  .wpt-focal-dot {
    width: 8px; height: 8px; border-radius: 50%;
    background: rgba(140,120,70,0.35); transition: background 0.15s;
  }
  .wpt-focal-cell.is-active .wpt-focal-dot { background: var(--gold-dark); }

  /* Section photo galleries (#71) */
  .wpt-gallery-slot {
    padding: 14px 0; border-top: 1px solid rgba(201,168,76,0.15);
  }
  .wpt-gallery-slot:first-of-type { border-top: none; }
  .wpt-gallery-head {
    display: flex; align-items: center; gap: 10px; cursor: pointer;
  }
  .wpt-gallery-name { font-size: 14px; color: var(--brown); font-weight: 500; }
  .wpt-gallery-body { margin-top: 12px; display: flex; flex-direction: column; gap: 12px; }
  .wpt-gallery-thumbs {
    display: flex; flex-wrap: wrap; gap: 8px;
  }
  .wpt-gallery-thumb { position: relative; width: 72px; height: 72px; }
  .wpt-gallery-thumb img {
    width: 100%; height: 100%; object-fit: cover; border-radius: 8px;
    border: 1.5px solid rgba(201,168,76,0.2);
  }
  .wpt-gallery-remove {
    position: absolute; top: -6px; right: -6px;
    width: 20px; height: 20px; border-radius: 50%; cursor: pointer;
    border: none; background: var(--red, #c0392b); color: white;
    font-size: 11px; line-height: 1; display: flex; align-items: center; justify-content: center;
  }
  .wpt-gallery-actions { display: flex; align-items: center; gap: 12px; }

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
  .wpt-btn-gold {
    padding: 11px 28px; border-radius: 10px; border: none;
    background: var(--gold); color: white; cursor: pointer;
    font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 500;
    transition: background 0.15s; letter-spacing: 0.02em;
  }
  .wpt-btn-gold:hover { background: var(--gold-dark); }
  .wpt-btn-gold:disabled { opacity: 0.6; cursor: default; }

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
  const [heroFocalPoint, setHeroFocalPoint] = useState("center");
  const [rsvpDeadline, setRsvpDeadline] = useState("");
  const [mealOptions, setMealOptions]   = useState("");
  const [gettingThere, setGettingThere] = useState("");
  const [smokingNotice, setSmokingNotice] = useState("");
  const [parkingNotice, setParkingNotice] = useState("");
  const [isPublished, setIsPublished]   = useState(false);
  const [pageTheme, setPageTheme]       = useState("minimal");
  const [themeTokens, setThemeTokens]   = useState({});
  const [generatingTheme, setGeneratingTheme] = useState(false);
  const [themeErr, setThemeErr]         = useState("");
  const themeFileInputRef = useRef(null);
  const [enableFunRsvpOptions, setEnableFunRsvpOptions] = useState(false);
  const [customQA, setCustomQA]    = useState([]);

  // Section photo galleries (#71): per-slot { enabled, cols, photos }.
  const [sectionPhotos, setSectionPhotos] = useState(() => normalizeSectionPhotos(null));
  const [galleryUploading, setGalleryUploading] = useState(""); // slot key mid-upload, or ""
  const galleryInputs = useRef({}); // per-slot hidden <input> refs, keyed by slot key

  // All per-locale content translations, keyed by locale code:
  // { "zh-TW": { love_story, …, fun_qa: [{id,q,answer}] }, "ja": {…}, … }.
  const [translations, setTranslations] = useState({});
  const [activeLocale, setActiveLocale] = useState(TRANSLATABLE_LOCALES[0]);
  const [translating, setTranslating] = useState(false);
  const [translateErr, setTranslateErr] = useState("");

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
    setHeroFocalPoint(normalizeFocalPoint(wedding.hero_focal_point));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRsvpDeadline(wedding.rsvp_deadline || "");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMealOptions(wedding.meal_options || "");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGettingThere(wedding.getting_there || "");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSmokingNotice(wedding.smoking_notice || "");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setParkingNotice(wedding.parking_notice || "");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsPublished(wedding.is_published || false);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPageTheme(wedding.theme || "minimal");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEnableFunRsvpOptions(wedding.enable_fun_rsvp_options || false);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCustomQA(buildCustomQA(wedding.fun_qa));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTranslations(wedding.content_translations || {});
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThemeTokens(wedding.theme_tokens || {});
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSectionPhotos(normalizeSectionPhotos(wedding.section_photos));
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

  // ── AI theme generation from an uploaded image (#60) ──
  const generateThemeFromImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setThemeErr("Please select an image file");
      return;
    }
    if (isDemoMode || !supabase) {
      setThemeErr("Theme generation is not available in demo mode");
      return;
    }
    setGeneratingTheme(true);
    setThemeErr("");
    try {
      const imageBase64 = await fileToBase64(file);
      const { data: { session } = {} } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch("/api/generate-theme", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ imageBase64, mimeType: file.type }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `request failed: ${res.status}`);
      }
      const data = await res.json();
      if (data?.tokens && isCompleteThemeTokens(data.tokens)) {
        setThemeTokens(data.tokens);
        setPageTheme("custom");
        showToast("Theme generated from your image!");
      } else {
        throw new Error("no usable palette returned");
      }
    } catch (err) {
      console.error("[WeddingPageTab] generate-theme error:", err);
      setThemeErr("Theme generation failed — try another image or pick a preset below.");
    } finally {
      setGeneratingTheme(false);
      if (themeFileInputRef.current) themeFileInputRef.current.value = "";
    }
  };

  // ── Per-locale content-translation helpers (edit the active locale) ──
  const sourceFields = [
    { key: "bride_name",     label: "Bride's Name",    en: wedding?.bride_name || "" },
    { key: "groom_name",     label: "Groom's Name",    en: wedding?.groom_name || "" },
    { key: "love_story",     label: "Your Story",      en: loveStory },
    { key: "dress_code",     label: "Dress Code",      en: dresscode },
    { key: "venue_name",     label: "Venue Name",      en: wedding?.venue_name || "" },
    { key: "venue_address",  label: "Venue Address",   en: wedding?.venue_address || "" },
    { key: "getting_there",  label: "Getting There",   en: gettingThere },
    { key: "smoking_notice", label: "Smoking notice",  en: smokingNotice },
    { key: "parking_notice", label: "Parking notice",  en: parkingNotice },
  ];

  // The translation object for the locale currently being edited.
  const activeTr = translations[activeLocale] || {};

  const setTrField = (key, value) =>
    setTranslations((p) => ({
      ...p,
      [activeLocale]: { ...(p[activeLocale] || {}), [key]: value },
    }));

  const trFunQaValue = (id, field) => {
    const arr = Array.isArray(activeTr.fun_qa) ? activeTr.fun_qa : [];
    const found = arr.find((r) => r.id === id);
    return (found && found[field]) || "";
  };

  const setTrFunQa = (id, field, value) =>
    setTranslations((p) => {
      const cur = p[activeLocale] || {};
      const arr = Array.isArray(cur.fun_qa) ? cur.fun_qa : [];
      const exists = arr.some((r) => r.id === id);
      const next = exists
        ? arr.map((r) => (r.id === id ? { ...r, [field]: value } : r))
        : [...arr, { id, q: "", answer: "", [field]: value }];
      return { ...p, [activeLocale]: { ...cur, fun_qa: next } };
    });

  const autoTranslate = async () => {
    setTranslating(true);
    setTranslateErr("");
    try {
      const items = [];
      sourceFields.forEach(({ key, en }) => {
        if (en && en.trim()) items.push({ key, text: en.trim() });
      });
      customQA.forEach((item) => {
        if (item.answer?.trim()) {
          if (item.q?.trim()) items.push({ key: `fun_qa.${item.id}.q`, text: item.q.trim() });
          items.push({ key: `fun_qa.${item.id}.answer`, text: item.answer.trim() });
        }
      });

      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, source: "en", target: activeLocale }),
      });
      if (!res.ok) throw new Error(`translate request failed: ${res.status}`);
      const data = await res.json();
      const results = Array.isArray(data?.results) ? data.results : [];

      setTranslations((prevAll) => {
        const prev = prevAll[activeLocale] || {};
        const next = { ...prev };
        const funQa = Array.isArray(prev.fun_qa) ? [...prev.fun_qa] : [];
        const upsertFq = (id, field, value) => {
          const idx = funQa.findIndex((r) => r.id === id);
          if (idx === -1) funQa.push({ id, q: "", answer: "", [field]: value });
          else funQa[idx] = { ...funQa[idx], [field]: value };
        };
        results.forEach(({ key, text }) => {
          if (!text || !text.trim()) return;
          const fq = key.match(/^fun_qa\.(.+)\.(q|answer)$/);
          if (fq) {
            const [, id, field] = fq;
            // Don't overwrite manual edits
            const existing = funQa.find((r) => r.id === id);
            if (existing && existing[field] && existing[field].trim()) return;
            upsertFq(id, field, text);
          } else {
            // Don't overwrite manual edits
            if (next[key] && next[key].trim()) return;
            next[key] = text;
          }
        });
        next.fun_qa = funQa;
        return { ...prevAll, [activeLocale]: next };
      });
    } catch (err) {
      console.error("[WeddingPageTab] auto-translate error:", err);
      setTranslateErr("Auto-translate failed — you can still type translations manually.");
    } finally {
      setTranslating(false);
    }
  };

  // ── Section photo galleries (#71) ──
  const setSlotField = (key, patch) =>
    setSectionPhotos((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));

  const uploadGalleryPhotos = async (key, e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    if (isDemoMode || !supabase) {
      showToast("Image upload not available in demo mode");
      return;
    }
    const existing = sectionPhotos[key]?.photos?.length || 0;
    const room = MAX_PHOTOS_PER_SLOT - existing;
    if (room <= 0) {
      showToast(`Up to ${MAX_PHOTOS_PER_SLOT} photos per section`);
      return;
    }
    setGalleryUploading(key);
    // Upload each file independently so a mid-batch failure keeps (and persists)
    // the successes rather than orphaning already-uploaded objects in the bucket.
    const uploaded = [];
    let failed = 0;
    for (const file of files.slice(0, room)) {
      if (!file.type.startsWith("image/")) continue;
      try {
        const ext = file.name.split(".").pop().toLowerCase();
        const rand = Math.random().toString(36).slice(2, 8);
        const path = `gallery/${key}/${existing + uploaded.length}-${rand}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("wedding-photos")
          .upload(path, file, { upsert: true, contentType: file.type });
        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from("wedding-photos").getPublicUrl(path);
        uploaded.push(data.publicUrl);
      } catch (err) {
        failed += 1;
        console.error("[WeddingPageTab] gallery upload error:", err);
      }
    }
    if (uploaded.length) {
      setSectionPhotos((prev) => ({
        ...prev,
        [key]: {
          ...prev[key],
          photos: [...prev[key].photos, ...uploaded].slice(0, MAX_PHOTOS_PER_SLOT),
        },
      }));
    }
    if (failed && uploaded.length) showToast(`${uploaded.length} uploaded, ${failed} failed`);
    else if (failed) showToast(`${failed} photo${failed > 1 ? "s" : ""} failed to upload`);
    else if (uploaded.length) showToast(`${uploaded.length} photo${uploaded.length > 1 ? "s" : ""} uploaded!`);
    setGalleryUploading("");
    if (galleryInputs.current[key]) galleryInputs.current[key].value = "";
  };

  const removeGalleryPhoto = (key, idx) =>
    setSectionPhotos((prev) => ({
      ...prev,
      [key]: { ...prev[key], photos: prev[key].photos.filter((_, i) => i !== idx) },
    }));

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
      hero_focal_point: normalizeFocalPoint(heroFocalPoint),
      fun_qa:          funQa,
      rsvp_deadline:   rsvpDeadline || null,
      is_published:    isPublished,
      meal_options:    mealOptions.trim(),
      getting_there:   gettingThere.trim(),
      theme:           pageTheme,
      enable_fun_rsvp_options: enableFunRsvpOptions,
      smoking_notice:  smokingNotice.trim(),
      parking_notice:  parkingNotice.trim(),
      content_translations: { ...(wedding?.content_translations || {}), ...translations },
      theme_tokens:    themeTokens,
      section_photos:  sectionPhotos,
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

          {heroUrl && (
            <div className="wpt-focal">
              <label className="wpt-label">Focus / crop position</label>
              <div className="wpt-card-sub" style={{ marginBottom: 12 }}>
                The photo fills the header and is cropped to fit. Pick where to
                anchor the crop so the couple stays in frame.
              </div>
              <div
                className="wpt-focal-grid"
                role="radiogroup"
                aria-label="Hero photo focus position"
              >
                {FOCAL_POINTS.map((fp) => {
                  const active = heroFocalPoint === fp.css;
                  return (
                    <button
                      key={fp.key}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      aria-label={fp.label}
                      title={fp.label}
                      className={`wpt-focal-cell${active ? " is-active" : ""}`}
                      onClick={() => setHeroFocalPoint(fp.css)}
                    >
                      <span className="wpt-focal-dot" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── PHOTO GALLERIES ── */}
        <div className="wpt-card">
          <div className="wpt-card-title">Photo Galleries <span className="wpt-label-opt">(optional)</span></div>
          <div className="wpt-card-sub">
            Add optional photo bands between the sections of your page. Off by default to keep the
            design simple and uncluttered. Up to {MAX_PHOTOS_PER_SLOT} photos per section.
          </div>

          {SECTION_PHOTO_SLOTS.map((slot) => {
            const g = sectionPhotos[slot.key] || { enabled: false, cols: 2, photos: [] };
            const atMax = g.photos.length >= MAX_PHOTOS_PER_SLOT;
            return (
              <div key={slot.key} className="wpt-gallery-slot">
                <label className="wpt-gallery-head">
                  <input
                    type="checkbox"
                    checked={g.enabled}
                    onChange={(e) => setSlotField(slot.key, { enabled: e.target.checked })}
                  />
                  <span className="wpt-gallery-name">{slot.label}</span>
                </label>

                {g.enabled && (
                  <div className="wpt-gallery-body">
                    <div className="wpt-field" style={{ maxWidth: 160 }}>
                      <label className="wpt-label">Columns</label>
                      <select
                        className="wpt-input"
                        value={g.cols}
                        onChange={(e) => setSlotField(slot.key, { cols: Number(e.target.value) })}
                      >
                        {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>

                    {g.photos.length > 0 && (
                      <div className="wpt-gallery-thumbs">
                        {g.photos.map((src, i) => (
                          <div key={src} className="wpt-gallery-thumb">
                            <img src={src} alt="" />
                            <button
                              type="button"
                              className="wpt-gallery-remove"
                              onClick={() => removeGalleryPhoto(slot.key, i)}
                              aria-label="Remove photo"
                            >✕</button>
                          </div>
                        ))}
                      </div>
                    )}

                    <input
                      ref={(el) => { galleryInputs.current[slot.key] = el; }}
                      type="file" accept="image/*" multiple
                      style={{ display: "none" }}
                      onChange={(e) => uploadGalleryPhotos(slot.key, e)}
                    />
                    <div className="wpt-gallery-actions">
                      <button
                        className="wpt-upload-btn"
                        disabled={galleryUploading === slot.key || atMax}
                        onClick={() => galleryInputs.current[slot.key]?.click()}
                      >
                        {galleryUploading === slot.key ? "Uploading…" : atMax ? "Max photos reached" : "Add photos"}
                      </button>
                      <span style={{ fontSize: 11, color: "var(--brown)", opacity: 0.5 }}>
                        {g.photos.length} / {MAX_PHOTOS_PER_SLOT} photos
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
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

        {/* ── NOTE TO GUESTS ── */}
        <div className="wpt-card">
          <div className="wpt-card-title">Note to Guests</div>
          <div className="wpt-card-sub">
            Optional notices shown on the RSVP form (only when attending). Leave a field blank to hide it.
          </div>
          <label className="wpt-label">Parking notice</label>
          <textarea
            className="wpt-textarea"
            style={{ minHeight: 72 }}
            value={parkingNotice}
            onChange={(e) => setParkingNotice(e.target.value)}
            placeholder="e.g. Free parking at Basement 2; validate your ticket at the reception table."
            maxLength={500}
          />
          <div style={{ fontSize: 11, color: "var(--brown)", opacity: 0.4, textAlign: "right", marginTop: 4 }}>
            {parkingNotice.length} / 500
          </div>
          <label className="wpt-label" style={{ marginTop: 12 }}>Smoking notice</label>
          <textarea
            className="wpt-textarea"
            style={{ minHeight: 72 }}
            value={smokingNotice}
            onChange={(e) => setSmokingNotice(e.target.value)}
            placeholder="e.g. Smoking is only permitted at the designated area outside the main lobby."
            maxLength={500}
          />
          <div style={{ fontSize: 11, color: "var(--brown)", opacity: 0.4, textAlign: "right", marginTop: 4 }}>
            {smokingNotice.length} / 500
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
            {isCompleteThemeTokens(themeTokens) && (
              <button
                type="button"
                className={`wpt-theme-opt${pageTheme === "custom" ? " active" : ""}`}
                onClick={() => setPageTheme("custom")}
              >
                <div
                  className="wpt-theme-swatch"
                  style={{ background: `linear-gradient(135deg, ${themeTokens.accentDark} 0%, ${themeTokens.heading} 60%, ${themeTokens.accent} 100%)` }}
                />
                <div className="wpt-theme-name">Custom</div>
                <div className="wpt-theme-sub">From your image</div>
              </button>
            )}
          </div>

          {/* AI theme from an uploaded image (#60) */}
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid rgba(201,168,76,0.15)" }}>
            <input
              ref={themeFileInputRef}
              type="file"
              accept="image/*"
              onChange={generateThemeFromImage}
              style={{ display: "none" }}
            />
            <button
              type="button"
              className="wpt-upload-btn"
              style={{ display: "inline-block", width: "auto" }}
              disabled={generatingTheme}
              onClick={() => themeFileInputRef.current?.click()}
            >
              {generatingTheme ? "Generating…" : "✨ Generate theme from an image"}
            </button>
            <div style={{ fontSize: 11, color: "var(--brown)", opacity: 0.5, lineHeight: 1.4, marginTop: 6 }}>
              Upload a photo (your flowers, invite, venue…) and AI derives a matching color palette.
              Applied as the “Custom” theme above — you can always switch back to a preset.
            </div>
            {themeErr && (
              <div style={{ fontSize: 12, color: "var(--red)", marginTop: 8 }}>{themeErr}</div>
            )}
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

          <div className="wpt-publish-row">
            <div className="wpt-publish-info">
              <div className="wpt-publish-title">
                Fun RSVP options {enableFunRsvpOptions ? "on" : "off"}
              </div>
              <div className="wpt-publish-desc">
                Adds playful choices to the RSVP form: “It&apos;s complicated 😅” under how
                guests know you, and “😏 It&apos;s a secret” under friend type. Off by default.
              </div>
            </div>
            <label className="wpt-toggle">
              <input type="checkbox" checked={enableFunRsvpOptions} onChange={(e) => setEnableFunRsvpOptions(e.target.checked)} />
              <div className="wpt-toggle-track" />
              <div className="wpt-toggle-thumb" />
            </label>
          </div>
        </div>

        {/* ── CONTENT TRANSLATIONS (per language) ── */}
        <div className="wpt-card">
          <div className="wpt-card-title">Translations</div>
          <div className="wpt-card-sub">
            These show on your public wedding page and RSVP form when a guest switches language.
            Any field left blank falls back to the English version.
          </div>

          {/* Language picker — choose which language you're editing. */}
          <div
            role="tablist"
            aria-label="Translation language"
            style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}
          >
            {TRANSLATABLE_LOCALES.map((code) => {
              const active = code === activeLocale;
              return (
                <button
                  key={code}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveLocale(code)}
                  style={{
                    border: active ? "1px solid var(--gold)" : "1px solid rgba(201,168,76,0.25)",
                    background: active ? "var(--gold)" : "transparent",
                    color: active ? "#fff" : "var(--brown)",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 600,
                    padding: "6px 14px",
                    borderRadius: 999,
                    transition: "background 0.15s, color 0.15s",
                  }}
                >
                  {LOCALES[code].label}
                </button>
              );
            })}
          </div>

          <div style={{ marginBottom: 16 }}>
            <button
              type="button"
              className="wpt-upload-btn"
              style={{ display: "inline-block", width: "auto" }}
              disabled={translating}
              onClick={autoTranslate}
            >
              {translating ? "Translating…" : "Auto-translate from English ↻"}
            </button>
            <div style={{ fontSize: 11, color: "var(--brown)", opacity: 0.5, lineHeight: 1.4, marginTop: 6 }}>
              Fills in blank fields only — your own edits are never overwritten.
            </div>
            {translateErr && (
              <div style={{ fontSize: 12, color: "var(--red)", marginTop: 8 }}>
                {translateErr}
              </div>
            )}
          </div>

          {sourceFields.map(({ key, label, en }) => (
            <div className="wpt-field" key={key}>
              <label className="wpt-label">{label}</label>
              {en && en.trim() ? (
                <div style={{ fontSize: 11, color: "var(--brown)", opacity: 0.45, lineHeight: 1.4, marginBottom: 6, whiteSpace: "pre-wrap" }}>
                  EN: {en}
                </div>
              ) : (
                <div style={{ fontSize: 11, color: "var(--brown)", opacity: 0.35, lineHeight: 1.4, marginBottom: 6 }}>
                  EN: (empty)
                </div>
              )}
              <textarea
                className="wpt-textarea"
                style={{ minHeight: 64 }}
                value={activeTr[key] || ""}
                onChange={(e) => setTrField(key, e.target.value)}
                placeholder={`${LOCALES[activeLocale].label}…`}
              />
            </div>
          ))}

          {customQA.some((item) => item.answer?.trim()) && (
            <div style={{ marginTop: 8 }}>
              <label className="wpt-label">Fun Q&amp;A</label>
              <div className="wpt-qa-grid" style={{ marginTop: 6 }}>
                {customQA.filter((item) => item.answer?.trim()).map((item) => (
                  <div key={item.id} style={{ padding: 14, background: "var(--warm-white)", borderRadius: 10, border: "1px solid rgba(201,168,76,0.15)" }}>
                    <div style={{ fontSize: 11, color: "var(--brown)", opacity: 0.45, lineHeight: 1.4, marginBottom: 6, whiteSpace: "pre-wrap" }}>
                      EN Q: {item.q}
                    </div>
                    <input
                      className="wpt-input"
                      value={trFunQaValue(item.id, "q")}
                      onChange={(e) => setTrFunQa(item.id, "q", e.target.value)}
                      placeholder={`Question (${LOCALES[activeLocale].label})…`}
                    />
                    <div style={{ fontSize: 11, color: "var(--brown)", opacity: 0.45, lineHeight: 1.4, margin: "10px 0 6px", whiteSpace: "pre-wrap" }}>
                      EN A: {item.answer}
                    </div>
                    <textarea
                      className="wpt-input wpt-qa-answer"
                      value={trFunQaValue(item.id, "answer")}
                      onChange={(e) => setTrFunQa(item.id, "answer", e.target.value)}
                      placeholder={`Answer (${LOCALES[activeLocale].label})…`}
                      rows={3}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── SAVE ── */}
        <div className="wpt-save-row">
          <button className="wpt-btn-gold" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save wedding page"}
          </button>
        </div>

      </div>
    </>
  );
}
