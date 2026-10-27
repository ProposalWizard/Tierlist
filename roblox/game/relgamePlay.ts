/**
 * The relationship games that are played, on the device: components/star/relgames/
 * without the drawing.
 *   woodwork  (WoodworkChallenge: team)  five shots, hit the post or the bar
 *   penalties (BossPenalties: manager)   three kicks, the spot he names
 *   session   (BossExtraSession: manager) four shots, each harder
 *   signing   (SigningSession: fans)     ten fans, tap what each holds
 * The shots run on the real match (match.ts drill mode), each shot a fresh one
 * as on the website (each EngineFeature is remounted per shot). The device
 * sends back only the count (hits, goals, fans signed); the server works out
 * the gain (relgameGain).
 *
 * Copied from the website at the commit named in roblox/tools/manifest.json.
 */
import * as M from "./match";
import * as V from "./matchView";
import { buildStrikeFrom } from "./trainingPlay";
import type { CareerState, Fixture } from "../../lib/star/types";
import type { Scenario } from "../../lib/star/canvasEngine";
import { CX, PITCH_W, PEN_SPOT_Y } from "../../lib/star/pitch";
import { FRAME_TOP_FOR_GOAL } from "../../lib/star/goalFrame";
import { mulberry32 } from "../../lib/star/season";
import { powerDrillForLevel } from "../../lib/star/trainingDrills";
import { touchingFrame, gameReward } from "../../lib/star/relationships";
import { BOSS_KICKS, SPOT_LABEL, askLine, bossGain, pickSpots, spotOf, type Spot } from "../../lib/star/bossPenalties";
import { SESSION_REPS, SESSION_FIRST_LEVEL, sessionGain } from "../../lib/star/bossSession";
import { careerPenaltyRunup } from "../../lib/star/runupStyles";

export type RelGame = "woodwork" | "penalties" | "session" | "signing";
export const REL_GAME_TITLE: Record<RelGame, string> = {
  woodwork: "Woodwork challenge", penalties: "The manager's penalties", session: "Extra session", signing: "Signing session",
};
const SHOTS: Record<Exclude<RelGame, "signing">, number> = { woodwork: 5, penalties: BOSS_KICKS, session: SESSION_REPS };

/** WoodworkChallenge's two team-mates and their hits (seeded off the week, so the server works them out the same). */
export function woodworkMates(c: CareerState): { name: string; hits: number }[] {
  const rng = mulberry32(c.season * 991 + c.week * 37);
  const pool = (c.squad ?? []).filter((p) => p.position !== "GK");
  const pick = [pool[Math.floor(rng() * pool.length)], pool[Math.floor(rng() * pool.length)]].filter(Boolean);
  return pick.slice(0, 2).map((p) => {
    const chance = 0.16 + Math.min(99, p.overall ?? 60) / 600;
    let hits = 0;
    for (let s = 0; s < SHOTS.woodwork; s++) if (rng() < chance) hits++;
    return { name: p.name.split(" ").slice(-1)[0], hits };
  });
}

/** The gain, on the server, from the count the device sends (each game's own result). */
export function relgameGain(c: CareerState, game: RelGame, count: number, roll: number): { gain: number; line: string; won: boolean } | null {
  if (!Number.isInteger(count) || count < 0) return null;
  if (game === "woodwork") {
    if (count > SHOTS.woodwork) return null;
    const best = Math.max(1, ...woodworkMates(c).map((m) => m.hits));
    const won = count >= best;
    return { won, gain: gameReward(won, c.relationships.team, roll, "team"), line: `You hit the frame ${count} of ${SHOTS.woodwork}. Best of the lads: ${best}.` };
  }
  if (game === "penalties") {
    if (count > BOSS_KICKS) return null;
    return { won: count > 0, gain: bossGain(count), line: count === BOSS_KICKS ? "Every one. He's impressed." : count > 0 ? `${count} of ${BOSS_KICKS} where he asked.` : "None where he asked. He walks off." };
  }
  if (game === "session") {
    if (count > SESSION_REPS) return null;
    return { won: count > 0, gain: sessionGain(count), line: count === SESSION_REPS ? "Every one in. He nods and writes something down." : count > 0 ? `${count} of ${SESSION_REPS} in.` : "Not one in. He walks off before you finish." };
  }
  if (count > SIGNING_QUEUE) return null;
  const gain = signingGain(count);
  return { won: gain > 0, gain, line: `${count} of ${SIGNING_QUEUE} done right.` };
}

