"use client";

/**
 * The aerials test page's four other ways to hit a header or volley
 * (lib/star/airControl.ts). Drawn OVER the real match (CanvasMatch mounts it
 * while you aim at an air chance, test page only); it reads the cross where
 * the match draws it (getFrame) and hands the hit back to the match's own
 * handleContact (onStrike). No football here: no physics, no canvas, only the
 * thumb's input and the marks that read it (SVG).
 */
import { useEffect, useRef, useState } from "react";
import { CX, GOAL_W } from "@/lib/star/pitch";
import {
  AIR_CONTROL_INFO, airStrike, airSweetS, airWhiffS, beatStrike, ghostStrike, preaimStrike, preaimTimingSd, swipeStrike,
  BEAT_TAKEOFF_S, type AirControlMode, type AirKind, type AirStrikeOut,
} from "@/lib/star/airControl";
import { mulberry32 } from "@/lib/star/season";

type P = { x: number; y: number };
export interface AirLabFrame {
  /** Seconds since the cross was struck; it reaches you at D. */
  t: number; D: number;
  kind: AirKind; aerial: number; seed: number;
  /** The ball on the glass (client px, its height drawn), its shadow, and the spot you meet it. */
  ball: P; ballGround: P; meet: P; meetPitch: P;
  postL: P; postR: P; pxPerM: number;
  box: { x: number; y: number; w: number; h: number };
}

