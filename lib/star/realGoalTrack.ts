/**
 * REAL GOALS — the build-up, as close to the real move as the data allows
 * (TEST PAGE ONLY, /star-real-goals-dev).
 *
 * Leo, 19 Oct 2026: "the buildup should be almost unnoticeably different,
 * like almost identical to the real goal, much of the time it is not and it
 * even glitches and teleports a bit sometimes".
 *
 * What v0.17 did (statsbombShots.ts leadinTrack): the ball at the real times,
 * but every other man walked ONE straight line from one guess (the 360 frame
 * of one pass, else his team's shape) to where the shot has him; a passer was
 * snapped onto the ball; a one-two too quick for one man was forced through
 * anyway (the man jumped); extra passers vanished when the chance began.
 *
 * What this does:
 *   - THE BALL goes through every real touch at its real time: each pass from
 *     where it was played to where it was received (StatsBomb's Ball Receipt),
 *     each carry from its start to its end. Nothing is sped up.
 *   - EVERY MAN follows StatsBomb's 360 frames: one frame per real event in the
 *     last seconds of the move (both teams' events), so a man is placed where
 *     the camera saw him ~10 times in 12 seconds, not once. 360 frames carry no
 *     names, so men are matched frame to frame backwards from the shot (where
 *     they are named): each to the nearest man on his side he could have run
 *     from (no faster than RUN_MAX). The man on the ball in a frame (the actor)
 *     is the event's own player.
 *   - Between frames: a smooth curve (cubic Hermite, velocity carried through),
 *     so nobody stops and starts at each frame, and nobody jumps.
 *   - The man on the ball blends onto it over BLEND_S, never snaps.
 *   - Every real man in the freeze frame is in the chance (scenarioForShot's
 *     allPeople), so nobody vanishes when the chance begins.
 * Without 360 frames (World Cup 2018, Copa América, club seasons before
 * 2020/21, the classics) the men walk from their team's place for where the
 * ball was (the old guess), smoothly, and the ball still plays every real touch.
 *
 * Pure: no React, no canvas. tests/star/realGoalTrack.mts checks it.
 * Data: StatsBomb open data (https://github.com/statsbomb/open-data)
 */
import type { Scenario, Vec2 } from "./canvasEngine";
import { leadInEntities, ballAlong, type LeadIn, type LeadBallKey } from "./leadIn";
import { sbToPitch } from "./statsbombShots";
import { CX, PITCH_W, HALF_LEN } from "./pitch";

/** One action of the move: [seconds before the shot, P/C/D/R, from, to | null, player, recipient | null, height 0-2]. */
export type TrackEv = [number, "P" | "C" | "D" | "R", [number, number], [number, number] | null, string, string | null, number];
/** One 360 frame: [seconds before the shot, [[x, y, mate, keeper, actor], ...]] (StatsBomb coordinates, the scorer's direction). */
export type TrackFrame = [number, [number, number, number, number, number][]];

export interface TrackInput {
  /** The shooter's full name. */
  shooter: string;
  move: TrackEv[];
  frames?: TrackFrame[];
  /** The freeze frame at the shot: StatsBomb [x, y, mate, keeper] and each man's full name, same order. */
  ff: [number, number, number, number][];
  names: string[];
  /** A full name → the short name a caption shows. */
  short?: (full: string) => string;
}

/** The longest build-up played (seconds of the real move, at real speed). */
export const BUILD_MAX_S = 12;
/** A pause on the first touch before the move starts. */
export const HOLD_S = 0.4;
/** The fastest a man can have run between two frames (m/s) when matching them, plus room for the frames' own error (m). */
export const RUN_MAX = 9.5;
export const MATCH_SLACK_M = 3;
/** How long the man on the ball takes to blend onto it / away from it (s). */
export const BLEND_S = 0.35;
/** The last seconds before the shot: the shot's own freeze frame places everyone, not the 360 frames. */
export const END_TRUST_S = 0.6;
/** How far behind the ball (away from goal) the man on it stands (the chance's own spot for you). */
export const ON_BALL_M = 0.9;

