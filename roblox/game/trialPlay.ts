/**
 * The trial, played on the device: components/star/TrialSequence.tsx and its
 * five stages without the drawing.
 *   1. Free kicks       (stages/TrialFreeKicks.tsx: the real match, one free kick)
 *   2. Through the gate (stages/TrialTechnique.tsx: the real match, one strike at two cones)
 *   3. Take him on      (FirstPersonDribble.tsx: lib/star/firstPersonDribble.ts)
 *   4. Find the pass    (stages/TrialVision.tsx: five quick picks of the free man)
 *   5. The shootout     (stages/TrialShootout.tsx: the real match, three kicks each, yours last)
 * Every timer runs on the trial's own clock (`tick`). What goes back to the
 * server is each stage's quality and the shootout's last kick (TrialReturn).
 *
 * Copied from the website at the commit named in roblox/tools/manifest.json.
 * The teaching cards are not copied: Roblox shows its own one-line hints.
 */
import * as M from "./match";
import * as V from "./matchView";
import type { TrialReturn } from "./trialFlow";
import type { CareerState, Fixture } from "../../lib/star/types";
import type { Scenario, Viewport } from "../../lib/star/canvasEngine";
import { buildScenario, initDefenders, clamp, VIEW_ASPECT } from "../../lib/star/canvasEngine";
import { CX, POST_L, POST_R, NET_DEPTH, PITCH_W, HALF_LEN, PEN_SPOT_Y } from "../../lib/star/pitch";
import { mulberry32 } from "../../lib/star/season";
import {
  TRIAL_STAGES, beginStage, recordStage, nextStage, difficultyFor, STAGE_LABEL,
  type TrialProgress, type TrialStage,
} from "../../lib/star/trial";
import {
  REPS, freeKickSetup, ladderLevel, dribbleSetup, dribbleQuality, visionSetup, visionQuality, weightedQuality,
  attemptSeed, shootoutKeeperFor, shootoutOurKeeperFor, shootoutQuality, shootoutTheirRating, trialInvisibleStats,
  type FreeKickSetup, type DribbleSetup, type VisionSetup,
} from "../../lib/star/trialStages";
import { techniqueDrill, techniqueBallSpot, conePositions, gateCrossing, gateQuality, type TechniqueDrillConfig } from "../../lib/star/trainingDrills";
import { gateViewport } from "../../lib/star/trainingRender";
import { newRun, stepRun, applySteer, applyBurst, type FpRunState } from "../../lib/star/firstPersonDribble";
import { attachAutoKick, clearForShootout, type PenaltyTaker } from "../../lib/star/penaltyTaking";
import { generateSquad } from "../../lib/star/squadData";
import { fakeFaceFor } from "../../lib/star/fakeFaces";
import {
  createRig, createRigScript, rigApply, rigNextSide, rigIntent, rigKicksTaken, rigPlanFor, rigKeeperRead,
  isYourKick, winningPenaltyScored, rigGoals, pickRunups, idForRunup, MISS_LINE, SHOOTOUT_KICKS,
  type RigState, type RigScript,
} from "../../lib/star/trialShootoutRig";
import { careerPenaltyRunup, careerFreeKickRunup } from "../../lib/star/runupStyles";

// ───────────────────────────────────────────────────── the stage pictures ──

/** TrialFreeKicks.freeKickView. */
const BEHIND_BALL = 7, SIDE_PAD = 2.5, BASE_VIEW_H = 42;
export function freeKickView(ball: { x: number; y: number }): Viewport {
  const back = NET_DEPTH + 2.5;
  const needH = ball.y + BEHIND_BALL + back;
  const nx1 = Math.min(POST_L, ball.x) - SIDE_PAD;
  const nx2 = Math.max(POST_R, ball.x) + SIDE_PAD;
  const h = Math.max(BASE_VIEW_H, needH, (nx2 - nx1) / VIEW_ASPECT);
  const w = h * VIEW_ASPECT;
  let cx = (nx1 + nx2) / 2;
  cx = clamp(cx, -5 + w / 2, PITCH_W + 5 - w / 2);
  cx = clamp(cx, nx2 - w / 2, nx1 + w / 2);
  return { x1: cx - w / 2, x2: cx + w / 2, y1: -back, y2: -back + h };
}

