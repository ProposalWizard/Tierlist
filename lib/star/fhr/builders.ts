/**
 * WHICH BUILD-UP A CHANCE GETS when Full highlights rebuild is On — one place,
 * for the career match and the test areas alike.
 *
 *   · a fresh open-play chance → the generated build-up (buildUp.ts): the
 *     moves before it, players still running at the hand-over (phase 3), a
 *     covering defender in from off the screen when the defence is thin
 *     (FHR-3), its length from how big the moment is;
 *   · a fresh free kick or penalty → on FOUL_SHARE of them, the foul that won
 *     it (foulBuildUp.ts, FHR-4);
 *   · anything else (a corner, a move carrying on) → none.
 *
 * THE TEST AREAS (Harry, 20 Oct 2026: "Infinite Highlights and Infinite Match
 * … the same way the career match does, automatic and natural … maybe we can
 * adjust it"): `testAreaBuildUp` is the same builder with the test pages'
 * adjust (moment / length / intensity, stored on this phone only, never read
 * by the career). Infinite Highlights plays one picture (`openOn`), which the
 * match marks as an opening chance with no radar moment: it is played as a
 * fresh chance, its lane from where the ball is, settled play or a break from
 * the chance's own seed.
 *
 * Generated build-ups are a LAYER on the chance, never written into it:
 * every one ends exactly on the drawing, and the scenario gallery's saved
 * scenarios are only ever read (tests/star/fhr.mts pins both).
 */
import type { Scenario, ScenarioKind } from "../canvasEngine";
import type { LeadIn, LeadMoment } from "../leadIn";
import { fhrOn } from "./toggle";
import { fhrBuildUpFor, fhrWantsBuildUp, chanceSeed, FHR_ADJUST_AUTO, type FhrAdjust, type FhrBuildUp } from "./buildUp";
import { fhrFoulBuildUpFor, fhrWantsFoul } from "./foulBuildUp";
import { realMomentLeadIn, lastSecondsOf } from "./realMomentHighlights";
import { CX } from "../pitch";

// ─────────────────────────────────────────────────────────────────────────
//  B20: SNAPPY BUILD-UPS (A1) and FEWER OF THEM (A2)
// ─────────────────────────────────────────────────────────────────────────
//
// Harry, 21 Oct 2026: A1 (only the last part plays, always ending exactly on
// the drawn chance, tap to skip stays) and A2 (fewer chances get one), "but
// closer to 20-25 secs a match on average" (they were 33 s a match: 92% of
// chances, 6.5 s each). The move is still made whole (so every check it
// passes still holds and it still ends on the drawing); the match is shown
// only its last FHR_SNAPPY_S (longer at a big moment). Measured with the
// generator over ~220 matches: see docs/handoffs/2026-10-20-builds/b20/READY.txt.

/**
 * The most of a build-up that plays, seconds (an ordinary moment).
 * 22 Oct 2026 (Harry: "buildups are still too slow"): 5 -> 3, the big moment
 * 6.5 -> 4. Measured over 150 matches a setting: 4.9 s each and 22-26 s a
 * match before; ~3 s each and ~15 s a match after (scripts/star-sandbox/
 * highlights-measure.mts). Still made whole and cut, so it still ends on
 * exactly the drawn chance.
 */
export const FHR_SNAPPY_S = 3;
/** …at the biggest moment (drama 1: a level final, the 90th minute). */
export const FHR_SNAPPY_BIG_S = 4;
/** A foul's build-up starts this long before the foul (s). */
export const FHR_FOUL_LEAD_S = 1.2;
/** The shortest a cut build-up may be when its start moves forward off a pass in the air (s). */
export const FHR_SNAPPY_MIN_S = 2.4;
/** A move that ends in a called offside: the offside pass starts at least this long after the build-up does. */
export const FHR_SNAPPY_OFFSIDE_LEAD_S = 1.2;
/**
 * A2: the share of each kind's fresh chances that get a build-up. Kinds a
 * move explains (a one-on-one, a cutback, a cross, a through ball) always do;
 * a shot from distance or a tight angle often arrives cold, as with the
 * switch Off. Absent: 1.
 */
export const FHR_BUILDUP_SHARE: Partial<Record<ScenarioKind, number>> = {
  long_range: 0.6,
  tight_angle: 0.75,
};

