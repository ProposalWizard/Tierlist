"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Skills } from "@/lib/star/types";
import { levelDifficulty, levelSeed, starsForTry } from "@/lib/star/trainingLevels";
import { mulberry32 } from "@/lib/star/season";
import {
  buildScenario, initDefenders,
  type Scenario,
} from "@/lib/star/canvasEngine";
import { CX, PITCH_W } from "@/lib/star/pitch";
import {
  powerDrill, techniqueDrill, freeKickDrill, paceDrill, visionDrill,
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

function Shell({
  title, instruction, results, trainingLevel, children,
}: {
  title: string; instruction: string; results: boolean[];
  trainingLevel: number; children: React.ReactNode;
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
  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-950 to-gray-950 text-white flex flex-col items-center py-3 px-3">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 bg-gray-800 rounded-lg px-3 py-1.5 border border-gray-600">
            {Array.from({ length: TRIES }).map((_, i) => {
              const r = results[i];
              return (
                <span
                  key={i}
                  className={`grid h-5 w-5 place-items-center rounded-full text-[11px] font-black ${
                    r === true ? "bg-emerald-400 text-emerald-950" : r === false ? "bg-red-500 text-white" : i === results.length ? "border-2 border-amber-300 text-amber-200" : "border border-white/40 text-white"
                  }`}
                >
                  {r === true ? "✓" : r === false ? "✗" : i + 1}
                </span>
              );
            })}
          </div>
          <div className="text-right">
            <div className="text-[11px] font-black text-emerald-300 uppercase tracking-wide">{title}</div>
            <div className="text-xs text-amber-300 font-black">Level {trainingLevel} · {"★".repeat(Math.max(0, TRIES - results.length))} on this try</div>
          </div>
        </div>
        <div ref={pitchRef}>{children}</div>
        <div className="mt-2 bg-gray-800/90 border border-gray-600 rounded-lg px-3 py-2">
          <div className="text-xs font-bold text-gray-200 text-center">{instruction}</div>
        </div>
      </div>
    </div>
  );
}

function Flash({ text, good }: { text: string; good: boolean }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
      <div className={`text-3xl font-black ${good ? "text-emerald-300" : "text-red-400"} drop-shadow-[0_2px_6px_rgba(0,0,0,0.85)]`}>
        {text}
      </div>
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

type StrikeKind = "power" | "technique" | "freeKick";

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
const DRILL_SCENE: Record<StrikeKind, ScenePicture> = {
  technique: { keeper: false, goal: false, teammates: false, banners: false },
  power: { teammates: false, banners: false },
  freeKick: { teammates: false, banners: false },
};

interface StrikeSetup {
  scenario: Scenario;
  viewport: TrainingViewport;
  gate: { left: { x: number; y: number }; right: { x: number; y: number }; centre: { x: number; y: number } } | null;
  gateCfg: ReturnType<typeof techniqueDrill> | null;
  /** What the HUD says this rep is asking for. */
  brief: string;
}

function buildStrike(kind: StrikeKind, level: number, rep: number, rng: () => number): StrikeSetup {
  if (kind === "technique") {
    const cfg = techniqueDrill(level, rep);
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
    };
  }

  if (kind === "freeKick") {
    const cfg = freeKickDrill(level, rep);
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
    };
  }

  const cfg = powerDrill(level, rep);
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
    brief: `${cfg.distance.toFixed(0)}m · ${cfg.blockers} in the way`,
  };
}