/** TrialFreeKicks.freeKickWall. */
export function freeKickWall(setup: FreeKickSetup): { x: number; y: number }[] {
  const dx = CX - setup.ball.x, dy = -setup.ball.y;
  const len = Math.hypot(dx, dy) || 1;
  const to = { x: dx / len, y: dy / len };
  const across = { x: -to.y, y: to.x };
  const wallCx = setup.ball.x + to.x * 9.15;
  const wallCy = setup.ball.y + to.y * 9.15;
  const n = Math.max(1, Math.round(setup.wall));
  const men: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const off = (i - (n - 1) / 2) * 1.15;
    men.push({ x: clamp(wallCx + across.x * off, 4, PITCH_W - 4), y: clamp(wallCy + across.y * off, 2, HALF_LEN) });
  }
  return men;
}

/** TrialFreeKicks.buildFreeKickScenario. */
export function buildFreeKickScenario(trial: TrialProgress, rep: number, rng: () => number): Scenario {
  const setup = freeKickSetup(trial, rep);
  const sc = buildScenario("free_kick", rng, setup.keeperStrength, 60, 55);
  sc.ball = { ...setup.ball };
  sc.player = { x: setup.ball.x, y: setup.ball.y + 2 };
  sc.defenders = freeKickWall(setup);
  sc.keeperStrength = setup.keeperStrength;
  initDefenders(sc, rng);
  sc.viewport = freeKickView(setup.ball);
  return sc;
}

/** TrainingMinigame.buildStrike("technique") → buildStrikeFrom, then TrialTechnique's own changes. */
export interface GateSetup {
  scenario: Scenario;
  gate: { left: { x: number; y: number }; right: { x: number; y: number }; centre: { x: number; y: number } };
  gateCfg: TechniqueDrillConfig & { pass: number };
}
export function buildGate(level: number, rep: number, rng: () => number): GateSetup {
  const cfg = { ...techniqueDrill(level, rep), pass: 0.25 };
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
  // TrialTechnique.build
  sc.viewport = { ...gateViewport(ball, gate) } as Viewport;
  sc.player = { x: sc.ball.x + 1.2, y: sc.ball.y + 1.8 };
  return { scenario: sc, gate, gateCfg: cfg };
}

/** TrialVision's picture: you, the men and their markers (layoutVision, copied). */
const VISION_YOU = { x: CX, y: 36 };
const AREA = { x1: 20, x2: 48, y1: 4.5, y2: 30 };
const MARKER_BOX = { x1: 18.5, x2: 49.5, y1: 1.5, y2: 33.5 };
const BASE_SPACE = 2.4, MIN_SPACE = 1.1, REQUIRED_GAP_FRACTION = 0.6, LAYOUT_ATTEMPTS = 24;
export interface VisionMan { x: number; y: number; marker: { x: number; y: number }; space: number }
export interface VisionLayout { you: { x: number; y: number }; men: VisionMan[]; gap: number }
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
function oneLayout(setup: VisionSetup, rng: () => number): VisionLayout {
  const n = Math.max(2, Math.round(setup.options));
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  const cw = (AREA.x2 - AREA.x1) / cols;
  const ch = (AREA.y2 - AREA.y1) / rows;
  const pos: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const c = i % cols, r = Math.floor(i / cols);
    pos.push({ x: AREA.x1 + cw * (c + 0.5) + (rng() - 0.5) * cw * 0.5, y: AREA.y1 + ch * (r + 0.5) + (rng() - 0.5) * ch * 0.5 });
  }
  const best = BASE_SPACE + setup.margin;
  const markers: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const want = i === setup.correct ? best : Math.max(MIN_SPACE, best - setup.margin * (0.85 + rng() * 0.3));
    const a0 = rng() * Math.PI * 2;
    let placed: { x: number; y: number } | null = null;
    for (let k = 0; k < 8 && !placed; k++) {
      const a = a0 + (k * Math.PI) / 4;
      const m = { x: pos[i].x + Math.cos(a) * want, y: pos[i].y + Math.sin(a) * want };
      if (m.x >= MARKER_BOX.x1 && m.x <= MARKER_BOX.x2 && m.y >= MARKER_BOX.y1 && m.y <= MARKER_BOX.y2) placed = m;
    }
    markers.push(placed ?? {
      x: Math.min(MARKER_BOX.x2, Math.max(MARKER_BOX.x1, pos[i].x + want)),
      y: Math.min(MARKER_BOX.y2, Math.max(MARKER_BOX.y1, pos[i].y)),
    });
  }
  const men: VisionMan[] = pos.map((p, i) => ({ x: p.x, y: p.y, marker: markers[i], space: Math.min(...markers.map((m) => dist(p, m))) }));
  const others = men.filter((_, i) => i !== setup.correct).map((m) => m.space);
  const gap = men[setup.correct].space - Math.max(...others);
  return { you: { ...VISION_YOU }, men, gap };
}
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

