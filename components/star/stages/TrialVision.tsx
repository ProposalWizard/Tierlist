"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { mulberry32 } from "@/lib/star/season";
import {
  CX, POST_L, POST_R, NET_DEPTH, SIX_L, SIX_R, SIX_DEPTH, BOX_L, BOX_R, BOX_DEPTH,
} from "@/lib/star/pitch";
import {
  REPS, visionSetup, visionQuality, meanQuality, type VisionSetup,
} from "@/lib/star/trialStages";
import type { TrialProgress } from "@/lib/star/trial";

/**
 * FINDING THE PASS.
 *
 * The one stage with no ball-striking in it. A picture appears — you on the
 * ball, several team-mates ahead of you, a marker on each of them — and you
 * have `window` seconds to pick the man who is actually free.
 *
 * ── What makes it a vision test rather than a memory test ──
 *
 * `margin`, from `visionDrill`, and it is the whole mechanic: how much more
 * space the right man has than the next-best one, in metres. Seven metres at
 * the bottom of the ladder is a man standing on his own in a picture where
 * everybody else has somebody on their shoulder — you cannot miss it. At the
 * top it is barely a metre, with under a second to see it, and the two best
 * balls genuinely look alike.
 *
 * So the layout's one real job is to make the drawn picture honour that
 * number: the right man must genuinely be the freest man ON SCREEN, by
 * something close to `margin`, or the stage is asking you to guess. That is
 * what `layoutVision` guarantees and what the test checks — see the note on
 * REQUIRED_GAP_FRACTION for the one honest compromise in it.
 */

// ── The picture's own geometry, in real pitch metres ────────────────────────
//
// Not the match engine's 5:8 camera. That frame is 26 m wide, and a vision
// picture needs to hold up to nine men and their markers without them
// standing on each other — so this is its own, squarer frame, and this screen
// draws it itself rather than going through the engine's scenario rendering
// (there is no ball to strike here, so there is no scenario to build).
const VIEW_ASPECT_VISION = 3 / 4;   // width / height
const VIEW = (() => {
  const w = 34;
  const h = w / VIEW_ASPECT_VISION;
  return { x1: CX - w / 2, x2: CX + w / 2, y1: -4, y2: -4 + h };
})();

/** Where you stand with the ball — bottom-centre, facing the goal. */
export const VISION_YOU = { x: CX, y: 36 };

/** The box the team-mates are placed in. Inset from the frame so nobody is
 *  drawn half off the edge. */
const AREA = { x1: 20, x2: 48, y1: 4.5, y2: 30 };
/** Markers may stand slightly outside that, but not outside the frame. */
const MARKER_BOX = { x1: 18.5, x2: 49.5, y1: 1.5, y2: 33.5 };

/** How much space the tightest-marked man has, before `margin` is added on
 *  top for the free one. Close enough that he reads as genuinely marked. */
const BASE_SPACE = 2.4;
/** …and the floor, so a marker is never drawn standing inside a team-mate. */
const MIN_SPACE = 1.1;

/**
 * How much of `margin` the drawn picture is required to actually deliver.
 *
 * Not all of it, and this is the one honest compromise in the layout. Space
 * is read as the distance to the NEAREST opponent, and opponents belong to
 * the picture rather than to the man they are marking — so a marker placed
 * on one team-mate can happen to be the closest opponent to another, which
 * compresses the gap between best and second best below the number
 * `visionDrill` asked for. Forcing the full margin every time would mean
 * either re-rolling the picture for a long time or placing markers in
 * unnatural positions to protect an arithmetic property.
 *
 * So: the right man is ALWAYS the freest man on screen (never joint, never
 * second), and he is free by at least this much of the intended margin. The
 * layout re-rolls until that holds, and keeps the best picture it saw if it
 * somehow cannot.
 */
const REQUIRED_GAP_FRACTION = 0.6;
const LAYOUT_ATTEMPTS = 24;

export interface VisionMan {
  x: number; y: number;
  /** The man marking him. */
  marker: { x: number; y: number };
  /** How much space he ACTUALLY has once every marker is placed: the distance
   *  to the nearest opponent in the picture, not the one assigned to him. */
  space: number;
}

