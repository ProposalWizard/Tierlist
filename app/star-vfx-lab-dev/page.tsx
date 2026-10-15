"use client";

/**
 * VISUAL EFFECTS LAB — see, edit and rate candidate pictures for the match's
 * big moments, and try the picks in the real match below.
 *
 * Leo, 15 Oct 2026: "good we have sound effect stuff but i mainly meant the
 * visual effects like the graphics stuff u added for game feel for things like
 * kicking the ball, saving, goal etc, I want loads of different unique editable
 * variants."
 *
 * Every variant is a recipe in lib/star/vfxLab.ts, painted by a pure function.
 * The filmstrips are painted ONCE per change (no animation loop of their own —
 * the one-engine rule). The moving version is the real match: EnginePlay with
 * the test-only `vfxOverride` prop, so the picks are drawn on real kicks,
 * saves and goals. Ratings, notes, edits and picks stay in this browser.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PageGuide from "@/components/admin/PageGuide";
import EnginePlay from "@/components/star/EnginePlay";
import {
  VFX_EVENTS, VFX_VARIANTS, PARAM_INFO, STYLE_PARAMS, FILM_SLICES, EMPTY_VFX_NOTES,
  paintThumb, editedRecipe, describeEdit, exportVfxPicks, picksToOverride, sanitizeNotes, pickUsed,
  type VfxEvent, type VfxNotes, type VfxParams, type VfxVariant, type VfxNumKey,
} from "@/lib/star/vfxLab";

const STORE = "star-vfx-lab-v1";
const FW = 84, FH = 104;

function loadNotes(): VfxNotes {
  try {
    const raw = localStorage.getItem(STORE);
    return raw ? sanitizeNotes(JSON.parse(raw)) : EMPTY_VFX_NOTES;
  } catch {
    return EMPTY_VFX_NOTES;
  }
}

/** Four moments of the effect, painted once per change. */
function Filmstrip({ event, v, edit }: { event: VfxEvent; v: VfxVariant; edit?: Partial<VfxParams> }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const key = JSON.stringify(edit ?? {});
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const dpr = Math.min(2, typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1);
    const n = FILM_SLICES.length, gap = 3;
    cv.width = Math.round((FW * n + gap * (n - 1)) * dpr);
    cv.height = Math.round(FH * dpr);
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const r = editedRecipe(v, edit);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    FILM_SLICES.forEach((u, i) => {
      ctx.save();
      ctx.translate(i * (FW + gap), 0);
      ctx.beginPath(); ctx.rect(0, 0, FW, FH); ctx.clip();
      try { paintThumb(ctx, event, r, u, FW, FH); } catch { /* a bad dial never breaks the page */ }
      ctx.restore();
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(i * (FW + gap), FH - 14, 30, 14);
      ctx.fillStyle = "#fff"; ctx.font = "700 9px system-ui, sans-serif"; ctx.textBaseline = "middle";
      ctx.fillText(`${Math.round(u * r.params.durationMs)}ms`, i * (FW + gap) + 3, FH - 7);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, v.id, key]);
  const n = FILM_SLICES.length;
  return <canvas ref={ref} className="mt-2 w-full rounded-lg" style={{ aspectRatio: `${FW * n + 3 * (n - 1)} / ${FH}` }} aria-label={`${v.name}, four moments`} />;
}

function fmt(k: VfxNumKey, v: number) {
  const i = PARAM_INFO[k];
  return `${k === "count" ? v : +v.toFixed(2)}${i.unit ?? ""}`;
}