/** TrialShootout.takersFor. */
const US = "Trialists", THEM = "Academy";
const MATE_KICKS = SHOOTOUT_KICKS - 1;
function takersFor(trial: TrialProgress, seed: number): { them: PenaltyTaker[]; mates: PenaltyTaker[] } {
  const rating = shootoutTheirRating(trial);
  const runups = pickRunups(seed, SHOOTOUT_KICKS + MATE_KICKS);
  const rng = mulberry32((trial.seed ^ 0x7a1e) >>> 0);
  const side = (squadSeed: number, n: number, base: string, runupFrom: number): PenaltyTaker[] =>
    generateSquad(squadSeed).filter((p) => p.position !== "GK").slice(0, n).map((p, i) => ({
      id: idForRunup(`${base}-${i}`, runups[runupFrom + i]),
      name: p.name, shortName: p.shortName,
      face: p.imageUrl ?? fakeFaceFor(`${base}-${i}`),
      rating: Math.max(30, Math.min(95, Math.round(rating + (rng() - 0.5) * 10))),
    }));
  return {
    them: side((trial.seed ^ 0x51ee) >>> 0, SHOOTOUT_KICKS, "academy", 0),
    mates: side((trial.seed ^ 0x3a7e) >>> 0, MATE_KICKS, "trialist", SHOOTOUT_KICKS),
  };
}

// ───────────────────────────────────────────────────────── the state ──

const LAST_RESULT_HOLD_S = 1.4;      // StrikeStage
const FINAL_HOLD_S = 1.5;            // TrialShootout
const COUNTDOWN_FROM = 3, COUNTDOWN_STEP_S = 0.55;  // TrialSequence
const VISION_WAIT_S = 0.65, VISION_COUNT_S = 0.6, VISION_REVEAL_S = 1.2, VISION_PICK_M = 3.4;
const DRIBBLE_HOLD_S = 1.2;

export interface StrikeStageState {
  kind: "freeKicks" | "technique";
  m: M.MatchState;
  reps: number;
  rep: number;
  points: number[];
  text: string;
  doneAt: number | null;
  gate: GateSetup | null;
  crossed: { x: number; z: number } | null;
  prev: { x: number; y: number; z: number } | null;
}
export interface DribbleStageState {
  setup: DribbleSetup;
  run: FpRunState;
  started: boolean;
  endAt: number | null;
  result: { cleared: boolean; beaten: number } | null;
}
export interface VisionStageState {
  rep: number;
  setup: VisionSetup;
  layout: VisionLayout;
  phase: "ready" | "count" | "live" | "reveal";
  at: number;
  startedAt: number;
  picked: number | null;
  qualities: number[];
}
export interface ShootoutStageState {
  m: M.MatchState;
  seed: number;
  rig: RigState;
  script: RigScript;
  takers: PenaltyTaker[];
  mates: PenaltyTaker[];
  yourKicks: boolean[];
  line: string;
  doneAt: number | null;
}

export interface TrialPlay {
  career: CareerState;
  trial: TrialProgress;
  stage: TrialStage | null;
  clock: number;
  /** Between stages: 3-2-1 (TrialSequence's countdown card); after the last: "A scout has spotted you". */
  card: { kind: "countdown"; at: number; label: string } | { kind: "scout" } | null;
  strike: StrikeStageState | null;
  dribble: DribbleStageState | null;
  vision: VisionStageState | null;
  shootout: ShootoutStageState | null;
  back: TrialReturn;
  done: boolean;
}

const DRILL_FIXTURE = { opponent: "Academy", home: true, week: 0, competition: "Trial", kind: "league" } as unknown as Fixture;

function drillSetup(tp: TrialPlay, seed: number, keeperStrength: number, drill: M.Drill): M.MatchSetup {
  const c = tp.career;
  return {
    career: c, fixture: DRILL_FIXTURE,
    skills: { power: c.skills.power, technique: c.skills.technique },
    canCurve: false, canExtraTouch: false,
    keeperStrength, oppStrength: 70, position: c.player.position, teamRelationship: 60,
    startMinute: 0, conditions: undefined as unknown as M.MatchSetup["conditions"],
    seed, pressure: 0,
    penaltyRunup: careerPenaltyRunup(c), freeKickRunup: careerFreeKickRunup(c),
    drill,
  };
}

