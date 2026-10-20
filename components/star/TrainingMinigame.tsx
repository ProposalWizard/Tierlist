"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Skills } from "@/lib/star/types";
import { starsForTry } from "@/lib/star/trainingLevels";
import {
  levelConfig, levelSeedOf, easePowerLevel,
  type AnyLevel, type PowerLevel, type TechniqueLevel, type FreeKickLevel, type PaceLevel, type VisionLevel,
} from "@/lib/star/trainingLevelData";
import { buildVisionRound, visionTapPick, type VisionRound } from "@/lib/star/visionRound";
import { ensureTrainingLevels } from "@/lib/star/trainingLevelStore";
import { mulberry32 } from "@/lib/star/season";
import {
  buildScenario, initDefenders,
  type Scenario,
} from "@/lib/star/canvasEngine";
import { CX, PITCH_W } from "@/lib/star/pitch";
import {
  powerDrill, powerDrillForLevel, techniqueDrill, freeKickDrill,
  strikeSpot, conePositions, gateCrossing, gateQuality, shotQuality,
} from "@/lib/star/trainingDrills";
import {
  renderTrainingScene, strikeViewport, gateViewport, type TrainingViewport,
} from "@/lib/star/trainingRender";
import { createFaceImageCache } from "@/lib/star/faceImageCache";
import { fakeFaceFor } from "@/lib/star/fakeFaces";
import FirstPersonDribble from "./FirstPersonDribble";
import TrainingIntro from "./TrainingIntro";
import { EngineFeature } from "./EnginePlay";
import type { ScenePicture } from "@/lib/star/scenePicture";
import type { ChanceResolved } from "./CanvasMatch";
import { revealOnScreen } from "@/lib/revealOnScreen";
import { createContext, useContext } from "react";
import { Burst, Glow, KitStyles, Shine, rgba } from "./ui";

/**
 * TRAINING, REBUILT.
 *
 * Reported directly: the drills were "extremely basic and simple", they
 * "just look terrible", and — the real complaint — "the games are unrelated
 * to the abilities so much". All three were true. Three of the five were the
 * same stop-the-sweeping-bar game with a different overlay painted on it,
 * Pace was a traffic-light reaction tap with nothing to do with running, and
 * not one of them ever read the player's actual stat: a pace-5 player and a
 * pace-95 player were handed the identical drill at the identical
 * difficulty, session after session, for a whole career.
 *
 * What replaces them, per the brief's own worked examples (cones that move
 * "further back… further to the side" until "you had to curl the ball a
 * bit"; a shooting drill that "starts off very close" and then "keeps moving
 * you back, keeps adding players in the way"):
 *
 *   Power      → shoot from further and further out, past more and more
 *                bodies, at a better and better keeper.
 *   Technique  → put the ball through a gate of cones that recedes, narrows
 *                and slides off your own line until only a bent ball fits.
 *   Free Kick  → the same, but it is a real dead ball with a real wall that
 *                really jumps.
 *   Pace       → an actual run at actual men, through `dribble.ts` — the
 *                same simulation the real match uses, in which your PACE
 *                STAT IS YOUR RUNNING SPEED (`dribbleSpeed`). The old drill
 *                read none of that.
 *   Vision     → read a real picture: who is onside, who is in space, and
 *                which of those two things matters more, inside a window
 *                that shrinks as your vision climbs.
 *
 * Three components, not five: power, technique and free kick are all "strike
 * a ball at a target with the real engine" and differ only in the geometry
 * the ladder hands them, so they share one implementation
 * (`StrikeDrill`) rather than being copy-pasted three times.
 *
 * The difficulty ladder itself lives in `lib/star/trainingDrills.ts` (pure,
 * and tested in tests/star/trainingDrills.mts — monotonic, gentle at the
 * bottom, brutal at the top). The picture lives in
 * `lib/star/trainingRender.ts`. Everything the physics does — the strike,
 * the flight, the keeper, the wall's jump — is the real match engine, the
 * same way TrialPenalty.tsx already does it, so a shot in training behaves
 * like a shot in a match.
 */

interface Props {
  skill: keyof Skills;
  /** Your club's colour, to light the drill like the Home screens. */
  glow?: string;
  /** Which of the 30 training levels is being played (lib/star/trainingLevels.ts). */
  trainingLevel: number;
  /**
   * The player's CURRENT value in the stat being trained, 0-100.
   *
   * The single most important addition in the rebuild: this is what the
   * whole difficulty ladder reads. It was never passed before — which is
   * exactly why every session played identically for ever.
   *
   * No longer read (25 Sep 2026): a level's difficulty comes from the level
   * number, not the stat. Kept so a caller still passing it compiles.
   */
  level?: number;
  /** The real skills, handed to `launch` so a strike in training is the same
   *  strike it would be in a match — your power decides how far it goes and
   *  your technique decides how much it bends. */
  skills: Skills;
  /** Stars won on this level: 3 on the first try, 2 on the second, 1 on
   *  the third, 0 if all three missed. */
  onComplete: (stars: number) => void;
  /** Leave the drill with nothing scored. Reported directly: "not always
   *  easy to go to home screen or back" — this mounts with no exit of its
   *  own at all once a level is chosen (TrainingLevelSelect, the screen
   *  before it, already has one). Safe at any point: a level only ever
   *  awards stars through onComplete, which this never calls. */
  onExit?: () => void;
  /**
   * Play these numbers instead of the level's saved ones: the Training
   * levels page's "Edit level" panel plays its draft through here, on the
   * same drill a career gets (lib/star/trainingLevelData.ts).
   */
  levelOverride?: AnyLevel;
}

