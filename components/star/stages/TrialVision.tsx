"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { mulberry32 } from "@/lib/star/season";
import { CX, NET_DEPTH } from "@/lib/star/pitch";
import type { Viewport } from "@/lib/star/canvasEngine";
import {
  REPS, visionSetup, visionQuality, weightedQuality, attemptSeed,
  teachSeen, markTeachSeen, type VisionSetup,
} from "@/lib/star/trialStages";
import type { TrialProgress } from "@/lib/star/trial";
import { ELEVEN_A_SIDE_ATTACK } from "@/lib/star/fiveASide/rules";
import {
  cameraContaining, projectionFor, drawPitch, drawGoal, drawFigure, drawBall,
} from "@/lib/star/fiveASide/render";
import { loadFaceStyle, type FaceStyle } from "@/lib/star/faceStyle";
import { loadFakeFaceStyle, type FakeFaceStyle } from "@/lib/star/fakeFaceStyle";

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
// standing on each other.
//
// This is the rectangle that genuinely has to be ON SCREEN — every marker, you
// with the ball at the bottom, and the goal at the top for orientation. The
// camera is then `cameraContaining(MUST_SEE, …)`, which grows it to whatever
// shape the canvas turns out to be rather than cropping it to fit.
//
// It has to be containment rather than the five-a-side's panning camera, and
// the reason is what this stage IS: a picture you read in one look. A camera
// that scrolled would be hiding part of the question.
//
// The frame this replaced was a fixed 3:4 with no height cap, and on a phone
// it ran off the bottom of the screen — you, and the ball at your feet, below
// the fold on the one stage that is entirely about looking at the picture.

/** Where you stand with the ball — bottom-centre, facing the goal. */
const VISION_YOU_Y = 36;
export const VISION_YOU = { x: CX, y: VISION_YOU_Y };

const MUST_SEE = { x1: 16.5, x2: 51.5, y1: -NET_DEPTH - 1, y2: VISION_YOU_Y + 1.6 };

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

/** Your shirt, and theirs. Two kits that could not be confused at a glance
 *  under a one-second clock. */
const KIT = { shirt: "#f8fafc", shorts: "#0f172a", trim: "#0f172a" };
const OPP = { shirt: "#1e3a8a", shorts: "#0b1f4d", trim: "#e2e8f0" };

/** The first rep's countdown: three numerals, a second apart. */
const TEACH_COUNT_FROM = 3;
const TEACH_COUNT_MS = 1000;

export interface TrialVisionProps {
  trial: TrialProgress;
  onDone: (quality: number) => void;
}

