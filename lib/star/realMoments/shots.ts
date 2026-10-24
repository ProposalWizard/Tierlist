/**
 * REAL SHOTS AS OUR SCENARIOS — a real shot (or corner) from data/realmoments
 * turned into one of the engine's own chances, measured against ours, and
 * given its real build-up.
 *
 * Fully real moments (tracking): the real keeper, every real opponent and
 * team-mate inside the camera stand where they stood. Placed moments
 * (Wyscout, the shot only): the game builds its own chance of the closest
 * kind and the whole picture is moved so its ball sits on the real ball
 * (mirrored to the real side); the keeper is re-placed by the chance's own
 * keeper rule (authoredChance placeKeeper). Nothing here is drawn or played:
 * the pages hand the scenario to the real match (EnginePlay).
 *
 * Pure; tests/star/realMoments.mts checks it.
 */
import { buildScenario, goalInView, VIEW_ASPECT, type Scenario, type ScenarioKind, type Vec2, type Viewport } from "../canvasEngine";
import { applyOverrideToScenario, type PosOverride } from "../scenarioEdit";
import { frameFromScenario } from "../scenarioFrame";
import { mulberry32 } from "../season";
import { brainSetup, brainAim, brainOptionsHere } from "../keeperBrain";
import { enforceHardRules } from "../kindRules";
import { placeKeeper, keeperSharesOf, sampleFromScenario } from "../authoredChance";
import { PITCH_W, CX, POST_L, POST_R, NET_DEPTH } from "../pitch";
import { isFullyReal, type RealShot, type RealCorner, type TrackedMoment } from "./types";
import { AIR_HEADER_MIN_Z, AIR_HEADER_MAX_Z, AIR_VOLLEY_MIN_Z, setAirZ, type AirHeighted } from "../airDrawings";

export const P = (p: readonly number[]): Vec2 => ({ x: p[0], y: p[1] });

// ─────────────────────────────────────────────────────────────────────────
//  WHO IS WHERE
// ─────────────────────────────────────────────────────────────────────────

export interface ShotPeople {
  ball: Vec2;
  end: Vec2 | null;
  keeper: Vec2 | null;
  opps: Vec2[];
  mates: Vec2[];
}

export function peopleOf(s: RealShot | RealCorner): ShotPeople {
  let keeper: Vec2 | null = null;
  const opps: Vec2[] = [], mates: Vec2[] = [];
  for (const [x, y, mate, gk] of s.ff ?? []) {
    const at = { x, y };
    if (!mate && gk && !keeper) keeper = at;
    else if (mate) mates.push(at);
    else opps.push(at);
  }
  const end = "end" in s && s.end ? P(s.end) : null;
  return { ball: P(s.ball), end, keeper, opps, mates };
}

/** Opponents inside the triangle ball → near post → far post (the keeper is measured on his own). */
export function blockersOf(ball: Vec2, opps: Vec2[]): number {
  const a = ball, b = { x: POST_L, y: 0 }, c = { x: POST_R, y: 0 };
  const sgn = (p: Vec2, q: Vec2, r: Vec2) => (p.x - r.x) * (q.y - r.y) - (q.x - r.x) * (p.y - r.y);
  return opps.filter((p) => {
    const d1 = sgn(p, a, b), d2 = sgn(p, b, c), d3 = sgn(p, c, a);
    const neg = d1 < 0 || d2 < 0 || d3 < 0, pos = d1 > 0 || d2 > 0 || d3 > 0;
    return !(neg && pos);
  }).length;
}

/**
 * How the ball was in the air when a real shot was struck (headers piece 1,
 * 21 Oct 2026, Harry: "play the ~170 real headers/volleys as true ones"). The
 * engine's own heights (airDrawings.ts AIR_*_Z, the same as canvasEngine's):
 *  - "header": the source says Head, or the ball was 1.3 to 2.6 m up and the
 *    source does not say which body part (SkillCorner says "Foot" for all);
 *  - "volley": the ball was 0.35 to 1.3 m up (and not a header);
 *  - "high": a foot shot at 1.3 m or more, or a ball above 2.6 m (a scissor or
 *    bicycle kick, or the tracking's mistake). Not built yet: never served.
 *  - null: on the grass, or no height known (Wyscout, SoccerTrack).
 */
