/**
 * THE AUTHORED CHANCE LAYER — play the pictures that were actually drawn.
 *
 * Asked for directly, in this order: "making the rule set for the one-on-ones
 * / making the randomizer and simulation work / applying that in-game."
 *
 * ── What this is ──
 *
 * A hand-authored scenario (`authoredScenarios.json`, written by the Scenario
 * Gallery's Commit to repo) is a set of positions somebody placed on purpose.
 * This lays those positions onto a real, live `Scenario` the engine just
 * built — with a small random nudge on every figure so the same eleven
 * drawings never read as eleven repeating pictures.
 *
 * ── Why it can't just place them and hope ──
 *
 * A nudge is a nudge in a direction nobody checked. Pushed the wrong way it
 * puts a defender in front of the ball and the one-on-one stops being a
 * one-on-one — measured on an earlier pass at exactly this, 22.6% of raw
 * jittered pictures broke their own definition. So every attempt is scanned
 * against the rule set the authored scenarios themselves produce
 * (`scenarioRules.ts`), and a broken one is thrown away and redrawn with a
 * smaller nudge. The last attempt has no nudge at all, which is the authored
 * scenario exactly — so the worst case is a picture a person drew, never a
 * broken one.
 *
 * ── What it does NOT do ──
 *
 * Nothing here touches gameplay. It moves bodies before the whistle and stops.
 * Every engine system downstream — roles, faces, the keeper, the ball — runs
 * on the result exactly as it runs on a procedurally built one. A kind with no
 * authored scenarios falls straight through to today's behaviour, so this is
 * fully reversible by deleting rows.
 */

import { goalInView, type Scenario, type Vec2 } from "./canvasEngine";
import { CX, GOAL_W } from "./pitch";
import { AUTHORED_SCENARIOS } from "./authoredScenarios";
import type { MatchScenario } from "./scenarios";
import { listScenarios } from "./scenarioStore";
import {
  deriveRuleSet, sampleFromAuthored, violations,
  type RuleSet, type ShapeSample,
} from "./scenarioRules";

// ─────────────────────────────────────────────────────────────────────────
//  THE POOL — always read fresh, never cached by value
// ─────────────────────────────────────────────────────────────────────────

/**
 * THE AUTO-TUNING, and why it needs nobody to remember anything.
 *
 * Called out as the part that matters most: "the most important is the auto
 * tuning, once we get that down I can add as many as I want and the ruleset
 * should always adapt."
 *
 * So the pool is never handed in and never held. It is READ, at the moment
 * it is asked for, from the two places a scenario can actually live:
 *
 *   1. `authoredScenarios.json` — committed to the repo by the gallery's
 *      Commit to repo button. Survives anything that happens to the database.
 *   2. `scenarioStore.listScenarios()` — the browser's own copy of the live
 *      Supabase pool, kept current by the `fetchSharedScenarios()` every
 *      screen already fires at load, and written the instant a scenario is
 *      saved.
 *
 * Because (2) is read live, saving a scenario in the gallery changes the rule
 * set for the very next chance — no deploy, no commit, no restart, and
 * nothing for anyone to wire up. Delete one and it stops counting just as
 * fast. On the server (and in tests) `listScenarios()` safely returns nothing,
 * so the repo file alone is the pool there.
 */
const POST_L = CX - GOAL_W / 2;
const POST_R = CX + GOAL_W / 2;
const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

let injectedPool: MatchScenario[] | null = null;

/** Force the live half of the pool. Only for tests and for a screen that
 *  wants to preview a rule set against a set it has not saved yet — pass
 *  `null` to go back to reading the store. */
export function setLiveScenarioPool(list: MatchScenario[] | null): void {
  injectedPool = list;
}

function livePool(): MatchScenario[] {
  if (injectedPool) return injectedPool;
  try {
    return listScenarios();
  } catch {
    return [];
  }
}

/** Every authored scenario of one chance kind, repo + live, de-duplicated by
 *  id with the live copy winning (it is the one that was saved most recently). */
