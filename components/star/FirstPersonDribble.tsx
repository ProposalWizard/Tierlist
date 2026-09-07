"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  newRun, applySteer, applyBurst, stepRun,
  type FpRunState, type RunPhase,
} from "@/lib/star/firstPersonDribble";
import { cameraFor } from "@/lib/star/firstPersonView";
import { renderFirstPerson, type DuelPip } from "@/lib/star/firstPersonRender";
import { mulberry32 } from "@/lib/star/season";

/**
 * THE ONE-ON-ONE DUEL — THE COMPONENT.
 *
 * Beat the three men you're given; that's it. Told directly after the
 * first version of this shipped with a shot at the end: "you just need to
 * beat the men that you are given, and you're not even running towards a
 * goal... it should just be to more space." So there is no shot here, no
 * goal anywhere in the drawing (see firstPersonRender.ts's own header) —
 * clearing the third man IS the win.
 *
 * Structural template: `TrialPenalty.tsx` — a canvas ref, a single rAF
 * loop, pointer capture, the same "reset() called at start and after
 * every attempt" shape.
 *
 * ── Third person, playtested and revised from a true first-person build ──
 *
 * Reported directly, after actually playing the eyes-level version: "I'm
 * thinking maybe it's too difficult from that point of view... maybe we
 * could... have it as like a third person camera angle just behind their
 * head so you can see what's in front of you still." True first-person
 * has a real, structural problem for THIS mechanic specifically (it's
 * fine for the open-run mode, which only ever asks "which general
 * direction"): the whole duel is decided on one exact number — how far
 * left or right he's committed versus you, at the moment he reaches you —
 * and a flat, ground-level, dead-ahead view genuinely cannot show that
 * distance with any precision. There's no depth cue for it. A camera
 * sitting a few metres behind and above you, tilted down, can — you see
 * your own lane and his as two actual lanes with a gap between them, not
 * an inferred one.
 *
 * This costs almost nothing to build: `firstPersonView.ts`'s camera
 * already supports an arbitrary elevated, tilted position (that's exactly
 * what the establishing-shot swoop already used) — a chase-cam is just
 * "sit the camera a bit behind and above your ACTUAL position" instead of
 * "sit it exactly at your eyes," via `CHASE_OFFSET`/`CHASE_EYE`/
 * `CHASE_PITCH` below. It deliberately still doesn't rotate to face
 * anything — same reasoning as the open-run mode's own camera fix, and
 * doubly true for a trailing chase-cam, which is the standard way this
 * kind of camera behaves in every genre that uses one.
 *
 * The one thing a first-person view got for free that a third-person one
 * doesn't: your own body was never drawn, because there was no world
 * position for it — just decorative forearms at the screen edge. Now
 * there is a real body to draw, in "you" green, using the exact same
 * `drawFigure()` every defender already renders with (see
 * `firstPersonRender.ts`'s `own` option).
 *
 * ── Touches, not just a drag — the feint the defender AI already reads ──
 *
 * Reported alongside the camera: "instead of actually moving left and
 * right, it's more like you're touching the ball left and right... push
 * it right a bit, and then straight away go left... which would bait the
 * defender." The duel's own AI already reads your lateral drift the
 * instant his telegraph starts (`pickSide` in firstPersonDribble.ts) —
 * drift right and he commits right, whatever caused that drift. So this
 * needed no new simulation, only an input that makes the bait a
 * deliberate, felt choice instead of an invisible side effect of a drag:
 * a quick, small tap on either side of the screen now nudges your lane
 * that way by a fixed amount (`TAP_NUDGE`) — "touch the ball right," then
 * a second quick tap left immediately after genuinely sells one way and
 * cuts the other, because each tap sets an absolute lane target and the
 * SECOND one is measured from wherever the first has actually gotten you
 * to, not from your original spot. A real drag (more movement, or held
 * longer) still steers continuously exactly as before, and a flick still
 * bursts — taps are additive on top of both, not a replacement mode you
 * have to switch into.
 */

