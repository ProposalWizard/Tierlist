/**
 * THE DRIVE, START TO FINISH (driving phase 1, 28 Nov 2026; docs/plans/DRIVING_PLAN.md §2).
 * Pure state machine the scene (./scene.ts) draws:
 *
 *   intro  (1.6 s)  your car outside the garden gate, a slow look at it
 *   drive  (25-30 s auto) your street → the roundabout → the country lane → the compound gate
 *   arrive (≈7 s)   the TikTok moment: a low wide camera by the barrier, the arm lifts, you roll
 *                   in and swing into your bay, two team-mates turn to look; cut on the door
 *   done
 *
 * The way back (`leg: "back"`): the lane, the roundabout, your street, and a fork at the end:
 * Home / Casino / Shop (phase "fork", then a fade).
 *
 * A call may ring on the dash 8-15 s in (./calls.ts). Skip ends it from the first frame.
 */
import { buildRoute, at, DRIVE_IN, LANE, type Piece, type Route } from "./route";
import { startCar, stepCar, stepTraffic, type CarState, type SteerMode, type Traffic, type CarSpec } from "./car";
import { callMemory, callTime, fillCall, pickCall, CALL_RING_S, type CallMemory, type DriveCall } from "./calls";
import type { Quality3d } from "../three3d/quality";

export type DrivePhase = "intro" | "drive" | "arrive" | "fork" | "done";
export type DriveCam = "chase" | "bumper" | "cabin";
export type ForkChoice = "home" | "casino" | "shop";

export const INTRO_S = 1.6;
/** The arrival takes over this far before the barrier (m). */
export const ARRIVE_FROM = 16;
/** After the car stops: the door moment, then the fade. */
export const DOOR_AFTER_STOP_S = 0.55;
export const FADE_S = 0.5;
export const STEP = 1 / 60;

/** The way back: the drive in, backwards (no car park), ending at the fork. */
export function driveBackPieces(): Piece[] {
  const road = DRIVE_IN.filter((p) => p.kind !== "park");
  const back: Piece[] = road.slice().reverse().map((p) => (p.turn ? { ...p, turn: -p.turn } : { ...p }));
  // leaving the compound: slow first; the street ends at the fork
  back[0] = { ...back[0], speed: 12 };
  back.push({ kind: "street", len: 12, speed: 5 });
  return back;
}

/** How many cars are on the road, by quality (Low: none; DRIVING_PLAN.md §3 budget). */
export const TRAFFIC_BY_TIER: Record<Quality3d, number> = { low: 0, medium: 3, high: 5 };

/** The light copies the traffic uses, repainted (no new models). */
const TRAFFIC_MODELS = ["family", "suv", "hatch", "classic", "family", "suv"];
const TRAFFIC_PAINT = ["#e9e6df", "#20242c", "#7d8794", "#2c4f7c", "#6b1f24", "#c7c9cc"];

export function makeTraffic(route: Route, n: number): Traffic[] {
  // where the lane starts (the slow car ahead lives there), and the oncoming cars spread through the drive
  const laneS = route.pts.find((p) => p.kind === "lane")?.s ?? route.length * 0.5;
  const out: Traffic[] = [];
  const plan: Omit<Traffic, "model" | "paint" | "id">[] = [
    { dir: 1, s: laneS - 75, v: 8 },      // a slow car ahead (a learner): you catch it on the lane and overtake
    { dir: -1, s: 150, v: 12 },           // oncoming in your street
    { dir: -1, s: laneS + 230, v: 17 },   // oncoming on the lane (after you've passed the slow one)
    { dir: 1, s: 60, v: 11.5 },           // a car pulling away in your street
    { dir: -1, s: laneS + 120, v: 16 },
  ];
  for (let i = 0; i < Math.min(n, plan.length); i++) out.push({ ...plan[i], id: `traffic-${i}`, model: TRAFFIC_MODELS[i], paint: TRAFFIC_PAINT[i] });
  return out;
}

export interface DriveOptions {
  leg: "in" | "back";
  tier: Quality3d;
  seed: number;
  mode: SteerMode;
  spec: CarSpec;
  /** Force a call by id ("none" = no call). */
  call?: string;
  names: { mate: string; car: string; club: string };
  day?: number;
}