const SKILL_TITLES: Record<keyof Skills, string> = {
  pace: "The Gauntlet",
  power: "Long Range",
  technique: "Through the Gate",
  vision: "Read the Run",
  freeKick: "Over the Wall",
};


// ── Three tries ─────────────────────────────────────────────────────────────
//
// A level is passed or it isn't, and you get three goes at it: in on the first
// is three stars, the second two, the third one (New Star Soccer's rule —
// Mikey, 25 Sep 2026). The level ends the moment it's done.

export const TRIES = 3;

function useTries(onFinish: (stars: number) => void) {
  const [results, setResults] = useState<boolean[]>([]);
  const finishedRef = useRef(false);
  const attempt = useCallback((ok: boolean) => {
    setResults(prev => (prev.length >= TRIES || prev.includes(true) ? prev : [...prev, ok]));
  }, []);
  useEffect(() => {
    if (finishedRef.current) return;
    const hit = results.indexOf(true);
    if (hit < 0 && results.length < TRIES) return;
    finishedRef.current = true;
    const stars = hit < 0 ? 0 : starsForTry(hit);
    const t = setTimeout(() => onFinish(stars), 850);
    return () => clearTimeout(t);
  }, [results, onFinish]);
  const done = results.includes(true) || results.length >= TRIES;
  return { tryIndex: results.length, results, attempt, done };
}

// ── The look (Mikey, 29 Sep 2026: the drills were "a very basic, null-effort
//    thing" next to the glowing, club-coloured Home screens) ─────────────────
//
// Every drill shares this frame, the flash and the result card, so restyling
// these three restyles all five. Your club's colour lights the card; each
// skill has its own accent for the badge and the pips. The drills themselves
// (what you do, how it's scored) are unchanged.

const SKILL_LOOK: Record<keyof Skills, { icon: string; label: string; accent: string }> = {
  pace: { icon: "⚡", label: "Pace", accent: "#22d3ee" },
  power: { icon: "💥", label: "Power", accent: "#f97316" },
  technique: { icon: "🎯", label: "Technique", accent: "#a78bfa" },
  vision: { icon: "👁️", label: "Vision", accent: "#38bdf8" },
  freeKick: { icon: "🌀", label: "Free kick", accent: "#fbbf24" },
};

const DrillLook = createContext<{ skill: keyof Skills; glow: string }>({ skill: "pace", glow: "#2F6F4E" });

function Shell({
  title, instruction, results, trainingLevel, children, onExit,
}: {
  title: string; instruction: string; results: boolean[];
  trainingLevel: number; children: React.ReactNode; onExit?: () => void;
}) {
  // Open a drill with its pitch on screen. The intro card is taller than the
  // screen, so "Let's go" is reached by scrolling — and the drill then opened
  // at that same scroll: 344 px down, the goal off the top (phone audit,
  // 26 Sep 2026), with a pitch that swallows the swipe you'd use to get back
  // up. The pitch wins over the tries row above it when both can't fit (a
  // phone under the site nav): it is the thing being played. Instant, not
  // smooth, so any clock starts on a still screen.
  const pitchRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    revealOnScreen(pitchRef.current, { smooth: false });
  }, []);
  const { skill, glow } = useContext(DrillLook);
  const look = SKILL_LOOK[skill];
  const onTry = Math.max(0, TRIES - results.length);
  return (
    <div className="h-[100dvh] overflow-y-auto text-white flex flex-col items-center py-3 px-3"
      style={{ background: `radial-gradient(90% 50% at 50% 0%, ${rgba(glow, 0.35)}, transparent 70%), var(--sk-page, linear-gradient(180deg, #0b1220, #05070d))` }}>
      <div className="w-full max-w-sm">
        <div className="relative overflow-hidden rounded-2xl p-2.5"
          style={{
            background: `radial-gradient(120% 90% at 0% 0%, ${rgba(glow, 0.32)}, transparent 60%), var(--sk-card, linear-gradient(180deg, rgba(31,41,55,.94), rgba(10,14,24,.97)))`,
            boxShadow: `inset 0 1px 0 rgba(255,255,255,.12), inset 0 0 0 1px ${rgba(glow, 0.35)}, 0 0 26px -6px ${rgba(glow, 0.55)}, 0 10px 24px -12px rgba(0,0,0,.8)`,
          }}>
          <Shine loop every={6} />
          {onExit && (
            <button onClick={onExit} className="relative mb-1.5 rounded-full bg-black/30 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-white/70 hover:bg-black/45 hover:text-white">
              ✕ Exit
            </button>
          )}
          <div className="relative flex items-center justify-between mb-2">
            {/* The three tries, as glowing pips. */}
            <div className="flex items-center gap-1.5">
              {Array.from({ length: TRIES }).map((_, i) => {
                const r = results[i];
                const now = r === undefined && i === results.length;
                return (
                  <span key={i}
                    className={`grid h-7 w-7 place-items-center rounded-full text-[12px] font-black ${now ? "animate-pulse" : ""}`}
                    style={r === true
                      ? { background: "#34d399", color: "#052e1b", boxShadow: "0 0 12px #34d399" }
                      : r === false
                        ? { background: "#ef4444", color: "#fff", boxShadow: "0 0 10px rgba(239,68,68,.7)" }
                        : now
                          ? { border: `2px solid ${look.accent}`, color: "#fff", boxShadow: `0 0 12px ${rgba(look.accent, 0.8)}` }
                          : { border: "2px solid rgba(255,255,255,.25)", color: "#fff" }}>
                    {r === true ? "✓" : r === false ? "✗" : i + 1}
                  </span>
                );
              })}
            </div>
            {/* The skill and level badge. */}
            <div className="text-right">
              <div className="text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: look.accent, textShadow: `0 0 10px ${rgba(look.accent, 0.6)}` }}>
                {look.icon} {look.label} · {title}
              </div>
              <div className="text-[16px] font-black leading-tight text-white">
                LEVEL {trainingLevel}{" "}
                <span className="text-amber-300" style={{ textShadow: "0 0 10px rgba(251,191,36,.6)" }}>
                  {"★".repeat(onTry)}<span className="text-white/25">{"★".repeat(TRIES - onTry)}</span>
                </span>
              </div>
            </div>
          </div>
          {/* -mx-2.5 undoes the card's own 10 px padding for the pitch alone, so the
              drill plays at the real match's width (366 px on a phone, was 346; 384
              on a computer, was 364 — drift audit, 19 Oct 2026). */}
          <div ref={pitchRef} className="relative -mx-2.5 overflow-hidden rounded-xl"
            style={{ boxShadow: `0 0 0 1px ${rgba(glow, 0.45)}, 0 0 18px -4px ${rgba(glow, 0.6)}` }}>
            {children}
          </div>
          <div className="relative mt-2 rounded-xl px-3 py-2 text-center text-[12px] font-black text-white"
            style={{ background: "rgba(0,0,0,.35)", boxShadow: `inset 0 0 0 1px ${rgba(look.accent, 0.35)}` }}>
            {instruction}
          </div>
        </div>
      </div>
    </div>
  );
}