export type AirKind = "header" | "volley" | "high";
export function airKindOf(s: RealShot): AirKind | null {
  if (s.type === "Penalty" || s.type === "Free Kick") return null;
  if (s.body === "Head") return "header";
  const z = s.z;
  if (typeof z !== "number" || !Number.isFinite(z)) return null;
  // SkillCorner does not say head or foot (it writes "Foot" for every shot).
  const bodyKnown = s.src !== "skillcorner";
  if (z >= AIR_HEADER_MIN_Z) return !bodyKnown && z <= AIR_HEADER_MAX_Z ? "header" : "high";
  if (z >= AIR_VOLLEY_MIN_Z) return "volley";
  return null;
}

/**
 * Our closest chance kind (only the container: camera and rules; the people
 * are the real ones where tracking has them). A real header is a "header" and
 * a real volley a "volley" (airKindOf), wherever they were struck. On the
 * grass: crowded close shots go in "volley", the close-range kind; a placed
 * shot (nobody known near it) that is close is a one-on-one only on a counter
 * or at a 30%+ chance, else the in-the-box kind with its own defenders.
 */
export function kindForShot(s: RealShot): ScenarioKind {
  if (s.type === "Penalty") return "penalty";
  if (s.type === "Free Kick") return "free_kick";
  const air = airKindOf(s);
  if (air === "header" || air === "volley") return air;
  // Struck with the foot above the waist or over 2.6 m (a scissor or bicycle
  // kick): served as a header chance with the BICYCLE button always on
  // (lib/star/bicycle.ts, 22 Oct 2026).
  if (air === "high") return "header";
  const { ball, opps } = peopleOf(s);
  if (ball.y >= 17) return "long_range";
  if (Math.abs(ball.x - CX) >= 9 && ball.y <= 15) return "tight_angle";
  if (!isFullyReal(s)) return s.counter || s.xg >= 0.3 ? "one_on_one" : "volley";
  return blockersOf(ball, opps) === 0 ? "one_on_one" : "volley";
}

/**
 * The kind the ENGINE plays it as. A real header is played as a header (the
 * ball hangs at your head) and a real volley as a volley (it bounces); a
 * fully real ground shot in a crowded box plays as "one_on_one" (its people
 * are still all there; no kind rule moves them).
 */
export function playKindForShot(s: RealShot): ScenarioKind {
  const k = kindForShot(s);
  if (k === "volley" && airKindOf(s) !== "volley" && isFullyReal(s)) return "one_on_one";
  return k;
}

export const KIND_LABEL: Partial<Record<ScenarioKind, string>> = {
  one_on_one: "One-on-one", volley: "In the box", header: "Header", tight_angle: "Tight angle",
  long_range: "Long range", penalty: "Penalty", free_kick: "Free kick", corner: "Corner",
};

/** The pages' word for a real shot: Header / Volley when it was struck in the air, else its kind's. */
export function shotKindLabel(s: RealShot): string {
  const air = airKindOf(s);
  if (air === "header") return "Header";
  if (air === "volley") return "Volley";
  if (air === "high") return "Overhead";
  const k = kindForShot(s);
  return KIND_LABEL[k] ?? k;
}

// ─────────────────────────────────────────────────────────────────────────
//  THE MEASURES — the same four numbers for a real shot and for ours
// ─────────────────────────────────────────────────────────────────────────

export interface ShotMeasure { distance: number; blockers: number; nearest: number | null; keeperOff: number | null }

export function measureOf(ball: Vec2, opps: Vec2[], keeper: Vec2 | null): ShotMeasure {
  const near = opps.map((o) => Math.hypot(o.x - ball.x, o.y - ball.y));
  return {
    distance: Math.hypot(ball.x - CX, ball.y),
    blockers: blockersOf(ball, opps),
    nearest: near.length ? Math.min(...near) : null,
    keeperOff: keeper ? Math.max(0, keeper.y) : null,
  };
}

/** Only a fully real shot has real people to measure. */
export function measureReal(s: RealShot): ShotMeasure {
  const p = peopleOf(s);
  return measureOf(p.ball, p.opps, p.keeper);
}