function StrikeDrill({
  kind, trainingLevel, skills, onFinish,
}: { kind: StrikeKind; trainingLevel: number; skills: Skills; onFinish: (stars: number) => void }) {
  // One real match engine (CanvasMatch, via EngineFeature) — the same aim,
  // contact, flight, keeper and wall a match has. This file only builds the
  // picture for each rep and scores the result. See .claude/skills/one-engine.
  // A level is one fixed picture: the same difficulty, the same seed, the same
  // layout on every try, so it can be learnt (Mikey, 25 Sep 2026).
  const level = levelDifficulty(trainingLevel);
  const rep = 0;
  const { results, attempt, done } = useTries(onFinish);
  const seedRef = useRef(levelSeed(kind, trainingLevel));
  const setupRef = useRef<StrikeSetup | null>(null);
  const prevRef = useRef<{ x: number; y: number; z: number } | null>(null);
  const crossedRef = useRef<{ x: number; z: number } | null>(null);
  const [flash, setFlash] = useState<{ text: string; good: boolean } | null>(null);

  const openOn = useCallback((): Scenario => {
    const setup = buildStrike(kind, level, rep, mulberry32(seedRef.current));
    setup.scenario.viewport = { ...setup.viewport };
    setupRef.current = setup;
    prevRef.current = null;
    crossedRef.current = null;
    return setup.scenario;
  }, [kind, level]);

  // The HUD line and the cones for this rep — the same seeded build the
  // engine was handed, so the cones stand exactly where the gate is judged.
  const view = useMemo(() => {
    const setup = buildStrike(kind, level, rep, mulberry32(seedRef.current));
    return {
      brief: setup.brief,
      markers: setup.gate ? [
        { x: setup.gate.left.x, y: setup.gate.left.y },
        { x: setup.gate.right.x, y: setup.gate.right.y },
      ] : [],
    };
  }, [kind, level, rep]);
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
        ? (q > 0.85 ? "TOP CORNER!" : "GOAL!")
        : o === "saved" || o === "tipped" ? "SAVED"
        : o === "caught" ? "CAUGHT"
        : o === "post" ? "OFF THE POST"
        : o === "blocked" || o === "tackled" ? "BLOCKED"
        : o === "over" ? "OVER"
        : "WIDE";
    }
    // Passed: through the cones for the gate (anything inside them counts),
    // in the net for a shot or a free kick.
    const ok = setup.gate ? q >= 0.25 : q >= 0.5;
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
    <Shell title={SKILL_TITLES[kind]} instruction={instruction} results={results} trainingLevel={trainingLevel}>
      <div className="relative">
        {!done && <EngineFeature
          openOn={openOn}
          onChanceResolved={onChanceResolved}
          onBallStep={onBallStep}
          markers={markers}
          skills={{ power: skills.power, technique: skills.technique }}
          setPieceSkill={skills.freeKick}
          keeperStrength={kind === "technique" ? 40 : kind === "freeKick" ? freeKickDrill(level, rep).keeperStrength : powerDrill(level, rep).keeperStrength}
          seed={seedRef.current}
          scene={DRILL_SCENE[kind]}
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

function GauntletDrill({ trainingLevel, onFinish }: { trainingLevel: number; onFinish: (stars: number) => void }) {
  // The same run a real match serves (FirstPersonDribble, same camera
  // settings as CanvasMatch's own mount). Your pace stat is the run speed.
  const level = levelDifficulty(trainingLevel);
  const { results, attempt, done } = useTries(onFinish);
  const [flash, setFlash] = useState<{ text: string; good: boolean } | null>(null);
  const [runKey, setRunKey] = useState(0);
  const cfg = paceDrill(level, 0);
  // The drill's chaser count, in the real run's waves of up to three.
  const waveSizes = useMemo(() => {
    const out: number[] = [];
    for (let left = cfg.chasers; left > 0; left -= 3) out.push(Math.min(3, left));
    return out;
  }, [cfg.chasers]);
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
      instruction="Read each man as he commits, then burst the other way. Get to the line with the ball."
      results={results} trainingLevel={trainingLevel}
    >
      <div className="relative w-full overflow-hidden rounded-xl" style={{ aspectRatio: "5 / 8" }}>
        {!done && (
          <FirstPersonDribble
            key={runKey}
            embedded
            seed={levelSeed("pace", trainingLevel)}
            pace={level}
            oppStrength={cfg.oppStrength}
            waveSizes={waveSizes}
            chaseEye={5}
            chasePitchDeg={5}
            chaseOffset={4}
            cameraFollowRate={10}
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

interface VisionMate { x: number; y: number; space: number; onside: boolean; }
interface VisionRound {
  mates: VisionMate[];
  defenders: { x: number; y: number }[];
  line: number;
  best: number;
  viewport: TrainingViewport;
}

/**
 * One picture to read.
 *
 * Built rather than randomised into existence: mates and markers are thrown
 * down, everyone's space is measured, and then the best onside option is
 * pushed clear until it leads the next-best by the ladder's `margin`. At the
 * bottom of the ladder that margin is seven metres and the right ball is
 * obvious; at the top it is barely one, and you have under a second.
 */
function buildVisionRound(level: number, rep: number, rng: () => number): VisionRound {
  const cfg = visionDrill(level, rep);
  const line = 26 + rng() * 6;
  const n = cfg.options;
  // The frame is decided FIRST and everybody is placed inside it. Doing it
  // the other way round — scatter across the full 68 m pitch, then fit a
  // 5:8 frame to the spread — put half the options off the side of a
  // portrait canvas, where they could neither be read nor tapped.
  const viewW = 34;
  const x1 = CX - viewW / 2, x2 = CX + viewW / 2;
  const viewH = viewW / (5 / 8);
  const y1 = line - 12;
  const y2 = y1 + viewH;
  const spanX = (f: number) => x1 + 3 + f * (viewW - 6);

  const defenders = Array.from({ length: Math.max(3, Math.round(n * 0.8)) }, () => ({
    x: spanX(rng()),
    y: line + (rng() - 0.5) * 7,
  }));
  const mates: VisionMate[] = Array.from({ length: n }, () => {
    // Some of them run beyond the line — those are the ones you must NOT
    // pick, however much space they are standing in.
    const beyond = rng() < 0.42;
    const y = beyond ? line - 1.5 - rng() * 7 : line + 1.5 + rng() * 11;
    return { x: spanX(rng()), y, space: 0, onside: !beyond };
  });
  const spaceOf = (m: VisionMate) =>
    defenders.reduce((min, d) => Math.min(min, Math.hypot(d.x - m.x, d.y - m.y)), 99);
  for (const m of mates) m.space = spaceOf(m);

  const onside = mates.map((m, i) => ({ m, i })).filter(o => o.m.onside);
  if (onside.length === 0) {
    // Vanishingly unlikely, but a round with no legal pass is not a round.
    mates[0].onside = true;
    mates[0].y = line + 3;
    mates[0].space = spaceOf(mates[0]);
    onside.push({ m: mates[0], i: 0 });
  }
  onside.sort((a, b) => b.m.space - a.m.space);
  const best = onside[0];
  const runnerUp = onside[1]?.m.space ?? 0;
  // Push the best option clear of the field by the ladder's margin — walking
  // it away from its nearest marker rather than teleporting it, so the
  // picture still looks like a real one.
  let guard = 0;
  while (best.m.space < runnerUp + cfg.margin && guard++ < 40) {
    const near = defenders.reduce((a, d) =>
      Math.hypot(d.x - best.m.x, d.y - best.m.y) < Math.hypot(a.x - best.m.x, a.y - best.m.y) ? d : a, defenders[0]);
    const dx = best.m.x - near.x, dy = best.m.y - near.y;
    const l = Math.hypot(dx, dy) || 1;
    // Clamped to the fixed frame, not the whole pitch — the frame is what
    // has to stay readable, and this is the only step that can walk a mate
    // outside it.
    best.m.x = Math.max(x1 + 2, Math.min(x2 - 2, best.m.x + (dx / l) * 0.8));
    best.m.y = Math.max(line + 1.2, Math.min(y2 - 2, best.m.y + (dy / l) * 0.8));
    best.m.space = spaceOf(best.m);
  }

  return {
    mates, defenders, line, best: best.i,
    viewport: { x1, x2, y1, y2 },
  };
}

function VisionDrillView({ trainingLevel, onFinish }: { trainingLevel: number; onFinish: (stars: number) => void }) {
  const level = levelDifficulty(trainingLevel);
  const rep = 0;
  const { results, attempt } = useTries(onFinish);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const facesRef = useRef(createFaceImageCache());
  const [round, setRound] = useState<VisionRound | null>(null);
  const [flash, setFlash] = useState<{ text: string; good: boolean } | null>(null);
  const [left, setLeft] = useState(1);
  const startedRef = useRef(0);
  const answeredRef = useRef(false);
  const cfg = useMemo(() => visionDrill(level, rep), [level, rep]);
  // 3, 2, 1, GO before every try, with the picture hidden (Mikey, 25 Sep
  // 2026). 0 is "GO"; null once it's over and the clock is running.
  const [count, setCount] = useState<number | null>(3);
  const countRef = useRef<number | null>(3);
  countRef.current = count;

  useCanvasSize(canvasRef, wrapRef);
  // The countdown (and so the clock) only runs while the pitch is on screen.
  const onScreen = useMostlyOnScreen(wrapRef);

  // The same picture on every try: a fresh generator from the level's own seed.
  const startRep = useCallback((r: number) => {
    setRound(buildVisionRound(level, r, mulberry32(levelSeed("vision", trainingLevel))));
    startedRef.current = performance.now();
    answeredRef.current = false;
    setLeft(1);
    setCount(3);
  }, [level, trainingLevel]);

  useEffect(() => { startRep(0); }, [startRep]);

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
      if (!ok) startRep(rep);
    }, 950);
  }, [round, cfg.window, attempt, rep, startRep]);

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
    let bestI = -1, bestD = 3.2;
    round.mates.forEach((m, i) => {
      const d = Math.hypot(m.x - x, m.y - y);
      if (d < bestD) { bestD = d; bestI = i; }
    });
    if (bestI >= 0) answer(bestI);
  };

  return (
    <Shell
      title={SKILL_TITLES.vision}
      instruction="Pick the best ball on: the man in the most space who is still ONSIDE — behind the yellow line."
      results={results} trainingLevel={trainingLevel}
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
  const verdict = stars === 3 ? "First time!" : stars === 2 ? "Second try" : stars === 1 ? "Just made it" : "Not this time";
  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-900 to-emerald-950 text-white flex flex-col items-center justify-center py-3 px-3">
      <div className="w-full max-w-sm bg-gray-800 border border-gray-600 rounded-xl p-6 text-center shadow-2xl">
        <div className="text-[11px] font-black text-emerald-300 uppercase tracking-widest">{title} · Level {trainingLevel}</div>
        <div className="mt-3 text-5xl tracking-widest">
          {[0, 1, 2].map(i => (
            <span key={i} className={i < stars ? "text-amber-300" : "text-white/20"}>★</span>
          ))}
        </div>
        <div className="mt-3 text-lg font-black text-white">{verdict}</div>
        <div className="mt-1 text-sm font-bold text-white">
          {stars > 0 ? (trainingLevel < 30 ? `Level ${trainingLevel + 1} unlocked` : "Top level done") : "Try it again next time"}
        </div>
      </div>
    </div>
  );
}

export default function TrainingMinigame({ skill, trainingLevel, skills, onComplete }: Props) {
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
      return <GauntletDrill trainingLevel={trainingLevel} onFinish={setResult} />;
    case "vision":
      return <VisionDrillView trainingLevel={trainingLevel} onFinish={setResult} />;
    case "power":
    case "technique":
    case "freeKick":
      return <StrikeDrill kind={skill} trainingLevel={trainingLevel} skills={skills} onFinish={setResult} />;
    default:
      return <GauntletDrill trainingLevel={trainingLevel} onFinish={setResult} />;
  }
}
