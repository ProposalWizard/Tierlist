"use client";
/**
 * Marketing → Library (Mikey, 28 Nov 2026): every video in a space's Cloudflare storage with its saved words (name,
 * why, titles, captions and hashtags for each app). The files are in storage (anyone can add one here, in Marketing →
 * Uploads, or through a Claude chat); the words are in the table marketing_videos. "Post this" opens Publish with
 * the video and its words already filled in. Reads and writes /api/admin/marketing/library.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Panel } from "@/components/admin/broadcast/BroadcastPage";
import { sizeLabel } from "@/lib/marketing/uploadClient";
import { APP_NAMES, EMPTY_DETAILS, WORD_APPS, fileLabel, fullCaption, isFilledIn, matchesSearch, type VideoDetails, type WordApp } from "@/lib/publish/library";
import { SPACES, SPACE_NAMES, isSpace, type Space } from "@/lib/publish/types";
import { uploadForPublish } from "./uploadForPublish";
import "./marketing.css";
import "./suite.css";

type Item = { key: string; file: string; size: number; uploaded: string; source: "own" | "kib"; details: (VideoDetails & { updated_at?: string }) | null };
type Data = { space: Space; storage: "own" | "kib" | "off"; storageError?: string; error?: string; videos: Item[]; orphans: { key: string; details: VideoDetails }[] };

const playLink = (space: Space, key: string) => `/api/admin/publish/play?space=${space}&key=${encodeURIComponent(key)}`;
const nice = (file: string) => file.replace(/\.[A-Za-z0-9]{2,4}$/, "").replace(/[-_]+/g, " ").trim();
const when = (iso: string) => (iso ? new Date(iso).toLocaleDateString([], { day: "numeric", month: "short" }) : "");

/** A card's picture: the video's first frame, loaded only when the card scrolls into view. */
function Thumb({ src }: { src: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { setOn(true); io.disconnect(); } }, { rootMargin: "200px" });
    io.observe(el); return () => io.disconnect();
  }, []);
  return <div className="lib-thumb" ref={ref}>{on && <video src={`${src}#t=0.5`} preload="metadata" muted playsInline />}</div>;
}