export function measureScenario(sc: Scenario): ShotMeasure {
  return measureOf(sc.ball, sc.defenders.map((d) => ({ x: d.x, y: d.y })), { x: sc.keeper.x, y: sc.keeper.y });
}

export function ourMeasures(kind: ScenarioKind, n = 200): ShotMeasure[] {
  const out: ShotMeasure[] = [];
  for (let i = 1; i <= n; i++) out.push(measureScenario(buildScenario(kind, mulberry32(i * 7919 + 11))));
  return out;
}

export interface MeasureMeans { n: number; distance: number; blockers: number; nearest: number; keeperOff: number }

export function meansOf(ms: ShotMeasure[]): MeasureMeans {
  const avg = (xs: (number | null)[]) => {
    const v = xs.filter((x): x is number => x !== null);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN;
  };
  return { n: ms.length, distance: avg(ms.map((m) => m.distance)), blockers: avg(ms.map((m) => m.blockers)), nearest: avg(ms.map((m) => m.nearest)), keeperOff: avg(ms.map((m) => m.keeperOff)) };
}

// ─────────────────────────────────────────────────────────────────────────
//  THE CAMERA
// ─────────────────────────────────────────────────────────────────────────

const r2 = (v: number) => Math.round(v * 100) / 100;
const rv = (v: Vec2): Vec2 => ({ x: r2(v.x), y: r2(v.y) });

/** Real people this close to the ball are always in the picture. */
export const FRAME_PEOPLE_M = 20;
const FRAME_PAD_M = 3;

/** A 5:8 frame holding the whole goal, the ball, the keeper and every man within FRAME_PEOPLE_M of the ball. */
export function cameraFor(ball: Vec2, keeper: Vec2 | null, people: Vec2[] = []): Viewport {
  const near = people.filter((q) => Math.hypot(q.x - ball.x, q.y - ball.y) <= FRAME_PEOPLE_M);
  const pts = [ball, ...(keeper ? [keeper] : []), ...near, { x: POST_L, y: 0 }, { x: POST_R, y: 0 }, { x: CX, y: -NET_DEPTH }];
  const pad = FRAME_PAD_M;
  const x1 = Math.min(...pts.map((p) => p.x)) - pad, x2 = Math.max(...pts.map((p) => p.x)) + pad;
  const y1 = Math.min(-NET_DEPTH - 2, Math.min(...pts.map((p) => p.y)) - pad);
  const yBot = Math.max(...pts.map((p) => p.y)) + pad + 3;
  const h = Math.max(28, yBot - y1, (x2 - x1) / VIEW_ASPECT);
  const w = h * VIEW_ASPECT;
  let cx = (x1 + x2) / 2;
  const lo = -3 + w / 2, hi = PITCH_W + 3 - w / 2;
  const a = Math.max(lo, x2 - w / 2), b = Math.min(hi, x1 + w / 2);
  if (a <= b) cx = Math.min(Math.max(cx, a), b);
  return { x1: r2(cx - w / 2), x2: r2(cx + w / 2), y1: r2(y1), y2: r2(y1 + h) };
}

export function onScreen(v: Viewport, q: Vec2, m = 0.8): boolean {
  return q.x > v.x1 + m && q.x < v.x2 - m && q.y > v.y1 + m && q.y < v.y2 - m;
}

/** Every real man within FRAME_PEOPLE_M of the ball, the keeper and the whole goal on screen in `v`? */
export function frameHoldsShot(s: RealShot, v: Viewport): boolean {
  const p = peopleOf(s);
  const need = [...(p.keeper ? [p.keeper] : []), ...[...p.opps, ...p.mates].filter((q) => Math.hypot(q.x - p.ball.x, q.y - p.ball.y) <= FRAME_PEOPLE_M), p.ball];
  const goal = [{ x: POST_L, y: 0 }, { x: POST_R, y: 0 }, { x: POST_L, y: -NET_DEPTH }, { x: POST_R, y: -NET_DEPTH }];
  return need.every((q) => onScreen(v, q)) && goal.every((q) => onScreen(v, q, 0));
}

export function seedForShot(s: { id: string }): number {
  return Math.abs(s.id.split("").reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)) % 1_000_000;
}

