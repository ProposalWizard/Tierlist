/**
 * THE REAL BUILD-UP FROM PASSES — the last real passes before a shot (Wyscout
 * events, real timing), replayed in the match's own picture (CanvasMatch's
 * `leadIn`, lib/star/leadIn.ts), then the chance is yours. For a shot with
 * tracking, lib/star/realMoments/track.ts replays where everyone really was
 * instead.
 *
 * The BALL follows the real passes at the real timing; the man who plays
 * each pass is on the ball from the pass before until his own; YOU take the
 * last one; everyone else moves on one eased path from his team's shape
 * (sim90 teamShapesAt; Wyscout has nobody's position off the ball) to where
 * the chance has him. Nobody runs faster than LEAD_MAX_RUN.
 */
import type { Scenario, Vec2 } from "../canvasEngine";
import { leadInEntities, ballAlong, LEAD_MAX_RUN, type LeadIn, type LeadEntity, type KeyPt, type LeadBallKey } from "../leadIn";
import { teamShapesAt } from "../sim90";
import { PITCH_W, HALF_LEN } from "../pitch";
import { P, seedForShot } from "./shots";
import type { RealShot, RealLead, XY } from "./types";

export { ballAlong, LEAD_MAX_RUN, type LeadBallKey } from "../leadIn";

const sbToPitch = (p: XY | readonly number[]): Vec2 => P(p);

/** A point the ball reaches, and how long it takes to get there. */
export interface LeadKey { ms: number; ball: Vec2; text: string }

/** One person in the lead-in, from where he starts to where the shot has him. */
export interface LeadDot { id: string; side: "you" | "mate" | "opp" | "keeper"; from: Vec2; to: Vec2 }

export interface LeadPlan {
  keys: LeadKey[];
  dots: LeadDot[];
  /** How far through the lead-in (0..1) each key is. */
  at: number[];
}

const passMs = (a: Vec2, b: Vec2) => Math.round(Math.min(1500, Math.max(450, Math.hypot(a.x - b.x, a.y - b.y) * 55)));
const carryMs = (a: Vec2, b: Vec2) => Math.round(Math.min(1600, Math.max(250, Math.hypot(a.x - b.x, a.y - b.y) * 160)));
const lastName = (n: string) => n.split(" ").slice(-1)[0];

