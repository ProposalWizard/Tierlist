import type { Competition, LeagueTeam } from "./types";
import { sortLeague } from "./season";

/**
 * WHO QUALIFIES FOR EUROPE — MOVED OUT OF competitions.ts.
 *
 * Split out so `euro.ts` can read the real qualification rule directly (to
 * decide which real English clubs occupy this season's Champions/Europa
 * League slots — see euro.ts's own note on why that was never actually
 * wired in before) without a circular import: `competitions.ts` already
 * imports `openEuro`/`poolFor` FROM `euro.ts`, so `euro.ts` importing
 * `seasonQualifiers` back FROM `competitions.ts` would cycle. `competitions.ts`
 * re-exports both functions from here, so every existing importer of
 * `qualificationFor`/`seasonQualifiers` from `./competitions` keeps working
 * completely unchanged.
 */

export function qualificationFor(
  position: number,
  clubCount: number,
  wonFaCup = false,
  wonLeagueCup = false,
  wonEuroComp = false,
  /** Phase 6 of STAR_POWER_POLITICS.md, rule §4.4 #11 — extra places UEFA
   *  has granted this country on top of the ordinary top-5/6th-7th split.
   *  Both default to 0, so every existing caller sees exactly the split it
   *  always has. */
  extraChampionsLeagueSlots = 0,
  extraEuropaLeagueSlots = 0,
): Competition | null {
  const cl = Math.round(clubCount * 0.25) + extraChampionsLeagueSlots;  // PL: top 5, plus any UEFA grant
  const elBottom = cl + 2 + extraEuropaLeagueSlots;                      // PL: 7th, plus any UEFA grant

  if (position <= cl) return "Champions League";
  if (wonEuroComp) return "Champions League";         // UCL/EL winner outside top 5
  if (position <= elBottom) return "Europa League";   // 6th or 7th
  if (wonFaCup || wonLeagueCup) return "Europa League";  // cup winner at 8th+
  return null;
}

/**
 * The same rule as qualificationFor, applied to the whole division at once —
 * every club's European spot for next season, not just yours.
 *
 * qualificationFor's own doc comment already spells out the cascade: a cup
 * winner who qualified through the league anyway does not create a second
 * Europa League place, that place goes to the next-best-placed club instead.
 * That only ever mattered in words before now, because no other club's cup
 * result was tracked — this is what makes it real: the winners handed in are
 * whichever clubs actually won the FA Cup and League Cup this season (see
 * finishCupToWinner), which can be any of the twenty, not only the player's.
 */
export function seasonQualifiers(
  league: LeagueTeam[],
  faCupWinner: string | null,
  leagueCupWinner: string | null,
  /** Phase 6 of STAR_POWER_POLITICS.md, rule §4.4 #11 — see qualificationFor's own note. */
  extraChampionsLeagueSlots = 0,
  extraEuropaLeagueSlots = 0,
): { champions: string[]; europa: string[] } {
  const table = sortLeague(league).map(t => t.name);
  const cl = Math.round(league.length * 0.25) + extraChampionsLeagueSlots;
  const elBottom = cl + 2 + extraEuropaLeagueSlots;
  const champions = new Set(table.slice(0, cl));
  const europa = new Set(table.slice(cl, elBottom));
  let cascade = elBottom; // next candidate by table position for a vacated cup berth
  for (const winner of [faCupWinner, leagueCupWinner]) {
    if (!winner) continue;
    if (champions.has(winner) || europa.has(winner)) {
      while (cascade < table.length && (champions.has(table[cascade]) || europa.has(table[cascade]))) cascade++;
      if (cascade < table.length) europa.add(table[cascade++]);
    } else {
      europa.add(winner);
    }
  }
  return { champions: Array.from(champions), europa: Array.from(europa) };
}
