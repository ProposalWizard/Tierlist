"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Skills } from "@/lib/star/types";
import { starsForTry } from "@/lib/star/trainingLevels";
import {
  levelConfig, levelSeedOf, easePowerLevel,
  type AnyLevel, type PowerLevel, type TechniqueLevel, type FreeKickLevel, type PaceLevel, type VisionLevel, type AerialLevel,
} from "@/lib/star/trainingLevelData";
import {
  loadVisionMoments, visionMomentsReady, visionLevelPicturesAsync, visionAsk, visionScenario,
  judgeKick, judgeTap, tapPick, camToBox, aimedMan,
  type VisionPicture, type VisionVerdict,
} from "@/lib/star/visionRound";
import { REAL_CREDIT } from "@/lib/star/realMoments/types";
import { offlineDevPlayEnabled } from "@/lib/star/devMode";
import { EngineFrameContext, type EngineFrame, type EngineFrameObserver } from "@/lib/star/engineFrame";
import { ensureTrainingLevels } from "@/lib/star/trainingLevelStore";
import { mulberry32 } from "@/lib/star/season";
import {
  buildScenario, initDefenders,
  type Scenario,
} from "@/lib/star/canvasEngine";
import { CX } from "@/lib/star/pitch";
import { setAirZ, type AirHeighted } from "@/lib/star/airDrawings";
import {
  powerDrill, powerDrillForLevel, techniqueDrill, freeKickDrill,
  strikeSpot, conePositions, gateCrossing, gateQuality, shotQuality,
  powerManSpots, wallSpots, placedMen, techniqueBallSpot,
} from "@/lib/star/trainingDrills";
import {
  strikeViewport, gateViewport, type TrainingViewport,
} from "@/lib/star/trainingRender";
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
 *   Vision     → who should I pass to? A real picture on the real match
 *                (a real tracked pass, or one of the team's drawn chances):
 *                tap the right man early on, then kick the pass to him,
 *                inside a window that shrinks to 0.3 s (20 Oct 2026).
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
  /**
   * Play the level's numbers exactly, with no easing toward your Power (the
   * Training levels page: a level is checked as it is drawn and dragged).
   * Absent = as a career plays it.
   */
  asDrawn?: boolean;
}

const SKILL_TITLES: Record<keyof Skills, string> = {
  pace: "The Gauntlet",
  power: "Long Range",
  technique: "Through the Gate",
  vision: "Pick the Pass",
  freeKick: "Over the Wall",
  aerial: "Head & Volley",
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
  aerial: { icon: "🤸", label: "Aerial", accent: "#2dd4bf" },
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
          {/* Right padding keeps the corner "?" off the words (Mikey's playtest, 24 Oct 2026). */}
          <div className="relative mt-2 rounded-xl py-1.5 pl-3 pr-11 text-center text-[11.5px] font-black leading-snug text-white"
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

// ═══════════════════════════════════════════════════════════════════════════
// STRIKING — power, technique and free kick share this one drill
// ═══════════════════════════════════════════════════════════════════════════

export type StrikeKind = "power" | "technique" | "freeKick" | "aerial";

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
  // Aerial: the crosser stays on (the ball came from him), the keeper and
  // the one marker of the level. Its own close camera like Power.
  aerial: { banners: false, ownFrame: true },
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
export type StrikeLevel = PowerLevel | TechniqueLevel | FreeKickLevel | AerialLevel;

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
  if (kind === "aerial") return buildStrikeFrom(kind, { volley: rep % 2 === 1, keeperStrength: 20 + 0.76 * Math.max(0, level - 40) / 0.6, marker: level >= 55, pass: 0.5, ballZ: 1.75 + 0.8 * Math.max(0, Math.min(1, (level - 40) / 60)) }, rng);
  if (kind === "freeKick") return buildStrikeFrom(kind, { ...freeKickDrill(level, rep), pass: 0.5 }, rng);
  const cfg = byLevel ? powerDrillForLevel(byLevel.trainingLevel, rep, byLevel.power) : { ...powerDrill(level, rep), keeper: true };
  return buildStrikeFrom(kind, { ...cfg, pass: 0.5 }, rng);
}