export function leadinPlan(s: RealShot, lead: RealLead): LeadPlan {
  const shotAt = sbToPitch(s.ball);
  const keys: LeadKey[] = [];
  let ball = sbToPitch(lead.passes[0][1]);
  keys.push({ ms: 0, ball, text: `${lastName(lead.passes[0][3])} on the ball` });
  lead.passes.forEach((p, i) => {
    const from = sbToPitch(p[1]), to = sbToPitch(p[2]);
    if (i > 0 && Math.hypot(from.x - ball.x, from.y - ball.y) > 0.5) {
      keys.push({ ms: carryMs(ball, from), ball: from, text: `${lastName(p[3])} carries it` });
    }
    keys.push({ ms: passMs(from, to), ball: to, text: `${lastName(p[3])} → ${lastName(p[4])}` });
    ball = to;
  });
  if (Math.hypot(shotAt.x - ball.x, shotAt.y - ball.y) > 0.5) {
    keys.push({ ms: carryMs(ball, shotAt), ball: shotAt, text: `${lastName(s.player)} sets himself` });
  }
  const total = keys.reduce((a, k) => a + k.ms, 0) || 1;
  let run = 0;
  const at = keys.map((k) => (run += k.ms) / total);

  // Where everyone ends: the shot's freeze frame, and the shooter on the ball.
  const dots: LeadDot[] = [{ id: "you", side: "you", from: shotAt, to: shotAt }];
  (s.ff ?? []).forEach(([x, y, mate, gk], i) => {
    const to = sbToPitch([x, y]);
    dots.push({ id: `p${i}`, side: mate ? "mate" : gk ? "keeper" : "opp", from: to, to });
  });
  const lastTo = sbToPitch(lead.passes[lead.passes.length - 1][2]);
  if (!lead.start) {
    // No start frame: only the shooter moves, from where the last pass found him.
    dots[0].from = lastTo;
    return { keys, dots, at };
  }
  // Where they started: the start frame of the first pass, matched to the end
  // positions by nearest unused man on the same side (frames carry no names).
  const starts = lead.start.map(([x, y, mate, gk]) => ({
    at: sbToPitch([x, y]), side: (mate ? "mate" : gk ? "keeper" : "opp") as LeadDot["side"], used: false,
  }));
  const take = (side: LeadDot["side"], near: Vec2): Vec2 | null => {
    let best = -1, bd = Infinity;
    starts.forEach((st, i) => {
      if (st.used || st.side !== side) return;
      const d = Math.hypot(st.at.x - near.x, st.at.y - near.y);
      if (d < bd) { bd = d; best = i; }
    });
    if (best < 0 || bd > 14) return null;
    starts[best].used = true;
    return starts[best].at;
  };
  // A team's shape travels with the ball. Where the start frame has nobody
  // near enough to be this man, he starts where his shape would have put him
  // (shifted back along the ball's journey: attackers more, defenders less,
  // the keeper not at all). Seen on the page: a move from a goal kick left
  // everyone standing in the box 90 m from the ball.
  const ball0 = keys[0].ball;
  const shift = { x: ball0.x - shotAt.x, y: ball0.y - shotAt.y };
  const share: Record<LeadDot["side"], number> = { you: 0.6, mate: 0.6, opp: 0.4, keeper: 0 };
  const guess = (d: LeadDot): Vec2 => ({
    x: Math.min(PITCH_W, Math.max(0, d.to.x + shift.x * share[d.side])),
    y: Math.min(2 * HALF_LEN, Math.max(0, d.to.y + shift.y * share[d.side])),
  });
  // The shooter is the man the last pass found: start him nearest that spot.
  dots[0].from = take("mate", lastTo) ?? lastTo;
  for (const d of dots.slice(1)) d.from = take(d.side, guess(d)) ?? guess(d);
  return { keys, dots, at };
}

export const lerpVec = (a: Vec2, b: Vec2, f: number): Vec2 => ({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f });

// ─────────────────────────────────────────────────────────────────────────
//  THE LEAD-IN IN THE MATCH'S OWN PICTURE (2D and 3D)
// ─────────────────────────────────────────────────────────────────────────
//
// Harry, 13 Oct 2026: "the 3 shots in real shot and all of it should be in 3d
// aswell and needs to be playable in 2d/3d. u need to actually see the 3 moves
// before u". The real match plays this (CanvasMatch's `leadIn`, lib/star/leadIn.ts)
// as a replay of the recorded positions, then the chance starts where it ends.

/** Seconds a pass of this length takes. */
const passFlightS = (d: number) => Math.min(1.8, Math.max(0.35, d / 16));
/** Seconds a carry of this length takes (0: no carry). */
const carryS = (d: number) => (d < 0.5 ? 0 : Math.min(2.2, Math.max(0.2, d / 6)));
/** A lead-in longer than this is played faster (the same shape, quicker). */
export const LEAD_MAX_S = 12;
/** The pause on the ball before the first pass. */
export const LEAD_HOLD_S = 0.45;

/**
 * The ball's timeline at the real timing: each pass starts the real number of
 * seconds before the shot the data has (pushed later only where the ball
 * could not have got there in time), and the whole is sped up only when it
 * would last longer than LEAD_MAX_S. Ends on `end` (the chance's ball).
 */
