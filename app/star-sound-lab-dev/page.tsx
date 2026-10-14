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
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import PageGuide from "@/components/admin/PageGuide";
import { audioContext } from "@/lib/star/audioOut";
import { sfxUrl } from "@/lib/star/sfx";
import {
  LAB_EVENTS, TWEAK_DIALS, EMPTY_NOTES, SEQUENCES,
  renderRecipe, processFile, waveformColumns, spectrumBands, encodeWav, exportPicks, chosenFor,
  describeTweak, fullTweak, type Candidate, type LabNotes, type Tweak,
} from "@/lib/star/sfxLab";

const SR = 44100;
const STORE = "star-sound-lab-v1";

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

function Waveform({ s }: { s: Float32Array }) {
  const cols = useMemo(() => waveformColumns(s, 96), [s]);
  const bands = useMemo(() => spectrumBands(s, SR, 20), [s]);
  const W = 240, H = 44;
  const top = cols.map((c, i) => `${i === 0 ? "M" : "L"}${(i / 95) * W},${H / 2 - c.max * (H / 2)}`).join(" ");
  const bot = [...cols].reverse().map((c, i) => `L${((95 - i) / 95) * W},${H / 2 - c.min * (H / 2)}`).join(" ");
  return (
    <div className="mt-2 flex items-end gap-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-11 min-w-0 flex-1 rounded bg-black/40" preserveAspectRatio="none" aria-label="waveform">
        <line x1="0" x2={W} y1={H / 2} y2={H / 2} stroke="#ffffff22" />
        <path d={`${top} ${bot} Z`} fill="#34d399" />
      </svg>
      <svg viewBox="0 0 60 44" className="h-11 w-16 shrink-0 rounded bg-black/40" aria-label="low to high">
        {bands.map((v, i) => <rect key={i} x={i * 3} y={44 - v * 42} width={2.4} height={v * 42} fill="#60a5fa" />)}
      </svg>
      <span className="w-10 shrink-0 text-right text-[11px] font-bold text-white/80">{(s.length / SR).toFixed(2)}s</span>
    </div>
  );
}

function CandidateCard({ c, notes, setNotes, eventId }: { c: Candidate; notes: LabNotes; setNotes: (f: (n: LabNotes) => LabNotes) => void; eventId: string }) {
  const tweak = notes.tweaks[c.id];
  const [samples, setSamples] = useState<Float32Array | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const tweakKey = JSON.stringify(tweak ?? {});
  useEffect(() => {
    let live = true;
    samplesFor(c, tweak).then((s) => { if (!live) return; setSamples(s); setFailed(!s); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.id, tweakKey]);

  const picked = notes.picks[eventId] === c.id;
  const rating = notes.ratings[c.id] ?? 0;
  const tw = fullTweak(tweak);
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

  return (
    <li className={`rounded-2xl border p-3 ${picked ? "border-amber-300 bg-amber-400/10" : "border-white/15 bg-white/5"}`} data-candidate={c.id}>
      <div className="flex items-center gap-3">
        <button onClick={play} aria-label={`Play ${c.name}`}
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-2xl font-black text-slate-950 active:scale-95">▶</button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-base font-black">{c.name}</span>
            {c.current && <span className="rounded bg-sky-500/30 px-1.5 py-0.5 text-[10px] font-black uppercase text-sky-100">{c.current === "match" ? "in game now" : "file"}</span>}
            {tweak && describeTweak(tweak) !== "no changes" && <span className="rounded bg-fuchsia-500/30 px-1.5 py-0.5 text-[10px] font-black uppercase text-fuchsia-100">edited</span>}
          </div>
          <p className="text-sm font-bold text-white/90">{c.about}</p>
        </div>
      </div>

      {samples ? <Waveform s={samples} /> : <p className="mt-2 text-sm font-bold text-white/80">{failed ? "Couldn't load this file." : "Loading…"}</p>}

      <div className="mt-2 flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((k) => (
          <button key={k} aria-label={`${k} stars`}
            onClick={() => setNotes((n) => ({ ...n, ratings: { ...n.ratings, [c.id]: n.ratings[c.id] === k ? 0 : k } }))}
            className={`h-10 w-9 text-2xl leading-none ${k <= rating ? "text-amber-300" : "text-white/30"}`}>★</button>
        ))}
        <button onClick={() => setNotes((n) => {
          const picks = { ...n.picks };
          if (picks[eventId] === c.id) delete picks[eventId]; else picks[eventId] = c.id;
          return { ...n, picks };
        })}
          className={`ml-auto h-10 rounded-xl px-3 text-sm font-black ${picked ? "bg-amber-300 text-slate-950" : "border border-amber-300/60 text-amber-200"}`}>
          {picked ? "✓ My pick" : "Pick this"}
        </button>
      </div>

      <input
        value={notes.notes[c.id] ?? ""}
        onChange={(e) => { const v = e.target.value; setNotes((n) => ({ ...n, notes: { ...n.notes, [c.id]: v } })); }}
        placeholder="Note (what you like or don't)"
        className="mt-2 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm font-bold text-white placeholder:text-white/50"
      />

      <button onClick={() => setOpen((o) => !o)} className="mt-2 h-10 w-full rounded-xl bg-white/10 text-sm font-black">
        {open ? "Close edit ▴" : "Edit ▾"}
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {TWEAK_DIALS.map((d) => (
            <label key={d.key} className="block">
              <span className="flex justify-between text-sm font-bold">
                <span>{d.label}</span>
                <span className="text-white/90">{d.key === "pitch" ? `${tw.pitch > 0 ? "+" : ""}${tw.pitch}` : tw[d.key].toFixed(2)}</span>
              </span>
              <input type="range" min={d.min} max={d.max} step={d.step} value={tw[d.key]}
                onChange={(e) => setTweak(d.key, Number(e.target.value))}
                onPointerUp={play}
                className="h-8 w-full accent-emerald-400" />
            </label>
          ))}
          <p className="text-xs font-bold text-white/80">Let go of a slider to hear it.{c.file ? " A file's Length moves its pitch too; Punch adds a hit at the start." : ""}</p>
          <div className="grid grid-cols-3 gap-2">
            <button onClick={() => setNotes((n) => { const tweaks = { ...n.tweaks }; delete tweaks[c.id]; return { ...n, tweaks }; })}
              className="h-11 rounded-xl bg-white/10 text-sm font-black">Reset</button>
            <button onClick={() => copy(JSON.stringify({ id: c.id, file: c.file, recipe: c.recipe, dials: tw }), "Recipe copied")}
              className="h-11 rounded-xl bg-white/10 text-sm font-black">Copy recipe</button>
            <button onClick={saveWav} disabled={!samples} className="h-11 rounded-xl bg-white/10 text-sm font-black disabled:opacity-40">Save WAV</button>
          </div>
        </div>
      )}
      {msg && <p className="mt-2 text-sm font-black text-emerald-300">{msg}</p>}
    </li>
  );
}