export interface VisionLayout {
  you: { x: number; y: number };
  men: VisionMan[];
  /** Metres between the freest man and the next freest. */
  gap: number;
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function oneLayout(setup: VisionSetup, rng: () => number): VisionLayout {
  const n = Math.max(2, Math.round(setup.options));
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  const cw = (AREA.x2 - AREA.x1) / cols;
  const ch = (AREA.y2 - AREA.y1) / rows;

  // A jittered grid rather than free scatter: nine men in a twenty-eight
  // metre box need a guaranteed minimum separation or two of them end up on
  // the same spot and the picture is unreadable however good the numbers are.
  const pos: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const c = i % cols, r = Math.floor(i / cols);
    pos.push({
      x: AREA.x1 + cw * (c + 0.5) + (rng() - 0.5) * cw * 0.5,
      y: AREA.y1 + ch * (r + 0.5) + (rng() - 0.5) * ch * 0.5,
    });
  }

  const best = BASE_SPACE + setup.margin;
  const markers: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const want = i === setup.correct
      ? best
      // Never more than the free man, whatever the jitter does: the multiplier
      // is strictly above zero, so a wrong option's space is strictly below
      // his by construction rather than by luck.
      : Math.max(MIN_SPACE, best - setup.margin * (0.85 + rng() * 0.3));
    // Eight candidate angles from a random start; the first one that keeps the
    // marker on the pitch wins. Rotating rather than clamping matters — a
    // clamped marker would sit closer than `want`, quietly changing the very
    // number the picture is supposed to be showing.
    const a0 = rng() * Math.PI * 2;
    let placed: { x: number; y: number } | null = null;
    for (let k = 0; k < 8 && !placed; k++) {
      const a = a0 + (k * Math.PI) / 4;
      const m = { x: pos[i].x + Math.cos(a) * want, y: pos[i].y + Math.sin(a) * want };
      if (m.x >= MARKER_BOX.x1 && m.x <= MARKER_BOX.x2 && m.y >= MARKER_BOX.y1 && m.y <= MARKER_BOX.y2) {
        placed = m;
      }
    }
    markers.push(placed ?? {
      x: Math.min(MARKER_BOX.x2, Math.max(MARKER_BOX.x1, pos[i].x + want)),
      y: Math.min(MARKER_BOX.y2, Math.max(MARKER_BOX.y1, pos[i].y)),
    });
  }

  const men: VisionMan[] = pos.map((p, i) => ({
    x: p.x, y: p.y, marker: markers[i],
    space: Math.min(...markers.map(m => dist(p, m))),
  }));

  const others = men.filter((_, i) => i !== setup.correct).map(m => m.space);
  const gap = men[setup.correct].space - Math.max(...others);
  return { you: { ...VISION_YOU }, men, gap };
}

/**
 * The picture for one rep — deterministic from the trial's own seed and the
 * rep number, so closing the app and coming back shows the same picture
 * rather than re-rolling one you have already seen the answer to.
 */
export function layoutVision(setup: VisionSetup, seed: number, rep: number): VisionLayout {
  const need = setup.margin * REQUIRED_GAP_FRACTION;
  let bestLayout: VisionLayout | null = null;
  for (let a = 0; a < LAYOUT_ATTEMPTS; a++) {
    const rng = mulberry32((seed ^ ((rep + 1) * 0x27d4eb2d) ^ ((a + 1) * 0x165667b1)) >>> 0);
    const l = oneLayout(setup, rng);
    if (l.gap >= need) return l;
    if (!bestLayout || l.gap > bestLayout.gap) bestLayout = l;
  }
  return bestLayout!;
}

// ── The screen ─────────────────────────────────────────────────────────────

type Phase = "ready" | "live" | "reveal";

const KIT = { shirt: "#f8fafc", trim: "#0f172a" };
const OPP = { shirt: "#1e3a8a", trim: "#e2e8f0" };

export interface TrialVisionProps {
  trial: TrialProgress;
  onDone: (quality: number) => void;
}