/** TrialSequence mounting: the first stage still to play. */
export function startTrialPlay(career: CareerState): TrialPlay {
  const tp: TrialPlay = {
    career, trial: career.trial!, stage: null, clock: 0, card: null,
    strike: null, dribble: null, vision: null, shootout: null,
    back: { results: [], finalPenScored: false }, done: false,
  };
  openStage(tp);
  return tp;
}

function openStage(tp: TrialPlay) {
  const stage = nextStage(tp.trial);
  tp.stage = stage;
  tp.strike = tp.dribble = tp.vision = tp.shootout = null;
  if (!stage) { tp.card = { kind: "scout" }; return; }
  tp.trial = beginStage(tp.trial, stage);
  if (stage === "freeKicks") openStrike(tp, "freeKicks");
  else if (stage === "technique") openStrike(tp, "technique");
  else if (stage === "dribbling") openDribble(tp);
  else if (stage === "vision") openVision(tp);
  else if (stage === "shootout") openShootout(tp);
  else {
    // a stage the Roblox copy does not play (only an old trial has one): scored as missed
    finishStage(tp, stage, 0);
  }
}

/** TrialSequence.finishStage: record it, then the 3-2-1 card. */
function finishStage(tp: TrialPlay, stage: TrialStage, q: number, finalPenScored?: boolean) {
  tp.trial = recordStage(tp.trial, stage, q);
  if (finalPenScored !== undefined) {
    tp.trial = { ...tp.trial, finalPenScored };
    tp.back.finalPenScored = finalPenScored;
  }
  tp.back.results.push({ stage, quality: Math.max(0, Math.min(1, q)) });
  const next = nextStage(tp.trial);
  if (!next) { tp.card = { kind: "scout" }; tp.strike = tp.dribble = tp.vision = tp.shootout = null; return; }
  tp.card = { kind: "countdown", at: tp.clock, label: STAGE_LABEL[next] };
}

// ── 1 and 2: StrikeStage ──
function openStrike(tp: TrialPlay, kind: "freeKicks" | "technique") {
  const trial = tp.trial;
  const seed = ((trial.seed ^ (kind === "freeKicks" ? 0x5f5e : 0x7e4c)) >>> 0);
  const st = { kind, reps: REPS[kind], rep: 0, points: [], text: "", doneAt: null, gate: null, crossed: null, prev: null } as unknown as StrikeStageState;
  const level = ladderLevel(difficultyFor(trial, "technique"));
  const openOn = (): Scenario => {
    const r = st.rep;
    const rng = mulberry32((seed ^ ((r + 1) * 0x9e3779b1)) >>> 0);
    if (kind === "freeKicks") {
      st.m && (st.m.strength = freeKickSetup(tp.trial, r).keeperStrength);
      return buildFreeKickScenario(tp.trial, r, rng);
    }
    const g = buildGate(level, r, rng);
    st.gate = g;
    st.prev = null;
    st.crossed = null;
    return g.scenario;
  };
  const drill: M.Drill = {
    openOn,
    setPieceSkill: trialInvisibleStats().setPieceSkill,
    scene: kind === "technique"
      ? { keeper: false, goal: false, teammates: false, banners: false, you: false, box: false }
      : { teammates: false },
    onBallStep: kind === "technique" ? (b) => {
      if (!st.gate || st.crossed) return;
      const prev = st.prev;
      if (prev) { const c = gateCrossing(prev, b, st.gate.gate.centre.y); if (c) st.crossed = c; }
      st.prev = { ...b };
    } : undefined,
    onChanceResolved: (info) => {
      if (st.doneAt !== null) return;
      let pts: number;
      if (kind === "technique") {
        const g = st.gate;
        pts = g ? gateQuality(st.crossed, g.gateCfg, g.gate.centre.x) : 0;
        st.text = pts >= 0.9 ? "Threaded it!" : pts >= 0.45 ? "Through." : pts > 0 ? "Clipped it." : "Missed the gate.";
      } else {
        const yours = !info.teammateShot;
        pts = !yours ? 0 : info.outcome === "goal" || info.outcome === "rebound" ? 1 : info.outcome === "saved" || info.outcome === "tipped" ? 0.5 : 0;
        st.text = !yours ? "A team-mate gets on the end of it." : pts === 1 ? "Goal!" : pts === 0.5 ? "Saved." : "Missed.";
      }
      st.points.push(pts);
      const next = st.rep + 1;
      if (next >= st.reps) st.doneAt = tp.clock + LAST_RESULT_HOLD_S;
      else st.rep = next;
    },
  };
  const keeper = kind === "freeKicks" ? freeKickSetup(trial, 0).keeperStrength : 62;
  st.m = M.startMatch(drillSetup(tp, seed, keeper, drill));
  tp.strike = st;
}