/** A2: whether this fresh chance gets its build-up (the same answer every time it is served). */
export function fhrShareRoll(sc: Scenario, moment: LeadMoment): boolean {
  const share = FHR_BUILDUP_SHARE[sc.kind] ?? 1;
  if (share >= 1) return true;
  const u = (((chanceSeed(sc, moment.seed) ^ 0x2b2a) >>> 0) * 2654435761 >>> 0) / 4294967296;
  return u < share;
}

/** How much of a build-up plays at this moment (A1). */
export function snappyCapS(drama: number): number {
  const d = Math.max(0, Math.min(1, drama || 0));
  return FHR_SNAPPY_S + (FHR_SNAPPY_BIG_S - FHR_SNAPPY_S) * d;
}

/**
 * A1: the same build-up, shown only from `durS − cap` (normal speed). It ends
 * on the very same frame (the drawing). A start that falls in the middle of a
 * pass moves to the nearer of that pass's kick or its arrival, so it never
 * opens on a ball in the air. A called offside keeps its offside pass in view.
 */
export function snappyBuildUp(b: FhrBuildUp, capS: number): FhrBuildUp {
  if (b.durS <= capS + 0.05) return b;
  const ps = b.passStart ?? [], pe = b.passEnd ?? [];
  let s = b.durS - capS;
  for (let i = 0; i < ps.length; i++) {
    if (s > ps[i] && s < pe[i]) {
      const back = Math.max(0, ps[i] - 0.3), fwd = pe[i] - 0.15;
      // Forward only if it still leaves a build-up of FHR_SNAPPY_MIN_S (never a stub).
      s = s - back <= fwd - s || fwd > b.durS - FHR_SNAPPY_MIN_S ? back : fwd;
      break;
    }
  }
  if (b.offside) {
    const p0 = ps[b.offside.pass] ?? b.offside.at;
    s = Math.min(s, Math.max(0, p0 - FHR_SNAPPY_OFFSIDE_LEAD_S));
  }
  if (s <= 0.05) return b;
  // The passes still to come (or in the air) when it starts.
  let first = pe.findIndex((e) => e > s);
  if (first < 0) first = ps.length;
  const sh = (t: number) => t - s;
  const dur = b.durS - s;
  // The whole move's time for t. At and after the end it is pinned to the whole
  // move's own end (t + s can land a hair under b.durS, on the far side of the
  // last sample, and a man would stop 10 cm off his drawn spot).
  const T = (t: number) => (t >= dur - 1e-9 ? b.durS + Math.max(0, t - dur) : t + s);
  const out: FhrBuildUp = {
    ...b,
    durS: dur,
    ballAt: (t) => b.ballAt(T(t)),
    posAt: (key, t) => b.posAt(key, T(t)),
    passStart: ps.slice(first).map((t) => Math.max(0, sh(t))),
    passEnd: pe.slice(first).map(sh),
    acts: b.acts.slice(first).map((a) => ({ ...a, t0: Math.max(0, sh(a.t0)), t1: sh(a.t1) })),
    actOwners: b.actOwners.slice(first),
    passChecks: b.passChecks.filter((c) => c.pass >= first).map((c) => ({ ...c, pass: c.pass - first })),
    regain: b.regain && b.regain.at >= s ? { ...b.regain, at: sh(b.regain.at) } : null,
    cover: b.cover ? { ...b.cover, enterS: Math.max(0, sh(b.cover.enterS)) } : null,
    trimmedS: s,
  };
  if (b.captionAt) out.captionAt = (t) => b.captionAt!(T(t));
  if (b.onTick) out.onTick = (t, done) => b.onTick!(T(t), done);
  if (b.whistleAt !== undefined) out.whistleAt = sh(b.whistleAt);
  if (b.offside) out.offside = { ...b.offside, at: sh(b.offside.at), pass: b.offside.pass - first };
  return out;
}