/** The close camera: ball, keeper and goal only, at most 42 m tall. */
function closeCameraFor(ball: Vec2, keeper: Vec2 | null): Viewport {
  const pts = [ball, ...(keeper ? [keeper] : []), { x: POST_L, y: 0 }, { x: POST_R, y: 0 }, { x: CX, y: -NET_DEPTH }];
  const pad = 4;
  const x1 = Math.min(...pts.map((p) => p.x)) - pad, x2 = Math.max(...pts.map((p) => p.x)) + pad;
  const yTop = Math.min(...pts.map((p) => p.y)) - pad * 0.875, yBot = Math.max(...pts.map((p) => p.y)) + pad * 0.875 + 6;
  const h = Math.min(42, Math.max(28, yBot - yTop, (x2 - x1) / VIEW_ASPECT));
  const w = h * VIEW_ASPECT;
  const cx = Math.min(PITCH_W + 3 - w / 2, Math.max(-3 + w / 2, (x1 + x2) / 2));
  let y1 = -NET_DEPTH - 2;
  if (ball.y + pad > y1 + h) y1 = ball.y + pad - h;
  return { x1: r2(cx - w / 2), x2: r2(cx + w / 2), y1: r2(y1), y2: r2(y1 + h) };
}

// ─────────────────────────────────────────────────────────────────────────
//  A REAL SHOT AS ONE OF OUR SCENARIOS
// ─────────────────────────────────────────────────────────────────────────

/** YOU stand just behind the ball, on the side away from goal. */
function youAt(ball: Vec2): Vec2 {
  const away = { x: ball.x - CX, y: ball.y };
  const len = Math.hypot(away.x, away.y) || 1;
  return { x: ball.x + (away.x / len) * 0.9, y: ball.y + (away.y / len) * 0.9 };
}

/** Fully real: the game's chance of the kind with every real man in the camera put on top of it. */
function realOverride(s: RealShot, kind: ScenarioKind, seed: number, wide: boolean): PosOverride {
  const p = peopleOf(s);
  const sc = buildScenario(kind, mulberry32(seed));
  const frame = frameFromScenario(sc);
  const camera = goalInView(kind) && kind !== "penalty" ? (wide ? cameraFor(p.ball, p.keeper, [...p.opps, ...p.mates]) : closeCameraFor(p.ball, p.keeper)) : sc.viewport;
  const inside = (q: Vec2) => q.x > camera.x1 + 0.8 && q.x < camera.x2 - 0.8 && q.y > camera.y1 + 0.8 && q.y < camera.y2 - 0.8;
  const ov: PosOverride = { items: {}, removed: [], added: [], ball: rv(p.ball), camera };
  for (const it of frame.items) if (it.removable) ov.removed!.push(it.id);
  const keeperItem = frame.items.find((it) => it.keeper);
  const youItem = frame.items.find((it) => it.side === "you");
  if (keeperItem && p.keeper) ov.items[keeperItem.id] = rv(p.keeper);
  if (youItem) ov.items[youItem.id] = rv(youAt(p.ball));
  let n = 0;
  for (const [q, mate] of [...p.opps.map((o) => [o, false] as const), ...p.mates.map((m) => [m, true] as const)]) {
    if (!inside(q) || Math.hypot(q.x - p.ball.x, q.y - p.ball.y) < 0.6) continue;
    const aid = `add${++n}`;
    ov.added!.push({ id: aid, side: mate ? "teammate" : "opponent" });
    ov.items[aid] = rv(q);
  }
  return ov;
}

/**
 * Placed: the game's own chance of the kind, moved so its ball sits on the
 * real ball (mirrored onto the real side of the goal first). Its keeper keeps
 * the chance's own shares (how far he shades the near post and comes off his
 * line) for the new ball. A penalty is the game's own penalty.
 */