// ── 3: Take him on ──
function openDribble(tp: TrialPlay) {
  const setup = dribbleSetup(tp.trial);
  const run = newRun({ pace: tp.career.skills.pace ?? 60, oppStrength: setup.oppStrength, rounds: 3, waveSizes: setup.waveSizes, rng: mulberry32(attemptSeed(tp.trial)), mates: 0 });
  tp.dribble = { setup, run, started: false, endAt: null, result: null };
}

// ── 4: Find the pass ──
function visionRep(tp: TrialPlay, rep: number, qualities: number[]): VisionStageState {
  const setup = visionSetup(tp.trial, rep);
  const layout = layoutVision(setup, attemptSeed(tp.trial), rep);
  return { rep, setup, layout, phase: rep === 0 ? "ready" : "count", at: tp.clock, startedAt: 0, picked: null, qualities };
}
function openVision(tp: TrialPlay) { tp.vision = visionRep(tp, 0, []); }

// ── 5: The shootout ──
function openShootout(tp: TrialPlay) {
  const trial = tp.trial;
  const seed = attemptSeed(trial);
  const { them, mates } = takersFor(trial, seed);
  const st = { seed, rig: createRig(), script: createRigScript(seed), takers: them, mates, yourKicks: [], line: "", doneAt: null } as unknown as ShootoutStageState;
  const takerNow = (s: RigState): PenaltyTaker | null => {
    if (s.over || isYourKick(s)) return null;
    const side = rigNextSide(s.kicks);
    const list = side === "them" ? st.takers : st.mates;
    return list[Math.min(rigKicksTaken(s.kicks, side), list.length - 1)];
  };
  // the keeper and his read for the kick that is up now (TrialShootout's props, re-read each render)
  const dial = (drill: M.Drill) => {
    const s = st.rig;
    const side = rigNextSide(s.kicks);
    const theirKeeper = shootoutKeeperFor(trial, rigKicksTaken(s.kicks, "you"));
    const ourKeeper = shootoutOurKeeperFor(rigKicksTaken(s.kicks, "them"));
    const yours = isYourKick(s);
    const intent = s.over || yours ? false : rigIntent(s, st.script);
    drill.penaltyRead = yours ? theirKeeper.read : side === "them" ? rigKeeperRead(intent, ourKeeper.read) : rigKeeperRead(intent, theirKeeper.read);
    if (st.m) st.m.strength = theirKeeper.keeperStrength;
    return theirKeeper.keeperStrength;
  };
  const drill: M.Drill = {
    scene: { teammates: false },
    setPieceSkill: trialInvisibleStats().setPieceSkill,
    openOn: (): Scenario => {
      const s = st.rig;
      const side = rigNextSide(s.kicks);
      const n = s.kicks.length;
      const rng = mulberry32((seed * 7919 + n * 2654435761) >>> 0);
      const ourNo = rigKicksTaken(s.kicks, "you");
      if (s.over || (side === "you" && isYourKick(s))) {
        const k = shootoutKeeperFor(trial, ourNo);
        const sc = buildScenario("penalty", rng, k.keeperStrength, 60, 55);
        initDefenders(sc, rng);
        sc.ball = { x: CX, y: PEN_SPOT_Y };
        clearForShootout(sc);
        return sc;
      }
      const taker = takerNow(s)!;
      const sc0 = side === "them"
        ? buildScenario("penalty", rng, shootoutOurKeeperFor(rigKicksTaken(s.kicks, "them")).keeperStrength, 60, 55)
        : buildScenario("penalty", rng, shootoutKeeperFor(trial, ourNo).keeperStrength, 60, 55);
      initDefenders(sc0, rng);
      sc0.ball = { x: CX, y: PEN_SPOT_Y };
      clearForShootout(sc0);
      const goes = rigIntent(s, st.script);
      attachAutoKick(sc0, {
        side: side === "them" ? "them" : "us",
        taker,
        plan: rigPlanFor(goes, st.script.sides[n] ?? 1, taker.rating, st.script.misses[n] ?? "wide"),
        keeper: side === "them"
          ? { strength: shootoutOurKeeperFor(rigKicksTaken(s.kicks, "them")).keeperStrength, name: "Trialist keeper", shortName: "Your keeper" }
          : { strength: shootoutKeeperFor(trial, ourNo).keeperStrength, name: "Academy keeper", shortName: "Their keeper" },
        context: "shootout",
      });
      return sc0;
    },
    onChanceResolved: (info) => {
      if (st.doneAt !== null || st.rig.over) return;
      const s = st.rig;
      const n = s.kicks.length;
      const scored = (info.outcome === "goal" || info.outcome === "rebound") && !info.teammateShot;
      if (isYourKick(s)) {
        st.yourKicks.push(scored);
        st.line = scored ? "Scored!" : info.outcome === "saved" || info.outcome === "tipped" || info.outcome === "caught" ? "Saved." : info.outcome === "post" ? "Off the post!" : "Missed.";
      } else {
        const who = takerNow(s);
        const miss = st.script.misses[n] ?? "wide";
        const how = info.outcome === "saved" || info.outcome === "caught" || info.outcome === "tipped" ? "Saved!" : MISS_LINE[miss];
        if (rigNextSide(s.kicks) === "them") st.line = scored ? "They score." : `${who?.shortName ?? "Their man"}: ${how}`;
        else st.line = scored ? `${who?.shortName ?? "He"} scores!` : `${who?.shortName ?? "He"}: ${how}`;
      }
      st.rig = rigApply(s, scored);
      dial(drill);
      if (st.rig.over) st.doneAt = tp.clock + FINAL_HOLD_S;
    },
  };
  const keeper = dial(drill);
  st.m = M.startMatch(drillSetup(tp, seed, keeper, drill));
  dial(drill);
  tp.shootout = st;
}

