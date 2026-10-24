/**
 * REAL MOMENT HIGHLIGHTS — real moments served as the real game's chances
 * (Harry, 20 Oct 2026: "I think we should try the real moments feeding the
 * real game's chances … inside the real highlights toggle, there's another
 * toggle that is real moment highlights").
 *
 * How it works (Settings → Full highlights rebuild: On → Real moment
 * highlights: On, lib/star/fhr/realMomentToggle.ts):
 *
 *   1. The match asks for a chance as always (hiddenMatch → makeChance), and
 *      makeChance decides its kind as always (the radar's lane and weights).
 *   2. For an OPEN-PLAY chance (never a set piece, a dribble or a move carrying
 *      on), if the kind is one the real moments have (REAL_MOMENT_KINDS),
 *      1 in REAL_MOMENT_SHARE_IN of them is a REAL moment of that kind instead
 *      of a drawing: the ball and every man inside the camera where they really
 *      stood, the real keeper held where he stood (serveRealMoment, here,
 *      called by lib/star/chanceMaker.ts).
 *   3. Its build-up is the real 4 s before the shot: everyone runs where he
 *      really ran (trackLeadIn), ending exactly on the chance (realMomentLeadIn,
 *      called by lib/star/leadInGen.ts careerBuildUp). A tap skips it.
 *   4. Then the chance is yours, on the real match, like any other.
 *
 * Which moments: every fully real open-play shot (DFL, SkillCorner,
 * SoccerTrack tracking) that passes `autoCheck`, minus the ones marked
 * "Don't use", plus the ones marked "Use in game" (lib/star/realMoments/picks.ts;
 * marked on the Real moments page). Nothing is served until the moments have
 * loaded (loadRealMomentPool, ~4 MB, only once the switch is On); until then
 * every chance is the game's own.
 *
 * Pure apart from loadRealMomentPool's fetch. Tests: tests/star/realMomentHighlights.mts.
 */
import type { Scenario, ScenarioKind } from "../canvasEngine";
import type { LeadIn, LeadMoment } from "../leadIn";
import { isFullyReal, type RealShot, type RealTrack, type TrackedFile, type TrackFile, type TrackedMoment } from "../realMoments/types";
import { peopleOf, playKindForShot, scenarioForShot, frameHoldsShot, airKindOf } from "../realMoments/shots";
import { trackLeadIn } from "../realMoments/track";
import { inGame, pickOf } from "../realMoments/picks";
import { ensureRealMomentPicks } from "../realMoments/pickStore";
import { CX } from "../pitch";
import { realMomentsOn, realMomentsEvery } from "./realMomentToggle";

// ─────────────────────────────────────────────────────────────────────────
//  THE DIALS
// ─────────────────────────────────────────────────────────────────────────

/**
 * 1 in this many open-play chances of a kind the real moments have is a real moment.
 *
 * 22 Oct 2026 (Harry: "leaning too much towards real highlights when the
 * toggle is on"): 4 -> 6. It shipped (20 Oct) as 1 in 4 of three kinds (one-on-
 * ones, tight angles, long shots), which was about 1 in 10 of ALL open-play
 * chances (measured, 150 matches each, striker and winger, Match flow Old and
 * New: 8.1-9.4% of served chances). The headers round (21 Oct) added headers and
 * volleys to the kinds without moving this dial, and the share went to 12-16%
 * (about 1 in 7). 1 in 6 of five kinds puts it back at about 1 in 10 of all
 * open-play chances. Measure: scripts/star-sandbox/highlights-measure.mts.
 */
export const REAL_MOMENT_SHARE_IN = 6;
export const REAL_MOMENT_SHARE = 1 / REAL_MOMENT_SHARE_IN;
/** About 1 in this many of ALL open-play chances is a real moment (what the screens say; measured, not a dial). */
export const REAL_MOMENT_OF_ALL_IN = 10;

/**
 * The kinds a real moment can stand in for (the kind the match asked for must
 * be one of these). A real header is served for a header chance and a real
 * volley for a volley chance (headers piece 1, 21 Oct 2026: realMoments/shots.ts
 * airKindOf, from the ball's real height). Set pieces are never served.
 */
