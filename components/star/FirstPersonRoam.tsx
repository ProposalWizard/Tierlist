"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  newDribble, flick, stepDribble, dribbleProgress,
  type DribbleState, type DribbleOutcome,
} from "@/lib/star/dribble";
import { cameraFor, EYE } from "@/lib/star/firstPersonView";
import { renderFirstPersonRoam } from "@/lib/star/firstPersonRender";
import { mulberry32 } from "@/lib/star/season";

/**
 * THE FIRST-PERSON OPEN RUN — dribble.ts, seen through the eyes.
 *
 * Requested directly, alongside the one-on-one duel mode: "an alternative
 * version of this, which is basically just the same as the dribbling
 * scenario in the road to the Ballon d'Or game mode... where you basically
 * have to get to the other side and not get tackled... in this first
 * person... method, with the same type of mechanics."
 *
 * That scenario already exists, fully built and tested, as `lib/star/
 * dribble.ts` — a swipe sets a heading in ANY direction (not just left or
 * right), several chasers stand still until you come close enough to wake
 * them, and then they give chase at your CURRENT position, not a predicted
 * one. None of that logic is reimplemented here: `newDribble`/`flick`/
 * `stepDribble`/`dribbleProgress` are used completely unmodified, exactly
 * as the top-down version already does. The only thing genuinely new is
 * the camera and the input mapping needed to make a free-direction heading
 * make sense in first person.
 *
 * ── Why the camera has to turn here, when the duel mode's never does ──
 *
 * The duel mode only ever runs one way, so its camera only ever
 * translates (see firstPersonView.ts's header). A swipe here can point
 * anywhere, including sideways or backward — a first-person camera that
 * kept facing a fixed direction while you ran sideways would look like
 * sliding, not running. So this camera's `forward` genuinely rotates to
 * face `state.heading` (smoothed a little for comfort — the smoothing is
 * purely a rendering nicety, layered on top of the simulation's own
 * instant-snap heading, never fed back into it).
 *
 * ── Reading the gesture relative to where you're already facing ──
 *
 * A swipe is interpreted relative to the CURRENT heading, not fixed screen
 * axes — "swipe up" always means "keep going roughly the way you're
 * already facing," and "swipe left/right" means "peel off that way from
 * here," exactly the way a first-person control scheme has to work once
 * the camera can turn. See `worldFlickFrom` below.
 *
 * ── The establishing shot ──
 *
 * Reported directly: "you cannot see the first man without turning into
 * him... the user needs to understand the situation... without using
 * information boxes and text." A first-person view genuinely can't show
 * you a man standing off to the side until you're already facing him —
 * that isn't a bug, it's what first person means — so the fix isn't a
 * wider lens or a minimap overlay, it's a real camera move: a brief
 * `"intro"` phase before `"run"` starts, elevated and tilted down over the
 * whole, frozen situation (you and every chaser, awake or not), then a
 * single continuous swoop down and level out into the ordinary eye-level
 * view. `firstPersonView.ts`'s `pitch` is what makes this ONE camera model
 * rather than a cut between two different renderers — the intro and the
 * game share every drawing routine in `firstPersonRender.ts` unchanged;
 * only `eye`/`pitch` animate.
 *
 * ── Dribbling, not gliding ──
 *
 * Reported directly, separately: the ball used to sit at a fixed offset
 * ahead of you, gliding as you moved — "it doesn't just look like getting
 * an image stuck on." There's no leg rig to animate a real touch, so the
 * ball itself carries the illusion: a bounce synced to distance run (not
 * wall-clock time, same reasoning `stride` already exists for), a lateral
 * sway alternating roughly foot to foot, and a forward surge-then-settle
 * timed to land just after the bounce peaks — a toe-poke, not a carry.
 */

type Phase = "intro" | "run" | "result";

const DT_CAP = 0.05;
const BALL_LEAD = 1.7; // same reasoning as the duel mode's — see firstPersonView.ts
const MIN_SWIPE_FRAC = 0.05; // of canvas width — smaller swipes are ignored
const FORWARD_SMOOTH_RATE = 8; // 1/s — how fast the camera catches up to a new heading

// The establishing shot — see the file header.
const INTRO_DURATION = 1.3; // seconds
const ESTABLISH_EYE = 20;   // metres — high enough to comfortably frame the
                             // ~18m-wide corridor even near-vertical (see
                             // tests/star/firstPersonView.mts's near-pitch-90 check)
const ESTABLISH_PITCH = (75 * Math.PI) / 180;

