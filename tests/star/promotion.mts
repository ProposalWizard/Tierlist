import { resolveLadder, resolvePlayOffs, membershipOf } from "../../lib/star/promotion";
import { makeInitialCareer, advanceSeason } from "../../lib/star/careerFlow";
import { generateRelegationOffers } from "../../lib/star/relegationOffers";
import { acceptOffer } from "../../lib/star/transfers";
import { mulberry32, sortLeague } from "../../lib/star/season";
import {
  PREMIER_LEAGUE_CLUBS, CHAMPIONSHIP_CLUBS, PROMOTION_POOL_CLUBS, LEAGUE_ONE_CLUBS, NATIONAL_LEAGUE_CLUBS,
  NATIONAL_LEAGUE_NORTH_CLUBS, NATIONAL_LEAGUE_SOUTH_CLUBS,
} from "../../lib/star/clubs";
import { divisionOf, matchweeksFor, type CareerDivision } from "../../lib/star/calendar";
import { latitudeOf } from "../../lib/star/nonLeagueRegions";
import type { DivisionMembership } from "../../lib/star/promotion";
import { divisionOf as divisionOfClub } from "../../lib/star/clubs";
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

const KEY_OF: Record<CareerDivision, keyof DivisionMembership> = {
  premier: "premier", championship: "championship", league_one: "leagueOne", league_two: "leagueTwo",
  national_league: "nationalLeague", national_league_north: "nationalLeagueNorth", national_league_south: "nationalLeagueSouth",
};

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

// ── Winning the Championship goes up; the bottom goes to League One ─────────
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
  check(out.divisions.leagueOne.length === LEAGUE_ONE_CLUBS.length,
    `League One stays the same size (${out.divisions.leagueOne.length})`);
  check(out.relegatedFromChampionship.every(c => out.divisions.leagueOne.includes(c)),
    "the relegated three land in League One, in the hat for next time");
  check(out.promotedToChampionship.every(c => !out.divisions.leagueOne.includes(c)),
    "and the three drawn out of it have left it");
  check(out.playOffs !== null, "a Championship season plays its play-offs");
}

// ── Finishing bottom of the Championship really does relegate you now ───────
//
// This used to be a reprieve: your own club could never go down, because the
// pool has no season for it to play. That produced a career that could sit
// in the Championship's bottom three forever without consequence, which is
// not what relegation means. The real fix is upstream of resolveLadder — the
// page notices before rollover and makes you sign for a new club, covered by
// the next block — but resolveLadder itself must no longer special-case you.
{
  const clubs = [...CHAMPIONSHIP_CLUBS];
  const you = clubs[clubs.length - 1];       // dead last
  const career = withStandings(makeInitialCareer(playerAt(you), clubs, "championship"), clubs);
  const out = resolveLadder(career, mulberry32(17));

  check(out.relegatedFromChampionship.includes(you),
    "finishing bottom relegates your own club exactly like anybody else's");
  check(out.divisions.leagueOne.includes(you), "and it lands in League One with the rest of the bottom three");
  check(out.relegatedFromChampionship.length === 3, "still exactly three go down");
}