export const REAL_MOMENT_KINDS: readonly ScenarioKind[] = ["one_on_one", "tight_angle", "long_range", "header", "volley"];

/** Real shots struck from further out than this (metres from the middle of the goal) are left out: 8 of 688 open-play shots, speculative punts. */
export const REAL_MOMENT_MAX_M = 35;

/** A moment served in the last this-many real moments is not served again. */
export const REAL_MOMENT_MEMORY = 40;

// ─────────────────────────────────────────────────────────────────────────
//  THE AUTOMATIC CHECKS
// ─────────────────────────────────────────────────────────────────────────

/** The kind a real moment plays as in the game, or null when it can't be served at all. */
export function servedKindOf(m: TrackedMoment): ScenarioKind | null {
  if (m.what !== "shot" || !isFullyReal(m)) return null;
  // A foot shot above the waist or a ball above 2.6 m (a scissor or bicycle
  // kick): served as a header chance with the BICYCLE button always on
  // (realMoments/shots.ts kindForShot; bicycle.ts, 22 Oct 2026).
  const k = playKindForShot(m);
  return REAL_MOMENT_KINDS.includes(k) ? k : null;
}

/**
 * Why a fully real shot is left out automatically, or null when it passes.
 * The same checks tests/star/realMoments.mts holds the data to: an open-play
 * shot from within REAL_MOMENT_MAX_M of goal, their keeper by his goal, all 22 on the pitch,
 * a whole 4 s track, and a picture that holds everyone near the ball and the
 * whole goal.
 */
export function autoCheck(m: TrackedMoment, track: RealTrack | undefined): string | null {
  if (m.what !== "shot") return "a corner (only shots are served)";
  if (!isFullyReal(m)) return "not fully real";
  if (m.type !== "Open Play") return `a ${m.type.toLowerCase()} (open play only)`;
  if (!servedKindOf(m)) return "not a kind the game serves";
  if (Math.hypot(m.ball[0] - CX, m.ball[1]) > REAL_MOMENT_MAX_M) return `struck from more than ${REAL_MOMENT_MAX_M} m out`;
  const k = peopleOf(m).keeper;
  if (!k || k.y >= 12 || Math.abs(k.x - CX) >= 15) return "their keeper is not by his goal";
  if ((m.ff?.length ?? 0) < 19) return "not all 22 on the pitch";
  if (!track) return "no build-up";
  if (track.ball.length / 3 < 21 || track.men.length < 15) return "the build-up is not whole";
  return null;
}

// ─────────────────────────────────────────────────────────────────────────
//  THE POOL
// ─────────────────────────────────────────────────────────────────────────

export interface RealMomentPool {
  /** Every fully real shot that can be served at all (any pick), by the kind it plays as. */
  byKind: Map<ScenarioKind, RealShot[]>;
  tracks: Record<string, RealTrack>;
  /** Per id: why it is left out automatically (null = it passes). */
  check: Map<string, string | null>;
}

export function buildRealMomentPool(tracked: TrackedFile, tracks: TrackFile): RealMomentPool {
  const byKind = new Map<ScenarioKind, RealShot[]>();
  const check = new Map<string, string | null>();
  for (const m of tracked.moments) {
    const tr = tracks.tracks[m.id];
    check.set(m.id, autoCheck(m, tr));
    const k = servedKindOf(m);
    if (!k || !tr) continue;
    const list = byKind.get(k) ?? [];
    list.push(m as RealShot);
    byKind.set(k, list);
  }
  return { byKind, tracks: tracks.tracks, check };
}

/** The moments of a kind the game may serve now (checks + picks). */
export function servable(pool: RealMomentPool, kind: ScenarioKind): RealShot[] {
  return (pool.byKind.get(kind) ?? []).filter((m) => inGame(m.id, pool.check.get(m.id) === null));
}

/** Every moment in the game now, as ids (the Real moments page's count). */
export function inGameIds(pool: RealMomentPool): Set<string> {
  const out = new Set<string>();
  for (const k of REAL_MOMENT_KINDS) for (const m of servable(pool, k)) out.add(m.id);
  return out;
}