function VariantCard({ v, notes, setNotes, editing, setEditing }: {
  v: VfxVariant; notes: VfxNotes; setNotes: (f: (n: VfxNotes) => VfxNotes) => void;
  editing: boolean; setEditing: (id: string | null) => void;
}) {
  const edit = notes.edits[v.id];
  const p = editedRecipe(v, edit).params;
  const picked = notes.picks[v.event] === v.id;
  const rating = notes.ratings[v.id] ?? 0;
  const [msg, setMsg] = useState("");
  const used = STYLE_PARAMS[v.recipe.style];
  const set = (k: keyof VfxParams, val: number | string) =>
    setNotes((n) => ({ ...n, edits: { ...n.edits, [v.id]: { ...(n.edits[v.id] ?? {}), [k]: val } } }));
  async function copy() {
    const text = JSON.stringify({ id: v.id, style: v.recipe.style, ...pickUsed(v.recipe.style, p) });
    try { await navigator.clipboard.writeText(text); setMsg("Recipe copied"); } catch { setMsg("Couldn't copy — use Export my picks instead."); }
    setTimeout(() => setMsg(""), 2500);
  }
  const edited = edit && describeEdit(v, edit) !== "as made";
  return (
    <li className={`rounded-2xl border p-3 ${picked ? "border-amber-300 bg-amber-400/10" : "border-white/15 bg-white/5"}`} data-variant={v.id}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-base font-black">{v.name}</span>
        {v.current && <span className="rounded bg-sky-500/30 px-1.5 py-0.5 text-[10px] font-black uppercase text-sky-100">in game now</span>}
        {edited && <span className="rounded bg-fuchsia-500/30 px-1.5 py-0.5 text-[10px] font-black uppercase text-fuchsia-100">edited</span>}
        {editing && <span className="rounded bg-emerald-500/30 px-1.5 py-0.5 text-[10px] font-black uppercase text-emerald-100">in the live match</span>}
      </div>
      <p className="text-sm font-bold text-white/90">{v.about}</p>
      {!v.off && <Filmstrip event={v.event} v={v} edit={edit} />}

      <div className="mt-2 flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((k) => (
          <button key={k} aria-label={`${k} stars`}
            onClick={() => setNotes((n) => ({ ...n, ratings: { ...n.ratings, [v.id]: n.ratings[v.id] === k ? 0 : k } }))}
            className={`h-10 w-9 text-2xl leading-none ${k <= rating ? "text-amber-300" : "text-white/30"}`}>★</button>
        ))}
        <button onClick={() => setNotes((n) => {
          const picks = { ...n.picks };
          if (picks[v.event] === v.id) delete picks[v.event]; else picks[v.event] = v.id;
          return { ...n, picks };
        })}
          className={`ml-auto h-10 rounded-xl px-3 text-sm font-black ${picked ? "bg-amber-300 text-slate-950" : "border border-amber-300/60 text-amber-200"}`}>
          {picked ? "✓ My pick" : "Pick this"}
        </button>
      </div>

      <input
        value={notes.notes[v.id] ?? ""}
        onChange={(e) => { const val = e.target.value; setNotes((n) => ({ ...n, notes: { ...n.notes, [v.id]: val } })); }}
        placeholder="Note (what you like or don't)"
        className="mt-2 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm font-bold text-white placeholder:text-white/50"
      />

      {!v.off && (
        <button onClick={() => setEditing(editing ? null : v.id)} className="mt-2 h-10 w-full rounded-xl bg-white/10 text-sm font-black">
          {editing ? "Close edit ▴" : "Edit ▾"}
        </button>
      )}
      {editing && (
        <div className="mt-2 space-y-2">
          {used.filter((k): k is VfxNumKey => k in PARAM_INFO).map((k) => (
            <label key={k} className="block">
              <span className="flex justify-between text-sm font-bold">
                <span>{PARAM_INFO[k].label}</span>
                <span className="text-white/90">{fmt(k, p[k])}</span>
              </span>
              <input type="range" min={PARAM_INFO[k].min} max={PARAM_INFO[k].max} step={PARAM_INFO[k].step} value={p[k]}
                onChange={(e) => set(k, Number(e.target.value))}
                className="h-8 w-full accent-emerald-400" />
            </label>
          ))}
          {(used.includes("color") || used.includes("color2")) && (
            <div className="flex gap-3">
              {(["color", "color2"] as const).filter((k) => used.includes(k)).map((k) => (
                <label key={k} className="flex items-center gap-2 text-sm font-bold">
                  <input type="color" value={p[k]} onChange={(e) => set(k, e.target.value)} className="h-10 w-12 rounded border border-white/20 bg-transparent" />
                  {k === "color" ? "Colour" : "Colour 2"}
                </label>
              ))}
            </div>
          )}
          {used.includes("text") && (
            <label className="block text-sm font-bold">Word
              <input value={p.text} maxLength={14} onChange={(e) => set("text", e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm font-bold text-white" />
            </label>
          )}
          <p className="text-xs font-bold text-white/80">The live match below draws this one while it is open.</p>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setNotes((n) => { const edits = { ...n.edits }; delete edits[v.id]; return { ...n, edits }; })}
              className="h-11 rounded-xl bg-white/10 text-sm font-black">Reset</button>
            <button onClick={copy} className="h-11 rounded-xl bg-white/10 text-sm font-black">Copy recipe</button>
          </div>
        </div>
      )}
      {msg && <p className="mt-2 text-sm font-black text-emerald-300">{msg}</p>}
    </li>
  );
}