type Phase = "run" | "result";

const DT_CAP = 0.05;
const BALL_LEAD = 1.7; // see firstPersonView.ts's header — the depth that
                        // keeps the ball on-screen at a natural size.
const BALL_LEAD_BURST = 2.6;
const FLICK_MIN_PX_FRAC = 0.06;   // of canvas width
const FLICK_MIN_SPEED_FRAC = 1.6; // canvas-widths per second

// ── The chase-cam — see the file header on why this replaced eyes-level.
// Defaults chosen to see both lanes and the gap between them clearly
// without floating so far back the duel stops feeling close; exposed as
// props so the dev sandbox can tune them live (no browser this session).
const DEFAULT_CHASE_EYE = 4.5;      // metres — how high the camera sits
const DEFAULT_CHASE_PITCH_DEG = 22; // degrees — how far down it tilts
const DEFAULT_CHASE_OFFSET = 4.5;   // metres BEHIND your actual position

// ── A tap, not a drag — see the file header. Small movement, short
// duration, released without ever crossing the flick thresholds above.
const TAP_MAX_MOVE_FRAC = 0.035; // of canvas width — below this, it's a tap
const TAP_MAX_MS = 280;
const TAP_NUDGE = 1.8; // metres your lane target jumps per tap

export interface FirstPersonDribbleProps {
  pace?: number;
  oppStrength?: number;
  defenders?: number;
  /** Chase-cam tuning — see DEFAULT_CHASE_* above for the reasoning behind
   *  the defaults. */
  chaseEye?: number;
  chasePitchDeg?: number;
  chaseOffset?: number;
  /** A fixed seed replays the exact same run every time (for tuning);
   *  omit it for a fresh random run on every attempt. */
  seed?: number;
  assist?: boolean;
  onComplete?: (result: { cleared: boolean }) => void;
}