export default function LibraryPanel() {
  const [space, setSpaceRaw] = useState<Space>("kib");
  // The address (?space=…) is read once the page is on screen, so the server's page and the browser's first draw match.
  const [urlRead, setUrlRead] = useState(false);
  useEffect(() => { const sp = new URLSearchParams(window.location.search).get("space"); if (isSpace(sp)) setSpaceRaw(sp); setUrlRead(true); }, []);
  const setSpace = (s: Space) => { setSpaceRaw(s); setOpen(null); setData(null); try { const u = new URL(window.location.href); u.searchParams.set("space", s); window.history.replaceState(null, "", u.toString()); } catch { /* ignore */ } };
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [needsOnly, setNeedsOnly] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [form, setForm] = useState<VideoDetails>(EMPTY_DETAILS);
  const [busy, setBusy] = useState<string | null>(null);
  const [up, setUp] = useState<number | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  // Tapping a card opens its editor below the grid: bring it into view at once (no animation), so a phone does not make you hunt for it.
  useEffect(() => { if (open) editorRef.current?.scrollIntoView({ block: "start" }); }, [open]);

  const load = useCallback(async () => {
    if (!urlRead) return;
    try {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 20_000);
      const r = await fetch(`/api/admin/marketing/library?space=${space}`, { cache: "no-store", signal: ctl.signal }); clearTimeout(t);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `Could not read the Library (${r.status}).`);
      setData(j); setErr(j.error ?? null);
    } catch (e) { setErr((e as Error).name === "AbortError" ? "The Library took too long to answer. Try again." : (e as Error).message); }
  }, [space, urlRead]);
  useEffect(() => { load(); }, [load]);

  const items = useMemo(() => (data?.videos ?? []).filter((v) => (!needsOnly || !isFilledIn(v.details)) && matchesSearch(q, [v.details?.name, v.details?.series, v.details?.why, v.file])), [data, q, needsOnly]);
  const needs = (data?.videos ?? []).filter((v) => !isFilledIn(v.details)).length;
  const cur = (data?.videos ?? []).find((v) => v.key === open) ?? null;

  const pick = (v: Item) => {
    setOpen(v.key); setNote(null);
    setForm(v.details ? { ...EMPTY_DETAILS, ...v.details, titles: { ...v.details.titles }, captions: { ...v.details.captions }, tags: { ...v.details.tags } } : { ...EMPTY_DETAILS, name: nice(v.file) });
  };
  const upload = async (f: File | undefined) => {
    if (!f) return; setErr(null); setUp(0);
    try { const key = await uploadForPublish(f, space, (x) => setUp(x)); await load(); setOpen(key); setForm({ ...EMPTY_DETAILS, name: nice(f.name) }); setNote("Uploaded. Fill in its words below and press Save."); }
    catch (e) { setErr((e as Error).message); } finally { setUp(null); }
  };
  const save = async () => {
    if (!cur) return; setBusy("save"); setErr(null);
    try {
      const r = await fetch("/api/admin/marketing/library", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ space, video_key: cur.key, details: form }) });
      const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || `Could not save (${r.status}).`);
      await load(); setNote("Saved.");
    } catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  };
  const forget = async () => {
    if (!cur || !confirm("Forget the saved words for this video? The video itself stays in storage.")) return; setBusy("forget");
    try { const r = await fetch(`/api/admin/marketing/library?space=${space}&key=${encodeURIComponent(cur.key)}`, { method: "DELETE" }); if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `Failed (${r.status}).`); setOpen(null); await load(); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  };
  const copy = async (text: string, what: string) => { try { await navigator.clipboard.writeText(text); setNote(`${what} copied.`); } catch { setNote("Your browser would not copy. Select the text and copy it by hand."); } };
  const set = (patch: Partial<VideoDetails>) => setForm((f) => ({ ...f, ...patch }));
  const setIn = (k: "titles" | "captions" | "tags", app: string, v: string) => setForm((f) => ({ ...f, [k]: { ...f[k], [app]: v } }));

  return (
    <div className="mk-up">
      <div className="mk-chips" role="tablist" aria-label="Which library">
        {SPACES.map((s) => <button key={s} className="bc-pill" role="tab" aria-pressed={space === s} onClick={() => setSpace(s)}>{SPACE_NAMES[s]}</button>)}
      </div>
      <p className="mk-plain">{space === "kib" ? "The Knowitball team library: every video in the team's Cloudflare storage, including everything uploaded in Marketing → Uploads." : space === "football" ? "Your football videos, in your own storage. Only you." : "Your other content videos, in your own storage. Only you."}</p>
      {err && <div className="mk-problems" role="alert"><p>{err}</p></div>}
      {data?.storage === "off" && <div className="mk-problems"><p>No video storage is connected for this library yet (the Cloudflare settings in Vercel).</p></div>}
      {data?.storageError && <div className="mk-problems"><p>Storage said: {data.storageError}</p></div>}

      <Panel title="Videos" note={data ? `${data.videos.length} video${data.videos.length === 1 ? "" : "s"} · ${needs} need details` : undefined}>
        <div className="mk-chips">
          <label className="bc-btn" aria-disabled={up !== null}>
            {up !== null ? `Uploading… ${Math.round(up * 100)}%` : "⬆ Upload a video"}
            <input type="file" accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm" hidden disabled={up !== null} onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
          <button className="bc-pill" aria-pressed={needsOnly} onClick={() => setNeedsOnly(!needsOnly)}>{needsOnly ? "✓ " : ""}Needs details ({needs})</button>
        </div>
        <label className="mk-field"><span>Search</span><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, series or what it is" /></label>
        {!data && !err && <p className="mk-empty">Loading…</p>}
        {data && items.length === 0 && <p className="mk-empty">{data.videos.length ? "No video matches." : "No videos in this library yet. Upload one, or ask a Claude chat to add it."}</p>}
        <div className="lib-grid">
          {items.map((v) => (
            <button key={v.key} className="lib-card" aria-current={open === v.key} onClick={() => pick(v)}>
              <Thumb src={playLink(space, v.key)} />
              <b>{v.details?.name || nice(v.file)}</b>
              <small>{v.details?.len_label ? `${v.details.len_label} · ` : ""}{sizeLabel(v.size)}{v.uploaded ? ` · ${when(v.uploaded)}` : ""}</small>
              {isFilledIn(v.details) ? <span className="mk-chip">{v.details?.series || "Ready"}</span> : <span className="mk-chip" data-warn="true">Needs details</span>}
            </button>
          ))}
        </div>
      </Panel>

      {cur && (
        <div ref={editorRef} style={{ scrollMarginTop: 12 }}>
        <Panel title={form.name || nice(cur.file)} note={`${fileLabel(cur.key)} · ${sizeLabel(cur.size)}`}>
          <video className="lib-player" src={playLink(space, cur.key)} controls playsInline preload="metadata" />
          <div className="mk-chips">
            <Link className="bc-btn" data-main="true" href={`/admin/marketing/publish?space=${space}&video=${encodeURIComponent(cur.key)}`}>Post this</Link>
            <a className="bc-btn" href={playLink(space, cur.key)} target="_blank" rel="noreferrer">Open the video</a>
            <button className="bc-pill" aria-pressed={false} onClick={() => copy(fullCaption(form, "facebook") || fullCaption(form, "instagram"), "Facebook caption")}>Copy the Facebook caption</button>
          </div>
          {note && <div className="mk-store" data-on="true" role="status"><span>{note}</span></div>}

          <label className="mk-field"><span>Name</span><input value={form.name} maxLength={140} onChange={(e) => set({ name: e.target.value })} /></label>
          <label className="mk-field"><span>What it is and when to post it</span><textarea rows={2} value={form.why} maxLength={600} onChange={(e) => set({ why: e.target.value })} /></label>
          <div className="lib-two">
            <label className="mk-field"><span>Series (optional)</span><input value={form.series} maxLength={40} onChange={(e) => set({ series: e.target.value })} placeholder="Explainer, Stat twin…" /></label>
            <label className="mk-field"><span>Length</span><input value={form.len_label} maxLength={12} onChange={(e) => set({ len_label: e.target.value })} placeholder="0:29" /></label>
          </div>
          <div className="lib-two">
            <label className="mk-field"><span>YouTube title (100 characters at most)</span><input value={form.titles.youtube ?? ""} maxLength={100} onChange={(e) => setIn("titles", "youtube", e.target.value)} /></label>
            <label className="mk-field"><span>Facebook title</span><input value={form.titles.facebook ?? ""} maxLength={100} onChange={(e) => setIn("titles", "facebook", e.target.value)} /></label>
          </div>
          {WORD_APPS.map((a: WordApp) => (
            <div key={a} className="lib-two">
              <label className="mk-field"><span>{APP_NAMES[a]} caption</span><textarea rows={3} value={form.captions[a] ?? ""} onChange={(e) => setIn("captions", a, e.target.value)} /></label>
              <label className="mk-field"><span>{APP_NAMES[a]} hashtags</span><textarea rows={3} value={form.tags[a] ?? ""} onChange={(e) => setIn("tags", a, e.target.value)} placeholder="#football #knowitball" /></label>
            </div>
          ))}
          <div className="mk-chips">
            <button className="bc-btn" data-main="true" disabled={busy !== null || !form.name.trim()} onClick={save}>{busy === "save" ? "Saving…" : "Save"}</button>
            {cur.details && <button className="bc-pill" aria-pressed={false} disabled={busy !== null} onClick={forget}>Forget the words</button>}
            <button className="bc-pill" aria-pressed={false} onClick={() => setOpen(null)}>Close</button>
          </div>
        </Panel>
        </div>
      )}

      {data && data.orphans.length > 0 && (
        <Panel title="Words with no video" note={`${data.orphans.length}`}>
          <p className="mk-plain">These have saved words, but their video is no longer in this storage (moved or deleted).</p>
          {data.orphans.map((o) => <div key={o.key} className="mk-file"><span className="mk-file-main"><b>{o.details.name || fileLabel(o.key)}</b><small>{fileLabel(o.key)}</small></span></div>)}
        </Panel>
      )}
    </div>
  );
}
