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
  | "keeper-off-shot-line"
  | "keeper-near-post"
  | "keeper-advance";

export const FAULT_LABEL: Record<FaultKind, string> = {
  "defender-in-lane": "a defender standing in your shooting lane",
  "defender-goal-side": "a defender nearer the goal than the ball",
  "mate-in-lane": "one of your own standing in your shooting lane",
  "defender-on-top-of-ball": "a defender right on top of the ball",
  "keeper-off-shot-line": "the keeper off the line of the shot",
  "keeper-near-post": "where the keeper stands across his goal",
  "keeper-advance": "how far the keeper comes off his line",
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
  /**
   * THE NUMBER a correction was aiming for, for the faults that have one.
   *
   * The five original faults are yes/no — a defender was in the lane and now
   * isn't. The keeper is not: dragging him across his goal is a statement
   * about WHERE he should stand, and the only useful proposal is a number to
   * set. So a keeper correction carries the share he was left at, and the
   * proposal is the median of what everyone dragged him to.
   */
  values?: Partial<Record<FaultKind, number>>;
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

/**
 * THE KEEPER, as evidence — a correction the tuner could not see before.
 *
 * Measured on the ten committed tight angles: dragging the keeper across to
 * cover his near post (the fix for "the tight-angle chance is too easy, I
 * could score every time") was RECORDED all ten times and counted as
 * evidence zero times. The only keeper fault was "off the line of the shot",
 * and the shot line runs to the middle of the goal — at a tight angle the
 * near post is the threat, so moving him the right way looked like nothing.
 *
 * Two dials, the same two `KEEPER_TUNING_BY_KIND` sets (authoredChance.ts),
 * measured the same way `placeKeeper` reads them, so a proposal is a number
 * that can be dropped straight into the game:
 *
 *   near post  how far across he stands, as a share of how wide the ball is.
 *              0 = dead centre, 1 = square with the ball.
 *   advance    how far off his line, as a share of the ball's distance out.
 *
 * A move under KEEPER_SHIFT is a nudge, not a statement, and is ignored.
 */
export const KEEPER_SHIFT = 0.12;

const nearPostShare = (s: MatchScenario, gk: ScenarioPlayer): number | null => {
  const lat = s.ball.x - CX;
  if (Math.abs(lat) < 1.5) return null;             // a central ball has no near post
  return ((gk.x - CX) * Math.sign(lat)) / Math.abs(lat);
};
const advanceShare = (s: MatchScenario, gk: ScenarioPlayer): number | null =>
  (s.ball.y <= 0.01 ? null : gk.y / s.ball.y);

export function keeperEvidence(
  before: MatchScenario, after: MatchScenario,
): { faults: FaultKind[]; values: Partial<Record<FaultKind, number>> } {
  const kb = before.players.find(isKeeper), ka = after.players.find(isKeeper);
  const faults: FaultKind[] = [];
  const values: Partial<Record<FaultKind, number>> = {};
  if (!kb || !ka) return { faults, values };
  const round = (v: number) => Math.round(v * 100) / 100;

  const npB = nearPostShare(before, kb), npA = nearPostShare(after, ka);
  if (npB !== null && npA !== null && Math.abs(npA - npB) >= KEEPER_SHIFT) {
    faults.push("keeper-near-post");
    values["keeper-near-post"] = round(npA);
  }
  const adB = advanceShare(before, kb), adA = advanceShare(after, ka);
  if (adB !== null && adA !== null && Math.abs(adA - adB) >= KEEPER_SHIFT) {
    faults.push("keeper-advance");
    values["keeper-advance"] = round(adA);
  }
  return { faults, values };
}

export function makeCorrection(
  id: string, kind: string, before: MatchScenario, after: MatchScenario,
): Correction {
  const keeper = keeperEvidence(before, after);
  const c: Correction = {
    id, kind,
    faults: [...faultsRepaired(before, after), ...keeper.faults],
    moves: movesBetween(before, after),
    at: Date.now(),
  };
  if (keeper.faults.length) c.values = keeper.values;
  return c;
}

// ── What several of them, agreeing, add up to ────────────────────────────

export interface Proposal {
  kind: string;
  fault: FaultKind;
  /** The plain-English rule this would become. */
  rule: string;
  count: number;
  /** For a keeper fault: the median of what everyone dragged him to. */
  value?: number;
  /** …and the range, so a proposal backed by wildly different drags reads as
   *  exactly that rather than as a confident number. */
  range?: [number, number];
  /** The exact line to change to act on it, where there is one. */
  apply?: string;
  /** The corrections behind it, so the examples can be shown. */
  from: Correction[];
}

const RULE_TEXT: Record<FaultKind, string> = {
  "defender-in-lane": "No defender stands in your shooting lane",
  "defender-goal-side": "No defender is nearer the goal than the ball",
  "mate-in-lane": "No team-mate stands in your shooting lane",
  "defender-on-top-of-ball": "No defender starts right on top of the ball",
  "keeper-off-shot-line": "The keeper starts on the line of the shot",
  "keeper-near-post": "The keeper stands further across to cover his near post",
  "keeper-advance": "The keeper starts a different distance off his line",
};

/** Where a keeper proposal is acted on — the per-kind dials in authoredChance.ts. */
const KEEPER_DIAL: Partial<Record<FaultKind, "nearPost" | "advance">> = {
  "keeper-near-post": "nearPost",
  "keeper-advance": "advance",
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
    const p: Proposal = { kind, fault, rule: RULE_TEXT[fault], count: list.length, from: list };
    const vals = list.map((c) => c.values?.[fault]).filter((v): v is number => typeof v === "number")
      .sort((a, b) => a - b);
    if (vals.length) {
      p.value = vals[Math.floor(vals.length / 2)];
      p.range = [vals[0], vals[vals.length - 1]];
      const dial = KEEPER_DIAL[fault];
      if (dial) p.apply = `KEEPER_TUNING_BY_KIND.${kind} = { ...KEEPER_TUNING_BY_KIND.${kind}, ${dial}: ${p.value} }  // lib/star/authoredChance.ts`;
    }
    out.push(p);
  }
  return out.sort((a, b) => b.count - a.count);
}

