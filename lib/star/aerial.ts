/**
 * AERIAL & ACROBATICS — the sixth skill (Harry, Q7, 21 Oct 2026: "create a
 * new aerial and acrobatics skill"; Q10: "trained … through training in the
 * training area").
 *
 * What it governs (research doc 2026-10-21-headers-volleys-acrobatics.md §3,
 * with Harry's answer replacing "Power for headers, Technique for volleys"
 * by one skill for both):
 *  - how much a mis-hit header or volley is forgiven (airborneChance.ts
 *    airContactRead: the same softening Technique gave, now read off Aerial);
 *  - a header's pace (×0.8 at 30, ×1 at 60, ×1.2 at 90) and a clean
 *    volley's (×0.9, ×1, ×1.1).
 * Pinned at 60: Aerial 60 plays exactly as today's header and volley.
 * Measured (scripts/aerial/measure.mts, 1,000 a cell, B10's method, the
 * bot's hand held at B10's "average"): goals per 100 at Aerial 30/60/90 —
 * headers 20.8 / 25.4 / 31.4 (today, by Power+Technique: 21.2 / 25.4 / 32.5),
 * volleys 25.0 / 28.3 / 31.8 (today: 23.8 / 28.3 / 26.3).
 * The strike itself is still launched with Power and Technique, as every
 * shot is; Aerial sits on top.
 *
 * NOT YET LIVE IN A MATCH: the match hands the strike its skills in
 * components/star/CanvasMatch.tsx (a guarded file). Until that file passes
 * `aerial` onto the strike (see the hand-back report), a header or volley in
 * the match reads Technique as before — airContactRead falls back to `tech`
 * when `aerial` is absent, so nothing changes until then.
 *
 * Pure: no React.
 */

/** Where a brand-new career starts (tuning.ts startingSkills.aerial). */
export const AERIAL_START = 40;

/**
 * An old save's Aerial, from the skills it already has: a header is mostly
 * the jump (Power), a volley mostly clean contact (Technique). Never below
 * where a new career starts, never above 100. The same number every time,
 * so the save guard reads the same value off the same save.
 */
export function aerialFromOld(skills: { power?: unknown; technique?: unknown }): number {
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : AERIAL_START);
  const v = Math.round(0.6 * n(skills.power) + 0.4 * n(skills.technique));
  return Math.max(AERIAL_START, Math.min(100, v));
}

/** This career's Aerial: the saved one, or the old-save start. */
export function aerialOf(skills: { power?: unknown; technique?: unknown; aerial?: unknown }): number {
  return typeof skills.aerial === "number" && Number.isFinite(skills.aerial) ? skills.aerial : aerialFromOld(skills);
}

/** Pace change per Aerial point away from 60 (header, volley). */
export const AERIAL_HEADER_PACE_PER_PT = 1 / 150;
export const AERIAL_VOLLEY_PACE_PER_PT = 1 / 300;

/**
 * A header's pace by Aerial, pinned at 60 (×1 = today's header), a straight
 * line held inside 0.75-1.25. Absent = ×1.
 */
export function aerialHeaderPace(aerial: number | undefined): number {
  if (aerial === undefined || !Number.isFinite(aerial)) return 1;
  return Math.max(0.75, Math.min(1.25, 1 + (aerial - 60) * AERIAL_HEADER_PACE_PER_PT));
}

/** A clean volley's pace by Aerial, pinned at 60, held inside 0.85-1.15. Absent = ×1. */
export function aerialVolleyPace(aerial: number | undefined): number {
  if (aerial === undefined || !Number.isFinite(aerial)) return 1;
  return Math.max(0.85, Math.min(1.15, 1 + (aerial - 60) * AERIAL_VOLLEY_PACE_PER_PT));
}
