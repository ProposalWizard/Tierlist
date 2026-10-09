"use client";

/**
 * THE DRIBBLE RUN, IN 3D — Settings → Look → "Dribble runs 3D: 3D | Old"
 * (lib/star/dribble3dLook.ts). Harry, 9 Oct 2026: "I really like the 3D style
 * in Style Testing where it's top down and you're running around (Free Roam
 * 3D) … it would be great for in-game dribbling."
 *
 * Mounted by CanvasMatch exactly where (and how) it mounts the first-person
 * duel (components/star/FirstPersonDribble.tsx): an overlay over the match's
 * own pitch, during its "fpDribble" phase, with the same props and the same
 * `onComplete`. So the waves, the result and what the match does next
 * (finishFpDribble) are the duel's; only how the run is played and drawn
 * changes.
 *
 * The picture is the Style Testing page's Free Roam (lib/star/style3d/
 * gameplay.ts: the fixed top-down camera, look H in golden hour, the same 3D
 * people and clips); the run is the shared 3D engine's (lib/star/play3d/
 * dribbleRun.ts on its World: the stick, walk/jog/run/sprint and the stamina
 * bar, tackles, the keeper). 3D games are the one-engine rule's exception:
 * nothing here touches the 2D match or its engine.
 *
 * Controls: left 40% of the screen a thumb stick (a full push sprints, which
 * uses the stamina bar); a tap anywhere else passes (to the team-mate tapped,
 * else the one you face). If this phone can't draw 3D, the duel plays instead.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import FirstPersonDribble, { type FirstPersonDribbleProps, type FpDribbleResult } from "./FirstPersonDribble";
import { dribbleRunSession, dribbleRunResult, wavesBeatenOf } from "@/lib/star/play3d/dribbleRun";
import { skillsOf } from "@/lib/star/play3d/player";
import type { Person3 } from "@/lib/star/play3d/freeRoam";
import type { Play3DPerson } from "@/lib/star/play3d/scene";
import type { StyleGameplay } from "@/lib/star/style3d/gameplay";
import { resolveStyle } from "@/lib/star/style3d/styles";
import { motionLook } from "@/lib/star/motionLook";
import { faceFromUrl } from "@/lib/star/three3d/faceFromUrl";
import { fakeFaceFor } from "@/lib/star/fakeFaces";

/** The Style Testing Free Roam camera: degrees from straight down. */
const DRIBBLE_3D_TILT = 40;
/** How long the result shows before the match moves on (s). */
const RESULT_BEAT = 0.9;
const STICK_R = 56;
const SKINS = ["#c68642", "#8d5524", "#e0ac69", "#5c3a1e", "#f1c27d", "#a0673f"];
const HUD_BOX: React.CSSProperties = {
  background: "linear-gradient(180deg, rgba(12,16,24,.9), rgba(12,16,24,.78))",
  boxShadow: "inset 0 0 0 1.5px rgba(255,255,255,.92), 0 2px 6px rgba(0,0,0,.45)",
};
const PIP: Record<string, string> = { pending: "rgba(255,255,255,0.18)", active: "#fbbf24", beaten: "#34d399", won: "#ef4444" };

export interface Dribble3DProps extends Pick<FirstPersonDribbleProps, "pace" | "oppStrength" | "waveSizes" | "roster" | "seed" | "onComplete" | "passOptions" | "vision" | "mateRoster"> {
  /** Your numbers (the career's skills). Absent: `pace`, and 75 for the rest. */
  skills?: { pace: number; power: number; technique: number; vision?: number };
  /** Your name, photo and look. */
  you?: { name?: string; photo?: string; skin?: string; hair?: string; hairStyle?: Play3DPerson["hairStyle"] };
  /** Your kit and theirs (the match's). */
  kits?: { us: { shirt: string; trim: string }; them: { shirt: string; trim: string } };
  /** Everything the duel needs if this phone can't draw 3D (CanvasMatch passes the duel's own props). */
  fallback?: FirstPersonDribbleProps;
}

