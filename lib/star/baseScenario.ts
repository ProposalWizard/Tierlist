import type { Scenario, ScenarioKind } from "./canvasEngine";
import { goalInView } from "./canvasEngine";
import { CX, POST_L, POST_R } from "./pitch";

/**
 * WHAT EACH BASE SCENARIO IS SUPPOSED TO LOOK LIKE — checked, and where we are
 * sure, corrected. Sits ABOVE the engine; `canvasEngine.ts` is never modified.
 *
 * ── Why this exists ──
 *
 * Reported directly, looking at the real pictures: "the 1 vs 1 doesn't actually
 * look like a 1 vs 1 which should be flagged against real football chance."
 * He was right, and it measured far worse than it looked — over 400 real
 * `buildScenario("one_on_one")` builds:
 *
 *   a defender BETWEEN ball and goal   99.8%
 *   a defender IN THE SHOOTING LINE    22.5%
 *   a defender within 6m of the ball   68.3%
 *
 * A one-on-one means you are through with ONLY THE KEEPER TO BEAT. By that
 * definition essentially none of them were one-on-ones.
 *
 * ── The general idea ──
 *
 * Every scenario kind has a DEFINING PROPERTY — the thing that makes it that
 * chance and not a different one. A cutback comes from the byline. A header is
 * met in the air near goal. A long-range shot is long range. If a scenario
 * fails its own definition, the name is lying about the picture, and no amount
 * of formation or difficulty layering on top can rescue it. So the base has to
 * be right first — which is the order the owner asked for explicitly.
 *
 * `scenarioFaults` NAMES what is wrong in plain English (used by the gallery to
 * flag a card, and by tests). `fixBaseScenario` REPAIRS the defining property
 * for the kinds we have actually verified — deliberately not all of them yet.
 * Anything not yet verified is flagged, never silently "fixed": a wrong repair
 * rule is worse than none, which this project has already proved once (an
 * unscoped back-line gap rule flagged 32% of all pictures as broken when the
 * real figure was 0.64%, and would have "corrected" thousands of correct ones).
 */

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/** Dead balls: the defensive picture is a wall or a ring around the box, not a
 *  block, so block-shaped rules mean nothing for them. */
const DEAD_BALL = new Set<ScenarioKind>(["penalty", "free_kick", "corner"]);

/** Kinds that genuinely show a settled back line, and so can be judged on
 *  back-line spacing. A box scene shows markers in different zones instead. */
const LINE_KINDS = new Set<ScenarioKind>(["long_range", "through_ball"]);

/** How close to the line of your shot a team-mate has to be before he is
 *  genuinely in the way. The same radius chanceFormula.ts uses for the same
 *  job, so the base and the formula agree about what "in the way" means. */
const MATE_LANE_R = 2.2;

/** The offside line the engine judges against: second-last opponent, keeper
 *  counted only when the goal is in view. Mirrors canvasEngine's opponentLine. */
export function offsideLineOf(sc: Scenario): number | null {
  if (!goalInView(sc.kind) || sc.kind === "corner") return null;
  const ys = sc.defenders.map(d => d.y);
  ys.push(sc.keeper.y);
  if (ys.length < 2) return null;
  ys.sort((a, b) => a - b);
  return ys[1];
}

/** Is this man inside the triangle from the ball to the two posts — i.e. is he
 *  actually in the way of the shot, rather than merely somewhere near it. */
export function inShotCone(sc: Scenario, p: { x: number; y: number }): boolean {
  if (p.y >= sc.ball.y) return false;            // behind the ball blocks nothing
  const span = sc.ball.y || 1;
  const t = (sc.ball.y - p.y) / span;
  const lx = sc.ball.x + (POST_L - sc.ball.x) * t;
  const rx = sc.ball.x + (POST_R - sc.ball.x) * t;
  return p.x >= Math.min(lx, rx) - 0.6 && p.x <= Math.max(lx, rx) + 0.6;
}