export interface DriveSession {
  opts: DriveOptions;
  route: Route;
  car: CarState;
  traffic: Traffic[];
  phase: DrivePhase;
  t: number;
  /** Time in the arrival (s). */
  ta: number;
  /** When the car came to rest in the bay (arrival time), or −1. */
  stoppedAt: number;
  call: DriveCall | null;
  callAt: number;
  callState: "waiting" | "ringing" | "answered" | "over";
  callAnswer: "yes" | "no" | "missed" | null;
  callSince: number;
  memories: CallMemory[];
  fork: ForkChoice | null;
  forkAt: number;
  skipped: boolean;
  cam: DriveCam;
  /** Fade to black 0..1 (the door moment, the fork, a skip). */
  fade: number;
  /** The film: a scripted thumb. */
  script?: DriveScript;
}

export interface DriveScript { hold?: [number, number][]; taps?: [number, -1 | 1][]; answer?: [number, "yes" | "no"]; fork?: [number, ForkChoice] }

export function newDrive(opts: DriveOptions): DriveSession {
  const route = buildRoute(opts.leg === "in" ? DRIVE_IN : driveBackPieces());
  const raw = opts.call === "none" ? null : pickCall(opts.seed, opts.leg, opts.call);
  return {
    opts, route, car: startCar(), traffic: makeTraffic(route, TRAFFIC_BY_TIER[opts.tier]),
    phase: opts.leg === "in" ? "intro" : "drive", t: 0, ta: 0, stoppedAt: -1,
    call: raw ? fillCall(raw, opts.names) : null, callAt: callTime(opts.seed), callState: "waiting", callAnswer: null, callSince: 0,
    memories: [], fork: null, forkAt: -1, skipped: false, cam: "chase", fade: 0,
  };
}

export interface DriveInput { hold: boolean; tap?: -1 | 1 | 0; side?: number }

/** One fixed step (STEP) of the whole drive. */
export function stepDrive(S: DriveSession, input: DriveInput, dt = STEP): void {
  if (S.phase === "done") return;
  S.t += dt;
  const sc = S.script;
  if (sc) {
    input = { ...input, hold: input.hold || !!sc.hold?.some(([a, b]) => S.t >= a && S.t < b) };
    const tap = sc.taps?.find(([tt]) => S.t >= tt && S.t - dt < tt);
    if (tap) input.tap = tap[1];
    if (sc.answer && S.callState === "ringing" && S.t >= sc.answer[0]) answerCall(S, sc.answer[1]);
    if (sc.fork && S.phase === "fork" && S.t >= sc.fork[0] && !S.fork) chooseFork(S, sc.fork[1]);
  }
  if (S.skipped) { S.fade = Math.min(1, S.fade + dt / FADE_S); if (S.fade >= 1) S.phase = "done"; return; }

  if (S.phase === "intro") { if (S.t >= INTRO_S) S.phase = "drive"; return; }

  const auto = S.opts.mode === "lanes";
  if (S.phase === "drive" || S.phase === "arrive") {
    stepTraffic(S.route, S.traffic, dt);
    stepCar(S.route, S.car, S.phase === "arrive" ? { hold: false } : input, dt, S.opts.spec, { mode: S.phase === "arrive" ? "lanes" : S.opts.mode, traffic: S.traffic, auto });
  }

  // ── the call ──
  if (S.call && S.callState === "waiting" && S.phase === "drive" && S.t >= S.callAt + (S.opts.leg === "in" ? INTRO_S : 0)) { S.callState = "ringing"; S.callSince = S.t; }
  if (S.callState === "ringing" && S.t - S.callSince > CALL_RING_S) { S.callState = "over"; S.callAnswer = "missed"; S.memories.push(callMemory(S.call!, "missed", S.opts.day ?? 0)); }
  if (S.callState === "answered" && S.t - S.callSince > 3.2) S.callState = "over";
  if (S.callState === "ringing" && S.phase !== "drive") { S.callState = "over"; S.callAnswer = "missed"; S.memories.push(callMemory(S.call!, "missed", S.opts.day ?? 0)); }

  if (S.phase === "drive") {
    if (S.opts.leg === "in" && S.car.s >= S.route.gateS - ARRIVE_FROM) { S.phase = "arrive"; S.ta = 0; }
    if (S.opts.leg === "back" && S.car.s >= S.route.length - 0.05 && S.car.v < 0.05) { S.phase = "fork"; S.forkAt = S.t; }
  } else if (S.phase === "arrive") {
    S.ta += dt;
    if (S.stoppedAt < 0 && S.car.s >= S.route.length - 0.05 && S.car.v < 0.05) S.stoppedAt = S.ta;
    if (S.stoppedAt >= 0 && S.ta > S.stoppedAt + DOOR_AFTER_STOP_S) {
      S.fade = Math.min(1, S.fade + dt / FADE_S);
      if (S.fade >= 1 && S.ta > S.stoppedAt + DOOR_AFTER_STOP_S + FADE_S + 1.1) S.phase = "done";
    }
  } else if (S.phase === "fork" && S.fork) {
    S.fade = Math.min(1, S.fade + dt / FADE_S);
    if (S.fade >= 1) S.phase = "done";
  }
}