export default function VfxLabPage() {
  const [notes, setNotesRaw] = useState<VfxNotes>(EMPTY_VFX_NOTES);
  const [eventId, setEventId] = useState<VfxEvent>("strike");
  const [editing, setEditing] = useState<string | null>(null);
  const [live, setLive] = useState(true);
  const [seed, setSeed] = useState(1);
  const [exported, setExported] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    setNotesRaw(loadNotes());
    try {
      const e = localStorage.getItem(`${STORE}-event`);
      if (e && VFX_EVENTS.some((x) => x.id === e)) setEventId(e as VfxEvent);
      const l = localStorage.getItem(`${STORE}-live`);
      if (l === "0") setLive(false);
    } catch { /* fine */ }
    const q = new URLSearchParams(window.location.search);
    const ev = q.get("event");
    if (ev && VFX_EVENTS.some((x) => x.id === ev)) setEventId(ev as VfxEvent);
    const ed = q.get("edit");
    if (ed) setEditing(ed);
  }, []);
  const setNotes = useCallback((f: (n: VfxNotes) => VfxNotes) => {
    setNotesRaw((n) => {
      const next = f(n);
      try { localStorage.setItem(STORE, JSON.stringify(next)); } catch { /* fine */ }
      return next;
    });
  }, []);
  function pickEvent(id: VfxEvent) {
    setEventId(id);
    try { localStorage.setItem(`${STORE}-event`, id); } catch { /* fine */ }
  }
  function toggleLive() {
    setLive((l) => {
      try { localStorage.setItem(`${STORE}-live`, l ? "0" : "1"); } catch { /* fine */ }
      return !l;
    });
  }

  const override = useMemo(
    () => (live ? picksToOverride(notes, editing ? { id: editing } : undefined) : undefined),
    [live, notes, editing],
  );
  const inMatch = override ? Object.keys(override).length : 0;

  const ev = VFX_EVENTS.find((e) => e.id === eventId) ?? VFX_EVENTS[0];
  const list = VFX_VARIANTS[ev.id];

  async function doExport() {
    const text = exportVfxPicks(notes);
    setExported(text);
    try { await navigator.clipboard.writeText(text); setMsg("Picks copied — paste them to us."); } catch { setMsg("Copy the text in the box below."); }
  }
  const pickedCount = Object.keys(notes.picks).length;

  return (
    <main className="min-h-screen bg-slate-950 px-4 pb-24 pt-5 text-white">
      <h1 className="text-2xl font-black">Visual Effects Lab</h1>
      <p className="mt-1 text-sm font-bold text-white/90">
        Each card shows an effect at four moments, start to end. Rate, pick one per moment, edit with the sliders, then try your picks in the real match at the bottom.
      </p>

      <div className="sticky top-0 z-10 -mx-4 mt-3 border-b border-white/10 bg-slate-950/95 px-4 py-2 backdrop-blur">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {VFX_EVENTS.map((e) => (
            <button key={e.id} onClick={() => pickEvent(e.id)}
              className={`h-11 shrink-0 rounded-full px-3 text-sm font-black ${e.id === ev.id ? "bg-emerald-500 text-slate-950" : "bg-white/10 text-white"}`}>
              {e.emoji} {e.label}{notes.picks[e.id] ? " ✓" : ""}
            </button>
          ))}
        </div>
      </div>

      <section className="mt-4">
        <h2 className="text-lg font-black">{ev.emoji} {ev.label}</h2>
        <p className="text-sm font-bold text-white/90">{ev.about} {list.length} to try.</p>
        <ul className="mt-2 space-y-3">
          {list.map((v) => (
            <VariantCard key={v.id} v={v} notes={notes} setNotes={setNotes}
              editing={editing === v.id} setEditing={setEditing} />
          ))}
        </ul>
      </section>

      <section className="mt-6 rounded-2xl border border-white/15 bg-white/5 p-3" data-live-match>
        <h2 className="text-lg font-black">Try them in a real match</h2>
        <label className="mt-2 flex min-h-[48px] items-center gap-3 rounded-xl bg-black/30 px-3">
          <input type="checkbox" checked={live} onChange={toggleLive} className="h-6 w-6 accent-emerald-400" />
          <span className="text-sm font-black">Use my picks in the live match below</span>
        </label>
        <p className="mt-1 text-xs font-bold text-white/90">
          {live
            ? inMatch ? `${inMatch} of ${VFX_EVENTS.length} moments use your picks${editing ? " (plus the one you are editing)" : ""}. Moments you have not picked show nothing extra.` : "Nothing picked yet: pick a card (or open one in Edit) to see it here."
            : "Off: the match draws what this phone's game draws."}
        </p>
        <div className="mt-2 flex gap-2">
          <button onClick={() => setSeed((s) => s + 1)} className="h-11 flex-1 rounded-xl bg-white/10 text-sm font-black">New match</button>
        </div>
        <div className="mt-3 -mx-1">
          <EnginePlay key={seed} seed={seed} vfxOverride={override} />
        </div>
      </section>

      <section className="mt-4 rounded-2xl border border-amber-300/40 bg-amber-400/10 p-3">
        <h2 className="text-lg font-black">Export my picks</h2>
        <p className="text-sm font-bold text-white/90">{pickedCount} of {VFX_EVENTS.length} moments picked. Copies a short summary to paste to us.</p>
        <button onClick={doExport} className="mt-2 h-12 w-full rounded-xl bg-amber-300 text-base font-black text-slate-950">Export my picks</button>
        {exported && (
          <textarea readOnly value={exported} rows={10}
            className="mt-2 w-full rounded-lg border border-white/15 bg-black/40 p-2 font-mono text-xs text-white" />
        )}
        {msg && <p className="mt-2 text-xs font-bold text-white/90">{msg}</p>}
        <button
          onClick={() => { if (confirm("Clear every rating, note, edit and pick on this device?")) { setNotes(() => EMPTY_VFX_NOTES); setExported(null); setEditing(null); } }}
          className="mt-2 h-10 w-full rounded-xl border border-white/20 text-sm font-black text-white/90">Clear everything</button>
      </section>

      <p className="mt-4 text-xs font-bold text-white/80">
        Saved on this device only. Nothing here changes the game.
      </p>
      <PageGuide page="/star-vfx-lab-dev" />
    </main>
  );
}