/** Everyone on your side who is trying to score from this situation. */
function attackersOf(sc: Scenario): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  if (sc.runner) out.push(sc.runner.pos);
  for (const r of sc.secondaryRunners) out.push(r.pos);
  if (goalInView(sc.kind)) out.push({ x: sc.follower.x, y: sc.follower.y });
  return out;
}

/**
 * Offside, BOTH halves of it.
 *
 * Law 11 needs a player to be nearer the goal line than the second-last
 * opponent AND nearer than the ball. This file only ever tested the first —
 * so a team-mate standing BEHIND the ball, who cannot be offside under any
 * reading of the law, was flagged whenever the back line happened to be
 * deeper than he was.
 *
 * Reported directly: "an attacker on your own team is not offside if they are
 * behind the ball. Those offside calls are actually wrong on every single one
 * of those." Measured against the eleven authored one-on-ones: 3 of 3 calls
 * were on a man behind the ball (POACH 4.1m and 2.5m behind, SUP 1.5m
 * behind) — 100% wrong, exactly as reported. Across raw builds of every kind,
 * 46 of 153 calls (30.1%) were wrong, all of byline_cross's among them.
 *
 * canvasEngine.ts's own `offsideSnapshot` has ALWAYS had this right (it tests
 * `aheadOfBall`), so match play was never affected — this was the editor's
 * red text, and the repair below acting on it, moving men who were standing
 * legally.
 */
function isOffside(p: { y: number }, line: number, ballY: number): boolean {
  return p.y < line - 0.01 && p.y < ballY - 0.01;
}

/**
 * THE DEFINING PROPERTY OF EACH KIND — the "is this actually that chance"
 * check. Only definitions that are unambiguous football are encoded; a kind we
 * have not agreed the shape of yet returns nothing rather than guessing.
 */
function identityFault(sc: Scenario): string | null {
  const dist = sc.ball.y;
  const lat = Math.abs(sc.ball.x - CX);
  switch (sc.kind) {
    case "one_on_one": {
      // The whole definition: through on goal, ONLY the keeper to beat. A
      // defender level with or behind the ball is fine (he is recovering); one
      // GOAL-SIDE of the ball in the central area is not a one-on-one.
      const blocking = sc.defenders.filter(d => d.y < dist - 0.5 && Math.abs(d.x - CX) <= 14);
      if (blocking.length) {
        return `not a one-on-one — ${blocking.length} defender${blocking.length > 1 ? "s" : ""} between you and goal`;
      }
      return null;
    }
    case "tight_angle":
      // The chance IS the angle: wide and close to the byline.
      if (lat < 9) return "not a tight angle — ball is too central";
      if (dist > 15) return "not a tight angle — ball is too far out";
      return null;
    case "long_range":
      if (dist < 17) return "not long range — ball is inside 17m";
      return null;
    case "header":
      if (dist > 8) return "header from too far out";
      return null;
    case "volley":
      if (dist > 18) return "volley from too far out";
      return null;
    case "cutback":
      // A cutback is pulled BACK from the byline to someone arriving.
      if (dist > 6) return "not a cutback — ball is not near the byline";
      if (lat < 8) return "not a cutback — ball is too central to be cut back";
      return null;
    case "byline_cross":
      // Measured: this engine places EVERY byline cross at |lat| 9.7m, 1-4m off
      // the goal line — the corner of the six-yard box. That is genuinely on the
      // byline, so the check is "near the byline, wide of the goal", not a
      // touchline test. Whether 9.7m is wide enough to read as a real byline
      // cross (a real one comes from nearer 16-20m+) is a design call for the
      // owner, deliberately raised rather than silently "fixed" here.
      if (dist > 6) return "not a byline cross — ball is not near the byline";
      if (lat < 8) return "not a byline cross — ball is too central";
      return null;
    case "through_ball":
      if (dist < 20) return "not a through ball — ball is already too close to goal";
      return null;
    default:
      return null; // dead balls + midfield: no agreed shape rule yet
  }
}

