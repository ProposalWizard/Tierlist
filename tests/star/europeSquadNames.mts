import { poolFor } from "../../lib/star/euro";
import { externalClubsFor, PREMIER_LEAGUE_CLUBS, CHAMPIONSHIP_CLUBS } from "../../lib/star/clubs";

/**
 * A EUROPEAN OPPONENT'S NAME MUST MATCH WHOSE SQUAD ACTUALLY GETS FETCHED —
 * AND MUST BE A REAL, DATABASE-BACKED CLUB TO BEGIN WITH.
 *
 * Reported directly, with a real match against Copenhagen: "unable to scout
 * opponent's team" despite a lineup genuinely set for them. Root cause —
 * `CHAMPIONS_POOL`/`EUROPA_POOL` (lib/star/euro.ts, who you can actually be
 * drawn against) spelled clubs differently from `CHAMPIONS_LEAGUE_CLUBS`/
 * `EUROPA_LEAGUE_CLUBS`/`OTHER_CLUBS` (lib/star/clubs.ts, the real SoFIFA/
 * database spelling `externalClubsFor` fetches squads under, and the same
 * lists the /lineups picker's Champions League and Europa League tabs are
 * built from) — "Copenhagen" vs "FC København", "Bayern Munich" vs "FC
 * Bayern München", and so on throughout most of both pools.
 *
 * A second pass fixed a deeper version of the same gap, told directly:
 * eighteen EUROPA_POOL entries (Fiorentina, Qarabağ, and sixteen others)
 * named a club that had never been added to clubs.ts's lists AT ALL — not a
 * spelling difference, a club this game's database was simply never told
 * about — swapped for real EUROPA_LEAGUE_CLUBS/CHAMPIONS_LEAGUE_CLUBS
 * members instead. Every pool entry now has to be a genuine member of one
 * of clubs.ts's lists, not just spelled consistently with one.
 *
 * This locks both fixes in at the data level, so a future edit to either
 * list can't quietly drift the two apart again the same way.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

// A Premier League career's own fetch list — the same shape every real
// career actually calls (see app/star-dev/page.tsx). A club already in your
// own division (Crystal Palace, say, for a Premier League career) is
// correctly EXCLUDED from this — it resolves straight through
// `leagueSquads` instead, never needing `externalSquads` at all — so it
// still counts as resolved for this check.
const fetchList = new Set(externalClubsFor(PREMIER_LEAGUE_CLUBS));
const ownDivision = new Set(PREMIER_LEAGUE_CLUBS);

for (const competition of ["Champions League", "Europa League"] as const) {
  const pool = poolFor(competition);
  check(pool.length > 0, `${competition}'s pool is not empty`);
  for (const club of pool) {
    check(fetchList.has(club.name) || ownDivision.has(club.name),
      `${competition} opponent "${club.name}" is a real, database-backed club — either fetched into externalSquads or already in your own division`);
  }
}

// The exact reported case.
check(poolFor("Champions League").some(c => c.name === "FC København"),
  "Copenhagen is in the Champions League pool under the real database spelling");
check(!poolFor("Champions League").some(c => c.name === "Copenhagen"),
  "…and not under the old English shorthand that had no squad to match");

// ── The other domestic tier is fetched too — a real FA Cup opponent from ───
// the tier below (or above) your own division, e.g. Blackburn Rovers for a
// Premier League career, must have a real squad to scout as well.
{
  const plFetch = new Set(externalClubsFor(PREMIER_LEAGUE_CLUBS));
  check(plFetch.has("Blackburn Rovers"),
    "a Premier League career's fetch list includes the Championship — a real FA Cup opponent, not just Europe");
  check(!plFetch.has("Arsenal"), "…but never a club that's already in your own division");

  const champFetch = new Set(externalClubsFor(CHAMPIONSHIP_CLUBS));
  check(champFetch.has("Arsenal"),
    "…and it works the other way too: a Championship career's fetch list includes the Premier League");
  check(!champFetch.has("Blackburn Rovers"), "…but never a club already in your own division");
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exit(1);
}
console.log("PASS — a European or cross-tier cup opponent's name always matches whose squad actually gets fetched");