const gauss = (r: () => number) => { let u = 0, v = 0; while (u === 0) u = r(); while (v === 0) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

export default function AirControlLab({ mode, getFrame, onStrike }: {
  mode: AirControlMode; getFrame: () => AirLabFrame | null; onStrike: (out: AirStrikeOut) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [, setTick] = useState(0);
  const fRef = useRef<AirLabFrame | null>(null);
  const perfRef = useRef(0);
  const doneRef = useRef(false);
  // Input state.
  const down = useRef<{ x: number; y: number; t: number; pts: { x: number; y: number; t: number }[] } | null>(null);
  const spot = useRef<{ u: number; v: number } | null>(null);
  const strike = (out: AirStrikeOut) => { if (doneRef.current) return; doneRef.current = true; onStrike(out); };
  // The clock on the cross for an input at performance time `p`.
  const tAt = (p: number) => (fRef.current ? fRef.current.t + (p - perfRef.current) / 1000 : 0);

  useEffect(() => {
    let raf = 0;
    const step = () => {
      raf = requestAnimationFrame(step);
      const f = getFrame();
      fRef.current = f; perfRef.current = performance.now();
      if (!f || doneRef.current) { setTick((n) => (n + 1) % 1e6); return; }
      // B: your man meets it himself, his own timing error from Aerial.
      if (mode === "preaim") {
        const err = gauss(mulberry32((f.seed ^ 0x6a09e667) >>> 0)) * preaimTimingSd(f.aerial);
        if (f.t >= f.D + err) {
          const s = spot.current ?? { u: 0, v: 0.4 };
          strike(preaimStrike(f.kind, f.meetPitch, s.u, s.v, err, f.aerial));
        }
      } else if (f.t > f.D + airWhiffS(f.aerial, f.kind) + 0.05 && !down.current) {
        // Nothing in time: it has gone past you.
        strike(airStrike({ kind: f.kind, ball: f.meetPitch, aimX: CX, power: 0.7, dt: 9, aerial: f.aerial }));
      }
      setTick((n) => (n + 1) % 1e6);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [getFrame, mode]);

  const f = fRef.current;
  const R = rootRef.current?.getBoundingClientRect();
  const loc = (p: P): P => ({ x: p.x - (R?.left ?? 0), y: p.y - (R?.top ?? 0) });
  const toAimX = (x: number) => (f ? CX - GOAL_W / 2 + ((x - f.postL.x) / Math.max(1, f.postR.x - f.postL.x)) * GOAL_W : CX);
  const aimClient = (aimX: number): P => (f ? { x: f.postL.x + ((aimX - (CX - GOAL_W / 2)) / GOAL_W) * (f.postR.x - f.postL.x), y: (f.postL.y + f.postR.y) / 2 } : { x: 0, y: 0 });

  const onDown = (e: React.PointerEvent) => {
    e.stopPropagation(); e.preventDefault();
    if (doneRef.current || !fRef.current) return;
    try { (e.target as Element).setPointerCapture?.(e.pointerId); } catch { /* fine */ }
    const p = performance.now();
    down.current = { x: e.clientX, y: e.clientY, t: p, pts: [{ x: e.clientX, y: e.clientY, t: p }] };
    if (mode === "preaim") {
      const ff = fRef.current;
      const goalW = Math.max(1, ff.postR.x - ff.postL.x), barPx = 2.44 * ff.pxPerM;
      const u = ((e.clientX - ff.postL.x) / goalW) * 2 - 1;
      const v = ((ff.postL.y + ff.postR.y) / 2 - e.clientY) / Math.max(10, barPx);
      if (tAt(p) < ff.D - 0.05) spot.current = { u: Math.max(-1.1, Math.min(1.1, u)), v: Math.max(0, Math.min(1, v)) };
      down.current = null;
    }
  };
  const onMove = (e: React.PointerEvent) => {
    e.stopPropagation();
    const d = down.current; if (!d) return;
    d.pts.push({ x: e.clientX, y: e.clientY, t: performance.now() });
    if (d.pts.length > 60) d.pts.shift();
  };
  const onUp = (e: React.PointerEvent) => {
    e.stopPropagation();
    const d = down.current; down.current = null;
    const ff = fRef.current;
    if (!d || !ff || doneRef.current) return;
    const p = performance.now();
    d.pts.push({ x: e.clientX, y: e.clientY, t: p });
    const dt = tAt(p) - ff.D;
    if (mode === "ghost") {
      strike(ghostStrike(ff.kind, ff.meetPitch, { dx: e.clientX - d.x, dy: e.clientY - d.y }, dt, ff.aerial));
    } else if (mode === "swipe") {
      const a = d.pts[0], b = d.pts[d.pts.length - 1];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      if (len < 25) return; // a tap is not a swipe
      // When it passed the ball: the trail point nearest the contact ring's middle.
      let best = d.pts[0], bd = Infinity;
      for (const q of d.pts) { const dd = Math.hypot(q.x - ff.meet.x, q.y - ff.meet.y); if (dd < bd) { bd = dd; best = q; } }
      const ringR = 36;
      const side = best.x < ff.meet.x ? -1 : 1;
      const ang = Math.atan2(b.x - a.x, -(b.y - a.y));
      const speed = len / Math.max(0.03, (b.t - a.t) / 1000);
      strike(swipeStrike(ff.kind, ff.meetPitch, ang, speed, (side * bd) / ringR, tAt(best.t) - ff.D, ff.aerial));
    } else if (mode === "beat") {
      const w = R?.width ?? 390, left = R?.left ?? 0;
      const u = ((e.clientX - left) / w) * 2 - 1;
      strike(beatStrike(ff.kind, ff.meetPitch, tAt(d.t) - ff.D, (p - d.t) / 1000, u * 1.15, dt, ff.aerial));
    }
  };

  const info = AIR_CONTROL_INFO[mode];
  const W = airSweetS(f?.aerial ?? 60, f?.kind);
  const dtNow = f ? f.t - f.D : -9;
  const inSweet = Math.abs(dtNow) <= W;
  const ballR = f ? Math.max(5, 0.22 * f.pxPerM) : 6;
  const m = f ? loc(f.meet) : null;
  const b = f ? loc(f.ball) : null;
  const gl = f ? loc(f.postL) : null, gr = f ? loc(f.postR) : null;
  const barPx = f ? 2.44 * f.pxPerM : 0;
  const d = down.current;
  const hold = d && mode === "beat" ? (performance.now() - d.t) / 1000 : 0;

  // Ghost: the drag's aim, drawn as a line from the spot to the goal.
  let aimLine: { from: P; to: P; pow: number } | null = null;
  if (f && d && mode === "ghost" && m) {
    const pts = d.pts[d.pts.length - 1];
    const out = ghostStrike(f.kind, f.meetPitch, { dx: pts.x - d.x, dy: pts.y - d.y }, 0, f.aerial);
    aimLine = { from: m, to: loc(aimClient(out.aimX)), pow: out.aim.power };
  }
  const beatX = (t: number, w: number) => f ? 24 + ((t + 0.5) / (f.D + 0.8)) * (w - 48) : 0;
  const Wd = R?.width ?? 390, Hd = R?.height ?? 600;

  return (
    <div ref={rootRef} data-air-lab={mode} data-t={f ? f.t.toFixed(3) : ""} data-d={f ? f.D.toFixed(3) : ""}
      data-meet={m ? `${Math.round(f!.meet.x)},${Math.round(f!.meet.y)}` : ""} data-goal={gl && gr ? `${Math.round(f!.postL.x)},${Math.round(f!.postL.y)},${Math.round(f!.postR.x)}` : ""}
      className="absolute inset-0 z-30 select-none" style={{ touchAction: "none" }}
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => { down.current = null; }}>
      {/* Under the play, never over the goal (it hid the goal you tap in B). */}
      <div className={`pointer-events-none absolute left-2 right-2 ${mode === "beat" ? "bottom-[88px]" : "bottom-3"} rounded-xl px-3 py-1.5 text-center text-white`}
        style={{ background: "rgba(5,8,15,.78)", boxShadow: "inset 0 0 0 1.5px rgba(253,224,71,.85)" }}>
        <div className="text-[11px] font-black uppercase tracking-wide text-amber-300">{info.name} · {f?.kind === "header" ? "header" : "volley"}</div>
        <div className="text-[12px] font-bold leading-tight">{info.how}</div>
      </div>
      {f && m && b && gl && gr && (
        <svg className="pointer-events-none absolute inset-0" width={Wd} height={Hd}>
          {/* A: the ghost ring closes onto the ball's meeting spot. */}
          {mode === "ghost" && !doneRef.current && (
            <>
              <circle cx={m.x} cy={m.y} r={ballR + 2} fill="none" stroke="rgba(255,255,255,.9)" strokeWidth={1.5} />
              <circle cx={m.x} cy={m.y} r={ballR + 2 + Math.min(1.1, Math.max(0, -dtNow)) * 60} fill="none"
                stroke={inSweet ? "#4ade80" : "#fde047"} strokeWidth={3} opacity={dtNow > W ? 0.3 : 0.95} />
              {aimLine && <line x1={aimLine.from.x} y1={aimLine.from.y} x2={aimLine.to.x} y2={aimLine.to.y} stroke="#fde047" strokeWidth={2.5} strokeDasharray="6 4" />}
            </>
          )}
          {/* B: the goal is the button. */}
          {mode === "preaim" && (
            <>
              <rect x={gl.x} y={gl.y - barPx} width={Math.max(1, gr.x - gl.x)} height={barPx} fill="rgba(253,224,71,.14)" stroke="#fde047" strokeWidth={1.5} strokeDasharray="4 3" />
              {spot.current && (() => {
                const x = gl.x + ((spot.current.u + 1) / 2) * (gr.x - gl.x), y = gl.y - spot.current.v * barPx;
                return <g><circle cx={x} cy={y} r={7} fill="none" stroke="#4ade80" strokeWidth={2.5} /><circle cx={x} cy={y} r={2} fill="#4ade80" /></g>;
              })()}
              <circle cx={m.x} cy={m.y} r={ballR + 3} fill="none" stroke="rgba(255,255,255,.7)" strokeWidth={1.5} strokeDasharray="3 3" />
            </>
          )}
          {/* C: the contact ring the ball comes through. */}
          {mode === "swipe" && (
            <>
              <circle cx={m.x} cy={m.y} r={36} fill={inSweet ? "rgba(74,222,128,.22)" : "rgba(255,255,255,.08)"} stroke={inSweet ? "#4ade80" : "rgba(255,255,255,.85)"} strokeWidth={2} />
              {d && d.pts.length > 1 && (
                <polyline points={d.pts.map((q) => `${q.x - (R?.left ?? 0)},${q.y - (R?.top ?? 0)}`).join(" ")} fill="none" stroke="#fde047" strokeWidth={4} strokeLinecap="round" opacity={0.9} />
              )}
            </>
          )}
          {/* D: the rhythm bar, and where your thumb aims across the goal. */}
          {mode === "beat" && (
            <>
              <rect x={24} y={Hd - 58} width={Wd - 48} height={14} rx={7} fill="rgba(5,8,15,.72)" />
              <rect x={beatX(f.D - 0.75, Wd)} y={Hd - 58} width={beatX(f.D - BEAT_TAKEOFF_S, Wd) - beatX(f.D - 0.75, Wd)} height={14} fill="rgba(96,165,250,.65)" />
              <rect x={beatX(f.D - W, Wd)} y={Hd - 62} width={beatX(f.D + W, Wd) - beatX(f.D - W, Wd)} height={22} fill="rgba(74,222,128,.85)" />
              <circle cx={beatX(Math.min(f.t, f.D + 0.8), Wd)} cy={Hd - 51} r={8} fill="#fff" stroke="#111" strokeWidth={1.5} />
              <text x={beatX(f.D - 0.5, Wd)} y={Hd - 66} fill="#bfdbfe" fontSize={10} fontWeight={800} textAnchor="middle">UP</text>
              <text x={beatX(f.D, Wd)} y={Hd - 66} fill="#bbf7d0" fontSize={10} fontWeight={800} textAnchor="middle">HIT</text>
              {d && <rect x={24} y={Hd - 38} width={(Wd - 48) * Math.min(1, hold / 0.55)} height={6} rx={3} fill="#fb923c" />}
              {d && (() => { const last = d.pts[d.pts.length - 1]; const u = ((last.x - (R?.left ?? 0)) / Wd) * 2 - 1; const x = gl.x + ((Math.max(-1.15, Math.min(1.15, u * 1.15)) + 1) / 2) * (gr.x - gl.x); return <line x1={x} y1={gl.y - barPx} x2={x} y2={gl.y + 4} stroke="#fde047" strokeWidth={3} />; })()}
            </>
          )}
        </svg>
      )}
    </div>
  );
}