// Dribbling motion — see the file header. Frequency matches
// firstPersonRender.ts's own forearm-bob rate (`stride * 1.9`) so the ball
// and the player's own body read as the same rhythm.
const TOUCH_FREQ = 1.9;
const LATERAL_BOB = 0.22;   // metres of side-to-side sway, foot to foot
const LEAD_PULSE = 0.35;    // metres the ball surges ahead of the base lead
const BOUNCE_HEIGHT = 0.16; // metres of hop at the top of each touch

function easeInOutCubic(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
}

const RESULT_LABEL: Record<DribbleOutcome, (beatenBy: number | null) => string> = {
  running: () => "",
  through: () => "Clear!",
  lost: (beatenBy) => (beatenBy != null ? `Caught by chaser ${beatenBy + 1}` : "Caught!"),
  out: () => "Drifted too far back.",
};

export interface FirstPersonRoamProps {
  pace?: number;
  oppStrength?: number;
  chasers?: number;
  /** A fixed seed replays the exact same run every time (for tuning);
   *  omit it for a fresh random run on every attempt. */
  seed?: number;
  onComplete?: (result: { cleared: boolean }) => void;
}

function normalize(v: { x: number; y: number }): { x: number; y: number } {
  const len = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / len, y: v.y / len };
}

export default function FirstPersonRoam({
  pace = 60, oppStrength = 55, chasers = 3, seed, onComplete,
}: FirstPersonRoamProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<DribbleState | null>(null);
  const ballImgRef = useRef<HTMLImageElement | null>(null);
  const rngRef = useRef<() => number>(() => Math.random());
  const reducedMotionRef = useRef(false);
  const strideRef = useRef(0);
  const smoothForwardRef = useRef({ x: 0, y: -1 });
  // Elapsed time in the establishing-shot intro — see the file header.
  const introTRef = useRef(0);

  const phaseRef = useRef<Phase>("intro");
  const [phase, setPhaseState] = useState<Phase>("intro");
  const setPhase = (p: Phase) => { phaseRef.current = p; setPhaseState(p); };

  const [resultText, setResultText] = useState("");

  // A swipe, start to release — direction is read relative to the CURRENT
  // heading (see the file header), so it's computed on release, not mid-drag.
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);

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
    const state = newDribble({ pace, oppStrength, chasers, rng });
    stateRef.current = state;
    strideRef.current = 0;
    smoothForwardRef.current = { ...normalize(state.heading) };
    introTRef.current = 0;
    swipeStartRef.current = null;
    setResultText("");
    setPhase("intro");
  }, [pace, oppStrength, chasers, newRng]);

  useEffect(() => { reset(); }, [reset]);

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

  /** Turn a screen-space swipe into a world heading, relative to whichever
   *  way you're currently facing — "up" on screen means "keep going the
   *  way you're already going," not a fixed world axis. */
  const worldFlickFrom = (dxScreen: number, dyScreen: number) => {
    const state = stateRef.current;
    if (!state) return;
    const fwd = normalize(state.heading);
    const right = { x: -fwd.y, y: fwd.x };
    const fwdComponent = -dyScreen; // screen-up => keep facing forward
    const rightComponent = dxScreen;
    const dir = {
      x: fwd.x * fwdComponent + right.x * rightComponent,
      y: fwd.y * fwdComponent + right.y * rightComponent,
    };
    flick(state, dir.x, dir.y);
  };

  // ── Pointer input — a swipe, read on release ──────────────────────────
  const onPointerDown = (e: React.PointerEvent) => {
    const c = canvasRef.current;
    if (!c || phaseRef.current !== "run") return;
    try { c.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    swipeStartRef.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const c = canvasRef.current;
    try { c?.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!c || !start || phaseRef.current !== "run") return;
    const r = c.getBoundingClientRect();
    const dx = e.clientX - start.x, dy = e.clientY - start.y;
    if (Math.hypot(dx, dy) < MIN_SWIPE_FRAC * r.width) return;
    worldFlickFrom(dx, dy);
  };

  // ── Keyboard fallback — arrows turn relative to the current heading ────
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (phaseRef.current !== "run") return;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      worldFlickFrom(e.key === "ArrowRight" ? 1 : -1, -0.6);
    };
    window.addEventListener("keydown", onDown);
    return () => window.removeEventListener("keydown", onDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── The loop ───────────────────────────────────────────────────────────
  useEffect(() => {
    let raf: number;
    let last = performance.now();

    const finishRun = (outcome: DribbleOutcome, beatenBy: number | null) => {
      setResultText(RESULT_LABEL[outcome](beatenBy));
      setPhase("result");
      onComplete?.({ cleared: outcome === "through" });
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(DT_CAP, (now - last) / 1000);
      last = now;
      const state = stateRef.current;

      if (phaseRef.current === "intro") {
        // Nothing moves and nobody wakes during the establishing shot — it
        // is a look at the situation exactly as it starts, not a preview of
        // it already under way.
        introTRef.current += dt;
        if (introTRef.current >= INTRO_DURATION) setPhase("run");
      } else if (phaseRef.current === "run" && state) {
        const outcome = stepDribble(state, dt);
        strideRef.current += state.speed * dt;

        const target = normalize(state.heading);
        const sm = smoothForwardRef.current;
        const t = 1 - Math.exp(-dt * FORWARD_SMOOTH_RATE);
        sm.x += (target.x - sm.x) * t;
        sm.y += (target.y - sm.y) * t;
        const n = normalize(sm);
        sm.x = n.x; sm.y = n.y;

        if (outcome !== "running") finishRun(outcome, state.beatenBy);
      }

      draw();
    };

    const draw = () => {
      const c = canvasRef.current, state = stateRef.current;
      if (!c || !state) return;
      const forward = smoothForwardRef.current;

      // The establishing shot — one continuous swoop from elevated/tilted
      // down to the ordinary eye-level view, sharing every drawing routine
      // with normal play; only these two numbers animate.
      let eye: number | undefined, pitch: number | undefined;
      if (phaseRef.current === "intro") {
        const p = easeInOutCubic(introTRef.current / INTRO_DURATION);
        eye = ESTABLISH_EYE + (EYE - ESTABLISH_EYE) * p;
        pitch = ESTABLISH_PITCH * (1 - p);
      }
      const cam = cameraFor({ x: state.pos.x, y: state.pos.y }, c.width, c.height, { forward, eye, pitch });

      // The ball leads you, bouncing and swaying in a rhythm tied to
      // distance run rather than gliding at a fixed offset — see the file
      // header. Frozen at a plain lead offset during the intro (nothing is
      // moving yet) and when the viewer has asked for reduced motion.
      const right = { x: -forward.y, y: forward.x };
      let ball: { x: number; y: number; z: number };
      if (phaseRef.current !== "run" || reducedMotionRef.current) {
        ball = { x: state.pos.x + forward.x * BALL_LEAD, y: state.pos.y + forward.y * BALL_LEAD, z: 0 };
      } else {
        const touchPhase = strideRef.current * TOUCH_FREQ;
        const bounce = Math.max(0, Math.sin(touchPhase));
        const sway = Math.sin(touchPhase * 0.5) * LATERAL_BOB;
        const lead = BALL_LEAD + Math.cos(touchPhase) * LEAD_PULSE * 0.5;
        ball = {
          x: state.pos.x + forward.x * lead + right.x * sway,
          y: state.pos.y + forward.y * lead + right.y * sway,
          z: bounce * BOUNCE_HEIGHT,
        };
      }

      renderFirstPersonRoam(c, {
        cam,
        chasers: state.chasers,
        stride: strideRef.current,
        minX: state.minX, maxX: state.maxX,
        ball, ballImage: ballImgRef.current,
        reducedMotion: reducedMotionRef.current,
        hud: phaseRef.current === "run" ? { text: `${Math.round(dribbleProgress(state) * 100)}% through` } : null,
      });
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onComplete]);

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center px-3 py-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-3">
          <div className="inline-block px-3 py-1 rounded-full bg-sky-500/15 border border-sky-400/40 text-sky-300 text-[10px] font-black tracking-widest uppercase">
            First-Person Open Run
          </div>
          <h1 className="mt-2 text-xl font-black tracking-tight">Get to the other side</h1>
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
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          />

          {phase === "run" && (
            <div className="pointer-events-none absolute inset-x-0 bottom-2 z-20 flex flex-col items-center gap-1 px-4">
              <p className="rounded-lg bg-black/55 px-3 py-1 text-center text-[10px] font-bold text-white/80">
                Swipe the way you want to run. They wake up if you get close.
              </p>
            </div>
          )}

          {phase === "result" && (
            <div className="absolute inset-0 z-40 grid place-items-center bg-black/60">
              <div className="text-center px-4">
                <div className="text-2xl font-black text-amber-300">{resultText}</div>
                <button
                  onClick={reset}
                  className="mt-4 rounded-lg bg-sky-500 px-5 py-2 text-sm font-black text-sky-950 active:scale-95"
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
