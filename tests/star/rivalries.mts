import { CLUB_RIVALRIES, rivalryOf, isDerby, derbyName, strongestTier } from "../../lib/star/rivalries";
import { PREMIER_LEAGUE_CLUBS, CHAMPIONSHIP_CLUBS, PROMOTION_POOL_CLUBS } from "../../lib/star/clubs";

/**
 * WHO DOESN'T LIKE WHO.
 *
 * Not wired into gameplay yet — this is the same lesson the Lineups
 * club-name bugs already taught: forty-nine hand-transcribed club names is
 * exactly the shape of thing that quietly drifts from lib/star/clubs.ts's
 * real spellings, and nothing would catch it until a lookup silently found
 * nobody. This is that catch.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const CANONICAL = new Set([...PREMIER_LEAGUE_CLUBS, ...CHAMPIONSHIP_CLUBS, ...PROMOTION_POOL_CLUBS]);

// ── Every name matches the game's real spellings ─────────────────────────────
{
  check(CANONICAL.size === 49, `the game currently models forty-nine English clubs (${CANONICAL.size})`);
  const keys = Object.keys(CLUB_RIVALRIES);
  check(keys.length === 49, `every one of them has a rivalries entry (${keys.length})`);
  check(keys.every(k => CANONICAL.has(k)), "and every key is a real, current club name");
  check([...CANONICAL].every(c => c in CLUB_RIVALRIES), "no real club is missing an entry, even an empty one");

  for (const [club, rivals] of Object.entries(CLUB_RIVALRIES)) {
    for (const r of rivals) {
      check(CANONICAL.has(r.club), `${club} lists a real club as a rival (got "${r.club}")`);
      check(r.club !== club, `${club} does not list itself`);
    }
    check(new Set(rivals.map(r => r.club)).size === rivals.length, `${club} lists nobody twice`);
  }
}

// ── The lookups actually work ────────────────────────────────────────────────
{
  const arsenal = rivalryOf("Arsenal", "Tottenham Hotspur");
  check(arsenal?.tier === "R1" && arsenal?.derby === true && arsenal?.derbyName === "North London Derby",
    `Arsenal v Spurs is the North London Derby, R1 (${JSON.stringify(arsenal)})`);
  check(rivalryOf("Arsenal", "Manchester City")?.tier === "R3", "…and a real R3 too");
  check(rivalryOf("Arsenal", "Everton") === null, "and nothing invented for a pairing never given");

  // Derby-only, no tier — Chelsea's own list gives Fulham/Brentford no R-number.
  const chelseaFulham = rivalryOf("Chelsea", "Fulham FC");
  check(chelseaFulham?.derby === true && chelseaFulham?.tier === undefined,
    `a derby can carry no rated tier at all (${JSON.stringify(chelseaFulham)})`);
}

// ── Asymmetric on purpose ────────────────────────────────────────────────────
{
  check(rivalryOf("Hull City", "Leeds United")?.tier === "R1",
    "Hull rate Leeds their primary rivalry");
  check(rivalryOf("Leeds United", "Hull City") === null,
    "…which Leeds do not reciprocate in their own list — asymmetry preserved, not smoothed over");
  check(strongestTier("Hull City", "Leeds United") === "R1",
    "but the fixture still reads as R1 from whichever side is asking");
}

// ── Derby checked both directions ────────────────────────────────────────────
{
  check(isDerby("Manchester City", "Manchester United"), "the Manchester Derby, from City's side");
  check(isDerby("Manchester United", "Manchester City"), "…and from United's side");
  check(derbyName("Manchester United", "Manchester City") === "Manchester Derby", "named, either direction");
  check(!isDerby("Arsenal", "Manchester City"), "a genuine non-derby reads as one nowhere");
}

// ── The special case given directly ──────────────────────────────────────────
{
  const rivalry = rivalryOf("Liverpool", "Manchester United");
  check(rivalry?.tier === "R1" && rivalry?.derbyName === "North West rivalry",
    `Liverpool v Manchester United, the one flagged as bigger than either club's own derby (${JSON.stringify(rivalry)})`);
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exit(1);
}
console.log("PASS — all forty-nine clubs, real spellings, and the asymmetry is preserved on purpose");
