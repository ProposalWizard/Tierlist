"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  newRun, applySteer, applyBurst, stepRun,
  type FpRunState, type RunPhase,
} from "@/lib/star/firstPersonDribble";
import { cameraFor, aimOnPlane } from "@/lib/star/firstPersonView";
import { renderFirstPerson, type DuelPip } from "@/lib/star/firstPersonRender";
import {
  buildScenario, launch, stepBall, stepKeeper, stepBallInNet,
  type Ball, type Scenario, type Outcome,
} from "@/lib/star/canvasEngine";
import { PITCH_W, BOX_DEPTH, CX } from "@/lib/star/pitch";
import { mulberry32 } from "@/lib/star/season";

/**
 * THE FIRST-PERSON DRIBBLE — THE COMPONENT.
 *
 * Structural template: `TrialPenalty.tsx` — a canvas ref, a single rAF
 * loop, pointer capture, and the same "reset() called at start and after
 * every attempt" shape. What's different is entirely in the input scheme
 * (steer is a continuous relative drag, a burst is a FLICK detected mid-
 * drag rather than on release — waiting for release would eat the exact
 * reaction window `firstPersonDribble.ts` is built around) and the final
 * beat, which hands off to the real engine for the shot (`buildScenario`,
 * `launch`, `stepBall`, `stepKeeper` — the same functions a real match
 * uses) rather than doing anything of its own.
 */

type Phase = "run" | "chance" | "aim" | "flight" | "result";

const DT_CAP = 0.05;
const BALL_LEAD = 1.7;      // see firstPersonView.ts's header — the depth
                             // that keeps the ball on-screen at a natural size.
const BALL_LEAD_BURST = 2.6;
const CHANCE_ADVANCE = 4;   // metres of the "keep running" beat after clear
const CHANCE_SPEED = 4;
const MIN_PULL = 0.05;
const FULL_POWER_PULL = 0.22; // fraction of canvas height for full power
const AIM_GAIN = 3.2;
const FLICK_MIN_PX_FRAC = 0.06;   // of canvas width
const FLICK_MIN_SPEED_FRAC = 1.6; // canvas-widths per second

const RESULT_LABEL: Partial<Record<Outcome, string>> = {
  goal: "Scored!", rebound: "Scored!",
  saved: "Saved.", tipped: "Tipped away.", caught: "Caught.",
  wide: "Wide.", over: "Over the bar.", post: "Off the post.",
  blocked: "Blocked.", short: "Not enough on it.",
};

export interface FirstPersonDribbleProps {
  pace?: number;
  technique?: number;
  power?: number;
  oppStrength?: number;
  keeperStrength?: number;
  defenders?: number;
  /** A fixed seed replays the exact same run every time (for tuning);
   *  omit it for a fresh random run on every attempt. */
  seed?: number;
  assist?: boolean;
  onComplete?: (result: { cleared: boolean; scored: boolean }) => void;
}