// ───────────────────────────────────────────────────────── each frame ──

export function tick(tp: TrialPlay, dt: number) {
  dt = Math.min(Math.max(0, dt), 0.05);
  tp.clock += dt;
  const card = tp.card;
  if (card) {
    if (card.kind === "countdown" && tp.clock - card.at >= COUNTDOWN_FROM * COUNTDOWN_STEP_S) {
      tp.card = null;
      openStage(tp);
    }
    return;
  }
  const s = tp.strike;
  if (s) {
    M.tick(s.m, dt);
    if (s.doneAt !== null && tp.clock >= s.doneAt) {
      const q = s.points.reduce((a, b) => a + b, 0) / Math.max(1, s.points.length);
      finishStage(tp, s.kind, q);
    }
    return;
  }
  const d = tp.dribble;
  if (d) {
    if (!d.started) return;
    if (d.endAt === null) {
      const ph = stepRun(d.run, dt);
      if (ph !== "running") {
        d.result = { cleared: ph === "clear", beaten: d.run.defenders.filter((x) => x.phase === "beaten").length };
        d.endAt = tp.clock + DRIBBLE_HOLD_S;
      }
    } else if (tp.clock >= d.endAt) finishStage(tp, "dribbling", dribbleQuality(d.result!, d.setup));
    return;
  }
  const v = tp.vision;
  if (v) {
    if (v.phase === "count" && tp.clock - v.at >= (v.rep === 0 ? 3 * VISION_COUNT_S : VISION_WAIT_S)) {
      v.phase = "live";
      v.startedAt = tp.clock;
    } else if (v.phase === "live" && tp.clock - v.startedAt >= v.setup.window) {
      settleVision(tp, v, null, v.setup.window);
    } else if (v.phase === "reveal" && tp.clock - v.at >= VISION_REVEAL_S) {
      if (v.rep + 1 >= REPS.vision) finishStage(tp, "vision", weightedQuality(v.qualities));
      else tp.vision = visionRep(tp, v.rep + 1, v.qualities);
    }
    return;
  }
  const so = tp.shootout;
  if (so) {
    M.tick(so.m, dt);
    if (so.doneAt !== null && tp.clock >= so.doneAt) finishStage(tp, "shootout", shootoutQuality(so.yourKicks), winningPenaltyScored(so.rig));
  }
}

function settleVision(tp: TrialPlay, v: VisionStageState, picked: number | null, took: number) {
  v.picked = picked;
  v.qualities = [...v.qualities, visionQuality(picked, v.setup, took)];
  v.phase = "reveal";
  v.at = tp.clock;
}

// ─────────────────────────────────────────────────────────── input ──

/** A tap that starts something: the dribble's "Tap to start", the vision's first rep, the scout's card. */
export function tapToGo(tp: TrialPlay) {
  if (tp.card?.kind === "scout") { tp.done = true; return; }
  if (tp.dribble && !tp.dribble.started) tp.dribble.started = true;
  if (tp.vision && tp.vision.phase === "ready") { tp.vision.phase = "count"; tp.vision.at = tp.clock; }
}

