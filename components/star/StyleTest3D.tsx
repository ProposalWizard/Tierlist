"use client";

/**
 * STYLE TESTING — one screen to flip between the art styles (lib/star/style3d)
 * on real 3D gameplay, the 2D "fake 3D" look and cut scenes. A test area only:
 * nothing here reaches a career, and the 2D match is untouched.
 */
import { useEffect, useRef, useState } from "react";
import { STYLE_CHIPS, resolveStyle, type StyleId } from "@/lib/star/style3d/styles";
import type { StyleGameplay } from "@/lib/star/style3d/gameplay";
import type { CutScene } from "@/lib/star/style3d/cutscenes";
import { realMatchHeight } from "@/lib/star/engineProfile";
import { quality3dTier } from "@/lib/star/three3d/quality";
import { DEMOS, makeWorldSeek, publishFrameStep, type TimelineEvent } from "@/lib/star/frameStep";

export type StyleScene = "play3d" | "play2d" | "goal" | "signing" | "walkout";
const SCENES: { id: StyleScene; label: string }[] = [
  { id: "play3d", label: "Gameplay 3D" }, { id: "play2d", label: "Gameplay 2D" },
  { id: "goal", label: "Cut: Goal" }, { id: "signing", label: "Cut: Signing" }, { id: "walkout", label: "Walk-out" },
];
const isPlay = (s: StyleScene) => s === "play3d" || s === "play2d";

type Hud = { big: string; small: string; timeLeft?: number; flash?: string };

