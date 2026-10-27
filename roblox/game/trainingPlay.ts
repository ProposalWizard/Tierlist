/**
 * A training level, played on the device: components/star/TrainingMinigame.tsx
 * without the drawing. Three tries; in on the first is three stars, the
 * second two, the third one (useTries). The drills:
 *   Power, Technique, Free Kick, Aerial: the real match, one fixed picture (StrikeDrill)
 *   Pace: the first-person run with the knock-on (GauntletDrill)
 *   Vision: pick the right pass, by a tap or by kicking it (VisionDrillView)
 * Every timer runs on this file's own clock (`tick`). What goes back to the
 * server is the stars (0-3).
 *
 * Copied from the website at the commit named in roblox/tools/manifest.json.
 */
import * as M from "./match";
import * as V from "./matchView";
import type { CareerState, Skills, Fixture } from "../../lib/star/types";
import { buildScenario, initDefenders, type Scenario, type Viewport } from "../../lib/star/canvasEngine";
import { CX, POST_L, POST_R, NET_DEPTH } from "../../lib/star/pitch";
import { setAirZ, type AirHeighted } from "../../lib/star/airDrawings";
import {
  strikeSpot, conePositions, gateCrossing, gateQuality, shotQuality,
  powerManSpots, wallSpots, placedMen, techniqueBallSpot,
} from "../../lib/star/trainingDrills";
import { strikeViewport, gateViewport } from "../../lib/star/trainingRender";
import {
  levelConfig, levelSeedOf, easePowerLevel, setTrainingOverlay,
  type PowerLevel, type TechniqueLevel, type FreeKickLevel, type PaceLevel, type VisionLevel, type AerialLevel,
} from "../../lib/star/trainingLevelData";
import { starsForTry } from "../../lib/star/trainingLevels";
import { mulberry32 } from "../../lib/star/season";
import { newRun, stepRun, applySteer, applyBurst, type FpRunState } from "../../lib/star/firstPersonDribble";
import {
  setVisionMoments, setVisionChecks, visionMomentsReady, visionLevelPictures, visionAsk, visionScenario,
  judgeKick, judgeTap, aimedMan, type VisionPicture, type VisionVerdict,
} from "../../lib/star/visionRound";
import visionMoments from "../../lib/star/data/visionMoments.json";
import visionChecks from "../../lib/star/data/visionChecks.json";
import type { ScenePicture } from "../../lib/star/scenePicture";
import type { Outcome } from "../../lib/star/canvasEngine";

export type TrainingSkill = keyof Skills;
export const TRIES = 3;
export const SKILL_TITLES: Record<TrainingSkill, string> = {
  pace: "Pace", power: "Power", technique: "Technique", vision: "Vision", freeKick: "Free Kick", aerial: "Aerial & Acrobatics",
};

// ───────────────────────────────────────────── the strike drills' pictures ──

type StrikeKind = "power" | "technique" | "freeKick" | "aerial";
type StrikeLevel = PowerLevel | TechniqueLevel | FreeKickLevel | AerialLevel;
export const DRILL_SCENE: Record<StrikeKind, ScenePicture> = {
  technique: { keeper: false, goal: false, teammates: false, banners: false },
  power: { teammates: false, banners: false, ownFrame: true },
  freeKick: { teammates: false, banners: false },
  aerial: { banners: false, ownFrame: true },
};
export interface StrikeSetup {
  scenario: Scenario;
  viewport: Viewport;
  gate: { left: { x: number; y: number }; right: { x: number; y: number }; centre: { x: number; y: number } } | null;
  gateCfg: TechniqueLevel | null;
  brief: string;
  openGoal?: boolean;
  pass: number;
}

