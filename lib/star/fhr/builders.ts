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
import { fhrBuildUpFor, fhrWantsBuildUp, chanceSeed, FHR_ADJUST_AUTO, type FhrAdjust } from "./buildUp";
import { fhrFoulBuildUpFor, fhrWantsFoul } from "./foulBuildUp";
import { realMomentLeadIn } from "./realMomentHighlights";
import { CX } from "../pitch";

/** The On path: what a chance gets before it. Null: none (the chance as before). */
export function fhrBuildUpOn(sc: Scenario, moment: LeadMoment, adjust?: FhrAdjust): LeadIn | null {
  let lead: LeadIn | null = null;
  if (fhrWantsBuildUp(sc.kind, moment)) {
    const b = fhrBuildUpFor(sc, moment, adjust);
    note({ kind: sc.kind, what: "open", cover: !!b.cover, drama: b.drama, durS: b.durS, runOnS: b.runOnS ?? 0 });
    lead = b;
  } else if (fhrWantsFoul(sc, moment)) {
    const b = fhrFoulBuildUpFor(sc, moment);
    if (b) note({ kind: sc.kind, what: "foul", cover: false, drama: 0, durS: b.durS, runOnS: 0 });
    lead = b;
  }
  return lead;
}

/** For the test drivers (scripts/fhr/b2-stills.mjs): what the last build-up was. Read-only, never stored. */
function note(v: { kind: ScenarioKind; what: "open" | "foul"; cover: boolean; drama: number; durS: number; runOnS: number }) {
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
    return fhrBuildUpOn(sc, m, adjust());
  };
}