/** Find the pass: a tap on the pitch (metres); the nearest man within 3.4 m. */
export function visionTap(tp: TrialPlay, p: { x: number; y: number }): boolean {
  const v = tp.vision;
  if (!v || v.phase !== "live") return false;
  let best = -1, bestD = VISION_PICK_M;
  v.layout.men.forEach((mm, i) => { const d = dist(mm, p); if (d < bestD) { bestD = d; best = i; } });
  if (best < 0) return false;
  settleVision(tp, v, best, tp.clock - v.startedAt);
  return true;
}

/** Take him on, on the stick: x right, -1..1 (Roblox: W A S D / the thumb stick moves your lane). */
export function dribbleSteer(tp: TrialPlay, x: number) {
  const d = tp.dribble;
  if (!d || !d.started || d.endAt !== null) return;
  if (Math.abs(x) < 0.08) return;
  applySteer(d.run, d.run.x + x * 3);
}
/** Knock it past him: -1 left, 1 right. */
export function dribbleKnock(tp: TrialPlay, dir: -1 | 1): boolean {
  const d = tp.dribble;
  if (!d || !d.started || d.endAt !== null) return false;
  return applyBurst(d.run, dir);
}

/** The match state of the stage being played on the pitch (free kicks, the gate, the shootout). */
export function pitchMatch(tp: TrialPlay): M.MatchState | null {
  if (tp.card) return null;
  return tp.strike?.m ?? tp.shootout?.m ?? null;
}

// ─────────────────────────────────────────────────────────── the view ──

export interface TrialView {
  stage: TrialStage | null;
  stageNo: number;
  stages: number;
  title: string;
  hint: string;
  line: string;
  card: { kind: string; label?: string; n?: number } | null;
  /** The gate's cones. */
  cones: { x: number; y: number }[];
  /** Take him on: you, them, the ball. */
  dribble: { you: { x: number; y: number }; opp: { x: number; y: number; phase: string }[]; started: boolean; waves: number } | null;
  /** Find the pass: you, the men and their markers; the right man once revealed. */
  vision: { you: { x: number; y: number }; men: { x: number; y: number; marker: { x: number; y: number } }[]; phase: string; count: number;
    left: number; picked: number | null; correct: number | null; rep: number; reps: number } | null;
  shootout: { us: number; them: number; kicks: { side: string; scored: boolean }[]; next: string } | null;
}

const HINTS: Record<string, string> = {
  freeKicks: "Bend it round the wall or lift it over: the sides of the ball curl it, the bottom lifts it.",
  technique: "Put it through the cones: strike the side of the ball to bend it in.",
  dribbling: "Move with W A S D or the stick. Knock it past him with Q / E or the buttons.",
  vision: "Tap the man in the most space before the time runs out.",
  shootout: "Three kicks each. Yours is the last one.",
};

export function trialView(tp: TrialPlay): TrialView {
  const stages = TRIAL_STAGES.length;
  const stage = tp.stage;
  const stageNo = stage ? TRIAL_STAGES.indexOf(stage) + 1 : stages;
  const card = tp.card;
  const out: TrialView = {
    stage, stageNo, stages,
    title: stage ? STAGE_LABEL[stage] : "Trial over",
    hint: stage ? HINTS[stage] ?? "" : "",
    line: tp.strike?.text ?? tp.shootout?.line ?? "",
    card: card ? card.kind === "countdown"
      ? { kind: "countdown", label: card.label, n: Math.max(1, COUNTDOWN_FROM - Math.floor((tp.clock - card.at) / COUNTDOWN_STEP_S)) }
      : { kind: "scout" } : null,
    cones: tp.strike?.gate ? [tp.strike.gate.gate.left, tp.strike.gate.gate.right] : [],
    dribble: null, vision: null, shootout: null,
  };
  const d = tp.dribble;
  if (d) {
    out.dribble = { you: { x: d.run.x, y: d.run.y }, opp: d.run.defenders.map((x) => ({ x: x.x, y: x.y, phase: x.phase })), started: d.started, waves: d.setup.waveSizes.length };
    if (d.result) out.line = d.result.cleared ? "Through!" : `Beat ${d.result.beaten} of ${d.setup.defenders}.`;
  }
  const v = tp.vision;
  if (v) {
    const count = v.phase === "count" && v.rep === 0 ? Math.max(1, 3 - Math.floor((tp.clock - v.at) / VISION_COUNT_S)) : 0;
    out.vision = {
      you: v.layout.you, men: v.layout.men.map((mm) => ({ x: mm.x, y: mm.y, marker: mm.marker })),
      phase: v.phase, count,
      left: v.phase === "live" ? Math.max(0, v.setup.window - (tp.clock - v.startedAt)) / v.setup.window : v.phase === "reveal" ? 0 : 1,
      picked: v.picked, correct: v.phase === "reveal" ? v.setup.correct : null, rep: v.rep, reps: REPS.vision,
    };
    if (v.phase === "reveal") out.line = v.picked === null ? "Too slow." : v.picked === v.setup.correct ? "Found him!" : "Not him.";
  }
  const so = tp.shootout;
  if (so) {
    const s = so.rig;
    const side = rigNextSide(s.kicks);
    out.shootout = {
      us: rigGoals(s.kicks, "you"), them: rigGoals(s.kicks, "them"),
      kicks: s.kicks.map((k) => ({ side: k.side, scored: k.scored })),
      next: s.over ? "" : isYourKick(s) ? "You" : side === "them" ? THEM : US,
    };
  }
  return out;
}

