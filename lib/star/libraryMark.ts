/**
 * THE NEW CHANCES CARRY A MARK — so they can never be saved into the gallery.
 *
 * Harry, 3 Oct 2026: "these new scenarios need to be separate to the scenario
 * gallery for now please - just in case they suck."
 *
 * makeChance (chanceMaker.ts) stamps every chance it serves from the New set:
 *   - "library": a picture from the checked library (chanceLibrary.ts), with
 *     the library picture's id;
 *   - "context": a kind the library has no picture of, served the New way
 *     with the rest of both teams added round it (contextShape.ts).
 * Either way it is not one of the gallery's drawings, so every Save and Commit
 * of a live chance refuses it (liveEdit.ts → `liveMatchScenario`).
 *
 * The stamp is a plain field on the scenario object, so it survives the
 * match's own `structuredClone` snapshot that reaches Infinite Match and the
 * live editor. Scenario itself lives in canvasEngine.ts, which nobody edits,
 * so the field is added here by intersection rather than on the interface.
 */

export interface NewChanceMark {
  from: "library" | "context";
  /** The library picture's id ("library" only). */
  id?: string;
}

const FIELD = "newChance" as const;
type Marked = { [FIELD]?: NewChanceMark };

/** Stamp a chance as served from the New set. */
export function markNewChance(sc: object, mark: NewChanceMark): void {
  (sc as Marked)[FIELD] = { ...mark };
}

/** The New-set stamp on a chance, or null for a classic one. */
export function newChanceMark(sc: object | null | undefined): NewChanceMark | null {
  const m = sc ? (sc as Marked)[FIELD] : undefined;
  return m && (m.from === "library" || m.from === "context") ? m : null;
}

/** What Save and Commit say when handed a New chance. */
export const NEW_CHANCE_REFUSAL =
  "This chance is from the new library — it can't go into the gallery.";

/** Thrown by liveMatchScenario for a New chance; `message` is the refusal. */
export class NewChanceRefused extends Error {
  constructor() {
    super(NEW_CHANCE_REFUSAL);
    this.name = "NewChanceRefused";
    // An ES5 build loses the subclass on `extends Error`; put it back so
    // `instanceof NewChanceRefused` holds.
    Object.setPrototypeOf(this, NewChanceRefused.prototype);
  }
}

/** True for the error liveMatchScenario throws on a New chance. By name, so it
 *  holds even where two copies of this module are loaded. */
export function isNewChanceRefused(e: unknown): boolean {
  return e instanceof Error && e.name === "NewChanceRefused";
}
