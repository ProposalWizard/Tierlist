/**
 * ANIMATIONS — always New. Decided, no toggle (Harry, 12 Oct 2026: "Why do we
 * even need the Old? ... It should not be a toggle in the game.")
 *
 * Every man who touches the ball is seen doing it: a team-mate's shot, pass
 * and touch, a defender's block and clearance, a header jump, and the keeper's
 * catch, parry, one-handed stretch and fumble (lib/star/actionAnim.ts). The
 * Settings → Animations row and the Old path are gone; an old phone's
 * `star-look-animations = "old"` is ignored. The Old code lives in git (see
 * CLAUDE.md → "Decided, no toggle").
 *
 * The type stays because the goal-video cutter (lib/star/goalClip) still takes
 * a "moves" value; it is always "new" now.
 */
export type AnimationsLook = "new" | "old";

/** Read every frame by the match: always "new". */
export const animationsLook = (): AnimationsLook => "new";
/** Hook form, for the goal videos. */
export const useAnimationsLook = (): AnimationsLook => "new";
