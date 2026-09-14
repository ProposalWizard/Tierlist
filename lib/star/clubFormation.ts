import { mulberry32 } from "./season";
import { FORMATIONS, formationOf, type Formation } from "./formations";

/**
 * A club's formation, which is theirs and does not change every week.
 *
 * Moved out of teamsheet.ts so `incumbency.ts` can read it without cycling
 * back through that file (which needs to import FROM incumbency.ts for its
 * own cup-preference override — see incumbency.ts's own note). Re-exported
 * from teamsheet.ts so every existing importer of `formationForClub` FROM
 * "./teamsheet" keeps working completely unchanged — same extraction shape
 * this game already used for `qualification.ts` (competitions.ts/euro.ts)
 * and `clubTier.ts` (investments.ts/marketValue.ts).
 *
 * Seeded off the club's name alone, so Everton line up the same way in every
 * career and in every season of one — a side whose shape is redrawn each match
 * is not a side, it is a dice roll. Drawn from the handful of shapes a real
 * Premier League club actually uses rather than from all thirty, most of which
 * exist for the squad builder to offer rather than for anybody to play.
 */
const COMMON_SHAPES = ["433", "4231", "442", "352", "4321", "4141", "3421"];

export function formationForClub(club: string): Formation {
  let h = 2166136261;
  for (let i = 0; i < club.length; i++) {
    h ^= club.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const rng = mulberry32(h >>> 0);
  rng(); rng();
  const id = COMMON_SHAPES[Math.floor(rng() * COMMON_SHAPES.length)];
  // A shape the catalogue does not have falls back to 4-3-3 rather than to
  // nothing — see formationOf.
  return formationOf(FORMATIONS.some(f => f.id === id) ? id : "433");
}
