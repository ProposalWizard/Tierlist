"use client";

/**
 * SOUND LAB — hear, edit and rate candidate match sounds.
 *
 * Leo, 14 Oct 2026: "make a testing area where I can view and edit loads of
 * different sounds for loads of different things (ball kick, goalie save, ball
 * hits net, ball blocked, pass, goal, etc). Like make like 5–10 different
 * effects I can view and edit and tell you about what I prefer."
 *
 * Every made-up sound is a recipe in lib/star/sfxLab.ts, rendered to samples
 * by a pure function and played through an AudioBuffer. "Current (match)" is
 * the live match's own synthesised sound; "Current file" is the game's
 * recorded file (with any Sound Board replacement). Pictures are drawn once
 * per change as SVG — no animation loop. Ratings, notes, dial settings and
 * picks are kept in this browser only.
 *
 * Broadcast look (Harry, 19 Oct 2026: "sound lab - option 1 and 2"): two
 * layouts of the same tools, switched by the pills at the top and remembered
 * on this device. "One sound" = an events list, one sound open at a time with
 * a big picture. "All sounds" = every sound as a compact row, with an edit
 * panel for the one you tap.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import PageGuide from "@/components/admin/PageGuide";
import { BroadcastPage, Panel, PanelGrid, Btn, Pill, Label, Note } from "@/components/admin/broadcast/BroadcastPage";
import "./soundlab.css";
import { audioContext } from "@/lib/star/audioOut";
import { sfxUrl } from "@/lib/star/sfx";
import {
  LAB_EVENTS, TWEAK_DIALS, EMPTY_NOTES, SEQUENCES,
  renderRecipe, processFile, waveformColumns, spectrumBands, encodeWav, exportPicks, chosenFor,
  describeTweak, fullTweak, type Candidate, type LabNotes, type Tweak,
} from "@/lib/star/sfxLab";

const SR = 44100;
const STORE = "star-sound-lab-v1";
const LAYOUT_KEY = "star-sound-lab-layout";
type Layout = "one" | "rows";
type SetNotes = (f: (n: LabNotes) => LabNotes) => void;

function loadNotes(): LabNotes {
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) return EMPTY_NOTES;
    const j = JSON.parse(raw) as Partial<LabNotes>;
    return { tweaks: j.tweaks ?? {}, ratings: j.ratings ?? {}, notes: j.notes ?? {}, picks: j.picks ?? {} };
  } catch {
    return EMPTY_NOTES;
  }
}

// Decoded real files, by url.
const fileCache = new Map<string, Promise<Float32Array | null>>();
function loadFile(name: string): Promise<Float32Array | null> {
  const url = sfxUrl(name);
  let p = fileCache.get(url);
  if (!p) {
    p = (async () => {
      const ctx = audioContext();
      if (!ctx) return null;
      try {
        const r = await fetch(url);
        if (!r.ok) return null;
        const buf = await ctx.decodeAudioData(await r.arrayBuffer());
        // Mono, at our rate (decodeAudioData gives the context's rate).
        const ch = buf.getChannelData(0);
        const ratio = buf.sampleRate / SR;
        const out = new Float32Array(Math.floor(ch.length / ratio));
        for (let i = 0; i < out.length; i++) out[i] = ch[Math.floor(i * ratio)];
        return out;
      } catch {
        return null;
      }
    })();
    fileCache.set(url, p);
  }
  return p;
}

/** Samples for a candidate with its dials. */
async function samplesFor(c: Candidate, tweak?: Partial<Tweak>): Promise<Float32Array | null> {
  if (c.recipe) return renderRecipe(c.recipe, tweak, SR);
  if (c.file) {
    const raw = await loadFile(c.file);
    return raw ? processFile(raw.slice(), SR, tweak) : null;
  }
  return null;
}

let lastSources: AudioBufferSourceNode[] = [];
function stopAll() {
  for (const s of lastSources) { try { s.stop(); } catch { /* done */ } }
  lastSources = [];
}
/** Play samples `at` seconds from now. Call from a tap (browsers keep audio off until one). */
function playSamples(s: Float32Array, at = 0, keep = false): number {
  const ctx = audioContext();
  if (!ctx) return 0;
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  if (!keep) stopAll();
  const buf = ctx.createBuffer(1, s.length, SR);
  buf.getChannelData(0).set(s);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(ctx.destination);
  src.start(ctx.currentTime + 0.03 + at);
  lastSources.push(src);
  return s.length / SR;
}
/** Play a candidate straight from a row tap (no picture made first). */
async function playCandidate(c: Candidate, tweak?: Partial<Tweak>) {
  const ctx = audioContext();
  if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
  const s = await samplesFor(c, tweak);
  if (s) playSamples(s);
}