// ── The screen that replaces it: a real signing, and the ladder honours it ──
{
  const clubs = [...CHAMPIONSHIP_CLUBS];
  const you = clubs[clubs.length - 1];
  const career = withStandings(makeInitialCareer(playerAt(you), clubs, "championship"), clubs);
  const bottom = sortLeague(career.league).map(t => t.name).slice(-3);

  const offers = generateRelegationOffers(career, mulberry32(19));
  check(offers.length >= 1, `always at least one offer (${offers.length})`);
  check(offers.every(o => o.club !== you), "never an offer to re-sign for the club that just went down");
  check(offers.every(o => !bottom.includes(o.club)), "never an offer from one of the other relegated clubs");

  // Sign for whoever came in, exactly as the RelegationMove screen does —
  // and only THEN does the season roll over, with the ladder seeing a player
  // who already belongs to a real division.
  const moved = acceptOffer(career, offers[0]);
  const out = resolveLadder(moved, mulberry32(23));
  check(out.division === "premier" || out.division === "championship",
    `the ladder places the new club in a real division (${out.division})`);
  check((out.division === "premier" ? out.divisions.premier : out.divisions.championship).includes(offers[0].club),
    "and it is the club that was actually signed for");
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

    if (divisionOf(career) === "championship"
      && sortLeague(career.league).slice(-3).map(t => t.name).includes(career.player.club)) {
      const offers = generateRelegationOffers(career, mulberry32(season * 61 + 4));
      if (offers.length > 0) career = acceptOffer(career, offers[0]);
    }

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
    const beforeAll = [
      ...before.premier, ...before.championship, ...before.leagueOne,
      ...before.leagueTwo, ...before.nationalLeague, ...before.nationalLeagueNorth, ...before.nationalLeagueSouth,
    ];

    // Mirrors app/star-dev/page.tsx's openTransferWindowOrRoll: relegation
    // out of the Championship is not optional, so a real club has to be
    // signed for before advanceSeason runs at all — otherwise there would be
    // nothing stopping your identity from being carried into a division list
    // that no longer contains it.
    if (divisionOf(career) === "championship"
      && sortLeague(career.league).slice(-3).map(t => t.name).includes(career.player.club)) {
      const offers = generateRelegationOffers(career, mulberry32(season * 53 + 9));
      if (offers.length > 0) career = acceptOffer(career, offers[0]);
    }

    career = advanceSeason(career, false).career;
    const m = membershipOf(career);
    const all = [
      ...m.premier, ...m.championship, ...m.leagueOne,
      ...m.leagueTwo, ...m.nationalLeague, ...m.nationalLeagueNorth, ...m.nationalLeagueSouth,
    ];

    if (divisionOf(career) === "premier") seasonsInPremier++;
    if (career.ladderNews?.yourMove) moves++;

    const fail = (why: string) => { broke = `season ${season}: ${why}`; };

    if (m.premier.length !== 20) fail(`Premier League has ${m.premier.length} clubs`);
    else if (m.championship.length !== 24) fail(`Championship has ${m.championship.length} clubs`);
    else if (m.leagueOne.length !== LEAGUE_ONE_CLUBS.length) fail(`League One has ${m.leagueOne.length} clubs`);
    else if (m.leagueTwo.length !== 24) fail(`League Two has ${m.leagueTwo.length} clubs`);
    else if (m.nationalLeague.length !== 24) fail(`National League has ${m.nationalLeague.length} clubs`);
    else if (m.nationalLeagueNorth.length !== 24) fail(`National League North has ${m.nationalLeagueNorth.length} clubs`);
    else if (m.nationalLeagueSouth.length !== 24) fail(`National League South has ${m.nationalLeagueSouth.length} clubs`);
    else if (new Set(all).size !== all.length) {
      const dupes = all.filter((c, i) => all.indexOf(c) !== i);
      fail(`a club is in two places at once (${Array.from(new Set(dupes)).join(", ")})`);
    } else if (all.length !== beforeAll.length) {
      fail(`clubs appeared or vanished (${beforeAll.length} -> ${all.length})`);
    } else if (new Set(all).size !== new Set(beforeAll).size) {
      fail("the set of clubs in the world changed");
    } else if (!m[KEY_OF[divisionOf(career)]].includes(career.player.club)) {
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

// ── A corrupted 21-club Premier League heals back to 20/24/5 ────────────────
// (KEY_OF is used by the twenty-season block above; hoisted as a const.)
//
// Reported directly from a real save at season 3: the Premier League table
// held 21 clubs. The pure arithmetic above is provably correct today (the
// twenty-season stress test never drifts), so this reproduces the actual
// reported SHAPE — not by finding a code path that causes it, but by
// starting `resolveLadder` from a `career.divisions` already in that state,
// exactly like a save file that picked up the corruption from an old,
// already-fixed bug and has carried it every season since. `reconcileLadder`
// (the self-healing step in resolveLadder) has to fix a shape like this on
// the very next rollover, with no club invented and none silently dropped.
{
  const premierClubs = [...PREMIER_LEAGUE_CLUBS];
  const championshipClubs = [...CHAMPIONSHIP_CLUBS];
  const leagueOneClubs = [...LEAGUE_ONE_CLUBS];
  const leagueTwoClubs = ["Accrington Stanley", "Barnet", "Bristol Rovers", "Cheltenham Town",
    "Chesterfield", "Colchester United", "Crawley Town", "Crewe Alexandra",
    "Exeter City", "Fleetwood Town", "Gillingham", "Grimsby Town",
    "Newport County", "Northampton Town", "Oldham Athletic", "Port Vale",
    "Rochdale", "Rotherham United", "Salford City", "Shrewsbury Town",
    "Swindon Town", "Tranmere Rovers", "Walsall", "York City"];
  const nationalLeagueClubs = ["AFC Fylde", "Aldershot Town", "Altrincham", "Barrow", "Boreham Wood",
    "Boston United", "Carlisle United", "Eastleigh", "FC Halifax Town",
    "Forest Green Rovers", "Gateshead", "Harrogate Town", "Hartlepool United",
    "Hornchurch", "Kidderminster Harriers", "Scunthorpe United", "Solihull Moors",
    "Southend United", "Sutton United", "Tamworth", "Wealdstone", "Woking",
    "Worthing", "Yeovil Town"];
  const northClubs = [...NATIONAL_LEAGUE_NORTH_CLUBS];
  const southClubs = [...NATIONAL_LEAGUE_SOUTH_CLUBS];

  // The 21st Premier League club is a duplicate of a real Championship club —
  // the same name sitting in two tiers at once, which is exactly what
  // "twenty one clubs in the Premier League" looks like from inside a save
  // that also still has a full, un-shrunk Championship.
  const strayClub = championshipClubs[0];
  const corruptDivisions = {
    premier: [...premierClubs, strayClub],
    championship: [...championshipClubs],
    leagueOne: leagueOneClubs, leagueTwo: leagueTwoClubs,
    nationalLeague: nationalLeagueClubs, nationalLeagueNorth: northClubs, nationalLeagueSouth: southClubs,
  };

  const order = [...premierClubs, strayClub];
  let career = withStandings(
    makeInitialCareer(playerAt(order[0]), order, "premier"), order);
  career = { ...career, divisions: corruptDivisions };

  const out = resolveLadder(career, mulberry32(23));
  const { premier, championship, leagueOne, leagueTwo, nationalLeague, nationalLeagueNorth, nationalLeagueSouth } = out.divisions;

  check(premier.length === PREMIER_LEAGUE_CLUBS.length,
    `a corrupted 21-club Premier League heals to ${PREMIER_LEAGUE_CLUBS.length} (saw ${premier.length})`);
  check(championship.length === CHAMPIONSHIP_CLUBS.length,
    `the Championship still ends up at ${CHAMPIONSHIP_CLUBS.length} (saw ${championship.length})`);
  check(leagueOne.length === leagueOneClubs.length,
    `League One still ends up at ${leagueOneClubs.length} (saw ${leagueOne.length})`);

  const all = [...premier, ...championship, ...leagueOne, ...leagueTwo, ...nationalLeague, ...nationalLeagueNorth, ...nationalLeagueSouth];
  check(new Set(all).size === all.length, "no club is left sitting in two tiers at once");
  check(all.length === premierClubs.length + championshipClubs.length + leagueOneClubs.length
      + leagueTwoClubs.length + nationalLeagueClubs.length + northClubs.length + southClubs.length,
    `no club was invented or dropped while healing (${all.length} total)`);
  check(new Set(all).has(strayClub), "the stray duplicate club still exists somewhere, just not doubled up");
}

// ── National League North and South: two up from each, four down, split by region ──
//
// P62 (Harry, 1 Oct 2026). Checked four ways: the fixed sizes (24 / 24 / 24)
// hold after every season of a long run played FROM each region; the real
// rule moves exactly two up from each region and four down from the
// National League, two to each; the four go to the half of the country
// they are in (northernmost to North); and a career at the bottom of a
// region simply stays there (nothing below).
{
  check(NATIONAL_LEAGUE_NORTH_CLUBS.length === 24 && NATIONAL_LEAGUE_SOUTH_CLUBS.length === 24,
    `North and South have 24 clubs each (${NATIONAL_LEAGUE_NORTH_CLUBS.length} / ${NATIONAL_LEAGUE_SOUTH_CLUBS.length})`);
  const everyLadderClub = [
    ...PREMIER_LEAGUE_CLUBS, ...CHAMPIONSHIP_CLUBS, ...LEAGUE_ONE_CLUBS, ...NATIONAL_LEAGUE_CLUBS,
    ...NATIONAL_LEAGUE_NORTH_CLUBS, ...NATIONAL_LEAGUE_SOUTH_CLUBS,
  ];
  check(new Set(everyLadderClub).size === everyLadderClub.length, "no North/South club is also on a higher tier");
  check(NATIONAL_LEAGUE_NORTH_CLUBS.every(c => divisionOfClub(c) === "national_league_north")
    && NATIONAL_LEAGUE_SOUTH_CLUBS.every(c => divisionOfClub(c) === "national_league_south"),
    "every North/South club is tagged with its own division");

  for (const [div, clubs] of [
    ["national_league_north", NATIONAL_LEAGUE_NORTH_CLUBS],
    ["national_league_south", NATIONAL_LEAGUE_SOUTH_CLUBS],
  ] as const) {
    // One season, read straight off resolveLadder.
    const order = [...clubs];
    const you = order[10];
    const career = withStandings(makeInitialCareer(playerAt(you), [...clubs], div), order);
    const out = resolveLadder(career, mulberry32(77));
    const fromYours = div === "national_league_north" ? out.promotedFromNorth : out.promotedFromSouth;
    check(out.promotedFromNorth.length === 2 && out.promotedFromSouth.length === 2,
      `${div}: two up from each region (${out.promotedFromNorth.length} / ${out.promotedFromSouth.length})`);
    check(fromYours[0] === order[0], `${div}: the champion goes up (${fromYours[0]} vs ${order[0]})`);
    check(order.slice(1, 5).includes(fromYours[1]), `${div}: the other place is a 2nd-5th play-off winner (${fromYours[1]})`);
    check(out.relegatedFromNationalLeague.length === 4, `four down from the National League (${out.relegatedFromNationalLeague.length})`);
    check(out.relegatedToNorth.length === 2 && out.relegatedToSouth.length === 2,
      `split two and two (${out.relegatedToNorth.length} / ${out.relegatedToSouth.length})`);
    const southOfNorth = Math.min(...out.relegatedToNorth.map(latitudeOf)) >= Math.max(...out.relegatedToSouth.map(latitudeOf));
    check(southOfNorth, `the northernmost two go North (${out.relegatedToNorth.join(", ")} | ${out.relegatedToSouth.join(", ")})`);
    check(out.division === div && out.yourMove === null, `${div}: a mid-table club stays put (${out.division})`);

    // Bottom of the region: nowhere to go down to.
    const last = withStandings(makeInitialCareer(playerAt(order[23]), [...clubs], div), order);
    const outLast = resolveLadder(last, mulberry32(78));
    check(outLast.division === div && outLast.yourMove === null, `${div}: finishing bottom keeps you in ${div} (${outLast.division})`);

    // Twenty seasons from inside the region, through advanceSeason.
    let c = makeInitialCareer(playerAt(clubs[3]), [...clubs], div);
    let broke = "", ups = 0;
    for (let season = 1; season <= 20 && !broke; season++) {
      const rng = mulberry32(season * 97 + (div === "national_league_north" ? 1 : 2));
      const tableOrder = [...c.league.map(t => t.name)].sort(() => rng() - 0.5);
      c = withStandings(c, tableOrder);
      const beforeDivision = divisionOf(c);
      c = advanceSeason(c, false).career;
      if (c.ladderNews?.yourMove === "promoted") ups++;
      const m = membershipOf(c);
      const sizes = [m.premier.length, m.championship.length, m.leagueOne.length, m.leagueTwo.length,
        m.nationalLeague.length, m.nationalLeagueNorth.length, m.nationalLeagueSouth.length];
      const all = [...m.premier, ...m.championship, ...m.leagueOne, ...m.leagueTwo,
        ...m.nationalLeague, ...m.nationalLeagueNorth, ...m.nationalLeagueSouth];
      if (sizes.join() !== "20,24,24,24,24,24,24") broke = `season ${season}: sizes ${sizes.join("/")}`;
      else if (new Set(all).size !== all.length) broke = `season ${season}: a club is in two divisions`;
      else if (!m[KEY_OF[divisionOf(c)]].includes(c.player.club)) broke = `season ${season}: you are not in your own division`;
      else if (c.league.length !== 24) broke = `season ${season}: ${c.league.length}-club table in ${divisionOf(c)}`;
      else if (c.fixtures.filter(f => (f.kind ?? "league") === "league").length !== 46) broke = `season ${season}: not 46 league fixtures`;
      else if (beforeDivision === divisionOf(c) && c.ladderNews?.yourMove) broke = `season ${season}: a move that went nowhere`;
    }
    check(broke === "", broke || `${div}: twenty seasons stay 20/24/24/24/24/24/24, nobody doubled up`);
    check(ups > 0, `${div}: and your club actually came up at least once in twenty seasons (${ups})`);
  }

  // A National League club finishing bottom four drops into its own region.
  {
    const order = [...NATIONAL_LEAGUE_CLUBS];
    const northern = "Gateshead", southern = "Woking";
    // Bottom four: two far north, two far south, so the rule has a clear answer.
    const bottom = ["Hartlepool United", northern, "Yeovil Town", southern];
    const ranked = [...order.filter(x => !bottom.includes(x)), ...bottom];
    for (const you of [northern, southern]) {
      const c = withStandings(makeInitialCareer(playerAt(you), [...NATIONAL_LEAGUE_CLUBS], "national_league"), ranked);
      const out = resolveLadder(c, mulberry32(5));
      const want = you === northern ? "national_league_north" : "national_league_south";
      check(out.division === want && out.yourMove === "relegated", `${you} relegated from the National League goes to ${want} (${out.division}, ${out.yourMove})`);
      check(out.clubs.length === 24, `and that table has 24 clubs (${out.clubs.length})`);
    }
  }
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exit(1);
}
console.log("PASS — three up, three down, play-offs, twenty seasons that still add up, North and South two up/four down, and a corrupted save heals itself");