export function leadinBallKeys(s: RealShot, lead: RealLead, end: Vec2): LeadBallKey[] {
  const s0 = lead.passes[0][0];
  const keys: LeadBallKey[] = [];
  let t = 0;
  let ball = sbToPitch(lead.passes[0][1]);
  keys.push({ t: 0, p: ball });
  lead.passes.forEach((p, i) => {
    const from = sbToPitch(p[1]), to = sbToPitch(p[2]);
    const real = LEAD_HOLD_S + (s0 - p[0]);
    const carry = carryS(Math.hypot(from.x - ball.x, from.y - ball.y));
    // Carried to where the next pass is played from, arriving just before it.
    if (carry > 0) { t = Math.max(t + carry, real - 0.15); keys.push({ t, p: from }); }
    t = Math.max(t + (i === 0 ? LEAD_HOLD_S : 0.12), real);
    if (keys[keys.length - 1].t < t) keys.push({ t, p: from });
    const d = Math.hypot(to.x - from.x, to.y - from.y);
    t += passFlightS(d);
    keys.push({ t, p: to, pass: { h: d > 22 ? Math.min(5, d * 0.1) : 0 } });
    ball = to;
  });
  const shotReal = LEAD_HOLD_S + s0;
  const last = carryS(Math.hypot(end.x - ball.x, end.y - ball.y));
  t = Math.max(t + Math.max(0.35, last), shotReal);
  keys.push({ t, p: { ...end } });
  if (t > LEAD_MAX_S) { const k = LEAD_MAX_S / t; for (const q of keys) q.t *= k; }
  return keys;
}

const lastNameOf = (n: string) => n.split(" ").slice(-1)[0];

export type LeadTrack = LeadIn & {
  ballKeys: LeadBallKey[];
  /** Each man's path: where he is at each key time (eased between). */
  paths: Map<string, KeyPt[]>;
  /** Who plays each pass (an entity key), and when each pass starts and arrives. */
  holders: (string | null)[];
  passStart: number[];
  passEnd: number[];
};

// ─────────────────────────────────────────────────────────────────────────
//  WHO MOVES, AND HOW (Harry, 14 Oct 2026: "use the tech you used for build
//  up, as in real shots they don't pass, they just run after the ball
//  endlessly")
// ─────────────────────────────────────────────────────────────────────────
//
// The same way the career's build-ups move people (leadInGen.ts):
//   - the BALL follows the real passes, at the real timing (leadinBallKeys);
//   - the man who plays each real pass is ON the ball from the moment the
//     pass before reaches him until he plays his own; YOU take the last one
//     and carry it onto the shot's spot;
//   - EVERYONE ELSE moves on one eased path from where he started (the real
//     start frame, where there is one; without one, his team's shape for where the
//     ball is then, sim90's teamShapesAt) straight to where the shot's freeze
//     frame has him. Nobody else runs at the ball;
//   - nobody runs faster than LEAD_MAX_RUN (9 m/s): a start is pulled in only
//     as far as he needs to get there in time. A man on the ball goes at the
//     ball's own (real) speed.
// The men who play the passes are chosen by name (one man plays every pass a
// name plays): the team-mate who can be on the ball each time without running
// faster than a man can and with his start moved least. Nobody can: a
// team-mate who is in the move but not in the shot's picture (extra0…).

/** Half a smooth start-and-stop, half steady (leadInGen.ts): top speed is 1.25 × the average. */
const leadEase = (f: number) => { const c = Math.min(1, Math.max(0, f)); return 0.5 * c + 0.5 * c * c * (3 - 2 * c); };
/** The average speed along one stretch that keeps his top speed under LEAD_MAX_RUN. */
const LEAD_RUN_AVG = (LEAD_MAX_RUN / 1.25) * 0.97;
/** How far a man's start-frame spot may be moved to make him the passer (m); a team-shape guess may move further. */
const MOVE_360_M = 9, MOVE_GUESS_M = 28;

