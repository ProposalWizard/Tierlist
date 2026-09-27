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

import { goalInView, crossViewportOnBall, type Scenario, type Vec2, type Viewport } from "./canvasEngine";
import { CX, GOAL_W, PITCH_W } from "./pitch";
import { AUTHORED_SCENARIOS } from "./authoredScenarios";
import type { MatchScenario } from "./scenarios";
import { listScenarios } from "./scenarioStore";
import {
  deriveRuleSet, sampleFromAuthored, violations, MIN_SAMPLES_FOR_INVARIANT,
  type RuleSet, type ShapeSample,
} from "./scenarioRules";

// ─────────────────────────────────────────────────────────────────────────
//  THE POOL — always read fresh, never cached by value
// ─────────────────────────────────────────────────────────────────────────

/**
 * THE DATASET — one list, the same for every player on every device.
 *
 * Called out as the part that matters most: "the most important is the auto
 * tuning, once we get that down I can add as many as I want and the ruleset
 * should always adapt." It still adapts — the rule set is re-scanned off the
 * pool every time it is asked for — but WHICH pool changed, for a reason
 * that was felt in play before it was found in the code.
 *
 * THE GAME reads the committed file (`authoredScenarios.json`) and nothing
 * else. It used to add the browser's own cached copy of the saved list on
 * top, and the only thing that ever refreshed that cache was opening a dev
 * tool — so each device played a different set, frozen at whenever that
 * browser last visited the gallery. Reported directly: "That's why we're
 * getting different highlights... 1v1 in-game should be playing off of its
 * 21 1v1s." Now it does, on every device, for every player.
 *
 * THE DEV TOOLS (the gallery, Infinite Highlights) additionally see the
 * team's SAVED drawings, so Simulate and the rule set react to a save the
 * moment it is made. They opt in with `showSavedScenarios(true)`; the game
 * never does. The saved list itself is identical for everyone — the sync
 * mirrors the server rather than merging into whatever a browser had.
 *
 * So: Save = the team's shared working set, visible in the dev tools.
 * Commit = in the game.
 */
const POST_L = CX - GOAL_W / 2;
const POST_R = CX + GOAL_W / 2;
const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

let injectedPool: MatchScenario[] | null = null;
/** Off by default, so the game — which never touches it — reads only the
 *  committed file. See the dataset note above. */
let savedVisible = false;

/** A dev tool's opt-in to the team's saved drawings. Turn it off again on
 *  the way out: this is module state, and a client-side navigation from the
 *  gallery to the Play Area must not carry it into a real match. */
export function showSavedScenarios(on: boolean): void {
  savedVisible = on;
}

/** Force the live half of the pool. Only for tests and for a screen that
 *  wants to preview a rule set against a set it has not saved yet — pass
 *  `null` to go back to reading the store. */
export function setLiveScenarioPool(list: MatchScenario[] | null): void {
  injectedPool = list;
}

