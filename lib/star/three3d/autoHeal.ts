/**
 * 3D THAT HEALS ITSELF (Harry, 27 Nov 2026: "it just shows like a frozen screen … we should never
 * have a feature where we have to press tap to reload. If it's a bug or one-offs, then fine, but it
 * shouldn't be a consistent thing").
 *
 * The phone can take a 3D picture away at any time (Android and iOS do it when the graphics memory
 * runs short: the WebGL context is "lost"). The canvas then stays on the page but draws nothing
 * more: a frozen picture, or Chrome's grey sad-face box. Every 3D place now rebuilds itself on a
 * fresh context, without a word, up to AUTO_REBUILDS times in a short while; only after that does
 * it show its fallback ("Tap to reload 3D", the drawn garden, the old figure).
 *
 * Pure (no three.js, no DOM), so tests/star/recover3d.mts can check the rule.
 */

/** Silent rebuilds a place makes before it gives up and shows its fallback. */
export const AUTO_REBUILDS = 2;
/** Losses further apart than this are one-offs: the count starts again (a phone that keeps losing
 *  the 3D stops trying; one that lost it once an hour ago still heals). */
export const HEAL_WINDOW_MS = 60_000;
/** The wait before a rebuild: lets the browser give the context back by itself first. */
export const HEAL_DELAY_MS = 1200;

export interface HealState { times: number[] }

export function newHealState(): HealState { return { times: [] }; }

/**
 * The 3D was lost (or failed to build) at `now`. "rebuild": try again silently (the state counts it);
 * "give-up": the fallback, with its tap to reload.
 */
export function afterLoss(s: HealState, now: number): "rebuild" | "give-up" {
  s.times = s.times.filter((t) => now - t < HEAL_WINDOW_MS);
  if (s.times.length >= AUTO_REBUILDS) return "give-up";
  s.times.push(now);
  return "rebuild";
}

/** The player tapped "Tap to reload 3D": a fresh start, the count forgotten. */
export function healReset(s: HealState): void { s.times = []; }
