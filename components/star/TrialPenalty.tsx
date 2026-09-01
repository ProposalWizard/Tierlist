"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  buildScenario, initDefenders, launch, stepBall, stepKeeper, stepBallInNet,
  clamp, type Ball, type Outcome, type Scenario, type Viewport,
} from "@/lib/star/canvasEngine";
import { mulberry32 } from "@/lib/star/season";
import {
  CX, POST_L, POST_R, NET_DEPTH, PEN_SPOT_Y, SIX_L, SIX_R, SIX_DEPTH,
  BOX_L, BOX_R, BOX_DEPTH, BALL_R, GOAL_H, ARC_R,
} from "@/lib/star/pitch";
import { kitsOf } from "@/lib/star/kits";
import ContactBall from "./ContactBall";

/**
 * The same pitch/goal/keeper rendering CanvasMatch.tsx uses for a real
 * match, ported rather than shared — this codebase's own precedent
 * (CanvasMatch → CanvasMatchTest, the star-match-dev sandbox) is a full
 * duplicate fork for a second canvas that needs to look identical, not an
 * extracted module, so this follows the same pattern rather than inventing
 * a new one. Reported directly: the trial's own hand-rolled version (a
 * flat green rectangle, a plain net grid, an amber blob for a keeper) read
 * as "trash" next to the real thing, which is exactly what it was — a
 * placeholder that was never actually swapped out.
 */
const SKIN = "#c68642";
const TC = {
  pitch: "#1f9006",
  line: "rgba(255,255,250,0.85)",
  lineFaint: "rgba(255,255,250,0.5)",
  gk: "#fbbf24",
  gkRim: "#92400e",
  goldSoft: "#fde68a",
};
const GRASS_TILE = 96;
function makeGrassTile(): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = GRASS_TILE; c.height = GRASS_TILE;
  const g = c.getContext("2d");
  if (!g) return null;
  const img = g.createImageData(GRASS_TILE, GRASS_TILE);
  let seed = 0x2f6f2b;
  for (let i = 0; i < img.data.length; i += 4) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const n = ((seed >>> 16) & 0xff) / 255;
    const light = n > 0.5;
    img.data[i] = light ? 255 : 0;
    img.data[i + 1] = light ? 255 : 0;
    img.data[i + 2] = light ? 255 : 0;
    img.data[i + 3] = Math.round(Math.abs(n - 0.5) * 2 * 16);
  }
  g.putImageData(img, 0, 0);
  return c;
}

/**
 * THE TRIAL.
 *
 * The first thing a career does, before it has a dashboard or a fixture list:
 * one penalty, taken again and again until it goes in. You cannot fail it —
 * you can only not have passed it yet — which is the point. It is a scene
 * rather than a test.
 *
 * ── Why this is not CanvasMatch ──
 *
 * CanvasMatch runs ninety minutes: a hidden match either side of every chance,
 * commentary, a scoreline, substitutions, a post-match summary. None of that
 * exists here and all of it would have to be suppressed. What IS shared is the
 * part that matters — the physics. The scenario, the strike and the keeper all
 * come from the same engine the real game uses (`buildScenario("penalty")`,
 * `launch`, `stepBall`, `stepKeeper`), so this penalty behaves exactly like a
 * penalty in a match. Only the picture is its own, and a penalty's picture is
 * a goal, a keeper and a ball.
 */

type Phase = "aim" | "contact" | "flight" | "missed";

/**
 * The camera framing.
 *
 * There is no separate view for the trial — `buildScenario` already computes
 * the exact same framing a real match uses for this scenario kind and hangs
 * it on `sc.viewport` (see `scenarioViewport`/`fitToView` in canvasEngine.ts),
 * so a penalty here is framed identically to a penalty in a match. A
 * hand-picked rectangle used to live here instead — wide enough to show the
 * whole penalty box and a fixed "3/4" container CSS that didn't match it —
 * which is what produced the "completely stretched, from so far out" bug:
 * two independently-wrong rectangles, neither matching the other or the real
 * game's 5:8 camera. `FALLBACK_VIEW` only covers the single frame before the
 * first scenario exists.
 */
const FALLBACK_VIEW: Viewport = { x1: BOX_L - 2, x2: BOX_R + 2, y1: -NET_DEPTH - 1.5, y2: PEN_SPOT_Y + 5 };
/** Same dead-zone rule the real game uses — a press that slips is not a shot. */
const MIN_PULL = 0.04;
/** How far you must pull for full power, as a fraction of the canvas height. */
const FULL_POWER_PULL = 0.16;