function alongEased(keys: KeyPt[], t: number): Vec2 {
  if (t <= keys[0].t) return { ...keys[0].p };
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1], b = keys[i];
    if (t <= b.t) {
      const g = b.t > a.t ? leadEase((t - a.t) / (b.t - a.t)) : 1;
      return { x: a.p.x + (b.p.x - a.p.x) * g, y: a.p.y + (b.p.y - a.p.y) * g };
    }
  }
  return { ...keys[keys.length - 1].p };
}
/** A start no further from `to` than a man covers in `s` seconds. */
const reachFrom = (from: Vec2, to: Vec2, s: number): Vec2 => {
  const dd = Math.hypot(from.x - to.x, from.y - to.y), r = LEAD_RUN_AVG * Math.max(0, s);
  if (dd <= r) return { ...from };
  const k = r / dd;
  return { x: to.x + (from.x - to.x) * k, y: to.y + (from.y - to.y) * k };
};
/** Greedy nearest pairs: each end spot gets the nearest unused shape slot. */
function nearestSlots(ends: Vec2[], slots: Vec2[]): (Vec2 | null)[] {
  const pairs: { i: number; j: number; d: number }[] = [];
  ends.forEach((e, i) => slots.forEach((s, j) => pairs.push({ i, j, d: Math.hypot(e.x - s.x, e.y - s.y) })));
  pairs.sort((a, b) => a.d - b.d);
  const out: (Vec2 | null)[] = ends.map(() => null);
  const usedJ = new Set<number>();
  for (const pr of pairs) {
    if (out[pr.i] || usedJ.has(pr.j)) continue;
    out[pr.i] = { ...slots[pr.j] };
    usedJ.add(pr.j);
  }
  return out;
}

/**
 * The real shot's lead-in for the chance `sc` (scenarioForShot, once the match
 * has set it up): the ball at the real timing, each passer on the ball from
 * the pass before until his own, YOU taking the last one, and everyone else
 * walking or jogging from his start (start frame, else team shape) to exactly
 * where the chance has him. See "WHO MOVES, AND HOW" above.
 */