// ── the signing session's rules (SigningSession.tsx) ──
export const SIGNING_ITEMS = [
  { id: "shirt", icon: "👕", label: "Shirt" }, { id: "ball", icon: "⚽", label: "Ball" },
  { id: "photo", icon: "📸", label: "Photo" }, { id: "boot", icon: "👟", label: "Boot" },
] as const;
export const SIGNING_QUEUE = 10;
export const SIGNING_PAR = 5;
export const signingGain = (done: number) => done - SIGNING_PAR;
export const signingPatience = (n: number) => Math.max(800, 1700 - n * 75);
const PRESS_CHANCE = 0.15, PRESS_MS = 1300, NEXT_FAN_MS = 260, BLINK_MS = 250;
export function itemsWanted(n: number, roll: number): number {
  if (n < 2) return 1;
  const three = Math.min(0.3, 0.04 * (n - 1));
  const two = Math.min(0.45, 0.07 * (n - 1));
  return roll < three ? 3 : roll < three + two ? 2 : 1;
}

// ───────────────────────────────────────────────────────────── the state ──

export interface RelPlay {
  game: RelGame;
  career: CareerState;
  clock: number;
  shot: number;
  count: number;
  flash: { text: string; good: boolean; at: number } | null;
  nextAt: number | null;
  done: boolean;
  m: M.MatchState | null;
  hit: boolean;
  cross: { x: number; z: number } | null;
  spots: Spot[];
  lines: string[];
  mates: { name: string; hits: number }[];
  // signing
  started: boolean;
  fan: { n: number; press: boolean; want: string[]; got: number; until: number; total: number } | null;
  order: string[];
  missed: number;
  served: number;
  fanAt: number | null;
}

const FIXTURE = { opponent: "Training", home: true, week: 0, competition: "Training", kind: "league" } as unknown as Fixture;

export function startRelGame(career: CareerState, game: RelGame): RelPlay {
  const rp: RelPlay = {
    game, career, clock: 0, shot: 0, count: 0, flash: null, nextAt: null, done: false, m: null, hit: false, cross: null,
    spots: [], lines: [], mates: game === "woodwork" ? woodworkMates(career) : [],
    started: false, fan: null, order: SIGNING_ITEMS.map((i) => i.id), missed: 0, served: 0, fanAt: null,
  };
  if (game === "penalties") {
    // BossPenalties: seed + Date.now() % 100000 (a different ask each visit)
    const rng = mulberry32(career.season * 7307 + career.week * 131 + Math.floor(Math.random() * 100000));
    rp.spots = pickSpots(rng);
    rp.lines = rp.spots.map((sp, i) => askLine(sp, i, rng));
  }
  if (game !== "signing") openShot(rp);
  return rp;
}

function shotSeed(rp: RelPlay): number {
  const c = rp.career;
  return rp.game === "woodwork" ? c.season * 131 + c.week * 17 + rp.shot
    : rp.game === "penalties" ? c.season * 7307 + c.week * 131
    : c.season * 5113 + c.week * 173;
}

