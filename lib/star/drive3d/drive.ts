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
import { pickEvent, fillEvent, eventStartS, eventOutcome, raceWon, CAMERA_AHEAD, CAMERA_LIMIT, CAMERA_SLOW, RACE_S, RACE_BOOST, CROSS_AHEAD, STOP_SHORT, BREAKDOWN_AHEAD, HELP_S, FAN_CLEAR_S, type DriveEvent, type DriveEffect, type EventOutcome } from "./events";
import { formatMoney, MONEY_SIGN } from "../money";
import { laneClear } from "./car";
import { BRAKE } from "./route";

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
  /** Force an event by id ("none" = no event; absent = the seeded one, ./events.ts pickEvent). */
  event?: string;
  /** Your car (the race's odds) and your weekly wage (a fine is a share of it). */
  carId?: string;
  wage?: number;
  /** The drive in hands over to the real compound (./arrival.ts, lib/star/world3d/testScene.ts opts.arrive): it fades
   *  out on the compound road, HANDOVER_AT before the barrier, instead of playing the old stand-in arrival. */
  handover?: boolean;
}

/** The drive in hands over this far before the barrier (m): on the compound road, its fence in the fog. */
export const HANDOVER_AT = 24;

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
  // ── the event (./events.ts): at most one a drive besides the call ──
  event: DriveEvent | null;
  /** Where on the road it starts (s), −1 = none on this route. */
  eventS: number;
  /** waiting → open (the card asks) → done (the card shows what happened) → over. */
  eventState: "waiting" | "open" | "done" | "over";
  eventAnswer: "yes" | "no" | null;
  eventSince: number;
  outcome: EventOutcome | null;
  /** What the drive changes in the career (dilemmas.ts applyEffects, one per event). */
  effects: DriveEffect[];
  /** The speed camera: where it stands (s), and whether you asked to slow down. */
  cameraS: number;
  slowing: boolean;
  /** The race: the team-mate's car (s along the road, speed; in the overtaking lane), when the burst started. */
  mateCar: { s: number; v: number; off: number } | null;
  raceT0: number;
  /** Rain 0..1 (eases in). */
  rain: number;
  /** Where you stop for the event (s): the fan's crossing, the broken-down car when you help; −1 = no stop. */
  stopS: number;
  /** Helping at the broken-down car: when you came to a stop beside it (t), −1 before. */
  helping: boolean;
  helpAt: number;
}

export interface DriveScript { hold?: [number, number][]; taps?: [number, -1 | 1][]; answer?: [number, "yes" | "no"]; fork?: [number, ForkChoice]; /** answer the event's card this many seconds after it opens */ event?: [number, "yes" | "no"] }

/** An event's card waits this long for a choice; then it is a "no" (s). The outcome shows for EVENT_SHOW_S. */
export const EVENT_DECIDE_S = 7;
export const EVENT_SHOW_S = 3.6;

