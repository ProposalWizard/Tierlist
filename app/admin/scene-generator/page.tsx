"use client";
/**
 * SCENE GENERATOR (Harry, 20 Oct 2026, GEN-1: "Build the scene generator as
 * an admin page … in the studio tab"; answer 31: "I just don't know when they
 * play and why, but we need to fix that").
 *
 * Pick a game moment (one of 18 event kinds), a feeling (12), how big the
 * moment is, a seed → Generate. The picture is the real cut-scene director
 * playing the generated script; beside it, the recipe: the place and mood,
 * the beats, the shot list and the film-rules score (generate.ts /
 * scoreScript, as scripts/cutscene/shots.mts prints them).
 * Good / Bad marks one recipe; "Keep as a hand-made scene" saves the script
 * as it is, for the 3D Scene Editor to open (lib/star/sceneEdits/kept.ts):
 * this device first, then the shared table star_cutscene_edits.
 * "When does this play?" is lib/star/sceneEdits/whenPlays.ts: today a
 * generated scene plays on test pages only. Nothing here wires them into a career.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import PageGuide from "@/components/admin/PageGuide";
import { BroadcastPage, Btn, Panel, Pill } from "@/components/admin/broadcast/BroadcastPage";
import type { CameraTrack, CutsceneScript, Emotion, EventKind } from "@/lib/star/cutscene/types";
import type { Director } from "@/lib/star/cutscene/director";
import { generateScript, scoreScript } from "@/lib/star/cutscene/generate";
import { EVENT_KINDS_COVERED } from "@/lib/star/cutscene/beats";
import { WHEN_PLAYS, EVENT_KINDS } from "@/lib/star/sceneEdits/whenPlays";
import {
  allMarks, eventOf, keepScene, keptRowId, loadMarksLocal, markRowId, markTally, recipeId, recipeName, saveKeptLocal, saveMarkLocal,
  type Mark, type MarkRow, type Recipe,
} from "@/lib/star/sceneEdits/kept";
import "./generator.css";

const EMOTIONS: Emotion[] = ["joy", "pride", "relief", "defiance", "anger", "sadness", "shock", "tension", "calm", "gratitude", "hunger", "inspired"];
const label = (k: string) => { const s = k.replace(/-/g, " "); return s[0].toUpperCase() + s.slice(1); };
const sizeOf = (s: number) => (s >= 0.75 ? "Big moment" : s >= 0.4 ? "Middling" : "Small moment");

export default function SceneGeneratorPage() {
  const [kind, setKind] = useState<EventKind>("scored");
  const [emotion, setEmotion] = useState<Emotion>("joy");
  const [stakes, setStakes] = useState(0.8);
  const [intensity, setIntensity] = useState(0.7);
  const [seed, setSeed] = useState(1);
  // the recipe on screen (Generate copies the dials in; the picture rebuilds from it)
  const [recipe, setRecipe] = useState<Recipe>({ kind: "scored", emotion: "joy", stakes: 0.8, intensity: 0.7, seed: 1 });
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const k = q.get("event") as EventKind | null;
    if (k && EVENT_KINDS.includes(k)) {
      const r: Recipe = { kind: k, emotion: (q.get("emotion") as Emotion) ?? "joy", stakes: Number(q.get("stakes") ?? 0.8), intensity: Number(q.get("intensity") ?? 0.7), seed: Number(q.get("seed") ?? 1) };
      setKind(r.kind); setEmotion(r.emotion); setStakes(r.stakes); setIntensity(r.intensity); setSeed(r.seed); setRecipe(r);
    }
  }, []);
  const generate = (s = seed) => setRecipe({ kind, emotion, stakes, intensity, seed: s });
  const reroll = () => { const s = seed + 1; setSeed(s); generate(s); };

  const script: CutsceneScript = useMemo(() => generateScript(eventOf(recipe), recipe.seed), [recipe]);
  const score = useMemo(() => scoreScript(script), [script]);
  const shots = script.tracks.filter((t): t is CameraTrack => t.type === "camera");

  // the picture: the real director
  const holder = useRef<HTMLDivElement>(null);
  const dir = useRef<Director | null>(null);
  const building = useRef<Promise<void>>(Promise.resolve());
  const [status, setStatus] = useState<"loading" | "ready" | "off">("loading");
  const [time, setTime] = useState(0);
  const [played, setPlayed] = useState<CameraTrack[]>([]);
  const [shotName, setShotName] = useState("");
  useEffect(() => {
    const el = holder.current;
    if (!el) return;
    let dead = false;
    setStatus("loading");
    (window as unknown as { __genReady?: boolean }).__genReady = false;
    building.current = building.current.then(async () => {
      if (dead) return;
      try {
        const { createDirector } = await import("@/lib/star/cutscene/director");
        const t0 = Number(new URLSearchParams(window.location.search).get("t") ?? NaN);
        const d = await createDirector(el, script, { holdAt: Number.isFinite(t0) ? t0 : 0, onOverlay: (o) => { setTime(o.t); setShotName(o.shot ?? ""); } });
        if (dead) { d.dispose(); return; }
        dir.current = d;
        setPlayed(d.cameras());
        setStatus("ready");
        (window as unknown as { __genReady?: boolean }).__genReady = true;
      } catch (e) {
        console.error("Scene generator: director failed", e);
        if (!dead) setStatus("off");
      }
    });
    return () => { dead = true; dir.current?.dispose(); dir.current = null; };
  }, [script]);
  const [playing, setPlaying] = useState(false);
  useEffect(() => { const id = setInterval(() => setPlaying(!!dir.current?.playing()), 250); return () => clearInterval(id); }, []);

  // marks and kept scenes: this device + the shared table
  const [shared, setShared] = useState<{ missing: boolean; edits: Record<string, unknown> }>({ missing: false, edits: {} });
  const [marksLocal, setMarksLocal] = useState<Record<string, MarkRow>>({});
  const [msg, setMsg] = useState("");
  useEffect(() => {
    setMarksLocal(loadMarksLocal());
    fetch("/api/star/cutscene-edits", { cache: "no-store" }).then((r) => r.json()).then((j) => setShared({ missing: !!j.migrationMissing, edits: j.edits ?? {} })).catch(() => {});
  }, []);
  const marks = useMemo(() => allMarks(shared.edits, marksLocal), [shared, marksLocal]);
  const tally = markTally(marks);
  const myMark = marks[recipeId(recipe)]?.mark;
  const push = async (id: string, edits: unknown) => {
    try {
      const r = await fetch("/api/star/cutscene-edits", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ scriptId: id, edits }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok) return "saved for everyone";
      return j.migrationMissing ? "saved on this device only (the shared table isn't switched on)" : `saved on this device only (${j.error ?? r.status})`;
    } catch { return "saved on this device only (no connection)"; }
  };
  const mark = async (m: Mark) => {
    const row: MarkRow = { mark: m, recipe, at: new Date().toISOString() };
    saveMarkLocal(recipe, row);
    setMarksLocal(loadMarksLocal());
    setMsg(`Marked ${m === "good" ? "Good" : "Bad"}…`);
    setMsg(`Marked ${m === "good" ? "Good" : "Bad"}: ${await push(markRowId(recipe), row)}.`);
  };
  const keep = async () => {
    const k = keepScene(script, recipe);
    saveKeptLocal(k);
    setMsg("Keeping it…");
    const where = await push(keptRowId(k.id), { kept: k });
    setMsg(`Kept as "${k.name}": ${where}. Open it in the 3D Scene Editor (Cut-scene Director → Kept).`);
  };
  const editorLink = `/star-scene-editor-dev?place=director&kept=${encodeURIComponent(recipeId(recipe))}`;
  const row = WHEN_PLAYS.find((w) => w.kind === recipe.kind);
  const ownStory = (EVENT_KINDS_COVERED as string[]).includes(recipe.kind);

  return (
    <>
      <BroadcastPage title="Scene generator" sub="A game moment in, a whole cut scene out. See its recipe, mark it, keep it." width={1500}
        actions={<Btn href="/star-scene-editor-dev?place=director" title="Edit a scene's camera and light">3D Scene Editor ›</Btn>}>
        <div className="sg-grid">
          <Panel title="THE MOMENT" note="what happened in the game">
            <div className="sg-lab">Event</div>
            <div className="sg-pills" data-kinds>
              {EVENT_KINDS.map((k) => <Pill key={k} on={kind === k} onClick={() => setKind(k)}>{label(k)}</Pill>)}
            </div>
            <div className="sg-lab">Feeling</div>
            <div className="sg-pills" data-emotions>
              {EMOTIONS.map((e) => <Pill key={e} on={emotion === e} onClick={() => setEmotion(e)}>{label(e)}</Pill>)}
            </div>
            <div className="sg-lab">How big the moment is <b>{sizeOf(stakes)}</b></div>
            <div className="sg-row"><span>Small</span><input data-stakes type="range" min={0} max={1} step={0.05} value={stakes} onChange={(e) => setStakes(+e.target.value)} /><span>Big</span></div>
            <div className="sg-lab">How intense</div>
            <div className="sg-row"><span>Calm</span><input data-intensity type="range" min={0} max={1} step={0.05} value={intensity} onChange={(e) => setIntensity(+e.target.value)} /><span>Wild</span></div>
            <div className="sg-lab">Seed (same seed = same scene)</div>
            <div className="sg-row sg-seed">
              <button className="bc-btn" onClick={() => setSeed((s) => Math.max(1, s - 1))} aria-label="Seed down">−</button>
              <input data-seed type="number" min={1} value={seed} onChange={(e) => setSeed(Math.max(1, Math.round(+e.target.value || 1)))} />
              <button className="bc-btn" onClick={() => setSeed((s) => s + 1)} aria-label="Seed up">+</button>
              <Btn onClick={reroll} title="Next seed, and make it">🎲 Re-roll</Btn>
              <Btn main onClick={() => generate()}>GENERATE</Btn>
            </div>
          </Panel>

          <Panel title="THE PICTURE" note="the real cut-scene director">
            <div className="sg-view">
              <div ref={holder} className="sg-canvas" data-generator={status} />
              <div className="sg-badge">● {shotName || "—"} · {time.toFixed(1)} / {script.duration.toFixed(1)} s</div>
              {status === "loading" && <div className="sg-msg">Building the scene…</div>}
              {status === "off" && <div className="sg-msg">This device can&apos;t show 3D. The recipe below still reads.</div>}
            </div>
            <div className="sg-row sg-play">
              <Btn main onClick={() => { const d = dir.current; if (!d) return; if (d.playing()) d.pause(); else d.play(); }}>{playing ? "❚❚ PAUSE" : "▶ PLAY"}</Btn>
              <Btn onClick={() => dir.current?.replay()}>↺ Replay</Btn>
              <input className="sg-scrub" data-scrub type="range" min={0} max={script.duration} step={0.05} value={time} onChange={(e) => dir.current?.seek(+e.target.value)} aria-label="Scrub" />
            </div>
            <div className="sg-row sg-marks" data-marks>
              <span className="sg-recipe-name">{recipeName(recipe)}</span>
              <button className="sg-mark" data-mark-good aria-pressed={myMark === "good"} onClick={() => mark("good")}>👍 Good</button>
              <button className="sg-mark sg-bad" data-mark-bad aria-pressed={myMark === "bad"} onClick={() => mark("bad")}>👎 Bad</button>
              <Btn onClick={keep} title="Save this script as it is, for the 3D Scene Editor">Keep as a hand-made scene</Btn>
              <Btn href={editorLink} title="Open it in the 3D Scene Editor (keep it first)">Open in the editor ›</Btn>
            </div>
            <div className="bc-note" data-gen-msg>{msg || (shared.missing ? "Marks and kept scenes save on this device only until the shared table is switched on." : "Marks and kept scenes save on this device and for everyone.")}</div>
          </Panel>
        </div>

        <div className="sg-grid sg-grid2">
          <Panel title="THE RECIPE" note={`score ${(score.score * 100).toFixed(0)}% on the film rules`}>
            <div className="sg-facts" data-recipe>
              <div><b>Place</b> {label(script.set.location)}</div>
              <div><b>Mood</b> {label(script.set.mood)}</div>
              <div><b>Length</b> {script.duration.toFixed(1)} s</div>
              <div><b>People</b> {script.cast.map((c) => c.role).join(", ")}</div>
              <div><b>Film rules</b> {(score.score * 100).toFixed(0)}%{score.notes.length ? ` · ${score.notes.join("; ")}` : " · nothing broken"}</div>
              {!ownStory && <div className="sg-warn">This event has no story of its own yet: it borrows the nearest one.</div>}
            </div>
            {script.text?.notes && <div className="bc-note">Why: {script.text.notes}</div>}
            <div className="sg-lab">The beats ({script.beats?.length ?? 0})</div>
            <ol className="sg-list" data-beats>
              {(script.beats ?? []).map((b, i) => <li key={i}><span>{b.at.toFixed(1)}–{(b.at + b.dur).toFixed(1)} s</span> <b>{b.act ? label(b.act) : ""}</b> {b.name}</li>)}
            </ol>
            <div className="sg-lab">The shot list ({shots.length} written{played.length && played.length !== shots.length ? `, ${played.length} as played after the camera pass` : ""})</div>
            <ol className="sg-list" data-shots>
              {shots.map((c, i) => <li key={i}><span>{c.at.toFixed(1)} s +{c.dur.toFixed(1)}</span> <b>{c.shot.preset}</b>{c.shot.move ? ` (${c.shot.move})` : ""} {c.name ?? ""}</li>)}
            </ol>
          </Panel>

          <Panel title="WHEN DOES THIS PLAY?" note="the one list: lib/star/sceneEdits/whenPlays.ts">
            <div className="sg-callout" data-when-callout>
              <b>Today a generated scene does NOT play in the real game.</b> It plays only on test pages: here and in the 3D Scene Editor.
              Below is the proposal: which game moment would play each one. Nothing is wired until Harry says so.
            </div>
            {row && <div className="sg-now" data-when-now><b>{label(row.kind)}:</b> {row.moment}. <i>{row.wired ? "Wired" : "Not wired"}.</i></div>}
            <div className="sg-tablewrap">
              <table className="sg-table" data-when-table>
                <thead><tr><th>Event</th><th>The game moment that would play it</th><th>What plays there today</th><th>Status</th><th>Marks</th></tr></thead>
                <tbody>
                  {WHEN_PLAYS.map((w) => (
                    <tr key={w.kind} aria-current={w.kind === recipe.kind} onClick={() => setKind(w.kind)}>
                      <td><b>{label(w.kind)}</b></td>
                      <td>{w.moment}</td>
                      <td>{w.today}</td>
                      <td><span className={w.wired ? "sg-on" : "sg-off"}>{w.wired ? "Wired" : "Not wired"}</span></td>
                      <td className="sg-tally">{tally[w.kind] ? `👍${tally[w.kind].good} 👎${tally[w.kind].bad}` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      </BroadcastPage>
      <PageGuide page="/admin/scene-generator" />
    </>
  );
}
