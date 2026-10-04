/** Injuries are switched off until they're revamped (Mikey, 4 Oct 2026:
 *  "take injuries out of the game right now. They will be added in later,
 *  once a revamp has happened"). The roll, the countdown and the selection
 *  rule are all kept: set this to true to switch them back on. A suspension
 *  (corruption.ts) uses the same slot and still works. */
export const INJURIES_ON: boolean = false;

/** True for an injury the match roll made (not a suspension). */
export function isRolledInjury(i: { note: string } | null | undefined): boolean {
  return !!i && /^(Knock|Injury|Serious injury) —/.test(i.note);
}