export default function SoundLabPage() {
  const [notes, setNotesRaw] = useState<LabNotes>(EMPTY_NOTES);
  const [eventId, setEventId] = useState(LAB_EVENTS[0].id);
  const [exported, setExported] = useState<string | null>(null);
  const [seqMsg, setSeqMsg] = useState("");

  useEffect(() => {
    setNotesRaw(loadNotes());
    try { const e = localStorage.getItem(`${STORE}-event`); if (e && LAB_EVENTS.some((x) => x.id === e)) setEventId(e); } catch { /* fine */ }
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

  const ev = LAB_EVENTS.find((e) => e.id === eventId) ?? LAB_EVENTS[0];

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
    <main className="min-h-screen bg-slate-950 px-4 pb-24 pt-5 text-white">
      <h1 className="text-2xl font-black">Sound Lab</h1>
      <p className="mt-1 text-sm font-bold text-white/90">
        Tap ▶ to hear. Rate with stars, pick your favourite for each event, edit with the sliders, then Export my picks and send it to us.
      </p>

      <div className="sticky top-0 z-10 -mx-4 mt-3 border-b border-white/10 bg-slate-950/95 px-4 py-2 backdrop-blur">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {LAB_EVENTS.map((e) => (
            <button key={e.id} onClick={() => pickEvent(e.id)}
              className={`h-11 shrink-0 rounded-full px-3 text-sm font-black ${e.id === ev.id ? "bg-emerald-500 text-slate-950" : "bg-white/10 text-white"}`}>
              {e.emoji} {e.label}{notes.picks[e.id] ? " ✓" : ""}
            </button>
          ))}
        </div>
      </div>

      <section className="mt-4">
        <h2 className="text-lg font-black">{ev.emoji} {ev.label}</h2>
        <p className="text-sm font-bold text-white/90">{ev.candidates.length} sounds to try.</p>
        <ul className="mt-2 space-y-3">
          {ev.candidates.map((c) => <CandidateCard key={c.id} c={c} notes={notes} setNotes={setNotes} eventId={ev.id} />)}
        </ul>
      </section>

      <section className="mt-6 rounded-2xl border border-white/15 bg-white/5 p-3">
        <h2 className="text-lg font-black">Hear them together</h2>
        <p className="text-sm font-bold text-white/90">Plays your pick for each event (or your best rated, or the first one).</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {SEQUENCES.map((s) => (
            <button key={s.id} onClick={() => playSequence(s.id)} className="min-h-[48px] rounded-xl bg-sky-500/80 px-2 text-sm font-black text-white active:scale-95">
              ▶ {s.label}
            </button>
          ))}
        </div>
        {seqMsg && <p className="mt-2 text-xs font-bold text-white/90">{seqMsg}</p>}
      </section>

      <section className="mt-4 rounded-2xl border border-amber-300/40 bg-amber-400/10 p-3">
        <h2 className="text-lg font-black">Export my picks</h2>
        <p className="text-sm font-bold text-white/90">{pickedCount} of {LAB_EVENTS.length} events picked. Copies a short summary to paste to us.</p>
        <button onClick={doExport} className="mt-2 h-12 w-full rounded-xl bg-amber-300 text-base font-black text-slate-950">Export my picks</button>
        {exported && (
          <textarea readOnly value={exported} rows={10}
            className="mt-2 w-full rounded-lg border border-white/15 bg-black/40 p-2 font-mono text-xs text-white" />
        )}
        <button
          onClick={() => { if (confirm("Clear every rating, note, edit and pick on this device?")) { setNotes(() => EMPTY_NOTES); setExported(null); } }}
          className="mt-2 h-10 w-full rounded-xl border border-white/20 text-sm font-black text-white/90">Clear everything</button>
      </section>

      <p className="mt-4 text-xs font-bold text-white/80">
        Saved on this device only. Nothing here changes the game yet.
      </p>
      <PageGuide page="/star-sound-lab-dev" />
    </main>
  );
}
