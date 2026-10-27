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
 * chances are back on (B10, 20 Oct 2026), so a 99 contests in the air like an
 * 82 (reasoned from this curve, not measured).
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

/**
 * POWER 40 IS A STARTING PLAYER (Mikey, 26 Oct 2026: "40 already gives a shot
 * hard enough for the whole game … 40 should be a lot less actual power").
 *
 * The curve is now set by SPEEDS: how fast a full-power strike through the
 * middle leaves the boot (metres a second) at each Power. Straight lines
 * between the points. Today's straight line (18 + 0.18 × Power, flattened above
 * 80) is beside it for reference:
 *
 *   Power        20     40     60     80    100
 *   this curve   19.5   21.0   23.4   30.6  32.76 m/s
 *   before       21.6   25.2   28.8   32.4  32.76 m/s
 *
 * So 40 is clearly short of what it was, today's 40 (25.2 m/s) comes at 65,
 * and the top is where it was. Every kick is struck with it: shots, passes,
 * crosses. Your device can try other numbers (the Play Area's "Power curve"
 * panel, setPowerCurveOverride) without changing anyone else's game.
 */
export const POWER_POINTS = [0, 20, 40, 60, 80, 100] as const;
export const DEFAULT_POWER_SPEEDS = [18, 19.5, 21, 23.4, 30.6, 32.76];
/** Today's line for reference (18 + 0.18 × Power, the v0.15 knee above 80). */
export const OLD_POWER_SPEEDS = [18, 21.6, 25.2, 28.8, 32.4, 32.76];
const OVERRIDE_KEY = "star-power-curve";
let override: number[] | null | undefined;

/** This device's own speeds (the Play Area panel), or null for the game's. */
export function powerCurveOverride(): number[] | null {
  if (override !== undefined) return override;
  override = null;
  try {
    const raw = typeof localStorage === "undefined" ? null : localStorage.getItem(OVERRIDE_KEY);
    const v = raw ? (JSON.parse(raw) as unknown) : null;
    if (Array.isArray(v) && v.length === POWER_POINTS.length && v.every((x) => typeof x === "number" && x > 5 && x < 60)) override = v as number[];
  } catch { override = null; }
  return override;
}
/** Set (or with null, clear) this device's own speeds. */
export function setPowerCurveOverride(speeds: number[] | null): void {
  override = speeds && speeds.length === POWER_POINTS.length ? [...speeds] : null;
  try {
    if (typeof localStorage === "undefined") return;
    if (override) localStorage.setItem(OVERRIDE_KEY, JSON.stringify(override)); else localStorage.removeItem(OVERRIDE_KEY);
  } catch { /* the setting still holds this visit */ }
}

/** The speeds in use: this device's, else the game's. */
export function powerSpeeds(): number[] { return powerCurveOverride() ?? DEFAULT_POWER_SPEEDS; }

/** Full-power speed (m/s, struck through the middle) at this Power. */
export function fullPowerSpeed(power: number, speeds: readonly number[] = powerSpeeds()): number {
  const p = Math.max(0, Math.min(100, power));
  for (let i = 1; i < POWER_POINTS.length; i++) {
    if (p <= POWER_POINTS[i]) {
      const a = POWER_POINTS[i - 1], b = POWER_POINTS[i];
      return speeds[i - 1] + ((speeds[i] - speeds[i - 1]) * (p - a)) / (b - a);
    }
  }
  return speeds[speeds.length - 1];
}

/** Kept for the old tests and the compare switch's reading: where the v0.15 curve bent. */
export const POWER_KNEE = 80;
export const POWER_ABOVE_KNEE = 0.1;

/** The power the ball is struck WITH: the stat that gives this curve's speed
 *  in launch's own model (pace 18 + 0.18 × stat; the rise follows it). */
export function strikingPower(power: number): number {
  return Math.max(-50, (fullPowerSpeed(power) - 18) / 0.18);
}

/** The same, on the line from before 26 Oct 2026 (OLD_POWER_SPEEDS). For the
 *  tests that measure something else (the keeper, the Shots pro model) at a
 *  fixed strike, so a change to the curve doesn't move their numbers. */
export function oldStrikingPower(power: number): number {
  return Math.max(-50, (fullPowerSpeed(power, OLD_POWER_SPEEDS) - 18) / 0.18);
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