export default function FirstPersonDribble({
  pace = 60, oppStrength = 55, defenders = 3, seed, assist = true, onComplete,
  chaseEye = DEFAULT_CHASE_EYE, chasePitchDeg = DEFAULT_CHASE_PITCH_DEG, chaseOffset = DEFAULT_CHASE_OFFSET,
}: FirstPersonDribbleProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const runRef = useRef<FpRunState | null>(null);
  const ballImgRef = useRef<HTMLImageElement | null>(null);
  const rngRef = useRef<() => number>(() => Math.random());
  const reducedMotionRef = useRef(false);

  const phaseRef = useRef<Phase>("run");
  const [phase, setPhaseState] = useState<Phase>("run");
  const setPhase = (p: Phase) => { phaseRef.current = p; setPhaseState(p); };

  const [resultText, setResultText] = useState("");

  // Gesture bookkeeping — steer via relative drag, burst via a flick
  // detected mid-drag (velocity, not release), and a tap-nudge decided on
  // release once we know the whole gesture never grew into either — see
  // the file header on why taps are additive, not a separate mode.
  const draggingRef = useRef(false);
  const anchorPxRef = useRef(0);
  const anchorLaneRef = useRef(0);
  const sampleRef = useRef<{ x: number; t: number }[]>([]);
  const gestureStartRef = useRef<{ x: number; y: number; t: number } | null>(null);

  useEffect(() => {
    const img = new Image();
    img.src = "/star/ball.png";
    ballImgRef.current = img;
  }, []);

  useEffect(() => {
    try {
      reducedMotionRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch { /* ignore */ }
  }, []);

  const newRng = useCallback(() => (
    seed !== undefined ? mulberry32(seed) : mulberry32((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0)
  ), [seed]);

  const reset = useCallback(() => {
    const rng = newRng();
    rngRef.current = rng;
    runRef.current = newRun({ pace, oppStrength, defenders, rng });
    draggingRef.current = false;
    gestureStartRef.current = null;
    setResultText("");
    setPhase("run");
  }, [pace, oppStrength, defenders, newRng]);

  useEffect(() => { reset(); }, [reset]);

  // ── Canvas sizing — raw backing-store pixels, no separate DPR transform:
  // firstPersonView's project() already produces true pixel coordinates,
  // so canvas.width/height ARE the camera's W/H directly. ──
  useEffect(() => {
    const c = canvasRef.current, wrap = wrapRef.current;
    if (!c || !wrap) return;
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.max(1, Math.round(wrap.clientWidth * dpr));
      const h = Math.max(1, Math.round(wrap.clientHeight * dpr));
      if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  // ── Pointer input ──────────────────────────────────────────────────────
  const onPointerDown = (e: React.PointerEvent) => {
    const c = canvasRef.current;
    if (!c || phaseRef.current !== "run") return;
    try { c.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    draggingRef.current = true;
    anchorPxRef.current = e.clientX;
    anchorLaneRef.current = runRef.current?.laneTarget ?? runRef.current?.x ?? 0;
    sampleRef.current = [{ x: e.clientX, t: performance.now() }];
    gestureStartRef.current = { x: e.clientX, y: e.clientY, t: performance.now() };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const c = canvasRef.current;
    const run = runRef.current;
    if (!c || !run || phaseRef.current !== "run" || !draggingRef.current) return;
    const r = c.getBoundingClientRect();
    const perPx = (run.maxX - run.minX) / Math.max(1, r.width * 0.8);
    applySteer(run, anchorLaneRef.current + (e.clientX - anchorPxRef.current) * perPx);

    const now = performance.now();
    const samples = sampleRef.current;
    samples.push({ x: e.clientX, t: now });
    while (samples.length > 1 && now - samples[0].t > 150) samples.shift();
    const oldest = samples[0];
    const dtMs = now - oldest.t;
    if (dtMs > 20) {
      const vx = (e.clientX - oldest.x) / (dtMs / 1000); // px/s
      const dxPx = Math.abs(e.clientX - oldest.x);
      if (Math.abs(vx) >= FLICK_MIN_SPEED_FRAC * r.width && dxPx >= FLICK_MIN_PX_FRAC * r.width) {
        const fired = applyBurst(run, vx > 0 ? 1 : -1);
        if (fired) {
          anchorPxRef.current = e.clientX;
          anchorLaneRef.current = run.laneTarget;
          sampleRef.current = [{ x: e.clientX, t: now }];
        }
      }
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const c = canvasRef.current;
    const run = runRef.current;
    try { c?.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    draggingRef.current = false;

    // ── Tap-nudge: touch the ball left or right ──
    //
    // Decided here, on release, once we know the gesture never grew into a
    // drag or a flick — see the file header. A tap on the left half of the
    // screen nudges your lane target left by TAP_NUDGE, right nudges right;
    // additive on top of whatever the continuous drag-steer above already
    // did during the same brief hold (negligible for a real tap, since it
    // barely moved).
    const start = gestureStartRef.current;
    gestureStartRef.current = null;
    if (!c || !run || !start || phaseRef.current !== "run") return;
    const r = c.getBoundingClientRect();
    if (r.width <= 0) return;
    const moved = Math.hypot(e.clientX - start.x, e.clientY - start.y);
    const heldMs = performance.now() - start.t;
    if (moved > TAP_MAX_MOVE_FRAC * r.width || heldMs > TAP_MAX_MS) return;
    const dir = (start.x - r.left) < r.width / 2 ? -1 : 1;
    applySteer(run, run.laneTarget + TAP_NUDGE * dir);
  };

  // ── Keyboard fallback ────────────────────────────────────────────────────
  useEffect(() => {
    const held = new Set<string>();
    const KEY_STEER = 6; // m/s while held
    const onDown = (e: KeyboardEvent) => {
      if (phaseRef.current !== "run") return;
      const run = runRef.current;
      if (!run) return;
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") held.add(e.key);
      if (e.shiftKey && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        applyBurst(run, e.key === "ArrowLeft" ? -1 : 1);
      }
    };
    const onUp = (e: KeyboardEvent) => held.delete(e.key);
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    const id = window.setInterval(() => {
      const run = runRef.current;
      if (!run || phaseRef.current !== "run") return;
      if (held.has("ArrowLeft")) applySteer(run, run.laneTarget - KEY_STEER * 0.05);
      if (held.has("ArrowRight")) applySteer(run, run.laneTarget + KEY_STEER * 0.05);
    }, 50);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.clearInterval(id);
    };
  }, []);

  // ── The loop ───────────────────────────────────────────────────────────
  useEffect(() => {
    let raf: number;
    let last = performance.now();

    const finishRun = (finalPhase: RunPhase) => {
      const run = runRef.current;
      if (finalPhase === "clear") {
        setResultText("Clear! Beat all three.");
      } else {
        const label = run?.lostTo != null ? `Beaten by man ${run.lostTo + 1}` : "Ran out of time";
        setResultText(label);
      }
      setPhase("result");
      onComplete?.({ cleared: finalPhase === "clear" });
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(DT_CAP, (now - last) / 1000);
      last = now;
      const run = runRef.current;

      if (phaseRef.current === "run" && run) {
        const result = stepRun(run, dt);
        if (result !== "running") finishRun(result);
      }

      draw();
    };

    const draw = () => {
      const c = canvasRef.current, run = runRef.current;
      if (!c || !run) return;
      // Chase-cam: sits CHASE_OFFSET metres behind your actual position
      // (larger y — the corridor runs toward y=0), elevated and tilted
      // down. See the file header on why this replaced a camera sitting
      // exactly at your own eyes.
      const cam = cameraFor(
        { x: run.x, y: run.y + chaseOffset }, c.width, c.height,
        { eye: chaseEye, pitch: (chasePitchDeg * Math.PI) / 180 },
      );
      const pips: DuelPip[] = run.defenders.map((d, i) => (
        d.phase === "beaten" ? "beaten" : d.phase === "won" ? "won" : i === run.active ? "active" : "pending"
      ));
      const burstLead = run.burst ? Math.min(1, run.burst.t / 0.35) : 0;
      const leadDepth = BALL_LEAD + (BALL_LEAD_BURST - BALL_LEAD) * burstLead;
      const lateral = run.burst ? run.burst.dir * 0.9 * burstLead : 0;
      const beaten = run.defenders.filter(d => d.phase === "beaten").length;

      renderFirstPerson(c, {
        cam, defenders: run.defenders, stride: run.stride,
        minX: run.minX, maxX: run.maxX,
        ball: { x: run.x + lateral, y: run.y - leadDepth, z: 0 },
        ballImage: ballImgRef.current,
        assist, reducedMotion: reducedMotionRef.current,
        hud: { text: `${beaten}/${run.defenders.length} beaten`, pips },
        own: { x: run.x, y: run.y },
      });
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assist, onComplete, chaseEye, chasePitchDeg, chaseOffset]);

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center px-3 py-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-3">
          <div className="inline-block px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 text-[10px] font-black tracking-widest uppercase">
            First-Person Dribble
          </div>
          <h1 className="mt-2 text-xl font-black tracking-tight">Beat your man</h1>
        </div>

        <div
          ref={wrapRef}
          className="relative w-full overflow-hidden rounded-xl border border-white/15 touch-none select-none"
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

          {phase === "run" && (
            <div className="pointer-events-none absolute inset-x-0 bottom-2 z-20 flex flex-col items-center gap-1 px-4">
              <p className="rounded-lg bg-black/55 px-3 py-1 text-center text-[10px] font-bold text-white/80">
                Tap left or right to touch the ball that way. Flick to burst past him.
              </p>
            </div>
          )}

          {phase === "result" && (
            <div className="absolute inset-0 z-40 grid place-items-center bg-black/60">
              <div className="text-center px-4">
                <div className="text-2xl font-black text-amber-300">{resultText}</div>
                <button
                  onClick={reset}
                  className="mt-4 rounded-lg bg-emerald-500 px-5 py-2 text-sm font-black text-emerald-950 active:scale-95"
                >
                  Go Again
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