function openShot(rp: RelPlay) {
  const c = rp.career;
  const seed = shotSeed(rp);
  rp.hit = false;
  rp.cross = null;
  const openOn = (): Scenario => {
    if (rp.game === "penalties") {
      const setup = buildStrikeFrom("power", { ...powerDrillForLevel(1, rp.shot, c.skills.power), pass: 0.5 }, mulberry32(seed + rp.shot * 977));
      const sc = setup.scenario;
      sc.ball = { x: CX, y: PEN_SPOT_Y };
      sc.player = { x: CX, y: PEN_SPOT_Y + 1.2 };
      sc.defenders = [];
      const h = 22, w = h * (5 / 8);
      const cx = Math.max(w / 2, Math.min(PITCH_W - w / 2, CX));
      sc.viewport = { x1: cx - w / 2, x2: cx + w / 2, y1: FRAME_TOP_FOR_GOAL, y2: FRAME_TOP_FOR_GOAL + h };
      rp.cross = null;
      return sc;
    }
    const level = rp.game === "session" ? SESSION_FIRST_LEVEL + rp.shot : 1;
    const rng = rp.game === "session" ? mulberry32(seed + rp.shot * 911) : mulberry32(seed);
    const setup = buildStrikeFrom("power", { ...powerDrillForLevel(level, rp.shot, c.skills.power), pass: 0.5 }, rng);
    const ball = setup.scenario.ball;
    const h = Math.max(22, ball.y + 10);
    const w = h * (5 / 8);
    const cx = Math.max(w / 2, Math.min(PITCH_W - w / 2, (ball.x + CX) / 2));
    setup.scenario.viewport = { x1: cx - w / 2, x2: cx + w / 2, y1: FRAME_TOP_FOR_GOAL, y2: FRAME_TOP_FOR_GOAL + h };
    rp.hit = false;
    return setup.scenario;
  };
  // BossExtraSession: the level's own keeper (or none); the others: no keeper
  const sessionDrill = rp.game === "session" ? powerDrillForLevel(SESSION_FIRST_LEVEL + rp.shot, rp.shot, c.skills.power) : null;
  const drill: M.Drill = {
    openOn,
    scene: sessionDrill?.keeper ? { teammates: false, banners: false, ownFrame: true } : { teammates: false, banners: false, ownFrame: true, keeper: false },
    onBallStep: (b) => {
      if (rp.game === "woodwork" && !rp.hit && touchingFrame(b)) rp.hit = true;
      if (rp.game === "penalties" && !rp.cross && b.y <= 0) rp.cross = { x: b.x, z: b.z };
    },
    onChanceResolved: (info) => {
      if (rp.nextAt !== null || rp.done) return;
      let good: boolean, text: string;
      if (rp.game === "woodwork") {
        good = rp.hit;
        text = good ? "OFF THE WOODWORK!" : "MISSED THE FRAME";
      } else if (rp.game === "penalties") {
        const at = rp.cross ?? (info.ball && info.ball.y <= 0.5 ? { x: info.ball.x, z: info.ball.z } : null);
        const target = rp.spots[Math.min(rp.shot, BOSS_KICKS - 1)];
        good = !!at && spotOf(at.x, at.z) === target;
        text = good ? "BANG ON!" : at && spotOf(at.x, at.z) ? "WRONG SPOT" : "MISSED THE GOAL";
      } else {
        const o = info.teammateShot ? "saved" : info.outcome;
        good = o === "goal" || o === "rebound";
        text = good ? "GOAL!" : o === "saved" || o === "tipped" || o === "caught" ? "SAVED" : o === "blocked" || o === "tackled" ? "BLOCKED" : o === "post" ? "OFF THE POST" : o === "over" ? "OVER" : "WIDE";
      }
      if (good) rp.count += 1;
      rp.flash = { text, good, at: rp.clock };
      rp.nextAt = rp.clock + (rp.game === "woodwork" ? 0.9 : 1.1);
    },
  };
  const shotsSeed = rp.game === "woodwork" ? seed : seed + rp.shot;
  rp.m = M.startMatch({
    career: c, fixture: FIXTURE, skills: { power: c.skills.power, technique: c.skills.technique },
    canCurve: false, canExtraTouch: false, keeperStrength: sessionDrill ? sessionDrill.keeperStrength : 0, oppStrength: 70,
    position: c.player.position, teamRelationship: 60, startMinute: 0,
    conditions: undefined as unknown as M.MatchSetup["conditions"], seed: shotsSeed, pressure: 0,
    ...(rp.game === "penalties" ? { penaltyRunup: careerPenaltyRunup(c) } : {}),
    drill,
  });
}

export function tick(rp: RelPlay, dt: number) {
  dt = Math.min(Math.max(0, dt), 0.05);
  rp.clock += dt;
  if (rp.flash && rp.clock - rp.flash.at > 1) rp.flash = null;
  if (rp.game === "signing") { tickSigning(rp); return; }
  if (rp.m) M.tick(rp.m, dt);
  if (rp.nextAt !== null && rp.clock >= rp.nextAt) {
    rp.nextAt = null;
    rp.shot += 1;
    if (rp.shot >= SHOTS[rp.game as Exclude<RelGame, "signing">]) { rp.done = true; rp.m = null; }
    else openShot(rp);
  }
}

