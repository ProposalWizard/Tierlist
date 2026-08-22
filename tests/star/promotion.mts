import { resolveLadder, resolvePlayOffs, membershipOf } from "../../lib/star/promotion";
import { makeInitialCareer, advanceSeason } from "../../lib/star/careerFlow";
import { mulberry32, sortLeague } from "../../lib/star/season";
import { PREMIER_LEAGUE_CLUBS, CHAMPIONSHIP_CLUBS, PROMOTION_POOL_CLUBS } from "../../lib/star/clubs";
import { divisionOf, matchweeksFor } from "../../lib/star/calendar";
import type { CareerState, StarPlayer, LeagueTeam } from "../../lib/star/types";

/**
 * THREE UP, THREE DOWN, EVERY SEASON, FOREVER.
 *
 * The ladder has to stay coherent no matter how many seasons run through it:
 * the right number of clubs in each division, nobody in two places at once,
 * nobody lost, and the pool actually circulating rather than draining.
 *
 * The last block is the one worth having: twenty seasons of rollovers with
 * the invariants checked after every single one.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

function playerAt(club: string): StarPlayer {
  return {
    firstName: "Test", lastName: "Player", age: 16, skinTone: "light",
    club, clubBadge: null, position: "ST", nationality: "England",
    startYear: 2027,
  } as StarPlayer;
}

/** Give the table a real, separated finishing order. */
function withStandings(career: CareerState, order: string[]): CareerState {
  const league: LeagueTeam[] = career.league.map((t) => {
    const at = order.indexOf(t.name);
    const points = (order.length - at) * 3;
    return { ...t, played: 10, won: points / 3, drawn: 0, lost: 0, goalsFor: points, goalsAgainst: 0, points };
  });
  return { ...career, league };
}

// ── The play-offs are 3v6, 4v5, then a final ────────────────────────────────
{
  const clubs = [...CHAMPIONSHIP_CLUBS];
  const career = withStandings(
    makeInitialCareer(playerAt(clubs[0]), clubs, "championship"), clubs);
  const strength = new Map(clubs.map((c, i) => [c, 80 - i]));
  const po = resolvePlayOffs(career.league, strength, mulberry32(7));
  check(po !== null, "the play-offs resolve");
  if (po) {
    const table = sortLeague(career.league).map(t => t.name);
    const [third, fourth, fifth, sixth] = [table[2], table[3], table[4], table[5]];
    const pairs = po.semiFinals.map(t => [t.home, t.away].sort().join(" v "));
    check(pairs.includes([third, sixth].sort().join(" v ")), `3rd plays 6th (${pairs.join("; ")})`);
    check(pairs.includes([fourth, fifth].sort().join(" v ")), `4th plays 5th (${pairs.join("; ")})`);
    check(po.semiFinals.every(t => t.legs.length === 2), "each semi-final is two legs");
    check(po.semiFinals.every(t => t.winner === t.home || t.winner === t.away),
      "each semi-final winner played in it");
    const finalists = [po.final.home, po.final.away];
    check(po.semiFinals.every(t => finalists.includes(t.winner)), "the final is the two semi-final winners");
    check(finalists.includes(po.promoted), "and the promoted club won it");
    check([third, fourth, fifth, sixth].includes(po.promoted),
      `only 3rd-6th can go up through them (${po.promoted})`);
  }
}

// ── A Premier League season sends its real bottom three down ────────────────
{
  const clubs = [...PREMIER_LEAGUE_CLUBS];
  const order = [...clubs];
  const career = withStandings(makeInitialCareer(playerAt(order[0]), clubs, "premier"), order);
  const out = resolveLadder(career, mulberry32(11));

  check(out.relegatedFromPremier.join(",") === order.slice(-3).join(","),
    `the table's bottom three go down (${out.relegatedFromPremier.join(", ")})`);
  check(out.promotedToPremier.length === 3, `three come up (${out.promotedToPremier.length})`);
  check(out.promotedToPremier.every(c => CHAMPIONSHIP_CLUBS.includes(c)),
    "and all three came from the Championship");
  check(out.division === "premier", "finishing top, you stay up");
  check(out.yourMove === null, "and that is not a move");
  check(out.playOffs === null, "a Premier League season has no play-offs");
}

// ── Winning the Championship goes up; the bottom goes to the pool ───────────
{
  const clubs = [...CHAMPIONSHIP_CLUBS];
  const you = clubs[0];
  const career = withStandings(makeInitialCareer(playerAt(you), clubs, "championship"), clubs);
  const out = resolveLadder(career, mulberry32(13));

  check(out.promotedToPremier.length === 3, `three go up (${out.promotedToPremier.length})`);
  check(out.promotedToPremier.slice(0, 2).join(",") === clubs.slice(0, 2).join(","),
    `first and second go automatically (${out.promotedToPremier.slice(0, 2).join(", ")})`);
  check(out.division === "premier" && out.yourMove === "promoted",
    `winning it promotes you (${out.division}, ${out.yourMove})`);
  check(out.relegatedFromChampionship.length === 3, "three drop out of the Championship");
  check(out.divisions.pool.length === PROMOTION_POOL_CLUBS.length,
    `the pool stays the same size (${out.divisions.pool.length})`);
  check(out.relegatedFromChampionship.every(c => out.divisions.pool.includes(c)),
    "the relegated three land in the pool, in the hat for next time");
  check(out.promotedToChampionship.every(c => !out.divisions.pool.includes(c)),
    "and the three drawn out of it have left it");
  check(out.playOffs !== null, "a Championship season plays its play-offs");
}

