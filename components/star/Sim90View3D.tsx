"use client";

/**
 * The full-match replay (lib/star/sim90.ts) in 3D, at replay time `t`.
 *
 * Harry, 14 Oct 2026: the Full match test page "can also be watched in 3D".
 * It uses the match's own 3D view (lib/star/style3d/engineView.ts) and hands
 * it one EngineFrame (lib/star/engineFrame.ts) each time `t` changes: the
 * ball, all 22 men in their kits, the away keeper in his goal (the goal the
 * 3D view's keeper lives in) and the home keeper as a man in his keeper kit.
 *
 * It has no clock and no animation loop: the page owns the clock, and the 3D
 * view draws inside `frame()`. Nothing is simulated here; the recorded
 * positions are read with goalClip/track.ts's `frameAt`.
 *
 * The camera: side-on like a broadcast, following the ball, kept inside the
 * pitch and steep (the 2D-frame camera's 50–60° down) so the stands stay out
 * of shot (Harry: "I don't love seeing the stadiums").
 */
import { useEffect, useRef, useState } from "react";
import type { EngineFrame, EngineFrameFigure, EngineFrameAct } from "@/lib/star/engineFrame";
import type { EngineView } from "@/lib/star/style3d/engineView";
import { resolveStyle } from "@/lib/star/style3d/styles";
import { frameAt, trackDuration, type GoalTrack } from "@/lib/star/goalClip/track";
import type { Viewport } from "@/lib/star/canvasEngine";

/** Pitch metres the camera shows along the pitch (the screen's width; side-on). */
export const SIM3D_SPAN = 34;
const PITCH_W = 68, PITCH_L = 105;

/** The broadcast frame round the ball at replay time t: side-on, eased toward where the ball goes next. */
export function sim3dViewport(track: GoalTrack, t: number, aspect: number): Viewport {
  const dur = trackDuration(track);
  const a = frameAt(track, t).ball, b = frameAt(track, Math.min(dur, t + 1.2)).ball;
  const cy = a.y * 0.65 + b.y * 0.35, cx = a.x * 0.65 + b.x * 0.35;
  const along = SIM3D_SPAN, across = SIM3D_SPAN * aspect;
  const clampC = (c: number, half: number, lo: number, hi: number) => (hi - lo <= 2 * half ? (lo + hi) / 2 : Math.min(hi - half, Math.max(lo + half, c)));
  const y = clampC(cy, along / 2, -2, PITCH_L + 2), x = clampC(cx, across / 2, 4, PITCH_W - 4);
  return { x1: x - across / 2, x2: x + across / 2, y1: y - along / 2, y2: y + along / 2 };
}

/** The 3D view's frame at replay time t (pure apart from reading the track). */
export function sim3dFrame(track: GoalTrack, t: number, W: number, H: number): EngineFrame {
  const dur = trackDuration(track);
  const h = 1 / track.fps;
  const now = frameAt(track, t), prev = frameAt(track, Math.max(0, t - h));
  const dt = t > h ? h : Math.max(1e-3, t);
  // what each man last did to the ball (a kick or save played as its clip)
  const acts = new Map<string, EngineFrameAct>();
  for (const e of track.events) {
    if (e.t > t) break;
    if (!e.who || t - e.t > 1.5) continue;
    acts.set(e.who, { kind: e.kind, mode: e.mode, save: e.save, start: e.t });
  }
  let keeper: EngineFrame["keeper"] = null;
  const figures: EngineFrameFigure[] = [];
  let nMate = 0, nDef = 0;
  track.bodies.forEach((b, i) => {
    const p = now.bodies[i];
    if (!p) return;
    const team = b.side === "us" ? "us" : "them";
    // the away keeper stands in the goal at y = 0, the 3D view's own keeper
    if (b.role === "keeper" && b.side === "them") {
      keeper = {
        x: p.x, y: p.y, dive: now.keeper.dive, saveLunge: now.keeper.lunge, saveDir: now.keeper.dir,
        saveKind: now.keeper.kind, idleT: t, shirt: b.kit.shirt, shorts: b.kit.shorts, act: acts.get(b.id), drawn: true,
      };
      return;
    }
    figures.push({
      sid: team === "us" ? `mate${nMate++}` : `def${nDef++}`,
      x: p.x, y: p.y, shirt: b.kit.shirt, shorts: b.kit.shorts, team,
      kick: false, kickFoot: 1, act: acts.get(b.id), drawn: true,
    });
  });
  const bl = now.ball, bp = prev.ball;
  return {
    t, phase: "flight", kind: "buildup",
    cam: { viewport: sim3dViewport(track, t, H / Math.max(1, W)), facing: "left", tilt: null, W, H },
    ball: {
      x: bl.x, y: bl.y, z: bl.z, vx: (bl.x - bp.x) / dt, vy: (bl.y - bp.y) / dt, vz: (bl.z - bp.z) / dt,
      live: t < dur, inNet: false,
    },
    landing: null, keeper, figures, aim: null, ring: null, goalSide: null, goalInView: true,
  };
}

export default function Sim90View3D({ track, t, aspect = 0.62 }: { track: GoalTrack; t: number; aspect?: number }) {
  const box = useRef<HTMLDivElement>(null);
  const view = useRef<EngineView | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "off">("loading");
  const [w, setW] = useState(0);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setW(el.clientWidth || 360);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // build the 3D view once
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    let dead = false;
    void import("@/lib/star/style3d/engineView")
      .then(({ createEngineView }) => createEngineView(el, { def: resolveStyle("real", "play"), onContextLost: () => setStatus("off") }))
      .then((v) => {
        if (dead) { v.dispose(); return; }
        view.current = v;
        setStatus("ready");
      })
      .catch((e) => { console.error("Full match 3D failed to load", e); if (!dead) setStatus("off"); });
    return () => {
      dead = true;
      try { view.current?.dispose(); } catch (e) { console.error("Full match 3D: dispose failed", e); }
      view.current = null;
    };
  }, []);

  // one frame each time the page's clock moves (or the view becomes ready)
  useEffect(() => {
    const v = view.current;
    if (!v || status !== "ready" || !w) return;
    try {
      v.frame(sim3dFrame(track, t, w, w * aspect));
    } catch (e) {
      console.error("Full match 3D: a frame failed to draw", e);
    }
  }, [track, t, w, aspect, status]);

  return (
    <div style={{ position: "relative" }}>
      <div ref={box} data-sim90-view3d style={{ width: "100%", height: w ? w * aspect : 220, borderRadius: 12, overflow: "hidden", background: "#24702d", position: "relative" }} />
      {status !== "ready" && (
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#e2e8f0", fontWeight: 800, fontSize: 13, pointerEvents: "none" }}>
          {status === "loading" ? "Loading 3D…" : "3D is not available on this device"}
        </div>
      )}
    </div>
  );
}