function Flash({ text, good }: { text: string; good: boolean }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
      <div className={`kib-pop rounded-2xl px-5 py-2 text-3xl font-black italic tracking-tight text-white ${good ? "bg-emerald-500/85" : "bg-red-600/85"}`}
        style={{ boxShadow: good ? "0 0 30px rgba(52,211,153,.8)" : "0 0 30px rgba(239,68,68,.7)", textShadow: "0 2px 6px rgba(0,0,0,.6)" }}>
        {text}
      </div>
      {good && <Burst colors={["#34d399", "#fde047", "#ffffff"]} count={18} className="left-1/2 top-1/2" />}
    </div>
  );
}

/**
 * True while most of this element (85%) is on screen. A timed drill's clock
 * waits on it: Vision used to count down and time out off the top of the
 * screen, so a phone showed "TOO SLOW" on a try the player never saw.
 */
function useMostlyOnScreen(ref: React.RefObject<HTMLElement>): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let raf = 0;
    const check = () => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const seen = Math.max(0, Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0));
      setOn(r.height > 0 && seen / r.height >= 0.85);
    };
    const onMove = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(check); };
    check();
    window.addEventListener("scroll", onMove, { passive: true });
    window.addEventListener("resize", onMove);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onMove);
      window.removeEventListener("resize", onMove);
    };
  }, [ref]);
  return on;
}

/** Sizes a canvas to its wrapper at devicePixelRatio and keeps it there. */
function useCanvasSize(canvasRef: React.RefObject<HTMLCanvasElement>, wrapRef: React.RefObject<HTMLDivElement>) {
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
  }, [canvasRef, wrapRef]);
}

// ═══════════════════════════════════════════════════════════════════════════
// STRIKING — power, technique and free kick share this one drill
// ═══════════════════════════════════════════════════════════════════════════

export type StrikeKind = "power" | "technique" | "freeKick";

/**
 * What each drill puts on the pitch. The ball, the kick and the flight are the
 * real match's; everything else is only there if the drill is about it.
 * Harry, 24 Sep 2026: "technique training does not need a goalie/goal yet in
 * every drill there's a keeper... we literally just need the mechanics."
 * - Technique: you, a ball and two cones. No keeper, no goal, nobody else.
 * - Power: the keeper and the bodies in the lane, but no poacher to tidy up.
 * - Free kick: the wall and the keeper, but no poacher either.
 * No drill shows the match's own GOAL/PASS text; the drill's flash says it.
 */
export const DRILL_SCENE: Record<StrikeKind, ScenePicture> = {
  technique: { keeper: false, goal: false, teammates: false, banners: false },
  // Its own close camera (scene.ownFrame, strikeViewport): in the new view's
  // zoomed-out camera the goal it is aimed at looked tiny (Mikey's v0.10
  // known issue). The same choice his woodwork challenge made.
  power: { teammates: false, banners: false, ownFrame: true },
  freeKick: { teammates: false, banners: false },
};

export interface StrikeSetup {
  scenario: Scenario;
  viewport: TrainingViewport;
  gate: { left: { x: number; y: number }; right: { x: number; y: number }; centre: { x: number; y: number } } | null;
  gateCfg: TechniqueLevel | null;
  /** What the HUD says this rep is asking for. */
  brief: string;
  /** Power's first levels: no keeper on the pitch (powerDrillForLevel). */
  openGoal?: boolean;
  /** The score a try needs to pass (gateQuality / shotQuality, 0-1). */
  pass: number;
}