export function authoredPool(kind: string): MatchScenario[] {
  const byId = new Map<string, MatchScenario>();
  for (const s of Object.values(AUTHORED_SCENARIOS)) {
    if (s.source?.kind === kind) byId.set(s.id, s);
  }
  for (const s of livePool()) {
    if (s.source?.kind === kind) byId.set(s.id, s);
  }
  return Array.from(byId.values()).sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * The rule set for a kind, scanned off whatever is authored for it right now.
 *
 * Memoised only against the exact pool it was scanned from — the key is every
 * id and save time, so adding, editing or deleting one scenario invalidates
 * it on the next call. The scan is cheap; this exists so a match that asks
 * sixty times in ninety minutes does not redo it sixty times, not to hold a
 * stale answer.
 */
const ruleCache = new Map<string, { key: string; set: RuleSet }>();

export function ruleSetFor(kind: string): RuleSet | null {
  const pool = authoredPool(kind);
  if (!pool.length) return null;
  const key = pool.map((s) => `${s.id}@${s.updatedAt ?? 0}`).join("|");
  const hit = ruleCache.get(kind);
  if (hit && hit.key === key) return hit.set;
  const usable = pool.filter((s) => !!sampleFromAuthored(s));
  const samples = usable.map(sampleFromAuthored) as ShapeSample[];
  if (!samples.length) return null;
  // The ids travel with the samples so a rule can name the drawings that
  // disagree with it — see `outliersOf`.
  const set = deriveRuleSet(kind, samples, usable.map((s) => s.id));
  ruleCache.set(kind, { key, set });
  return set;
}

export function hasAuthored(kind: string): boolean {
  return authoredPool(kind).length > 0;
}

// ─────────────────────────────────────────────────────────────────────────
//  A LIVE SCENARIO, MEASURED
// ─────────────────────────────────────────────────────────────────────────

/**
 * Every attacking body in a live scenario, in the order they are worth
 * placing: the pass target first (he is the chance), then the supporting
 * runners, the poacher, and the decorative bodies last.
 */
export function mateBodiesOf(sc: Scenario): Vec2[] {
  const out: Vec2[] = [];
  if (sc.runner) out.push(sc.runner.pos);
  for (const r of sc.secondaryRunners) out.push(r.pos);
  if (goalInView(sc.kind)) out.push(sc.follower);
  for (const t of sc.teammates) out.push(t);
  return out;
}

export function sampleFromScenario(sc: Scenario): ShapeSample {
  return {
    ball: { x: sc.ball.x, y: sc.ball.y },
    you: { x: sc.player.x, y: sc.player.y },
    keeper: { x: sc.keeper.x, y: sc.keeper.y },
    defenders: sc.defenders.map((d) => ({ x: d.x, y: d.y })),
    mates: mateBodiesOf(sc).map((m) => ({ x: m.x, y: m.y })),
  };
}

// ─────────────────────────────────────────────────────────────────────────
//  THE RANDOMISER
// ─────────────────────────────────────────────────────────────────────────

/**
 * How far a figure may be nudged from where he was drawn, in metres.
 *
 * 2m was measured on an earlier pass as the point where 91.5% of pictures
 * read as genuinely different from their base while still being repairable.
 * Smaller and the eleven bases show through; larger and the retry loop starts
 * falling back to the exact authored scenario often enough to undo the point.
 */
export const JITTER_M = 2.0;

/** The ball and YOU move together and move LESS: their gap to each other is
 *  one of the tightest things in every rule set scanned so far (0.9–2.0m
 *  across the eleven one-on-ones), and it is the one pair a nudge can most
 *  obviously break. */
const BALL_JITTER_M = 1.2;

/** Full nudge, then smaller, then smaller, then none. The final 0 is the
 *  guarantee: it reproduces the authored scenario exactly, which is valid by
 *  construction because a person drew it. */
const ATTEMPT_SCALE = [1, 0.6, 0.3, 0];

const nudge = (p: Vec2, r: number, rng: () => number): Vec2 => {
  const a = rng() * Math.PI * 2;
  const d = Math.sqrt(rng()) * r; // sqrt keeps it uniform over the disc
  return { x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d };
};

/**
 * THE KEEPER, DERIVED RATHER THAN COPIED.
 *
 * Two numbers describe where a keeper stands in a chance, and both are
 * RELATIVE to the ball:
 *
 *   nearPost  how far he covers his near post, as a share of how wide the
 *             ball is. 0 = dead centre, 1 = square with the ball.
 *   advance   how far he comes off his line, as a share of the ball's own
 *             distance from goal. 0 = on his line, 1 = at the ball's feet.
 *
 * Copying his drawn position and nudging it independently breaks both the
 * moment the ball moves — measured over 2,000 variants, the drawn range of
 * 0.13 to 0.45 became −0.68 to 1.34, and 32.8% of nudges made his near-post
 * cover WORSE. A NEGATIVE share means he had drifted to the FAR post, which
 * is the opposite of the thing the drawings are unanimous about (5 of 5).
 *
 * So each drawing's own two shares are read off it, and the keeper is placed
 * from the NUDGED ball using them. The character of the drawing survives —
 * a keeper drawn rushing out still rushes out — and he now follows the ball
 * instead of standing where he happened to be put.
 */
export interface KeeperTuning {
  /** Override every drawing's own near-post share. `null` keeps each
   *  drawing's. Set this once a number has been chosen by looking. */
  nearPost: number | null;
  /** Same, for how far off his line he comes. */
  advance: number | null;
}

export const KEEPER_TUNING: KeeperTuning = { nearPost: null, advance: null };

/** Below this the ball is central and there is no near post to cover, so a
 *  share of its width is meaningless (and dividing by it is noise). */
const CENTRAL_BALL_M = 1.5;
/** He never stands on the line itself, and never further out than the ball. */
const GK_MIN_Y = 1.6;

/** The two shares a drawing holds about its own keeper. */
export function keeperSharesOf(s: ShapeSample): { nearPost: number | null; advance: number | null } {
  const lateral = s.ball.x - CX;
  return {
    nearPost: Math.abs(lateral) < CENTRAL_BALL_M
      ? null
      : ((s.keeper.x - CX) * Math.sign(lateral)) / Math.abs(lateral),
    advance: s.ball.y <= 0.01 ? null : s.keeper.y / s.ball.y,
  };
}

/** Put the keeper where those shares say, for wherever the ball now is. */
export function placeKeeper(
  ball: Vec2, shares: { nearPost: number | null; advance: number | null }, drawn: Vec2,
): Vec2 {
  const nearPost = KEEPER_TUNING.nearPost ?? shares.nearPost;
  const advance = KEEPER_TUNING.advance ?? shares.advance;
  const lateral = ball.x - CX;
  const x = nearPost === null || Math.abs(lateral) < CENTRAL_BALL_M
    // A central ball has no near post to shade toward, so his drawn offset
    // from the middle is kept as-is rather than invented from a ratio.
    ? CX + (drawn.x - CX)
    : CX + Math.sign(lateral) * nearPost * Math.abs(lateral);
  const y = advance === null ? drawn.y : advance * ball.y;
  return {
    x: clamp(x, POST_L - 2.5, POST_R + 2.5),
    y: clamp(y, GK_MIN_Y, Math.max(GK_MIN_Y, ball.y - 1.5)),
  };
}

export interface AuthoredShape {
  /** Which scenario this came from, for the readout and the anti-repeat. */
  sourceId: string;
  ball: Vec2;
  you: Vec2;
  keeper: Vec2;
  defenders: Vec2[];
  mates: Vec2[];
  camera: MatchScenario["camera"];
  /** 0 = the authored scenario exactly; 1 = a full nudge on every figure. */
  jitter: number;
  /** How many attempts were thrown away for breaking the rule set. */
  rejected: number;
}

/**
 * One randomised variant of one authored scenario.
 *
 * Exported on its own so the gallery can show a variant without a live
 * `Scenario` anywhere near it, and so it can be tested directly.
 */
export function randomiseAuthored(
  base: MatchScenario, set: RuleSet, rng: () => number,
): AuthoredShape | null {
  const s0 = sampleFromAuthored(base);
  if (!s0) return null;
  const shares = keeperSharesOf(s0);
  let rejected = 0;
  for (const scale of ATTEMPT_SCALE) {
    // The ball and you travel as one rigid pair, so the stance between you
    // survives; everyone else is nudged independently.
    const shift = scale === 0 ? { x: 0, y: 0 } : nudge({ x: 0, y: 0 }, BALL_JITTER_M * scale, rng);
    const cand: ShapeSample = {
      ball: { x: s0.ball.x + shift.x, y: s0.ball.y + shift.y },
      you: { x: s0.you.x + shift.x, y: s0.you.y + shift.y },
      // Derived from the nudged ball, never copied — see KeeperTuning.
      keeper: { x: 0, y: 0 },
      defenders: s0.defenders.map((d) => (scale === 0 ? d : nudge(d, JITTER_M * scale, rng))),
      mates: s0.mates.map((m) => (scale === 0 ? m : nudge(m, JITTER_M * scale, rng))),
    };
    cand.keeper = placeKeeper(cand.ball, shares, s0.keeper);
    if (violations(cand, set).length === 0) {
      return {
        sourceId: base.id, ...cand, camera: base.camera, jitter: scale, rejected,
      };
    }
    rejected++;
  }
  return null; // unreachable: scale 0 is the authored scenario, which is valid
}

/**
 * Pick an authored scenario and randomise it.
 *
 * `recent` is a short memory of what has just been served, so the same
 * drawing is never two chances running — the same anti-repeat the chance
 * formula already uses, for the same reason.
 */
export function nextAuthoredShape(
  kind: string, rng: () => number, recent: string[] = [], stableKey?: number,
): AuthoredShape | null {
  const set = ruleSetFor(kind);
  const pool = authoredPool(kind);
  if (!set || !pool.length) return null;
  const fresh = pool.filter((s) => !recent.includes(s.id));
  const from = fresh.length ? fresh : pool;
  const base = stableKey === undefined
    ? from[Math.floor(rng() * from.length) % from.length]
    : stableBase(from, stableKey);

  const shape = randomiseAuthored(base, set, rng);
  if (shape) return shape;

  // ── The base itself breaks a law ──
  //
  // Only reachable for a drawing the rule set has named an OUTLIER: the
  // retry loop's last attempt is the drawing untouched, so a clean one can
  // never fail. Rather than serve it — which is exactly the 15% of broken
  // chances that made one slip so costly — take the next drawing that does
  // obey. Deterministic for a stable key, so a gallery cell still does not
  // wander.
  const rest = from.filter((s) => s.id !== base.id);
  for (let i = 0; i < rest.length; i++) {
    const alt = stableKey === undefined
      ? rest[i]
      : stableBase(rest, stableKey + i + 1);
    const ok = randomiseAuthored(alt, set, rng);
    if (ok) return ok;
  }
  return null;
}

/**
 * PICK A BASE THAT DOES NOT MOVE WHEN THE POOL GROWS.
 *
 * A gallery cell is a fixed seed, and a person edits the picture under it.
 * Choosing the base by `index = seed % poolLength` means adding ONE scenario
 * renumbers everything: measured, saving a single new drawing repainted
 * 102 of 200 existing sim cells onto a DIFFERENT base — with whatever had
 * been dragged on that cell still applied on top, now over a different
 * arrangement. An edit silently landing on a picture it was not made for is
 * worse than no edit.
 *
 * Rendezvous hashing (highest random weight) instead: every drawing is scored
 * against the cell's own seed and the best score wins. Adding one drawing to a
 * pool of n moves only about 1/(n+1) of the assignments — the minimum any
 * scheme can manage — and removing one only moves the cells that were on it.
 *
 * The match does NOT pass a stable key: it wants a different picture every
 * time and has nothing to keep still.
 */
function stableBase(pool: MatchScenario[], key: number): MatchScenario {
  let best = pool[0];
  let bestScore = -1;
  for (const s of pool) {
    const h = mix32(djb2(s.id) ^ (key >>> 0));
    if (h > bestScore) { bestScore = h; best = s; }
  }
  return best;
}

const djb2 = (str: string): number => {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h * 33) ^ str.charCodeAt(i)) >>> 0;
  return h >>> 0;
};