export function newDrive(opts: DriveOptions): DriveSession {
  const route = buildRoute(opts.leg === "in" ? DRIVE_IN : driveBackPieces());
  const raw = opts.call === "none" ? null : pickCall(opts.seed, opts.leg, opts.call);
  const ev0 = pickEvent(opts.seed, opts.leg, opts.event);
  const route0 = route;
  const evS = ev0 ? eventStartS(route0, ev0) : -1;
  const ev = ev0 && evS >= 0 ? fillEvent(ev0, opts.names.mate) : null;
  // a race day has nobody else on the lane (the race needs both lanes): the street's cars stay
  const laneS0 = route.pts.find((p) => p.kind === "lane")?.s ?? 0;
  // a fan or breakdown day has nobody going your way (they would drive through him on the crossing, or block the view)
  const traffic = makeTraffic(route, TRAFFIC_BY_TIER[opts.tier]).filter((c) => !(ev?.id === "mate-race" && (c.dir === 1 || c.s > laneS0 - 20)) && !((ev?.id === "fan-crossing" || ev?.id === "breakdown") && c.dir === 1));
  return {
    event: ev, eventS: ev ? evS : -1, eventState: ev ? "waiting" : "over", eventAnswer: null, eventSince: 0, outcome: null, effects: [],
    cameraS: ev?.id === "speed-camera" ? Math.min(route.length - 2, evS + CAMERA_AHEAD) : -1, slowing: false, mateCar: null, raceT0: -1, rain: 0,
    stopS: -1, helping: false, helpAt: -1,
    opts, route, car: startCar(), traffic,
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
    if (sc.event && S.eventState === "open" && S.t - S.eventSince >= sc.event[0]) answerEvent(S, sc.event[1]);
  }
  if (S.skipped) { S.fade = Math.min(1, S.fade + dt / FADE_S); if (S.fade >= 1) S.phase = "done"; return; }

  if (S.phase === "intro") { if (S.t >= INTRO_S) S.phase = "drive"; return; }

  // while the team-mate's car is alongside, no lane changes (his lane)
  const auto = S.opts.mode === "lanes" && !S.mateCar;
  if (S.mateCar) input = { ...input, tap: 0 };
  if (S.phase === "drive" || S.phase === "arrive") {
    stepTraffic(S.route, S.traffic, dt);
    // an event's hold on your speed: slowing for the camera, the race's burst
    const racing = S.raceT0 >= 0 && S.t - S.raceT0 < RACE_S;
    // stopping for the event: the fan on the crossing (until he has walked off), the broken-down car while you help
    const stopping = S.stopS >= 0 && S.car.s <= S.stopS + 0.5 && (
      (S.event?.id === "fan-crossing" && (S.eventState === "open" || (S.eventState === "done" && (S.helpAt < 0 || S.t - Math.max(S.helpAt, S.eventSince) < FAN_CLEAR_S)))) ||
      (S.event?.id === "breakdown" && S.helping && S.eventState === "open"));
    const stopCap = stopping ? Math.sqrt(2 * BRAKE * 0.7 * Math.max(0, S.stopS - S.car.s)) : undefined;
    const camCap = S.slowing && S.car.s < S.cameraS + 4 ? CAMERA_SLOW : undefined;
    const cap = stopCap !== undefined && camCap !== undefined ? Math.min(stopCap, camCap) : stopCap ?? camCap;
    const evIn = { ...input, cap, boost: racing ? RACE_BOOST : undefined };
    stepCar(S.route, S.car, S.phase === "arrive" ? { hold: false } : evIn, dt, S.opts.spec, { mode: S.phase === "arrive" ? "lanes" : S.opts.mode, traffic: S.traffic, auto });
    stepEvent(S, dt);
  }

  // ── the call ──
  const evCard = S.eventState === "open" || S.eventState === "done";
  if (S.call && S.callState === "waiting" && S.phase === "drive" && !evCard && S.t >= S.callAt + (S.opts.leg === "in" ? INTRO_S : 0)) { S.callState = "ringing"; S.callSince = S.t; }
  if (S.callState === "ringing" && S.t - S.callSince > CALL_RING_S) { S.callState = "over"; S.callAnswer = "missed"; S.memories.push(callMemory(S.call!, "missed", S.opts.day ?? 0)); }
  if (S.callState === "answered" && S.t - S.callSince > 3.2) S.callState = "over";
  if (S.callState === "ringing" && S.phase !== "drive") { S.callState = "over"; S.callAnswer = "missed"; S.memories.push(callMemory(S.call!, "missed", S.opts.day ?? 0)); }

  if (S.phase === "drive" && S.opts.handover && S.opts.leg === "in" && S.car.s >= S.route.gateS - HANDOVER_AT) {
    // the hand-over: a fade on the compound road, then the compound's own arrival takes the car in
    S.fade = Math.min(1, S.fade + dt / FADE_S);
    if (S.fade >= 1) {
      S.phase = "done";
      if (S.callState === "ringing") { S.callState = "over"; S.callAnswer = "missed"; S.memories.push(callMemory(S.call!, "missed", S.opts.day ?? 0)); }
    }
  } else if (S.phase === "drive") {
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

/** The event, each step: it opens at its place on the road (never over a call's card), waits for you, plays out. */
function stepEvent(S: DriveSession, dt: number) {
  const ev = S.event;
  S.rain = Math.max(0, Math.min(1, S.rain + (ev?.id === "rain" && S.eventState !== "waiting" ? dt / 3 : 0)));
  if (!ev || S.eventState === "over") { stepMate(S, dt); return; }
  const callUp = S.callState === "ringing" || S.callState === "answered";
  if (S.eventState === "waiting") {
    // a card never covers the call's; the race also waits for a clear other lane (nobody coming for 250 m)
    // the race needs ~100 m of lane left for its burst; the others give up 90 m past their place
    const laneEnd = S.route.pts.reduce((e, p) => (p.kind === "lane" ? p.s : e), 0);
    const late = ev.id === "mate-race" ? S.car.s > laneEnd - 100 : S.car.s > S.eventS + 90;
    if (late && ev.kind !== "notice") { S.eventState = "over"; return; }
    if (S.phase !== "drive" || S.car.s < S.eventS || callUp) return;
    // the race: you in your own lane, nobody ahead of you in it for 200 m and nobody coming within sight (he passes on the
    // right); the oncoming cars further on, still in the fog, turn off before you meet them
    if (ev.id === "mate-race") {
      // (he comes up from 16 m behind you: nobody coming may have just passed you either)
      if (S.car.laneTo < 0 || S.car.laneT < 1 || !laneClear(S.traffic, S.car.s, -1, 90) || S.traffic.some((c) => (c.dir === 1 && c.s > S.car.s - 5 && c.s < S.car.s + 200) || (c.dir === -1 && c.s > S.car.s - 45 && c.s < S.car.s))) return;
      for (let i = S.traffic.length - 1; i >= 0; i--) if (S.traffic[i].dir === -1 && S.traffic[i].s > S.car.s + 90) S.traffic.splice(i, 1);
    }
    if (ev.id === "speed-camera" && S.car.s > S.cameraS - 40) { S.eventState = "over"; return; }
    S.eventState = "open"; S.eventSince = S.t;
    if (ev.id === "fan-crossing") S.stopS = Math.max(S.eventS + CROSS_AHEAD - STOP_SHORT, S.car.s + (S.car.v * S.car.v) / (2 * BRAKE * 0.7) + 0.5);
    if (ev.id === "mate-race") S.mateCar = { s: S.car.s - 16, v: S.car.v + 5, off: -LANE };
    if (ev.kind === "notice") finishEvent(S, "yes");
    return;
  }
  stepMate(S, dt);
  // the fan: when you came to a stop for him (he walks off once you have stopped AND answered)
  if (ev.id === "fan-crossing" && S.helpAt < 0 && S.car.v < 0.05 && S.car.s >= S.stopS - 1) S.helpAt = S.t;
  if (S.eventState === "open") {
    if (ev.id === "speed-camera") {
      if (S.car.s >= S.cameraS) finishEvent(S, S.slowing ? "yes" : "no", { fast: S.car.v > CAMERA_LIMIT });
    } else if (ev.id === "mate-race" && S.raceT0 >= 0) {
      if (S.t - S.raceT0 >= RACE_S) finishEvent(S, "yes", { won: raceWon(S.opts.seed, S.opts.carId ?? "hatch") });
    } else if (ev.id === "breakdown" && S.helping) {
      // pulled over beside it: a couple of seconds there, then what happened
      if (S.helpAt < 0 && S.car.v < 0.05 && S.car.s >= S.stopS - 0.6) S.helpAt = S.t;
      if (S.helpAt >= 0 && S.t - S.helpAt >= HELP_S) finishEvent(S, "yes");
    } else if (S.t - S.eventSince > EVENT_DECIDE_S) finishEvent(S, "no");
  } else if (S.eventState === "done" && S.t - S.eventSince > EVENT_SHOW_S && !(ev.id === "fan-crossing" && (S.helpAt < 0 || S.t - Math.max(S.helpAt, S.eventSince) < FAN_CLEAR_S))) S.eventState = "over";
}

/** The team-mate's car: alongside you in the other lane while you race, then away ahead (or he goes alone). */
function stepMate(S: DriveSession, dt: number) {
  const m = S.mateCar;
  if (!m) return;
  const racing = S.raceT0 >= 0 && S.t - S.raceT0 < RACE_S;
  if (racing) {
    // he holds level, a nose ahead or behind by the end (who wins is seeded: raceWon)
    const won = raceWon(S.opts.seed, S.opts.carId ?? "hatch");
    const want = S.car.s + (won ? -3 : 3) * Math.min(1, (S.t - S.raceT0) / RACE_S);
    m.v = S.car.v + (want - m.s) * 1.5;
  } else if (S.eventState === "open") {
    // up from behind, then level with you while he asks
    m.v = S.car.v + Math.max(-2, Math.min(5, (S.car.s - m.s) * 0.8));
  } else {
    m.v = Math.min(m.v + 3 * dt, S.car.v + 9); // off he goes, and back into the left lane once clear of you
    if (m.s > S.car.s + 12) m.off = Math.min(LANE, m.off + dt * 2.2);
  }
  m.s += m.v * dt;
  if (m.s > S.car.s + 140 || m.s > S.route.length) S.mateCar = null;
}

function finishEvent(S: DriveSession, answer: "yes" | "no", x: { fast?: boolean; won?: boolean } = {}) {
  const ev = S.event!;
  S.eventAnswer = answer;
  S.outcome = eventOutcome(ev, { answer, fast: x.fast, won: x.won, wage: S.opts.wage ?? 2000, mate: S.opts.names.mate, money: (n: number) => `${MONEY_SIGN}${formatMoney(n)}` });
  if (Object.keys(S.outcome.apply).length) S.effects.push(S.outcome.apply);
  S.eventState = "done"; S.eventSince = S.t;
}

/** Your answer on the event's card. The camera's one button slows you; a race's yes starts the burst. */
export function answerEvent(S: DriveSession, a: "yes" | "no") {
  const ev = S.event;
  if (!ev || S.eventState !== "open") return;
  if (ev.id === "speed-camera") { if (a === "yes") S.slowing = true; return; }
  if (ev.id === "mate-race" && a === "yes") { if (S.raceT0 < 0) { S.raceT0 = S.t; S.eventAnswer = "yes"; } return; }
  if (ev.id === "breakdown" && a === "yes") {
    if (S.helping) return;
    // pull over beside it (or as soon after it as you can stop)
    S.helping = true; S.eventAnswer = "yes";
    // just behind it on the road, its hazards and the bonnet in view ahead on the left
    S.stopS = Math.max(S.eventS + BREAKDOWN_AHEAD - 6.5, S.car.s + (S.car.v * S.car.v) / (2 * BRAKE * 0.7) + 0.5);
    return;
  }
  finishEvent(S, a);
}

export function chooseFork(S: DriveSession, c: ForkChoice) { if (S.phase === "fork" && !S.fork) S.fork = c; }
export function skipDrive(S: DriveSession) { S.skipped = true; }

/** Where the barrier is (route point) and how far its arm is up (0 down, 1 up). */
export function barrierLift(S: DriveSession): number {
  // it lifts as you roll up to it (the low camera sees the arm go up in front of the car)
  const d = S.car.s - (S.route.gateS - 11);
  const x = Math.max(0, Math.min(1, d / 6));
  return x * x * (3 - 2 * x);
}

/** The bay shot takes over this far past the barrier (the car is past the low camera, turning in). */
export const BAY_SHOT_FROM = 8.5;

/** The arrival's shots: the barrier (low, wide) until you are through, then the bay with the two team-mates. */
export function arrivalShot(S: DriveSession): "barrier" | "bay" {
  return S.car.s < S.route.gateS + BAY_SHOT_FROM ? "barrier" : "bay";
}

/** How far the two team-mates have turned to look at you (0..1): from a beat after the bay shot opens. */
export function matesTurn(S: DriveSession): number {
  const into = S.car.s - (S.route.gateS + BAY_SHOT_FROM);
  if (into <= 0) return 0;
  const x = Math.max(0, Math.min(1, (into - 5) / 6));
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