export function leadinTrack(
  s: RealShot, lead: RealLead, sc: Scenario,
  /** The Real Goals page: the ball's own timeline (every pass and carry at the real timing). Absent: leadinBallKeys. */
  opts: { ballKeys?: (end: Vec2) => LeadBallKey[]; isNamed?: (key: string, passer: string) => boolean | undefined } = {},
): LeadTrack {
  const plan = leadinPlan(s, lead);
  const end = { x: sc.ball.x, y: sc.ball.y };
  const ballKeys = opts.ballKeys ? opts.ballKeys(end) : leadinBallKeys(s, lead, end);
  const durS = ballKeys[ballKeys.length - 1].t;
  const ballAt = (t: number) => ballAlong(ballKeys, t);
  const ents = leadInEntities(sc);
  const passStart: number[] = [], passEnd: number[] = [];
  for (let i = 1; i < ballKeys.length; i++) if (ballKeys[i].pass) { passStart.push(ballKeys[i - 1].t); passEnd.push(ballKeys[i].t); }
  const n = lead.passes.length;
  const endOf = new Map<string, Vec2>(ents.map((e) => [e.key, e.get()]));
  // The chance has you just behind the ball: the man on the ball stands there too.
  const youEnd = endOf.get("you")!;
  const off = { x: youEnd.x - end.x, y: youEnd.y - end.y };
  const onBall = (t: number): Vec2 => { const b = ballAt(t); return { x: b.x + off.x, y: b.y + off.y }; };

  // ── Where each man starts: the start frame, else his team's shape ──
  const used = new Set<string>();
  const dotFor = (side: LeadEntity["side"], at: Vec2): LeadDot | null => {
    let best: LeadDot | null = null, bd = 1.2;
    for (const d of plan.dots) {
      if (used.has(d.id) || d.id === "you") continue;
      if ((d.side === "mate") !== (side === "mate") || (d.side === "keeper") !== (side === "keeper")) continue;
      const dd = Math.hypot(d.to.x - at.x, d.to.y - at.y);
      if (dd < bd) { bd = dd; best = d; }
    }
    if (best) used.add(best.id);
    return best;
  };
  const shapes = teamShapesAt({ us: s.team, them: "Opponents", ball: ballKeys[0].p, seed: seedForShot(s) });
  const shapeOf = new Map<string, Vec2>();
  const keeperEnt = ents.find((e) => e.side === "keeper")!;
  const opps = ents.filter((e) => e.side === "opp");
  const mates = ents.filter((e) => e.side === "mate" || e.side === "you");
  shapeOf.set(keeperEnt.key, { ...shapes.them[0] });
  nearestSlots(opps.map((e) => endOf.get(e.key)!), shapes.them.slice(1)).forEach((p, i) => { if (p) shapeOf.set(opps[i].key, p); });
  nearestSlots(mates.map((e) => endOf.get(e.key)!), shapes.us.slice(1)).forEach((p, i) => { if (p) shapeOf.set(mates[i].key, p); });
  const base = new Map<string, Vec2>();
  /** Men whose start is a guess (no start-frame man for them): their start may move further. */
  const guessed = new Set<string>();
  for (const e of ents) {
    const to = e.get();
    const dot = e.key === "you" ? null : dotFor(e.side, to);
    if (dot) base.set(e.key, dot.from);
    else if (e.key === "you" && lead.start) base.set(e.key, plan.dots[0].from);
    else { guessed.add(e.key); base.set(e.key, shapeOf.get(e.key) ?? to); }
  }

  // ── When each name is on the ball ──
  // The passer of pass i has it from the moment pass i-1 arrives (the first
  // passer from the start) until he plays it. YOU: from the last pass to the shot.
  interface Spell { t0: number; t1: number }
  const spellsOf = new Map<string, Spell[]>();
  const nameOf = (i: number) => (lead.passes[i][3] === s.player ? s.player : lead.passes[i][3]);
  lead.passes.forEach((p, i) => {
    const name = nameOf(i);
    const list = spellsOf.get(name) ?? [];
    list.push({ t0: i === 0 ? 0 : passEnd[i - 1], t1: passStart[i] });
    spellsOf.set(name, list);
  });
  const shooterSpells = spellsOf.get(s.player) ?? [];
  shooterSpells.push({ t0: passEnd[n - 1], t1: durS });
  spellsOf.set(s.player, shooterSpells);

  /** A man's path keys through his spells, from `start` to `fin`. Null when he cannot make it without running faster than a man can. */
  const pathThrough = (start: Vec2, fin: Vec2, spells: Spell[], freeStart: boolean, force = false): { keys: KeyPt[]; moved: number } | null => {
    const keys: KeyPt[] = [];
    const first = spells[0];
    const S = freeStart ? reachFrom(start, onBall(first.t0), first.t0) : start;
    const moved = Math.hypot(S.x - start.x, S.y - start.y);
    keys.push({ t: 0, p: S });
    let last: KeyPt = keys[0];
    const fits = (a: KeyPt, b: KeyPt) => force || Math.hypot(a.p.x - b.p.x, a.p.y - b.p.y) <= LEAD_RUN_AVG * (b.t - a.t) + 1e-6;
    for (const sp of spells) {
      const k0 = { t: sp.t0, p: onBall(sp.t0) }, k1 = { t: sp.t1, p: onBall(sp.t1) };
      if (!fits(last, k0)) return null;
      if (k0.t > last.t) keys.push(k0); else keys[keys.length - 1] = k0;
      keys.push(k1);
      last = k1;
    }
    const kEnd = { t: durS, p: { ...fin } };
    if (last.t < durS) { if (!fits(last, kEnd)) return null; keys.push(kEnd); }
    return { keys, moved };
  };

  const paths = new Map<string, KeyPt[]>();
  const spellsByKey = new Map<string, Spell[]>();
  const nameKey = new Map<string, string>([[s.player, "you"]]);
  let extraMates = 0;
  // YOU: the shot's own man (his start moves as far as he needs, he is the shooter).
  {
    const pth = pathThrough(base.get("you")!, youEnd, shooterSpells, true)
      // (A one-two too quick for one man at 9 m/s: the real touches win.)
      ?? pathThrough(base.get("you")!, youEnd, shooterSpells, true, true)!;
    paths.set("you", pth.keys);
    spellsByKey.set("you", shooterSpells);
  }
  // The other names, in the order they first touch it.
  const names = Array.from(new Set(lead.passes.map((_, i) => nameOf(i)))).filter((nm) => nm !== s.player);
  for (const name of names) {
    const spells = spellsOf.get(name)!;
    let best: { key: string; keys: KeyPt[]; cost: number } | null = null;
    for (const e of ents) {
      if (e.side !== "mate" || paths.has(e.key)) continue;
      const pth = pathThrough(base.get(e.key)!, endOf.get(e.key)!, spells, true);
      if (!pth) continue;
      const cap = guessed.has(e.key) ? MOVE_GUESS_M : MOVE_360_M;
      // The Real Goals page: the man wearing the passer's real name plays his pass, if he can get there;
      // a man wearing ANOTHER real name never does (undefined: he has no name).
      const match = opts.isNamed?.(e.key, name);
      if (match === false) continue;
      const named = match === true;
      if (pth.moved > cap && !named) continue;
      const cost = pth.moved + (guessed.has(e.key) ? 2 : 0) - (named ? 1000 : 0);
      if (!best || cost < best.cost) best = { key: e.key, keys: pth.keys, cost };
    }
    if (best) {
      paths.set(best.key, best.keys);
      spellsByKey.set(best.key, spells);
      nameKey.set(name, best.key);
      continue;
    }
    // Nobody: a team-mate who is only in the move. He stands where he gets it,
    // and after his last pass jogs a little after the move.
    const key = `extra${extraMates++}`;
    const lastSpell = spells[spells.length - 1];
    const after = onBall(lastSpell.t1);
    const fwd = { x: end.x - after.x, y: end.y - after.y }, fn = Math.hypot(fwd.x, fwd.y) || 1;
    const jog = Math.min(2, LEAD_RUN_AVG * 0.3 * (durS - lastSpell.t1));
    const fin = { x: after.x + (fwd.x / fn) * jog, y: after.y + (fwd.y / fn) * jog };
    const pth = pathThrough(onBall(spells[0].t0), fin, spells, true)
      // (Two touches too far apart in time for one man: the real touches win.)
      ?? pathThrough(onBall(spells[0].t0), fin, spells, true, true)!;
    paths.set(key, pth.keys);
    spellsByKey.set(key, spells);
    nameKey.set(name, key);
  }
  const holders: (string | null)[] = lead.passes.map((_, i) => nameKey.get(nameOf(i)) ?? null);

  // ── Everyone else: one eased path from his start to his place in the shot ──
  for (const e of ents) {
    if (paths.has(e.key)) continue;
    const to = endOf.get(e.key)!;
    paths.set(e.key, [{ t: 0, p: reachFrom(base.get(e.key)!, to, durS) }, { t: durS, p: { ...to } }]);
  }

  const captionAt = (t: number) => {
    for (let i = n - 1; i >= 0; i--) {
      if (t < passStart[i]) continue;
      const p = lead.passes[i];
      if (t < passEnd[i]) return `${lastNameOf(p[3])} → ${lastNameOf(i === n - 1 ? s.player : p[4])}`;
      return i === n - 1 ? `${lastNameOf(s.player)} — that's you` : `${lastNameOf(p[4])} on the ball`;
    }
    return `${lastNameOf(lead.passes[0][3])} on the ball`;
  };
  return {
    durS, ballKeys, paths, holders, passStart, passEnd, captionAt, extraMates,
    // The TV camera (leadIn.ts LEAD_TV_*): both ends of each pass on screen, wider than the shot's frame.
    camera: "tv",
    ballAt,
    posAt: (key, t) => {
      const path = paths.get(key);
      if (!path) return null;
      if (t >= durS) return { ...path[path.length - 1].p };
      // On the ball: just behind it, wherever the real ball goes.
      for (const sp of spellsByKey.get(key) ?? []) if (t >= sp.t0 && t <= sp.t1) return onBall(t);
      return alongEased(path, t);
    },
  };
}