function placedOverride(s: RealShot, kind: ScenarioKind, seed: number): PosOverride {
  const sc = buildScenario(kind, mulberry32(seed));
  const real = P(s.ball);
  if (kind === "penalty") return { items: {} };
  const frame = frameFromScenario(sc);
  const mirror = Math.abs(real.x - CX) > 2 && Math.sign(sc.ball.x - CX) * Math.sign(real.x - CX) < 0;
  const mx = (x: number) => (mirror ? 2 * CX - x : x);
  const dx = real.x - mx(sc.ball.x), dy = real.y - sc.ball.y;
  // Men between the ball and the goal keep their share of that gap (a shot
  // nearer goal squeezes them, never through the goal line); men behind the
  // ball move with it.
  const k = sc.ball.y > 0.5 ? real.y / sc.ball.y : 1;
  const move = (q: Vec2): Vec2 => ({
    x: Math.min(PITCH_W - 0.5, Math.max(0.5, mx(q.x) + dx)),
    y: Math.max(0.6, q.y < sc.ball.y ? q.y * k : q.y + dy),
  });
  const ov: PosOverride = { items: {}, ball: rv(real) };
  const people: Vec2[] = [];
  let keeper: Vec2 | null = null;
  for (const it of frame.items) {
    if (it.side === "you") { ov.items[it.id] = rv(youAt(real)); continue; }
    if (it.keeper) {
      const shares = keeperSharesOf(sampleFromScenario(sc));
      const k = placeKeeper(real, shares, { x: mx(sc.keeper.x), y: sc.keeper.y }, kind);
      keeper = { x: k.x, y: Math.max(0, Math.min(k.y, real.y - 1)) };
      ov.items[it.id] = rv(keeper);
      continue;
    }
    const at = move(it.at);
    ov.items[it.id] = rv(at);
    people.push(at);
  }
  // The real passer of the last pass is a real man too: where he played it
  // from is kept in the picture when he was near (so the build-up's last pass
  // does not come from off the screen into a fixed camera).
  const last = s.lead?.passes[s.lead.passes.length - 1];
  const realNear = last ? [P(last[1]), P(last[2])] : [];
  ov.camera = goalInView(kind) ? cameraFor(real, keeper, [...people, ...realNear]) : sc.viewport;
  return ov;
}

export function overrideForShot(s: RealShot, kind: ScenarioKind, seed: number, wide = false): PosOverride {
  return isFullyReal(s) ? realOverride(s, kind, seed, wide) : placedOverride(s, kind, seed);
}

/** How many of the game's own chances a placed shot looks through for its picture. */
export const PLACED_TRIES = 40;

/**
 * The seed a shot's scenario is built from. A placed shot takes, of
 * PLACED_TRIES of the game's own chances of its kind, the one whose ball is
 * nearest the real ball (mirrored to its side), so the game's people are
 * moved as little as possible (a one-on-one built 16 m out and moved to 2 m
 * would stand its defenders on the goal line). Deterministic.
 */
export function seedForPlaced(s: RealShot, kind: ScenarioKind): number {
  const base = seedForShot(s);
  if (isFullyReal(s) || kind === "penalty") return base;
  const real = P(s.ball);
  let best = base, bd = Infinity;
  for (let k = 0; k < PLACED_TRIES; k++) {
    const seed = (base + k * 7919) % 1_000_000;
    const b = buildScenario(kind, mulberry32(seed)).ball;
    const d = Math.hypot(Math.abs(b.x - CX) - Math.abs(real.x - CX), b.y - real.y);
    if (d < bd) { bd = d; best = seed; }
  }
  return best;
}

/**
 * The real shot as one of our scenarios, built fresh every call.
 * `wideFrame`: the Play camera (every real man within 20 m and the whole goal;
 * played with `scene.ownFrame`). Absent: the close camera (fully real only).
 */
export function scenarioForShot(s: RealShot, opts: { wideFrame?: boolean } = {}): Scenario {
  const kind = playKindForShot(s);
  const seed = seedForPlaced(s, kind);
  const sc = buildScenario(kind, mulberry32(seed));
  applyOverrideToScenario(sc, overrideForShot(s, kind, seed, !!opts.wideFrame));
  // The real keeper starts where he really stood (the keeper brain would walk him to OUR set spot while you aim).
  if (isFullyReal(s) && peopleOf(s).keeper) sc.keeperHoldsStart = true;
  // A real header or volley: the ball reaches you at the height it really was
  // (airDrawings.ts airZOf; held inside the kind's range).
  if ((kind === "header" || kind === "volley") && typeof s.z === "number") setAirZ(sc as Scenario & AirHeighted, s.z);
  // A real overhead kick (airKindOf "high"): the BICYCLE button is always on (bicycle.ts).
  if (airKindOf(s) === "high") (sc as Scenario & { overhead?: boolean }).overhead = true;
  return sc;
}

