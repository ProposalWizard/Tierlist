"use client";

/**
 * THE CUT-SCENE DIRECTOR (dev panel on /star-style-dev) — watch any cut
 * scene: pick a hand-made one, or GENERATE one from a game event (pick the
 * event, set the stakes, the feeling, rival present, home or away, night,
 * a seed to reroll), scrub the timeline (beats marked under it), replay,
 * switch the art style with the chips above. Nothing is saved.
 *
 * URL (for filming): ?scene=director&fixture=signing  or
 *   ?scene=director&event=scored&stakes=0.8&emotion=joy&seed=3 (&clean=1)
 *   &cam=old|new overrides Settings → Look → "Cut-scene camera" for this page.
 * Camera New also plays the scene's music bed (cutscene/music.ts) when
 * Settings → Sound effects is on.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { StyleId } from "@/lib/star/style3d/styles";
import type { CutsceneScript, Emotion, EventKind, StoryEvent } from "@/lib/star/cutscene/types";
import type { Director } from "@/lib/star/cutscene/director";
import type { Overlay } from "@/lib/star/cutscene/timeline";
import { FIXTURES, FIXTURE_LIST } from "@/lib/star/cutscene/fixtures";
import { generateScript, scoreScript } from "@/lib/star/cutscene/generate";
import { EVENT_KINDS_COVERED } from "@/lib/star/cutscene/beats";
import { VOICE_LINES } from "@/lib/star/cutscene/voiceLines";
import { useCutsceneCameraLook, type CutsceneCameraLook } from "@/lib/star/cutscene/look";
import { createCutsceneMusic, musicBedFor, musicCue, type CutsceneMusic } from "@/lib/star/cutscene/music";
import { sfxOn, sfxUrl } from "@/lib/star/sfx";

const EMOTIONS: Emotion[] = ["joy", "pride", "relief", "defiance", "anger", "sadness", "shock", "tension", "calm", "gratitude", "hunger", "inspired"];

export default function CutsceneDirector({ style, clean }: { style: StyleId; clean: boolean }) {
  const holder = useRef<HTMLDivElement>(null);
  const dir = useRef<Director | null>(null);
  const [mode, setMode] = useState<"fixture" | "generate">("fixture");
  const [fixture, setFixture] = useState("signing");
  const [ev, setEv] = useState<StoryEvent>({ kind: "scored", stakes: 0.7, emotion: "joy", intensity: 0.7, home: true });
  const [seed, setSeed] = useState(1);
  const [gen, setGen] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "off">("loading");
  const [time, setTime] = useState(0);
  const [ov, setOv] = useState<Overlay | null>(null);
  const [inited, setInited] = useState(false);
  const styleRef = useRef(style); styleRef.current = style;
  const lookCam = useCutsceneCameraLook();
  const [camOverride, setCamOverride] = useState<CutsceneCameraLook | null>(null);
  const camLook: CutsceneCameraLook = camOverride ?? lookCam;
  const music = useRef<CutsceneMusic | null>(null);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const f = q.get("fixture"); if (f && FIXTURES[f]) { setFixture(f); setMode("fixture"); }
    const cm = q.get("cam"); if (cm === "old" || cm === "new") setCamOverride(cm);
    const e = q.get("event") as EventKind | null;
    if (e) {
      setMode("generate");
      setEv({ kind: e, stakes: Number(q.get("stakes") ?? 0.7), emotion: (q.get("emotion") as Emotion) ?? "joy", intensity: Number(q.get("intensity") ?? 0.7), rivalPresent: q.get("rival") === "1", home: q.get("home") !== "0", night: q.get("night") === "1" });
      setSeed(Number(q.get("seed") ?? 1));
    }
    setInited(true);
  }, []);

  const script: CutsceneScript = useMemo(
    () => (mode === "fixture" ? FIXTURES[fixture]() : generateScript(ev, seed)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, fixture, gen, seed],
  );
  const score = useMemo(() => scoreScript(script), [script]);

  useEffect(() => {
    if (!inited) return;
    const el = holder.current;
    if (!el) return;
    let dead = false;
    setStatus("loading");
    (window as unknown as { __styleReady?: boolean }).__styleReady = false;
    (async () => {
      try {
        const { createDirector } = await import("@/lib/star/cutscene/director");
        const d = await createDirector(el, script, {
          style: styleRef.current, camera: camLook,
          onOverlay: (o) => { setOv(o); setTime(o.t); music.current?.update(o.t, !!dir.current?.playing()); },
          // recorded lines play (scripts/cutscene/voice.py); other cues have no sound file yet
          onSound: (cue, vol) => { if (!VOICE_LINES[cue]) return; try { const au = new Audio(`/sfx/cut-${cue}.mp3`); au.volume = Math.min(1, vol); void au.play().catch(() => {}); } catch { /* no sound */ } },
        });
        if (dead) { d.dispose(); return; }
        dir.current = d;
        music.current?.dispose();
        music.current = camLook === "new" ? createCutsceneMusic(d.script, sfxUrl(musicCue(musicBedFor(d.script))), sfxOn) : null;
        const t = new URLSearchParams(window.location.search).get("t");
        if (t !== null) d.seek(Number(t));
        setStatus("ready");
        (window as unknown as { __styleReady?: boolean }).__styleReady = true;
      } catch (e) {
        console.error("Cut-scene director: failed", e);
        if (!dead) setStatus("off");
      }
    })();
    return () => { dead = true; dir.current?.dispose(); dir.current = null; music.current?.dispose(); music.current = null; };
  }, [script, inited, camLook]);

  useEffect(() => { dir.current?.setStyle(style); }, [style]);

  const d = dir.current;
  const set = <K extends keyof StoryEvent>(k: K, v: StoryEvent[K]) => setEv((e) => ({ ...e, [k]: v }));
  const regen = () => { setMode("generate"); setGen((g) => g + 1); };
  const btn = "h-[28px] shrink-0 rounded-full border border-white/20 bg-white/5 px-2.5 text-[12px] font-extrabold text-white";
  const on = "border-amber-300 bg-amber-400 text-black";

  return (
    <div className="absolute inset-0 flex flex-col">
      <div className="relative flex-1 overflow-hidden">
        <div ref={holder} className="absolute inset-0" data-cutscene={status} />
        {ov && ov.captions.map((c, i) => (
          <div key={i} className={`pointer-events-none absolute inset-x-4 z-20 text-center font-bold text-white ${c.style === "lower-third" ? "bottom-[16%] text-left text-[15px] uppercase tracking-wide" : "bottom-[13%] text-[16px]"}`} style={{ textShadow: "0 2px 6px #000, 0 0 2px #000" }}>
            {c.speaker && c.style !== "lower-third" && <span className="text-amber-300">{c.speaker.replace("{player}", "You").replace("{manager}", "Manager")}: </span>}{c.text}
          </div>
        ))}
        {!clean && ov?.shot && <div className="pointer-events-none absolute left-2 top-[11%] z-20 text-[11px] font-bold uppercase text-white/70" data-shot>{ov.shot}</div>}
        {status === "loading" && !clean && <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center text-[13px] font-bold text-white/80">Building the scene…</div>}
        {status === "off" && <div className="absolute inset-0 z-30 grid place-items-center px-6 text-center text-[14px] font-bold text-amber-200">This device can&apos;t show the 3D test.</div>}
      </div>
      {!clean && (
        <div className="z-20 flex flex-col gap-1.5 bg-gray-950/95 px-2 pb-2 pt-1.5 text-white" data-director-panel>
          <div className="flex items-center gap-2">
            <button className={btn} onClick={() => (d?.playing() ? d.pause() : d?.play())} data-play>{d?.playing() ? "❚❚" : "▶"}</button>
            <button className={btn} onClick={() => d?.replay()} data-replay>↺</button>
            <button className={btn} onClick={() => d?.skip()}>Skip ⏭</button>
            <span className="ml-auto text-[11px] tabular-nums text-white/70">{time.toFixed(2)} / {script.duration.toFixed(1)} s</span>
          </div>
          <div className="relative">
            <input type="range" min={0} max={script.duration} step={1 / 30} value={time} onChange={(e) => d?.seek(Number(e.target.value))} className="w-full accent-amber-400" data-scrub />
            <div className="relative h-3">
              {(script.beats ?? []).map((b, i) => (
                <div key={i} title={b.name} className="absolute top-0 h-3 truncate border-l border-amber-300/70 pl-0.5 text-[8px] leading-3 text-white/60" style={{ left: `${(b.at / script.duration) * 100}%`, width: `${(b.dur / script.duration) * 100}%` }}>{b.name}</div>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <button className={`${btn} ${mode === "fixture" ? on : ""}`} onClick={() => setMode("fixture")}>Hand-made</button>
            <button className={`${btn} ${mode === "generate" ? on : ""}`} onClick={regen}>Generate from event</button>
            <span className="shrink-0 text-[11px] text-white/60">Shot rules {(score.score * 100).toFixed(0)}%</span>
          </div>
          {mode === "fixture" ? (
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {FIXTURE_LIST.map((f) => <button key={f.id} className={`${btn} ${fixture === f.id ? on : ""}`} onClick={() => setFixture(f.id)} data-fixture={f.id}>{f.name}</button>)}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] font-bold">
              <label className="flex items-center gap-1">Event
                <select value={ev.kind} onChange={(e) => set("kind", e.target.value as EventKind)} className="w-full rounded bg-white/10 px-1">
                  {EVENT_KINDS_COVERED.map((k) => <option key={k} value={k} className="text-black">{k}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-1">Feeling
                <select value={ev.emotion} onChange={(e) => set("emotion", e.target.value as Emotion)} className="w-full rounded bg-white/10 px-1">
                  {EMOTIONS.map((k) => <option key={k} value={k} className="text-black">{k}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-1">Stakes <input type="range" min={0} max={1} step={0.05} value={ev.stakes} onChange={(e) => set("stakes", Number(e.target.value))} className="w-full accent-amber-400" /></label>
              <label className="flex items-center gap-1">Intensity <input type="range" min={0} max={1} step={0.05} value={ev.intensity ?? 0.5} onChange={(e) => set("intensity", Number(e.target.value))} className="w-full accent-amber-400" /></label>
              <label className="flex items-center gap-1"><input type="checkbox" checked={!!ev.rivalPresent} onChange={(e) => set("rivalPresent", e.target.checked)} /> Rival there</label>
              <label className="flex items-center gap-1"><input type="checkbox" checked={ev.home !== false} onChange={(e) => set("home", e.target.checked)} /> Home</label>
              <label className="flex items-center gap-1"><input type="checkbox" checked={!!ev.night} onChange={(e) => set("night", e.target.checked)} /> Night</label>
              <div className="flex items-center gap-1">Seed {seed}
                <button className={btn} onClick={() => setSeed((s) => s + 1)}>🎲 Reroll</button>
                <button className={`${btn} ${on}`} onClick={regen}>Make it</button>
              </div>
              <div className="col-span-2 truncate text-[10px] font-normal text-white/50">{script.text?.notes}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