// The pool for this page load (one per tab; tests set it directly). On
// globalThis so the two copies tsx can load share it.
const POOL_KEY = "__starRealMomentPool";
const LOADING_KEY = "__starRealMomentPoolLoading";
const g = globalThis as Record<string, unknown>;
export const realMomentPool = (): RealMomentPool | null => (g[POOL_KEY] as RealMomentPool | null) ?? null;
export function setRealMomentPool(p: RealMomentPool | null) { g[POOL_KEY] = p; }

/**
 * Load the moments (browser): the fully real file, its tracks and the saved
 * picks. Once per page load; safe to call often. Resolves to the pool, or null
 * when the files can't be read (then nothing is served, and the game is as before).
 */
export function loadRealMomentPool(): Promise<RealMomentPool | null> {
  const have = realMomentPool();
  if (have) return Promise.resolve(have);
  if (typeof window === "undefined" || typeof fetch === "undefined") return Promise.resolve(null);
  const busy = g[LOADING_KEY] as Promise<RealMomentPool | null> | undefined;
  if (busy) return busy;
  const get = <T,>(file: string) => fetch(`/api/star/real-moments?file=${file}`).then((r) => (r.ok ? (r.json() as Promise<T>) : Promise.reject(new Error(String(r.status)))));
  const p = Promise.all([
    get<TrackedFile>("tracked"),
    get<TrackFile>("tracks"),
    ensureRealMomentPicks().catch(() => null),
  ])
    .then(([t, tr]) => { const pool = buildRealMomentPool(t, tr); setRealMomentPool(pool); return pool; })
    .catch(() => { g[LOADING_KEY] = undefined; return null; });
  g[LOADING_KEY] = p;
  return p;
}

// ─────────────────────────────────────────────────────────────────────────
//  SERVING ONE
// ─────────────────────────────────────────────────────────────────────────

/** Which real moment a served chance is (the chance object itself is the key). On globalThis like the pool. */
if (!g.__starRealMomentServed) g.__starRealMomentServed = new WeakMap<Scenario, string>();
const SERVED = g.__starRealMomentServed as WeakMap<Scenario, string>;
export const realMomentIdOf = (sc: Scenario): string | undefined => SERVED.get(sc);

const RECENT_KEY = "__starRealMomentRecent";
function recent(): string[] { return ((g[RECENT_KEY] as string[] | undefined) ??= []); }
/** Tests: forget what was served. */
export function resetRealMomentMemory() { g[RECENT_KEY] = []; }

export interface ServedRealMoment { sc: Scenario; id: string; moment: RealShot }

/**
 * Maybe serve a real moment for an open-play chance of `kind` (makeChance
 * calls this once the kind is decided). Null: the game's own chance, as before.
 * Draws from `rng` only when the switch is On, the moments are loaded and the
 * kind has some, so with the switch Off nothing about the match changes.
 */
export function serveRealMoment(kind: ScenarioKind, rng: () => number, opts: { force?: boolean } = {}): ServedRealMoment | null {
  if (!opts.force && !realMomentsOn()) return null;
  const pool = realMomentPool();
  if (!pool) {
    // First chance with the switch On: start loading; this chance is the game's own.
    void loadRealMomentPool();
    return null;
  }
  const all = servable(pool, kind);
  if (!all.length) return null;
  if (!opts.force && rng() >= (realMomentsEvery() ? 1 : REAL_MOMENT_SHARE)) return null;
  const seen = new Set(recent());
  const fresh = all.filter((m) => !seen.has(m.id));
  const from = fresh.length ? fresh : all;
  // A few tries: a moment whose picture can't hold everyone near the ball and
  // the whole goal (the page's own check, frameHoldsShot) is skipped.
  for (let t = 0; t < 4; t++) {
    const m = from[Math.floor(rng() * from.length) % from.length];
    const sc = scenarioForShot(m, { wideFrame: true });
    if (!frameHoldsShot(m, sc.viewport) && t < 3) continue;
    SERVED.set(sc, m.id);
    // For the test drivers (scripts/realmoments/match-stills.mjs): which real moment was served last.
    g.__starLastRealMoment = { id: m.id, kind, src: m.src, at: Date.now() };
    const r = recent();
    r.push(m.id);
    if (r.length > REAL_MOMENT_MEMORY) r.splice(0, r.length - REAL_MOMENT_MEMORY);
    return { sc, id: m.id, moment: m };
  }
  return null;
}