// ── Finishing bottom of the Championship cannot strand you ──────────────────
{
  const clubs = [...CHAMPIONSHIP_CLUBS];
  const you = clubs[clubs.length - 1];       // dead last
  const career = withStandings(makeInitialCareer(playerAt(you), clubs, "championship"), clubs);
  const out = resolveLadder(career, mulberry32(17));

  check(!out.relegatedFromChampionship.includes(you),
    "your club is not relegated out of the game's last division");
  check(out.division === "championship" && out.yourMove === null,
    `you stay in the Championship (${out.division})`);
  check(out.relegatedFromChampionship.length === 3, "three still go down");
  check(out.divisions.championship.includes(you), "and you are still in it");
}

// ── Only English clubs are ever on the English ladder ───────────────────────
{
  // The promotion pool and the standalone "Other" clubs used to be one list,
  // so Sevilla, Monaco and Al Hilal were being promoted into the
  // Championship. Nothing asserted here caught it — the pool stayed exactly
  // the right SIZE — so this checks the contents by name.
  const foreign = ["Sevilla", "Monaco", "Al Hilal", "Al Nassr", "Lazio", "Atalanta",
    "Schalke", "Strasbourg", "Eintracht Frankfurt", "Al Ahli", "Al Ittihad"];
  check(PROMOTION_POOL_CLUBS.length === 5,
    `the promotion pool is five clubs (${PROMOTION_POOL_CLUBS.length})`);
  check(!PROMOTION_POOL_CLUBS.some(c => foreign.includes(c)),
    `and none of them is a standalone foreign club (${PROMOTION_POOL_CLUBS.filter(c => foreign.includes(c)).join(", ")})`);

  let career = makeInitialCareer(playerAt(CHAMPIONSHIP_CLUBS[3]), [...CHAMPIONSHIP_CLUBS], "championship");
  const strayed = new Set<string>();
  for (let season = 1; season <= 12; season++) {
    const rng = mulberry32(season * 97 + 3);
    const order = [...career.league.map(t => t.name)].sort(() => rng() - 0.5);
    career = withStandings(career, order);
    career = advanceSeason(career, false).career;
    const m = membershipOf(career);
    for (const c of [...m.premier, ...m.championship]) if (foreign.includes(c)) strayed.add(c);
  }
  check(strayed.size === 0,
    `no foreign club reaches an English division over twelve seasons (${Array.from(strayed).join(", ")})`);
}

// ── Twenty seasons, and the ladder still adds up ────────────────────────────
{
  let career = makeInitialCareer(playerAt(CHAMPIONSHIP_CLUBS[5]), [...CHAMPIONSHIP_CLUBS], "championship");
  let moves = 0, seasonsInPremier = 0;
  let broke = "";

  for (let season = 1; season <= 20 && !broke; season++) {
    // A random but real finishing order for whichever division you are in.
    const rng = mulberry32(season * 31 + 5);
    const order = [...career.league.map(t => t.name)].sort(() => rng() - 0.5);
    career = withStandings(career, order);

    const before = membershipOf(career);
    const beforeAll = [...before.premier, ...before.championship, ...before.pool];
    career = advanceSeason(career, false).career;
    const m = membershipOf(career);
    const all = [...m.premier, ...m.championship, ...m.pool];

    if (divisionOf(career) === "premier") seasonsInPremier++;
    if (career.ladderNews?.yourMove) moves++;

    const fail = (why: string) => { broke = `season ${season}: ${why}`; };

    if (m.premier.length !== 20) fail(`Premier League has ${m.premier.length} clubs`);
    else if (m.championship.length !== 24) fail(`Championship has ${m.championship.length} clubs`);
    else if (m.pool.length !== PROMOTION_POOL_CLUBS.length) fail(`pool has ${m.pool.length} clubs`);
    else if (new Set(all).size !== all.length) {
      const dupes = all.filter((c, i) => all.indexOf(c) !== i);
      fail(`a club is in two places at once (${Array.from(new Set(dupes)).join(", ")})`);
    } else if (all.length !== beforeAll.length) {
      fail(`clubs appeared or vanished (${beforeAll.length} -> ${all.length})`);
    } else if (new Set(all).size !== new Set(beforeAll).size) {
      fail("the set of clubs in the world changed");
    } else if (!m[divisionOf(career) === "premier" ? "premier" : "championship"].includes(career.player.club)) {
      fail("your own club is not in the division you are playing in");
    } else if (career.league.length !== (divisionOf(career) === "premier" ? 20 : 24)) {
      fail(`the table has ${career.league.length} clubs for the ${divisionOf(career)}`);
    } else {
      const league = career.fixtures.filter(f => (f.kind ?? "league") === "league");
      const want = matchweeksFor(divisionOf(career));
      if (league.length !== want) fail(`${league.length} league fixtures, wanted ${want}`);
      else if (divisionOf(career) === "championship" && career.europeanQualification !== null) {
        fail("a Championship season handed out a European place");
      }
    }
  }

  check(broke === "", broke || "twenty seasons of rollovers stay coherent");
  check(moves > 0, `and your club actually moved divisions at least once (${moves} times)`);
  check(seasonsInPremier > 0, `including some seasons in the Premier League (${seasonsInPremier})`);
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exit(1);
}
console.log("PASS — three up, three down, play-offs, and twenty seasons that still add up");
