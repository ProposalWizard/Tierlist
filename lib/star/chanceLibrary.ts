/**
 * THE NEW CHANCE LIBRARY — every picture the New chances can serve, made in
 * advance, checked by rule and looked at by eye, then dealt like a deck.
 *
 * Harry, 3 Oct 2026: "if I wake up and u somehow had like 100 of every
 * scenario made perfectly that would be incredible … fix how scenarios are
 * picked in game … want to see the same highlights again as little as
 * possible."
 *
 * ── Why a library, not more nudging ──
 *
 * Measured before (v0.26 scenarios plan): the 2 m nudge on a drawing never
 * makes a picture that reads as new — a cutback was one of 5 pictures, a
 * corner one of 3, a penalty one, however many times it was served. And 35.5%
 * of chances repeated a picture from the last 10 matches.
 *
 * So the pictures are made ONCE, by `scripts/chance-library.mts`, from the
 * drawings (the team's committed ones plus the New batch, see
 * scripts/new-drawings.mts) through the same randomiser and generator the
 * gallery's Sim uses — then every one is checked by the game's own checks and
 * the faults Harry named by eye, kept only if it is at least 3 m different
 * from every picture already kept, and drawn on a contact sheet to be looked
 * at. What is served is exactly what was looked at: nothing is nudged at
 * serve time.
 *
 * ── Dealt like a deck ──
 *
 * `ChanceDeck` remembers, per kind, every picture served — across a whole
 * match and across matches (mirrored to this device's storage, one deck per
 * career). A picture comes back only once every other picture of its kind has
 * been served.
 *
 * ── What it does NOT do ──
 *
 * It never decides WHICH KIND of chance you get or how often (that is the
 * hidden match and chanceMaker's rollKind). It never touches canvasEngine.ts.
 * Classic chances (Settings → Chances: Classic) never read it.
 */
import type { Scenario, ScenarioKind, Vec2 } from "./canvasEngine";
import { applyAuthoredShape, type AuthoredShape } from "./authoredChance";
import { setupKind } from "./kindRules";
import { separateBodies } from "./spacing";
import { finishServedFrame } from "./goalFrame";
import { addContext, type ContextOptions, type ContextReport } from "./contextShape";
import type { RuleSet } from "./scenarioRules";
import raw from "./chanceLibrary.json";

type P = [number, number];

/** One picture: the shape laid on before the kind's own rules run, and the
 *  seed those rules (a free kick's wall, a penalty's line) are run with. */
export interface LibEntry {
  id: string;
  /** The drawing it came from ("gen:<id>" for the generator). */
  src: string;
  seed: number;
  b: P; y: P; k: P;
  d: P[]; m: P[];
}

interface LibFile {
  version: number;
  /** Every "none of these" law each kind's drawings agree on — the context
   *  men obey them too (contextShape.ts). */
  laws: Record<string, string[]>;
  kinds: Record<string, LibEntry[]>;
}

const LIB = raw as unknown as LibFile;

/**
 * THROWN OUT BY EYE. Every picture on the contact sheets was looked at; these
 * were taken out, with why. A thrown-out picture is never served. Adding an
 * id here is the whole of taking one out.
 */
export const THROWN_OUT: Record<string, string> = {};

/** Every picture of a kind the game may serve. */
export function libraryFor(kind: string): LibEntry[] {
  const all = LIB.kinds?.[kind] ?? [];
  return all.filter((e) => !THROWN_OUT[e.id]);
}

/** Every kind the library has pictures of. */
export function libraryKinds(): string[] {
  return Object.keys(LIB.kinds ?? {}).filter((k) => libraryFor(k).length > 0);
}

/** The kind's "none of these" laws, as a rule set the context layer reads. */
export function libraryLaws(kind: string): RuleSet {
  const ids = LIB.laws?.[kind] ?? [];
  return {
    kind, n: 99,
    rules: ids.map((id) => ({ id, label: id, count: true, ratio: false, min: 0, max: 0, median: 0, invariant: true, at: 0, agree: 1, of: 1, outliers: [] })),
  };
}

const v = (p: P): Vec2 => ({ x: p[0], y: p[1] });

export function shapeOfEntry(e: LibEntry): AuthoredShape {
  return {
    sourceId: e.src,
    ball: v(e.b), you: v(e.y), keeper: v(e.k),
    defenders: e.d.map(v), mates: e.m.map(v),
    camera: { centerX: 34, centerY: 17, viewHeight: 42, facing: "up" },
    jitter: 0, rejected: 0,
  };
}

/** A tiny fixed-seed stream for the kind's own rules, so a picture's wall or
 *  penalty line is the same every time it is served. */
