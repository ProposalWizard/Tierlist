/**
 * THE HALF-PITCH SQUEEZE.
 *
 * Shared by VersusScreen.tsx (drawing it) and tests/star/formationSpacing.mts
 * (checking it does not overlap) — pulled out into its own module so both
 * read the exact same numbers rather than a test copying constants that
 * could silently drift from what actually renders.
 *
 * A formation's own y runs from a striker at NEAR to a goalkeeper at FAR.
 * Mapping that straight onto [0.5, 1] puts both sides' forward lines exactly
 * on the halfway line, on top of each other — so each half is inset from the
 * halfway line (HALFWAY_INSET) and from its own goal line (GOAL_INSET),
 * squeezing eleven rows of players into less than half the pitch box's
 * height. See formations.ts and formationSpacing.mts for what that squeeze
 * costs in real pixels, and why the bands there are shaped the way they are.
 */

export const NEAR = 0.17;
export const FAR = 0.94;
export const HALFWAY_INSET = 0.045;
export const GOAL_INSET = 0.07;

/** Where a man stands, once his half has been squeezed to half a pitch. */
export function place(y: number, bottom: boolean): number {
  const t = (y - NEAR) / (FAR - NEAR);          // 0 at the striker, 1 at the keeper
  const near = 0.5 + HALFWAY_INSET;             // the forward line, in its own half
  const far = 1 - GOAL_INSET;                   // the goalkeeper
  const at = near + t * (far - near);
  return bottom ? at : 1 - at;
}

/** …and the same for the other axis — see VersusScreen.tsx's own note on why
 *  only the bottom side needs it flipped. */
export function across(x: number, bottom: boolean): number {
  return bottom ? x : 1 - x;
}
