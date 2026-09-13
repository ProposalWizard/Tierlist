import type { Competition, LeagueTeam } from "./types";
import { sortLeague } from "./season";

/**
 * WHO QUALIFIES FOR EUROPE.
 *
 * Rewritten 13 Sep 2026 (cont. 5) to the exact real rules given directly,
 * replacing an earlier version that guaranteed BOTH 6th and 7th place a
 * Europa League spot unconditionally — wrong: only 6th is an unconditional
 * baseline place. The real shape, confirmed directly across several rounds
 * (an earlier AI-generated rule sheet the user brought in had two internal
 * contradictions — both resolved directly rather than guessed):
 *
 *   1. Top 5 → Champions League. Always. Nothing below can touch this.
 *   2. 6th place → Europa League. Always, unconditionally, SEPARATE from and
 *      on top of the two cup slots below — confirmed directly after an
 *      earlier draft of this file had 6th's slot getting stolen by a cup
 *      winner finishing below it, which was wrong.
 *   3. Two more Europa League slots, one tied to the FA Cup winner and one
 *      to the League Cup (EFL Cup) winner, each independent:
 *        - If that winner finished OUTSIDE the top 6, their slot locks to
 *          their own real table position (Lock-Down).
 *        - If that winner is already in the Champions League (top 5) or
 *          already has the 6th-place Europa spot, their cup slot cannot
 *          double up on them — it trickles down to the next real table
 *          position not already claimed by anyone (Trickle-Down).
 *   4. Winning the Champions League or Europa League itself (not a domestic
 *      cup) is a separate bonus rule, and never affects any OTHER club's
 *      spot — only the winner's own:
 *        - Already in the top 5? No effect, already in the Champions League.
 *        - Already got a Europa League spot some other way (6th, or a cup
 *          lock-down/trickle)? Upgraded to the Champions League instead —
 *          and that Europa League slot is simply DELETED, not passed down
 *          to whoever was next in line.
 *        - Finished outside all of the above (9th or lower, no cup)? Added
 *          to the Champions League as a pure bonus club, expanding the real
 *          total rather than replacing anyone.
 */

export function qualificationFor(
  position: number,
  clubCount: number,
  wonFaCup = false,
  wonLeagueCup = false,
  wonEuroComp = false,
  /** Phase 6 of STAR_POWER_POLITICS.md, rule §4.4 #11 — extra places UEFA
   *  has granted this country on top of the ordinary top-5/6th split. Both
   *  default to 0, so every existing caller sees exactly the split it
   *  always has. */
  extraChampionsLeagueSlots = 0,
  extraEuropaLeagueSlots = 0,
): Competition | null {
  const cl = Math.round(clubCount * 0.25) + extraChampionsLeagueSlots; // top 5
  if (position <= cl) return "Champions League";

  // 6th place (widened by any extra UEFA-granted slots) — a separate,
  // unconditional Europa League place, independent of the two cup slots.
  const sixthBand = cl + 1 + extraEuropaLeagueSlots;
  const earnsEuropaByLeague = position <= sixthBand;
  const earnsEuropaByCup = wonFaCup || wonLeagueCup; // Lock-Down at their own position

  if (earnsEuropaByLeague || earnsEuropaByCup) {
    return wonEuroComp ? "Champions League" : "Europa League"; // rule 4's upgrade
  }
  if (wonEuroComp) return "Champions League"; // rule 4's pure bonus
  return null;
}

/**
 * The same rule as qualificationFor, applied to the whole division at once —
 * every club's European spot for next season, not just yours. This is the
 * version that actually builds the real Champions/Europa League field every
 * other club sits in (see euro.ts's seasonField) — a bug fixed in the 13 Sep
 * 2026 rebuild made this genuinely matter, since it used to be the only club
 * that actually appeared as England's representative.
 */
export function seasonQualifiers(
  league: LeagueTeam[],
  faCupWinner: string | null,
  leagueCupWinner: string | null,
  /** The English club (if any) that won the Champions League or Europa
   *  League last season — rule 4 above. Not the domestic cups. */
  europeanTrophyWinner: string | null = null,
  /** Phase 6 of STAR_POWER_POLITICS.md, rule §4.4 #11 — see qualificationFor's own note. */
  extraChampionsLeagueSlots = 0,
  extraEuropaLeagueSlots = 0,
): { champions: string[]; europa: string[] } {
  const table = sortLeague(league).map(t => t.name);
  const cl = Math.round(league.length * 0.25) + extraChampionsLeagueSlots;
  const champions = new Set(table.slice(0, cl));
  // 6th place (or the widened band) — separate and unconditional, filled
  // before either cup slot is even considered.
  const sixthBand = cl + 1 + extraEuropaLeagueSlots;
  const europa = new Set(table.slice(cl, sixthBand));

  const nextFree = (fromIndex: number): number => {
    let i = fromIndex;
    while (i < table.length && (champions.has(table[i]) || europa.has(table[i]))) i++;
    return i;
  };
  let cascadeFrom = sixthBand;

  for (const winner of [faCupWinner, leagueCupWinner]) {
    if (!winner) continue;
    if (champions.has(winner) || europa.has(winner)) {
      // Trickle-Down: already has a spot (top 5, or already the 6th-place
      // slot) — this cup's slot moves to the next real position that isn't
      // already claimed by anyone, rather than doubling them up.
      const i = nextFree(cascadeFrom);
      if (i < table.length) { europa.add(table[i]); cascadeFrom = i + 1; }
    } else {
      europa.add(winner); // Lock-Down: locked to their own real position
    }
  }

  // Rule 4 — the European Title Upgrade. Deliberately never touches any
  // OTHER club's slot: a delete, or a pure addition, never a cascade.
  if (europeanTrophyWinner && !champions.has(europeanTrophyWinner)) {
    if (europa.has(europeanTrophyWinner)) {
      europa.delete(europeanTrophyWinner); // deleted outright, not passed down
      champions.add(europeanTrophyWinner);
    } else {
      champions.add(europeanTrophyWinner); // pure bonus club, nobody displaced
    }
  }

  return { champions: Array.from(champions), europa: Array.from(europa) };
}
