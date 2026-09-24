"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Skills } from "@/lib/star/types";
import { getTuning } from "@/lib/star/tuningStore";
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
import { EngineFeature } from "./EnginePlay";
import type { ChanceResolved } from "./CanvasMatch";

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
  /**
   * The player's CURRENT value in the stat being trained, 0-100.
   *
   * The single most important addition in the rebuild: this is what the
   * whole difficulty ladder reads. It was never passed before — which is
   * exactly why every session played identically for ever.
   */
  level: number;
  /** The real skills, handed to `launch` so a strike in training is the same
   *  strike it would be in a match — your power decides how far it goes and
   *  your technique decides how much it bends. */
  skills: Skills;
  onComplete: (xpGained: number) => void;
}

const SKILL_TITLES: Record<keyof Skills, string> = {
  pace: "The Gauntlet",
  power: "Long Range",
  technique: "Through the Gate",
  vision: "Read the Run",
  freeKick: "Over the Wall",
};


// ── Shared scoring ─────────────────────────────────────────────────────────

function qualitiesToXp(qualities: number[], reps: number): number {
  const base = getTuning("training.minigameBaseXp");
  const max = getTuning("training.minigameMaxXp");
  const scale = getTuning("training.minigameScale");
  if (qualities.length === 0) return base;
  const avg = qualities.reduce((a, b) => a + b, 0) / reps;
  return Math.max(base, Math.min(max, Math.round(base + avg * scale)));
}

function useDrillScore(reps: number, onFinish: (xp: number) => void) {
  const [qualities, setQualities] = useState<number[]>([]);
  const finishedRef = useRef(false);
  const push = useCallback((q: number) => {
    setQualities(prev => (prev.length >= reps ? prev : [...prev, q]));
  }, [reps]);

  useEffect(() => {
    if (qualities.length === reps && !finishedRef.current) {
      finishedRef.current = true;
      const xp = qualitiesToXp(qualities, reps);
      const t = setTimeout(() => onFinish(xp), 850);
      return () => clearTimeout(t);
    }
  }, [qualities, reps, onFinish]);

  return { rep: qualities.length, push, projected: qualitiesToXp(qualities, Math.max(1, qualities.length)) };
}

