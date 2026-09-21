/**
 * RULE SETS, SCANNED OFF THE SCENARIOS RATHER THAN WRITTEN BY HAND.
 *
 * Asked for directly: "this should kind of be auto-scanning, right? When I
 * press Simulate on one-on-ones, it should be scanning the current
 * one-on-ones in that section… if I add 5 new ones, it should just
 * automatically scan, and that should be taken into account while simulating
 * new randomizers. Same goes for in-game."
 *
 * So there is no hand-written table of what a one-on-one is. There is a list
 * of things worth MEASURING, and the rule set is whatever those measurements
 * say about the scenarios that exist right now. Author five more and the next
 * call sees sixteen samples and widens or tightens accordingly — nobody edits
 * a constant.
 *
 * ── Hard vs soft ──
 *
 * A property that is IDENTICAL across every authored scenario is an
 * INVARIANT: the author never once allowed it to vary, so the randomiser may
 * never break it. "No defender is goal-side of the ball" came out of the
 * eleven one-on-ones this way — it is stricter than the rule anybody would
 * have written by hand ("nobody between ball and goal"), and it is stricter
 * because that is what was actually drawn.
 *
 * Everything else is a soft RANGE: the span the author worked within. The
 * randomiser samples inside it and a small overshoot is fine — eleven
 * scenarios cannot possibly have found the true edges of "how far out can a
 * one-on-one start".
 *
 * Nothing here changes game behaviour on its own. It measures, and it says
 * what is outside the lines.
 */

import type { Vec2 } from "./canvasEngine";
import type { MatchScenario } from "./scenarios";
import { CX, GOAL_W, BOX_DEPTH } from "./pitch";

const POST_L = CX - GOAL_W / 2;
const POST_R = CX + GOAL_W / 2;

/**
 * The one shape every measurement reads.
 *
 * Both an authored scenario (flat, saved positions) and a live engine
 * `Scenario` (runners, a follower, a keeper object) reduce to this, so a
 * picture drawn in the gallery and a picture the match just built are
 * measured by the exact same code. Without that, a rule could pass the
 * scanner and fail in play for no reason but which struct it was read from.
 */
export interface ShapeSample {
  ball: Vec2;
  you: Vec2;
  keeper: Vec2;
  /** Outfield opponents. The keeper is his own field — every rule about him
   *  is about him specifically. */
  defenders: Vec2[];
  mates: Vec2[];
}

export function sampleFromAuthored(ms: MatchScenario): ShapeSample | null {
  const you = ms.players.find((p) => p.side === "you");
  const keeper = ms.players.find((p) => p.label === "GK");
  if (!you || !keeper) return null;
  return {
    ball: { x: ms.ball.x, y: ms.ball.y },
    you: { x: you.x, y: you.y },
    keeper: { x: keeper.x, y: keeper.y },
    defenders: ms.players
      .filter((p) => p.side === "opponent" && p.label !== "GK")
      .map((p) => ({ x: p.x, y: p.y })),
    mates: ms.players.filter((p) => p.side === "teammate").map((p) => ({ x: p.x, y: p.y })),
  };
}

// ─────────────────────────────────────────────────────────────────────────
//  WHAT GETS MEASURED
// ─────────────────────────────────────────────────────────────────────────

/** How far `p` sits off the straight line from the ball to the goal centre —
 *  the shot's own line. The single most useful number about a defender or a
 *  keeper in a shooting chance: on it, or out of it. */
function offShotLine(p: Vec2, ball: Vec2): number {
  const vx = CX - ball.x, vy = 0 - ball.y;
  const len = Math.hypot(vx, vy) || 1;
  return Math.abs(((p.x - ball.x) * vy - (p.y - ball.y) * vx) / len);
}

/** Is `d` inside the widening corridor from the ball to the goal MOUTH (not
 *  just its centre), and ahead of the ball? That corridor is what a shot
 *  actually has to pass through. */
function inShotCorridor(d: Vec2, ball: Vec2): boolean {
  if (d.y >= ball.y) return false;
  const t = ball.y === 0 ? 0 : (ball.y - d.y) / ball.y;
  const lo = ball.x + (POST_L - ball.x) * t;
  const hi = ball.x + (POST_R - ball.x) * t;
  return d.x >= Math.min(lo, hi) - 1.2 && d.x <= Math.max(lo, hi) + 1.2;
}

const sortedDist = (from: Vec2, ps: Vec2[]): number[] =>
  ps.map((p) => Math.hypot(p.x - from.x, p.y - from.y)).sort((a, b) => a - b);