/** One strike drill's picture from a level's numbers. */
export function buildStrikeFrom(kind: StrikeKind, row: StrikeLevel, rng: () => number): StrikeSetup {
  if (kind === "aerial") {
    // The real match's own header / volley chance (canvasEngine buildHeader,
    // buildVolley): the ball in the air off a cross, the crosser on the
    // wing, the keeper and the builder's one defender. The strike screen is
    // the match's own (Head it? / the volley's green band).
    const cfg = row as AerialLevel;
    const sc = buildScenario(cfg.volley ? "volley" : "header", rng, cfg.keeperStrength, 60, 55);
    sc.keeperStrength = cfg.keeperStrength;
    if (!cfg.marker) sc.defenders = [];
    sc.runner = null;
    sc.passTarget = null;
    sc.receiver = null;
    sc.secondaryRunners = [];
    // A header: the level's cross height (the jump it needs: aerial.ts headerJump).
    if (!cfg.volley && Number.isFinite(cfg.ballZ)) setAirZ(sc as Scenario & AirHeighted, cfg.ballZ);
    return {
      scenario: sc,
      viewport: strikeViewport(sc.ball),
      gate: null,
      gateCfg: null,
      brief: `${cfg.volley ? "Volley" : `Header ${(Number.isFinite(cfg.ballZ) ? cfg.ballZ : 1.85).toFixed(2)} m`}${cfg.marker ? " · marked" : ""}` + (cfg.pass > 0.5 ? " · near a post" : ""),
      pass: cfg.pass,
    };
  }
  if (kind === "technique") {
    const cfg = row as TechniqueLevel;
    // The ball sits far enough back that the gate always stands about six
    // metres in front of goal — so climbing the ladder moves YOU back, which
    // is what "the cones would be further back" actually looks like from
    // behind the ball.
    const ball = techniqueBallSpot(cfg);
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
    // Where it was dragged to on the Training levels page, else the drill's
    // own wall (trainingDrills.ts wallSpots).
    sc.defenders = placedMen(wallSpots(ball, cfg.wall), cfg.men, cfg.wall).map(at => {
      return {
        x: at.x,
        y: at.y,
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
  // Where they were dragged to on the Training levels page, else strung
  // across the lane (trainingDrills.ts powerManSpots).
  sc.defenders = placedMen(powerManSpots(ball, cfg.blockers), cfg.men, cfg.blockers).map(at => {
    return {
      x: at.x,
      y: at.y,
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
  kind, trainingLevel, skills, onFinish, onExit, override, asDrawn,
}: { kind: StrikeKind; trainingLevel: number; skills: Skills; onFinish: (stars: number) => void; onExit?: () => void; override?: StrikeLevel; asDrawn?: boolean }) {
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
    if (kind !== "power" || asDrawn) return rowAt(trainingLevel);
    return easePowerLevel(trainingLevel, powerNow, n => rowAt(n) as PowerLevel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, trainingLevel, override, asDrawn]);
  const seedRef = useRef(levelSeedOf(kind, trainingLevel, row));
  seedRef.current = levelSeedOf(kind, trainingLevel, row);
  const setupRef = useRef<StrikeSetup | null>(null);
  const prevRef = useRef<{ x: number; y: number; z: number } | null>(null);
  const crossedRef = useRef<{ x: number; z: number } | null>(null);
  const [flash, setFlash] = useState<{ text: string; good: boolean } | null>(null);
  const keeperStrength = kind === "technique" ? 40 : (row as PowerLevel | FreeKickLevel | AerialLevel).keeperStrength;

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

  // Your Aerial rides on the kick skills, so the strike screen can show your jump.
  const kickSkills = useMemo(() => ({ power: skills.power, technique: skills.technique, aerial: skills.aerial }), [skills.power, skills.technique, skills.aerial]);
  const instruction = kind === "aerial"
    ? "The cross is in the air. Drag back to aim, then meet it: head it on top of the ball, or volley it as it drops."
    : kind === "technique"
    ? "Drag back to aim and set power. Pick a spot on the ball to bend it through the cones."
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
          skills={kickSkills}
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
            lanes={cfg.lanes}
            onComplete={onComplete}
          />
        )}
        {flash && <Flash text={flash.text} good={flash.good} />}
      </div>
    </Shell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// VISION — who should I pass to? (rebuilt 20 Oct 2026)
// ═══════════════════════════════════════════════════════════════════════════
//
// Harry: "the vision skill is horrendous. It's cluttered, and the skill gap
// doesn't increase. I don't like the line on the pitch … real scenarios: Who
// should I pass to? Have someone offside. Lessen the time … early on you tap,
// then you actually have to kick the ball." And: "I don't like how it's in
// the old 2D style."
//
// Each try is a REAL picture (lib/star/visionRound.ts: a real tracked pass,
// or one of the team's drawn chances), played on the real match
// (EngineFeature): the match's own new view, its own figures, no line drawn.
//  - Tap levels: tap the man you'd pass to before the bar runs out.
//  - Kick levels: play the pass with the real drag and strike. The window is
//    the time to START the kick (your pull on the ball); then you must let go
//    inside the level's let-go time. The engine judges the pass: did it reach
//    the right man, was he offside, was it cut out.
// The drill reads the match only through its observers (the frame reader for
// where a man is on the glass and when your pull starts; onBallStep and
// onChanceResolved for what the pass did). No loop of its own.

type VisionPhase = "count" | "play" | "result";

/** Where the match's pitch box sits inside our own box, for the overlays. */
function boxOffset(pitch: HTMLDivElement | null, mine: HTMLDivElement | null): { x: number; y: number } {
  if (!pitch || !mine) return { x: 0, y: 0 };
  const a = pitch.getBoundingClientRect(), b = mine.getBoundingClientRect();
  return { x: a.left + pitch.clientLeft - b.left, y: a.top + pitch.clientTop - b.top };
}

function VisionDrillView({ trainingLevel, skills, onFinish, onExit, override }: { trainingLevel: number; skills: Skills; onFinish: (stars: number) => void; onExit?: () => void; override?: VisionLevel }) {
  const { results, attempt, done } = useTries(onFinish);
  const cfg: VisionLevel = override ?? levelConfig("vision", trainingLevel);
  const cfgKey = JSON.stringify(cfg);
  const seed = levelSeedOf("vision", trainingLevel, cfg);
  // The real moments load the first time Vision is played.
  const [ready, setReady] = useState(visionMomentsReady());
  useEffect(() => {
    if (ready) return;
    let live = true;
    void loadVisionMoments().then(() => { if (live) setReady(true); });
    return () => { live = false; };
  }, [ready]);
  // The level's three pictures, one per try, fixed by the level's seed. Built
  // with every level below it, so a picture from an earlier level comes back
  // as rarely as the pictures allow (a first play of a high level builds them
  // all, a frame between levels).
  const [pics, setPics] = useState<VisionPicture[]>([]);
  const [built, setBuilt] = useState(false);
  useEffect(() => {
    if (!ready) return;
    let live = true;
    setBuilt(false);
    const levelOf = (n: number) => {
      if (n === trainingLevel) return { ask: visionAsk(cfg), seed };
      const c = levelConfig("vision", n);
      return { ask: visionAsk(c), seed: levelSeedOf("vision", n, c) };
    };
    void visionLevelPicturesAsync(trainingLevel, levelOf, TRIES).then((p) => { if (live) { setPics(p); setBuilt(true); } });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, cfgKey, seed, trainingLevel]);
  const [tryIdx, setTryIdx] = useState(0);
  const pic: VisionPicture | undefined = pics[Math.min(tryIdx, pics.length - 1)];

  const [phase, setPhase] = useState<VisionPhase>("count");
  const [count, setCount] = useState(3);
  const [verdict, setVerdict] = useState<VisionVerdict | null>(null);
  const [tapped, setTapped] = useState<number | null>(null);
  const [left, setLeft] = useState(1);
  const [hold, setHold] = useState(false);
  const [rings, setRings] = useState<{ x: number; y: number; good: boolean }[]>([]);
  const phaseRef = useRef<VisionPhase>("count");
  phaseRef.current = phase;
  const goAtRef = useRef(0);
  const pullAtRef = useRef<number | null>(null);
  const letGoAtRef = useRef<number | null>(null);
  // Which man the aim arrow pointed at when you let go (for "you played it to an offside man").
  const aimedRef = useRef<number | null>(null);
  const strikeOffRef = useRef<boolean[] | null>(null);
  const scRef = useRef<Scenario | null>(null);
  const frameRef = useRef<EngineFrame | null>(null);
  const pitchRef = useRef<HTMLDivElement | null>(null);
  const mineRef = useRef<HTMLDivElement>(null);
  const picRef = useRef(pic);
  picRef.current = pic;

  // The countdown (and so the clock) only runs while the pitch is on screen.
  const onScreen = useMostlyOnScreen(mineRef);

  // A fresh try: the countdown again, nothing answered.
  useEffect(() => {
    setPhase("count");
    setCount(3);
    setVerdict(null);
    setTapped(null);
    setLeft(1);
    setHold(false);
    setRings([]);
    pullAtRef.current = null;
    letGoAtRef.current = null;
    aimedRef.current = null;
    strikeOffRef.current = null;
    scRef.current = null;
  }, [tryIdx, cfgKey]);

  // 3, 2, 1 a beat apart, then GO: the picture and the clock start together.
  useEffect(() => {
    if (phase !== "count" || !pic || !onScreen) return;
    const t = window.setTimeout(() => {
      if (count > 1) setCount(count - 1);
      else {
        goAtRef.current = performance.now();
        setPhase("play");
      }
    }, 650);
    return () => window.clearTimeout(t);
  }, [phase, count, pic, onScreen]);

  /** Ring the right man (and the wrong man you picked) where the match drew them. */
  const ringMen = useCallback((picked: number | null) => {
    const p = picRef.current, f = frameRef.current;
    if (!p || !f) return;
    const off = boxOffset(pitchRef.current, mineRef.current);
    const at = (i: number) => {
      const fig = f.figures.find((g) => g.sid === `run${i}`);
      const q = camToBox(f.cam, fig ? { x: fig.x, y: fig.y } : p.options[i]);
      return { x: off.x + q.x, y: off.y + q.y };
    };
    const out = [{ ...at(p.best), good: true }];
    if (picked !== null && picked !== p.best) out.push({ ...at(picked), good: false });
    setRings(out);
  }, []);

  const finish = useCallback((v: VisionVerdict, picked: number | null) => {
    if (phaseRef.current === "result") return;
    phaseRef.current = "result";
    setPhase("result");
    setVerdict(v);
    setTapped(picked);
    ringMen(picked);
    attempt(v.ok);
  }, [attempt, ringMen]);

  // After the result: a beat to see it, then the next try (a miss) or the end.
  useEffect(() => {
    if (phase !== "result" || !verdict) return;
    // A kick plays on a moment (he takes it, or it is cut out), then freezes.
    const freeze = window.setTimeout(() => setHold(true), cfg.kick ? 1300 : 0);
    const next = window.setTimeout(() => {
      if (!verdict.ok && tryIdx < TRIES - 1) setTryIdx(tryIdx + 1);
    }, 2300);
    return () => { window.clearTimeout(freeze); window.clearTimeout(next); };
  }, [phase, verdict, tryIdx, cfg.kick]);

  // The clock: tap levels until the tap; kick levels until the pull starts,
  // then the let-go time until it is released.
  useEffect(() => {
    if (phase !== "play") return;
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (phaseRef.current !== "play") return;
      const now = performance.now();
      const p = picRef.current;
      if (!p) return;
      if (!cfg.kick || pullAtRef.current === null) {
        const spent = (now - goAtRef.current) / 1000;
        setLeft(Math.max(0, 1 - spent / cfg.window));
        if (spent > cfg.window) finish(judgeTap(p, null), null);
      } else if (letGoAtRef.current === null) {
        const held = (now - pullAtRef.current) / 1000;
        setLeft(Math.max(0, 1 - held / cfg.letGo));
        if (held > cfg.letGo) finish(judgeTap(p, null), null);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, cfg.kick, cfg.window, cfg.letGo, finish]);

  // The match's own frames: where everyone is drawn, and (kick levels) the
  // moment your pull starts (the aim arrow appears) and is let go.
  const observer = useMemo((): EngineFrameObserver => ({
    hold,
    attach: (wrap) => { pitchRef.current = wrap; },
    onFrame: (f) => {
      frameRef.current = f;
      if (!cfg.kick || phaseRef.current !== "play") return;
      if (pullAtRef.current === null && (f.aim || f.phase !== "aim")) pullAtRef.current = performance.now();
      if (f.aim && picRef.current) aimedRef.current = aimedMan(picRef.current, { x: f.aim.to.x - f.aim.from.x, y: f.aim.to.y - f.aim.from.y });
      if (letGoAtRef.current === null && f.phase !== "aim") letGoAtRef.current = performance.now();
    },
  }), [hold, cfg.kick]);

  // The picture for this try, as the engine's Scenario. Kept, so what the
  // engine does to it (who took the ball, offside) can be read back.
  const openOn = useCallback((): Scenario => {
    const p = picRef.current!;
    const sc = visionScenario(p, (seed + tryIdx * 7919) >>> 0);
    scRef.current = sc;
    return sc;
  }, [seed, tryIdx]);

  // The pass, as the engine plays it.
  const onBallStep = useCallback(() => {
    const p = picRef.current, sc = scRef.current;
    if (!p || !sc || phaseRef.current !== "play") return;
    // The law's flags as the ball left your foot (a defender's touch clears them later).
    if (!strikeOffRef.current) strikeOffRef.current = sc.secondaryRunners.map((r) => !!r.offside);
    const v = judgeKick(p, sc, null, aimedRef.current, strikeOffRef.current);
    if (v) finish(v, sc.receivedBy ? sc.secondaryRunners.indexOf(sc.receivedBy) : aimedRef.current);
  }, [finish]);
  const onChanceResolved = useCallback((info: ChanceResolved) => {
    const p = picRef.current, sc = scRef.current;
    if (!p || !sc) return;
    if (phaseRef.current === "result") { setHold(true); return; }
    const v = judgeKick(p, sc, info.outcome, aimedRef.current, strikeOffRef.current ?? undefined);
    if (v) finish(v, sc.receivedBy ? sc.secondaryRunners.indexOf(sc.receivedBy) : aimedRef.current);
  }, [finish]);

  // Development only (compiled out of the live site, devMode.ts): the answer
  // and where this drill thinks each man is on the glass, so a playtest bot
  // can tap the right (or a wrong) man and check the drill's sums against
  // the match's own (window.__starMatch.frame()). Read-only.
  useEffect(() => {
    if (!offlineDevPlayEnabled() || typeof window === "undefined") return;
    const w = window as unknown as { __vision?: unknown };
    w.__vision = {
      phase: () => phaseRef.current,
      best: () => picRef.current?.best ?? -1,
      traps: () => picRef.current?.options.map((o) => o.trap) ?? [],
      onGlass: () => {
        const p = picRef.current, f = frameRef.current, box = pitchRef.current;
        if (!p || !f || !box) return null;
        const r = box.getBoundingClientRect();
        return p.options.map((o) => { const q = camToBox(f.cam, o); return { x: r.left + box.clientLeft + q.x, y: r.top + box.clientTop + q.y }; });
      },
      ball: () => {
        const p = picRef.current, f = frameRef.current, box = pitchRef.current;
        if (!p || !f || !box) return null;
        const r = box.getBoundingClientRect();
        const q = camToBox(f.cam, p.ball);
        return { x: r.left + box.clientLeft + q.x, y: r.top + box.clientTop + q.y };
      },
    };
    return () => { delete w.__vision; };
  }, []);

  // Tap levels: a tap on a man is the answer.
  const tap = (e: React.PointerEvent) => {
    const p = picRef.current, f = frameRef.current, box = pitchRef.current;
    if (!p || !f || !box || phaseRef.current !== "play" || cfg.kick) return;
    const r = box.getBoundingClientRect();
    const i = tapPick(f.cam, p.options, e.clientX - r.left - box.clientLeft, e.clientY - r.top - box.clientTop);
    if (i >= 0) finish(judgeTap(p, i), i);
  };

  const real = pic?.source === "real";
  const instruction = verdict
    ? verdict.line
    : cfg.kick
      ? `Play the pass: drag back from the ball to aim at him, then strike it. Start inside ${cfg.window.toFixed(1)}s.`
      : "Tap the team-mate you'd pass to. Not offside, not marked, nobody in the way.";

  return (
    <Shell title={SKILL_TITLES.vision} instruction={instruction} results={results} trainingLevel={trainingLevel} onExit={onExit}>
      <div ref={mineRef} className="relative" data-vision-phase={phase} data-vision-try={tryIdx}>
        {!pic ? (
          <div className="grid w-full place-items-center text-[13px] font-black text-white/70" style={{ aspectRatio: "5 / 9" }}>
            {built ? "No pictures for this level." : "Loading real moments…"}
          </div>
        ) : !done || phase === "result" ? (
          <EngineFrameContext.Provider value={observer}>
            <EngineFeature
              key={`${tryIdx}-${pic.id}`}
              openOn={openOn}
              onBallStep={onBallStep}
              onChanceResolved={onChanceResolved}
              skills={{ power: skills.power, technique: skills.technique }}
              seed={(seed + tryIdx) >>> 0}
              scene={VISION_SCENE}
            />
          </EngineFrameContext.Provider>
        ) : null}
        {/* The clock. */}
        {phase === "play" && (
          <div className="pointer-events-none absolute inset-x-2 top-2 z-30 h-1.5 overflow-hidden rounded-full bg-black/45">
            <div className={`h-full rounded-full ${left > 0.4 ? "bg-emerald-400" : "bg-red-400"}`} style={{ width: `${left * 100}%` }} />
          </div>
        )}
        {/* Tap levels: the pitch answers a tap, not a drag. Afterwards nothing on it takes a touch. */}
        {pic && ((phase === "play" && !cfg.kick) || phase === "result") && (
          <div className="absolute inset-0 z-20 touch-none" onPointerDown={tap} data-vision-tap />
        )}
        {/* The right man (green) and the wrong one you picked (red). */}
        {phase === "result" && rings.map((g, i) => (
          <div key={i} className="pointer-events-none absolute z-30" style={{ left: g.x, top: g.y }}>
            <div className="absolute -translate-x-1/2 -translate-y-1/2 rounded-[50%]"
              style={{ width: 46, height: 20, border: `3px solid ${g.good ? "#34d399" : "#ef4444"}`, boxShadow: `0 0 14px ${g.good ? "#34d399" : "#ef4444"}` }} />
            {/* A badge just above his head, so it reads as his and not as a mark on the pitch. */}
            <div className="absolute flex h-5 w-5 -translate-x-1/2 items-center justify-center rounded-full text-[12px] font-black leading-none text-white"
              style={{ top: -44, background: g.good ? "#10b981" : "#ef4444", boxShadow: "0 1px 4px rgba(0,0,0,.6)" }}>
              {g.good ? "✓" : "✗"}
            </div>
          </div>
        ))}
        {/* 3, 2, 1 — the picture stays hidden until GO. */}
        {pic && phase === "count" && (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-gray-950">
            <div key={count} className="text-7xl font-black text-white">{count}</div>
            <div className="mt-3 text-base font-black text-emerald-300">{cfg.kick ? "Who gets the pass? Kick it to him" : "Who gets the pass?"}</div>
          </div>
        )}
        {verdict && <Flash text={verdict.word} good={verdict.ok} />}
      </div>
      {real && pic && (
        <div className="mt-1 px-1 text-center text-[9.5px] leading-tight text-white/55" data-vision-credit>
          {phase === "result" && pic.match ? `${pic.match}, ${pic.minute}'. ` : "A real moment. "}
          {REAL_CREDIT[(pic.src ?? "dfl") as keyof typeof REAL_CREDIT] ?? ""}
        </div>
      )}
    </Shell>
  );
}

/** The Vision picture on the match: everything on, but the drill says what happened (no GOAL / PASS / OFFSIDE text). */
const VISION_SCENE: ScenePicture = { banners: false };

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

function TrainingMinigameInner({ skill, trainingLevel, skills, onComplete, onExit, levelOverride, asDrawn }: Props) {
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
      return <VisionDrillView trainingLevel={trainingLevel} skills={skills} onFinish={setResult} onExit={onExit} override={levelOverride as VisionLevel | undefined} />;
    case "power":
    case "technique":
    case "freeKick":
    case "aerial":
      return <StrikeDrill kind={skill} trainingLevel={trainingLevel} skills={skills} onFinish={setResult} onExit={onExit} override={levelOverride as StrikeLevel | undefined} asDrawn={asDrawn} />;
    default:
      return <GauntletDrill trainingLevel={trainingLevel} onFinish={setResult} onExit={onExit} />;
  }
}