export default function TrialPenalty({ onScored, club }: { onScored: () => void; club: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const scRef = useRef<Scenario | null>(null);
  const ballRef = useRef<Ball | null>(null);
  const rngRef = useRef<() => number>(mulberry32(Date.now() & 0xffff));
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const draggingRef = useRef(false);
  const phaseRef = useRef<Phase>("aim");
  const rafRef = useRef<number | null>(null);
  const outcomeRef = useRef<Outcome | null>(null);
  const doneRef = useRef(false);
  /**
   * Has this attempt already been acted on?
   *
   * Without it the block below re-fires on EVERY frame once the settle timer
   * passes — a single miss would count a dozen attempts and schedule a dozen
   * resets. Cleared by `reset`, so the next penalty can resolve normally.
   */
  const resolvedRef = useRef(false);
  /** The real ball photo (public/star/ball.png) — see CanvasMatch.tsx. */
  const ballImgRef = useRef<HTMLImageElement | null>(null);
  /** The grass grain tile, built once — see makeGrassTile above. */
  const grassRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const img = new Image();
    img.src = "/star/ball.png";
    ballImgRef.current = img;
  }, []);

  const [phase, setPhaseState] = useState<Phase>("aim");
  const [aim, setAim] = useState<{ dir: { x: number; y: number }; power: number } | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [missText, setMissText] = useState("");

  const setPhase = (p: Phase) => { phaseRef.current = p; setPhaseState(p); };

  /** A fresh penalty. Called at the start and after every one that stays out. */
  const reset = useCallback(() => {
    const rng = rngRef.current;
    // Keeper strength kept modest: this is a trial, and it has to end.
    const sc = buildScenario("penalty", rng, 52, 60, 55);
    // The engine expects a scenario to have been initialised before it is
    // stepped — cheaper to call it than to depend on that staying true.
    initDefenders(sc, rng);
    scRef.current = sc;
    ballRef.current = null;
    outcomeRef.current = null;
    resolvedRef.current = false;
    dragRef.current = null;
    draggingRef.current = false;
    setAim(null);
    setPhase("aim");
  }, []);

  useEffect(() => { reset(); }, [reset]);

  // ── Pointer → pitch ────────────────────────────────────────────────────────
  const pitchFromPointer = (e: React.PointerEvent) => {
    const c = canvasRef.current;
    const vp = scRef.current?.viewport ?? FALLBACK_VIEW;
    if (!c) return { x: CX, y: PEN_SPOT_Y };
    const r = c.getBoundingClientRect();
    const fx = (e.clientX - r.left) / r.width;
    const fy = (e.clientY - r.top) / r.height;
    return {
      x: vp.x1 + fx * (vp.x2 - vp.x1),
      y: vp.y1 + fy * (vp.y2 - vp.y1),
    };
  };

  /** Pull length as a fraction of the canvas height, so power reads the same
   *  however the scene is scaled. */
  const screenPull = (drag: { x: number; y: number }, ball: { x: number; y: number }, vp: Viewport) => {
    const H = vp.y2 - vp.y1, W = vp.x2 - vp.x1;
    const aspect = W / H;
    return Math.hypot(((drag.x - ball.x) / W) * aspect, (drag.y - ball.y) / H);
  };
  const powerFrom = (drag: { x: number; y: number }, ball: { x: number; y: number }, vp: Viewport) =>
    clamp(screenPull(drag, ball, vp) / FULL_POWER_PULL, 0, 1);

  const onPointerDown = (e: React.PointerEvent) => {
    if (phaseRef.current !== "aim") return;
    draggingRef.current = true;
    dragRef.current = pitchFromPointer(e);
    try { canvasRef.current?.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    dragRef.current = pitchFromPointer(e);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    try { canvasRef.current?.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    const d = dragRef.current;
    const sc = scRef.current;
    dragRef.current = null;
    if (!d || !sc) return;
    if (screenPull(d, sc.ball, sc.viewport) < MIN_PULL) return;
    const power = powerFrom(d, sc.ball, sc.viewport);
    if (power < 0.05) return;
    setAim({ dir: { x: sc.ball.x - d.x, y: sc.ball.y - d.y }, power });
    setPhase("contact");
  };

  /** Where on the ball — hands straight to the same `launch` a match uses. */
  const handleContact = (contact: { cx: number; cy: number }) => {
    const sc = scRef.current;
    if (!sc || !aim) return;
    ballRef.current = launch(sc, aim.dir, aim.power, contact, { power: 62, technique: 62 }, rngRef.current);
    setAim(null);
    setPhase("flight");
  };

  // ── The loop ───────────────────────────────────────────────────────────────
  useEffect(() => {
    let last = performance.now();
    let settle = 0;

    const frame = (now: number) => {
      rafRef.current = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const sc = scRef.current;
      if (!sc) return;

      if (phaseRef.current === "flight" && ballRef.current) {
        const ball = ballRef.current;
        if (ball.inNet) {
          stepBallInNet(ball, dt);
        } else if (!outcomeRef.current) {
          stepKeeper(sc, dt);
          const res = stepBall(ball, sc, rngRef.current, dt);
          if (res) {
            outcomeRef.current = res;
            settle = 0;
          }
        }
        if (outcomeRef.current) {
          settle += dt;
          // A beat to watch it, then either on with the story or go again.
          if (settle > 1.1 && !resolvedRef.current && !doneRef.current) {
            resolvedRef.current = true;
            const res = outcomeRef.current;
            // Reported directly: "it can't rebound off of the keeper or the
            // post, and then one of your teammates score — you have to be
            // the one to score." A save or a post that comes back out is
            // exactly what the two D-side team-mates are there for in a real
            // match (see buildPenalty) — but here that would let the trial
            // end on a goal you didn't score. `receiverShot` is only ever
            // set when the ball reaches a team-mate and HE strikes it
            // (launchReceiverShot), never for your own original hit, so it
            // is the one reliable signal for "somebody else put this away" —
            // a clean team-mate finish reports as "goal" the same as yours
            // would, so the outcome tag alone can't tell them apart.
            const yours = !sc.receiverShot;
            if ((res === "goal" || res === "rebound") && yours) {
              doneRef.current = true;
              onScored();
            } else {
              setAttempts(a => a + 1);
              const teammateScored = (res === "goal" || res === "rebound") && !yours;
              setMissText(teammateScored ? "A team-mate gets there first — it has to be you." : (MISS_LINE[res] ?? "Again."));
              setPhase("missed");
              window.setTimeout(() => { setMissText(""); reset(); }, 1100);
            }
          }
        }
      }

      draw();
    };

    rafRef.current = requestAnimationFrame(frame);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onScored, reset]);

  // ── The picture ────────────────────────────────────────────────────────────
  const draw = () => {
    const c = canvasRef.current, wrap = wrapRef.current, sc = scRef.current;
    if (!c || !wrap || !sc) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cssW = wrap.clientWidth, cssH = wrap.clientHeight;
    if (c.width !== Math.round(cssW * dpr) || c.height !== Math.round(cssH * dpr)) {
      c.width = Math.round(cssW * dpr);
      c.height = Math.round(cssH * dpr);
    }
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const W = cssW, H = cssH;

    const vp = sc.viewport;
    const sx = W / (vp.x2 - vp.x1), sy = H / (vp.y2 - vp.y1);
    const px = (x: number) => (x - vp.x1) * sx;
    const py = (y: number) => (y - vp.y1) * sy;
    const unit = Math.min(sx, sy);

    // ── Grass — real colour, real grain, no mowing stripes ──
    // Sampled off the reference, same as CanvasMatch.tsx's own pitch: a
    // saturated yellow-green with almost no blue, and NO mowing bands —
    // measured flat across six sample heights. What it does have is a very
    // fine, near-invisible grain, tiled from a fixed procedural pattern so
    // it never shimmers between frames.
    ctx.fillStyle = TC.pitch;
    ctx.fillRect(0, 0, W, H);
    if (!grassRef.current) grassRef.current = makeGrassTile();
    if (grassRef.current) {
      const pat = ctx.createPattern(grassRef.current, "repeat");
      if (pat) {
        ctx.save();
        ctx.translate(px(0) % GRASS_TILE, py(0) % GRASS_TILE);
        ctx.fillStyle = pat;
        ctx.fillRect(-GRASS_TILE, -GRASS_TILE, W + GRASS_TILE * 2, H + GRASS_TILE * 2);
        ctx.restore();
      }
    }
    // Worn grass at the goalmouth and the penalty spot — the same wear a
    // season of real football leaves, and most of what stops a pitch
    // looking printed.
    {
      const wear = (x: number, y: number, rx: number, ry: number, alpha: number) => {
        const cx2 = px(x), cy2 = py(y);
        const g = ctx.createRadialGradient(cx2, cy2, 0, cx2, cy2, Math.max(rx, ry) * unit);
        g.addColorStop(0, `rgba(120,132,26,${alpha})`);
        g.addColorStop(1, "rgba(120,132,26,0)");
        ctx.save();
        ctx.translate(cx2, cy2);
        ctx.scale(1, ry / rx);
        ctx.translate(-cx2, -cy2);
        ctx.fillStyle = g;
        ctx.fillRect(cx2 - rx * unit * 1.2, cy2 - rx * unit * 1.2, rx * unit * 2.4, rx * unit * 2.4);
        ctx.restore();
      };
      wear(CX, 1.9, 6.2, 2.4, 0.22);
      wear(CX, PEN_SPOT_Y, 3.2, 2.2, 0.16);
    }

    ctx.strokeStyle = TC.line;
    ctx.lineWidth = Math.max(1.5, unit * 0.12);

    // Goal line, six-yard box, penalty area.
    const line = (x1: number, y1: number, x2: number, y2: number) => {
      ctx.beginPath(); ctx.moveTo(px(x1), py(y1)); ctx.lineTo(px(x2), py(y2)); ctx.stroke();
    };
    line(vp.x1, 0, vp.x2, 0);
    ctx.strokeRect(px(SIX_L), py(0), (SIX_R - SIX_L) * sx, SIX_DEPTH * sy);
    ctx.strokeRect(px(BOX_L), py(0), (BOX_R - BOX_L) * sx, BOX_DEPTH * sy);

    // The D — real IFAB geometry, the same formula CanvasMatch.tsx uses for
    // a real match: an arc of radius ARC_R (9.15 m) around the spot, clipped
    // to only the portion beyond the box's own edge (BOX_DEPTH). Ported here
    // as a fixed pair of angles (0.18π/0.82π) that only APPROXIMATED that —
    // close enough to look roughly right, wrong enough to read as "not put
    // on properly" next to the real thing. No `arcAngle` rotation needed
    // here the way CanvasMatch.tsx has one: this camera always faces the
    // goal straight on and never turns.
    ctx.strokeStyle = TC.lineFaint;
    ctx.beginPath();
    const halfD = Math.acos(clamp((BOX_DEPTH - PEN_SPOT_Y) / ARC_R, -1, 1));
    ctx.arc(px(CX), py(PEN_SPOT_Y), ARC_R * unit, Math.PI / 2 - halfD, Math.PI / 2 + halfD);
    ctx.stroke();

    // Penalty spot.
    ctx.beginPath();
    ctx.arc(px(CX), py(PEN_SPOT_Y), Math.max(2, unit * 0.16), 0, Math.PI * 2);
    ctx.fillStyle = TC.line;
    ctx.fill();

    // ── Decorative players, waiting outside the D for the rebound ──
    //
    // Requested directly: one player from each side, outside the arc, on
    // both flanks of the box — purely for the scene, not the physics
    // (never touched by `sc`/`ballRef`, and the ball can never reach them).
    // Your own club's real kit; the trialist has no named opponent yet, so
    // the other kit is a plain, unbranded away strip rather than inventing
    // a rival that doesn't exist at this point in the career.
    {
      const kit = kitsOf(club).home;
      const opponentKit = { shirt: "#374151", trim: "#e5e7eb" };
      const drawDecorativePlayer = (x: number, y: number, shirt: string, trim: string) => {
        const dpx = px(x), dpy = py(y);
        const r = unit * 0.62;
        ctx.save();
        ctx.globalAlpha = 0.88;
        ctx.beginPath();
        ctx.ellipse(dpx, dpy + r * 0.9, r * 0.55, r * 0.18, 0, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0,0,0,0.28)";
        ctx.fill();
        // Legs.
        ctx.strokeStyle = SKIN;
        ctx.lineWidth = Math.max(1, r * 0.16);
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(dpx - r * 0.14, dpy + r * 0.1);
        ctx.lineTo(dpx - r * 0.18, dpy + r * 0.82);
        ctx.moveTo(dpx + r * 0.14, dpy + r * 0.1);
        ctx.lineTo(dpx + r * 0.18, dpy + r * 0.82);
        ctx.stroke();
        // Torso — the shirt.
        ctx.fillStyle = shirt;
        ctx.beginPath();
        ctx.roundRect?.(dpx - r * 0.42, dpy - r * 0.55, r * 0.84, r * 0.7, r * 0.16);
        if (!ctx.roundRect) ctx.rect(dpx - r * 0.42, dpy - r * 0.55, r * 0.84, r * 0.7);
        ctx.fill();
        ctx.strokeStyle = trim;
        ctx.lineWidth = Math.max(1, r * 0.08);
        ctx.stroke();
        // Head.
        ctx.beginPath();
        ctx.arc(dpx, dpy - r * 0.78, r * 0.26, 0, Math.PI * 2);
        ctx.fillStyle = SKIN;
        ctx.fill();
        ctx.restore();
      };
      // Just beyond the box's near corners, outside the D on both sides.
      drawDecorativePlayer(BOX_L - 1.0, BOX_DEPTH - 0.9, kit.shirt, kit.trim);
      drawDecorativePlayer(BOX_L - 1.0, BOX_DEPTH + 1.1, opponentKit.shirt, opponentKit.trim);
      drawDecorativePlayer(BOX_R + 1.0, BOX_DEPTH - 0.9, kit.shirt, kit.trim);
      drawDecorativePlayer(BOX_R + 1.0, BOX_DEPTH + 1.1, opponentKit.shirt, opponentKit.trim);
    }

    // ── The goal — five surfaces, drawn back to front, exactly as a real
    // match renders it (CanvasMatch.tsx): a shadow on the grass, the floor
    // inside, a dimmer back net (deepest, seen through the mouth), a
    // brighter roof net catching the light, and the front frame — the two
    // objects a shot can actually hit. Nothing is drawn across the mouth
    // itself; it is a hole, and the back net behind it is what you see
    // through it. That tonal separation between roof and back is what makes
    // it read as a goal rather than a flat mesh panel. ──
    {
      const heightScale = sy;
      const hpx = GOAL_H * heightScale;
      const bl = { px: px(POST_L), py: py(0) }, br = { px: px(POST_R), py: py(0) };
      const tl = { px: bl.px, py: bl.py - hpx }, tr = { px: br.px, py: br.py - hpx };
      const rl = { px: px(POST_L), py: py(-NET_DEPTH) }, rr = { px: px(POST_R), py: py(-NET_DEPTH) };
      const ul = { px: rl.px, py: rl.py - hpx }, ur = { px: rr.px, py: rr.py - hpx };

      type Pt = { px: number; py: number };
      const path = (q: Pt[]) => {
        ctx.beginPath();
        ctx.moveTo(q[0].px, q[0].py);
        for (let i = 1; i < q.length; i++) ctx.lineTo(q[i].px, q[i].py);
        ctx.closePath();
      };
      const quad = (q: Pt[], fill: string) => { path(q); ctx.fillStyle = fill; ctx.fill(); };
      const seg = (a2: Pt, b2: Pt) => { ctx.beginPath(); ctx.moveTo(a2.px, a2.py); ctx.lineTo(b2.px, b2.py); ctx.stroke(); };
      const lerp = (a2: Pt, b2: Pt, f: number) => ({ px: a2.px + (b2.px - a2.px) * f, py: a2.py + (b2.py - a2.py) * f });
      const netting = (q: Pt[], cols: number, rows: number, alpha: number) => {
        ctx.save();
        path(q); ctx.clip();
        ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
        ctx.lineWidth = Math.max(0.7, unit * 0.028);
        for (let i = 0; i <= cols; i++) { const f = i / cols; seg(lerp(q[0], q[1], f), lerp(q[3], q[2], f)); }
        for (let j = 0; j <= rows; j++) { const f = j / rows; seg(lerp(q[0], q[3], f), lerp(q[1], q[2], f)); }
        ctx.restore();
      };

      const sh = unit * 0.5;
      quad([rl, rr, br, bl].map(q => ({ px: q.px + sh, py: q.py + sh * 0.3 })), "rgba(0,0,0,0.09)");
      quad([bl, br, rr, rl], "rgba(20,50,32,0.05)");
      quad([rl, rr, ur, ul], "rgba(22,52,34,0.16)");
      netting([rl, rr, ur, ul], 34, 10, 0.42);
      ctx.strokeStyle = "#0f1a14";
      ctx.lineWidth = Math.max(1.8, unit * 0.15);
      seg(rl, ul); seg(rr, ur); seg(ul, ur);
      quad([tl, tr, ur, ul], "rgba(236,245,239,0.30)");
      netting([tl, tr, ur, ul], 34, 5, 0.8);

      ctx.lineCap = "round";
      ctx.strokeStyle = "#f6faf7";
      ctx.lineWidth = Math.max(1.8, unit * 0.12);
      seg(bl, tl); seg(br, tr);
      ctx.lineWidth = Math.max(2, unit * 0.16);
      seg(tl, tr);
      ctx.lineCap = "butt";

      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.lineWidth = Math.max(1.5, unit * 0.11);
      line(POST_L, 0, POST_R, 0);
    }

    // ── The keeper — the same pose-driven figure a real match uses
    // (CanvasMatch.tsx), not a blob: legs, shorts, arms whose reach and
    // direction come from the actual save being played, a shirt, gloves
    // (the detail that actually makes him read as a keeper), and idle
    // breathing so he is never frozen on his line while waiting. ──
    {
      const kk = sc.keeper;
      const kpx = px(kk.x), kpy = py(kk.y);
      const lunge = kk.saveLunge > 0 ? kk.saveLunge : 0;
      const KIND = {
        catch:     { lean: 0.15, armUp:  0.25, spread: 0.45, reachK: 0.55, crouch: 0.10 },
        central:   { lean: 0.05, armUp: -0.10, spread: 1.05, reachK: 0.80, crouch: 0.22 },
        low:       { lean: 1.15, armUp: -0.85, spread: 0.95, reachK: 1.35, crouch: 0.30 },
        high:      { lean: 0.55, armUp:  1.00, spread: 0.80, reachK: 1.30, crouch: -0.35 },
        fingertip: { lean: 1.30, armUp:  0.35, spread: 0.70, reachK: 1.70, crouch: 0.05 },
      } as const;
      const kind = kk.saveKind ?? null;
      const K = kind ? KIND[kind] : null;

      const breathe = Math.sin(kk.idleT * 2.1) * 0.02;
      const weight = Math.sin(kk.idleT * 0.9) * 0.05;

      const diveN = clamp(Math.abs(kk.dive) / 1.6, 0, 1) * 0.45 + lunge * (K ? K.reachK : 0.55);
      const sign = kk.saveLunge > 0 ? (kk.saveDir || 1) : (kk.dive === 0 ? 0 : Math.sign(kk.dive));
      const KR = unit * 1.15 * 0.82;
      const lean = sign * diveN * (K ? K.lean : 0.9);
      const cx2 = kpx + sign * KR * lunge * (K ? K.reachK : 1.0) * 0.3;
      const cyOff = KR * ((K ? K.crouch : 0) * lunge + breathe);
      const gloveR = KR * 0.24;

      ctx.save();
      ctx.globalAlpha = 0.92;

      ctx.beginPath();
      ctx.ellipse(cx2, kpy, KR * (0.7 + diveN * 0.5), KR * 0.26, 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.fill();

      ctx.translate(cx2 + KR * weight * (1 - lunge), kpy - KR * 0.8 + cyOff);
      ctx.rotate(lean);
      ctx.lineCap = "round";

      ctx.strokeStyle = SKIN;
      ctx.lineWidth = Math.max(1.2, KR * 0.28);
      ctx.beginPath();
      ctx.moveTo(-KR * 0.22, KR * 0.16);
      ctx.lineTo(-KR * 0.30 - diveN * KR * 0.3, KR * 0.76);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(KR * 0.22, KR * 0.16);
      ctx.lineTo(KR * 0.30 + diveN * KR * 0.3, KR * 0.76);
      ctx.stroke();

      ctx.fillStyle = TC.gkRim;
      ctx.beginPath();
      ctx.roundRect?.(-KR * 0.52, -KR * 0.02, KR * 1.04, KR * 0.34, KR * 0.12);
      if (!ctx.roundRect) ctx.rect(-KR * 0.52, -KR * 0.02, KR * 1.04, KR * 0.34);
      ctx.fill();

      const spread = K ? K.spread : 1;
      const armUp = K ? K.armUp : 0;
      const reach = KR * (0.62 + diveN * 0.85) * (0.55 + spread * 0.45);
      const armY = -KR * 0.28 - armUp * diveN * KR * 0.85;
      ctx.strokeStyle = SKIN;
      ctx.lineWidth = Math.max(1.1, KR * 0.24);
      const gloves: { x: number; y: number }[] = [];
      for (const s2 of [-1, 1]) {
        const leading = sign === 0 || Math.sign(s2) === sign;
        const ex2 = s2 * reach * (leading ? 1 : 0.62);
        const ey2 = armY - (leading ? diveN * KR * 0.2 : 0);
        ctx.beginPath();
        ctx.moveTo(s2 * KR * 0.32, -KR * 0.28);
        ctx.lineTo(ex2, ey2);
        ctx.stroke();
        gloves.push({ x: ex2, y: ey2 });
      }

      ctx.fillStyle = TC.gk;
      ctx.beginPath();
      ctx.roundRect?.(-KR * 0.56, -KR * 0.50, KR * 1.12, KR * 0.58, KR * 0.15);
      if (!ctx.roundRect) ctx.rect(-KR * 0.56, -KR * 0.50, KR * 1.12, KR * 0.58);
      ctx.fill();
      ctx.lineWidth = Math.max(1, KR * 0.11);
      ctx.strokeStyle = TC.gkRim;
      ctx.stroke();

      ctx.fillStyle = "#f8fafc";
      ctx.strokeStyle = TC.gkRim;
      ctx.lineWidth = Math.max(1, KR * 0.09);
      for (const g of gloves) {
        ctx.beginPath();
        ctx.arc(g.x, g.y, gloveR, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(0, -KR * 0.70, KR * 0.28, 0, Math.PI * 2);
      ctx.fillStyle = SKIN;
      ctx.fill();
      ctx.lineWidth = Math.max(1, KR * 0.09);
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.stroke();

      ctx.restore();
    }

    // ── The ball ──
    const b = ballRef.current;
    const bx = b ? px(b.pos.x) : px(sc.ball.x);
    const by = b ? py(b.pos.y) : py(sc.ball.y);
    const lift = b ? Math.max(0, b.z) : 0;
    // Height reads as size plus a shadow that stays on the grass. Same
    // baseline factor CanvasMatch.tsx's own BALL_PX uses for a real match
    // ball (unit * 0.5) — this used to be unit * 0.286 (BALL_R * 2.6), a
    // visibly smaller ball than the one you actually play with, reported
    // directly as confusing on a screen whose whole point is to teach the
    // real game's mechanics.
    //
    // Reported twice, the second time after a first attempt that only capped
    // how HIGH the growth term could read (at 2.5m) rather than how STEEP
    // it was: this screen's own coefficient (0.16, capped at 2.5m — max
    // +40%) was three times steeper than the real match's own drawBall
    // (0.055, capped at 8m — also +44%, but hardly ever reached, since most
    // shots never climb anywhere near 8m). A perfectly ordinary penalty —
    // apex well under the old 2.5m cap — was still visibly ballooning,
    // because the STEEP coefficient did the damage long before the cap ever
    // engaged. Matched to the real match's own numbers exactly rather than
    // re-tuning a second set from scratch: same +5.5%-per-metre rate, same
    // 8m ceiling, so a shot looks the same height cue here as it does in a
    // real match instead of a more dramatic, screen-specific one.
    const br = Math.max(4.5, unit * 0.5 * (1 + Math.min(lift, 8) * 0.055));
    ctx.fillStyle = "rgba(0,0,0,0.32)";
    ctx.beginPath();
    ctx.ellipse(bx, by, br * 0.95, br * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    const drawnY = by - lift * sy * 0.55;
    const ballImg = ballImgRef.current;
    if (ballImg && ballImg.complete && ballImg.naturalWidth > 0) {
      ctx.drawImage(ballImg, bx - br, drawnY - br, br * 2, br * 2);
    } else {
      ctx.fillStyle = "#ffffff";
      ctx.beginPath(); ctx.arc(bx, drawnY, br, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.45)";
      ctx.lineWidth = Math.max(1, br * 0.16);
      ctx.stroke();
    }

    // ── The aim arrow — solid tapered gold/orange shaft into a triangular
    // head, plus a vertical power meter, the same as a real match's own
    // aim UI (CanvasMatch.tsx). ──
    if (phaseRef.current === "aim" && draggingRef.current && dragRef.current) {
      const d = dragRef.current;
      const power = powerFrom(d, sc.ball, vp);
      const dx = sc.ball.x - d.x, dy = sc.ball.y - d.y;
      const len = Math.hypot(dx, dy) || 1;
      // Same lengths/thickness as CanvasMatch.tsx's real in-match arrow —
      // this one never got the "half the previous length" pass that arrow
      // did, so it used to draw ~2.7x longer and ~2x thicker than what you
      // actually see once you're playing for real.
      const shown = power * (vp.y2 - vp.y1) * 0.11;
      const ax = px(sc.ball.x), ay = py(sc.ball.y);
      const bx2 = px(sc.ball.x + (dx / len) * shown);
      const by2 = py(sc.ball.y + (dy / len) * shown);

      const ang = Math.atan2(by2 - ay, bx2 - ax);
      const ux = Math.cos(ang), uy = Math.sin(ang);
      const nx = -uy, ny = ux;
      const arrowLen = Math.hypot(bx2 - ax, by2 - ay) || 1;
      const headLen = clamp(W * 0.045, W * 0.02, arrowLen * 0.45);
      const headHalf = W * 0.022;
      const shaftW = W * 0.014;
      const hbx = bx2 - ux * headLen, hby = by2 - uy * headLen;

      const shaftGrad = ctx.createLinearGradient(ax, ay, bx2, by2);
      shaftGrad.addColorStop(0, "#fb923c");
      shaftGrad.addColorStop(1, "#ea580c");
      ctx.strokeStyle = shaftGrad;
      ctx.lineWidth = shaftW;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(hbx, hby);
      ctx.stroke();
      ctx.lineCap = "butt";

      ctx.beginPath();
      ctx.moveTo(bx2, by2);
      ctx.lineTo(hbx + nx * headHalf, hby + ny * headHalf);
      ctx.lineTo(hbx - nx * headHalf, hby - ny * headHalf);
      ctx.closePath();
      ctx.fillStyle = "#f97316";
      ctx.fill();
      ctx.lineJoin = "round";
      ctx.lineWidth = Math.max(1, unit * 0.22);
      ctx.strokeStyle = "rgba(124,45,18,0.6)";
      ctx.stroke();

      // Power meter, left edge.
      const meterX = W * 0.045, meterTop = H * 0.15, meterH = H * 0.7, meterW = W * 0.055;
      ctx.fillStyle = "rgba(2,6,23,0.55)";
      ctx.fillRect(meterX, meterTop, meterW, meterH);
      const fillH = meterH * power;
      const grad = ctx.createLinearGradient(0, meterTop + meterH, 0, meterTop);
      grad.addColorStop(0, "#22c55e"); grad.addColorStop(0.6, "#eab308"); grad.addColorStop(1, "#ef4444");
      ctx.fillStyle = grad;
      ctx.fillRect(meterX, meterTop + meterH - fillH, meterW, fillH);
      ctx.strokeStyle = "rgba(251,191,36,0.5)";
      ctx.lineWidth = 1;
      ctx.strokeRect(meterX, meterTop, meterW, meterH);
      ctx.fillStyle = TC.goldSoft;
      ctx.font = `bold ${Math.round(W * 0.05)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(`${Math.round(power * 100)}%`, meterX + meterW / 2, meterTop - W * 0.022);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center px-3 py-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-3">
          <div className="inline-block px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 text-[10px] font-black tracking-widest uppercase">
            The Trial
          </div>
          <h1 className="mt-2 text-xl font-black tracking-tight">Score to earn your contract</h1>
          <p className="mt-1 text-xs text-white/60">
            Drag back from the ball to aim and set power, then pick your spot on the ball.
          </p>
        </div>

        <div
          ref={wrapRef}
          className="relative w-full overflow-hidden rounded-xl border border-white/15"
          style={{ aspectRatio: "5 / 8" }}
        >
          <canvas
            ref={canvasRef}
            className="absolute inset-0 h-full w-full touch-none"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          />

          {/* A tip in the one part of this screen a drag never actually
              reaches — full power only ever needs FULL_POWER_PULL (16%) of
              the canvas's own height, so the bottom strip stays clear no
              matter how the pull is aimed. `pointer-events-none` besides,
              so it can never intercept a drag even if that assumption ever
              stops holding. This is a career's very first screen — the one
              moment a player genuinely might not know the mechanic yet. */}
          {phase === "aim" && (
            <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex justify-center px-4">
              <p className="rounded-lg bg-black/55 px-3 py-1.5 text-center text-[11px] font-bold text-white/85">
                Drag back from the ball to aim, and pull further for more power.
              </p>
            </div>
          )}

          {phase === "contact" && aim && (
            <ContactBall power={aim.power} onContact={handleContact} tutorial />
          )}

          {phase === "missed" && missText && (
            <div className="absolute inset-0 z-40 grid place-items-center bg-black/55">
              <div className="text-center">
                <div className="text-2xl font-black text-amber-300">{missText}</div>
                <div className="mt-1 text-sm font-bold text-white/75">Go again.</div>
              </div>
            </div>
          )}
        </div>

        {attempts > 0 && (
          <div className="mt-3 text-center text-[11px] font-bold text-white/45">
            {attempts} {attempts === 1 ? "attempt" : "attempts"} — take as many as you need.
          </div>
        )}
      </div>
    </div>
  );
}

/** What to say when it stays out. Never a failure — only a "not yet". */
const MISS_LINE: Partial<Record<Outcome, string>> = {
  saved: "Saved!",
  tipped: "Tipped away!",
  caught: "Caught!",
  wide: "Wide!",
  over: "Over the bar!",
  post: "Off the post!",
  short: "Not enough on it.",
  blocked: "Blocked!",
  tackled: "Blocked!",
  offside: "Retake.",
};