interface Key { t: number; p: Vec2; /** On the ball: never smoothed off it. */ fix?: boolean }

const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);
const clampPitch = (p: Vec2): Vec2 => ({ x: Math.min(PITCH_W + 2, Math.max(-2, p.x)), y: Math.min(2 * HALF_LEN, Math.max(-1, p.y)) });
const smooth = (f: number) => { const c = Math.min(1, Math.max(0, f)); return c * c * (3 - 2 * c); };

/** The window of the move played: from the first touch at most BUILD_MAX_S before the shot. */
export function trackWindow(move: TrackEv[]): TrackEv[] {
  const mv = move.filter((e) => e[2]);
  const i = mv.findIndex((e) => e[0] <= BUILD_MAX_S);
  if (i < 0) return [];
  // Start on a touch that begins something (a pass, a carry, a ball received), not mid-dribble.
  let j = i;
  while (j < mv.length - 1 && mv[j][1] === "D") j++;
  return mv.slice(j);
}

/** One touch of the move, with when the ball leaves the man (a pass, the end of his carry). */
export interface Touch {
  t: number; p: Vec2; kind: TrackEv[1]; player: string; h: number;
  /** When the ball leaves his feet. */
  leave: number;
  /** A carry's end, reached at `leave`. */
  carryTo?: Vec2;
  /** The ball goes to the next touch as a pass (a real pass, or one the data skipped: the next touch is somebody else's). */
  passOn: boolean;
}

/** A man runs with the ball at about this speed (m/s), so a carry before a pass the data skipped takes this long. */
const CARRY_MS = 6;

/** The touches of the window, with when each man lets it go. t = 0 is HOLD_S before the first; the shot is at T. */
export function touchPlan(win: TrackEv[], shooter: string): { touches: Touch[]; T: number } {
  const T = win.length ? win[0][0] + HOLD_S : HOLD_S;
  const at = (back: number) => T - back;
  const touches: Touch[] = win.map((e) => ({ t: at(e[0]), p: sbToPitch(e[2]), kind: e[1], player: e[4], h: e[6], leave: at(e[0]), passOn: false }));
  for (let i = 0; i < touches.length; i++) {
    const c = touches[i], e = win[i];
    const nextT = i + 1 < touches.length ? touches[i + 1].t : T;
    const nextBy = i + 1 < touches.length ? touches[i + 1].player : shooter;
    const same = nextBy === c.player;
    const gap = Math.max(0, nextT - c.t);
    if (c.kind === "P") { c.leave = c.t; c.passOn = true; continue; }
    if (c.kind === "C" && e[3]) {
      const to = sbToPitch(e[3]);
      c.carryTo = to;
      c.leave = same ? nextT : c.t + Math.min(gap * 0.8, dist(c.p, to) / CARRY_MS + 0.1);
      c.passOn = !same;
      continue;
    }
    // A ball received or a dribble: he keeps it to his next touch, or lays it off (a pass the data skipped).
    c.leave = same ? nextT : c.t + Math.min(0.3, gap * 0.5);
    c.passOn = !same;
  }
  return { touches, T };
}

/**
 * The ball through every real touch at its real time. t = 0 is HOLD_S before
 * the first touch; the shot is at durS. Ends on `end` (the chance's ball).
 */
export function trackBallKeys(win: TrackEv[], end: Vec2, shooter = ""): LeadBallKey[] {
  return ballPlan(win, end, shooter).keys;
}