export default function FirstPersonDribble({
  pace = 60, technique = 62, power = 62, oppStrength = 55, keeperStrength = 55,
  defenders = 3, seed, assist = true, onComplete,
}: FirstPersonDribbleProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const runRef = useRef<FpRunState | null>(null);
  const scRef = useRef<Scenario | null>(null);
  const ballRef = useRef<Ball | null>(null);
  const ballImgRef = useRef<HTMLImageElement | null>(null);
  const rngRef = useRef<() => number>(() => Math.random());
  const shotOriginRef = useRef({ x: CX, y: 40 });
  const teammateRef = useRef<{ x: number; y: number }>({ x: CX, y: 30 });
  const chanceElapsedRef = useRef(0);
  const outcomeRef = useRef<Outcome | null>(null);
  const settleRef = useRef(0);
  const reducedMotionRef = useRef(false);

  const phaseRef = useRef<Phase>("run");
  const [phase, setPhaseState] = useState<Phase>("run");
  const setPhase = (p: Phase) => { phaseRef.current = p; setPhaseState(p); };

  const [resultText, setResultText] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [aimTargetUi, setAimTargetUi] = useState<{ x: number; z: number } | null>(null);

  // Gesture bookkeeping — steer via relative drag, burst via a flick
  // detected mid-drag (velocity, not release).
  const draggingRef = useRef(false);
  const anchorPxRef = useRef(0);
  const anchorLaneRef = useRef(0);
  const sampleRef = useRef<{ x: number; t: number }[]>([]);
  // Aim-phase drag (screen-space, absolute).
  const aimDragRef = useRef<{ x: number; y: number } | null>(null);

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
    scRef.current = null;
    ballRef.current = null;
    outcomeRef.current = null;
    settleRef.current = 0;
    chanceElapsedRef.current = 0;
    draggingRef.current = false;
    aimDragRef.current = null;
    setAimTargetUi(null);
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

  // ── Entering the "clear" beat: keep running a little further, slower,
  // with a team-mate now in the picture — then line up the shot. ──
  const enterChance = () => {
    const run = runRef.current;
    if (!run) return;
    const side: 1 | -1 = run.x < CX ? 1 : -1;
    teammateRef.current = { x: run.x + side * 5.5, y: Math.max(4, run.y - 4) };
    chanceElapsedRef.current = 0;
    setPhase("chance");
  };

  const enterAim = () => {
    const run = runRef.current;
    if (!run) return;
    shotOriginRef.current = { x: run.x, y: run.y };
    const rng = rngRef.current;
    const sc = buildScenario("one_on_one", rng, keeperStrength, 60, 55);
    sc.ball = { x: run.x, y: run.y };
    sc.player = { x: run.x, y: run.y };
    // Wide on purpose — stepBall/the loose-ball chase both test
    // scenario.viewport for "out of frame"; a tight one would wrongly
    // call the shot out mid-flight (see canvasEngine.ts ~L3787/~L4737).
    sc.viewport = { x1: 0, x2: PITCH_W, y1: -6, y2: run.y + 6 };
    scRef.current = sc;
    setPhase("aim");
  };

  const targetPowerRef = useRef(0.6);

  const handleShoot = (targetPx: { x: number; y: number }) => {
    const sc = scRef.current;
    if (!sc) return;
    const cam = cameraFor(runRef.current!, canvasRef.current!.width, canvasRef.current!.height);
    // Reproject with the SHOT ORIGIN's own y as the camera depth (frozen —
    // you aren't moving any more), matching the camera used while drawing.
    cam.x = shotOriginRef.current.x; cam.y = shotOriginRef.current.y;
    const aim = aimOnPlane(cam, targetPx.x, targetPx.y, 0);
    if (!aim) return;
    const origin = shotOriginRef.current;
    const dx = aim.x - origin.x, dy = 0 - origin.y;
    const len = Math.hypot(dx, dy) || 1;
    const dir = { x: dx / len, y: dy / len };
    ballRef.current = launch(
      sc, dir, targetPowerRef.current, { cx: 0, cy: 0.2 },
      { power, technique }, rngRef.current,
    );
    setPhase("flight");
  };

  // ── Pointer input ──────────────────────────────────────────────────────
  const onPointerDown = (e: React.PointerEvent) => {
    const c = canvasRef.current;
    if (!c) return;
    try { c.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    if (phaseRef.current === "run") {
      draggingRef.current = true;
      anchorPxRef.current = e.clientX;
      anchorLaneRef.current = runRef.current?.laneTarget ?? runRef.current?.x ?? CX;
      sampleRef.current = [{ x: e.clientX, t: performance.now() }];
    } else if (phaseRef.current === "aim") {
      const r = c.getBoundingClientRect();
      aimDragRef.current = {
        x: (e.clientX - r.left) / r.width * c.width,
        y: (e.clientY - r.top) / r.height * c.height,
      };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const c = canvasRef.current;
    const run = runRef.current;
    if (!c) return;
    if (phaseRef.current === "run" && draggingRef.current && run) {
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
    } else if (phaseRef.current === "aim" && aimDragRef.current) {
      const r = c.getBoundingClientRect();
      aimDragRef.current = {
        x: (e.clientX - r.left) / r.width * c.width,
        y: (e.clientY - r.top) / r.height * c.height,
      };
      updateAimPreview();
    }
  };

  const updateAimPreview = () => {
    const c = canvasRef.current, drag = aimDragRef.current;
    if (!c || !drag) return;
    const ballPx = { x: c.width / 2, y: c.height * 0.88 };
    const dx = ballPx.x - drag.x, dy = ballPx.y - drag.y;
    const pullFrac = Math.hypot(dx, dy) / c.height;
    if (pullFrac < MIN_PULL) { setAimTargetUi(null); return; }
    targetPowerRef.current = Math.min(1, pullFrac / FULL_POWER_PULL);
    const A = { x: ballPx.x + dx * AIM_GAIN, y: ballPx.y + dy * AIM_GAIN };
    const cam = cameraFor(runRef.current!, c.width, c.height);
    cam.x = shotOriginRef.current.x; cam.y = shotOriginRef.current.y;
    const aim = aimOnPlane(cam, A.x, A.y, 0);
    setAimTargetUi(aim);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const c = canvasRef.current;
    try { c?.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    if (phaseRef.current === "run") {
      draggingRef.current = false;
    } else if (phaseRef.current === "aim") {
      const drag = aimDragRef.current;
      aimDragRef.current = null;
      if (!drag || !c) return;
      const ballPx = { x: c.width / 2, y: c.height * 0.88 };
      const dx = ballPx.x - drag.x, dy = ballPx.y - drag.y;
      const pullFrac = Math.hypot(dx, dy) / c.height;
      if (pullFrac < MIN_PULL) { setAimTargetUi(null); return; }
      const A = { x: ballPx.x + dx * AIM_GAIN, y: ballPx.y + dy * AIM_GAIN };
      setAimTargetUi(null);
      handleShoot(A);
    }
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
      if (finalPhase === "clear") {
        enterChance();
      } else {
        const run = runRef.current;
        const label = run?.lostTo != null ? `Beaten by man ${run.lostTo + 1}` : "Ran out of time";
        setResultText(label);
        setPhase("result");
        onComplete?.({ cleared: false, scored: false });
      }
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(DT_CAP, (now - last) / 1000);
      last = now;
      const run = runRef.current;

      if (phaseRef.current === "run" && run) {
        const result = stepRun(run, dt);
        if (result !== "running") finishRun(result);
      } else if (phaseRef.current === "chance" && run) {
        run.y -= CHANCE_SPEED * dt;
        run.stride += CHANCE_SPEED * dt;
        chanceElapsedRef.current += dt;
        if (chanceElapsedRef.current > 1.4 || run.y <= run.clearY - CHANCE_ADVANCE) {
          enterAim();
        }
      } else if (phaseRef.current === "flight") {
        const sc = scRef.current, ball = ballRef.current;
        if (sc && ball) {
          if (ball.inNet) {
            stepBallInNet(ball, dt);
          } else if (!outcomeRef.current) {
            stepKeeper(sc, dt);
            const res = stepBall(ball, sc, rngRef.current, dt);
            if (res) { outcomeRef.current = res; settleRef.current = 0; }
          }
          if (outcomeRef.current) {
            settleRef.current += dt;
            if (settleRef.current > 1.1 && phaseRef.current === "flight") {
              const res = outcomeRef.current;
              const scored = res === "goal" || res === "rebound";
              setResultText(RESULT_LABEL[res] ?? "Not this time.");
              setAttempts(a => a + 1);
              setPhase("result");
              onComplete?.({ cleared: true, scored });
            }
          }
        }
      }

      draw();
    };

    const draw = () => {
      const c = canvasRef.current, run = runRef.current;
      if (!c || !run) return;
      const cam = cameraFor(run, c.width, c.height);
      const pips: DuelPip[] = run.defenders.map((d, i) => (
        d.phase === "beaten" ? "beaten" : d.phase === "won" ? "won" : i === run.active ? "active" : "pending"
      ));

      if (phaseRef.current === "run") {
        const burstLead = run.burst ? Math.min(1, run.burst.t / 0.35) : 0;
        const leadDepth = BALL_LEAD + (BALL_LEAD_BURST - BALL_LEAD) * burstLead;
        const lateral = run.burst ? run.burst.dir * 0.9 * burstLead : 0;
        renderFirstPerson(c, {
          cam, defenders: run.defenders, stride: run.stride,
          minX: run.minX, maxX: run.maxX,
          ball: { x: run.x + lateral, y: run.y - leadDepth, z: 0 },
          ballImage: ballImgRef.current,
          assist, reducedMotion: reducedMotionRef.current,
          hud: { metresToBox: run.y - BOX_DEPTH, pips },
        });
      } else if (phaseRef.current === "chance") {
        renderFirstPerson(c, {
          cam, defenders: [], stride: run.stride,
          minX: run.minX, maxX: run.maxX,
          ball: { x: run.x, y: run.y - BALL_LEAD, z: 0 },
          ballImage: ballImgRef.current,
          teammate: teammateRef.current,
          assist, reducedMotion: reducedMotionRef.current,
          hud: { metresToBox: run.y - BOX_DEPTH, pips },
        });
      } else if (phaseRef.current === "aim") {
        const frozenCam = { ...cam, x: shotOriginRef.current.x, y: shotOriginRef.current.y };
        renderFirstPerson(c, {
          cam: frozenCam, defenders: [], stride: run.stride,
          minX: run.minX, maxX: run.maxX,
          ball: { x: shotOriginRef.current.x, y: shotOriginRef.current.y - BALL_LEAD, z: 0 },
          ballImage: ballImgRef.current,
          teammate: teammateRef.current,
          keeper: scRef.current ? { x: scRef.current.keeper.x, y: scRef.current.keeper.y } : null,
          aimTarget: aimTargetUi,
          assist, reducedMotion: true,
          hud: null,
        });
      } else if (phaseRef.current === "flight") {
        const sc = scRef.current, ball = ballRef.current;
        const frozenCam = { ...cam, x: shotOriginRef.current.x, y: shotOriginRef.current.y };
        renderFirstPerson(c, {
          cam: frozenCam, defenders: [], stride: run.stride,
          minX: run.minX, maxX: run.maxX,
          ball: ball ? { x: ball.pos.x, y: ball.pos.y, z: ball.z } : null,
          ballImage: ballImgRef.current,
          keeper: sc ? { x: sc.keeper.x, y: sc.keeper.y } : null,
          assist: false, reducedMotion: true,
          hud: null,
        });
      } else {
        renderFirstPerson(c, {
          cam, defenders: [], stride: run.stride,
          minX: run.minX, maxX: run.maxX,
          ball: null, assist: false, reducedMotion: true, hud: null,
        });
      }
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assist, onComplete]);

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center px-3 py-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-3">
          <div className="inline-block px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 text-[10px] font-black tracking-widest uppercase">
            First-Person Dribble
          </div>
          <h1 className="mt-2 text-xl font-black tracking-tight">Beat your man, then finish</h1>
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
                Drag to steer. Flick left or right to burst past him.
              </p>
            </div>
          )}

          {phase === "aim" && (
            <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex justify-center px-4">
              <p className="rounded-lg bg-black/55 px-3 py-1.5 text-center text-[11px] font-bold text-white/85">
                Drag back from the ball to aim and set power.
              </p>
            </div>
          )}

          {phase === "result" && (
            <div className="absolute inset-0 z-40 grid place-items-center bg-black/60">
              <div className="text-center px-4">
                <div className="text-2xl font-black text-amber-300">{resultText}</div>
                {attempts > 0 && (
                  <div className="mt-1 text-[11px] font-bold text-white/50">{attempts} shot{attempts === 1 ? "" : "s"} taken</div>
                )}
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
