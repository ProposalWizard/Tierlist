/**
 * CORRECTIONS — "that generation was bad, here is it fixed."
 *
 * A second, deliberately weaker kind of edit, next to the hand-authored
 * BASE scenarios.
 *
 * Asked for directly: "some generations come out, and they're so bad that I
 * just want to move a player back, show that that's not the way to do it,
 * and then press Tune… I don't want it to be a base one of the 17, 20, 25
 * scenarios that is doing the auto-tuning."
 *
 * ── Why a correction must NOT be a base, and must not tune on its own ──
 *
 * Two reasons, and the second is the one that decides it.
 *
 * A base is a picture somebody built on purpose: every figure in it is where
 * it is because it should be. A correction is a MINIMAL fix to generator
 * output — one defender nudged, and the other eight bodies still wherever
 * the generator put them. Measuring it as an exemplar would feed
 * generator-quality geometry into the ranges that define what a good chance
 * looks like.
 *
 * And suppressing the one bad picture achieves almost nothing by itself: the
 * generator makes millions of distinct chances, so that exact one was never
 * coming back anyway. The value is not in the picture. It is in WHAT WAS
 * WRONG WITH IT — which only becomes trustworthy once several corrections
 * say the same thing.
 *
 * ── So a correction is silent until a pattern shows up ──
 *
 * Each one records which measurable property it repaired. One is noise.
 * `PROPOSAL_THRESHOLD` of them agreeing is a rule worth proposing — and it
 * is PROPOSED, never applied, because a rule derived from a handful of
 * examples is exactly the trap this project has fallen into twice (an
 * unscoped back-line rule once flagged 32.2% of all pictures as broken when
 * the real figure was 0.64%).
 */

import { CX, GOAL_W } from "./pitch";
import type { MatchScenario, ScenarioPlayer } from "./scenarios";

const POST_L = CX - GOAL_W / 2;
const POST_R = CX + GOAL_W / 2;
/** The same radius the shot-lane rules already use, so a correction and a
 *  law agree about what "in the way" means. */
const LANE_R = 2.2;
/** Below this a figure did not really move — a stray pixel of drag is not a
 *  correction, and counting it as one would fill the evidence with noise. */
export const MIN_MOVE_M = 0.6;
/** How many corrections have to agree before it is worth proposing. One is
 *  noise; this is the smallest number that is not. */
export const PROPOSAL_THRESHOLD = 3;

/** One figure, moved. */
export interface Move {
  id: string;
  side: string;
  label: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
  /** How far, in metres. */
  dist: number;
}

/** What a correction is EVIDENCE OF — the measurable thing it repaired. */
export type FaultKind =
  | "defender-in-lane"
  | "defender-goal-side"
  | "mate-in-lane"
  | "defender-on-top-of-ball"
  | "keeper-off-shot-line";

export const FAULT_LABEL: Record<FaultKind, string> = {
  "defender-in-lane": "a defender standing in your shooting lane",
  "defender-goal-side": "a defender nearer the goal than the ball",
  "mate-in-lane": "one of your own standing in your shooting lane",
  "defender-on-top-of-ball": "a defender right on top of the ball",
  "keeper-off-shot-line": "the keeper off the line of the shot",
};

export interface Correction {
  /** The exact chance this came from, so the same one is recognisable. */
  id: string;
  kind: string;
  /** What it repaired. Empty when the move fixed nothing measurable — kept
   *  anyway, because "I moved this and could not say why" is still a record,
   *  it just never becomes evidence. */
  faults: FaultKind[];
  moves: Move[];
  at: number;
}

// ── Geometry, shared with the rule set's own definitions ──────────────────

const offShotLine = (p: { x: number; y: number }, ball: { x: number; y: number }): number => {
  const vx = CX - ball.x, vy = 0 - ball.y;
  const len = Math.hypot(vx, vy) || 1;
  return Math.abs(((p.x - ball.x) * vy - (p.y - ball.y) * vx) / len);
};

const inShotCorridor = (d: { x: number; y: number }, ball: { x: number; y: number }): boolean => {
  if (d.y >= ball.y) return false;
  const t = ball.y === 0 ? 0 : (ball.y - d.y) / ball.y;
  const lo = ball.x + (POST_L - ball.x) * t;
  const hi = ball.x + (POST_R - ball.x) * t;
  return d.x >= Math.min(lo, hi) - 1.2 && d.x <= Math.max(lo, hi) + 1.2;
};

const isKeeper = (p: ScenarioPlayer) => (p.label ?? "").toUpperCase() === "GK";

/** Every figure that moved by more than a stray drag. */
export function movesBetween(before: MatchScenario, after: MatchScenario): Move[] {
  const byId = new Map(before.players.map((p) => [p.id, p]));
  const out: Move[] = [];
  for (const a of after.players) {
    const b = byId.get(a.id);
    if (!b) continue;
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    if (dist < MIN_MOVE_M) continue;
    out.push({
      id: a.id, side: a.side, label: a.label ?? a.id,
      from: { x: b.x, y: b.y }, to: { x: a.x, y: a.y }, dist,
    });
  }
  return out;
}