/** True on a phone-width screen. */
function useNarrow(px = 900): boolean {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const m = window.matchMedia(`(max-width: ${px}px)`);
    const on = () => setNarrow(m.matches);
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, [px]);
  return narrow;
}

function Waveform({ s, big }: { s: Float32Array; big?: boolean }) {
  const cols = useMemo(() => waveformColumns(s, big ? 160 : 96), [s, big]);
  const bands = useMemo(() => spectrumBands(s, SR, 20), [s]);
  const N = cols.length - 1;
  const W = 240, H = 44;
  const top = cols.map((c, i) => `${i === 0 ? "M" : "L"}${(i / N) * W},${H / 2 - c.max * (H / 2)}`).join(" ");
  const bot = [...cols].reverse().map((c, i) => `L${((N - i) / N) * W},${H / 2 - c.min * (H / 2)}`).join(" ");
  return (
    <div className="sl-wave" data-big={big ? "true" : undefined}>
      <svg viewBox={`0 0 ${W} ${H}`} className="sl-wave-main" preserveAspectRatio="none" aria-label="waveform">
        {big && [1, 2, 3, 4, 5].map((k) => <line key={k} x1={(k / 6) * W} x2={(k / 6) * W} y1="0" y2={H} stroke="#5a96ff22" strokeWidth="0.4" />)}
        <line x1="0" x2={W} y1={H / 2} y2={H / 2} stroke="#5a96ff44" strokeWidth="0.4" />
        <path d={`${top} ${bot} Z`} fill="url(#sl-grad)" />
        <defs>
          <linearGradient id="sl-grad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#7fe3ff" /><stop offset="0.5" stopColor="#2f8cff" /><stop offset="1" stopColor="#7fe3ff" />
          </linearGradient>
        </defs>
      </svg>
      <svg viewBox="0 0 60 44" className="sl-wave-bands" aria-label="low to high">
        {bands.map((v, i) => <rect key={i} x={i * 3} y={44 - v * 42} width={2.4} height={v * 42} fill="#ffc24a" />)}
      </svg>
      <span className="sl-wave-len">{(s.length / SR).toFixed(2)}s</span>
    </div>
  );
}

