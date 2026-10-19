/**
 * Real Goals build-up: before (v0.17, statsbombShots.ts leadinTrack) and after
 * (realGoalTrack.ts), measured on every goal with a move.
 *
 *   JUMPS    a man (or the ball) moving faster in one 1/60 s frame than a man
 *            can run (12 m/s) or a ball can fly (45 m/s). Also the last frame
 *            of the build-up against the chance's first (the hand-over).
 *   NEAR     for goals with 360 frames: how far the real men StatsBomb's camera
 *            saw at each moment are from the nearest of our men on their side
 *            (metres, average). "Held out": the track is built without every
 *            other frame and measured on the frames it never saw.
 *   BALL     the replayed ball against each real touch (where and when).
 *
 * Run: npx tsx tests/star/realGoals/track.mts [collection ...]
 */
import { loadGoals } from "./harness.mts";
import * as E from "../../../lib/star/canvasEngine";
import { leadInEntities, type LeadIn } from "../../../lib/star/leadIn";
import { leadinTrack, sbToPitch } from "../../../lib/star/statsbombShots";
import {
  scenarioForGoal, trackForGoal, realMoveLeadin, moveWindow, realBallKeys, isNamedFor, dressFor, replayError, isTracked,
  type RealGoal,
} from "../../../lib/star/realGoals";
import { trackWindow } from "../../../lib/star/realGoalTrack";

export const PERSON_JUMP = 12, BALL_JUMP = 45;

function oldTrack(g: RealGoal, sc: E.Scenario): LeadIn | null {
  // v0.17's page, on the same move (its own event kinds only: no ball-received rows).
  const g0: RealGoal = { ...g, x: { ...g.x, move: g.x.move.filter((e) => e[1] !== "R") } };
  const lead = realMoveLeadin(g0);
  if (!lead) return null;
  const win = moveWindow(g0);
  dressFor(g0)(sc);
  return leadinTrack(g.shot, lead, sc, { ballKeys: (end) => realBallKeys(g0, win, end), isNamed: isNamedFor(g0, sc) });
}

function jumps(lead: LeadIn, sc: E.Scenario) {
  const keys = leadInEntities(sc).map((e) => e.key);
  for (let i = 0; i < (lead.extraMates ?? 0); i++) keys.push(`extra${i}`);
  const ends = new Map(leadInEntities(sc).map((e) => [e.key, e.get()]));
  const dt = 1 / 60;
  let men = 0, ball = 0, handover = 0, top = 0;
  const prev = new Map<string, E.Vec2>();
  let pb = lead.ballAt(0);
  for (let t = dt; t <= lead.durS + 1e-9; t += dt) {
    for (const k of keys) {
      const p = lead.posAt(k, t) ?? ends.get(k);
      if (!p) continue;
      const q = prev.get(k);
      if (q) { const v = Math.hypot(p.x - q.x, p.y - q.y) / dt; top = Math.max(top, v); if (v > PERSON_JUMP) men++; }
      prev.set(k, p);
    }
    const b = lead.ballAt(t);
    if (Math.hypot(b.x - pb.x, b.y - pb.y) / dt > BALL_JUMP) ball++;
    pb = b;
  }
  // The hand-over: the build-up's last drawn frame against where the chance puts each man.
  for (const [k, e] of ends) {
    const p = lead.posAt(k, lead.durS - dt) ?? e;
    if (Math.hypot(p.x - e.x, p.y - e.y) / dt > PERSON_JUMP) handover++;
  }
  return { men, ball, handover, top };
}

/** Average distance from each real man the 360 camera saw to the nearest of ours on his side, at that moment. */
function nearness(g: RealGoal, lead: LeadIn, sc: E.Scenario, frames: [number, [number, number, number, number, number][]][], tOf: (back: number) => number) {
  const ents = leadInEntities(sc);
  let sum = 0, n = 0;
  for (const [back, people] of frames) {
    const t = tOf(back);
    if (t < 0 || t > lead.durS) continue;
    const ours = ents.map((e) => ({ side: e.side === "you" ? "mate" : e.side, p: lead.posAt(e.key, t) ?? e.get() }));
    for (let i = 0; i < (lead.extraMates ?? 0); i++) { const p = lead.posAt(`extra${i}`, t); if (p) ours.push({ side: "mate", p }); }
    for (const [x, y, mate, gk] of people) {
      const side = mate ? "mate" : gk ? "keeper" : "opp";
      const p = sbToPitch([x, y]);
      if (side === "keeper" && p.y > 52.5) continue;
      // Only men in the real chance's own area (where ours are): a man 70 m away is not in our picture.
      let best = Infinity;
      for (const o of ours) if (o.side === side) best = Math.min(best, Math.hypot(o.p.x - p.x, o.p.y - p.y));
      if (best < 25) { sum += best; n++; }
    }
  }
  return n ? { mean: sum / n, n } : null;
}