export function answerCall(S: DriveSession, a: "yes" | "no") {
  if (!S.call || S.callState !== "ringing") return;
  S.callState = "answered"; S.callAnswer = a; S.callSince = S.t;
  S.memories.push(callMemory(S.call, a, S.opts.day ?? 0));
}

export function chooseFork(S: DriveSession, c: ForkChoice) { if (S.phase === "fork" && !S.fork) S.fork = c; }
export function skipDrive(S: DriveSession) { S.skipped = true; }

/** Where the barrier is (route point) and how far its arm is up (0 down, 1 up). */
export function barrierLift(S: DriveSession): number {
  const d = S.car.s - (S.route.gateS - 15);
  const x = Math.max(0, Math.min(1, d / 7));
  return x * x * (3 - 2 * x);
}

/** The bay shot takes over this far past the barrier (the car is past the low camera, turning in). */
export const BAY_SHOT_FROM = 13;

/** The arrival's shots: the barrier (low, wide) until you are through, then the bay with the two team-mates. */
export function arrivalShot(S: DriveSession): "barrier" | "bay" {
  return S.car.s < S.route.gateS + BAY_SHOT_FROM ? "barrier" : "bay";
}

/** How far the two team-mates have turned to look at you (0..1): from a beat after the bay shot opens. */
export function matesTurn(S: DriveSession): number {
  const into = S.car.s - (S.route.gateS + BAY_SHOT_FROM);
  if (into <= 0) return 0;
  const x = Math.max(0, Math.min(1, (into - 1.5) / 6));
  return x * x * (3 - 2 * x);
}

/** The camera to use this frame: the chosen one, but the call's first seconds show the dash. */
export function liveCam(S: DriveSession): DriveCam {
  if (S.callState === "ringing" && S.t - S.callSince < 2.6) return "cabin";
  return S.cam;
}

export function cycleCam(S: DriveSession) { S.cam = S.cam === "chase" ? "bumper" : S.cam === "bumper" ? "cabin" : "chase"; }

/** The line a team-mate says when you pull in, by the car (and how fancy it is). */
export function arrivalLine(carId: string, mate: string, level = 1): string {
  const fancy = ["super", "sports"].includes(carId) || level >= 4;
  const L: Record<string, string> = {
    hatch: `${mate}: "Here he is. Sensible little motor, that."`,
    family: `${mate}: "Room for the whole back four in that."`,
    suv: `${mate}: "Look at the size of it! Parking that's a skill."`,
    classic: `${mate}: "Proper old school. Where'd you find that?"`,
    sports: `${mate}: "Easy, easy! Who d'you think you are?"`,
    super: `${mate}: "No way. NO WAY. Give us a go after training!"`,
  };
  return L[carId] ?? (fancy ? `${mate}: "Someone's been paid!"` : `${mate}: "Morning. Nice wheels."`);
}

/** The route's time from gate to gate on auto with no traffic (the tests' number). */
export function autoDriveSeconds(opts: Omit<DriveOptions, "tier"> & { tier?: Quality3d }, hold = false): number {
  const S = newDrive({ ...opts, tier: opts.tier ?? "low", call: "none" });
  S.phase = "drive";
  let n = 0;
  while (S.car.s < S.route.gateS && n < 60 * 120) { stepDrive(S, { hold }); n++; }
  return n * STEP;
}

export { LANE, at };