// ── the signing session ──
function shuffled<T>(xs: readonly T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function nextFan(rp: RelPlay) {
  const n = rp.served++;
  const press = n >= 2 && Math.random() < PRESS_CHANCE;
  const k = press ? 0 : itemsWanted(n, Math.random());
  const pick = () => SIGNING_ITEMS[Math.floor(Math.random() * SIGNING_ITEMS.length)].id as string;
  const want = Array.from({ length: k }, pick);
  const total = press ? PRESS_MS : Math.round(signingPatience(n) * (1 + 0.6 * (k - 1)));
  rp.order = shuffled(SIGNING_ITEMS.map((i) => i.id as string));
  rp.fan = { n, press, want, got: 0, until: rp.clock * 1000 + total, total };
}
function blink(rp: RelPlay, good: boolean) { rp.flash = { text: good ? "✓" : "✕", good, at: rp.clock - 1 + BLINK_MS / 1000 }; }
function tickSigning(rp: RelPlay) {
  if (!rp.started || rp.done) return;
  const t = rp.clock * 1000;
  const f = rp.fan;
  if (f && t > f.until) {
    if (f.press) { rp.count += 1; blink(rp, true); } else { rp.missed += 1; blink(rp, false); }
    rp.fan = null;
    rp.fanAt = null;
  }
  if (!rp.fan) {
    if (rp.count + rp.missed >= SIGNING_QUEUE) { rp.done = true; return; }
    if (rp.fanAt === null) rp.fanAt = t + NEXT_FAN_MS;
    else if (t >= rp.fanAt) { rp.fanAt = null; nextFan(rp); }
  }
}
export function signingStart(rp: RelPlay) { rp.started = true; }
/** A tap on one of the four buttons. */
export function signingTap(rp: RelPlay, id: string) {
  const fan = rp.fan;
  if (!fan || rp.done) return;
  if (fan.press || id !== fan.want[fan.got]) { rp.missed += 1; blink(rp, false); rp.fan = null; return; }
  if (fan.got + 1 < fan.want.length) { rp.fan = { ...fan, got: fan.got + 1 }; blink(rp, true); return; }
  rp.count += 1; blink(rp, true); rp.fan = null;
}

// ─────────────────────────────────────────────────────────── the view ──

export interface RelView {
  title: string;
  progress: string;
  line: string;
  ask: string;
  flash: { text: string; good: boolean } | null;
  signing: { started: boolean; done: number; missed: number; fanIcon: string; wants: { icon: string; got: boolean }[]; left: number; order: { id: string; icon: string; label: string }[] } | null;
}
export interface RelFrame extends V.Frame { mode: "pitch" | "signing"; trial: null; training: null; rel: RelView }

export function pitchMatch(rp: RelPlay): M.MatchState | null { return rp.m; }

export function relView(rp: RelPlay): RelView {
  const shots = rp.game === "signing" ? SIGNING_QUEUE : SHOTS[rp.game];
  const view: RelView = {
    title: REL_GAME_TITLE[rp.game],
    progress: rp.game === "signing" ? `Done ${rp.count} / ${SIGNING_QUEUE}` : `${rp.game === "penalties" ? "Kick" : "Shot"} ${Math.min(rp.shot + 1, shots)} / ${shots} · ${rp.count} ${rp.game === "woodwork" ? "on the frame" : rp.game === "penalties" ? "on the spot" : "in"}`,
    line: rp.game === "woodwork" ? `Hit the post or the bar. Beat the lads: ${rp.mates.map((m) => `${m.name} ${m.hits}`).join(", ")}.`
      : rp.game === "penalties" ? "Hit the spot he names." : rp.game === "session" ? "The manager is watching. Score as many as you can." : "Tap what each fan holds, in order, before they give up. Never sign for a journalist 🎤.",
    ask: rp.game === "penalties" ? `${rp.lines[Math.min(rp.shot, BOSS_KICKS - 1)] ?? ""} (${SPOT_LABEL[rp.spots[Math.min(rp.shot, BOSS_KICKS - 1)]] ?? ""})` : "",
    flash: rp.flash ? { text: rp.flash.text, good: rp.flash.good } : null,
    signing: null,
  };
  if (rp.game === "signing") {
    const f = rp.fan;
    const icon = (id: string) => SIGNING_ITEMS.find((i) => i.id === id)?.icon ?? "?";
    view.signing = {
      started: rp.started, done: rp.count, missed: rp.missed,
      fanIcon: f ? (f.press ? "🎤" : "🙋") : "",
      wants: f ? f.want.map((w, i) => ({ icon: icon(w), got: i < f.got })) : [],
      left: f ? Math.max(0, (f.until - rp.clock * 1000) / f.total) : 0,
      order: rp.order.map((id) => { const it = SIGNING_ITEMS.find((i) => i.id === id)!; return { id, icon: it.icon, label: it.label }; }),
    };
  }
  return view;
}

const KITS = {
  us: { shirt: "#2563eb", trim: "#f8fafc" }, them: { shirt: "#dc2626", trim: "#111827" },
  keeper: { shirt: "#16a34a", trim: "#052e16" }, ourKeeper: { shirt: "#f59e0b", trim: "#111827" },
};
export function relFrame(rp: RelPlay): RelFrame {
  const rel = relView(rp);
  if (rp.m) {
    const f = V.frameOf(rp.m);
    return { ...f, kits: KITS, score: { ...f.score, usName: rel.title, themName: "" }, mode: "pitch", trial: null, training: null, rel };
  }
  return {
    phase: "relgame", cameraMode: "broadcast", minute: 0,
    score: { us: 0, them: 0, usName: rel.title, themName: "", home: true }, kits: KITS, bodies: [], ball: null,
    camera: { x1: 10, x2: 58, y1: -5, y2: 40, facing: "up", tilt: 0 }, goal: { x1: 30.34, x2: 37.66, crossbar: 2.44 },
    aim: null, passTarget: null, feed: [], log: [], banner: null, pause: null, energy: 100, stamina: null, speed: 1,
    energyMode: "medium", playstyle: "balanced",
    controls: { powerShot: false, powerArmed: false, curve: false, steer: false, callForIt: false, nudge: false, dribble: false, touchMode: false },
    shootout: null, mode: "signing", trial: null, training: null, rel,
  };
}