function livePool(): MatchScenario[] {
  if (injectedPool) return injectedPool;
  if (!savedVisible) return [];
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

/** Does the game actually serve drawings for this kind yet? Five readable
 *  ones, the same bar as `nextAuthoredShape` — not merely "one exists". */
export function hasAuthored(kind: string): boolean {
  const set = ruleSetFor(kind);
  return !!set && set.n >= MIN_SAMPLES_FOR_INVARIANT;
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

/**
 * THE SAME TWO DIALS, PER CHANCE KIND.
 *
 * `KEEPER_TUNING` above is global — set it and every kind moves. That is the
 * opposite of the standing rule on this tool: "the tuning from corrections
 * should propose ONLY for that highlight type and we need to make sure
 * tuning only affects the highlight type."
 *
 * It matters here for a measured reason. A tight angle's keeper is drawn at
 * a median 0.11 of the way across to his near post, and the generator that
 * places him cannot exceed 0.30 — `buildTightAngle` clamps his x to inside
 * the posts (`POST_R - 0.3`), and with the ball 8-16m wide that caps the
 * share at about a third. So at a tight angle he never covers the near post,
 * which is the whole defence of that chance. Reported on the call as "the
 * tight-angle chance is too easy, I could score every time, the keeper is
 * not on his line where he should be."
 *
 * A one-on-one's keeper is a different question with a different answer, so
 * correcting one must not move the other.
 *
 * Empty by default: nothing here changes until a number is chosen by
 * LOOKING at it, which is what this file's own KeeperTuning note already
 * says and what the team's standing rule on numbers requires.
 */
export const KEEPER_TUNING_BY_KIND: Record<string, Partial<KeeperTuning>> = {};

/** The two dials in force for a kind — its own, falling back to the global. */
export function keeperTuningFor(kind: string | undefined): KeeperTuning {
  const own = kind ? KEEPER_TUNING_BY_KIND[kind] : undefined;
  return {
    nearPost: own?.nearPost ?? KEEPER_TUNING.nearPost,
    advance: own?.advance ?? KEEPER_TUNING.advance,
  };
}

/** Below this the ball is central and there is no near post to cover, so a
 *  share of its width is meaningless (and dividing by it is noise). */
const CENTRAL_BALL_M = 1.5;

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
  /** Which chance this is, so a kind's own dials win over the global ones.
   *  Omitted by any caller that does not know or care, which behaves exactly
   *  as it did before per-kind tuning existed. */
  kind?: string,
): Vec2 {
  const tuning = keeperTuningFor(kind);
  const nearPost = tuning.nearPost ?? shares.nearPost;
  const advance = tuning.advance ?? shares.advance;
  const lateral = ball.x - CX;
  const x = nearPost === null || Math.abs(lateral) < CENTRAL_BALL_M
    // A central ball has no near post to shade toward, so his drawn offset
    // from the middle is kept as-is rather than invented from a ratio.
    ? CX + (drawn.x - CX)
    : CX + Math.sign(lateral) * nearPost * Math.abs(lateral);
  const y = advance === null ? drawn.y : advance * ball.y;
  // He stands where the drawing puts him: his depth is the drawing's own
  // share of the ball's, nothing more. There used to be a floor here (never
  // nearer than 1.6 m to his line, then 0.3 m) and a cap (always 1.5 m
  // goal-side of the ball). Neither was asked for, and together they pinned
  // every corner keeper at exactly 1.6 m and pushed a keeper drawn on his line
  // out (audit #1 and #11; Harry, 27 Sep 2026: "nothing should be always").
  return {
    x: clamp(x, POST_L - 2.5, POST_R + 2.5),
    y,
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
/** The distance between the two closest outfield players (you included). */
function closestPair(s: ShapeSample): number {
  const pts = [s.you, ...s.defenders, ...s.mates];
  let best = Infinity;
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
    const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
    if (d < best) best = d;
  }
  return best;
}

/** Dead balls served exactly as drawn (see randomiseAuthored). */
export const DEAD_BALL_EXACT: ReadonlySet<string> = new Set(["penalty", "free_kick"]);

export interface RandomiseOptions {
  /** Keep the ball (and you) exactly where drawn — a dead ball's spot. */
  fixedBall?: boolean;
  /** Serve the drawing exactly, no nudge on anyone (a penalty: "the ball on
   *  the spot… faking variety there would be inventing it"). */
  noNudge?: boolean;
}

export function randomiseAuthored(
  base: MatchScenario, set: RuleSet, rng: () => number, opts: RandomiseOptions = {},
): AuthoredShape | null {
  const s0 = sampleFromAuthored(base);
  if (!s0) return null;
  const shares = keeperSharesOf(s0);
  let rejected = 0;
  // A dead ball is served exactly as drawn: no open-play nudge on anyone.
  // Measured before (audit #3): the nudge put a penalty's ball off the spot
  // in 100% of penalties (median 0.76 m) and a man inside the area or the D
  // in 86%; a free kick's ball moved in 77% before Harry's own free-kick rules
  // even saw it. Harry's named penalty and free-kick rules decide those.
  const kindOf = base.source?.kind ?? base.kind;
  const exact = !!opts.noNudge || DEAD_BALL_EXACT.has(kindOf);
  for (const scale of exact ? [0] : ATTEMPT_SCALE) {
    // The ball and you travel as one rigid pair, so the stance between you
    // survives; everyone else is nudged independently.
    // A corner's ball sits on the flag: the open-play nudge put it off the
    // pitch in 34.2% of served corners (behind the goal line or over the
    // touchline). The taker stays with it, so neither moves.
    const deadBall = kindOf === "corner" || !!opts.fixedBall;
    const shift = scale === 0 || deadBall ? { x: 0, y: 0 } : nudge({ x: 0, y: 0 }, BALL_JITTER_M * scale, rng);
    const cand: ShapeSample = {
      ball: { x: s0.ball.x + shift.x, y: s0.ball.y + shift.y },
      you: { x: s0.you.x + shift.x, y: s0.you.y + shift.y },
      // Derived from the nudged ball, never copied — see KeeperTuning.
      keeper: { x: 0, y: 0 },
      defenders: s0.defenders.map((d) => (scale === 0 ? d : nudge(d, JITTER_M * scale, rng))),
      mates: s0.mates.map((m) => (scale === 0 ? m : nudge(m, JITTER_M * scale, rng))),
    };
    cand.keeper = placeKeeper(cand.ball, shares, s0.keeper, base.source?.kind);
    // NO NUDGE PUTS TWO MEN INSIDE EACH OTHER. Harry, 26 Sep 2026, on a sheet
    // of simulated corners: bodies stacked on top of each other. The spacing
    // is the drawing's own — a nudge may never bring any two players closer
    // than the drawing's closest pair (or 1 m, whichever is smaller) — so it
    // is not a new rule, just the drawing kept as drawn.
    const spacing = Math.min(1, closestPair(s0));
    if (closestPair(cand) + 0.05 < spacing) { rejected++; continue; }
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
  // FIVE DRAWINGS BEFORE A KIND IS TAKEN OVER — the same bar a law needs.
  //
  // It used to be one. Measured: a single saved free kick served 400 of 400
  // free kicks, every one a nudge of the same picture. A single drawing is
  // not a dataset, and the rule set already refuses to call anything a law
  // below five for exactly that reason; serving now agrees with it. Below
  // five the kind falls straight through to the procedural builder, exactly
  // as a kind with nothing drawn always has.
  if (!set || set.n < MIN_SAMPLES_FOR_INVARIANT) return null;
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
 * THE DRAWING IS THE TEAM, for every kind. The builder decides who each man
 * IS (the pass target, the poacher, a support runner, a marker); the drawing
 * decides how many there are and where they stand. A drawn man the build had
 * no body for is added at his spot; a builder man the drawing does not have
 * leaves. Measured before (audit #2): a served cutback was missing a drawn
 * defender 76% of the time (e.g. a drawing with 7 defenders and 6 team-mates
 * played as 4 and 4), and builder-only men stayed in 14-84% of chances.
 *
 * Returns what actually landed, for the caller's own log.
 */
/** Behind the ball and off the picture: where a man the drawing doesn't have
 *  is walked to when he can't simply be taken out (the poacher). Same spot as
 *  scenarioEdit.ts's OFF_PITCH, for the same reason: nobody is offside
 *  behind the ball. */
const OFF_THE_PICTURE: Vec2 = { x: -400, y: 400 };
/** A drawn team-mate with no builder body to copy a pace from: the builder's
 *  own support pace (canvasEngine's RUNNER_SPEED × 0.95). */
const EXTRA_RUNNER_SPEED = 6.65;

/**
 * Make the live chance carry exactly the drawing's men: drawn defenders the
 * build didn't have are added at their spots, and every build figure with no
 * drawn spot leaves. The pass target (the runner) always keeps a drawn spot —
 * if he was the one left over, he takes the spot of a man who can leave.
 */
function drawnHeadcount(
  sc: Scenario, shape: AuthoredShape, takenD: Set<number>, takenM: Set<number>, bodies: Vec2[],
): { defendersPlaced: number; matesPlaced: number; removed: number } {
  // Defenders the drawing has and the build didn't: the spots the matching
  // never reached are exactly the tail of the drawing's list.
  // (A build with no defender at all still gets the drawn ones: every field
  // but the spot is optional, and initDefenders / castDefence give each his
  // role and his real face afterwards, exactly as for a built man.)
  let placedD = takenD.size;
  const tmpl = sc.defenders[0];
  for (let k = placedD; k < shape.defenders.length; k++) {
    const s = shape.defenders[k];
    sc.defenders.push(tmpl
      ? { ...tmpl, x: s.x, y: s.y, homeX: undefined, homeY: undefined, role: undefined, baseRole: undefined, interceptTo: undefined, who: undefined, chasing: undefined }
      : { x: s.x, y: s.y });
    takenD.add(sc.defenders.length - 1);
    placedD++;
  }
  const before = sc.defenders.length;
  sc.defenders = sc.defenders.filter((_, i) => takenD.has(i));
  const removed = before - sc.defenders.length;

  // Team-mates. Which live object is each body in mateBodiesOf's order?
  const kinds: ("runner" | "second" | "follower" | "mate")[] = [];
  if (sc.runner) kinds.push("runner");
  for (let i = 0; i < sc.secondaryRunners.length; i++) kinds.push("second");
  if (goalInView(sc.kind)) kinds.push("follower");
  for (let i = 0; i < sc.teammates.length; i++) kinds.push("mate");

  // The runner is the one a pass or cross is aimed at: he always stands on a
  // drawn spot. Left over, he swaps with the nearest man who can leave.
  const runnerIdx = kinds.indexOf("runner");
  if (runnerIdx >= 0 && !takenM.has(runnerIdx)) {
    let best = -1, bestD = Infinity;
    bodies.forEach((b, i) => {
      if (!takenM.has(i) || (kinds[i] !== "mate" && kinds[i] !== "second")) return;
      const d = Math.hypot(b.x - bodies[runnerIdx].x, b.y - bodies[runnerIdx].y);
      if (d < bestD) { bestD = d; best = i; }
    });
    if (best >= 0) {
      bodies[runnerIdx].x = bodies[best].x; bodies[runnerIdx].y = bodies[best].y;
      takenM.delete(best); takenM.add(runnerIdx);
    }
  }

  const leaving = new Set<Vec2>();
  bodies.forEach((b, i) => { if (!takenM.has(i)) leaving.add(b); });
  sc.teammates = sc.teammates.filter((m) => !leaving.has(m));
  sc.secondaryRunners = sc.secondaryRunners.filter((r) => !leaving.has(r.pos));
  if (leaving.has(sc.follower)) { sc.follower.x = OFF_THE_PICTURE.x; sc.follower.y = OFF_THE_PICTURE.y; }

  // Drawn team-mates the build had no body for. In open play each one is a
  // real support runner — someone you can pass to, who reacts to the ball and
  // steps out of your shot — exactly like the ones the builder makes. At a
  // dead ball (a corner's crowd in the box, a penalty, a free kick) they
  // stand, as the corner's own crowd always has: a free kick curled round
  // the wall is a shot, not a pass to whoever stands near its line (measured:
  // as runners they "received" 24 of 160 curled free kicks). Either way
  // castScenario gives each a real face.
  let placedM = takenM.size;
  const standing = sc.kind === "corner" || sc.kind === "penalty" || sc.kind === "free_kick";
  for (let k = placedM; k < shape.mates.length; k++) {
    const at = shape.mates[k];
    if (standing) sc.teammates.push({ x: at.x, y: at.y });
    else {
      sc.secondaryRunners.push({
        pos: { x: at.x, y: at.y }, to: { x: at.x, y: at.y },
        speed: sc.runner?.speed ?? sc.secondaryRunners[0]?.speed ?? EXTRA_RUNNER_SPEED,
        moving: false, role: "support", sprint: false,
      });
    }
    placedM++;
  }
  return { defendersPlaced: placedD, matesPlaced: placedM, removed };
}

/** A corner or a byline cross, watched from the side (the builder's
 *  crossViewport turn). */
function isTurnedDeadBall(sc: Scenario): boolean {
  // v0.15 item 19: a byline cross's drawings are treated like a corner's —
  // mirrored onto the builder's flag and filmed from it — instead of being
  // laid over whichever side the builder happened to turn to (measured: 104
  // of 200 served crosses had you in the top half of the screen).
  const turnedKind = sc.kind === "corner" || sc.kind === "byline_cross";
  return turnedKind && (sc.facing === "left" || sc.facing === "right");
}

/** The same drawing taken from the other flag: every x reflected across the
 *  pitch's centre line, depth untouched. */
export function mirrorShape(s: AuthoredShape): AuthoredShape {
  const m = (v: Vec2): Vec2 => ({ x: PITCH_W - v.x, y: v.y });
  return {
    ...s,
    ball: m(s.ball), you: m(s.you), keeper: m(s.keeper),
    defenders: s.defenders.map(m), mates: s.mates.map(m),
    camera: { ...s.camera, centerX: PITCH_W - s.camera.centerX },
  };
}

/**
 * The standard frame for a served chance: the builder's size for this kind,
 * placed by one rule instead of by the drawing's saved camera.
 *   - Up and down: a goal chance keeps the builder's (the goal where it always
 *     sits); any other keeps the ball where the builder's frame puts it.
 *   - Sideways: centred on everyone in the picture (and the goal).
 *   - The ball and you are always in, 3 m clear; the goal is never cut.
 * Measured against the drawings' own cameras over 300 served chances a kind:
 * players off the frame one-on-one 0.18 → 0.13, tight angle 0.74 → 0.51,
 * long range 0.61 → 0.45, cutback 1.10 → 1.06; ball, you and goal never cut.
 */
function standardFrame(sc: Scenario, built: Viewport, builtBall: Vec2): Viewport {
  const w = built.x2 - built.x1, h = built.y2 - built.y1;
  const goal = goalInView(sc.kind);
  const pts: Vec2[] = [sc.ball, sc.player, sc.keeper, ...sc.defenders, ...mateBodiesOf(sc)]
    .filter((p) => p.x > -100 && p.x < PITCH_W + 100);
  if (goal) pts.push({ x: CX - GOAL_W / 2, y: 0 }, { x: CX + GOAL_W / 2, y: 0 });
  const xs = pts.map((p) => p.x);
  let cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  let cy = goal ? (built.y1 + built.y2) / 2 : sc.ball.y + ((built.y1 + built.y2) / 2 - builtBall.y);
  for (const p of [sc.ball, sc.player]) {
    cx = Math.min(Math.max(cx, p.x - w / 2 + 3), p.x + w / 2 - 3);
    cy = Math.min(Math.max(cy, p.y - h / 2 + 3), p.y + h / 2 - 3);
  }
  if (goal) cx = Math.min(Math.max(cx, CX + GOAL_W / 2 + 1 - w / 2), CX - GOAL_W / 2 - 1 + w / 2);
  return { x1: cx - w / 2, x2: cx + w / 2, y1: cy - h / 2, y2: cy + h / 2 };
}

export function applyAuthoredShape(sc: Scenario, shape: AuthoredShape): {
  defendersPlaced: number; matesPlaced: number;
  /** Builder defenders taken out because the drawing does not have them. */
  removed: number;
} {
  // ── A CORNER IS FILMED FROM ITS OWN FLAG ──
  //
  // The builder picks a flag at random and turns the camera to it; a drawing
  // carries its own flag. Laying a right-flag drawing over a left-flag build
  // kept the LEFT turn and camera — measured: 50.2% of served corners filmed
  // from the wrong side, the taker drawn up in the top third, and the
  // builder's leftover bodies stranded on the far side (519 in 2,000). Harry
  // and Mikey saw it as "the camera issue" on corners.
  //
  // So the drawing is mirrored onto the builder's flag instead (x → pitch
  // width − x; nothing about depth changes). The builder's turn, frame and
  // leftovers then all agree with it, and every drawing now serves both
  // flags, which doubles the variety from the same drawings.
  if (isTurnedDeadBall(sc) && (shape.ball.x >= CX) !== (sc.ball.x >= CX)) shape = mirrorShape(shape);
  // The builder's own frame and ball, before the drawing moves anything —
  // the standard framing for this kind (see standardFrame).
  const built = { ...sc.viewport };
  const builtBall = { x: sc.ball.x, y: sc.ball.y };
  sc.ball.x = shape.ball.x; sc.ball.y = shape.ball.y;
  sc.player.x = shape.you.x; sc.player.y = shape.you.y;
  sc.keeper.x = shape.keeper.x; sc.keeper.y = shape.keeper.y;
  // His lean and his scramble are measured from startX: left at the builder's
  // spot, up to 4 m away, a drawn keeper's dive "turned round" (20-25% of
  // drawn tight angles, measured).
  sc.keeper.startX = sc.keeper.targetX = shape.keeper.x;

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

  // ── THE DRAWING DECIDES WHO IS ON THE PITCH ──
  //
  // Harry, 26 Sep 2026, looking at a sheet of simulated corners: players
  // stranded outside the box, bodies stacked on each other — the BUILDER's
  // own men the drawing has no spot for. Fixed then for corners and long
  // range; now for every kind (27 Sep: "the drawing is the team").
  const r = drawnHeadcount(sc, shape, takenD, takenM, bodies);
  defendersPlaced = r.defendersPlaced; matesPlaced = r.matesPlaced;
  const removed = r.removed;

  // A runner's `to` is where he is RUNNING, not where he stands — left
  // alone, he would sprint back to a spot from the procedural build the
  // moment the ball is struck, undoing the placement on screen.
  if (sc.runner) { sc.runner.to.x = sc.runner.pos.x; sc.runner.to.y = sc.runner.pos.y; }
  for (const r of sc.secondaryRunners) { r.to.x = r.pos.x; r.to.y = r.pos.y; }
  if (sc.runner) sc.passTarget = { x: sc.runner.to.x, y: sc.runner.to.y };

  // ── THE FRAME IS THE KIND'S, NOT THE DRAWING'S ──
  //
  // Harry, 26 Sep 2026: "changing the camera angle for specific highlights
  // should not be taken into account … for now" — a camera change on one
  // card stays on that card. So a served chance never takes the drawing's
  // camera; it gets the standard frame for its kind, fitted to what is on it.
  // A corner keeps the builder's frame exactly (his pick: today's framing).
  if (!isTurnedDeadBall(sc)) sc.viewport = standardFrame(sc, built, builtBall);
  // v0.15 item 19: the drawn ball is somewhere else from the
  // builder's, so the side view is re-hung on IT — you at the bottom, like a
  // corner. (A corner's builder already hangs its frame on the flag.)
  else if (sc.kind === "byline_cross") sc.viewport = crossViewportOnBall(sc.ball, sc.ball.x >= CX ? 1 : -1);

  return { defendersPlaced, matesPlaced, removed };
}