/** The numbers a strike drill is built from: one level's row. */
export type StrikeLevel = PowerLevel | TechniqueLevel | FreeKickLevel;

/**
 * `byLevel` (Power only): build from the training LEVEL and the player's own
 * Power — an open goal first, and scaled to your Power (powerDrillForLevel,
 * Harry 2 Oct 2026). Absent: the old 0-100 ladder, as the trial and the
 * relationship games use it. Training levels themselves are built from
 * their saved row with `buildStrikeFrom`.
 */
export function buildStrike(
  kind: StrikeKind, level: number, rep: number, rng: () => number,
  byLevel?: { trainingLevel: number; power: number },
): StrikeSetup {
  if (kind === "technique") return buildStrikeFrom(kind, { ...techniqueDrill(level, rep), pass: 0.25 }, rng);
  if (kind === "freeKick") return buildStrikeFrom(kind, { ...freeKickDrill(level, rep), pass: 0.5 }, rng);
  const cfg = byLevel ? powerDrillForLevel(byLevel.trainingLevel, rep, byLevel.power) : { ...powerDrill(level, rep), keeper: true };
  return buildStrikeFrom(kind, { ...cfg, pass: 0.5 }, rng);
}

/** One strike drill's picture from a level's numbers. */
export function buildStrikeFrom(kind: StrikeKind, row: StrikeLevel, rng: () => number): StrikeSetup {
  if (kind === "technique") {
    const cfg = row as TechniqueLevel;
    // The ball sits far enough back that the gate always stands about six
    // metres in front of goal — so climbing the ladder moves YOU back, which
    // is what "the cones would be further back" actually looks like from
    // behind the ball.
    const ball = strikeSpot(cfg.gateDistance + 6, 0);
    const gate = conePositions(ball, cfg);
    const sc = buildScenario("long_range", rng, 40, 60, 55);
    sc.ball = { x: ball.x, y: ball.y };
    sc.player = { x: ball.x, y: ball.y + 0.8 };
    // A gate drill is you, a ball and two cones. Nobody is closing you down
    // and there is nothing to beat but the gap itself.
    sc.defenders = [];
    sc.teammates = [];
    sc.runner = null;
    sc.passTarget = null;
    sc.receiver = null;
    sc.secondaryRunners = [];
    initDefenders(sc, rng);
    sc.defenders = [];
    return {
      scenario: sc,
      viewport: gateViewport(ball, gate),
      gate,
      gateCfg: cfg,
      brief: `${cfg.gateDistance.toFixed(0)}m · ${cfg.gateWidth.toFixed(1)}m gate`,
      pass: cfg.pass,
    };
  }

  if (kind === "freeKick") {
    const cfg = row as FreeKickLevel;
    const ball = strikeSpot(cfg.distance, cfg.offset);
    const sc = buildScenario("free_kick", rng, cfg.keeperStrength, 60, 55);
    sc.ball = { x: ball.x, y: ball.y };
    sc.player = { x: ball.x, y: ball.y + 0.8 };
    sc.keeperStrength = cfg.keeperStrength;
    initDefenders(sc, rng);
    // A real wall: 9.15 m from the ball, square across the line to goal, and
    // holding rather than charging. The engine jumps a free-kick wall as the
    // ball is struck all by itself (Defender.z/vz), which is what makes going
    // over one a moving target rather than a fixed height.
    const gx = CX - ball.x, gy = 0 - ball.y;
    const gl = Math.hypot(gx, gy) || 1;
    const ux = gx / gl, uy = gy / gl;
    const wallCx = ball.x + ux * 9.15, wallCy = ball.y + uy * 9.15;
    const px = -uy, py = ux;
    sc.defenders = Array.from({ length: cfg.wall }, (_, i) => {
      const off = (i - (cfg.wall - 1) / 2) * 1.15; // 1.15 m apart, the real engine's own wall spacing
      return {
        x: Math.max(1, Math.min(PITCH_W - 1, wallCx + px * off)),
        y: Math.max(0.6, wallCy + py * off),
        role: "hold" as const,
        baseRole: "hold" as const,
        speed: 0,
        z: 0,
        vz: 0,
      };
    });
    return {
      scenario: sc,
      viewport: strikeViewport(ball),
      gate: null,
      gateCfg: null,
      brief: `${cfg.distance.toFixed(0)}m · ${cfg.wall}-man wall`,
      pass: cfg.pass,
    };
  }

  const cfg = row as PowerLevel;
  const ball = strikeSpot(cfg.distance, cfg.offset);
  const sc = buildScenario("long_range", rng, cfg.keeperStrength, 60, 55);
  sc.ball = { x: ball.x, y: ball.y };
  sc.player = { x: ball.x, y: ball.y + 0.8 };
  sc.keeperStrength = cfg.keeperStrength;
  initDefenders(sc, rng);
  // Bodies in the way, strung across the shooting lane at staggered depths so
  // they are a problem to shoot THROUGH rather than a single line to clear.
  sc.defenders = Array.from({ length: cfg.blockers }, (_, i) => {
    const f = 0.30 + (i / Math.max(1, cfg.blockers)) * 0.42;
    const laneX = ball.x + (CX - ball.x) * f;
    const spread = (i % 2 === 0 ? -1 : 1) * (1.1 + i * 0.7);
    return {
      x: Math.max(1, Math.min(PITCH_W - 1, laneX + spread)),
      y: Math.max(1.5, ball.y * (1 - f)),
      role: "hold" as const,
      baseRole: "hold" as const,
      speed: 0.9,
      z: 0,
      vz: 0,
    };
  });
  return {
    scenario: sc,
    viewport: strikeViewport(ball),
    gate: null,
    gateCfg: null,
    brief: (cfg.keeper
      ? `${cfg.distance.toFixed(0)}m · ${cfg.blockers} in the way`
      : `${cfg.distance.toFixed(0)}m · open goal`) + (cfg.pass > 0.5 ? " · near a post" : ""),
    openGoal: !cfg.keeper,
    pass: cfg.pass,
  };
}