/**
 * The real build-up for a served real moment: the real 4 s before the shot,
 * ending exactly on the chance (track.ts trackLeadIn), skippable like the
 * career's build-ups. Null for any other chance, and for a chance that is not
 * fresh (a set piece, a move carrying on).
 */
export function realMomentLeadIn(sc: Scenario, moment?: LeadMoment): LeadIn | null {
  if (moment && (moment.opening || !moment.fresh)) return null;
  const id = SERVED.get(sc);
  if (!id) return null;
  const tr = realMomentPool()?.tracks[id];
  if (!tr) return null;
  const lead = trackLeadIn(tr, sc);
  return { ...lastSecondsOf(lead, REAL_MOMENT_LEAD_S), skippable: true };
}

/**
 * How much of a real moment's build-up plays (seconds): its last few, ending on
 * the chance. 22 Oct 2026 (Harry: "buildups are still too slow"): the whole real
 * window was ~4 s; now the same last 3 s every generated build-up plays
 * (builders.ts FHR_SNAPPY_S).
 */
export const REAL_MOMENT_LEAD_S = 3;

/**
 * The same lead-in, shown only from `durS − capS`, at normal speed: it ends on
 * the very same frame. `keepFrom`: start no later than this (a foul stays in view). A start inside a pass moves back to just before its kick
 * (never more than 1.2 s longer), else forward to its arrival, so it never opens
 * on a ball in the air.
 */
export function lastSecondsOf<L extends LeadIn>(lead: L, capS: number, o: { keepFrom?: number } = {}): L {
  if (!(lead.durS > capS + 0.05)) return lead;
  const ps = lead.passStart ?? [], pe = lead.passEnd ?? [];
  let s = lead.durS - capS;
  if (o.keepFrom !== undefined) s = Math.min(s, o.keepFrom);
  else for (let i = 0; i < ps.length; i++) {
    if (s > ps[i] && s < pe[i]) { const back = Math.max(0, ps[i] - 0.2); s = s - back <= 1.2 ? back : pe[i]; break; }
  }
  if (s <= 0.05 || s >= lead.durS - 1) return lead;
  const dur = lead.durS - s;
  const T = (t: number) => (t >= dur - 1e-9 ? lead.durS + Math.max(0, t - dur) : t + s);
  const keep = pe.map((e) => e > s);
  const out: L = {
    ...lead,
    durS: dur,
    ballAt: (t: number) => lead.ballAt(T(t)),
    posAt: (key: string, t: number) => lead.posAt(key, T(t)),
    passStart: ps.filter((_, i) => keep[i]).map((t) => Math.max(0, t - s)),
    passEnd: pe.filter((_, i) => keep[i]).map((t) => t - s),
  };
  if (lead.captionAt) out.captionAt = (t: number) => lead.captionAt!(T(t));
  if (lead.onTick) out.onTick = (t: number, done: boolean) => lead.onTick!(T(t), done);
  if (lead.whistleAt !== undefined) out.whistleAt = Math.max(0, lead.whistleAt - s);
  return out;
}

/** Where a moment stands for the game: its pick, the automatic check, and whether it is in. */
export function gameStatus(pool: RealMomentPool, id: string): { pick: ReturnType<typeof pickOf>; check: string | null | undefined; inGame: boolean; servable: boolean } {
  const check = pool.check.get(id);
  let isServable = false;
  for (const list of Array.from(pool.byKind.values())) if (list.some((m) => m.id === id)) { isServable = true; break; }
  return { pick: pickOf(id), check, inGame: isServable && inGame(id, check === null), servable: isServable };
}