export default function TrialVision({ trial, onDone }: TrialVisionProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(0);
  const phaseRef = useRef<Phase>("ready");
  const scoresRef = useRef<number[]>([]);
  const pickedRef = useRef<number | null>(null);
  const doneRef = useRef(false);

  const [rep, setRep] = useState(0);
  const [phase, setPhaseState] = useState<Phase>("ready");
  const [verdict, setVerdict] = useState("");

  const setPhase = (p: Phase) => { phaseRef.current = p; setPhaseState(p); };

  // Both are pure functions of the trial and the rep, and the layout re-rolls
  // internally until the picture is fair — worth computing once per rep rather
  // than on every render the phase changes cause.
  const setup = useMemo(() => visionSetup(trial, rep), [trial, rep]);
  const layout = useMemo(() => layoutVision(setup, trial.seed, rep), [setup, trial.seed, rep]);
  // The loop reads both every frame; keeping them on refs means the animation
  // frame never closes over a stale rep the way it would over state.
  const setupRef = useRef(setup);
  const layoutRef = useRef(layout);
  setupRef.current = setup;
  layoutRef.current = layout;

  /** One rep is over. Score it and move on. */
  const settle = useCallback((picked: number | null, tookSeconds: number) => {
    const s = setupRef.current;
    const q = visionQuality(picked, s, tookSeconds);
    scoresRef.current = [...scoresRef.current, q];
    pickedRef.current = picked;
    setVerdict(
      picked === null ? "Head never came up."
        : picked === s.correct ? (tookSeconds < s.window * 0.45 ? "Seen it early!" : "Right man.")
        : "He was covered.",
    );
    setPhase("reveal");
    window.setTimeout(() => {
      if (rep + 1 >= REPS.vision) {
        if (doneRef.current) return;
        doneRef.current = true;
        onDone(meanQuality(scoresRef.current));
      } else {
        setRep(r => r + 1);
      }
    }, 1200);
  }, [onDone, rep]);

  // A fresh rep: a beat to get your eyes on the screen, then the clock starts.
  // Without it the window — which can be under a second at the top of the
  // ladder — would be partly spent on the transition rather than on looking.
  useEffect(() => {
    pickedRef.current = null;
    setVerdict("");
    setPhase("ready");
    const t = window.setTimeout(() => {
      startedRef.current = performance.now();
      setPhase("live");
    }, 650);
    return () => window.clearTimeout(t);
  }, [rep]);

  const tap = (e: React.PointerEvent) => {
    if (phaseRef.current !== "live") return;
    const c = canvasRef.current;
    if (!c) return;
    const r = c.getBoundingClientRect();
    const fx = (e.clientX - r.left) / r.width;
    const fy = (e.clientY - r.top) / r.height;
    const x = VIEW.x1 + fx * (VIEW.x2 - VIEW.x1);
    const y = VIEW.y1 + fy * (VIEW.y2 - VIEW.y1);
    // A generous tap radius in METRES, converted from a real thumb-sized
    // target: a phone at this frame width draws a metre as roughly ten
    // pixels, so three metres is about a fingertip. Nearest man wins, so two
    // men close together still resolve to one of them rather than to neither.
    let bestI = -1, bestD = 3.4;
    layoutRef.current.men.forEach((m, i) => {
      const d = Math.hypot(m.x - x, m.y - y);
      if (d < bestD) { bestD = d; bestI = i; }
    });
    if (bestI < 0) return;
    settle(bestI, (performance.now() - startedRef.current) / 1000);
  };

  // ── The loop ───────────────────────────────────────────────────────────
  useEffect(() => {
    let raf = 0;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      const s = setupRef.current;
      if (phaseRef.current === "live") {
        const elapsed = (performance.now() - startedRef.current) / 1000;
        if (elapsed >= s.window) {
          // Out of time is a real answer and scores zero — a scout learns
          // nothing from a player who never lifted his head.
          settle(null, s.window);
        }
      }
      draw();
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settle]);

  const draw = () => {
    const c = canvasRef.current, wrap = wrapRef.current;
    if (!c || !wrap) return;
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
    const sx = W / (VIEW.x2 - VIEW.x1), sy = H / (VIEW.y2 - VIEW.y1);
    const px = (x: number) => (x - VIEW.x1) * sx;
    const py = (y: number) => (y - VIEW.y1) * sy;
    const unit = Math.min(sx, sy);

    ctx.fillStyle = "#1f9006";
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = "rgba(255,255,250,0.8)";
    ctx.lineWidth = Math.max(1.4, unit * 0.11);
    ctx.beginPath(); ctx.moveTo(0, py(0)); ctx.lineTo(W, py(0)); ctx.stroke();
    ctx.strokeRect(px(SIX_L), py(0), (SIX_R - SIX_L) * sx, SIX_DEPTH * sy);
    ctx.strokeRect(px(BOX_L), py(0), (BOX_R - BOX_L) * sx, BOX_DEPTH * sy);

    // The goal, flat — this is a passing picture, not a shooting one, and a
    // full five-surface net would pull the eye to the one part of the screen
    // the answer is never in.
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillRect(px(POST_L), py(-NET_DEPTH), (POST_R - POST_L) * sx, NET_DEPTH * sy);
    ctx.strokeStyle = "#f6faf7";
    ctx.lineWidth = Math.max(2, unit * 0.16);
    ctx.strokeRect(px(POST_L), py(-NET_DEPTH), (POST_R - POST_L) * sx, NET_DEPTH * sy);
    const l = layoutRef.current, s = setupRef.current;
    const reveal = phaseRef.current === "reveal";

    const figure = (x: number, y: number, shirt: string, trim: string, ring: string | null) => {
      const fx = px(x), fy = py(y);
      const r = unit * 0.85;
      ctx.beginPath();
      ctx.ellipse(fx, fy + r * 0.85, r * 0.5, r * 0.18, 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.fill();
      if (ring) {
        ctx.beginPath();
        ctx.arc(fx, fy, r * 1.15, 0, Math.PI * 2);
        ctx.strokeStyle = ring;
        ctx.lineWidth = Math.max(2, r * 0.22);
        ctx.stroke();
      }
      ctx.strokeStyle = "#c68642";
      ctx.lineWidth = Math.max(1, r * 0.15);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(fx - r * 0.13, fy + r * 0.1);
      ctx.lineTo(fx - r * 0.17, fy + r * 0.78);
      ctx.moveTo(fx + r * 0.13, fy + r * 0.1);
      ctx.lineTo(fx + r * 0.17, fy + r * 0.78);
      ctx.stroke();
      ctx.fillStyle = shirt;
      ctx.beginPath();
      ctx.roundRect?.(fx - r * 0.4, fy - r * 0.52, r * 0.8, r * 0.68, r * 0.15);
      if (!ctx.roundRect) ctx.rect(fx - r * 0.4, fy - r * 0.52, r * 0.8, r * 0.68);
      ctx.fill();
      ctx.strokeStyle = trim;
      ctx.lineWidth = Math.max(1, r * 0.09);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(fx, fy - r * 0.74, r * 0.25, 0, Math.PI * 2);
      ctx.fillStyle = "#c68642";
      ctx.fill();
    };

    // Markers first, so a team-mate is never hidden behind the man on him.
    for (const m of l.men) figure(m.marker.x, m.marker.y, OPP.shirt, OPP.trim, null);
    l.men.forEach((m, i) => {
      const ring = reveal
        ? (i === s.correct ? "#34d399" : i === pickedRef.current ? "#f43f5e" : null)
        : null;
      figure(m.x, m.y, KIT.shirt, KIT.trim, ring);
    });

    // You, with the ball at your feet.
    figure(l.you.x, l.you.y, KIT.shirt, KIT.trim, "#fbbf24");
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(px(l.you.x) + unit * 0.55, py(l.you.y) + unit * 0.6, Math.max(3, unit * 0.32), 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.45)";
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // The clock, as a bar across the top. A number counting down in tenths is
    // unreadable inside a one-second window; a bar draining is not.
    if (phaseRef.current === "live") {
      const left = Math.max(0, 1 - (performance.now() - startedRef.current) / 1000 / s.window);
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(0, 0, W, H * 0.018);
      ctx.fillStyle = left > 0.4 ? "#34d399" : left > 0.18 ? "#fbbf24" : "#f43f5e";
      ctx.fillRect(0, 0, W * left, H * 0.018);
    }
  };

  return (
    <div className="w-full">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[11px] font-black uppercase tracking-widest text-white/80">Find the pass</span>
        <span className="text-[11px] font-black tabular-nums text-white/60">
          {Math.min(rep + 1, REPS.vision)} / {REPS.vision}
        </span>
      </div>
      <div className="mb-1.5 text-[11px] font-bold text-white/55">
        {setup.options} options · {setup.window.toFixed(1)}s
      </div>

      <div
        ref={wrapRef}
        className="relative w-full overflow-hidden rounded-xl border border-white/15"
        style={{ aspectRatio: "3 / 4" }}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full touch-none"
          onPointerDown={tap}
        />

        {phase === "ready" && (
          <div className="absolute inset-0 z-30 grid place-items-center bg-black/70">
            <div className="text-center">
              <div className="text-sm font-black uppercase tracking-widest text-white/70">Heads up</div>
              <div className="mt-1 text-2xl font-black text-white">Who&apos;s free?</div>
            </div>
          </div>
        )}

        {phase === "reveal" && verdict && (
          <div className="pointer-events-none absolute inset-x-0 top-5 z-30 flex justify-center px-4">
            <div className="rounded-xl bg-black/70 px-4 py-2 text-center text-lg font-black text-amber-300">
              {verdict}
            </div>
          </div>
        )}
      </div>

      <div className="mt-2 flex items-center gap-1">
        {Array.from({ length: REPS.vision }, (_, i) => {
          const q = scoresRef.current[i];
          return (
            <div key={i} className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
              {q !== undefined && (
                <div
                  className={`h-full ${q >= 0.65 ? "bg-emerald-400" : q >= 0.2 ? "bg-amber-400" : "bg-rose-500"}`}
                  style={{ width: `${Math.max(8, q * 100)}%` }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