export interface Measure {
  id: string;
  /** Plain English, for the rule-set readout. No jargon — this is read by
   *  people who do not open files. */
  label: string;
  /** A count, so the readout can say "3" rather than "3.0m". */
  count?: boolean;
  /** A share of something else, so the readout says "0.20" rather than
   *  "0.2m" — these are the keeper ones, and calling a ratio a distance is
   *  exactly the kind of small lie that gets read as a real number. */
  ratio?: boolean;
  of: (s: ShapeSample) => number;
}

/**
 * Everything worth knowing about the SHAPE of a chance.
 *
 * Deliberately all relational — a distance or a count between two things,
 * never an absolute pitch coordinate. An absolute rule ("the ball is at
 * x=33") describes one picture; a relational one ("no defender is goal-side
 * of the ball") describes the situation, and still holds once the whole thing
 * is slid ten metres sideways by a formation or a camera.
 */
export const MEASURES: Measure[] = [
  { id: "ballDepth", label: "Ball's distance from the goal line", of: (s) => s.ball.y },
  { id: "ballLateral", label: "Ball's distance from the middle", of: (s) => Math.abs(s.ball.x - CX) },
  { id: "ballToGoal", label: "Ball to the goal centre", of: (s) => Math.hypot(s.ball.x - CX, s.ball.y) },
  { id: "youToBall", label: "Your gap to the ball", of: (s) => Math.hypot(s.you.x - s.ball.x, s.you.y - s.ball.y) },

  { id: "gkOffLine", label: "Keeper's distance off his line", of: (s) => s.keeper.y },
  { id: "gkLateral", label: "Keeper's distance from the middle", of: (s) => Math.abs(s.keeper.x - CX) },
  { id: "gkOffShot", label: "Keeper's distance off the shot line", of: (s) => offShotLine(s.keeper, s.ball) },
  { id: "gkToBall", label: "Keeper to the ball", of: (s) => Math.hypot(s.keeper.x - s.ball.x, s.keeper.y - s.ball.y) },
  {
    // How far the keeper covers his NEAR post, as a share of how wide the
    // ball is. 0 = he stays dead centre and both corners are equal; 1 = he
    // is square with the ball and the whole goal is across him.
    //
    // Described directly: "if you're on one side of the goal or the other,
    // usually the goalkeeper will be nearer to the near post to cover his
    // near post, and that will leave space to shoot across the goal."
    // Measured in the first eleven one-on-ones: 5 of 5 wide balls shaded
    // toward the NEAR post and none toward the far — the instinct is
    // unanimous — but at a median 0.20 of the way, much less than the
    // description suggests. Scanned rather than fixed, so drawing a few with
    // the keeper further across raises it on its own.
    id: "gkNearPost", label: "Keeper's near-post cover (share of the ball's width)", ratio: true,
    of: (s) => {
      const bl = s.ball.x - CX;
      if (Math.abs(bl) < 1.5) return NaN;   // a central ball has no near post
      return ((s.keeper.x - CX) * Math.sign(bl)) / Math.abs(bl);
    },
  },
  {
    // 0 = on his line, 0.5 = halfway out to the ball, 1 = at the ball's feet.
    // "Goalie can come off his line, probably to be about halfway in between
    // you and the goal… but a lot of the time he will stay on his line."
    // Both halves measured true in the eleven: 8 of 11 are on the line, and
    // the one that comes out is at 0.57 of the way — halfway, as described.
    id: "gkAdvance", label: "How far the keeper comes out (0 = his line, 1 = at the ball)", ratio: true,
    of: (s) => (s.ball.y <= 0.01 ? NaN : s.keeper.y / s.ball.y),
  },

  { id: "defCount", label: "Defenders in the picture", count: true, of: (s) => s.defenders.length },
  {
    id: "defBetween", label: "Defenders between the ball and the goal", count: true,
    of: (s) => s.defenders.filter((d) => inShotCorridor(d, s.ball)).length,
  },
  {
    id: "defGoalSide", label: "Defenders nearer the goal than the ball", count: true,
    of: (s) => s.defenders.filter((d) => d.y < s.ball.y).length,
  },
  { id: "defNearest", label: "Nearest defender to the ball", of: (s) => sortedDist(s.ball, s.defenders)[0] ?? 99 },
  { id: "defSecond", label: "Second-nearest defender to the ball", of: (s) => sortedDist(s.ball, s.defenders)[1] ?? 99 },

  { id: "mateCount", label: "Team-mates in the picture", count: true, of: (s) => s.mates.length },
  { id: "mateNearest", label: "Nearest team-mate to the ball", of: (s) => sortedDist(s.ball, s.mates)[0] ?? 99 },
  {
    id: "mateInShot", label: "Team-mates standing in your shot", count: true,
    of: (s) => s.mates.filter((m) => m.y < s.ball.y && offShotLine(m, s.ball) < 2.2).length,
  },

  { id: "inBox", label: "Ball is inside the box", count: true, of: (s) => (s.ball.y <= BOX_DEPTH ? 1 : 0) },
];