// ─────────────────────────────────────── the picture, for the 3D pitch ──

const TRIAL_KITS = {
  us: { shirt: "#2563eb", trim: "#f8fafc" },
  them: { shirt: "#dc2626", trim: "#111827" },
  keeper: { shirt: "#16a34a", trim: "#052e16" },
  ourKeeper: { shirt: "#f59e0b", trim: "#111827" },
};
/** TrialVision's camera: everything it must show (MUST_SEE). */
const VISION_CAMERA = { x1: 16.5, x2: 51.5, y1: -NET_DEPTH - 1, y2: 36 + 1.6 };

/** One frame of the trial for Roblox: the 3D pitch's picture (matchView's shape) plus the trial's own words. */
export interface TrialFrame extends V.Frame {
  mode: "pitch" | "dribble" | "vision" | "card";
  trial: TrialView;
}

export function trialFrame(tp: TrialPlay): TrialFrame {
  const tv = trialView(tp);
  const m = pitchMatch(tp);
  if (m) {
    const f = V.frameOf(m);
    return { ...f, mode: "pitch", trial: tv, score: { ...f.score, usName: US, themName: THEM } };
  }
  const base: V.Frame = {
    phase: "trial", cameraMode: "chance", minute: 0,
    score: { us: 0, them: 0, usName: US, themName: THEM, home: true },
    kits: TRIAL_KITS, bodies: [], ball: null,
    camera: { ...VISION_CAMERA, facing: "up", tilt: 0 },
    goal: { x1: POST_L, x2: POST_R, crossbar: 2.44 },
    aim: null, passTarget: null, feed: [], log: [], banner: null, pause: null,
    energy: 100, stamina: null, speed: 1, energyMode: "medium", playstyle: "balanced",
    controls: { powerShot: false, powerArmed: false, curve: false, steer: false, callForIt: false, nudge: false, dribble: false, touchMode: false },
    shootout: null,
  };
  const d = tv.dribble;
  if (d && tp.dribble) {
    base.bodies.push({ id: "you", side: "you", x: d.you.x, y: d.you.y, name: tp.career.player.lastName });
    d.opp.forEach((o, i) => base.bodies.push({ id: `fd${i}`, side: "opp", x: o.x, y: o.y }));
    base.bodies.push({ id: "keeper", side: "keeper", x: CX, y: 0.6 });
    base.ball = { x: d.you.x, y: d.you.y - 0.6, z: 0 };
    base.cameraMode = "chase";
    base.phase = "trialDribble";
    base.controls = { ...base.controls, dribble: d.started && tp.dribble.endAt === null };
    return { ...base, mode: "dribble", trial: tv };
  }
  const v = tv.vision;
  if (v) {
    base.bodies.push({ id: "you", side: "you", x: v.you.x, y: v.you.y, name: tp.career.player.lastName });
    v.men.forEach((mm, i) => {
      base.bodies.push({ id: `vm${i}`, side: "mate", x: mm.x, y: mm.y, option: true, name: v.correct === i ? "FREE" : v.picked === i ? "✗" : undefined });
      base.bodies.push({ id: `vk${i}`, side: "opp", x: mm.marker.x, y: mm.marker.y });
    });
    base.bodies.push({ id: "keeper", side: "keeper", x: CX, y: 0.6 });
    base.ball = { x: v.you.x, y: v.you.y - 0.6, z: 0 };
    base.phase = "trialVision";
    return { ...base, mode: "vision", trial: tv };
  }
  base.phase = "trialCard";
  return { ...base, mode: "card", trial: tv };
}