/** Everything one sound can do, shared by both layouts. */
function useCandidate(c: Candidate, notes: LabNotes, setNotes: SetNotes, eventId: string) {
  const tweak = notes.tweaks[c.id];
  const [samples, setSamples] = useState<Float32Array | null>(null);
  const [failed, setFailed] = useState(false);
  const [msg, setMsg] = useState("");
  const tweakKey = JSON.stringify(tweak ?? {});
  useEffect(() => {
    let live = true;
    setSamples(null); setFailed(false);
    samplesFor(c, tweak).then((s) => { if (!live) return; setSamples(s); setFailed(!s); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.id, tweakKey]);

  const picked = notes.picks[eventId] === c.id;
  const rating = notes.ratings[c.id] ?? 0;
  const tw = fullTweak(tweak);
  const edited = !!tweak && describeTweak(tweak) !== "no changes";
  const setTweak = (k: keyof Tweak, v: number) =>
    setNotes((n) => ({ ...n, tweaks: { ...n.tweaks, [c.id]: { ...(n.tweaks[c.id] ?? {}), [k]: v } } }));

  async function play() {
    const s = samples ?? (await samplesFor(c, tweak));
    if (s) playSamples(s);
  }
  async function copy(text: string, done: string) {
    try { await navigator.clipboard.writeText(text); setMsg(done); } catch { setMsg("Couldn't copy — long-press the box under Export instead."); }
    setTimeout(() => setMsg(""), 2500);
  }
  function saveWav() {
    if (!samples) return;
    const blob = new Blob([encodeWav(samples, SR) as Uint8Array<ArrayBuffer>], { type: "audio/wav" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${c.id.replace("/", "-")}.wav`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  const rate = (k: number) => setNotes((n) => ({ ...n, ratings: { ...n.ratings, [c.id]: n.ratings[c.id] === k ? 0 : k } }));
  const togglePick = () => setNotes((n) => {
    const picks = { ...n.picks };
    if (picks[eventId] === c.id) delete picks[eventId]; else picks[eventId] = c.id;
    return { ...n, picks };
  });
  const setNote = (v: string) => setNotes((n) => ({ ...n, notes: { ...n.notes, [c.id]: v } }));
  const reset = () => setNotes((n) => { const tweaks = { ...n.tweaks }; delete tweaks[c.id]; return { ...n, tweaks }; });
  const copyRecipe = () => copy(JSON.stringify({ id: c.id, file: c.file, recipe: c.recipe, dials: tw }), "Recipe copied");
  return { c, samples, failed, msg, picked, rating, tw, edited, note: notes.notes[c.id] ?? "", setTweak, play, saveWav, rate, togglePick, setNote, reset, copyRecipe };
}
type Cand = ReturnType<typeof useCandidate>;

function Tags({ c, edited }: { c: Candidate; edited: boolean }) {
  return (
    <>
      {c.current && <span className="sl-tag" data-kind="now">{c.current === "match" ? "in game now" : "file"}</span>}
      {edited && <span className="sl-tag" data-kind="edit">edited</span>}
    </>
  );
}

function Stars({ k }: { k: Cand }) {
  return (
    <div className="sl-stars">
      {[1, 2, 3, 4, 5].map((s) => (
        <button key={s} aria-label={`${s} stars`} onClick={() => k.rate(s)} data-on={s <= k.rating ? "true" : undefined}>★</button>
      ))}
    </div>
  );
}

function PickButton({ k }: { k: Cand }) {
  return <button className="sl-pick" data-on={k.picked ? "true" : undefined} onClick={k.togglePick}>{k.picked ? "✓ My pick" : "Pick this"}</button>;
}

function NoteBox({ k, rows }: { k: Cand; rows?: number }) {
  return rows
    ? <textarea className="sl-input" rows={rows} value={k.note} onChange={(e) => k.setNote(e.target.value)} placeholder="Note (what you like or don't)" />
    : <input className="sl-input" value={k.note} onChange={(e) => k.setNote(e.target.value)} placeholder="Note (what you like or don't)" />;
}

function WaveOrLoading({ k, big }: { k: Cand; big?: boolean }) {
  return k.samples ? <Waveform s={k.samples} big={big} /> : <Note>{k.failed ? "Couldn't load this file." : "Loading…"}</Note>;
}

/** The sliders plus Reset / Copy recipe / Save WAV. */
function Dials({ k }: { k: Cand }) {
  return (
    <div className="sl-dials">
      <div className="sl-dial-grid">
        {TWEAK_DIALS.map((d) => (
          <label key={d.key} className="sl-dial">
            <span><span>{d.label}</span><b>{d.key === "pitch" ? `${k.tw.pitch > 0 ? "+" : ""}${k.tw.pitch}` : k.tw[d.key].toFixed(2)}</b></span>
            <input type="range" min={d.min} max={d.max} step={d.step} value={k.tw[d.key]}
              onChange={(e) => k.setTweak(d.key, Number(e.target.value))}
              onPointerUp={k.play} />
          </label>
        ))}
      </div>
      <Note>Let go of a slider to hear it.{k.c.file ? " A file's Length moves its pitch too; Punch adds a hit at the start." : ""}</Note>
      <div className="sl-row-btns">
        <Btn onClick={k.reset}>Reset</Btn>
        <Btn onClick={k.copyRecipe}>Copy recipe</Btn>
        <Btn onClick={k.saveWav} disabled={!k.samples}>Save WAV</Btn>
      </div>
    </div>
  );
}

function Msg({ k }: { k: Cand }) {
  return k.msg ? <p className="sl-msg">{k.msg}</p> : null;
}

// ── Option 1: one sound at a time ────────────────────────────────────────────
function OneSound({ c, notes, setNotes, eventId }: { c: Candidate; notes: LabNotes; setNotes: SetNotes; eventId: string }) {
  const k = useCandidate(c, notes, setNotes, eventId);
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="sl-player" data-candidate-open={c.id}>
        <div className="sl-player-top">
          <button className="sl-play" onClick={k.play} aria-label={`Play ${c.name}`}>▶</button>
          <div className="sl-player-name">
            <div><b>{c.name}</b> <Tags c={c} edited={k.edited} /></div>
            <p>{c.about}</p>
          </div>
        </div>
        <WaveOrLoading k={k} big />
      </div>
      <div className="sl-side">
        <div className="sl-glow">
          <Label>Rating and pick</Label>
          <Stars k={k} />
          <PickButton k={k} />
          <Label>Note</Label>
          <NoteBox k={k} rows={3} />
          <Msg k={k} />
        </div>
        <button className="sl-edit-toggle" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <span>Edit</span><span>{open ? "▴" : "▾"}</span>
        </button>
      </div>
      {open && <div className="sl-edit-wide"><Dials k={k} /></div>}
    </>
  );
}

function LayoutOne({ notes, setNotes, eventId, pickEvent }: { notes: LabNotes; setNotes: SetNotes; eventId: string; pickEvent: (id: string) => void }) {
  const ev = LAB_EVENTS.find((e) => e.id === eventId) ?? LAB_EVENTS[0];
  const [sel, setSel] = useState<Record<string, string>>({});
  const cid = sel[ev.id] && ev.candidates.some((c) => c.id === sel[ev.id]) ? sel[ev.id] : ev.candidates[0].id;
  const c = ev.candidates.find((x) => x.id === cid) ?? ev.candidates[0];
  return (
    <div className="sl-one">
      <aside className="sl-events">
        <Label>Sound events</Label>
        <select className="sl-select" value={ev.id} onChange={(e) => pickEvent(e.target.value)} aria-label="Event">
          {LAB_EVENTS.map((e) => <option key={e.id} value={e.id}>{e.emoji} {e.label}{notes.picks[e.id] ? " ✓" : ""}</option>)}
        </select>
        <div className="sl-event-list">
          {LAB_EVENTS.map((e) => (
            <button key={e.id} className="sl-event" aria-pressed={e.id === ev.id} onClick={() => pickEvent(e.id)}>
              <span>{e.emoji}</span><b>{e.label}</b>{notes.picks[e.id] && <i>✓</i>}
            </button>
          ))}
        </div>
      </aside>
      <Panel title={`${ev.emoji} ${ev.label}`} note={`${ev.candidates.length} sounds to try`}>
        <div className="sl-tabs">
          {ev.candidates.map((x) => (
            <button key={x.id} data-candidate={x.id} aria-pressed={x.id === c.id} onClick={() => setSel((s) => ({ ...s, [ev.id]: x.id }))}>
              {notes.picks[ev.id] === x.id && "✓ "}{x.name}{(notes.ratings[x.id] ?? 0) > 0 && <em> {"★".repeat(notes.ratings[x.id])}</em>}
            </button>
          ))}
        </div>
        <div className="sl-one-body">
          <OneSound key={c.id} c={c} notes={notes} setNotes={setNotes} eventId={ev.id} />
        </div>
      </Panel>
    </div>
  );
}

// ── Option 2: every sound as a compact row ───────────────────────────────────
function EditPanel({ c, notes, setNotes, eventId, onClose }: { c: Candidate; notes: LabNotes; setNotes: SetNotes; eventId: string; onClose: () => void }) {
  const k = useCandidate(c, notes, setNotes, eventId);
  return (
    <div className="sl-editp" data-candidate-open={c.id}>
      <div className="sl-editp-head">
        <button className="sl-play sl-play-sm" onClick={k.play} aria-label={`Play ${c.name}`}>▶</button>
        <div className="sl-player-name"><div><b>{c.name}</b> <Tags c={c} edited={k.edited} /></div><p>{c.about}</p></div>
        <button className="sl-x" onClick={onClose} aria-label="Close">✕</button>
      </div>
      <WaveOrLoading k={k} />
      <div className="sl-editp-rate"><Stars k={k} /><PickButton k={k} /></div>
      <NoteBox k={k} />
      <Dials k={k} />
      <Msg k={k} />
    </div>
  );
}

function SoundRow({ c, notes, setNotes, eventId, open, onOpen }: {
  c: Candidate; notes: LabNotes; setNotes: SetNotes; eventId: string; open: boolean; onOpen: () => void;
}) {
  const picked = notes.picks[eventId] === c.id;
  const rating = notes.ratings[c.id] ?? 0;
  const tweak = notes.tweaks[c.id];
  const edited = !!tweak && describeTweak(tweak) !== "no changes";
  const hasNote = !!notes.notes[c.id];
  const togglePick = () => setNotes((n) => {
    const picks = { ...n.picks };
    if (picks[eventId] === c.id) delete picks[eventId]; else picks[eventId] = c.id;
    return { ...n, picks };
  });
  return (
    <div className="sl-row" data-candidate={c.id} data-open={open ? "true" : undefined} data-picked={picked ? "true" : undefined}>
      <button className="sl-row-play" onClick={() => playCandidate(c, tweak)} aria-label={`Play ${c.name}`}>▶</button>
      <button className="sl-row-name" onClick={onOpen}>
        <b>{c.name}</b>
        <span><Tags c={c} edited={edited} />{rating > 0 && <em className="sl-row-stars">{"★".repeat(rating)}</em>}</span>
      </button>
      <button className="sl-radio" aria-pressed={picked} onClick={togglePick} aria-label={picked ? `Un-pick ${c.name}` : `Pick ${c.name}`}>
        <i />
        <span>Pick</span>
      </button>
      <button className="sl-row-edit" onClick={onOpen} aria-expanded={open} title="Rate, note and edit">
        {hasNote ? "✎" : "≡"}<span>{open ? "Close" : "Edit"}</span>
      </button>
    </div>
  );
}

function LayoutRows({ notes, setNotes, eventId, pickEvent }: { notes: LabNotes; setNotes: SetNotes; eventId: string; pickEvent: (id: string) => void }) {
  const narrow = useNarrow();
  const [openId, setOpenId] = useState<{ ev: string; c: string } | null>(null);
  const openEv = openId ? LAB_EVENTS.find((e) => e.id === openId.ev) : undefined;
  const openC = openEv?.candidates.find((c) => c.id === openId?.c);
  function jump(id: string) {
    pickEvent(id);
    document.getElementById(`sl-ev-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  const toggle = (ev: string, c: string) => setOpenId((o) => (o && o.ev === ev && o.c === c ? null : { ev, c }));
  return (
    <>
      <div className="sl-jump">
        {LAB_EVENTS.map((e) => (
          <Pill key={e.id} on={e.id === eventId} onClick={() => jump(e.id)}>{e.emoji} {e.label}{notes.picks[e.id] ? " ✓" : ""}</Pill>
        ))}
      </div>
      <div className="sl-rows-layout">
        <div className="sl-rows">
          {LAB_EVENTS.map((ev) => (
            <section key={ev.id} id={`sl-ev-${ev.id}`} className="sl-group" data-current={ev.id === eventId ? "true" : undefined}>
              <div className="sl-group-head"><h3>{ev.emoji} {ev.label}</h3><span>{ev.candidates.length} sounds · pick</span></div>
              {ev.candidates.map((c) => {
                const isOpen = openId?.ev === ev.id && openId.c === c.id;
                return (
                  <div key={c.id}>
                    <SoundRow c={c} notes={notes} setNotes={setNotes} eventId={ev.id} open={isOpen} onOpen={() => toggle(ev.id, c.id)} />
                    {narrow && isOpen && <div className="sl-inline-edit"><EditPanel c={c} notes={notes} setNotes={setNotes} eventId={ev.id} onClose={() => setOpenId(null)} /></div>}
                  </div>
                );
              })}
            </section>
          ))}
        </div>
        {!narrow && (
          <aside className="sl-aside">
            <Panel title="Edit sound">
              {openC && openEv
                ? <EditPanel key={openC.id} c={openC} notes={notes} setNotes={setNotes} eventId={openEv.id} onClose={() => setOpenId(null)} />
                : <Note>Tap a sound&apos;s name or Edit to see its picture, rate it, write a note and change it with sliders.</Note>}
            </Panel>
          </aside>
        )}
      </div>
    </>
  );
}

export default function SoundLabPage() {
  const [notes, setNotesRaw] = useState<LabNotes>(EMPTY_NOTES);
  const [eventId, setEventId] = useState(LAB_EVENTS[0].id);
  const [exported, setExported] = useState<string | null>(null);
  const [seqMsg, setSeqMsg] = useState("");
  const [layout, setLayoutRaw] = useState<Layout>("one");

  useEffect(() => {
    setNotesRaw(loadNotes());
    try { const e = localStorage.getItem(`${STORE}-event`); if (e && LAB_EVENTS.some((x) => x.id === e)) setEventId(e); } catch { /* fine */ }
    try { const l = localStorage.getItem(LAYOUT_KEY); if (l === "one" || l === "rows") setLayoutRaw(l); } catch { /* fine */ }
  }, []);
  const setNotes = useCallback((f: (n: LabNotes) => LabNotes) => {
    setNotesRaw((n) => {
      const next = f(n);
      try { localStorage.setItem(STORE, JSON.stringify(next)); } catch { /* fine */ }
      return next;
    });
  }, []);
  function pickEvent(id: string) {
    setEventId(id);
    try { localStorage.setItem(`${STORE}-event`, id); } catch { /* fine */ }
  }
  function setLayout(l: Layout) {
    setLayoutRaw(l);
    try { localStorage.setItem(LAYOUT_KEY, l); } catch { /* fine */ }
  }

  async function playSequence(id: string) {
    const seq = SEQUENCES.find((s) => s.id === id);
    if (!seq) return;
    stopAll();
    const parts: string[] = [];
    // Render everything first, then schedule, so the timing is exact.
    const ready = await Promise.all(seq.steps.map(async (st) => {
      const c = chosenFor(st.event, notes);
      parts.push(c ? c.name : "?");
      return { at: st.at, s: c ? await samplesFor(c, notes.tweaks[c.id]) : null };
    }));
    for (const r of ready) if (r.s) playSamples(r.s, r.at, true);
    setSeqMsg(`Playing: ${seq.steps.map((st, i) => `${LAB_EVENTS.find((e) => e.id === st.event)?.label} = ${parts[i]}`).join(" · ")}`);
  }

  async function doExport() {
    const text = exportPicks(notes);
    setExported(text);
    try { await navigator.clipboard.writeText(text); setSeqMsg("Picks copied — paste them to us."); } catch { setSeqMsg("Copy the text in the box below."); }
  }

  const pickedCount = Object.keys(notes.picks).length;

  return (
    <BroadcastPage
      title="Sound Lab"
      sub="Hear, rate, pick and change each match sound, then export your picks."
      actions={<span className="sl-count">{pickedCount} / {LAB_EVENTS.length} picked</span>}
    >
      <div className="sl-switch">
        <Label>Layout</Label>
        <Pill on={layout === "one"} onClick={() => setLayout("one")}>One sound</Pill>
        <Pill on={layout === "rows"} onClick={() => setLayout("rows")}>All sounds</Pill>
      </div>

      {layout === "one"
        ? <LayoutOne notes={notes} setNotes={setNotes} eventId={eventId} pickEvent={pickEvent} />
        : <LayoutRows notes={notes} setNotes={setNotes} eventId={eventId} pickEvent={pickEvent} />}

      <PanelGrid min={360}>
        <Panel title="Hear them together" note="your pick, or best rated, or the first">
          <div className="sl-seq">
            {SEQUENCES.map((s) => <Btn key={s.id} onClick={() => playSequence(s.id)}>▶ {s.label}</Btn>)}
          </div>
          {seqMsg && <Note>{seqMsg}</Note>}
        </Panel>
        <Panel title="Export my picks" note={`${pickedCount} of ${LAB_EVENTS.length} events picked`}>
          <Note>Copies a short summary to paste to us.</Note>
          <div className="sl-row-btns">
            <Btn main onClick={doExport}>Export my picks</Btn>
            <Btn onClick={() => { if (confirm("Clear every rating, note, edit and pick on this device?")) { setNotes(() => EMPTY_NOTES); setExported(null); } }}>Clear everything</Btn>
          </div>
          {exported && <textarea readOnly value={exported} rows={10} className="sl-input sl-export" />}
        </Panel>
      </PanelGrid>

      <Note>Saved on this device only. Nothing here changes the game yet.</Note>
      <PageGuide page="/star-sound-lab-dev" />
    </BroadcastPage>
  );
}