export default function Dribble3D(props: Dribble3DProps) {
  const { waveSizes, roster, seed, onComplete, passOptions = 0, mateRoster, oppStrength = 70, pace = 75, skills, you, kits } = props;
  const runSeed = useMemo(() => seed ?? Math.floor(Math.random() * 1e9), [seed]);
  const session = useMemo(() => {
    const sk = skills
      ? skillsOf(Math.round((skills.pace + skills.power + skills.technique) / 3), { pace: skills.pace, power: skills.power, technique: skills.technique, dribbling: skills.technique, passing: skills.vision })
      : skillsOf(75, { pace });
    const me: Person3 = { id: "you", name: you?.name ?? "You", skills: sk, photo: you?.photo };
    const mates: Person3[] = Array.from({ length: Math.max(0, Math.min(3, passOptions)) }, (_, i) => {
      const r = mateRoster?.[i];
      return { id: `mate${i}`, name: r?.shortName ?? r?.name ?? `Team-mate ${i + 1}`, skills: skillsOf(r?.overall ?? 72), photo: r?.face ?? fakeFaceFor(`mate${i}`) };
    });
    const s = dribbleRunSession({ seed: runSeed, you: me, waveSizes: waveSizes ?? [2, 2, 2], roster, oppStrength, mates });
    s.world.frozen = 1e9; // held until "Tap to start"
    return s;
    // one run per mount (CanvasMatch rolls the waves once and holds them)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const w = session.world, state = session.state;

  const holder = useRef<HTMLDivElement>(null);
  const play = useRef<StyleGameplay | null>(null);
  const [three, setThree] = useState<"loading" | "ready" | "off">("loading");
  const [started, setStarted] = useState(false);
  const [tick, setTick] = useState(0);
  const [marks, setMarks] = useState<{ id: string; name: string; x: number; y: number; off: boolean; aim: boolean }[]>([]);
  const onDoneRef = useRef(onComplete); onDoneRef.current = onComplete;
  const sent = useRef(false);

  useEffect(() => { w.newFeel = motionLook() === "mocap"; }, [w]);

  // ── the picture: Style Testing's Free Roam, playing this run ──
  useEffect(() => {
    const el = holder.current;
    if (!el) return;
    let dead = false;
    (async () => {
      try {
        const people: Record<string, Play3DPerson> = {};
        let i = 0;
        people.you = { skin: you?.skin ?? SKINS[0], hair: you?.hair ?? "#1b120c", hairStyle: you?.hairStyle ?? "short" };
        await Promise.all(w.players.filter((p) => !p.human).map(async (p) => {
          const k = i++;
          const fitted = p.keeper ? null : await faceFromUrl(p.photo).catch(() => null);
          people[p.id] = { skin: fitted?.skin ?? SKINS[k % SKINS.length], hair: "#1b120c", hairStyle: p.keeper ? "buzz" : "short", face: fitted?.face ?? null };
        }));
        if (dead) return;
        const numbers: Record<string, number> = { you: 9, keeper: 1 };
        w.players.forEach((p, n) => { if (!numbers[p.id]) numbers[p.id] = p.team === 0 ? [7, 10, 11][n % 3] : [4, 5, 6, 3, 2, 8, 14, 15, 16, 18][n % 10]; });
        const { createStyleGameplay } = await import("@/lib/star/style3d/gameplay");
        const g = await createStyleGameplay(el, {
          def: resolveStyle("real", "play"), flat: false, tilt: DRIBBLE_3D_TILT, tod: "golden", seed: runSeed,
          session, scenery: false, people, numbers,
          kits: kits ? { home: kits.us, away: kits.them } : undefined,
        });
        if (dead) { g.dispose(); return; }
        play.current = g;
        setThree("ready");
      } catch (e) {
        console.error("3D dribble run failed to load", e);
        if (!dead) setThree("off");
      }
    })();
    return () => { dead = true; play.current?.dispose(); play.current = null; };
    // built once per run
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── the HUD, and handing the result back once the run is over ──
  useEffect(() => {
    if (three !== "ready") return;
    const id = window.setInterval(() => {
      setTick((t) => t + 1);
      const g = play.current, me = w.you();
      if (g && me) {
        setMarks(w.players.filter((p) => p.active && !p.human && !p.keeper && p.team === me.team).flatMap((p) => {
          const s = g.screen(p.id);
          return s ? [{ id: p.id, name: p.name, x: s.x, y: s.y, off: s.off, aim: w.aimMate === p.id }] : [];
        }));
      }
      if (state.end && !sent.current) {
        sent.current = true;
        const r: FpDribbleResult = dribbleRunResult(state);
        window.setTimeout(() => onDoneRef.current?.(r), RESULT_BEAT * 1000);
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [three, w, state]);

  // dev: a test bot can read the run and drive it (never in production)
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const win = window as unknown as { __dribble3d?: unknown };
    win.__dribble3d = { world: w, state, start: () => begin() };
    return () => { win.__dribble3d = undefined; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w, state]);

  const begin = () => { if (started) return; setStarted(true); w.frozen = 0; };

  // ── thumbs: Free Roam's stick on the left, a tap anywhere else passes ──
  const stick = useRef<{ id: number; x0: number; y0: number } | null>(null);
  const tap = useRef<{ id: number; x0: number; y0: number } | null>(null);
  const [knob, setKnob] = useState<{ x0: number; y0: number; x: number; y: number } | null>(null);
  const toWorld = (sx: number, sy: number) => {
    const h = play.current?.heading() ?? -Math.PI / 2;
    const f = { x: Math.cos(h), y: Math.sin(h) }, r = { x: -Math.sin(h), y: Math.cos(h) };
    return { x: r.x * sx + f.x * -sy, y: r.y * sx + f.y * -sy };
  };
  const mateAt = (x: number, y: number): string | undefined => {
    const id = play.current?.pick(x, y) ?? null, p = w.get(id), me = w.you();
    return p && me && p !== me && !p.keeper && p.team === me.team ? p.id : undefined;
  };
  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!started || state.end) return;
    const box = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - box.left, y = e.clientY - box.top;
    e.currentTarget.setPointerCapture(e.pointerId);
    if (x < box.width * 0.4 && !stick.current) { stick.current = { id: e.pointerId, x0: x, y0: y }; setKnob({ x0: x, y0: y, x, y }); }
    else if (!tap.current) tap.current = { id: e.pointerId, x0: x, y0: y };
  };
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (stick.current?.id !== e.pointerId) return;
    const box = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - box.left, y = e.clientY - box.top;
    const dx = x - stick.current.x0, dy = y - stick.current.y0, d = Math.hypot(dx, dy);
    const k = Math.min(1, d / STICK_R);
    w.input = { move: d > 1 ? toWorld((dx / d) * k, (dy / d) * k) : { x: 0, y: 0 }, sprint: d > STICK_R * 0.92 };
    setKnob({ x0: stick.current.x0, y0: stick.current.y0, x, y });
  };
  const onUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - box.left, y = e.clientY - box.top;
    if (stick.current?.id === e.pointerId) { stick.current = null; w.input = { move: { x: 0, y: 0 }, sprint: false }; setKnob(null); return; }
    if (tap.current?.id === e.pointerId) { tap.current = null; w.act({ kind: "tap", to: mateAt(x, y) }); }
  };
  // keyboard (desktop): WASD / arrows run, shift sprints, space passes
  useEffect(() => {
    const keys = new Set<string>();
    const sync = () => {
      if (stick.current) return;
      const sx = (keys.has("d") || keys.has("arrowright") ? 1 : 0) - (keys.has("a") || keys.has("arrowleft") ? 1 : 0);
      const sy = (keys.has("s") || keys.has("arrowdown") ? 1 : 0) - (keys.has("w") || keys.has("arrowup") ? 1 : 0);
      const d = Math.hypot(sx, sy), k = w.newFeel && !keys.has("shift") ? 0.85 : 1;
      w.input = { move: d ? toWorld((sx / d) * k, (sy / d) * k) : { x: 0, y: 0 }, sprint: keys.has("shift") };
    };
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === " ") { e.preventDefault(); if (started) w.act({ kind: "tap" }); else begin(); return; }
      keys.add(k); sync();
    };
    const up = (e: KeyboardEvent) => { keys.delete(e.key.toLowerCase()); sync(); };
    window.addEventListener("keydown", down); window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w, started]);

  if (three === "off") return <FirstPersonDribble {...(props.fallback ?? { pace, oppStrength, waveSizes, roster, seed, passOptions, vision: props.vision, mateRoster })} embedded onComplete={onComplete} />;

  void tick;
  const total = state.waveSizes.length, cleared = state.end === "clear" ? total : wavesBeatenOf(state);
  const pips = state.waveSizes.map((_, i) => i < cleared ? "beaten" : i === cleared ? (state.end === "lost" ? "won" : started ? "active" : "pending") : "pending");
  const stam = w.newFeel && (w.stamina.v < 0.995 || w.stamina.tired) ? { v: w.stamina.v, tired: w.stamina.tired } : null;
  const banner = state.end === "clear" ? { text: "THROUGH!", c: "#4ade80" } : state.end === "passed" ? { text: "LAID OFF", c: "#fde047" } : state.end === "lost" ? { text: state.why.toUpperCase(), c: "#f87171" } : null;

  return (
    <div className="absolute inset-0 z-30 h-full w-full select-none overflow-hidden bg-black" style={{ touchAction: "none" }} data-dribble3d={three} data-dribble3d-end={state.end ?? ""}>
      <div ref={holder} className="absolute inset-0" />
      <div className="absolute inset-0 z-20" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} data-dribble3d-pad />
      {total > 0 && (
        <div className="pointer-events-none absolute inset-x-0 top-2 z-30 flex justify-center px-3">
          <div className="flex items-center gap-2.5 px-3 py-1.5" style={HUD_BOX} data-dribble3d-waves={`${cleared}/${total}`}>
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/85">Waves</span>
            <span className="text-lg font-black leading-none tabular-nums text-white">{cleared}/{total}</span>
            <span className="flex items-center gap-1">
              {pips.map((p, i) => <span key={i} className="block h-2.5 w-2.5" style={{ background: PIP[p], boxShadow: "inset 0 0 0 1px rgba(255,255,255,.85)" }} />)}
            </span>
          </div>
        </div>
      )}
      {knob && (
        <div className="pointer-events-none absolute z-30 rounded-full ring-2 ring-white/50" style={{ left: knob.x0 - STICK_R, top: knob.y0 - STICK_R, width: STICK_R * 2, height: STICK_R * 2, background: "rgba(0,0,0,0.18)" }}>
          <div className="absolute h-[36px] w-[36px] rounded-full bg-white/80" style={{ left: STICK_R - 18 + Math.max(-STICK_R, Math.min(STICK_R, knob.x - knob.x0)), top: STICK_R - 18 + Math.max(-STICK_R, Math.min(STICK_R, knob.y - knob.y0)) }} />
        </div>
      )}
      {stam && (
        <div className="pointer-events-none absolute z-40" data-dribble3d-stamina={stam.v.toFixed(2)} style={knob ? { left: knob.x0 - 30, top: knob.y0 - STICK_R - 16 } : { left: 14, bottom: 52 }}>
          <div className="h-[6px] w-[60px] overflow-hidden rounded-full bg-black/55 ring-1 ring-white/40">
            <div className="h-full rounded-full" style={{ width: `${Math.round(stam.v * 100)}%`, background: stam.tired ? "#f87171" : stam.v < 0.3 ? "#fbbf24" : "#4ade80" }} />
          </div>
        </div>
      )}
      {three === "ready" && !state.end && marks.filter((m) => m.off || m.aim).map((m) => (
        <div key={m.id} className="pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-1/2" style={{ left: Math.max(30, Math.min((holder.current?.clientWidth ?? 400) - 30, m.x)), top: m.off ? Math.max(40, m.y) : m.y - 34 }} data-dribble3d-mate={m.id}>
          <div className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-black uppercase leading-tight ${m.aim ? "bg-white text-slate-900" : "bg-black/60 text-white ring-1 ring-white/40"}`}>
            {m.aim ? "Pass · " : ""}{m.name}
          </div>
        </div>
      ))}
      {banner && (
        <div className="pointer-events-none absolute inset-x-0 top-[30%] z-40 px-2 text-center text-[40px] font-black uppercase leading-none" style={{ color: banner.c, textShadow: "0 3px 12px #000" }} data-dribble3d-banner>{banner.text}</div>
      )}
      {three === "loading" && <div className="pointer-events-none absolute inset-0 z-40 grid place-items-center text-[13px] font-bold text-white/80">Loading the pitch…</div>}
      {three === "ready" && !started && (
        <button type="button" onClick={begin} aria-label="Tap to start the run" className="absolute inset-0 z-40 bg-black/25" data-dribble3d-start>
          <span className="absolute inset-x-0 top-[12%] flex flex-col items-center gap-1.5 px-6 text-center">
            <span className="bg-emerald-500 px-6 py-3 text-base font-black uppercase tracking-widest text-emerald-950 motion-safe:animate-pulse" style={{ boxShadow: "inset 0 0 0 1.5px rgba(255,255,255,.92), 0 2px 8px rgba(0,0,0,.5)" }}>Tap to start</span>
            <span className="px-3 py-1.5 text-[12px] font-bold leading-snug text-white" style={HUD_BOX}>
              Left thumb: run with it. Push all the way to sprint. {passOptions > 0 ? "Tap a team-mate to pass." : ""} Go round them, not through them.
            </span>
          </span>
        </button>
      )}
      {started && !state.end && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 px-2 pb-2">
          <p className="px-3 py-1.5 text-center text-[12px] font-bold leading-snug text-white" style={HUD_BOX}>
            Stick: run with it · full push: sprint{passOptions > 0 ? " · tap: pass" : ""}
          </p>
        </div>
      )}
    </div>
  );
}