// ─────────────────────────────────────────────────────────────────────────
//  THE RULE SET
// ─────────────────────────────────────────────────────────────────────────

export interface Rule {
  id: string;
  label: string;
  count: boolean;
  ratio: boolean;
  min: number;
  max: number;
  median: number;
  /** Never varied across the samples, so the randomiser may never break it. */
  invariant: boolean;
}

export interface RuleSet {
  kind: string;
  /** How many scenarios this was scanned off. One is not a rule set; the
   *  readout says the number so nobody mistakes a single drawing for a law. */
  n: number;
  rules: Rule[];
}

/** A rule set is only as trustworthy as its sample count. Below this, ranges
 *  are reported but nothing is treated as a hard invariant — three scenarios
 *  agreeing on something is a coincidence, not a rule. */
export const MIN_SAMPLES_FOR_INVARIANT = 5;

/**
 * Scan a set of authored scenarios into a rule set.
 *
 * This is the auto-scan. It holds no state and caches nothing: hand it the
 * pool as it stands and it describes the pool as it stands.
 */
export function deriveRuleSet(kind: string, samples: ShapeSample[]): RuleSet {
  const rules: Rule[] = [];
  for (const m of MEASURES) {
    const vs = samples.map((s) => m.of(s)).filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
    if (!vs.length) continue;
    const min = vs[0], max = vs[vs.length - 1];
    rules.push({
      id: m.id,
      label: m.label,
      count: !!m.count,
      ratio: !!m.ratio,
      min,
      max,
      median: vs[Math.floor(vs.length / 2)],
      invariant: min === max && samples.length >= MIN_SAMPLES_FOR_INVARIANT,
    });
  }
  return { kind, n: samples.length, rules };
}

/**
 * What a picture gets WRONG about the rule set, in plain English.
 *
 * Hard invariants only — a soft range is what the author happened to draw
 * inside, not a wall. Reporting a jittered ball a metre past the furthest one
 * ever authored as "broken" would reject most of the variety the randomiser
 * exists to create.
 */
export function violations(sample: ShapeSample, set: RuleSet): string[] {
  const out: string[] = [];
  for (const r of set.rules) {
    if (!r.invariant) continue;
    const m = MEASURES.find((x) => x.id === r.id);
    if (!m) continue;
    const v = m.of(sample);
    if (v !== r.min) {
      out.push(r.count
        ? `${r.label.toLowerCase()}: ${v}, should be ${r.min}`
        : r.ratio
          ? `${r.label.toLowerCase()}: ${v.toFixed(2)}, should be ${r.min.toFixed(2)}`
          : `${r.label.toLowerCase()}: ${v.toFixed(1)}m, should be ${r.min.toFixed(1)}m`);
    }
  }
  return out;
}

/** How far outside its authored range a picture strays, worst-first. Not a
 *  fault — a report, for the rule-set readout and for tuning the jitter. */
export function drift(sample: ShapeSample, set: RuleSet): { label: string; by: number }[] {
  const out: { label: string; by: number }[] = [];
  for (const r of set.rules) {
    if (r.invariant) continue;
    const m = MEASURES.find((x) => x.id === r.id);
    if (!m) continue;
    const v = m.of(sample);
    const by = v < r.min ? r.min - v : v > r.max ? v - r.max : 0;
    if (by > 0.01) out.push({ label: r.label, by });
  }
  return out.sort((a, b) => b.by - a.by);
}

/** The rule set as lines a person reads. Invariants first — they are the
 *  ones that actually bind. */
export function describeRuleSet(set: RuleSet): string[] {
  const n = (r: Rule, v: number) =>
    r.count ? String(v) : r.ratio ? v.toFixed(2) : `${v.toFixed(1)}m`;
  const hard = set.rules.filter((r) => r.invariant)
    .map((r) => `ALWAYS — ${r.label}: ${n(r, r.min)}`);
  const soft = set.rules.filter((r) => !r.invariant)
    .map((r) => `${r.label}: ${n(r, r.min)} to ${n(r, r.max)} (usually ${n(r, r.median)})`);
  return [...hard, ...soft];
}