/**
 * A real corner as our corner chance: YOU take it from the real flag (the
 * ball on the corner arc), and every real man stands where he stood. The
 * camera is the corner's own (the side-on picture), widened along the goal
 * line until every real man in and around the box is on it.
 */
export function scenarioForCorner(c: RealCorner): Scenario {
  const seed = seedForShot(c);
  const sc = buildScenario("corner", mulberry32(seed));
  const p = peopleOf(c);
  const flagRight = p.ball.x > CX;
  const flip = flagRight !== sc.ball.x > CX;
  const ball = { x: flagRight ? PITCH_W - 0.6 : 0.6, y: 0.6 };
  const frame = frameFromScenario(sc);
  const ov: PosOverride = { items: {}, removed: [], added: [], ball: rv(ball) };
  if (flip) ov.facing = flagRight ? "right" : "left";
  // The corner's own camera, on the real flag's side, widened to the far real man near the box.
  const v = sc.viewport;
  let x1 = flip ? PITCH_W - v.x2 : v.x1, x2 = flip ? PITCH_W - v.x1 : v.x2;
  const box = [...p.opps, ...p.mates, ...(p.keeper ? [p.keeper] : [])].filter((q) => q.y < 22);
  if (flagRight) x1 = Math.min(x1, ...box.map((q) => q.x - 4));
  else x2 = Math.max(x2, ...box.map((q) => q.x + 4));
  const h = (x2 - x1) * ((v.y2 - v.y1) / (v.x2 - v.x1));
  const cam = { x1: r2(x1), x2: r2(x2), y1: v.y1, y2: r2(v.y1 + h) };
  ov.camera = cam;
  for (const it of frame.items) if (it.removable) ov.removed!.push(it.id);
  const keeperItem = frame.items.find((it) => it.keeper);
  const youItem = frame.items.find((it) => it.side === "you");
  if (keeperItem && p.keeper) ov.items[keeperItem.id] = rv(p.keeper);
  // YOU stand where the game's own taker stands from the ball (mirrored to the real flag).
  if (youItem) ov.items[youItem.id] = rv({ x: ball.x + (sc.player.x - sc.ball.x) * (flip ? -1 : 1), y: ball.y + (sc.player.y - sc.ball.y) });
  let n = 0;
  for (const [q, mate] of [...p.opps.map((o) => [o, false] as const), ...p.mates.map((m) => [m, true] as const)]) {
    if (!onScreen(cam, q) || Math.hypot(q.x - ball.x, q.y - ball.y) < 1.5) continue;
    const aid = `add${++n}`;
    ov.added!.push({ id: aid, side: mate ? "teammate" : "opponent" });
    ov.items[aid] = rv(q);
  }
  applyOverrideToScenario(sc, ov);
  if (p.keeper) sc.keeperHoldsStart = true;
  return sc;
}

/** Any tracked moment as a scenario. */
export function scenarioForMoment(m: TrackedMoment, opts: { wideFrame?: boolean } = {}): Scenario {
  return m.what === "corner" ? scenarioForCorner(m) : scenarioForShot(m, opts);
}

/**
 * Where the real keeper is after `aimS` seconds of you aiming, when the real
 * shot is played in our engine. Metres off his line. Null: no real keeper.
 */
export function playedKeeperOff(s: RealShot, aimS = 2, hold = true): number | null {
  if (!peopleOf(s).keeper) return null;
  const sc = scenarioForShot(s);
  if (!hold) delete sc.keeperHoldsStart;
  enforceHardRules(sc);
  brainSetup(sc, (seedForShot(s) ^ 0x4b7e) >>> 0, sc.keeperStrength, brainOptionsHere());
  for (let t = 0; t < aimS; t += 1 / 60) brainAim(sc, 1 / 60);
  return Math.max(0, sc.keeper.y);
}