export function measureTrack(only?: string[], log = false) {
  const goals = loadGoals(only).filter((g) => g.shot.type !== "Penalty");
  const r = {
    goals: 0, tracked: 0,
    before: { men: 0, ball: 0, handover: 0, withJump: 0 }, after: { men: 0, ball: 0, handover: 0, withJump: 0 },
    near: { before: 0, after: 0, held: 0, n: 0 }, ballErr: { before: 0, after: 0, n: 0 }, worstAfter: [] as string[],
  };
  for (const g of goals) {
    const scA = scenarioForGoal(g);
    const a = trackForGoal(g, scA);
    if (!a) continue;
    const scB = scenarioForGoal(g);
    const b = oldTrack(g, scB);
    r.goals++;
    const ja = jumps(a, scA);
    r.after.men += ja.men; r.after.ball += ja.ball; r.after.handover += ja.handover; if (ja.men + ja.ball + ja.handover) { r.after.withJump++; r.worstAfter.push(`${g.id} ${g.shot.player}: ${ja.men} man-frames, ${ja.ball} ball, ${ja.handover} hand-over, top ${ja.top.toFixed(0)} m/s`); }
    if (b) { const jb = jumps(b, scB); r.before.men += jb.men; r.before.ball += jb.ball; r.before.handover += jb.handover; if (jb.men + jb.ball + jb.handover) r.before.withJump++; }
    const win = trackWindow(g.x.move);
    const T = win[0][0] + 0.4;
    // Ball against the real touches.
    const touches = win.map((e) => ({ back: e[0], p: sbToPitch(e[2]) }));
    const ea = replayError(a.ballKeys, touches);
    if (!Number.isNaN(ea) && b) {
      const eb = replayError((b as unknown as { ballKeys: typeof a.ballKeys }).ballKeys, touches);
      if (!Number.isNaN(eb)) { r.ballErr.before += eb; r.ballErr.after += ea; r.ballErr.n++; }
    }
    if (isTracked(g) && b) {
      r.tracked++;
      const frames = (g.x.frames ?? []).filter((f) => f[0] > 0.05 && f[0] <= win[0][0]);
      const na = nearness(g, a, scA, frames, (back) => T - back);
      // v0.17's timeline: its build-up is its own length; measured against the same real moments counted back from its shot.
      const nb = nearness(g, b, scB, frames, (back) => b.durS - back);
      // Held out: built without every other frame, measured on those.
      const keep = (g.x.frames ?? []).filter((_, i) => i % 2 === 0), drop = frames.filter((f) => !keep.includes(f));
      const gH: RealGoal = { ...g, x: { ...g.x, frames: keep } };
      const scH = scenarioForGoal(gH);
      const h = trackForGoal(gH, scH);
      const nh = h ? nearness(gH, h, scH, drop, (back) => T - back) : null;
      if (na && nb && nh) { r.near.after += na.mean; r.near.before += nb.mean; r.near.held += nh.mean; r.near.n++; }
    }
  }
  if (log) {
    console.log(`${r.goals} goals with a move (${r.tracked} with 360 frames)`);
    console.log(`JUMPS  goals with any jump: ${r.before.withJump} → ${r.after.withJump}   man-frames over ${PERSON_JUMP} m/s: ${r.before.men} → ${r.after.men}   ball: ${r.before.ball} → ${r.after.ball}   hand-over: ${r.before.handover} → ${r.after.handover}`);
    if (r.near.n) console.log(`NEAR   real men vs ours (360 goals, ${r.near.n}): ${(r.near.before / r.near.n).toFixed(2)} m → ${(r.near.after / r.near.n).toFixed(2)} m   (held-out frames: ${(r.near.held / r.near.n).toFixed(2)} m)`);
    if (r.ballErr.n) console.log(`BALL   replayed ball vs real touches: ${(r.ballErr.before / r.ballErr.n).toFixed(2)} m → ${(r.ballErr.after / r.ballErr.n).toFixed(2)} m`);
    if (r.worstAfter.length) console.log("  still jumping:\n    " + r.worstAfter.slice(0, 15).join("\n    "));
  }
  return r;
}

if (process.argv[1]?.endsWith("track.mts")) {
  const t0 = Date.now();
  measureTrack(process.argv.slice(2).length ? process.argv.slice(2) : undefined, true);
  console.log(`(${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}
