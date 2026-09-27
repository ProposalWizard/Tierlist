/**
 * SHOT POWER — THE TOP IS FLATTENED (v0.15, item 11b).
 *
 * Harry: "At 99 power in the normal game, shots are too strong." Measured
 * (full pull, struck through the middle): the ball leaves the boot at 79 km/h
 * at power 40, 91 at 60, 102 at 80 and 113 at 99, and from the spot a 99 shot
 * reaches the keeper's line in about 0.37 s — a keeper diving at 5.4 m/s
 * covers about 2 m in that time, so the corners are close to unsaveable.
 *
 * The plan he approved: power keeps climbing to about 80, then much more
 * slowly. Below the knee nothing changes at all; above it each point of power
 * buys a tenth of what it used to, so a 99 kicker strikes the ball like an
 * 82 — about 103 km/h instead of 113 (90 strikes like an 81, about 103).
 *
 * HOW: the ball is struck with the curve's number (`strikingPower`) instead
 * of your real one. It is the engine's own model of a slightly weaker
 * striker — pace and rise both come down together, the way `launch` already
 * relates them — so a 99 is exactly as likely to keep it under the bar as an
 * 82 is. (Scaling only the pace was tried first and made full-power shots
 * clear the bar twice as often; see the v0.15 report.)
 *
 * What does NOT change:
 *   - the drag. How short a pull reaches full power is read off your REAL
 *     power (`dragForFullPower`, CanvasMatch's powerFromDrag) before the ball
 *     is struck, so the gesture feels exactly the same.
 *   - anything at or below 80.
 *   - a 99 is still the best there is: the curve never goes down.
 * One side effect, unreachable today: `launch` also reads the power stat for
 * how strong you are in the air when a defender contests a HEADER — header
 * chances are switched off (lib/star/switchedOffKinds.ts). If they come back,
 * a 99 would contest in the air like an 82.
 *
 * Applied in one place — CanvasMatch's strike (handleContact) — which is where
 * every mode kicks the ball: the real match, highlights, the gallery's Play,
 * the trial and training. A goal replay re-launches with the same numbers it
 * was struck with (GoalReplay.skills), so it replays at the pace it was
 * scored at. canvasEngine.ts is not touched.
 *
 * The Play Area's compare switch "Shot power" (lib/star/compareSwitches.ts)
 * puts the old straight line back on one device's test screens only.
 */

/** Where the curve bends. */
export const POWER_KNEE = 80;
/** What each point of power above the knee is still worth, as a share of a point below it. */
export const POWER_ABOVE_KNEE = 0.1;

/** The power the ball is struck WITH. The same number at or below the knee. */
export function strikingPower(power: number): number {
  if (!(power > POWER_KNEE)) return power;
  return POWER_KNEE + (power - POWER_KNEE) * POWER_ABOVE_KNEE;
}

/**
 * How much of the old pace the curve keeps, for a kicker of this power.
 * `launch`'s pace is drag × (18 + 0.18 × stat) × (1 − loft/4)
 * (canvasEngine.ts, `Sh`), so the share depends on the stat alone — the drag
 * and the contact point cancel out. tests/star/strikePower.mts pins this to
 * the engine's own launch, so the two cannot drift apart unnoticed.
 */
export function topSpeedScale(power: number): number {
  return (18 + 0.18 * strikingPower(power)) / (18 + 0.18 * power);
}