/** The ball's keys, and the map from the data's times to the played times (see retime). */
export function ballPlan(win: TrackEv[], end: Vec2, shooter = ""): { keys: LeadBallKey[]; warp: (t: number) => number; held: { player: string; from: number; to: number }[] } {
  if (!win.length) return { keys: [{ t: 0, p: { ...end } }, { t: 0.4, p: { ...end } }], warp: (t) => t, held: [] };
  const { touches, T } = touchPlan(win, shooter);
  const keys: LeadBallKey[] = [{ t: 0, p: { ...touches[0].p } }];
  /** Adds a key; returns the index of the key that stands for this point. */
  const add = (t: number, p: Vec2, pass?: { h: number }): number => {
    const last = keys[keys.length - 1];
    const d = dist(last.p, p);
    if (d < 0.05) { if (t > last.t + 0.02 && !pass) keys.push({ t, p: { ...p } }); return keys.length - 1; }
    // Never faster than a ball flies (a pass) or rolls on (a touch).
    const tt = Math.max(t, last.t + d / (pass ? 40 : 30));
    keys.push(pass ? { t: tt, p: { ...p }, pass } : { t: tt, p: { ...p } });
    return keys.length - 1;
  };
  // Which keys each man has the ball between (by index: the times move in retime).
  const heldIdx: { player: string; from: number; to: number }[] = [];
  for (let i = 0; i < touches.length; i++) {
    const c = touches[i];
    const next = i + 1 < touches.length ? touches[i + 1] : { t: T, p: end };
    const from = i === 0 ? 0 : add(c.t, c.p);
    if (i === 0) add(c.t, c.p);
    if (c.carryTo && !c.passOn) {
      // He keeps it to his next touch: the carry's end, then on to that touch, at one steady pace.
      const d1 = dist(c.p, c.carryTo), d2 = dist(c.carryTo, next.p);
      add(c.t + (next.t - c.t) * (d1 / (d1 + d2 || 1)), c.carryTo);
    } else if (c.carryTo) add(c.leave, c.carryTo);
    else if (c.leave > c.t + 0.02) add(c.leave, c.p);
    const leaveIdx = keys.length - 1;
    const h = c.kind === "P" ? (c.h === 2 ? Math.min(6, dist(c.p, next.p) * 0.12) : c.h === 1 ? Math.min(1.6, dist(c.p, next.p) * 0.06) : 0) : 0;
    const arrive = add(next.t, next.p, c.passOn ? { h } : undefined);
    heldIdx.push({ player: c.player, from, to: c.passOn ? leaveIdx : arrive });
  }
  const warp = retime(keys);
  return { keys, warp, held: heldIdx.map((h) => ({ player: h.player, from: keys[h.from].t, to: keys[h.to].t })) };
}

/**
 * The data's own timing is a little loose (a carry stamped 0.3 s before the
 * dribble 7 m away). Any stretch faster than a man runs with the ball
 * (CARRY_MAX_MS) or a ball flies (PASS_MAX_MS) gets the time it needs, taken
 * from the stretches around it, moving each touch as little as it can. The
 * first touch and the shot keep their real times. Returns the old → new time map.
 */
export const PASS_MAX_MS = 33;
export function retime(keys: LeadBallKey[]): (t: number) => number {
  const n = keys.length;
  const old = keys.map((k) => k.t);
  if (n < 3) return (t) => t;
  const need = (i: number) => dist(keys[i - 1].p, keys[i].p) / (keys[i].pass ? PASS_MAX_MS : CARRY_MAX_MS);
  const T = keys[n - 1].t;
  const t = keys.map((k) => k.t);
  for (let it = 0; it < 4; it++) {
    for (let i = 1; i < n; i++) t[i] = Math.max(t[i], t[i - 1] + need(i));
    t[n - 1] = Math.min(t[n - 1], T);
    for (let i = n - 2; i >= 1; i--) t[i] = Math.min(t[i], t[i + 1] - need(i + 1));
    t[0] = 0;
  }
  // Keep the order even where it cannot all fit (a 12 s move can always fit; this is only a guard).
  for (let i = 1; i < n; i++) t[i] = Math.max(t[i], t[i - 1] + 0.02);
  keys.forEach((k, i) => { k.t = t[i]; });
  return (x: number) => {
    if (x <= old[0]) return x;
    for (let i = 1; i < n; i++) {
      if (x <= old[i]) { const f = old[i] > old[i - 1] ? (x - old[i - 1]) / (old[i] - old[i - 1]) : 1; return t[i - 1] + (t[i] - t[i - 1]) * f; }
    }
    return x - old[n - 1] + t[n - 1];
  };
}