/**
 * A proper avalanche (murmur3's finaliser).
 *
 * A first attempt combined the id and the seed with plain djb2 and measured
 * badly: the id dominated, so one drawing won for 189 of 400 cells while
 * another won 3, and adding one scenario still repainted 31%. Mixing so that
 * every input bit affects every output bit is what makes the scores
 * independent per (drawing, cell) — which is the whole premise of rendezvous
 * hashing.
 */
const mix32 = (n: number): number => {
  let h = n >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
};

// ─────────────────────────────────────────────────────────────────────────
//  PUTTING IT ON A LIVE SCENARIO
// ─────────────────────────────────────────────────────────────────────────

/**
 * Move a live scenario's bodies onto an authored shape.
 *
 * Counts rarely match: the engine may have built four defenders where the
 * drawing has three, or two team-mates where it has three. Surplus live
 * figures keep their own position — they are real bodies the engine put
 * somewhere sensible, and inventing a home for them would be worse than
 * leaving them be. Surplus AUTHORED positions are simply unused; nobody new
 * is conjured, because a body the engine did not create has no role, no
 * identity and nobody to credit a goal to.
 *
 * Returns what actually landed, for the caller's own log.
 */
export function applyAuthoredShape(sc: Scenario, shape: AuthoredShape): {
  defendersPlaced: number; matesPlaced: number;
} {
  sc.ball.x = shape.ball.x; sc.ball.y = shape.ball.y;
  sc.player.x = shape.you.x; sc.player.y = shape.you.y;
  sc.keeper.x = shape.keeper.x; sc.keeper.y = shape.keeper.y;

  // Nearest-first, so the man the engine already had closest to a drawn spot
  // is the one who takes it. Assigning by array order instead would routinely
  // swap two defenders past each other for no reason, which reads as the
  // block rearranging itself between identical chances.
  const takenD = new Set<number>();
  let defendersPlaced = 0;
  for (const spot of shape.defenders) {
    let best = -1, bestD = Infinity;
    sc.defenders.forEach((d, i) => {
      if (takenD.has(i)) return;
      const dist = Math.hypot(d.x - spot.x, d.y - spot.y);
      if (dist < bestD) { bestD = dist; best = i; }
    });
    if (best < 0) break;
    takenD.add(best);
    sc.defenders[best].x = spot.x;
    sc.defenders[best].y = spot.y;
    defendersPlaced++;
  }

  const bodies = mateBodiesOf(sc);
  const takenM = new Set<number>();
  let matesPlaced = 0;
  for (const spot of shape.mates) {
    let best = -1, bestD = Infinity;
    bodies.forEach((m, i) => {
      if (takenM.has(i)) return;
      const dist = Math.hypot(m.x - spot.x, m.y - spot.y);
      if (dist < bestD) { bestD = dist; best = i; }
    });
    if (best < 0) break;
    takenM.add(best);
    bodies[best].x = spot.x;
    bodies[best].y = spot.y;
    matesPlaced++;
  }
  // A runner's `to` is where he is RUNNING, not where he stands — left
  // alone, he would sprint back to a spot from the procedural build the
  // moment the ball is struck, undoing the placement on screen.
  if (sc.runner) { sc.runner.to.x = sc.runner.pos.x; sc.runner.to.y = sc.runner.pos.y; }
  for (const r of sc.secondaryRunners) { r.to.x = r.pos.x; r.to.y = r.pos.y; }
  if (sc.runner) sc.passTarget = { x: sc.runner.to.x, y: sc.runner.to.y };

  // The drawing was framed as well as placed, so the camera comes with it —
  // and because every figure is inside that frame by construction, the
  // camera's own clamp has nothing to pull back in.
  const half = shape.camera.viewHeight / 2;
  const aspect = (sc.viewport.x2 - sc.viewport.x1) / (sc.viewport.y2 - sc.viewport.y1 || 1);
  const halfW = half * aspect;
  sc.viewport = {
    x1: shape.camera.centerX - halfW, x2: shape.camera.centerX + halfW,
    y1: shape.camera.centerY - half, y2: shape.camera.centerY + half,
  };

  return { defendersPlaced, matesPlaced };
}