export default function TrialVision({ trial, onDone }: TrialVisionProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const camRef = useRef<Viewport | null>(null);
  // Read once, not per frame — every head on the pitch draws through these.
  const faceStyleRef = useRef<FaceStyle>(loadFaceStyle());
  const fakeFaceStyleRef = useRef<FakeFaceStyle>(loadFakeFaceStyle());
  const startedRef = useRef(0);
  const phaseRef = useRef<Phase>("ready");
  const scoresRef = useRef<number[]>([]);
  const pickedRef = useRef<number | null>(null);
  const doneRef = useRef(false);

  const [rep, setRep] = useState(0);
  const [phase, setPhaseState] = useState<Phase>("ready");
  const [verdict, setVerdict] = useState("");
  /** The big numeral on the first rep, counting down to the clock starting.
   *  Null on every other rep — see the effect below. */
  const [count, setCount] = useState<number | null>(null);

  /**
   * ── DISMISSING THE TEACHING HERE DOES NOT DISMISS THE COUNTDOWN ──
   *
   * "You should be able to get rid of the little tutorial" — and on this
   * stage, more carefully than on the striking ones, because the first rep's
   * overlay is two different things stacked in one box.
   *
   * The INSTRUCTION ("tap the team-mate in the most space, blue shirts are
   * marking, it does not wait") is teaching, and a returning player has read
   * it. The 3 · 2 · 1 is not teaching at all — it is live state, and the only
   * thing telling you when a clock that can be under a second long actually
   * starts. Hiding that with the paragraph would make the dismiss button the
   * single most expensive tap in the trial.
   *
   * So dismissing drops the badge, the headline and the paragraph, and the
   * countdown keeps running underneath in the same place it was. A player who
   * has dismissed it before gets the countdown on rep 1 and no words, which is
   * exactly what reps 2-6 already look like plus the clock he still needs.
   *
   * Read from storage on mount rather than in the initialiser: `window` does
   * not exist during Next's server render of this client component, and a
   * first client render that disagreed with the server's HTML is its own bug.
   */
  const [teachDone, setTeachDone] = useState(false);
  useEffect(() => { if (teachSeen("vision")) setTeachDone(true); }, []);
  const dismissTeach = useCallback(() => {
    markTeachSeen("vision");
    setTeachDone(true);
  }, []);

  const setPhase = (p: Phase) => { phaseRef.current = p; setPhaseState(p); };

  // Both are pure functions of the trial and the rep, and the layout re-rolls
  // internally until the picture is fair — worth computing once per rep rather
  // than on every render the phase changes cause.
  const setup = useMemo(() => visionSetup(trial, rep), [trial, rep]);
  // ── `attemptSeed`, not `trial.seed` ──
  //
  // Which man is the answer already moves with the resume count (visionSetup);
  // the PICTURE has to move with it too, or a resumed stage would redraw the
  // exact same six pictures with the answer moved inside them — still most of
  // the way to a memory test, since the picture is what you remember.
  const seed = useMemo(() => attemptSeed(trial), [trial]);
  const layout = useMemo(() => layoutVision(setup, seed, rep), [setup, seed, rep]);
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
        // Weighted, not flat: `visionDrill` shaves the window every rep and
        // adds a man from the fourth on, so the later pictures are genuinely
        // the harder ones and count for more. See `weightedQuality`.
        onDone(weightedQuality(scoresRef.current));
      } else {
        setRep(r => r + 1);
      }
    }, 1200);
  }, [onDone, rep]);

  /**
   * ── THE FIRST REP GETS A REAL COUNTDOWN, AND IT STILL COUNTS ──
   *
   * Asked for by name for this stage specifically, and it is the stage that
   * most needs it: every other drill in the trial starts when YOU move, and
   * this one starts on its own. A window that can be under a second at the
   * top of the ladder, opening 650 ms after a screen you have never seen
   * before appeared, is a rep you lose to not knowing it had begun rather
   * than to not seeing the pass.
   *
   * So rep 1 gets three seconds of "3 · 2 · 1", with the instruction on
   * screen the whole way down, and the clock starts on zero. It is still
   * scored exactly like every other rep — the tutorial is the warning, not a
   * free go.
   *
   * Every rep after it keeps the original 650 ms beat: by then you know what
   * the screen does, and a full countdown five more times is padding.
   */
  useEffect(() => {
    pickedRef.current = null;
    setVerdict("");
    setPhase("ready");
    const timers: number[] = [];
    if (rep === 0) {
      setCount(TEACH_COUNT_FROM);
      for (let n = TEACH_COUNT_FROM - 1; n >= 1; n--) {
        timers.push(window.setTimeout(
          () => setCount(n), (TEACH_COUNT_FROM - n) * TEACH_COUNT_MS,
        ));
      }
      timers.push(window.setTimeout(() => {
        setCount(null);
        startedRef.current = performance.now();
        setPhase("live");
      }, TEACH_COUNT_FROM * TEACH_COUNT_MS));
    } else {
      setCount(null);
      timers.push(window.setTimeout(() => {
        startedRef.current = performance.now();
        setPhase("live");
      }, 650));
    }
    return () => { for (const t of timers) window.clearTimeout(t); };
  }, [rep]);

  const tap = (e: React.PointerEvent) => {
    if (phaseRef.current !== "live") return;
    const c = canvasRef.current;
    if (!c) return;
    const r = c.getBoundingClientRect();
    const vp = camRef.current;
    if (!vp) return;
    const fx = (e.clientX - r.left) / r.width;
    const fy = (e.clientY - r.top) / r.height;
    const x = vp.x1 + fx * (vp.x2 - vp.x1);
    const y = vp.y1 + fy * (vp.y2 - vp.y1);
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
    // Everything in MUST_SEE, grown to the canvas's own shape. Nothing is
    // cropped and nothing scrolls — a picture you read in one look has to be
    // all there in one look.
    const camera = cameraContaining(MUST_SEE, W, H);
    camRef.current = camera;
    const rules = ELEVEN_A_SIDE_ATTACK;
    const p = projectionFor(rules, W, H, camera);
    const { px, py, unit } = p;

    drawPitch(ctx, rules, p);
    // Flat, deliberately: this is a passing picture, not a shooting one, and a
    // full raised net would pull the eye to the one part of the screen the
    // answer is never in. Same function the striking stages call, without the
    // `height` option.
    drawGoal(ctx, rules, p, 0, NET_DEPTH);

    const l = layoutRef.current, st = setupRef.current;
    const reveal = phaseRef.current === "reveal";

    /** A ring on the grass under a man — how the answer is shown, and how you
     *  are shown. Drawn on the turf rather than around the figure so it never
     *  fights the head, which is now a real head with a real face in it. */
    const ring = (x: number, y: number, colour: string) => {
      const r = Math.max(6, unit * 1.05);
      ctx.strokeStyle = colour;
      ctx.lineWidth = Math.max(2, r * 0.16);
      ctx.beginPath();
      ctx.ellipse(px(x), py(y) + r * 0.26, r * 0.62, r * 0.26, 0, 0, Math.PI * 2);
      ctx.stroke();
    };

    // Markers first, so a team-mate is never hidden behind the man on him.
    for (const m of l.men) drawFigure(ctx, p, m.marker, OPP, faceStyleRef.current, fakeFaceStyleRef.current);
    l.men.forEach((m, i) => {
      const colour = reveal
        ? (i === st.correct ? "#34d399" : i === pickedRef.current ? "#f43f5e" : null)
        : null;
      if (colour) ring(m.x, m.y, colour);
      drawFigure(ctx, p, m, KIT, faceStyleRef.current, fakeFaceStyleRef.current);
    });

    // You, with the ball at your feet.
    ring(l.you.x, l.you.y, "#fbbf24");
    drawFigure(ctx, p, l.you, { ...KIT, star: true }, faceStyleRef.current, fakeFaceStyleRef.current);
    drawBall(ctx, p, { x: l.you.x + 0.9, y: l.you.y + 0.7 }, 0);

    // The clock, as a bar across the top. A number counting down in tenths is
    // unreadable inside a one-second window; a bar draining is not.
    if (phaseRef.current === "live") {
      const left = Math.max(0, 1 - (performance.now() - startedRef.current) / 1000 / setupRef.current.window);
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

      {/* ── A phone-shaped box, not a picture-shaped one ──
          3:4 with no height cap put you, and the ball at your feet, off the
          bottom of an iPhone 13 — on the one stage that is entirely about
          reading the whole picture. The box is now capped against the
          viewport and `cameraContaining` shows all of MUST_SEE inside
          whatever shape that leaves, so the cap never crops the question. */}
      <div
        ref={wrapRef}
        className="relative mx-auto aspect-[4/5] max-h-[52vh] w-full overflow-hidden rounded-xl border border-white/15"
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full touch-none"
          onPointerDown={tap}
        />

        {phase === "ready" && (
          <div className="absolute inset-0 z-30 grid place-items-center bg-black/70 px-5">
            {rep === 0 && count !== null ? (
              /* ── The first one: told properly, and counted in ──
                 A stage that starts on its own needs to say so BEFORE it
                 starts. Scored exactly like every other rep regardless — the
                 badge says as much, so nobody plays the first one as a
                 throwaway and then finds out it counted.

                 The words can be dismissed and the numeral cannot. See
                 `teachDone`. */
              <div className="text-center">
                {!teachDone && (
                  <>
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="rounded bg-amber-400 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-black">
                        First one
                      </span>
                      <span className="text-[10px] font-black uppercase tracking-widest text-white/50">
                        It still counts
                      </span>
                      <button
                        type="button"
                        onClick={dismissTeach}
                        className="-my-1 rounded-lg px-2 py-1 text-[10px] font-black uppercase tracking-widest text-white/60 transition hover:bg-white/10 hover:text-white"
                      >
                        Got it ✕
                      </button>
                    </div>
                    <div className="mt-3 text-xl font-black leading-tight text-white">
                      Tap the team-mate in the most space.
                    </div>
                    <p className="mt-1.5 text-[11px] font-bold leading-snug text-white/75">
                      The blue shirts are marking. The clock starts on zero and it
                      does not wait — if you never pick, it scores nothing.
                    </p>
                  </>
                )}
                <div
                  key={count}
                  className="mt-3 text-7xl font-black tabular-nums text-amber-300"
                  style={{ textShadow: "0 4px 12px rgba(0,0,0,0.8)" }}
                >
                  {count}
                </div>
              </div>
            ) : (
              <div className="text-center">
                <div className="text-sm font-black uppercase tracking-widest text-white/70">Heads up</div>
                <div className="mt-1 text-2xl font-black text-white">Who&apos;s free?</div>
              </div>
            )}
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
