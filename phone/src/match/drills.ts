/**
 * THE PICTURES THE TRIAL AND THE DRILLS PLAY — the pure builders the
 * website keeps inside its screen files, ported line for line (they are in
 * React files there, so they cannot be imported on the phone):
 *   - components/star/TrainingMinigame.tsx: DRILL_SCENE, buildStrike, buildStrikeFrom
 *   - components/star/stages/TrialFreeKicks.tsx: freeKickView, freeKickWall, buildFreeKickScenario
 * Every number and every lib/star call is the website's.
 */
import { markDrillFreeKick } from "@/lib/star/kindRules";
import { buildScenario, initDefenders, clamp, VIEW_ASPECT, type Scenario, type Viewport } from "@/lib/star/canvasEngine";
import { CX, POST_L, POST_R, NET_DEPTH, PITCH_W, HALF_LEN } from "@/lib/star/pitch";
import { freeKickSetup, type FreeKickSetup } from "@/lib/star/trialStages";
import type { TrialProgress } from "@/lib/star/trial";
import type { PowerLevel, TechniqueLevel, FreeKickLevel, AerialLevel } from "@/lib/star/trainingLevelData";
import {
  powerDrill, powerDrillForLevel, techniqueDrill, freeKickDrill,
  strikeSpot, conePositions, powerManSpots, wallSpots, placedMen, techniqueBallSpot,
} from "@/lib/star/trainingDrills";
import { strikeViewport, gateViewport, type TrainingViewport } from "@/lib/star/trainingRender";
import { setAirZ, type AirHeighted } from "@/lib/star/airDrawings";
import type { ScenePicture } from "@/lib/star/scenePicture";

export type StrikeKind = "power" | "technique" | "freeKick" | "aerial";
export const DRILL_SCENE: Record<StrikeKind, ScenePicture> = {
  technique: { keeper: false, goal: false, teammates: false, banners: false },
  power: { teammates: false, banners: false, ownFrame: true },
  freeKick: { teammates: false, banners: false },
  aerial: { banners: false, ownFrame: true },
};
export interface StrikeSetup {
  scenario: Scenario;
  viewport: TrainingViewport;
  gate: { left: { x: number; y: number }; right: { x: number; y: number }; centre: { x: number; y: number } } | null;
  gateCfg: TechniqueLevel | null;
  brief: string;
  openGoal?: boolean;
  pass: number;
}
export type StrikeLevel = PowerLevel | TechniqueLevel | FreeKickLevel | AerialLevel;

export function buildStrike(kind: StrikeKind, level: number, rep: number, rng: () => number, byLevel?: { trainingLevel: number; power: number }): StrikeSetup {
  if (kind === "technique") return buildStrikeFrom(kind, { ...techniqueDrill(level, rep), pass: 0.25 }, rng);
  if (kind === "aerial") return buildStrikeFrom(kind, { volley: rep % 2 === 1, keeperStrength: 20 + 0.76 * Math.max(0, level - 40) / 0.6, marker: level >= 55, pass: 0.5, ballZ: 1.75 + 0.8 * Math.max(0, Math.min(1, (level - 40) / 60)) } as AerialLevel, rng);
  if (kind === "freeKick") return buildStrikeFrom(kind, { ...freeKickDrill(level, rep), pass: 0.5 }, rng);
  const cfg = byLevel ? powerDrillForLevel(byLevel.trainingLevel, rep, byLevel.power) : { ...powerDrill(level, rep), keeper: true };
  return buildStrikeFrom(kind, { ...cfg, pass: 0.5 } as PowerLevel, rng);
}

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
      scenario: sc, viewport: strikeViewport(sc.ball), gate: null, gateCfg: null,
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
    return { scenario: sc, viewport: gateViewport(ball, gate), gate, gateCfg: cfg, brief: `${cfg.gateDistance.toFixed(0)}m · ${cfg.gateWidth.toFixed(1)}m gate`, pass: cfg.pass };
  }
  if (kind === "freeKick") {
    const cfg = row as FreeKickLevel;
    const ball = strikeSpot(cfg.distance, cfg.offset);
    const sc = buildScenario("free_kick", rng, cfg.keeperStrength, 60, 55);
    sc.ball = { x: ball.x, y: ball.y };
    sc.player = { x: ball.x, y: ball.y + 0.8 };
    sc.keeperStrength = cfg.keeperStrength;
    initDefenders(sc, rng);
    sc.defenders = placedMen(wallSpots(ball, cfg.wall), cfg.men, cfg.wall).map((at) => ({ x: at.x, y: at.y, role: "hold" as const, baseRole: "hold" as const, speed: 0, z: 0, vz: 0 }));
    return { scenario: sc, viewport: strikeViewport(ball), gate: null, gateCfg: null, brief: `${cfg.distance.toFixed(0)}m · ${cfg.wall}-man wall`, pass: cfg.pass };
  }
  const cfg = row as PowerLevel;
  const ball = strikeSpot(cfg.distance, cfg.offset);
  const sc = buildScenario("long_range", rng, cfg.keeperStrength, 60, 55);
  sc.ball = { x: ball.x, y: ball.y };
  sc.player = { x: ball.x, y: ball.y + 0.8 };
  sc.keeperStrength = cfg.keeperStrength;
  initDefenders(sc, rng);
  sc.defenders = placedMen(powerManSpots(ball, cfg.blockers), cfg.men, cfg.blockers).map((at) => ({ x: at.x, y: at.y, role: "hold" as const, baseRole: "hold" as const, speed: 0.9, z: 0, vz: 0 }));
  return {
    scenario: sc, viewport: strikeViewport(ball), gate: null, gateCfg: null,
    brief: (cfg.keeper ? `${cfg.distance.toFixed(0)}m · ${cfg.blockers} in the way` : `${cfg.distance.toFixed(0)}m · open goal`) + (cfg.pass > 0.5 ? " · near a post" : ""),
    openGoal: !cfg.keeper,
    pass: cfg.pass,
  };
}

// ── The trial's free kicks (stages/TrialFreeKicks.tsx) ──
const BEHIND_BALL = 7;
const SIDE_PAD = 2.5;
const BASE_VIEW_H = 42;
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
export function buildFreeKickScenario(trial: TrialProgress, rep: number, rng: () => number): Scenario {
  const setup = freeKickSetup(trial, rep);
  const sc = buildScenario("free_kick", rng, setup.keeperStrength, 60, 55);
  sc.ball = { ...setup.ball };
  sc.player = { x: setup.ball.x, y: setup.ball.y + 2 };
  sc.defenders = freeKickWall(setup) as Scenario["defenders"];
  sc.keeperStrength = setup.keeperStrength;
  initDefenders(sc, rng);
  sc.viewport = freeKickView(setup.ball);
  return markDrillFreeKick(sc);
}