/** TrainingMinigame.buildStrikeFrom. */
export function buildStrikeFrom(kind: StrikeKind, row: StrikeLevel, rng: () => number): StrikeSetup {
  if (kind === "aerial") {
    const cfg = row as AerialLevel;
    const sc = buildScenario(cfg.volley ? "volley" : "header", rng, cfg.keeperStrength, 60, 55);
    sc.keeperStrength = cfg.keeperStrength;
    if (!cfg.marker) sc.defenders = [];
    sc.runner = null;
    sc.passTarget = null;
    sc.receiver = null;
    sc.secondaryRunners = [];
    if (!cfg.volley && Number.isFinite(cfg.ballZ)) setAirZ(sc as Scenario & AirHeighted, cfg.ballZ);
    return {
      scenario: sc, viewport: strikeViewport(sc.ball) as Viewport, gate: null, gateCfg: null,
      brief: `${cfg.volley ? "Volley" : `Header ${(Number.isFinite(cfg.ballZ) ? cfg.ballZ : 1.85).toFixed(2)} m`}${cfg.marker ? " · marked" : ""}` + (cfg.pass > 0.5 ? " · near a post" : ""),
      pass: cfg.pass,
    };
  }
  if (kind === "technique") {
    const cfg = row as TechniqueLevel;
    const ball = techniqueBallSpot(cfg);
    const gate = conePositions(ball, cfg);
    const sc = buildScenario("long_range", rng, 40, 60, 55);
    sc.ball = { x: ball.x, y: ball.y };
    sc.player = { x: ball.x, y: ball.y + 0.8 };
    sc.defenders = [];
    sc.teammates = [];
    sc.runner = null;
    sc.passTarget = null;
    sc.receiver = null;
    sc.secondaryRunners = [];
    initDefenders(sc, rng);
    sc.defenders = [];
    return {
      scenario: sc, viewport: gateViewport(ball, gate) as Viewport, gate, gateCfg: cfg,
      brief: `${cfg.gateDistance.toFixed(0)}m · ${cfg.gateWidth.toFixed(1)}m gate`, pass: cfg.pass,
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
    sc.defenders = placedMen(wallSpots(ball, cfg.wall), cfg.men, cfg.wall).map((at) => ({
      x: at.x, y: at.y, role: "hold" as const, baseRole: "hold" as const, speed: 0, z: 0, vz: 0,
    }));
    return {
      scenario: sc, viewport: strikeViewport(ball) as Viewport, gate: null, gateCfg: null,
      brief: `${cfg.distance.toFixed(0)}m · ${cfg.wall}-man wall`, pass: cfg.pass,
    };
  }
  const cfg = row as PowerLevel;
  const ball = strikeSpot(cfg.distance, cfg.offset);
  const sc = buildScenario("long_range", rng, cfg.keeperStrength, 60, 55);
  sc.ball = { x: ball.x, y: ball.y };
  sc.player = { x: ball.x, y: ball.y + 0.8 };
  sc.keeperStrength = cfg.keeperStrength;
  initDefenders(sc, rng);
  sc.defenders = placedMen(powerManSpots(ball, cfg.blockers), cfg.men, cfg.blockers).map((at) => ({
    x: at.x, y: at.y, role: "hold" as const, baseRole: "hold" as const, speed: 0.9, z: 0, vz: 0,
  }));
  return {
    scenario: sc, viewport: strikeViewport(ball) as Viewport, gate: null, gateCfg: null,
    brief: (cfg.keeper ? `${cfg.distance.toFixed(0)}m · ${cfg.blockers} in the way` : `${cfg.distance.toFixed(0)}m · open goal`) + (cfg.pass > 0.5 ? " · near a post" : ""),
    openGoal: !cfg.keeper, pass: cfg.pass,
  };
}

// ───────────────────────────────────────────────────────────── the state ──

const FINISH_HOLD_S = 0.85;       // useTries
const FLASH_S = 1.0;
const VISION_COUNT_S = 0.65, VISION_NEXT_S = 2.3, VISION_PICK_M = 2.6;

export interface TrainingPlay {
  career: CareerState;
  skill: TrainingSkill;
  level: number;
  clock: number;
  /** One entry per try: passed or not (useTries). */
  results: boolean[];
  /** Set once the level is over: the stars, and when to hand them over. */
  stars: number | null;
  finishAt: number | null;
  done: boolean;
  flash: { text: string; good: boolean; at: number } | null;
  brief: string;
  instruction: string;
  strike: { m: M.MatchState; setup: StrikeSetup | null; crossed: { x: number; z: number } | null; prev: { x: number; y: number; z: number } | null } | null;
  pace: { cfg: PaceLevel; waveSizes: number[]; total: number; run: FpRunState | null; started: boolean; resetAt: number | null } | null;
  vision: {
    cfg: VisionLevel; seed: number; pics: VisionPicture[]; tryIdx: number;
    phase: "count" | "play" | "result"; count: number; at: number; goAt: number;
    verdict: VisionVerdict | null; tapped: number | null;
    m: M.MatchState | null; sc: Scenario | null; pullAt: number | null; letGoAt: number | null; aimed: number | null; strikeOff: boolean[] | null;
  } | null;
}

const DRILL_FIXTURE = { opponent: "Training", home: true, week: 0, competition: "Training", kind: "league" } as unknown as Fixture;

function drillSetup(career: CareerState, seed: number, keeperStrength: number, drill: M.Drill, skills: M.MatchSetup["skills"]): M.MatchSetup {
  return {
    career, fixture: DRILL_FIXTURE, skills,
    canCurve: false, canExtraTouch: false,
    keeperStrength, oppStrength: 70, position: career.player.position, teamRelationship: 60,
    startMinute: 0, conditions: undefined as unknown as M.MatchSetup["conditions"],
    seed, pressure: 0, drill,
  };
}

/** useTries.attempt: a try is over. */
function attempt(tp: TrainingPlay, ok: boolean) {
  if (tp.stars !== null) return;
  if (tp.results.length >= TRIES || tp.results.includes(true)) return;
  tp.results.push(ok);
  const hit = tp.results.indexOf(true);
  if (hit < 0 && tp.results.length < TRIES) return;
  tp.stars = hit < 0 ? 0 : starsForTry(hit);
  tp.finishAt = tp.clock + FINISH_HOLD_S;
}
function flash(tp: TrainingPlay, text: string, good: boolean) { tp.flash = { text, good, at: tp.clock }; }

/** The level opens. `overlay` is the website's shared level edits (the server sends them). */
export function startTraining(career: CareerState, skill: TrainingSkill, level: number, overlay?: Record<string, unknown>): TrainingPlay {
  if (overlay) setTrainingOverlay(overlay);
  const tp: TrainingPlay = {
    career, skill, level, clock: 0, results: [], stars: null, finishAt: null, done: false, flash: null,
    brief: "", instruction: "", strike: null, pace: null, vision: null,
  };
  if (skill === "pace") openPace(tp);
  else if (skill === "vision") openVision(tp);
  else openStrike(tp, skill);
  return tp;
}

// ── Power, Technique, Free Kick, Aerial: StrikeDrill ──
function openStrike(tp: TrainingPlay, kind: StrikeKind) {
  const skills = tp.career.skills;
  const row: StrikeLevel = kind !== "power"
    ? levelConfig(kind, tp.level) as StrikeLevel
    : easePowerLevel(tp.level, skills.power, (n) => levelConfig("power", n));
  const seed = levelSeedOf(kind, tp.level, row);
  const view = buildStrikeFrom(kind, row, mulberry32(seed));
  tp.brief = view.brief;
  tp.instruction = kind === "aerial"
    ? "The cross comes in and you meet it: tap the ball before the ring runs out. Hit its left side to send it right."
    : kind === "technique" ? "Drag back to aim and set power. Pick a spot on the ball to bend it through the cones."
    : kind === "freeKick" ? "Drag back to aim and set power, then strike it over the wall or round it."
    : "Drag back to aim and set power, then pick your spot on the ball.";
  const st: NonNullable<TrainingPlay["strike"]> = { m: null as unknown as M.MatchState, setup: null, crossed: null, prev: null };
  const drill: M.Drill = {
    openOn: () => {
      const setup = buildStrikeFrom(kind, row, mulberry32(seed));
      setup.scenario.viewport = { ...setup.viewport };
      st.setup = setup;
      st.prev = null;
      st.crossed = null;
      return setup.scenario;
    },
    setPieceSkill: skills.freeKick,
    scene: view.openGoal ? { ...DRILL_SCENE.power, keeper: false } : DRILL_SCENE[kind],
    onBallStep: (b) => {
      const setup = st.setup;
      if (!setup?.gate || st.crossed) return;
      const prev = st.prev;
      if (prev) { const c = gateCrossing(prev, b, setup.gate.centre.y); if (c) st.crossed = c; }
      st.prev = { ...b };
    },
    onChanceResolved: (info) => {
      const setup = st.setup;
      if (!setup) return;
      let q: number, text: string;
      if (setup.gate && setup.gateCfg) {
        q = gateQuality(st.crossed, setup.gateCfg, setup.gate.centre.x);
        text = q >= 0.9 ? "THREADED!" : q >= 0.45 ? "THROUGH" : q > 0 ? "CLIPPED IT" : "MISSED THE GATE";
      } else {
        const o = info.teammateShot ? "saved" : info.outcome;
        const reached = o === "goal" || o === "rebound" || o === "wide" || o === "over" || o === "post";
        q = shotQuality(o, reached && info.ball ? info.ball.x : null);
        text = o === "goal" || o === "rebound" ? (q < setup.pass ? "TOO CENTRAL" : q > 0.85 ? "TOP CORNER!" : "GOAL!")
          : o === "saved" || o === "tipped" ? "SAVED" : o === "caught" ? "CAUGHT" : o === "post" ? "OFF THE POST"
          : o === "blocked" || o === "tackled" ? "BLOCKED" : o === "over" ? "OVER" : "WIDE";
      }
      const ok = q >= setup.pass;
      flash(tp, text, ok);
      attempt(tp, ok);
    },
  };
  const keeperStrength = kind === "technique" ? 40 : (row as PowerLevel | FreeKickLevel | AerialLevel).keeperStrength;
  st.m = M.startMatch(drillSetup(tp.career, seed, keeperStrength, drill,
    { power: skills.power, technique: skills.technique, aerial: skills.aerial } as M.MatchSetup["skills"]));
  tp.strike = st;
}

// ── Pace: GauntletDrill ──
function openPace(tp: TrainingPlay) {
  const cfg = levelConfig("pace", tp.level);
  const out: number[] = [];
  const max = Math.max(1, cfg.waveMax);
  for (let left = cfg.chasers; left > 0; left -= max) out.push(Math.min(max, left));
  tp.pace = { cfg, waveSizes: out, total: out.reduce((a, b) => a + b, 0), run: null, started: false, resetAt: null };
  tp.instruction = "One man comes for the ball. Pick the gap, wait for his shoulder, and knock it the other way as his ring turns green.";
  tp.brief = `${cfg.chasers} ${cfg.chasers === 1 ? "man" : "men"} to beat`;
  newPaceRun(tp);
}
function newPaceRun(tp: TrainingPlay) {
  const p = tp.pace!;
  p.run = newRun({
    pace: p.cfg.runPace, oppStrength: p.cfg.oppStrength, rounds: 3, waveSizes: p.waveSizes,
    rng: mulberry32(levelSeedOf("pace", tp.level, p.cfg)), mates: 0, knockOn: true, ...(p.cfg.lanes ? { lanes: p.cfg.lanes } : {}),
  });
  p.started = false;
  p.resetAt = null;
}

// ── Vision: VisionDrillView ──
let visionLoaded = false;
function openVision(tp: TrainingPlay) {
  if (!visionLoaded && !visionMomentsReady()) {
    setVisionMoments(visionMoments);
    setVisionChecks(visionChecks);
    visionLoaded = true;
  }
  const cfg = levelConfig("vision", tp.level);
  const seed = levelSeedOf("vision", tp.level, cfg);
  const levelOf = (n: number) => {
    if (n === tp.level) return { ask: visionAsk(cfg), seed };
    const c = levelConfig("vision", n);
    return { ask: visionAsk(c), seed: levelSeedOf("vision", n, c) };
  };
  const pics = visionLevelPictures(tp.level, levelOf, TRIES);
  tp.vision = {
    cfg, seed, pics, tryIdx: 0, phase: "count", count: 3, at: 0, goAt: 0, verdict: null, tapped: null,
    m: null, sc: null, pullAt: null, letGoAt: null, aimed: null, strikeOff: null,
  };
  tp.instruction = cfg.kick
    ? `Play the pass: drag back from the ball to aim at him, then strike it. Start inside ${cfg.window.toFixed(1)}s.`
    : "Tap the team-mate you'd pass to. Not offside, not marked, nobody in the way.";
  openVisionTry(tp);
}
function visionPic(tp: TrainingPlay): VisionPicture | undefined {
  const v = tp.vision!;
  return v.pics[Math.min(v.tryIdx, v.pics.length - 1)];
}
function openVisionTry(tp: TrainingPlay) {
  const v = tp.vision!;
  v.phase = "count"; v.count = 3; v.at = tp.clock; v.verdict = null; v.tapped = null;
  v.pullAt = null; v.letGoAt = null; v.aimed = null; v.strikeOff = null; v.sc = null;
  const p = visionPic(tp);
  if (!p) { v.m = null; return; }
  const drill: M.Drill = {
    openOn: () => { const sc = visionScenario(p, (v.seed + v.tryIdx * 7919) >>> 0); v.sc = sc; return sc; },
    scene: { banners: false },
    onBallStep: () => {
      const sc = v.sc;
      if (!sc || v.phase !== "play") return;
      if (!v.strikeOff) v.strikeOff = sc.secondaryRunners.map((r) => !!r.offside);
      const verdict = judgeKick(p, sc, null, v.aimed, v.strikeOff);
      if (verdict) finishVision(tp, verdict, sc.receivedBy ? sc.secondaryRunners.indexOf(sc.receivedBy) : v.aimed);
    },
    onChanceResolved: (info) => {
      const sc = v.sc;
      if (!sc || v.phase === "result") return;
      const verdict = judgeKick(p, sc, info.outcome as Outcome, v.aimed, v.strikeOff ?? undefined);
      if (verdict) finishVision(tp, verdict, sc.receivedBy ? sc.secondaryRunners.indexOf(sc.receivedBy) : v.aimed);
    },
  };
  const skills = tp.career.skills;
  v.m = M.startMatch(drillSetup(tp.career, (v.seed + v.tryIdx) >>> 0, 62, drill, { power: skills.power, technique: skills.technique }));
}
function finishVision(tp: TrainingPlay, verdict: VisionVerdict, picked: number | null) {
  const v = tp.vision!;
  if (v.phase === "result") return;
  v.phase = "result";
  v.verdict = verdict;
  v.tapped = picked;
  v.at = tp.clock;
  flash(tp, verdict.ok ? "RIGHT MAN" : "NOT HIM", verdict.ok);
  attempt(tp, verdict.ok);
}

// ───────────────────────────────────────────────────────────── each frame ──

export function tick(tp: TrainingPlay, dt: number) {
  dt = Math.min(Math.max(0, dt), 0.05);
  tp.clock += dt;
  if (tp.flash && tp.clock - tp.flash.at > FLASH_S) tp.flash = null;
  if (tp.finishAt !== null) {
    if (tp.clock >= tp.finishAt) tp.done = true;
    if (tp.strike) M.tick(tp.strike.m, dt);
    return;
  }
  if (tp.strike) { M.tick(tp.strike.m, dt); return; }
  const p = tp.pace;
  if (p && p.run) {
    if (!p.started) return;
    if (p.resetAt !== null) { if (tp.clock >= p.resetAt) newPaceRun(tp); return; }
    const ph = stepRun(p.run, dt);
    if (ph !== "running") {
      const cleared = ph === "clear";
      const beaten = p.run.defenders.filter((d) => d.phase === "beaten").length;
      flash(tp, cleared ? (beaten >= p.total ? "GONE!" : "THROUGH") : "TACKLED", cleared);
      attempt(tp, cleared);
      p.resetAt = tp.clock + 1;
    }
    return;
  }
  const v = tp.vision;
  if (v) {
    const pic = visionPic(tp);
    if (v.m) M.tick(v.m, dt);
    if (!pic) { attempt(tp, false); return; }
    if (v.phase === "count") {
      if (tp.clock - v.at >= VISION_COUNT_S) {
        v.at = tp.clock;
        if (v.count > 1) v.count -= 1;
        else { v.phase = "play"; v.goAt = tp.clock; }
      }
    } else if (v.phase === "play") {
      const m = v.m;
      if (v.cfg.kick && m) {
        const aim = M.aimPreview(m);
        if (v.pullAt === null && (aim || m.phase !== "aim")) v.pullAt = tp.clock;
        if (aim) v.aimed = aimedMan(pic, aim.dir);
        if (v.letGoAt === null && m.phase !== "aim") v.letGoAt = tp.clock;
      }
      if (!v.cfg.kick || v.pullAt === null) {
        if (tp.clock - v.goAt > v.cfg.window) finishVision(tp, judgeTap(pic, null), null);
      } else if (v.letGoAt === null) {
        if (tp.clock - v.pullAt > v.cfg.letGo) finishVision(tp, judgeTap(pic, null), null);
      }
    } else if (v.phase === "result") {
      if (!v.verdict?.ok && v.tryIdx < TRIES - 1 && tp.clock - v.at >= VISION_NEXT_S) {
        v.tryIdx += 1;
        openVisionTry(tp);
      }
    }
  }
}

// ──────────────────────────────────────────────────────────────── input ──

/** The match on the pitch now (the strike drills, Vision's kick levels; Vision's tap levels show it but take taps). */
export function pitchMatch(tp: TrainingPlay): M.MatchState | null {
  if (tp.strike) return tp.strike.m;
  const v = tp.vision;
  if (v && v.cfg.kick && v.phase === "play") return v.m;
  return null;
}
/** Tap to start (the pace run). */
export function tapToGo(tp: TrainingPlay) {
  if (tp.pace && !tp.pace.started) tp.pace.started = true;
}
/** Vision's tap levels: a tap on the pitch (metres); the nearest man within reach. */
export function visionTap(tp: TrainingPlay, at: { x: number; y: number }): boolean {
  const v = tp.vision;
  const pic = v ? visionPic(tp) : undefined;
  if (!v || !pic || v.cfg.kick || v.phase !== "play") return false;
  let best = -1, bestD = VISION_PICK_M;
  pic.options.forEach((o, i) => { const d = Math.hypot(o.x - at.x, o.y - at.y); if (d < bestD) { bestD = d; best = i; } });
  if (best < 0) return false;
  finishVision(tp, judgeTap(pic, best), best);
  return true;
}
export function paceSteer(tp: TrainingPlay, x: number) {
  const p = tp.pace;
  if (!p?.run || !p.started || p.resetAt !== null || Math.abs(x) < 0.08) return;
  applySteer(p.run, p.run.x + x * 3);
}
export function paceKnock(tp: TrainingPlay, dir: -1 | 1): boolean {
  const p = tp.pace;
  if (!p?.run || !p.started || p.resetAt !== null) return false;
  return applyBurst(p.run, dir);
}

// ─────────────────────────────────────────── the picture, for the 3D pitch ──

const KITS = {
  us: { shirt: "#2563eb", trim: "#f8fafc" }, them: { shirt: "#dc2626", trim: "#111827" },
  keeper: { shirt: "#16a34a", trim: "#052e16" }, ourKeeper: { shirt: "#f59e0b", trim: "#111827" },
};

export interface TrainingView {
  title: string;
  level: number;
  brief: string;
  instruction: string;
  tries: { done: number; results: boolean[]; total: number };
  flash: { text: string; good: boolean } | null;
  stars: number | null;
  tapToStart: boolean;
  count: number;
  left: number | null;
  line: string;
  cones: { x: number; y: number }[];
}
export interface TrainingFrame extends V.Frame { mode: "pitch" | "dribble" | "vision"; trial: null; training: TrainingView }

export function trainingFrame(tp: TrainingPlay): TrainingFrame {
  const tv: TrainingView = {
    title: SKILL_TITLES[tp.skill], level: tp.level, brief: tp.brief, instruction: tp.instruction,
    tries: { done: tp.results.length, results: tp.results.slice(), total: TRIES },
    flash: tp.flash ? { text: tp.flash.text, good: tp.flash.good } : null, stars: tp.stars,
    tapToStart: !!tp.pace && !tp.pace.started, count: 0, left: null, line: "",
    cones: tp.strike?.setup?.gate ? [tp.strike.setup.gate.left, tp.strike.setup.gate.right] : [],
  };
  const v = tp.vision;
  if (v) {
    tv.count = v.phase === "count" ? v.count : 0;
    tv.left = v.phase === "play" ? Math.max(0, 1 - (tp.clock - (v.cfg.kick && v.pullAt !== null ? v.pullAt : v.goAt)) / (v.cfg.kick && v.pullAt !== null ? v.cfg.letGo : v.cfg.window)) : null;
    tv.line = v.verdict?.line ?? "";
  }
  const m = tp.strike?.m ?? (v ? v.m : null);
  if (m) {
    const f = V.frameOf(m);
    const mode = v && !v.cfg.kick ? "vision" : "pitch";
    const out: TrainingFrame = { ...f, kits: KITS, score: { ...f.score, usName: "Training", themName: "" }, mode, trial: null, training: tv };
    if (v) out.cameraMode = "chance";
    return out;
  }
  const base: V.Frame = {
    phase: "trainingDribble", cameraMode: "chase", minute: 0,
    score: { us: 0, them: 0, usName: "Training", themName: "", home: true },
    kits: KITS, bodies: [], ball: null,
    camera: { x1: 16.5, x2: 51.5, y1: -NET_DEPTH - 1, y2: 40, facing: "up", tilt: 0 },
    goal: { x1: POST_L, x2: POST_R, crossbar: 2.44 },
    aim: null, passTarget: null, feed: [], log: [], banner: null, pause: null,
    energy: 100, stamina: null, speed: 1, energyMode: "medium", playstyle: "balanced",
    controls: { powerShot: false, powerArmed: false, curve: false, steer: false, callForIt: false, nudge: false, dribble: false, touchMode: false },
    shootout: null,
  };
  const p = tp.pace;
  if (p && p.run) {
    const run = p.run;
    base.bodies.push({ id: "you", side: "you", x: run.x, y: run.y, name: tp.career.player.lastName });
    run.defenders.forEach((d, i) => base.bodies.push({ id: `fd${i}`, side: "opp", x: d.x, y: d.y }));
    base.bodies.push({ id: "keeper", side: "keeper", x: CX, y: 0.6 });
    base.ball = { x: run.x, y: run.y - 0.6, z: 0 };
    base.controls = { ...base.controls, dribble: p.started && p.resetAt === null };
  }
  return { ...base, mode: "dribble", trial: null, training: tv };
}