function StrikeDrill({
  kind, trainingLevel, skills, onFinish, onExit, override,
}: { kind: StrikeKind; trainingLevel: number; skills: Skills; onFinish: (stars: number) => void; onExit?: () => void; override?: StrikeLevel }) {
  // One real match engine (CanvasMatch, via EngineFeature) — the same aim,
  // contact, flight, keeper and wall a match has. This file only builds the
  // picture for each rep and scores the result. See .claude/skills/one-engine.
  // A level is one fixed picture: the same numbers, the same seed, the same
  // layout on every try, so it can be learnt (Mikey, 25 Sep 2026). The
  // numbers are the level's row (lib/star/trainingLevelData.ts).
  const rep = 0;
  const { results, attempt, done } = useTries(onFinish);
  // Power is the level's row eased toward YOUR Power when you are behind it
  // (Harry, 2 Oct 2026). Held for the whole drill: a level is one picture.
  const powerNow = skills.power;
  const row = useMemo((): StrikeLevel => {
    const rowAt = (n: number): StrikeLevel => (n === trainingLevel && override ? override : levelConfig(kind, n));
    if (kind !== "power") return rowAt(trainingLevel);
    return easePowerLevel(trainingLevel, powerNow, n => rowAt(n) as PowerLevel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, trainingLevel, override]);
  const seedRef = useRef(levelSeedOf(kind, trainingLevel, row));
  seedRef.current = levelSeedOf(kind, trainingLevel, row);
  const setupRef = useRef<StrikeSetup | null>(null);
  const prevRef = useRef<{ x: number; y: number; z: number } | null>(null);
  const crossedRef = useRef<{ x: number; z: number } | null>(null);
  const [flash, setFlash] = useState<{ text: string; good: boolean } | null>(null);
  const keeperStrength = kind === "technique" ? 40 : (row as PowerLevel | FreeKickLevel).keeperStrength;

  const openOn = useCallback((): Scenario => {
    const setup = buildStrikeFrom(kind, row, mulberry32(seedRef.current));
    setup.scenario.viewport = { ...setup.viewport };
    setupRef.current = setup;
    prevRef.current = null;
    crossedRef.current = null;
    return setup.scenario;
  }, [kind, row]);

  // The HUD line and the cones for this rep — the same seeded build the
  // engine was handed, so the cones stand exactly where the gate is judged.
  const view = useMemo(() => {
    const setup = buildStrikeFrom(kind, row, mulberry32(seedRef.current));
    return {
      brief: setup.brief,
      openGoal: !!setup.openGoal,
      markers: setup.gate ? [
        { x: setup.gate.left.x, y: setup.gate.left.y },
        { x: setup.gate.right.x, y: setup.gate.right.y },
      ] : [],
    };
  }, [kind, row]);
  const brief = view.brief;
  const markers = view.markers;

  // Gate crossing: judged on the two samples that straddle the gate's own
  // line, so a fast ball is still judged on where it really crossed.
  const onBallStep = useCallback((b: { x: number; y: number; z: number }) => {
    const setup = setupRef.current;
    if (!setup?.gate || crossedRef.current) return;
    const prev = prevRef.current;
    if (prev) {
      const c = gateCrossing(prev, b, setup.gate.centre.y);
      if (c) crossedRef.current = c;
    }
    prevRef.current = { ...b };
  }, []);

  const onChanceResolved = useCallback((info: ChanceResolved) => {
    const setup = setupRef.current;
    if (!setup) return;
    let q: number;
    let text: string;
    if (setup.gate && setup.gateCfg) {
      q = gateQuality(crossedRef.current, setup.gateCfg, setup.gate.centre.x);
      text = q >= 0.9 ? "THREADED!" : q >= 0.45 ? "THROUGH" : q > 0 ? "CLIPPED IT" : "MISSED THE GATE";
    } else {
      const o = info.teammateShot ? "saved" : info.outcome;
      const reached = o === "goal" || o === "rebound" || o === "wide" || o === "over" || o === "post";
      q = shotQuality(o, reached && info.ball ? info.ball.x : null);
      text = o === "goal" || o === "rebound"
        ? (q < setup.pass ? "TOO CENTRAL" : q > 0.85 ? "TOP CORNER!" : "GOAL!")
        : o === "saved" || o === "tipped" ? "SAVED"
        : o === "caught" ? "CAUGHT"
        : o === "post" ? "OFF THE POST"
        : o === "blocked" || o === "tackled" ? "BLOCKED"
        : o === "over" ? "OVER"
        : "WIDE";
    }
    // Passed: the level's own score to pass (lib/star/trainingLevelData.ts):
    // 0.25 = anywhere through the cones, 0.5 = any goal, more = nearer a post.
    const ok = q >= setup.pass;
    setFlash({ text, good: ok });
    window.setTimeout(() => setFlash(null), 1000);
    attempt(ok);
  }, [attempt]);

  const instruction = kind === "technique"
    ? "Drag back from the ball to aim and set power, then pick your spot on the ball to bend it through the cones."
    : kind === "freeKick"
      ? "Drag back to aim and set power, then strike it over the wall or round it."
      : "Drag back to aim and set power, then pick your spot on the ball.";

  return (
    <Shell title={SKILL_TITLES[kind]} instruction={instruction} results={results} trainingLevel={trainingLevel} onExit={onExit}>
      <div className="relative">
        {!done && <EngineFeature
          openOn={openOn}
          onChanceResolved={onChanceResolved}
          onBallStep={onBallStep}
          markers={markers}
          skills={{ power: skills.power, technique: skills.technique }}
          setPieceSkill={skills.freeKick}
          keeperStrength={keeperStrength}
          seed={seedRef.current}
          scene={view.openGoal ? { ...DRILL_SCENE.power, keeper: false } : DRILL_SCENE[kind]}
        />}
        {brief && (
          <div className="pointer-events-none absolute top-2 left-2 z-30 rounded-md bg-black/55 px-2 py-1 text-[11px] font-black uppercase tracking-wide text-amber-200">
            {brief}
          </div>
        )}
        {flash && <Flash text={flash.text} good={flash.good} />}
      </div>
    </Shell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PACE — the gauntlet, on the real match's own first-person dribble
// ═══════════════════════════════════════════════════════════════════════════

function GauntletDrill({ trainingLevel, onFinish, onExit, override }: { trainingLevel: number; onFinish: (stars: number) => void; onExit?: () => void; override?: PaceLevel }) {
  // The same run a real match serves (FirstPersonDribble, same camera
  // settings as CanvasMatch's own mount). The level's row sets how many men,
  // how quick they are, and how quick you run (lib/star/trainingLevelData.ts).
  const { results, attempt, done } = useTries(onFinish);
  const [flash, setFlash] = useState<{ text: string; good: boolean } | null>(null);
  const [runKey, setRunKey] = useState(0);
  const cfg = override ?? levelConfig("pace", trainingLevel);
  // The drill's chaser count, in the real run's waves of up to `waveMax`.
  const waveSizes = useMemo(() => {
    const out: number[] = [];
    const max = Math.max(1, cfg.waveMax);
    for (let left = cfg.chasers; left > 0; left -= max) out.push(Math.min(max, left));
    return out;
  }, [cfg.chasers, cfg.waveMax]);
  const total = waveSizes.reduce((a, b) => a + b, 0);

  // Passed: you got to the line with the ball.
  const onComplete = useCallback((res: { cleared: boolean; beaten: number }) => {
    setFlash({ text: res.cleared ? (res.beaten >= total ? "GONE!" : "THROUGH") : "TACKLED", good: res.cleared });
    attempt(res.cleared);
    window.setTimeout(() => {
      setFlash(null);
      setRunKey(k => k + 1);
    }, 1000);
  }, [attempt, total]);

  return (
    <Shell
      title={SKILL_TITLES.pace}
      instruction="One man comes for the ball. Pick the gap, wait for his shoulder, and flick the other way as his ring turns green."
      results={results} trainingLevel={trainingLevel} onExit={onExit}
    >
      <div className="relative w-full overflow-hidden rounded-xl" style={{ aspectRatio: "5 / 8" }}>
        {!done && (
          <FirstPersonDribble
            key={runKey}
            embedded
            seed={levelSeedOf("pace", trainingLevel, cfg)}
            pace={cfg.runPace}
            oppStrength={cfg.oppStrength}
            waveSizes={waveSizes}
            chaseEye={5}
            chasePitchDeg={5}
            chaseOffset={4}
            cameraFollowRate={10}
            knockOn
            onComplete={onComplete}
          />
        )}
        {flash && <Flash text={flash.text} good={flash.good} />}
      </div>
    </Shell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// VISION — read the run
// ═══════════════════════════════════════════════════════════════════════════

// The picture is built in lib/star/visionRound.ts (buildVisionRound), from
// the level's row: how many team-mates, how clear the right one is, how many
// defenders, how many offside, how near the line.

function VisionDrillView({ trainingLevel, onFinish, onExit, override }: { trainingLevel: number; onFinish: (stars: number) => void; onExit?: () => void; override?: VisionLevel }) {
  const { results, attempt } = useTries(onFinish);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const facesRef = useRef(createFaceImageCache());
  const [round, setRound] = useState<VisionRound | null>(null);
  const [flash, setFlash] = useState<{ text: string; good: boolean } | null>(null);
  const [left, setLeft] = useState(1);
  const startedRef = useRef(0);
  const answeredRef = useRef(false);
  const cfg: VisionLevel = override ?? levelConfig("vision", trainingLevel);
  // Which try this is (0, 1, 2). Each try is its OWN picture (20 Oct 2026):
  // with one picture for all three, and the right man lit after a try, the
  // second try was the answer — a modelled player passed 99.9% of levels
  // 20-30. The three pictures are fixed per level, so a level still plays
  // the same way every time.
  const tryRef = useRef(0);
  // 3, 2, 1, GO before every try, with the picture hidden (Mikey, 25 Sep
  // 2026). 0 is "GO"; null once it's over and the clock is running.
  const [count, setCount] = useState<number | null>(3);
  const countRef = useRef<number | null>(3);
  countRef.current = count;

  useCanvasSize(canvasRef, wrapRef);
  // The countdown (and so the clock) only runs while the pitch is on screen.
  const onScreen = useMostlyOnScreen(wrapRef);

  const seed = levelSeedOf("vision", trainingLevel, cfg);
  const cfgKey = JSON.stringify(cfg);
  const startRep = useCallback((t: number) => {
    setRound(buildVisionRound(cfg, mulberry32((seed + t * 7919) >>> 0)));
    startedRef.current = performance.now();
    answeredRef.current = false;
    setLeft(1);
    setCount(3);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfgKey, seed]);

  useEffect(() => { tryRef.current = 0; startRep(0); }, [startRep]);

  const answer = useCallback((i: number | null) => {
    if (answeredRef.current || !round) return;
    answeredRef.current = true;
    const picked = i === null ? null : round.mates[i];
    let q = 0;
    let text = "TOO SLOW";
    if (picked) {
      if (!picked.onside) { q = 0; text = "OFFSIDE!"; }
      else if (i === round.best) {
        const spent = (performance.now() - startedRef.current) / 1000;
        q = Math.max(0.5, Math.min(1, 1 - (spent / cfg.window) * 0.5));
        text = q > 0.85 ? "PERFECT BALL!" : "GOOD BALL";
      } else {
        // Onside but not the best ball on — a real pass, just not the one the
        // picture was asking for.
        q = 0.3;
        text = "SAFE BALL";
      }
    }
    // Passed: the best ball on, in time.
    const ok = !!picked && picked.onside && i === round.best;
    setFlash({ text, good: ok });
    attempt(ok);
    window.setTimeout(() => {
      setFlash(null);
      if (!ok) { tryRef.current += 1; startRep(tryRef.current); }
    }, 950);
  }, [round, cfg.window, attempt, startRep]);

  // The countdown: 3, 2, 1 a beat apart, then GO, then the picture and the
  // clock start together — and not before the pitch is on screen: the count
  // holds on its number until it is.
  useEffect(() => {
    if (count === null || !onScreen) return;
    const t = window.setTimeout(() => {
      if (count > 0) setCount(count - 1);
      else {
        startedRef.current = performance.now();
        setCount(null);
      }
    }, count > 0 ? 700 : 450);
    return () => window.clearTimeout(t);
  }, [count, onScreen]);

  // The clock.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (answeredRef.current || countRef.current !== null) return;
      const spent = (performance.now() - startedRef.current) / 1000;
      const frac = Math.max(0, 1 - spent / cfg.window);
      setLeft(frac);
      if (frac <= 0) answer(null);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [cfg.window, answer]);

  // The picture.
  useEffect(() => {
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const c = canvasRef.current;
      if (!c || !round) return;
      renderTrainingScene(c, {
        viewport: round.viewport,
        goal: false,
        defenders: round.defenders.map((d, i) => ({
          ...d, face: facesRef.current.get(fakeFaceFor(`defender-${i}`)),
        })),
        mates: round.mates.map((m, i) => ({
          x: m.x, y: m.y,
          highlight: answeredRef.current && i === round.best,
          dim: answeredRef.current && i !== round.best,
          face: facesRef.current.get(fakeFaceFor(`mate-${i}`)),
        })),
        you: { x: CX, y: round.viewport.y2 - 3, face: facesRef.current.get(fakeFaceFor("you")) },
        ball: { x: CX, y: round.viewport.y2 - 2.2, z: 0 },
        offsideLine: round.line,
      });
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [round]);

  const tap = (e: React.PointerEvent) => {
    const c = canvasRef.current;
    if (!c || !round || answeredRef.current || countRef.current !== null) return;
    const r = c.getBoundingClientRect();
    const vp = round.viewport;
    const x = vp.x1 + ((e.clientX - r.left) / r.width) * (vp.x2 - vp.x1);
    const y = vp.y1 + ((e.clientY - r.top) / r.height) * (vp.y2 - vp.y1);
    const bestI = visionTapPick(round, x, y, cfg.tapRadius);
    if (bestI >= 0) answer(bestI);
  };

  return (
    <Shell
      title={SKILL_TITLES.vision}
      instruction="Pick the best ball on: the man in the most space who is still ONSIDE — behind the yellow line."
      results={results} trainingLevel={trainingLevel} onExit={onExit}
    >
      <div
        ref={wrapRef}
        className="relative w-full overflow-hidden rounded-xl border-2 border-emerald-800 shadow-2xl touch-none select-none"
        style={{ aspectRatio: "5 / 8" }}
      >
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full touch-none" onPointerDown={tap} />
        <div className="pointer-events-none absolute inset-x-2 top-2 h-1.5 rounded-full bg-black/40 overflow-hidden">
          <div
            className={`h-full rounded-full ${left > 0.4 ? "bg-emerald-400" : "bg-red-400"}`}
            style={{ width: `${left * 100}%` }}
          />
        </div>
        {count !== null && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-gray-950">
            <div key={count} className="text-7xl font-black text-white">
              {count > 0 ? count : "GO!"}
            </div>
            <div className="mt-3 text-base font-black text-emerald-300">Pick the free pass</div>
          </div>
        )}
        {flash && <Flash text={flash.text} good={flash.good} />}
      </div>
    </Shell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════

function CompleteScreen({ title, trainingLevel, stars }: { title: string; trainingLevel: number; stars: number }) {
  const { skill, glow } = useContext(DrillLook);
  const look = SKILL_LOOK[skill];
  const verdict = stars === 3 ? "First time!" : stars === 2 ? "Second try" : stars === 1 ? "Just made it" : "Not this time";
  return (
    <div className="h-[100dvh] overflow-y-auto text-white flex flex-col items-center justify-center py-3 px-3"
      style={{ background: `radial-gradient(80% 50% at 50% 30%, ${rgba(glow, 0.4)}, transparent 70%), var(--sk-page, linear-gradient(180deg, #0b1220, #05070d))` }}>
      <div className="relative w-full max-w-sm overflow-hidden rounded-2xl p-6 text-center"
        style={{
          background: `radial-gradient(120% 90% at 50% 0%, ${rgba(look.accent, 0.3)}, transparent 60%), var(--sk-card, linear-gradient(180deg, rgba(31,41,55,.95), rgba(10,14,24,.98)))`,
          boxShadow: `inset 0 1px 0 rgba(255,255,255,.14), inset 0 0 0 1px ${rgba(look.accent, 0.4)}, 0 0 40px -8px ${rgba(glow, 0.7)}`,
        }}>
        <Glow color={stars > 0 ? "#fbbf24" : look.accent} alpha={0.35} pulse className="inset-10 blur-2xl" />
        <Shine trigger={stars > 0 ? 1 : 0} />
        <div className="relative text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: look.accent }}>
          {look.icon} {look.label} · {title} · Level {trainingLevel}
        </div>
        {/* The stars pop in one after another. */}
        <div className="relative mt-4 flex justify-center gap-2 text-6xl leading-none">
          {[0, 1, 2].map(i => (
            <span key={i} className={i < stars ? "kib-pop" : ""}
              style={i < stars
                ? { color: "#fcd34d", textShadow: "0 0 18px rgba(251,191,36,.9), 0 3px 0 #92400e", animationDelay: `${i * 220}ms`, animationFillMode: "both" }
                : { color: "rgba(255,255,255,.14)" }}>★</span>
          ))}
        </div>
        {stars > 0 && <Burst colors={["#fde047", "#ffffff", look.accent]} count={26} className="left-1/2 top-1/2" />}
        <div className="relative mt-4 text-2xl font-black italic text-white">{verdict}</div>
        <div className={`relative mx-auto mt-2 inline-block rounded-full px-3 py-1 text-[12px] font-black ${stars > 0 ? "bg-amber-400 text-gray-950" : "bg-white/15 text-white"}`}
          style={stars > 0 ? { boxShadow: "0 0 16px rgba(251,191,36,.6)" } : undefined}>
          {stars > 0 ? (trainingLevel < 30 ? `LEVEL ${trainingLevel + 1} UNLOCKED` : "TOP LEVEL DONE") : "Try it again next time"}
        </div>
      </div>
    </div>
  );
}

export default function TrainingMinigame(props: Props) {
  // The level's numbers: this device's copy of the saved levels at once, the
  // shared table once per page load (lib/star/trainingLevelStore.ts).
  if (typeof window !== "undefined") void ensureTrainingLevels();
  return (
    <DrillLook.Provider value={{ skill: props.skill, glow: props.glow ?? "#2F6F4E" }}>
      <KitStyles />
      <style>{`@keyframes kib-pop{0%{opacity:0;transform:scale(.3)}60%{opacity:1;transform:scale(1.18)}100%{opacity:1;transform:scale(1)}}.kib-pop{animation:kib-pop 420ms cubic-bezier(.2,.9,.25,1) both}`}</style>
      <TrainingMinigameInner {...props} />
    </DrillLook.Provider>
  );
}

function TrainingMinigameInner({ skill, trainingLevel, skills, onComplete, onExit, levelOverride }: Props) {
  const [result, setResult] = useState<number | null>(null);
  // Level 1 of every game opens on a short how-it-works card.
  const [introDone, setIntroDone] = useState(trainingLevel !== 1);
  const calledRef = useRef(false);

  useEffect(() => {
    if (result !== null && !calledRef.current) {
      calledRef.current = true;
      const t = setTimeout(() => onComplete(result), 1400);
      return () => clearTimeout(t);
    }
  }, [result, onComplete]);

  if (result !== null) return <CompleteScreen title={SKILL_TITLES[skill]} trainingLevel={trainingLevel} stars={result} />;
  if (!introDone) return <TrainingIntro skill={skill} onStart={() => setIntroDone(true)} />;

  switch (skill) {
    case "pace":
      return <GauntletDrill trainingLevel={trainingLevel} onFinish={setResult} onExit={onExit} override={levelOverride as PaceLevel | undefined} />;
    case "vision":
      return <VisionDrillView trainingLevel={trainingLevel} onFinish={setResult} onExit={onExit} override={levelOverride as VisionLevel | undefined} />;
    case "power":
    case "technique":
    case "freeKick":
      return <StrikeDrill kind={skill} trainingLevel={trainingLevel} skills={skills} onFinish={setResult} onExit={onExit} override={levelOverride as StrikeLevel | undefined} />;
    default:
      return <GauntletDrill trainingLevel={trainingLevel} onFinish={setResult} onExit={onExit} />;
  }
}