function seeded(a: number): () => number {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface ServeOptions {
  keeperStrength?: number;
  /** The rest of both teams. Omit `context` to serve the chance alone. */
  context?: ContextOptions | null;
}

/**
 * Lay a library picture onto a chance the engine has just built. The builder
 * decides WHO each man is (the pass target, the poacher, a marker); the
 * picture decides where everybody stands — exactly as a drawing does
 * (authoredChance's applyAuthoredShape), with the kind's own rules run on a
 * fixed seed. The library builder makes its pictures with this same function,
 * so what was looked at is what is served.
 */
export function serveEntry(sc: Scenario, e: LibEntry, o: ServeOptions = {}): { context: ContextReport | null } {
  applyAuthoredShape(sc, shapeOfEntry(e));
  throughBallTarget(sc);
  setupKind(sc, seeded(e.seed), { appliedAuthored: true, appliedPlan: false, keeperStrength: o.keeperStrength ?? 62 });
  separateBodies(sc);
  finishServedFrame(sc);
  const context = o.context === null || o.context === undefined
    ? null
    : addContext(sc, { ...o.context, laws: o.context.laws ?? libraryLaws(sc.kind) });
  return { context };
}

/**
 * A through ball is played to the man going in behind: the most advanced
 * team-mate who is onside and ahead of the ball.
 *
 * applyAuthoredShape gives the pass-target role to whichever drawn team-mate
 * stands nearest the build's own runner, so on a library through ball it
 * often went to the midfielder behind you (21% of served pictures had the
 * target level with or behind the ball, measured). The aim marker then
 * pointed backwards, and the bot's through balls scored 21% against
 * Classic's 40%. Here the roles swap so the runner is the right man; nobody
 * moves. Classic never comes here.
 */
function throughBallTarget(sc: Scenario): void {
  if (sc.kind !== "through_ball" || !sc.runner) return;
  const runner = sc.runner;
  const best = throughBallCandidate(sc);
  if (!best || best === runner.pos) return;
  const x = runner.pos.x, y = runner.pos.y;
  runner.pos.x = best.x; runner.pos.y = best.y;
  best.x = x; best.y = y;
  runner.to.x = runner.pos.x; runner.to.y = runner.pos.y;
  for (const r of sc.secondaryRunners) { r.to.x = r.pos.x; r.to.y = r.pos.y; }
  sc.passTarget = { x: runner.to.x, y: runner.to.y };
}

/** The man a through ball is for: the most advanced onside team-mate at
 *  least 3 m ahead of the ball (the poacher counts). null when there is
 *  nobody to play in, and then the picture is not a through ball. */
function throughBallCandidate(sc: Scenario): Vec2 | null {
  const line = [sc.keeper.y, ...sc.defenders.map((d) => d.y)].sort((a, b) => a - b)[1] ?? 0;
  const bodies: Vec2[] = [
    ...(sc.runner ? [sc.runner.pos] : []), ...sc.secondaryRunners.map((r) => r.pos), ...sc.teammates, sc.follower,
  ];
  let best: Vec2 | null = null;
  for (const b of bodies) {
    if (!b || b.y < line - 0.05 || b.y > sc.ball.y - 3) continue; // offside, or not ahead of the ball
    if (!best || b.y < best.y) best = b;
  }
  return best;
}

/** For the library builder: a served through ball whose pass target really
 *  is a man going in behind. */
export function throughBallHasTarget(sc: Scenario): boolean {
  if (sc.kind !== "through_ball") return true;
  return !!sc.runner && throughBallCandidate(sc) === sc.runner.pos;
}

// ─────────────────────────────────────────────────────────────────────────
//  THE DECK
// ─────────────────────────────────────────────────────────────────────────

/**
 * Per kind: which pictures this round of the deck has dealt, and the last
 * ones dealt across rounds.
 *
 *  - A round deals every picture of the kind once, in a random order (the
 *    match's own random numbers), before any comes back.
 *  - Across the turn of the deck nothing comes straight back: a picture is
 *    never dealt again within half a deck of its last deal.
 */
interface KindDeck { round: string[]; recent: string[] }

export class ChanceDeck {
  private kinds: Record<string, KindDeck> = {};
  private loaded = false;
  constructor(readonly scope: string, private readonly persist: boolean) {}

  private key() { return `star-chance-deck-v2:${this.scope}`; }

  private load() {
    if (this.loaded) return;
    this.loaded = true;
    if (!this.persist) return;
    try {
      const rawText = typeof window !== "undefined" ? window.localStorage.getItem(this.key()) : null;
      if (rawText) {
        const o = JSON.parse(rawText) as Record<string, KindDeck>;
        if (o && typeof o === "object") {
          for (const [k, v] of Object.entries(o)) {
            if (v && Array.isArray(v.round) && Array.isArray(v.recent)) this.kinds[k] = { round: v.round.map(String), recent: v.recent.map(String) };
          }
        }
      }
    } catch { /* corrupt or blocked: start a fresh deck */ }
  }

  private save() {
    if (!this.persist) return;
    try {
      if (typeof window !== "undefined") window.localStorage.setItem(this.key(), JSON.stringify(this.kinds));
    } catch { /* blocked: this visit only */ }
  }

  /** What this round has dealt of a kind. */
  dealt(kind: string): string[] {
    this.load();
    return this.kinds[kind]?.round ?? [];
  }

  /** The next picture of this kind (see the class note). */
  next(kind: string, entries: LibEntry[], rng: () => number): LibEntry | null {
    if (!entries.length) return null;
    this.load();
    const ids = new Set(entries.map((e) => e.id));
    const d = this.kinds[kind] ?? { round: [], recent: [] };
    let round = d.round.filter((id) => ids.has(id));
    const recent = d.recent.filter((id) => ids.has(id));
    const half = Math.floor(entries.length / 2);
    const blocked = new Set(recent.slice(-half));
    let fresh = entries.filter((e) => !round.includes(e.id) && !blocked.has(e.id));
    if (!fresh.length) {
      // The round is over (or everything left was dealt a moment ago).
      round = [];
      fresh = entries.filter((e) => !blocked.has(e.id));
      if (!fresh.length) fresh = entries;
    }
    const pick = fresh[Math.floor(rng() * fresh.length) % fresh.length];
    this.kinds[kind] = { round: [...round, pick.id], recent: [...recent, pick.id].slice(-entries.length) };
    this.save();
    return pick;
  }

  clear(): void {
    this.kinds = {};
    this.loaded = true;
    this.save();
  }
}

const decks = new Map<string, ChanceDeck>();
/** One deck per scope ("game:<career>" in a match, "review" for dev tools),
 *  mirrored to this device's storage. */
export function chanceDeck(scope: string): ChanceDeck {
  let d = decks.get(scope);
  if (!d) { d = new ChanceDeck(scope, true); decks.set(scope, d); }
  return d;
}

/** A short, stable name for a career's deck: its player (name, nation, the
 *  year the career began), so two careers on one phone deal from their own
 *  decks. Nothing in the save changes. */
export function careerDeckScope(player: { firstName?: string; lastName?: string; nationality?: string; startYear?: number } | null | undefined): string {
  if (!player) return "game";
  const key = `${player.firstName ?? ""} ${player.lastName ?? ""}|${player.nationality ?? ""}|${player.startYear ?? ""}`;
  let h = 5381;
  for (let i = 0; i < key.length; i++) h = ((h * 33) ^ key.charCodeAt(i)) >>> 0;
  return `game:${h.toString(36)}`;
}

// ─────────────────────────────────────────────────────────────────────────
//  "THE SAME PICTURE", PER KIND
// ─────────────────────────────────────────────────────────────────────────

/** The parts of a picture this reads (chanceMaker's Picture has them all). */
interface PictureLike { kind: string; ball: Vec2; you: Vec2; keeper: Vec2; defenders: Vec2[]; mates: Vec2[] }

const near = (P: Vec2[], Q: Vec2[]) => P.map((p) => Math.min(...Q.map((q) => Math.hypot(p.x - q.x, p.y - q.y))));
const meanOf = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
function crowd(A: Vec2[], B: Vec2[]): number {
  const pen = Math.abs(A.length - B.length) * 3;
  if (!A.length || !B.length) return pen;
  return (meanOf(near(A, B)) + meanOf(near(B, A))) / 2 + pen;
}

/**
 * A CORNER IS ITS CROWD. The general "same picture" distance
 * (chanceMaker.pictureGap, 3 m) is mostly the ball, you, the keeper and the
 * camera — at a corner those never move (the ball is on the flag), so every
 * corner ever drawn measures under 3 m from every other and reads as "the
 * same" (measured: 73 corner drawings → 5 "different" pictures). What differs
 * between two corners is where the men in the box stand, so a corner is the
 * same picture when its men stand, on average, within 2 m of where they stood
 * (mirror included, as everywhere).
 */
export const SAME_CROWD_M = 2;
export function crowdGap(p: PictureLike, q: PictureLike): number {
  const m = (v: Vec2): Vec2 => ({ x: 68 - v.x, y: v.y });
  const g = (a: PictureLike) => (crowd(a.defenders, q.defenders) + crowd(a.mates, q.mates)) / 2;
  return Math.min(g(p), g({ ...p, defenders: p.defenders.map(m), mates: p.mates.map(m) }));
}

/** The kinds whose ball never moves from picture to picture. */
const FIXED_BALL_KINDS = new Set(["corner"]);

/** Is `p` the same picture as `q`, by the measure that fits its kind? */
export function samePictureOfKind(
  p: PictureLike, q: PictureLike, pictureGap: (a: PictureLike, b: PictureLike) => number, within: number,
): boolean {
  if (p.kind !== q.kind) return false;
  if (FIXED_BALL_KINDS.has(p.kind)) return crowdGap(p, q) < SAME_CROWD_M;
  return pictureGap(p, q) < within;
}

/** The kind is one the library deals (and the device is on New chances). */
export function libraryServes(kind: ScenarioKind): boolean {
  return libraryFor(kind).length > 0;
}
