/**
 * WHICH OF LEO'S 24 OCT MEDIA CHANGES ARE ON (lib/star/leoUpdate.ts).
 *
 * The media pass is pure and runs deep (accounts, detectors, graphics), so the
 * game sets these from the switch at the call site (app/star-dev/page.tsx,
 * on load and whenever the switch changes) instead of passing an option
 * through every function. Both default to ON so the media tests see the new
 * behaviour unchanged; in the browser they start from the switch (off), and
 * then the media pass is exactly as on main.
 *   labelFixes   cup/league accounts post only about their own competition;
 *                "Europe" table stories only in the top flight; the trophy
 *                card's fallback names your division (part "bugFixes").
 *   goalOfMonth  the monthly poll, its votes and winner posts (part "goalOfMonth").
 */
import { leoUpdateOn } from "@/lib/star/leoUpdate";

// In the browser they start from the switch itself (off for every player until
// an admin turns it on), so nothing can run the new path before the page syncs.
// With no browser (the tests) they start ON, as before.
let flags = typeof window === "undefined"
  ? { labelFixes: true, goalOfMonth: true }
  : { labelFixes: leoUpdateOn("bugFixes"), goalOfMonth: leoUpdateOn("goalOfMonth") };

export function setMediaUpdate(f: Partial<typeof flags>): void { flags = { ...flags, ...f }; }
export const labelFixesOn = (): boolean => flags.labelFixes;
export const goalOfMonthOn = (): boolean => flags.goalOfMonth;
