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
 * Layout (Harry, 19 Oct 2026, option 1 "single effect"): the moments down the
 * left, one effect big in the middle with every version as a tile under it,
 * rate / pick / note and the edit dials on the right. On a phone they stack.
 *
 * Every variant is a recipe in lib/star/vfxLab.ts, painted by a pure function.
 * The filmstrips are painted ONCE per change (no animation loop of their own —
 * the one-engine rule). The moving version is the real match: EnginePlay with
 * the test-only `vfxOverride` prop, so the picks are drawn on real kicks,
 * saves and goals. Ratings, notes, edits and picks stay in this browser.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PageGuide from "@/components/admin/PageGuide";
import { BroadcastPage, Panel, Btn, Note } from "@/components/admin/broadcast/BroadcastPage";
import "./vfx-lab.css";
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

/** Moments of the effect (all four, or the ones asked for), painted once per change. */
function Filmstrip({ event, v, edit, slices = FILM_SLICES, className }: {
  event: VfxEvent; v: VfxVariant; edit?: Partial<VfxParams>; slices?: readonly number[]; className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const key = JSON.stringify(edit ?? {});
  const sk = slices.join(",");
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const dpr = Math.min(2, typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1);
    const n = slices.length, gap = 3;
    cv.width = Math.round((FW * n + gap * (n - 1)) * dpr);
    cv.height = Math.round(FH * dpr);
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const r = editedRecipe(v, edit);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    slices.forEach((u, i) => {
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
  }, [event, v.id, key, sk]);
  const n = slices.length;
  return <canvas ref={ref} className={className ?? "vx-film"} style={{ aspectRatio: `${FW * n + 3 * (n - 1)} / ${FH}` }} aria-label={`${v.name}, ${n === 1 ? "one moment" : `${n} moments`}`} />;
}

function fmt(k: VfxNumKey, v: number) {
  const i = PARAM_INFO[k];
  return `${k === "count" ? v : +v.toFixed(2)}${i.unit ?? ""}`;
}

type SetNotes = (f: (n: VfxNotes) => VfxNotes) => void;

function Badges({ v, notes, editing }: { v: VfxVariant; notes: VfxNotes; editing: boolean }) {
  const edit = notes.edits[v.id];
  const edited = edit && describeEdit(v, edit) !== "as made";
  return (
    <>
      {v.current && <span className="vx-tag" data-c="now">in game now</span>}
      {edited && <span className="vx-tag" data-c="edit">edited</span>}
      {editing && <span className="vx-tag" data-c="live">in the live match</span>}
    </>
  );
}

/** One version of the moment, as a tile under the big preview. */
function Tile({ v, notes, on, editing, onClick }: { v: VfxVariant; notes: VfxNotes; on: boolean; editing: boolean; onClick: () => void }) {
  const picked = notes.picks[v.event] === v.id;
  const rating = notes.ratings[v.id] ?? 0;
  return (
    <button className="vx-tile" aria-pressed={on} data-picked={picked ? "true" : undefined} data-variant={v.id} onClick={onClick}>
      {v.off ? <div className="vx-tile-off">Nothing</div> : <Filmstrip event={v.event} v={v} edit={notes.edits[v.id]} slices={[FILM_SLICES[1]]} className="vx-tile-pic" />}
      <span className="vx-tile-name">{v.name}</span>
      <span className="vx-tile-sub">
        {picked && <b className="vx-pickmark">✓ pick</b>}
        {rating > 0 && <span className="vx-stars-mini">{"★".repeat(rating)}</span>}
        {editing && <span className="vx-tag" data-c="live">live</span>}
      </span>
    </button>
  );
}

/** Rate, pick and note for the shown version. */
function RatePanel({ v, notes, setNotes }: { v: VfxVariant; notes: VfxNotes; setNotes: SetNotes }) {
  const picked = notes.picks[v.event] === v.id;
  const rating = notes.ratings[v.id] ?? 0;
  return (
    <Panel title="Rate this effect" note={v.name}>
      <div className="vx-stars">
        {[1, 2, 3, 4, 5].map((k) => (
          <button key={k} aria-label={`${k} stars`} data-on={k <= rating ? "true" : undefined}
            onClick={() => setNotes((n) => ({ ...n, ratings: { ...n.ratings, [v.id]: n.ratings[v.id] === k ? 0 : k } }))}>★</button>
        ))}
      </div>
      <button className="vx-pick" data-on={picked ? "true" : undefined} onClick={() => setNotes((n) => {
        const picks = { ...n.picks };
        if (picks[v.event] === v.id) delete picks[v.event]; else picks[v.event] = v.id;
        return { ...n, picks };
      })}>
        {picked ? "✓ My pick" : "Pick this"}
      </button>
      <input
        className="vx-input"
        value={notes.notes[v.id] ?? ""}
        onChange={(e) => { const val = e.target.value; setNotes((n) => ({ ...n, notes: { ...n.notes, [v.id]: val } })); }}
        placeholder="Note (what you like or don't)"
      />
    </Panel>
  );
}

/** The dials that style uses, behind Edit ▾. */
function EditPanel({ v, notes, setNotes, editing, setEditing }: {
  v: VfxVariant; notes: VfxNotes; setNotes: SetNotes; editing: boolean; setEditing: (id: string | null) => void;
}) {
  const edit = notes.edits[v.id];
  const p = editedRecipe(v, edit).params;
  const [msg, setMsg] = useState("");
  const used = STYLE_PARAMS[v.recipe.style];
  const set = (k: keyof VfxParams, val: number | string) =>
    setNotes((n) => ({ ...n, edits: { ...n.edits, [v.id]: { ...(n.edits[v.id] ?? {}), [k]: val } } }));
  async function copy() {
    const text = JSON.stringify({ id: v.id, style: v.recipe.style, ...pickUsed(v.recipe.style, p) });
    try { await navigator.clipboard.writeText(text); setMsg("Recipe copied"); } catch { setMsg("Couldn't copy — use Export my picks instead."); }
    setTimeout(() => setMsg(""), 2500);
  }
  if (v.off) return null;
  return (
    <Panel title="Edit" note={editing ? "open" : undefined}>
      <button className="vx-wide" onClick={() => setEditing(editing ? null : v.id)}>{editing ? "Close edit ▴" : "Edit ▾"}</button>
      {editing && (
        <div className="vx-dials">
          {used.filter((k): k is VfxNumKey => k in PARAM_INFO).map((k) => (
            <label key={k} className="vx-dial">
              <span><span>{PARAM_INFO[k].label}</span><b>{fmt(k, p[k])}</b></span>
              <input type="range" min={PARAM_INFO[k].min} max={PARAM_INFO[k].max} step={PARAM_INFO[k].step} value={p[k]}
                onChange={(e) => set(k, Number(e.target.value))} />
            </label>
          ))}
          {(used.includes("color") || used.includes("color2")) && (
            <div className="vx-colours">
              {(["color", "color2"] as const).filter((k) => used.includes(k)).map((k) => (
                <label key={k}>
                  <input type="color" value={p[k]} onChange={(e) => set(k, e.target.value)} />
                  {k === "color" ? "Colour" : "Colour 2"}
                </label>
              ))}
            </div>
          )}
          {used.includes("text") && (
            <label className="vx-dial">Word
              <input className="vx-input" value={p.text} maxLength={14} onChange={(e) => set("text", e.target.value)} />
            </label>
          )}
          <Note>The live match below draws this one while it is open.</Note>
          <div className="vx-two">
            <button className="vx-wide" onClick={() => setNotes((n) => { const edits = { ...n.edits }; delete edits[v.id]; return { ...n, edits }; })}>Reset</button>
            <button className="vx-wide" onClick={copy}>Copy recipe</button>
          </div>
        </div>
      )}
      {msg && <p className="vx-ok">{msg}</p>}
    </Panel>
  );
}

export default function VfxLabPage() {
  const [notes, setNotesRaw] = useState<VfxNotes>(EMPTY_VFX_NOTES);
  const [eventId, setEventId] = useState<VfxEvent>("strike");
  const [shown, setShown] = useState<Partial<Record<VfxEvent, string>>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [live, setLive] = useState(true);
  const [seed, setSeed] = useState(0); // 0 = not started (the match loads real squads; start it on a tap)
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
    if (ed) {
      setEditing(ed);
      const owner = VFX_EVENTS.find((x) => VFX_VARIANTS[x.id].some((v) => v.id === ed));
      if (owner) setShown((s) => ({ ...s, [owner.id]: ed }));
    }
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
  // The version shown big: the one tapped, else your pick, else the one being edited, else the first.
  const v = list.find((x) => x.id === shown[ev.id])
    ?? list.find((x) => x.id === notes.picks[ev.id])
    ?? list.find((x) => x.id === editing)
    ?? list[0];

  async function doExport() {
    const text = exportVfxPicks(notes);
    setExported(text);
    try { await navigator.clipboard.writeText(text); setMsg("Picks copied — paste them to us."); } catch { setMsg("Copy the text in the box below."); }
  }
  const pickedCount = Object.keys(notes.picks).length;

  return (
    <BroadcastPage title="Visual effects lab" sub="Pick and edit the effect for each match moment, then try your picks in a real match.">
      <div className="vx-layout">
        <aside className="vx-rail">
          <Panel title="Moments" note={`${pickedCount} of ${VFX_EVENTS.length} picked`}>
            <div className="vx-moments">
              {VFX_EVENTS.map((e) => (
                <button key={e.id} className="vx-moment" aria-pressed={e.id === ev.id} onClick={() => pickEvent(e.id)}>
                  <span>{e.emoji}</span> {e.label}{notes.picks[e.id] ? " ✓" : ""}
                </button>
              ))}
            </div>
          </Panel>
        </aside>

        <div className="vx-main">
          <Panel title={`${ev.emoji} ${ev.label}`} note={`${list.length} to try`}>
            <Note>{ev.about} Each picture shows the effect at four moments, start to end.</Note>
            <div className="vx-stage" data-variant-shown={v.id}>
              <div className="vx-stage-head">
                <b>{v.name}</b>
                <Badges v={v} notes={notes} editing={editing === v.id} />
              </div>
              <p className="vx-about">{v.about}</p>
              {v.off ? <div className="vx-offbig">This one draws nothing extra.</div> : <Filmstrip event={v.event} v={v} edit={notes.edits[v.id]} />}
            </div>
            <div className="vx-tiles">
              {list.map((x) => (
                <Tile key={x.id} v={x} notes={notes} on={x.id === v.id} editing={editing === x.id}
                  onClick={() => setShown((s) => ({ ...s, [ev.id]: x.id }))} />
              ))}
            </div>
          </Panel>
        </div>

        <div className="vx-side">
          <RatePanel v={v} notes={notes} setNotes={setNotes} />
          <EditPanel key={v.id} v={v} notes={notes} setNotes={setNotes} editing={editing === v.id} setEditing={setEditing} />
        </div>
      </div>

      <div data-live-match>
        <Panel title="Try them in a real match" note="the real engine">
          <label className="vx-check">
            <input type="checkbox" checked={live} onChange={toggleLive} />
            <span>Use my picks in the live match below</span>
          </label>
          <Note>
            {live
              ? inMatch ? `${inMatch} of ${VFX_EVENTS.length} moments use your picks${editing ? " (plus the one you are editing)" : ""}. Moments you have not picked show nothing extra.` : "Nothing picked yet: pick a card (or open one in Edit) to see it here."
              : "Off: the match draws what this phone's game draws."}
          </Note>
          {seed === 0 ? (
            <div><Btn main onClick={() => setSeed(1)}>▶ Start the live match</Btn></div>
          ) : (
            <>
              <div><Btn onClick={() => setSeed((s) => s + 1)}>New match</Btn></div>
              <div className="vx-match">
                <EnginePlay key={seed} seed={seed} vfxOverride={override} />
              </div>
            </>
          )}
        </Panel>
      </div>

      <Panel title="Export my picks" note={`${pickedCount} of ${VFX_EVENTS.length} moments picked`}>
        <Note>Copies a short summary to paste to us.</Note>
        <div className="vx-row">
          <Btn main onClick={doExport}>Export my picks</Btn>
          <Btn onClick={() => { if (confirm("Clear every rating, note, edit and pick on this device?")) { setNotes(() => EMPTY_VFX_NOTES); setExported(null); setEditing(null); } }}>Clear everything</Btn>
        </div>
        {exported && <textarea readOnly value={exported} rows={10} className="vx-export" />}
        {msg && <Note>{msg}</Note>}
      </Panel>

      <Note>Saved on this device only. Nothing here changes the game.</Note>
      <PageGuide page="/star-vfx-lab-dev" />
    </BroadcastPage>
  );
}