// ─────────────────────────────────────────────────────────────────────────
//  STORAGE — the team's shared list, with this browser as a cache
// ─────────────────────────────────────────────────────────────────────────
//
// Corrections used to live ONLY in the browser that made them, so three
// people each making one correction never added up to the three a proposal
// needs — anywhere. They now go to the database (/api/star/corrections,
// supabase/migrations/star_scenario_corrections.sql) and every browser
// holds the team's list plus anything it made that the team lacks, which it
// uploads on the next sync (see fetchSharedCorrections).

const KEY = "star-scenario-corrections-v1";
const ENDPOINT = "/api/star/corrections";

const writeLocal = (all: Correction[]): void => {
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* a dev tool */ }
};

/** As deep as the tuner relies on — the same check the API applies. */
export function isCorrection(c: unknown): c is Correction {
  if (!c || typeof c !== "object" || Array.isArray(c)) return false;
  const r = c as Record<string, unknown>;
  return typeof r.id === "string" && !!r.id && typeof r.kind === "string" && !!r.kind
    && Array.isArray(r.faults) && Array.isArray(r.moves) && typeof r.at === "number";
}

export function loadCorrections(): Correction[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? (parsed as unknown[]).filter(isCorrection) : [];
  } catch {
    return [];
  }
}

/**
 * Record a correction — locally at once, and for the team in the background.
 *
 * Returns the local list straight away (the screens need the answer now to
 * say whether this completed a pattern); the network write is fire-and-forget
 * and a failed write is not lost: the correction stays in this browser and
 * the next sync uploads it.
 */
export function saveCorrection(c: Correction): Correction[] {
  const all = loadCorrections().filter((x) => x.id !== c.id);
  all.push(c);
  writeLocal(all);
  void shareCorrection(c);
  return all;
}

export async function shareCorrection(c: Correction): Promise<{ ok: boolean; message?: string }> {
  if (typeof fetch !== "function") return { ok: false, message: "No network here." };
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ correction: c }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string };
      return { ok: false, message: body.error ?? `Server refused it (${res.status}).` };
    }
  } catch {
    return { ok: false, message: "Network error — kept on this device." };
  }
  return { ok: true };
}

/**
 * Make every browser hold the SAME list: the team's, plus anything this
 * browser recorded that the team does not have yet — which is uploaded
 * rather than dropped.
 *
 * A union, not a mirror, on purpose. The scenario store mirrors because a
 * scenario can be deleted and a delete has to reach everyone. A correction
 * cannot be deleted one at a time — nothing offers it — so there is no
 * delete to propagate, and a mirror would only ever throw something away:
 * every correction made before this table existed lives in one browser and
 * nowhere else, and the first sync would have wiped it. Instead it goes up
 * to the table on that sync and from then on is everyone's.
 *
 * A failed fetch, or a server whose table does not exist yet, leaves the
 * local list exactly as it was.
 */
export async function fetchSharedCorrections(): Promise<{
  ok: boolean; migrationMissing?: boolean; message?: string; corrections: Correction[];
}> {
  const local = loadCorrections();
  if (typeof fetch !== "function") return { ok: false, corrections: local };
  let data: { corrections?: unknown; migrationMissing?: boolean; message?: string; error?: string };
  try {
    const res = await fetch(ENDPOINT, { cache: "no-store" });
    data = await res.json();
    if (!res.ok) return { ok: false, message: data?.error ?? `(${res.status})`, corrections: local };
  } catch {
    return { ok: false, message: "Couldn't reach the server.", corrections: local };
  }
  if (data.migrationMissing === true) {
    return { ok: true, migrationMissing: true, message: data.message, corrections: local };
  }
  const incoming = Array.isArray(data.corrections) ? data.corrections.filter(isCorrection) : [];
  const byId = new Map(incoming.map((c) => [c.id, c]));
  const toUpload: Correction[] = [];
  for (const mine of local) {
    const theirs = byId.get(mine.id);
    if (!theirs || mine.at > theirs.at) { byId.set(mine.id, mine); toUpload.push(mine); }
  }
  const next = Array.from(byId.values());
  writeLocal(next);
  // Anything the team did not have — including a correction whose earlier
  // upload failed — goes up now. Fire-and-forget: the local list already
  // holds it, and the next sync tries again if this one fails.
  for (const c of toUpload) void shareCorrection(c);
  return { ok: true, corrections: next };
}

export function clearCorrections(): void {
  try { localStorage.removeItem(KEY); } catch { /* a dev tool */ }
}