export default function StyleTest3D() {
  const [style, setStyle] = useState<StyleId>("golden");
  const [scene, setScene] = useState<StyleScene>("play3d");
  const [tilt, setTilt] = useState(40);
  const [seek, setSeek] = useState<number | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "off">("loading");
  const [shot, setShot] = useState("");
  const [hud, setHud] = useState<Hud | null>(null);
  const [run, setRun] = useState(0);
  const [inited, setInited] = useState(false);
  /** ?clean=1 hides the test controls and labels (for frame-by-frame filming, scripts/film/frames3d.mjs). */
  const [clean, setClean] = useState(false);
  const demoRef = useRef<string | null>(null);
  const holder = useRef<HTMLDivElement>(null);
  const play = useRef<StyleGameplay | null>(null);
  const cut = useRef<CutScene | null>(null);
  const styleRef = useRef(style); styleRef.current = style;
  const tiltRef = useRef(tilt); tiltRef.current = tilt;
  /** The style the current build already wears (no second build on load). */
  const worn = useRef<string>("");

  // full screen: no site bar or footer
  useEffect(() => {
    document.body.classList.add("knowitball-immersive");
    return () => document.body.classList.remove("knowitball-immersive");
  }, []);

  // ?style=ink&scene=goal&tilt=30&t=6 (t holds a cut scene still at that second)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const s = q.get("style"); if (s && STYLE_CHIPS.some((c) => c.id === s)) setStyle(s as StyleId);
    const sc = q.get("scene"); if (sc && SCENES.some((c) => c.id === sc)) setScene(sc as StyleScene);
    const ti = Number(q.get("tilt")); if (ti > 0) setTilt(ti);
    const t = q.get("t"); if (t !== null && !Number.isNaN(Number(t))) setSeek(Number(t));
    if (q.get("clean") === "1") setClean(true);
    const demo = q.get("demo"); if (demo && DEMOS[demo]) demoRef.current = demo;
    setInited(true);
  }, []);

  // what is built: the gameplay (3D and 2D share one) or a cut scene
  const family = isPlay(scene) ? "play" : scene;
  useEffect(() => {
    if (!inited) return;
    const el = holder.current;
    if (!el) return;
    let dead = false;
    let guard: { dispose(): void } | null = null;
    let unpublish: () => void = () => {};
    setStatus("loading"); setShot(""); setHud(null);
    (window as unknown as { __styleReady?: boolean }).__styleReady = false;
    (async () => {
      try {
        if (family === "play") {
          const { createStyleGameplay } = await import("@/lib/star/style3d/gameplay");
          const g = await createStyleGameplay(el, { def: resolveStyle(styleRef.current, "play"), flat: scene === "play2d", tilt: tiltRef.current });
          if (dead) { g.dispose(); return; }
          play.current = g;
          worn.current = styleRef.current;
          // frame stepping: a scripted demo (?demo=) or whatever timeline the filming tool sets
          const demo = demoRef.current ? DEMOS[demoRef.current] : null;
          const fs = { duration: demo?.duration ?? 0, timeline: demo?.timeline as TimelineEvent[] | undefined, seek: (t: number) => seekGame(t) };
          const seekGame = makeWorldSeek(g.session.world, g.step, () => fs.timeline);
          unpublish = publishFrameStep(fs);
        } else if (family === "walkout") {
          const { createGuardScene } = await import("@/lib/star/farewell3d");
          const h = await createGuardScene(el, {
            you: { skin: "#c68642", accessories: [], kit: { shirt: "#d62828", trim: "#ffffff" }, number: 9, hair: "#2b1b10", hairStyle: "short" },
            ours: { shirt: "#d62828", trim: "#ffffff" }, rivals: { shirt: "#111111", trim: "#d4a017" }, seed: 3 + run,
          });
          if (dead) { h.dispose(); return; }
          guard = h;
        } else {
          const { createCutScene } = await import("@/lib/star/style3d/cutscenes");
          const c = await createCutScene(el, family as "goal" | "signing", resolveStyle(styleRef.current, "cut"), { onShot: (n) => setShot(n) });
          if (dead) { c.dispose(); return; }
          cut.current = c;
          worn.current = styleRef.current;
          if (seek !== null) c.seek(seek);
          unpublish = publishFrameStep({ duration: c.duration, seek: (t) => c.frameSeek(t) });
        }
        setStatus("ready");
        (window as unknown as { __styleReady?: boolean }).__styleReady = true;
      } catch (e) {
        console.error("Style Testing: 3D failed to load", e);
        if (!dead) setStatus("off");
      }
    })();
    return () => {
      dead = true;
      unpublish();
      play.current?.dispose(); play.current = null;
      cut.current?.dispose(); cut.current = null;
      guard?.dispose();
    };
    // rebuilt when the family changes (or Replay on the walk-out); style / tilt / 2D switch live
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [family, inited, family === "walkout" ? run : 0]);

  useEffect(() => {
    if (worn.current === style) return;
    worn.current = style;
    play.current?.setStyle(resolveStyle(style, "play"));
    cut.current?.setStyle(resolveStyle(style, "cut"));
  }, [style, status]);
  useEffect(() => { play.current?.setFlat(scene === "play2d"); }, [scene, status]);
  useEffect(() => { play.current?.setTilt(tilt); }, [tilt, status]);
  useEffect(() => {
    if (!isPlay(scene) || status !== "ready") return;
    const id = window.setInterval(() => { const g = play.current; if (g) setHud(g.session.hud()); }, 250);
    return () => window.clearInterval(id);
  }, [scene, status]);

  // ── thumbs (the 3D drills' own: stick on the left, tap / drag-back on the right) ──
  const stick = useRef<{ id: number; x0: number; y0: number } | null>(null);
  const aim = useRef<{ id: number; x0: number; y0: number } | null>(null);
  const [knob, setKnob] = useState<{ x0: number; y0: number; x: number; y: number } | null>(null);
  const [drag, setDrag] = useState<{ x0: number; y0: number; x: number; y: number } | null>(null);
  const toWorld = (sx: number, sy: number) => {
    const h = play.current?.heading() ?? -Math.PI / 2;
    const f = { x: Math.cos(h), y: Math.sin(h) }, r = { x: -Math.sin(h), y: Math.cos(h) };
    return { x: r.x * sx + f.x * -sy, y: r.y * sx + f.y * -sy };
  };
  const STICK_R = 56;
  const world = () => play.current?.session.world;
  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - box.left, y = e.clientY - box.top;
    e.currentTarget.setPointerCapture(e.pointerId);
    if (x < box.width * 0.4 && !stick.current) { stick.current = { id: e.pointerId, x0: x, y0: y }; setKnob({ x0: x, y0: y, x, y }); }
    else if (!aim.current) { aim.current = { id: e.pointerId, x0: x, y0: y }; setDrag({ x0: x, y0: y, x, y }); }
  };
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - box.left, y = e.clientY - box.top;
    const w = world();
    if (stick.current?.id === e.pointerId) {
      const dx = x - stick.current.x0, dy = y - stick.current.y0, d = Math.hypot(dx, dy);
      const k = Math.min(1, d / STICK_R);
      if (w) w.input = { move: d > 1 ? toWorld((dx / d) * k, (dy / d) * k) : { x: 0, y: 0 }, sprint: d > STICK_R * 0.92 };
      setKnob({ x0: stick.current.x0, y0: stick.current.y0, x, y });
    } else if (aim.current?.id === e.pointerId) setDrag({ x0: aim.current.x0, y0: aim.current.y0, x, y });
  };
  const onUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - box.left, y = e.clientY - box.top;
    const w = world();
    if (stick.current?.id === e.pointerId) { stick.current = null; if (w) w.input = { move: { x: 0, y: 0 }, sprint: false }; setKnob(null); return; }
    if (aim.current?.id === e.pointerId) {
      const a = aim.current;
      aim.current = null; setDrag(null);
      const dx = x - a.x0, dy = y - a.y0;
      if (!w) return;
      if (Math.hypot(dx, dy) < 14) { w.act({ kind: "tap" }); return; }
      w.act({ kind: "shoot", dir: toWorld(-dx, -dy), pull: Math.hypot(dx, dy) / realMatchHeight(window.innerWidth) });
    }
  };
  useEffect(() => {
    if (!isPlay(scene)) return;
    const keys = new Set<string>();
    const sync = () => {
      const w = world();
      if (!w || stick.current) return;
      const sx = (keys.has("d") || keys.has("arrowright") ? 1 : 0) - (keys.has("a") || keys.has("arrowleft") ? 1 : 0);
      const sy = (keys.has("s") || keys.has("arrowdown") ? 1 : 0) - (keys.has("w") || keys.has("arrowup") ? 1 : 0);
      const d = Math.hypot(sx, sy);
      w.input = { move: d ? toWorld(sx / d, sy / d) : { x: 0, y: 0 }, sprint: keys.has("shift") };
    };
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === " ") { e.preventDefault(); world()?.act({ kind: "tap" }); return; }
      keys.add(k); sync();
    };
    const up = (e: KeyboardEvent) => { keys.delete(e.key.toLowerCase()); sync(); };
    window.addEventListener("keydown", down); window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene]);

  const chip = (on: boolean) => `h-[28px] shrink-0 rounded-full border px-2.5 text-[12px] font-extrabold ${on ? "border-amber-300 bg-amber-400 text-black" : "border-white/20 bg-white/5 text-white"}`;
  const styleName = STYLE_CHIPS.find((c) => c.id === style)?.name ?? "";
  const mins = hud?.timeLeft !== undefined ? `${Math.floor(hud.timeLeft / 60)}:${String(Math.floor(hud.timeLeft % 60)).padStart(2, "0")}` : "";
  const cutScene = scene === "goal" || scene === "signing" || scene === "walkout";

  return (
    <div className="fixed inset-0 flex flex-col bg-black text-white" data-style-test={`${style}-${scene}`}>
      <div className={`z-20 flex-col gap-1.5 bg-gray-950/95 px-2 pb-2 pt-2 ${clean ? "hidden" : "flex"}`}>
        <div className="flex items-center gap-1.5 overflow-x-auto" data-style-chips>
          <span className="mr-0.5 shrink-0 text-[11px] font-black uppercase text-white/60">Style</span>
          {STYLE_CHIPS.map((c) => (
            <button key={c.id} onClick={() => setStyle(c.id)} className={chip(style === c.id)} data-style={c.id}>{c.label}</button>
          ))}
          <span className="ml-1 shrink-0 truncate text-[11px] font-bold text-white/80">{styleName}</span>
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto" data-scene-chips>
          {SCENES.map((c) => (
            <button key={c.id} onClick={() => { setSeek(null); setScene(c.id); }} className={chip(scene === c.id)} data-scene={c.id}>{c.label}</button>
          ))}
        </div>
        {isPlay(scene) && (
          <label className="flex items-center gap-2 text-[12px] font-bold">
            <span className="shrink-0">Camera {tilt}° from straight down</span>
            <input type="range" min={10} max={70} value={tilt} onChange={(e) => setTilt(Number(e.target.value))} className="w-full accent-amber-400" data-tilt />
          </label>
        )}
      </div>

      <div className="relative flex-1 select-none overflow-hidden" style={{ touchAction: "none" }}>
        <div ref={holder} className="absolute inset-0" data-style-canvas={status} />
        {isPlay(scene) && (
          <div className="absolute inset-0 z-10" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} />
        )}
        {!clean && isPlay(scene) && hud && (
          <div className="pointer-events-none absolute left-2 top-2 z-20 flex items-center gap-2 rounded bg-black/55 px-2 py-1 text-[13px] font-black">
            <span>{hud.big}</span><span className="text-[11px] font-bold text-white/80">{hud.small}</span><span className="tabular-nums">{mins}</span>
          </div>
        )}
        {!clean && isPlay(scene) && hud?.flash && <div className="pointer-events-none absolute inset-x-0 top-12 z-20 text-center text-[20px] font-black uppercase" style={{ textShadow: "0 2px 8px #000" }}>{hud.flash}</div>}
        {knob && (
          <div className="pointer-events-none absolute z-30 rounded-full ring-2 ring-white/50" style={{ left: knob.x0 - STICK_R, top: knob.y0 - STICK_R, width: STICK_R * 2, height: STICK_R * 2, background: "rgba(0,0,0,0.18)" }}>
            <div className="absolute h-[36px] w-[36px] rounded-full bg-white/80" style={{ left: STICK_R - 18 + Math.max(-STICK_R, Math.min(STICK_R, knob.x - knob.x0)), top: STICK_R - 18 + Math.max(-STICK_R, Math.min(STICK_R, knob.y - knob.y0)) }} />
          </div>
        )}
        {drag && Math.hypot(drag.x - drag.x0, drag.y - drag.y0) > 14 && (
          <svg className="pointer-events-none absolute inset-0 z-30" width="100%" height="100%">
            <line x1={drag.x0} y1={drag.y0} x2={drag.x0 - (drag.x - drag.x0)} y2={drag.y0 - (drag.y - drag.y0)} stroke="#fb923c" strokeWidth={6} strokeLinecap="round" />
          </svg>
        )}
        {(scene === "goal" || scene === "signing") && (
          <>
            <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-[9%] bg-black" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-[9%] bg-black" />
            {shot && !clean && <div className="pointer-events-none absolute left-2 top-[10%] z-20 text-[11px] font-bold uppercase text-white/70" data-shot>{shot}</div>}
          </>
        )}
        {!clean && cutScene && status === "ready" && (
          <button onClick={() => { if (scene === "walkout") setRun((r) => r + 1); else { setSeek(null); cut.current?.replay(); } }} className="absolute bottom-[11%] right-3 z-30 h-[34px] rounded-full bg-amber-400 px-4 text-[13px] font-black text-black" data-replay>
            ↺ Replay
          </button>
        )}
        {scene === "walkout" && status === "ready" && <div className="pointer-events-none absolute left-2 top-2 z-20 rounded bg-black/55 px-2 py-1 text-[11px] font-bold">The farewell walk-out in its own look: styles don&apos;t reach it yet.</div>}
        {!clean && isPlay(scene) && status === "ready" && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-black/45 px-3 py-1 text-center text-[11px] font-bold">Left thumb: move · Tap: pass · Drag back, let go: shoot</div>
        )}
        {!clean && status === "loading" && <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center text-[13px] font-bold text-white/80">Loading {styleName}…</div>}
        {status === "off" && <div className="absolute inset-0 z-30 grid place-items-center px-6 text-center text-[14px] font-bold text-amber-200">This device can&apos;t show the 3D test.</div>}
        {!clean && <div className="pointer-events-none absolute bottom-7 left-2 z-20 text-[10px] font-bold text-white/50">3D quality: {quality3dTier()}</div>}
      </div>
    </div>
  );
}