/**
 * Everything genuinely wrong with this picture, in plain English.
 * Combines the kind's own defining property with the universal legality rules.
 */
export function scenarioFaults(sc: Scenario): string[] {
  const out: string[] = [];

  const id = identityFault(sc);
  if (id) out.push(id);

  const line = offsideLineOf(sc);
  if (line !== null && attackersOf(sc).some(a => isOffside(a, line, sc.ball.y))) {
    out.push("attacker offside");
  }

  const dist = sc.ball.y;
  // A one-on-one and a through ball are DEFINED by the middle being open — you
  // are through. Flagging that as an empty channel is the rule contradicting
  // the chance. (Caught by measuring: repairing the one-on-one moved it from
  // 99.7% to 97.7% "broken" purely because this rule then fired on the repair.)
  const CHANNEL_EXEMPT = sc.kind === "one_on_one" || sc.kind === "through_ball";
  if (goalInView(sc.kind) && !DEAD_BALL.has(sc.kind) && !CHANNEL_EXEMPT
      && dist <= 24 && sc.defenders.length > 0) {
    if (!sc.defenders.some(d => Math.abs(d.x - CX) <= 6.5)) out.push("empty central channel");
  }

  if (LINE_KINDS.has(sc.kind) && dist <= 25 && sc.defenders.length >= 2) {
    const deepest = Math.min(...sc.defenders.map(d => d.y));
    const lineMen = sc.defenders.filter(d => d.y - deepest <= 4).map(d => d.x).sort((a, b) => a - b);
    for (let i = 1; i < lineMen.length; i++) {
      if (lineMen[i] - lineMen[i - 1] > 11) { out.push("11m+ hole in the line"); break; }
    }
  }

  if (sc.defenders.some(d => d.y < sc.keeper.y)) out.push("defender behind his own keeper");

  return out;
}

/**
 * Repair a base scenario's DEFINING PROPERTY.
 *
 * Only kinds whose shape has actually been agreed are repaired. Everything else
 * is left exactly as the engine built it and merely flagged by
 * `scenarioFaults`, so nothing is silently "corrected" into something wrong.
 *
 * Returns the list of repairs made, for tests and for the gallery to show.
 */