/** The fastest a man runs with the ball (m/s). */
export const CARRY_MAX_MS = 8.5;

/**
 * A man along his keys: straight runs between them at the speed each stretch
 * needs, with the corners rounded (a short curve across each key), so nobody
 * stops and starts at each frame and nobody runs faster than the stretch
 * itself asks (a smooth spline overshoots: up to 1.5× where a jog meets a
 * sprint). Held before the first key and after the last.
 */
export function curveAt(keys: Key[], t: number): Vec2 {
  const n = keys.length;
  if (n === 1 || t <= keys[0].t) return { ...keys[0].p };
  if (t >= keys[n - 1].t) return { ...keys[n - 1].p };
  const lin = (i: number, tt: number): Vec2 => {
    const a = keys[i], b = keys[i + 1];
    const f = b.t > a.t ? (tt - a.t) / (b.t - a.t) : 1;
    return { x: a.p.x + (b.p.x - a.p.x) * f, y: a.p.y + (b.p.y - a.p.y) * f };
  };
  const round = (j: number) => (j <= 0 || j >= n - 1 ? 0 : Math.min(CORNER_S, 0.45 * (keys[j].t - keys[j - 1].t), 0.45 * (keys[j + 1].t - keys[j].t)));
  let i = 0;
  while (i < n - 2 && keys[i + 1].t <= t) i++;
  // Inside the rounded corner at key i+1 (end of this stretch) or at key i (its start)?
  for (const j of [i, i + 1]) {
    const r = round(j);
    if (r > 0 && Math.abs(t - keys[j].t) < r) {
      const p0 = lin(j - 1, keys[j].t - r), p2 = lin(j, keys[j].t + r), c = keys[j].p;
      const u = (t - (keys[j].t - r)) / (2 * r);
      const a = (1 - u) * (1 - u), b = 2 * u * (1 - u), d = u * u;
      return { x: a * p0.x + b * c.x + d * p2.x, y: a * p0.y + b * c.y + d * p2.y };
    }
  }
  return lin(i, t);
}

/** How long each rounded corner lasts, either side of its key (s). */
export const CORNER_S = 0.3;

/** The fastest average run between two kept frame keys (m/s): a sprint, held. */
export const KEEP_AVG = 7.5;
/** Neighbouring frames this close (s) smooth each other. */
export const SMOOTH_SPAN_S = 2.5;
/** Light smoothing of a man's frame keys (the 360 frames place a man to within a metre or so, not exactly). Ends kept. */
function smoothKeys(keys: Key[]): Key[] {
  if (keys.length < 3) return keys;
  return keys.map((k, i) => {
    if (i === 0 || i === keys.length - 1 || k.fix) return k;
    const a = keys[i - 1], b = keys[i + 1];
    // Only with neighbours close in time: a frame 8 s away says nothing about the noise in this one.
    if (b.t - a.t > SMOOTH_SPAN_S) return k;
    const f = (k.t - a.t) / (b.t - a.t || 1);
    const lin = { x: a.p.x + (b.p.x - a.p.x) * f, y: a.p.y + (b.p.y - a.p.y) * f };
    return { t: k.t, p: { x: 0.5 * k.p.x + 0.5 * lin.x, y: 0.5 * k.p.y + 0.5 * lin.y } };
  });
}

export type RealTrack = LeadIn & {
  ballKeys: LeadBallKey[];
  /** Each man's frame keys (before smoothing into a curve) — for the tests and the page's numbers. */
  keys: Map<string, Key[]>;
  /** Where each frame's real men were, by time (pitch metres), and who of ours each was matched to. */
  seen: { t: number; people: { p: Vec2; side: "mate" | "opp" | "keeper"; key: string | null }[] }[];
  /** Has the move got 360 frames (the men follow the real camera)? */
  tracked: boolean;
  names: Map<string, string>;
};

