/**
 * What a relationship minigame (components/star/RelationshipMinigame.tsx) is
 * worth — Boss Meeting, Team Bonding, Meet the Fans, Sponsor Event and Take a
 * Break all use the same memory game, so they share this one scale.
 *
 * Harry, 1 Oct 2026 (P34, 11:20): "even if you get nothing for it you get a
 * plus four for trying. No ... that should be like minus eight, because you
 * tried to go up but you've actually pissed him off ... keep it like plus one
 * max or plus two. And the higher up you go, the harder it is."
 *
 * Before: lose +4, win 12 + 2 × lives left (+14 to +18).
 * Then:   lose −8; win +2 below 60, +1 from 60 to 85, and above 85 only one
 *         win in two moves it at all (+1).
 * v0.23:  lose −4; wins unchanged.
 * v0.23.1: the BOSS meeting is flat +3 for a win and −2 for a loss (Harry and
 *         Mikey, P41: "plus three and then minus two if you lose") — it is a
 *         shortcut, not playing, so it should not be a way to get into the
 *         manager's good books. The other four games keep the scale above.
 */

/** Harry, 1 Oct 2026 (P69, P98): "minus eight is too much when you fail here.
 *  Maybe like a minus four." */
export const GAME_LOSS = -4;
/** Below this a win is +2. */
export const GAME_EASY_BELOW = 60;
/** From GAME_EASY_BELOW up to this a win is +1; above it, +1 only sometimes. */
export const GAME_HARD_ABOVE = 85;
/** Above GAME_HARD_ABOVE, the chance a win moves it at all. */
export const GAME_TOP_CHANCE = 0.5;

/** The boss meeting: +3 for a win, −2 for a loss, at any rating. */
export const BOSS_WIN = 3;
export const BOSS_LOSS = -2;

/** The change a finished game makes. `roll` is a 0-1 random number (pass
 *  Math.random() in the game; a fixed number in tests). `kind` is which of the
 *  five games it was ("boss" has its own flat numbers). */
export function relationshipGameGain(won: boolean, current: number, roll: number = Math.random(), kind?: string): number {
  if (kind === "boss") return won ? BOSS_WIN : BOSS_LOSS;
  if (!won) return GAME_LOSS;
  if (current < GAME_EASY_BELOW) return 2;
  if (current <= GAME_HARD_ABOVE) return 1;
  return roll < GAME_TOP_CHANCE ? 1 : 0;
}

/** The new value, kept between 0 and 100. */
export function applyGameGain(current: number, gain: number): number {
  return Math.max(0, Math.min(100, current + gain));
}
