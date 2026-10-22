"use client";
/**
 * The editing suite: one cut on a timeline (Harry, 22 Oct 2026; plan piece 4).
 * The method comes from Harry's other app's suite, rebuilt small for
 * Knowitball: no Frame.io, no client reviewer, no offer checks.
 *
 *   Review          notes pinned to moments: Fix / Keep / Check.
 *   Edit for Claude instructions: cut a range out, change something at a
 *                   moment, or a note for the whole video.
 *
 * Phone: the video sticks at the top (48% of the screen), one transport row,
 * the timeline, then the notes. Computer: video left, notes right, timeline
 * full width under both. Notes save to <video>.notes.json in R2
 * (lib/marketing/suite.ts), one change at a time.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MODE_LABEL, TAG_LABEL, TYPE_LABEL, REVIEW_TAGS, EDIT_TYPES, clock, emptyNotes, forClaude, newId, rows, rulerStep, stepFrames, thumbTimes,
  type EditNote, type EditType, type ReviewNote, type ReviewTag, type SuiteNotes,
} from "@/lib/marketing/suite";
import "./marketing.css";
import "./suite.css";

type Mode = "review" | "edit";
type Draft = { id: string | null; list: Mode; start: number; end: number; tag: ReviewTag; type: EditType; text: string };
const ZOOMS = [1, 1.5, 2, 3, 4, 6, 8];
const THUMBS = 36;

export default function CutEditor({ videoKey, title, src, onBack }: { videoKey: string; title: string; src: string; onBack: () => void }) {
  const vid = useRef<HTMLVideoElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const [notes, setNotes] = useState<SuiteNotes>(emptyNotes(videoKey));
  const [loaded, setLoaded] = useState(false);
  const [mode, setMode] = useState<Mode>("review");
  const [t, setT] = useState(0);
  const [dur, setDur] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [general, setGeneral] = useState("");
  const [saving, setSaving] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [thumbs, setThumbs] = useState<string[]>([]);
  const [peaks, setPeaks] = useState<number[]>([]);
  const [videoErr, setVideoErr] = useState<string | null>(null);

  /* ── Notes: read once, then one change at a time ── */
  useEffect(() => {
    let live = true;
    fetch(`/api/admin/marketing/notes?key=${encodeURIComponent(videoKey)}`, { cache: "no-store" })
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error); if (live) { setNotes(j.notes); setLoaded(true); } })
      .catch((e) => { if (live) { setErr((e as Error).message || "Notes could not be read."); setLoaded(true); } });
    return () => { live = false; };
  }, [videoKey]);

  const change = useCallback(async (c: Record<string, unknown>, optimistic: (n: SuiteNotes) => SuiteNotes) => {
    const before = notes;
    setNotes(optimistic(notes));
    setSaving("saving");
    try {
      const r = await fetch("/api/admin/marketing/notes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: videoKey, change: c }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Not saved.");
      setNotes(j.notes); setSaving("saved"); setErr(null);
    } catch (e) { setNotes(before); setSaving("failed"); setErr((e as Error).message); }
  }, [notes, videoKey]);

  /* ── The video ── */
  const seek = useCallback((x: number) => {
    const v = vid.current;
    const to = Math.max(0, Math.min(dur || 0, x));
    if (v) v.currentTime = to;
    setT(to);
  }, [dur]);
  const toggle = useCallback(() => { const v = vid.current; if (!v) return; if (v.paused) v.play().catch(() => {}); else v.pause(); }, []);
  useEffect(() => {
    const v = vid.current;
    if (!v) return;
    let raf = 0;
    const tick = () => { setT(v.currentTime); if (!v.paused) raf = requestAnimationFrame(tick); };
    const on = () => { setPlaying(true); raf = requestAnimationFrame(tick); };
    const off = () => { setPlaying(false); cancelAnimationFrame(raf); setT(v.currentTime); };
    const meta = () => setDur(Number.isFinite(v.duration) ? v.duration : 0);
    const bad = () => setVideoErr("This browser can't play the video, or the link ran out. Reload the page.");
    v.addEventListener("play", on); v.addEventListener("pause", off); v.addEventListener("seeked", off);
    v.addEventListener("loadedmetadata", meta); v.addEventListener("error", bad);
    if (v.readyState >= 1) meta();
    return () => { cancelAnimationFrame(raf); v.removeEventListener("play", on); v.removeEventListener("pause", off); v.removeEventListener("seeked", off); v.removeEventListener("loadedmetadata", meta); v.removeEventListener("error", bad); };
  }, []);

  /* ── Filmstrip: frames drawn in this browser from the same video ── */
  useEffect(() => {
    if (!dur) return;
    let stop = false;
    const v = document.createElement("video");
    v.muted = true; v.preload = "auto"; v.src = src; v.crossOrigin = "anonymous";
    const c = document.createElement("canvas");
    c.width = 54; c.height = 96;
    const g = c.getContext("2d");
    const out: string[] = [];
    const times = thumbTimes(dur, THUMBS);
    const next = (i: number) => {
      if (stop || i >= times.length || !g) return;
      v.onseeked = () => {
        try { g.drawImage(v, 0, 0, c.width, c.height); out[i] = c.toDataURL("image/jpeg", 0.6); } catch { out[i] = ""; }
        if (i % 6 === 5 || i === times.length - 1) setThumbs([...out]);
        next(i + 1);
      };
      v.currentTime = times[i];
    };
    v.onloadedmetadata = () => next(0);
    return () => { stop = true; v.removeAttribute("src"); v.load(); };
  }, [dur, src]);

  /* ── Sound wave: only for files small enough to fetch whole (a review copy) ── */
  useEffect(() => {
    let stop = false;
    const ctl = new AbortController();
    (async () => {
      try {
        const r = await fetch(src, { signal: ctl.signal });
        const len = Number(r.headers.get("content-length") ?? 0);
        if (!r.ok || !len || len > 80 * 1024 * 1024) { ctl.abort(); return; }
        const buf = await r.arrayBuffer();
        const AC = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
        const ac = new AC();
        const audio = await ac.decodeAudioData(buf);
        ac.close();
        const d = audio.getChannelData(0);
        const n = 400, step = Math.max(1, Math.floor(d.length / n));
        const p: number[] = [];
        for (let i = 0; i < n; i++) { let m = 0; for (let j = i * step; j < Math.min(d.length, (i + 1) * step); j += 8) m = Math.max(m, Math.abs(d[j])); p.push(m); }
        const top = Math.max(...p) || 1;
        if (!stop) setPeaks(p.map((x) => x / top));
      } catch { /* no wave: the lanes still work */ }
    })();
    return () => { stop = true; ctl.abort(); };
  }, [src]);

  /* ── Keys: Space plays, ← → a frame (Shift: a second), M adds a note here ── */
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "TEXTAREA" || tag === "INPUT" || tag === "SELECT") return;
      if (e.key === " ") { e.preventDefault(); toggle(); }
      else if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); const dir = e.key === "ArrowLeft" ? -1 : 1; seek(e.shiftKey ? t + dir : stepFrames(t, dir, dur)); }
      else if (e.key === "m" || e.key === "M") { e.preventDefault(); openDraft(); }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });

  const openDraft = (base?: Partial<Draft>) => {
    vid.current?.pause();
    setDraft({ id: null, list: mode, start: t, end: Math.min(dur || t + 2, t + 2), tag: "fix", type: "at", text: "", ...base });
  };
  const saveDraft = () => {
    if (!draft) return;
    const now = new Date().toISOString();
    const id = draft.id ?? newId();
    const start = Math.min(draft.start, draft.end), end = Math.max(draft.start, draft.end);
    if (draft.list === "review") {
      const item: ReviewNote = { id, start, end, tag: draft.tag, text: draft.text.trim(), by: "you", at: now };
      if (!item.text) { setErr("Write the note first."); return; }
      change({ op: draft.id ? "update" : "add", list: "review", item }, (n) => ({ ...n, review: [...n.review.filter((x) => x.id !== id), item].sort((a, b) => a.start - b.start) }));
    } else {
      const general = draft.type === "general";
      const item: EditNote = { id, type: draft.type, start: general ? null : start, end: general ? null : end, text: draft.text.trim() || (draft.type === "cut" ? "Cut this out." : ""), by: "you", at: now, status: "open" };
      if (!item.text) { setErr("Write what Claude should change."); return; }
      if (draft.type === "cut" && end - start < 0.1) { setErr("A cut needs a start and an end. Set To further on."); return; }
      change({ op: draft.id ? "update" : "add", list: "edit", item }, (n) => ({ ...n, edit: [...n.edit.filter((x) => x.id !== id), item] }));
    }
    setDraft(null); setErr(null);
  };
  const saveGeneral = () => {
    const text = general.trim();
    if (!text) return;
    const item: EditNote = { id: newId(), type: "general", start: null, end: null, text, by: "you", at: new Date().toISOString(), status: "open" };
    change({ op: "add", list: "edit", item }, (n) => ({ ...n, edit: [item, ...n.edit] }));
    setGeneral("");
  };
  const remove = (list: Mode, id: string) => change({ op: "delete", list, id }, (n) => ({ ...n, [list]: (n[list] as { id: string }[]).filter((x) => x.id !== id) }));
  const copy = async () => {
    try { await navigator.clipboard.writeText(forClaude(notes, title)); setCopied(true); setTimeout(() => setCopied(false), 1600); }
    catch { setErr("Copying is blocked in this browser."); }
  };

  /* ── Timeline geometry ── */
  const pxPerSec = useMemo(() => {
    const w = track.current?.parentElement?.clientWidth ?? 360;
    return dur ? (w * zoom) / dur : 10;
  }, [dur, zoom, thumbs.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const width = Math.max(1, dur * pxPerSec);
  const x = (s: number) => s * pxPerSec;
  const step = rulerStep(pxPerSec);
  const ticks = dur ? Array.from({ length: Math.floor(dur / step) + 1 }, (_, i) => i * step) : [];
  const reviewRows = rows(notes.review, 0.6);
  const editRows = rows(notes.edit, 0.6);
  const lanes = (r: Map<string, number>) => Math.max(1, ...Array.from(r.values()).map((v) => v + 1));
  const wavePath = useMemo(() => {
    if (!peaks.length) return "";
    const n = peaks.length;
    const top = peaks.map((p, i) => `${i ? "L" : "M"}${i} ${(50 - Math.max(2, p * 48)).toFixed(1)}`).join("");
    const bot = peaks.map((p, i) => [i, p] as const).reverse().map(([i, p]) => `L${i} ${(50 + Math.max(2, p * 48)).toFixed(1)}`).join("");
    return `${top}L${n - 1} 50${bot}Z`;
  }, [peaks]);

  // Keep the playhead in view while playing zoomed in.
  useEffect(() => {
    const sc = track.current?.parentElement;
    if (!sc || zoom === 1 || !playing) return;
    const px = x(t);
    if (px < sc.scrollLeft + 16 || px > sc.scrollLeft + sc.clientWidth - 48) sc.scrollLeft = Math.max(0, px - sc.clientWidth * 0.25);
  });

  const tapTrack = (e: React.PointerEvent) => {
    const r = track.current!.getBoundingClientRect();
    seek((e.clientX - r.left) / pxPerSec);
    setPicked(null);
  };

  const list = mode === "review" ? notes.review : notes.edit;
  const range = (s: number | null, e: number | null) => (s === null ? "Whole video" : e !== null && e - s >= 0.15 ? `${clock(s)}–${clock(e)}` : clock(s));
  const here = (s: number | null, e: number | null) => s !== null && t >= s - 0.05 && t <= Math.max(e ?? s, s + 0.6);

  return (
    <div className="ce" data-mode={mode}>
      <div className="ce-head">
        <button className="bc-pill" aria-pressed={false} onClick={onBack}>‹ All videos</button>
        <b className="ce-title" title={videoKey}>{title}</b>
        <span className="ce-save" data-state={saving}>{saving === "saving" ? "Saving…" : saving === "saved" ? "Saved" : saving === "failed" ? "Not saved" : loaded ? "" : "Loading notes…"}</span>
      </div>

      <div className="ce-stage">
        <div className="ce-player">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video ref={vid} src={src} playsInline preload="metadata" onClick={toggle} />
          {videoErr && <p className="ce-verr">{videoErr}</p>}
          {notes.edit.filter((e) => e.type === "cut" && here(e.start, e.end)).length > 0 && <span className="ce-flag" data-k="cut">Marked to cut</span>}
          {notes.review.filter((r) => here(r.start, r.end)).slice(0, 1).map((r) => <span key={r.id} className="ce-flag" data-k={r.tag}>{TAG_LABEL[r.tag]}: {r.text}</span>)}
        </div>

        <div className="ce-transport">
          <button className="ce-play" onClick={toggle} aria-label={playing ? "Pause" : "Play"}>{playing ? "❚❚" : "▶"}</button>
          <span className="ce-clock">{clock(t)} <small>/ {clock(dur)}</small></span>
          <span className="ce-steps">
            <button onClick={() => seek(t - 1)} title="Back a second">‹1s</button>
            <button onClick={() => seek(stepFrames(t, -1, dur))} title="Back a frame">‹1f</button>
            <button onClick={() => seek(stepFrames(t, 1, dur))} title="On a frame">1f›</button>
            <button onClick={() => seek(t + 1)} title="On a second">1s›</button>
          </span>
          <span className="ce-zoom">
            <button onClick={() => setZoom(ZOOMS[Math.max(0, ZOOMS.indexOf(zoom) - 1)])} disabled={zoom === 1} aria-label="Zoom out">−</button>
            <button onClick={() => setZoom(ZOOMS[Math.min(ZOOMS.length - 1, ZOOMS.indexOf(zoom) + 1)])} disabled={zoom === ZOOMS[ZOOMS.length - 1]} aria-label="Zoom in">+</button>
          </span>
        </div>

        <div className="ce-scroll">
          <div className="ce-track" ref={track} style={{ width }} onPointerDown={tapTrack}>
            <div className="ce-ruler">{ticks.map((s) => <span key={s} style={{ left: x(s) }}>{clock(s).replace(/\.0$/, "")}</span>)}</div>
            <div className="ce-strip">{thumbs.length ? Array.from({ length: THUMBS }, (_, i) => <i key={i} style={{ width: width / THUMBS, backgroundImage: thumbs[i] ? `url(${thumbs[i]})` : undefined }} />) : <em>Filmstrip…</em>}</div>
            <div className="ce-wave">{wavePath && <svg viewBox={`0 0 ${peaks.length} 100`} preserveAspectRatio="none"><path d={wavePath} /></svg>}</div>
            <Lane name="Review" k="review" items={notes.review} rowsOf={reviewRows} n={lanes(reviewRows)} x={x} dim={mode !== "review"} picked={picked}
              num={(id) => notes.review.findIndex((r) => r.id === id) + 1} label={(it) => TAG_LABEL[(it as ReviewNote).tag]} cls={(it) => (it as ReviewNote).tag}
              onPick={(it) => { setMode("review"); setPicked(it.id); seek(it.start ?? 0); }} />
            <Lane name="Edit" k="edit" items={notes.edit.filter((e) => e.start !== null)} rowsOf={editRows} n={lanes(editRows)} x={x} dim={mode !== "edit"} picked={picked}
              num={(id) => notes.edit.findIndex((r) => r.id === id) + 1} label={(it) => TYPE_LABEL[(it as EditNote).type]} cls={(it) => (it as EditNote).type}
              onPick={(it) => { setMode("edit"); setPicked(it.id); seek(it.start ?? 0); }} />
            {draft && draft.list === mode && !(draft.list === "edit" && draft.type === "general") && (
              <div className="ce-new" style={{ left: x(Math.min(draft.start, draft.end)), width: Math.max(4, x(Math.abs(draft.end - draft.start))) }}>New</div>
            )}
            <div className="ce-head-line" style={{ left: x(t) }}><i /></div>
          </div>
        </div>
      </div>

      <div className="ce-panel">
        <div className="ce-tabs" role="tablist">
          {(["review", "edit"] as Mode[]).map((m) => (
            <button key={m} role="tab" aria-selected={mode === m} data-m={m} onClick={() => { setMode(m); setDraft(null); }}>
              {MODE_LABEL[m]} <b>{m === "review" ? notes.review.length : notes.edit.length}</b>
            </button>
          ))}
        </div>
        <p className="ce-hint">{mode === "review" ? "Notes on the cut, pinned to a moment: what to fix, what to keep, what to check." : "Instructions for Claude: cut a bit out, change something at a moment, or a note for the whole video. Claude reads these and makes the changes."}</p>
        {err && <p className="ce-err">{err}</p>}

        {!draft ? (
          <div className="ce-addrow">
            <button className="bc-btn" data-main="true" onClick={() => openDraft()}>+ Add at {clock(t)}</button>
            {mode === "edit" && <button className="bc-btn" onClick={() => openDraft({ type: "cut", text: "" })}>✂ Cut from here</button>}
            <button className="bc-btn" onClick={copy}>{copied ? "Copied" : "Copy for Claude"}</button>
          </div>
        ) : (
          <div className="ce-composer">
            <div className="ce-chips">
              {draft.list === "review"
                ? REVIEW_TAGS.map((g) => <button key={g} className="bc-pill" data-tag={g} aria-pressed={draft.tag === g} onClick={() => setDraft({ ...draft, tag: g })}>{TAG_LABEL[g]}</button>)
                : EDIT_TYPES.map((g) => <button key={g} className="bc-pill" aria-pressed={draft.type === g} onClick={() => setDraft({ ...draft, type: g })}>{TYPE_LABEL[g]}</button>)}
            </div>
            {!(draft.list === "edit" && draft.type === "general") && (
              <div className="ce-range">
                <span>From <b>{clock(draft.start)}</b> <button onClick={() => setDraft({ ...draft, start: t })}>Set to {clock(t)}</button></span>
                <span>To <b>{clock(draft.end)}</b> <button onClick={() => setDraft({ ...draft, end: t })}>Set to {clock(t)}</button></span>
              </div>
            )}
            <textarea rows={3} autoFocus value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })}
              placeholder={draft.list === "review" ? "What you see or hear here…" : draft.type === "cut" ? "Why (optional)…" : "What Claude should change…"} />
            <div className="ce-addrow">
              <button className="bc-btn" data-main="true" onClick={saveDraft}>{draft.id ? "Save change" : "Save"}</button>
              <button className="bc-btn" onClick={() => { setDraft(null); setErr(null); }}>Cancel</button>
            </div>
          </div>
        )}

        {mode === "edit" && !draft && (
          <div className="ce-general">
            <label htmlFor="ce-general">For the whole video</label>
            <textarea id="ce-general" rows={2} value={general} onChange={(e) => setGeneral(e.target.value)} placeholder="e.g. Make the music quieter all the way through" />
            <button className="bc-btn" onClick={saveGeneral} disabled={!general.trim()}>Save for Claude</button>
          </div>
        )}

        <ol className="ce-cards">
          {list.length === 0 && <li className="ce-none">{mode === "review" ? "No notes yet. Pause where something is wrong and press + Add." : "No instructions yet."}</li>}
          {list.map((it, i) => {
            const isEdit = mode === "edit";
            const e = it as EditNote, r = it as ReviewNote;
            return (
              <li key={it.id} className="ce-card" data-on={picked === it.id || here(it.start, it.end) ? "true" : "false"} data-k={isEdit ? e.type : r.tag}>
                <div className="ce-card-top">
                  <span className="ce-n">{i + 1}</span>
                  <button className="ce-time" onClick={() => it.start !== null && seek(it.start)} disabled={it.start === null}>{range(it.start, it.end)}</button>
                  <span className="ce-kind">{isEdit ? TYPE_LABEL[e.type] : TAG_LABEL[r.tag]}</span>
                  {isEdit && e.status !== "open" && <span className="ce-status">{e.status === "done" ? "Done by Claude" : "Skipped"}</span>}
                </div>
                <p>{it.text}</p>
                <div className="ce-card-foot">
                  <small>{it.by}{it.at ? ` · ${new Date(it.at).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : ""}</small>
                  <span>
                    <button onClick={() => setDraft({ id: it.id, list: mode, start: it.start ?? t, end: it.end ?? t, tag: isEdit ? "fix" : r.tag, type: isEdit ? e.type : "at", text: it.text })}>Edit</button>
                    <button onClick={() => remove(mode, it.id)}>Delete</button>
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

function Lane({ name, k, items, rowsOf, n, x, dim, picked, num, label, cls, onPick }: {
  name: string; k: Mode; items: (ReviewNote | EditNote)[]; rowsOf: Map<string, number>; n: number; x: (s: number) => number; dim: boolean; picked: string | null;
  num: (id: string) => number; label: (it: ReviewNote | EditNote) => string; cls: (it: ReviewNote | EditNote) => string; onPick: (it: ReviewNote | EditNote) => void;
}) {
  return (
    <div className="ce-lane" data-k={k} data-dim={dim ? "true" : "false"} style={{ height: 8 + n * 20 }}>
      <span className="ce-lane-name">{name}</span>
      {items.map((it) => {
        const s = it.start ?? 0, e = Math.max(it.end ?? s, s);
        return (
          <button key={it.id} className="ce-block" data-c={cls(it)} data-on={picked === it.id ? "true" : "false"}
            style={{ left: x(s), width: Math.max(14, x(e - s)), top: 4 + (rowsOf.get(it.id) ?? 0) * 20 }}
            title={`${label(it)}: ${it.text}`} onPointerDown={(ev) => { ev.stopPropagation(); onPick(it); }}>
            {num(it.id)}
          </button>
        );
      })}
    </div>
  );
}