export function fixBaseScenario(sc: Scenario): string[] {
  const done: string[] = [];

  // ── Universal repairs: things that are simply illegal, whatever the kind,
  //    and need no design judgement to correct. ──

  // A defender cannot be goal-side of his own goalkeeper.
  for (const d of sc.defenders) {
    if (d.y < sc.keeper.y) {
      d.y = sc.keeper.y + 2.2;
      done.push("moved a defender out from behind his own keeper");
    }
  }

  if (sc.kind === "one_on_one") {
    // You are through; the only man in front of you is the keeper. A defender
    // who was goal-side becomes what he really would be in this moment — a
    // recovering defender chasing back, level with or behind the ball, and
    // pushed off the shooting line so the picture reads as "clean through".
    const ballY = sc.ball.y;
    // EVERY man goal-side, not just a central one. The old rule also
    // required him to be within 14m of the middle, on the reasoning that a
    // wide defender is not in the way of the shot. True of the shot, wrong
    // about the situation: a man ahead of you is ahead of you in the race,
    // wherever he is standing, and the picture stops reading as "clean
    // through". Measured against the eleven authored one-on-ones, which
    // have ZERO defenders goal-side of the ball at any width — 14.4% of
    // procedural builds broke that rule, all of them on the wide clause.
    // No half-metre of grace either: "goal-side" means goal-side. The old
    // 0.5m tolerance let a man a shoulder ahead of the ball through, which
    // is still ahead, and still not a one-on-one.
    sc.defenders.forEach((d, i) => {
      if (d.y < ballY) {
        // Deterministic spread, derived from the man's own index and starting
        // position — never Math.random(), because the gallery draws these at
        // fixed seeds and a picture must be identical on every refresh.
        const spread = ((Math.abs(d.x) * 7 + i * 13) % 100) / 100; // 0..1, stable
        // Behind the ball by a realistic chasing margin.
        d.y = ballY + 1.0 + spread * 2.5;
        // And off the line of the shot, on whichever side he is already nearer.
        const side = d.x >= sc.ball.x ? 1 : -1;
        d.x = clamp(sc.ball.x + side * (2.5 + spread * 3), 2, 66);
        done.push("moved a blocking defender behind the ball (recovering)");
      }
    });
    // AND YOUR OWN TEAM-MATES ARE NOT IN THE WAY EITHER.
    //
    // The third rule the eleven authored one-on-ones are unanimous about:
    // not one has a team-mate standing in the shot. chanceFormula.ts already
    // does this (`clearShotLane`) but only for a generated plan — a plain
    // base build had no such rule, and 4.3% of them put a man in the lane.
    // Same geometry, applied to the base so it holds however the picture was
    // made.
    const clearLane = (m: { x: number; y: number }) => {
      if (m.y >= ballY) return;                 // behind the ball blocks nothing
      const vx = CX - sc.ball.x, vy = 0 - ballY;
      const len2 = vx * vx + vy * vy || 1;
      let t = ((m.x - sc.ball.x) * vx + (m.y - ballY) * vy) / len2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const px = sc.ball.x + vx * t, py = ballY + vy * t;
      const off = Math.hypot(m.x - px, m.y - py);
      if (off >= MATE_LANE_R) return;
      const nlen = Math.hypot(-vy, vx) || 1;
      const nx = -vy / nlen, ny = vx / nlen;
      const sign = ((m.x - px) * nx + (m.y - py) * ny) >= 0 ? 1 : -1;
      const push = MATE_LANE_R - off + 0.6;
      m.x = clamp(m.x + sign * nx * push, 2, 66);
      m.y = Math.max(0.8, m.y + sign * ny * push);
      done.push("moved a team-mate out of your shooting lane");
    };
    if (sc.runner) clearLane(sc.runner.pos);
    for (const r of sc.secondaryRunners) clearLane(r.pos);
    clearLane(sc.follower);

    // The keeper is the one who comes to meet you.
    sc.keeper.y = clamp(Math.max(sc.keeper.y, 2.2), 2.2, Math.max(2.2, ballY - 3));
    sc.keeper.startX = sc.keeper.x;

    // Pushing the defenders behind the ball drags the offside line back with
    // them, which strands every other attacker beyond it. That is real football
    // — if you are genuinely through on your own, your team-mates ARE behind
    // play — so they come back onside rather than standing in an illegal
    // position. Without this the repair swapped one fault for another and the
    // measured "broken" rate barely moved (99.7% -> 96.7%).
    const line = offsideLineOf(sc);
    if (line !== null) {
      // Only a man who is GENUINELY offside — beyond the line and ahead of
      // the ball. One behind the ball is standing legally and is left where
      // he was put; moving him was the bug.
      const onside = (p: { y: number }) => {
        if (isOffside(p, line, sc.ball.y)) p.y = line + 0.3;
      };
      if (sc.runner) onside(sc.runner.pos);
      for (const r of sc.secondaryRunners) onside(r.pos);
      onside(sc.follower);
      done.push("brought team-mates back onside behind the play");
    }
  }

  // Nobody stands in an illegal position. Through-balls are the one deliberate
  // exception: a runner timing his move a yard early is the chance itself, and
  // real receivers are beyond the line about half the time — the game plays a
  // smaller share of that for playability, so it is left alone here.
  if (sc.kind !== "through_ball") {
    const line = offsideLineOf(sc);
    if (line !== null) {
      let moved = false;
      const onside = (p: { y: number }) => {
        if (isOffside(p, line, sc.ball.y)) { p.y = line + 0.3; moved = true; }
      };
      if (sc.runner) onside(sc.runner.pos);
      for (const r of sc.secondaryRunners) onside(r.pos);
      if (goalInView(sc.kind)) onside(sc.follower);
      if (moved) done.push("brought an offside attacker back onside");
    }
  }

  return done;
}
