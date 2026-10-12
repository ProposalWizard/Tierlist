/**
 * WHICH CHANCES THE MATCH SERVES — always the team's DRAWN chances ("classic").
 *
 * Decided, no toggle (Harry, 12 Oct 2026): "Get rid of the New Chances. Just
 * go back to using Drawn Chances only." The Settings → Chances row is gone and
 * every match, highlight and Play Area chance is a drawn one. An old phone that
 * still has `star-chance-set-v2 = "new"` in localStorage is simply ignored.
 *
 * The computer-made library (lib/star/chanceLibrary.ts) is kept for the one
 * test page that shows it (/star-chances-dev), which pins "new" while it is on
 * screen. Nothing in a career ever pins it. To bring the in-game toggle back,
 * see the commit named in CLAUDE.md → "Decided, no toggle".
 */

export type ChanceSet = "new" | "classic";

/** THE ONE LINE: the chances every match serves. */
export const CHANCE_SET_DEFAULT: ChanceSet = "classic";

/** The game's choice: always the drawn chances. */
export function chanceSetChoice(): ChanceSet {
  return CHANCE_SET_DEFAULT;
}

/** Pins in force, oldest first. The newest one wins; each is its own object,
 *  so two screens pinning at once (or React mounting an effect twice) each
 *  lift only their own. */
const pins: { set: ChanceSet }[] = [];

/**
 * Serve `set` until the returned function is called. Only the New Chances test
 * page pins "new"; EnginePlay pins "classic" (a no-op now, kept as a guard).
 */
export function pinChanceSet(set: ChanceSet): () => void {
  const pin = { set };
  pins.push(pin);
  return () => {
    const i = pins.lastIndexOf(pin);
    if (i >= 0) pins.splice(i, 1);
  };
}

/** The pin in force, or null when none is. */
export function chanceSetPin(): ChanceSet | null {
  return pins.length ? pins[pins.length - 1].set : null;
}

/** The chances to serve right now: the newest pin, else the drawn chances. */
export function chanceSet(): ChanceSet {
  return chanceSetPin() ?? chanceSetChoice();
}