function Shell({
  title, instruction, rep, reps, xp, level, children,
}: {
  title: string; instruction: string; rep: number; reps: number; xp: number;
  level: number; children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-950 to-gray-950 text-white flex flex-col items-center py-3 px-3">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1 bg-gray-800 rounded-lg px-3 py-1.5 border border-gray-600">
            {Array.from({ length: reps }).map((_, i) => (
              <span key={i} className={`text-sm ${i < rep ? "opacity-100" : "opacity-25"}`}>⚽</span>
            ))}
          </div>
          <div className="text-right">
            <div className="text-[10px] font-black text-emerald-300 uppercase tracking-wide">{title}</div>
            <div className="text-xs text-emerald-400 font-bold">Proj. +{xp} XP</div>
          </div>
        </div>
        {/* The ladder, made visible — the drill is calibrated to this number,
            so it should be on screen while you play it. */}
        <div className="mb-2 flex items-center gap-2">
          <div className="h-1.5 flex-1 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-amber-400" style={{ width: `${level}%` }} />
          </div>
          <div className="text-[10px] font-black text-white/60 tabular-nums">LV {Math.round(level)}</div>
        </div>
        {children}
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
  kind, level, skills, onFinish,
}: { kind: StrikeKind; level: number; skills: Skills; onFinish: (xp: number) => void }) {
  // One real match engine (CanvasMatch, via EngineFeature) — the same aim,
  // contact, flight, keeper and wall a match has. This file only builds the
  // picture for each rep and scores the result. See .claude/skills/one-engine.
  const REPS = 4;
  const { rep, push, projected } = useDrillScore(REPS, onFinish);
  const repRef = useRef(0);
  repRef.current = rep;
  const seedRef = useRef((Date.now() ^ 0x5f3a) >>> 0);
  const setupRef = useRef<StrikeSetup | null>(null);
  const prevRef = useRef<{ x: number; y: number; z: number } | null>(null);
  const crossedRef = useRef<{ x: number; z: number } | null>(null);
  const [flash, setFlash] = useState<{ text: string; good: boolean } | null>(null);

  const openOn = useCallback((): Scenario => {
    const r = repRef.current;
    const setup = buildStrike(kind, level, r, mulberry32((seedRef.current ^ Math.imul(r + 1, 0x9e3779b1)) >>> 0));
    setup.scenario.viewport = { ...setup.viewport };
    setupRef.current = setup;
    prevRef.current = null;
    crossedRef.current = null;
    return setup.scenario;
  }, [kind, level]);

  // The HUD line and the cones for this rep — the same seeded build the
  // engine was handed, so the cones stand exactly where the gate is judged.
  const view = useMemo(() => {
    const setup = buildStrike(kind, level, rep, mulberry32((seedRef.current ^ Math.imul(rep + 1, 0x9e3779b1)) >>> 0));
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
    setFlash({ text, good: q >= 0.5 });
    window.setTimeout(() => setFlash(null), 1000);
    push(q);
  }, [push]);

  const instruction = kind === "technique"
    ? "Drag back from the ball to aim and set power, then pick your spot on the ball to bend it through the cones."
    : kind === "freeKick"
      ? "Drag back to aim and set power, then strike it over the wall or round it."
      : "Drag back to aim and set power, then pick your spot on the ball.";

  return (
    <Shell title={SKILL_TITLES[kind]} instruction={instruction} rep={rep} reps={REPS} xp={projected} level={level}>
      <div className="relative">
        <EngineFeature
          openOn={openOn}
          onChanceResolved={onChanceResolved}
          onBallStep={onBallStep}
          markers={markers}
          skills={{ power: skills.power, technique: skills.technique }}
          setPieceSkill={skills.freeKick}
          keeperStrength={kind === "technique" ? 40 : kind === "freeKick" ? freeKickDrill(level, rep).keeperStrength : powerDrill(level, rep).keeperStrength}
          seed={seedRef.current}
        />
        {brief && (
          <div className="pointer-events-none absolute top-2 left-2 z-30 rounded-md bg-black/55 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-amber-200">
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

function GauntletDrill({ level, onFinish }: { level: number; onFinish: (xp: number) => void }) {
  // The same run a real match serves (FirstPersonDribble, same camera
  // settings as CanvasMatch's own mount). Your pace stat is the run speed.
  const REPS = 3;
  const { rep, push, projected } = useDrillScore(REPS, onFinish);
  const [flash, setFlash] = useState<{ text: string; good: boolean } | null>(null);
  const [runKey, setRunKey] = useState(0);
  const cfg = paceDrill(level, rep);
  // The drill's chaser count, in the real run's waves of up to three.
  const waveSizes = useMemo(() => {
    const out: number[] = [];
    for (let left = cfg.chasers; left > 0; left -= 3) out.push(Math.min(3, left));
    return out;
  }, [cfg.chasers]);
  const total = waveSizes.reduce((a, b) => a + b, 0);

  const onComplete = useCallback((res: { cleared: boolean; beaten: number }) => {
    const q = Math.max(0, Math.min(1, (res.beaten / Math.max(1, total)) * 0.8 + (res.cleared ? 0.2 : 0)));
    setFlash({ text: res.cleared ? (q > 0.8 ? "GONE!" : "THROUGH") : "TACKLED", good: res.cleared });
    push(q);
    window.setTimeout(() => {
      setFlash(null);
      setRunKey(k => k + 1);
    }, 1000);
  }, [push, total]);

  return (
    <Shell
      title={SKILL_TITLES.pace}
      instruction="Read each man as he commits, then burst the other way. Beat them all to finish the run."
      rep={rep} reps={REPS} xp={projected} level={level}
    >
      <div className="relative w-full overflow-hidden rounded-xl" style={{ aspectRatio: "5 / 8" }}>
        {rep < REPS && (
          <FirstPersonDribble
            key={runKey}
            embedded
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

function VisionDrillView({ level, onFinish }: { level: number; onFinish: (xp: number) => void }) {
  const REPS = 5;
  const { rep, push, projected } = useDrillScore(REPS, onFinish);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const rngRef = useRef<() => number>(mulberry32((Date.now() ^ 0x77c1) >>> 0));
  const facesRef = useRef(createFaceImageCache());
  const [round, setRound] = useState<VisionRound | null>(null);
  const [flash, setFlash] = useState<{ text: string; good: boolean } | null>(null);
  const [left, setLeft] = useState(1);
  const startedRef = useRef(0);
  const answeredRef = useRef(false);
  const cfg = useMemo(() => visionDrill(level, rep), [level, rep]);

  useCanvasSize(canvasRef, wrapRef);

  const startRep = useCallback((r: number) => {
    setRound(buildVisionRound(level, r, rngRef.current));
    startedRef.current = performance.now();
    answeredRef.current = false;
    setLeft(1);
  }, [level]);

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
    setFlash({ text, good: q >= 0.5 });
    push(q);
    window.setTimeout(() => {
      setFlash(null);
      if (rep + 1 < REPS) startRep(rep + 1);
    }, 950);
  }, [round, cfg.window, push, rep, startRep]);

  // The clock.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (answeredRef.current) return;
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
    if (!c || !round || answeredRef.current) return;
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
      rep={rep} reps={REPS} xp={projected} level={level}
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
        {flash && <Flash text={flash.text} good={flash.good} />}
      </div>
    </Shell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════

function CompleteScreen({ title, xp }: { title: string; xp: number }) {
  const rating = xp >= 32 ? "World Class" : xp >= 22 ? "Great Session" : xp >= 12 ? "Solid Work" : "Keep Grinding";
  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-900 to-emerald-950 text-white flex flex-col items-center justify-center py-3 px-3">
      <div className="w-full max-w-sm bg-gray-800 border border-gray-600 rounded-xl p-6 text-center shadow-2xl">
        <div className="text-4xl mb-2">🏆</div>
        <div className="text-[11px] font-black text-emerald-300 uppercase tracking-widest">Session Complete</div>
        <div className="text-lg font-black text-white mt-1">{title}</div>
        <div className="mt-4 text-5xl font-black text-emerald-400">+{xp}</div>
        <div className="text-xs font-bold text-emerald-300 uppercase tracking-wide">XP Earned</div>
        <div className="mt-3 inline-block bg-emerald-500/20 border border-emerald-400 rounded-lg px-4 py-1.5 text-sm font-black text-emerald-200">
          {rating}
        </div>
      </div>
    </div>
  );
}

export default function TrainingMinigame({ skill, level, skills, onComplete }: Props) {
  const [result, setResult] = useState<number | null>(null);
  const calledRef = useRef(false);

  useEffect(() => {
    if (result !== null && !calledRef.current) {
      calledRef.current = true;
      const t = setTimeout(() => onComplete(result), 1100);
      return () => clearTimeout(t);
    }
  }, [result, onComplete]);

  if (result !== null) return <CompleteScreen title={SKILL_TITLES[skill]} xp={result} />;

  switch (skill) {
    case "pace":
      return <GauntletDrill level={level} onFinish={setResult} />;
    case "vision":
      return <VisionDrillView level={level} onFinish={setResult} />;
    case "power":
    case "technique":
    case "freeKick":
      return <StrikeDrill kind={skill} level={level} skills={skills} onFinish={setResult} />;
    default:
      return <GauntletDrill level={level} onFinish={setResult} />;
  }
}