/** The On path: what a chance gets before it. Null: none (the chance as before). */
export function fhrBuildUpOn(sc: Scenario, moment: LeadMoment, adjust?: FhrAdjust, o: { everyChance?: boolean } = {}): LeadIn | null {
  let lead: LeadIn | null = null;
  if (fhrWantsBuildUp(sc.kind, moment)) {
    if (!o.everyChance && !fhrShareRoll(sc, moment)) return null;
    const whole = fhrBuildUpFor(sc, moment, adjust);
    // A test page asking for a long build-up sees the whole move.
    const b = adjust?.length === "long" ? whole : snappyBuildUp(whole, snappyCapS(whole.drama));
    const la = b.acts[b.acts.length - 1];
    note({ kind: sc.kind, what: "open", cover: !!b.cover, drama: b.drama, durS: b.durS, runOnS: b.runOnS ?? 0, offside: !!b.offside, regain: !!b.regain, last: { t0: la.t0, t1: la.t1, endZ: la.endZ ?? 0 } });
    lead = b;
  } else if (fhrWantsFoul(sc, moment)) {
    const whole = fhrFoulBuildUpFor(sc, moment);
    // 22 Oct 2026 ("buildups are still too slow"): a foul's build-up plays from
    // FHR_FOUL_LEAD_S before the foul (it was the whole move, ~6 s).
    const b = whole && adjust?.length !== "long"
      ? lastSecondsOf(whole, FHR_SNAPPY_S, { keepFrom: Math.max(0, (whole.whistleAt ?? 0) - FHR_FOUL_LEAD_S) })
      : whole;
    if (b) note({ kind: sc.kind, what: "foul", cover: false, drama: 0, durS: b.durS, runOnS: 0 });
    lead = b;
  }
  return lead;
}

/** For the test drivers (scripts/fhr/b2-stills.mjs): what the last build-up was. Read-only, never stored. */
function note(v: { kind: ScenarioKind; what: "open" | "foul"; cover: boolean; drama: number; durS: number; runOnS: number; offside?: boolean; regain?: boolean; last?: { t0: number; t1: number; endZ: number } }) {
  (globalThis as Record<string, unknown>).__starLastBuildUp = { ...v, at: Date.now() };
}

// ─────────────────────────────────────────────────────────────────────────
//  The test areas' adjust (this phone only; the career never reads it)
// ─────────────────────────────────────────────────────────────────────────

export const FHR_ADJUST_KEY = "star-fhr-adjust";

export function loadFhrAdjust(): Required<FhrAdjust> {
  try {
    const raw = typeof localStorage === "undefined" ? null : localStorage.getItem(FHR_ADJUST_KEY);
    const v = raw ? (JSON.parse(raw) as FhrAdjust) : {};
    return {
      moment: v.moment === "normal" || v.moment === "big" ? v.moment : "auto",
      length: v.length === "short" || v.length === "long" ? v.length : "auto",
      intensity: v.intensity === "calm" || v.intensity === "high" ? v.intensity : "auto",
    };
  } catch { return { ...FHR_ADJUST_AUTO }; }
}

export function saveFhrAdjust(a: Required<FhrAdjust>) {
  try { localStorage.setItem(FHR_ADJUST_KEY, JSON.stringify(a)); } catch { /* this phone only; in-memory still applies */ }
}

/** Kinds a one-picture screen plays as a break more often than as settled play. */
const BREAK_KINDS: ReadonlySet<ScenarioKind> = new Set<ScenarioKind>(["one_on_one", "through_ball"]);

/** One picture (Infinite Highlights' Play) as the match would hand it: a fresh chance with a radar moment of its own. */
export function openingAsFresh(sc: Scenario, m: LeadMoment): LeadMoment {
  const s = chanceSeed(sc, m.seed);
  const u = ((s ^ 0x7a11) >>> 0) / 4294967296;
  const setPiece = sc.kind === "penalty" || sc.kind === "free_kick" || sc.kind === "corner";
  const lane = sc.ball.x < CX - 11 ? "left" : sc.ball.x > CX + 11 ? "right" : "centre";
  return {
    ...m,
    opening: false,
    fresh: true,
    lane,
    pattern: setPiece ? "set_piece" : u < (BREAK_KINDS.has(sc.kind) ? 0.55 : 0.25) ? "transition" : "settled",
  };
}

/**
 * The test areas' builder (EnginePlay's `leadIn`): exactly the career's when
 * the switch is On, with the page's adjust; nothing when it is Off, so a test
 * area with the switch Off plays exactly as before.
 */
export function testAreaBuildUp(adjust: () => FhrAdjust) {
  return (sc: Scenario, moment?: LeadMoment): LeadIn | null => {
    if (!fhrOn() || !moment) return null;
    const m = moment.opening ? openingAsFresh(sc, moment) : moment;
    if (!moment.opening) {
      const real = realMomentLeadIn(sc, m);
      if (real) return real;
    }
    // Infinite Highlights' one picture (Play): always a build-up (A2 is the match's mix, not the test's).
    return fhrBuildUpOn(sc, m, adjust(), { everyChance: moment.opening });
  };
}