/**
 * The build-up for the chance `sc` (scenarioForGoal, set up by the match).
 * See the top of this file.
 */
export function realTrack(inp: TrackInput, sc: Scenario): RealTrack | null {
  const win = trackWindow(inp.move);
  if (!win.length) return null;
  const end = { x: sc.ball.x, y: sc.ball.y };
  const { keys: ballKeys, warp, held } = ballPlan(win, end, inp.shooter);
  const durS = ballKeys[ballKeys.length - 1].t;
  const T = win[0][0] + HOLD_S;
  const tOf = (back: number) => warp(T - back);
  const ballAt = (t: number) => ballAlong(ballKeys, t);
  const goalC = { x: CX, y: 0 };
  /** Where the man on the ball stands: just behind it, away from goal (the chance's own spot for you at the end). */
  const onBall = (t: number): Vec2 => {
    const b = ballAt(t);
    const ax = b.x - goalC.x, ay = b.y - goalC.y, len = Math.hypot(ax, ay) || 1;
    return { x: b.x + (ax / len) * ON_BALL_M, y: b.y + (ay / len) * ON_BALL_M };
  };

  // ── Who is who: each of the chance's men named by the freeze frame (as the page's dressFor does) ──
  const ents = leadInEntities(sc);
  const endOf = new Map(ents.map((e) => [e.key, e.get()]));
  const ff = inp.ff.map(([x, y, mate, gk], i) => ({ at: sbToPitch([x, y]), side: (mate ? "mate" : gk ? "keeper" : "opp") as "mate" | "opp" | "keeper", name: inp.names[i] ?? "" }));
  const names = new Map<string, string>([["you", inp.shooter]]);
  const usedFf = new Set<number>();
  for (const e of ents) {
    if (e.key === "you") continue;
    const side = e.side === "you" ? "mate" : e.side;
    let best = -1, bd = e.side === "keeper" ? 6 : 2.5;
    ff.forEach((q, i) => {
      if (usedFf.has(i) || q.side !== side) return;
      const d = dist(q.at, endOf.get(e.key)!);
      if (d < bd) { bd = d; best = i; }
    });
    if (best >= 0 && ff[best].name) { usedFf.add(best); names.set(e.key, ff[best].name); }
  }
  const keyOfName = new Map(Array.from(names.entries()).map(([k, n]) => [n, k]));
  const sideOf = (k: string): "mate" | "opp" | "keeper" => { const e = ents.find((q) => q.key === k)!; return e.side === "you" ? "mate" : e.side; };

  // ── Who has the ball, when (from the real touches) ──
  interface Spell { t0: number; t1: number }
  const spells = new Map<string, Spell[]>();
  const addSpell = (name: string, t0: number, t1: number) => {
    const l = spells.get(name) ?? [];
    const last = l[l.length - 1];
    if (last && t0 <= last.t1 + 0.6) last.t1 = Math.max(last.t1, t1); else l.push({ t0, t1: Math.max(t0, t1) });
    spells.set(name, l);
  };
  // Each man has it between the ball's own keys (so he can never be dragged after a pass he has played).
  for (const h of held) addSpell(h.player, h.from, h.to);
  // You have it from when the last touch by somebody else is over (his pass arrives, his carry ends; a rebound only at the very end).
  {
    let from = 0;
    for (let i = held.length - 1; i >= 0; i--) {
      if (held[i].player === inp.shooter) continue;
      from = i + 1 < held.length ? held[i + 1].from : durS;
      break;
    }
    addSpell(inp.shooter, Math.min(from, durS), durS);
  }

  // A named man who could not have got from his touches to where the shot has
  // him (a corner taker the freeze frame "names" in the box 1.5 s later) is not
  // that man: his touches are played by a man of their own (an extra).
  for (const [name, sp] of Array.from(spells)) {
    const k = keyOfName.get(name);
    if (!k || name === inp.shooter) continue;
    const endP = endOf.get(k)!;
    let ok = true, last: { t: number; p: Vec2 } | null = null;
    for (const s of sp) {
      if (last && dist(last.p, onBall(s.t0)) > RUN_MAX * (s.t0 - last.t) + 2) ok = false;
      last = { t: s.t1, p: onBall(s.t1) };
    }
    if (last && dist(last.p, endP) > RUN_MAX * (durS - last.t) + 2) ok = false;
    if (!ok) keyOfName.delete(name);
  }

  // ── The 360 frames, matched backwards from the shot ──
  const frames = (inp.frames ?? [])
    .filter((f) => f[0] <= win[0][0] + 0.5 && f[0] > END_TRUST_S)
    .map((f) => ({ t: Math.max(0, tOf(f[0])), back: f[0], people: f[1] }))
    .sort((a, b) => b.t - a.t);
  const tracked = frames.length >= 2;
  const keys = new Map<string, Key[]>();
  for (const e of ents) keys.set(e.key, [{ t: durS, p: { ...endOf.get(e.key)! } }]);
  const seen: RealTrack["seen"] = [];
  // The event (ours) at each frame's moment: its player is that frame's actor.
  const actorAt = (back: number) => win.find((e) => Math.abs(e[0] - back) < 0.08)?.[4] ?? null;
  for (const fr of frames) {
    const people = fr.people.map(([x, y, mate, gk, actor]) => ({
      p: sbToPitch([x, y]), side: (mate ? "mate" : gk ? "keeper" : "opp") as "mate" | "opp" | "keeper", actor: !!actor, key: null as string | null,
    }));
    // The scorer's own keeper is not one of our men (we only have theirs).
    const usable = people.filter((q) => !(q.side === "keeper" && q.p.y > HALF_LEN));
    const taken = new Set<string>();
    const anchor = (k: string) => { const l = keys.get(k)!; return l[0]; };
    // The actor is the event's player (when he is one of ours on the pitch).
    const an = actorAt(fr.back);
    const ak = an ? keyOfName.get(an) : undefined;
    if (ak) {
      const q = usable.find((u) => u.actor && u.side === "mate");
      if (q) { q.key = ak; taken.add(ak); }
    }
    // Everyone else: nearest first, no faster than a man can run since his next known spot.
    const pairs: { q: typeof usable[number]; k: string; d: number }[] = [];
    for (const q of usable) {
      if (q.key) continue;
      for (const e of ents) {
        if (taken.has(e.key) || sideOf(e.key) !== q.side) continue;
        const a = anchor(e.key);
        const d = dist(a.p, q.p);
        if (d <= RUN_MAX * (a.t - fr.t) + MATCH_SLACK_M) pairs.push({ q, k: e.key, d });
      }
    }
    pairs.sort((a, b) => a.d - b.d);
    for (const pr of pairs) {
      if (pr.q.key || taken.has(pr.k)) continue;
      pr.q.key = pr.k; taken.add(pr.k);
    }
    for (const q of usable) if (q.key) keys.get(q.key)!.unshift({ t: fr.t, p: clampPitch(q.p) });
    seen.push({ t: fr.t, people: people.map((q) => ({ p: q.p, side: q.side, key: q.key })) });
  }
  seen.reverse();

  // ── Men the frames never placed (no 360, or never seen): from where his team's shape had him ──
  const ball0 = ballKeys[0].p;
  const shift = { x: ball0.x - end.x, y: ball0.y - end.y };
  const share: Record<string, number> = { mate: 0.6, opp: 0.4, keeper: 0 };
  for (const e of ents) {
    const l = keys.get(e.key)!;
    if (l.length > 1) continue;
    const to = l[0].p;
    const g = clampPitch({ x: to.x + shift.x * share[sideOf(e.key)], y: to.y + shift.y * share[sideOf(e.key)] });
    // No further than a man jogs in the time there is.
    const d = dist(g, to), r = 6.5 * durS;
    const from = d > r ? { x: to.x + ((g.x - to.x) * r) / d, y: to.y + ((g.y - to.y) * r) / d } : g;
    l.unshift({ t: 0, p: from });
  }
  // The man on the ball is AT the ball for his touches: his curve goes through
  // them (so the blend onto the ball is short), and any frame key he could not
  // have run from or to in time is dropped (a frame matched to the wrong man).
  const nameKeyEarly = (n: string) => (n === inp.shooter ? "you" : keyOfName.get(n));
  for (const [n, sp] of Array.from(spells)) {
    const k = nameKeyEarly(n);
    if (!k) continue;
    const fixed: Key[] = [];
    for (const s of sp) { fixed.push({ t: s.t0, p: onBall(s.t0), fix: true }); if (s.t1 > s.t0 + 0.05) fixed.push({ t: s.t1, p: onBall(s.t1), fix: true }); }
    const l = keys.get(k)!;
    const endK = l[l.length - 1];
    const inSpell = (t: number) => sp.some((s) => t >= s.t0 - 0.2 && t <= s.t1 + 0.2);
    const ok = (q: Key) => fixed.every((f) => dist(f.p, q.p) <= RUN_MAX * Math.abs(f.t - q.t) + 1.5);
    const merged = [...l.slice(0, -1).filter((q) => !inSpell(q.t) && ok(q)), ...fixed.filter((f) => f.t < endK.t - 0.05), endK]
      .sort((a, b) => a.t - b.t);
    keys.set(k, merged);
  }
  // No faster than a man can run between two kept keys, working back from the
  // shot (whose spot is the truth). A frame key that would need more is a frame
  // matched to the wrong man: dropped.
  const reach = (a: Key, b: Key) => dist(a.p, b.p) <= KEEP_AVG * Math.abs(b.t - a.t) + 0.8;
  for (const [k, l] of Array.from(keys)) {
    // Back from the shot, then forward from the first touch: a frame key must
    // be reachable from both kept neighbours (touches and the end always stay).
    let cur = l;
    for (let pass = 0; pass < 3; pass++) {
      const back: Key[] = [cur[cur.length - 1]];
      for (let i = cur.length - 2; i >= 0; i--) if (cur[i].fix || reach(cur[i], back[0])) back.unshift(cur[i]);
      const fwd: Key[] = [back[0]];
      for (let i = 1; i < back.length; i++) if (back[i].fix || i === back.length - 1 || reach(fwd[fwd.length - 1], back[i])) fwd.push(back[i]);
      if (fwd.length === cur.length) { cur = fwd; break; }
      cur = fwd;
    }
    keys.set(k, cur);
  }
  // A man the camera first catches late was not standing on that spot all
  // along: before it he comes with the play (his team's share of how far the
  // ball has moved), no faster than a jog.
  for (const [k, l] of Array.from(keys)) {
    if (l[0].t <= 0.5 || k.startsWith("extra")) continue;
    const b0 = ballKeys[0].p, b1 = ballAt(l[0].t);
    const sh = share[sideOf(k)] ?? 0.5;
    const g = clampPitch({ x: l[0].p.x + (b0.x - b1.x) * sh, y: l[0].p.y + (b0.y - b1.y) * sh });
    const d = dist(g, l[0].p), r = 6 * l[0].t;
    l.unshift({ t: 0, p: d > r ? { x: l[0].p.x + ((g.x - l[0].p.x) * r) / d, y: l[0].p.y + ((g.y - l[0].p.y) * r) / d } : g });
  }
  const curves = new Map<string, Key[]>();
  for (const [k, l] of Array.from(keys)) curves.set(k, smoothKeys(l));

  // ── Passers who are not in the chance at all: on the pitch for the build-up only ──
  let extraMates = 0;
  const extraKey = new Map<string, string>();
  for (const name of Array.from(spells.keys())) {
    if (keyOfName.has(name) || name === inp.shooter) continue;
    const k = `extra${extraMates++}`;
    extraKey.set(name, k);
    const sp = spells.get(name)!;
    const l: Key[] = [];
    for (const s of sp) { l.push({ t: s.t0, p: onBall(s.t0) }); l.push({ t: s.t1, p: onBall(s.t1) }); }
    // After his last touch he jogs on behind the move.
    const lastS = sp[sp.length - 1], after = onBall(lastS.t1);
    const fwd = { x: end.x - after.x, y: end.y - after.y }, fn = Math.hypot(fwd.x, fwd.y) || 1;
    const jog = Math.min(8, 4 * (durS - lastS.t1));
    l.push({ t: durS, p: { x: after.x + (fwd.x / fn) * jog, y: after.y + (fwd.y / fn) * jog } });
    curves.set(k, l.filter((q, i) => i === 0 || q.t > l[i - 1].t + 0.02));
    keys.set(k, l);
  }
  const keyForName = (n: string) => (n === inp.shooter ? "you" : keyOfName.get(n) ?? extraKey.get(n));
  const spellsByKey = new Map<string, Spell[]>();
  for (const [n, sp] of Array.from(spells)) { const k = keyForName(n); if (k) spellsByKey.set(k, sp); }

  /**
   * How much the man is on the ball at t (0..1), and where "on the ball" is: a
   * smooth blend in and out of each spell. Outside the spell the spot is held
   * where it starts or ends (a man who has just played a pass is not dragged
   * along after it).
   */
  const onBallFor = (k: string, t: number): { w: number; p: Vec2 } => {
    let best = { w: 0, p: { x: 0, y: 0 } };
    for (const s of spellsByKey.get(k) ?? []) {
      const a = s.t0 === 0 ? 1 : smooth((t - (s.t0 - BLEND_S)) / BLEND_S);
      const b = s.t1 >= durS - 1e-6 ? 1 : smooth(((s.t1 + BLEND_S) - t) / BLEND_S);
      const w = Math.min(a, b);
      if (w > best.w) best = { w, p: onBall(Math.min(s.t1, Math.max(s.t0, t))) };
    }
    return best;
  };

  const passStart: number[] = [], passEnd: number[] = [];
  for (let i = 1; i < ballKeys.length; i++) if (ballKeys[i].pass) { passStart.push(ballKeys[i - 1].t); passEnd.push(ballKeys[i].t); }
  const short = inp.short ?? ((n: string) => n.split(" ").slice(-1)[0]);
  const captionAt = (t: number) => {
    let txt = "";
    for (let i = 0; i < win.length; i++) {
      const e = win[i];
      if (tOf(e[0]) > t + 0.01) break;
      const nextT = i + 1 < win.length ? tOf(win[i + 1][0]) : durS;
      if (e[1] === "P") txt = t < nextT ? `${short(e[4])} → ${short(e[5] ?? "")}` : `${short(e[5] ?? "")} on the ball`;
      else if (e[1] === "D") txt = `${short(e[4])} takes him on`;
      else if (e[1] === "C") txt = `${short(e[4])} drives on`;
    }
    return t >= durS - 0.6 ? `${short(inp.shooter)} — your shot` : txt || `${short(win[0][4])} on the ball`;
  };

  return {
    durS, ballKeys, keys, seen, tracked, names, passStart, passEnd, captionAt, extraMates, camera: "tv",
    ballAt,
    posAt: (key, t) => {
      const c = curves.get(key);
      if (!c) return null;
      if (t >= durS) return { ...endOf.get(key) ?? c[c.length - 1].p };
      const base = curveAt(c, t);
      const { w, p: o } = onBallFor(key, t);
      if (w <= 0) return base;
      return { x: base.x + (o.x - base.x) * w, y: base.y + (o.y - base.y) * w };
    },
  };
}