/**
 * WHAT THIS CORRECTION FIXED.
 *
 * A property counts only if it was genuinely broken BEFORE and is genuinely
 * fine AFTER. That is what stops "I nudged a defender" being read as
 * evidence for whatever rule happens to be nearby — the move has to have
 * actually repaired something measurable.
 */
export function faultsRepaired(before: MatchScenario, after: MatchScenario): FaultKind[] {
  const out: FaultKind[] = [];
  const defs = (s: MatchScenario) => s.players.filter((p) => p.side === "opponent" && !isKeeper(p));
  const mates = (s: MatchScenario) => s.players.filter((p) => p.side === "teammate");
  const gk = (s: MatchScenario) => s.players.find(isKeeper);

  const was = (n: number, now: number) => n > 0 && now < n;

  if (was(defs(before).filter((d) => inShotCorridor(d, before.ball)).length,
          defs(after).filter((d) => inShotCorridor(d, after.ball)).length)) {
    out.push("defender-in-lane");
  }
  if (was(defs(before).filter((d) => d.y < before.ball.y).length,
          defs(after).filter((d) => d.y < after.ball.y).length)) {
    out.push("defender-goal-side");
  }
  if (was(mates(before).filter((m) => m.y < before.ball.y && offShotLine(m, before.ball) < LANE_R).length,
          mates(after).filter((m) => m.y < after.ball.y && offShotLine(m, after.ball) < LANE_R).length)) {
    out.push("mate-in-lane");
  }
  if (was(defs(before).filter((d) => Math.hypot(d.x - before.ball.x, d.y - before.ball.y) < 1.5).length,
          defs(after).filter((d) => Math.hypot(d.x - after.ball.x, d.y - after.ball.y) < 1.5).length)) {
    out.push("defender-on-top-of-ball");
  }
  const kb = gk(before), ka = gk(after);
  if (kb && ka && offShotLine(kb, before.ball) > 2 && offShotLine(ka, after.ball) <= 2) {
    out.push("keeper-off-shot-line");
  }
  return out;
}

export function makeCorrection(
  id: string, kind: string, before: MatchScenario, after: MatchScenario,
): Correction {
  return {
    id, kind,
    faults: faultsRepaired(before, after),
    moves: movesBetween(before, after),
    at: Date.now(),
  };
}

// ── What several of them, agreeing, add up to ────────────────────────────

export interface Proposal {
  kind: string;
  fault: FaultKind;
  /** The plain-English rule this would become. */
  rule: string;
  count: number;
  /** The corrections behind it, so the examples can be shown. */
  from: Correction[];
}

const RULE_TEXT: Record<FaultKind, string> = {
  "defender-in-lane": "No defender stands in your shooting lane",
  "defender-goal-side": "No defender is nearer the goal than the ball",
  "mate-in-lane": "No team-mate stands in your shooting lane",
  "defender-on-top-of-ball": "No defender starts right on top of the ball",
  "keeper-off-shot-line": "The keeper starts on the line of the shot",
};

/**
 * Every pattern that enough corrections agree on, worst first.
 *
 * Grouped by KIND as well as fault, because "defenders keep blocking the
 * lane in a long range" and "…in a cutback" are different claims about
 * different situations, and merging them is how a rule ends up scoped to
 * pictures it was never about.
 */
export function proposalsFrom(corrections: Correction[]): Proposal[] {
  const buckets = new Map<string, Correction[]>();
  for (const c of corrections) {
    for (const f of c.faults) {
      const key = `${c.kind}|${f}`;
      const list = buckets.get(key) ?? [];
      list.push(c);
      buckets.set(key, list);
    }
  }
  const out: Proposal[] = [];
  for (const [key, list] of Array.from(buckets.entries())) {
    if (list.length < PROPOSAL_THRESHOLD) continue;
    const [kind, fault] = key.split("|") as [string, FaultKind];
    out.push({ kind, fault, rule: RULE_TEXT[fault], count: list.length, from: list });
  }
  return out.sort((a, b) => b.count - a.count);
}

// ── Where they live ───────────────────────────────────────────────────────

const KEY = "star-scenario-corrections-v1";

export function loadCorrections(): Correction[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? (parsed as Correction[]) : [];
  } catch {
    return [];
  }
}

export function saveCorrection(c: Correction): Correction[] {
  const all = loadCorrections().filter((x) => x.id !== c.id);
  all.push(c);
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* a dev tool */ }
  return all;
}

export function clearCorrections(): void {
  try { localStorage.removeItem(KEY); } catch { /* a dev tool */ }
}
