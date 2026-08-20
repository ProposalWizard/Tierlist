import { buildFixtures, playLeagueWeek, buildLeague, mulberry32, updateLeagueWithUserResult } from "../../lib/star/season";
import {
  buildLeagueSquad, nameGoals, resetLeagueSquads, mergeLeagueSquadStats,
  shouldUpgradeLeagueSquads, type RosterRow,
} from "../../lib/star/leagueSquads";
import { goldenBootRace, assistRace } from "../../lib/star/recognition";
import { makeInitialCareer, creditMatchResult } from "../../lib/star/careerFlow";
import type { CareerState, LeagueSquad } from "../../lib/star/types";
import { shouldUpgradeSquad, mergeSquadStats } from "../../lib/star/realSquad";
import { generateSquad } from "../../lib/star/squadData";

/**
 * EVERY GOAL IN THE DIVISION BELONGS TO SOMEBODY.
 *
 * 380 league games a season, of which you play 38. The other 342 used to
 * produce a scoreline and nothing else, and the Golden Boot chart beside them
 * was not a count at all — one invented player per club, first name and surname
 * drawn from two lists, with a tally derived from a formula on team strength
 * times how far through the season it was. Nobody had scored any of them.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

function mulberry(a: number) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CLUBS = [
  "Liverpool", "Arsenal", "Man City", "Chelsea", "Tottenham Hotspur", "Manchester United",
  "Newcastle United", "Aston Villa", "Brighton", "West Ham United", "Everton", "Fulham",
  "Crystal Palace", "Brentford", "Wolverhampton Wanderers", "Nottingham Forest",
  "AFC Bournemouth", "Leeds United", "Burnley", "Sunderland",
];
const USER = "Liverpool";

/** A roster shaped like the endpoint's, so the builder is exercised for real. */
function roster(club: string, n = 26): RosterRow[] {
  const rng = mulberry(club.length * 31 + n);
  const POS = ["GK", "CB", "CB,LB", "RB", "LB", "CDM", "CM", "CM,CAM", "CAM", "LW", "RW", "ST", "ST,CF"];
  return Array.from({ length: n }, (_, i) => ({
    id: `${club}-${i}`,
    name: `${club.slice(0, 3)}Player${i}`,
    positions: POS[i % POS.length],
    overall: 60 + Math.floor(rng() * 32),
  }));
}

// ── A squad is a shape, not the twenty best players ─────────────────────────
{
  for (const club of CLUBS.slice(0, 6)) {
    const sq = buildLeagueSquad(club, roster(club));
    check(sq.players.length === 20, `${club}: twenty players (${sq.players.length})`);
    check(new Set(sq.players.map(p => p.id)).size === 20, `${club}: nobody appears twice`);
    const gks = sq.players.filter(p => p.position === "GK").length;
    check(gks === 2, `${club}: two goalkeepers, not four or none (${gks})`);
    check(sq.players.some(p => p.position === "ST"), `${club}: somebody plays up front`);
    check(sq.players.some(p => p.position === "LB") && sq.players.some(p => p.position === "RB"),
      `${club}: and there are full-backs on both sides`);
    check(sq.players.every(p => p.goals === 0 && p.assists === 0), `${club}: nobody starts with a goal`);
  }

  // A club with nobody in the database still fields a team.
  const empty = buildLeagueSquad("Nowhere FC", []);
  check(empty.players.length === 20, "a club with no rows still has a squad");
  check(empty.players.every(p => p.name.length > 0), "…and every one of them has a name");

  // ── A thin club fields a short squad of REAL players ──
  //
  // This used to assert the opposite — that nine men were topped up to twenty
  // from `generatedSquad`, whose names are a random first name and a random
  // surname off two lists of real footballers. That produced "Andres Modric"
  // and "Vinicius Muller" sitting in West Ham's actual squad, reported as
  // exactly that. Nine substitutes is a maximum a team sheet is ALLOWED, never
  // a quota it has to meet, so a club with nine players now has nine players.
  const thin = buildLeagueSquad("Thin FC", roster("Thin FC", 9));
  check(thin.players.length === 9,
    `a nine-man roster stays nine men, not padded with invented ones (${thin.players.length})`);
  check(thin.players.every(p => !p.id.startsWith("gen:")),
    "and every one of them is a real row from the database");

  // ── …and the squad builder wants the whole register ──
  //
  // The twenty is what a CAREER keeps: it exists to answer "who scored?", and a
  // club's twenty-fifth choice never will. Picking a side is a different
  // question, and a side is picked from everybody on the books — reported as
  // "it's not showing everyone in a squad, only 9 players on the bench".
  for (const club of ["Arsenal", "Chelsea"]) {
    const full = buildLeagueSquad(club, roster(club, 28), true);
    const lean = buildLeagueSquad(club, roster(club, 28));
    check(lean.players.length === 20, `${club}: a career keeps twenty (${lean.players.length})`);
    check(full.players.length === 28, `${club}: the builder keeps all 28 (${full.players.length})`);
    check(new Set(full.players.map(p => p.id)).size === 28, `${club}: nobody is duplicated in the full squad`);
    // The first twenty are the same men in the same order — the shape is filled
    // before the leftovers are appended.
    check(full.players.slice(0, 20).every((p, i) => p.id === lean.players[i].id),
      `${club}: the side and the bench come first, the rest after`);
    // And everybody has a position we can put on a shirt.
    const VALID = ["GK", "CB", "LB", "RB", "CDM", "CM", "CAM", "LW", "RW", "ST"];
    check(full.players.every(p => VALID.includes(p.position)),
      `${club}: everybody has a position the pitch understands`);
  }
  // A club with nothing in the database is not padded to a fictional 28.
  check(buildLeagueSquad("Nowhere FC", [], true).players.length === 20,
    "an empty club still falls back to a generated twenty");
}

// ── Goals go to the men who would score them ────────────────────────────────
{
  const sq = buildLeagueSquad("Arsenal", roster("Arsenal"));
  const rng = mulberry(4242);
  const by: Record<string, number> = {};
  let assisted = 0, total = 0;
  for (let i = 0; i < 4000; i++) {
    for (const g of nameGoals(sq, 2, rng)) {
      total += 1;
      if (g.a) assisted += 1;
      if (g.a === g.s) by.SELF = (by.SELF ?? 0) + 1;
    }
  }
  for (const p of sq.players) by[p.position] = (by[p.position] ?? 0) + p.goals;

  const tally = sq.players.reduce((n, p) => n + p.goals, 0);
  check(tally === total, `every goal landed on somebody (${tally} of ${total})`);
  check((by.SELF ?? 0) === 0, "nobody assists his own goal");
  check(by.GK === undefined || by.GK === 0, `the goalkeeper does not score (${by.GK ?? 0})`);

  const forwards = (by.ST ?? 0) + (by.LW ?? 0) + (by.RW ?? 0) + (by.CAM ?? 0);
  const backs = (by.CB ?? 0) + (by.LB ?? 0) + (by.RB ?? 0);
  check(forwards / total > 0.65, `forwards score most of them (${((forwards / total) * 100).toFixed(0)}%)`);
  check(backs / total > 0.005 && backs / total < 0.12,
    `defenders get the odd one (${((backs / total) * 100).toFixed(1)}%)`);
  check(assisted / total > 0.5 && assisted / total < 0.75,
    `most goals are made by somebody (${((assisted / total) * 100).toFixed(0)}%)`);

  // Better players score more, without it being only the best man.
  const sorted = [...sq.players].filter(p => p.position === "ST").sort((a, b) => b.overall - a.overall);
  if (sorted.length >= 2) {
    check(sorted[0].goals > sorted[sorted.length - 1].goals,
      `the better striker outscores the worse one (${sorted[0].goals} vs ${sorted[sorted.length - 1].goals})`);
    check(sorted[sorted.length - 1].goals > 0, "…and the worse one still scores");
  }
}

// ── A season: every goal on the table has a name against it ─────────────────
{
  let league = buildLeague(CLUBS, USER);
  const squads: LeagueSquad[] = CLUBS.map(c => buildLeagueSquad(c, roster(c)));
  const rng = mulberry(99);
  let namedGoals = 0, tableGoals = 0;

  for (const f of buildFixtures(CLUBS, USER)) {
    league = updateLeagueWithUserResult(league, USER, f.opponent, 2, 1);
    const r = playLeagueWeek(league, f.week, {
      club: USER, opponent: f.opponent, home: f.home, scored: 2, conceded: 1,
    }, rng, squads);
    league = r.league;
    for (const res of r.results) {
      // Your own game is the one the squads do not cover — your scorers come off
      // the real match, and your opponent's are deliberately anonymous.
      const yours = res.home === USER || res.away === USER;
      if (yours) continue;
      check((res.hg?.length ?? 0) === res.hs, `wk${res.week} ${res.home}: ${res.hs} goals, ${res.hg?.length ?? 0} named`);
      check((res.ag?.length ?? 0) === res.as, `wk${res.week} ${res.away}: ${res.as} goals, ${res.ag?.length ?? 0} named`);
      namedGoals += (res.hg?.length ?? 0) + (res.ag?.length ?? 0);
      tableGoals += res.hs + res.as;
    }
  }
  check(namedGoals === tableGoals, `every simulated goal is named (${namedGoals}/${tableGoals})`);
  check(namedGoals > 500, `a season produces a lot of them (${namedGoals})`);

  // The squads' tallies are the same goals, counted the other way.
  const tallied = squads.reduce((n, s) => n + s.players.reduce((m, p) => m + p.goals, 0), 0);
  check(tallied === namedGoals, `the squads' tallies match the results (${tallied} vs ${namedGoals})`);

  // Somebody has had a season.
  const best = squads.flatMap(s => s.players).sort((a, b) => b.goals - a.goals)[0];
  check(best.goals >= 8 && best.goals <= 45, `the leading scorer has a believable haul (${best.goals})`);

  // A rollover wipes it, and only it.
  const fresh = resetLeagueSquads(squads);
  check(fresh.every(s => s.players.every(p => p.goals === 0 && p.assists === 0)), "a new season starts at nought");
  check(fresh.length === squads.length && fresh[0].players.length === 20, "…with the same players");
}

// ── The chart is a count, and you are in it ─────────────────────────────────
{
  const player = {
    firstName: "Mikey", lastName: "Vass", age: 16, position: "ST",
    club: USER, nationality: "England",
  } as never;
  let career: CareerState = {
    ...makeInitialCareer(player, CLUBS),
    leagueSquads: CLUBS.map(c => buildLeagueSquad(c, roster(c))),
  };

  // Before a ball is kicked, the only name on it is yours, on nought.
  const opening = goldenBootRace(career);
  check(opening.length === 1 && opening[0].isYou, `nobody has scored before the season starts (${opening.length})`);

  const stats = {
    homeScore: 3, awayScore: 0, chances: 2, goals: 2, assists: 1, passes: 10,
    rating: 8.4, starMan: true, bossChange: 0, teamChange: 0, fansChange: 0,
    wage: 0, goalBonus: 0, sponsorPay: 0, totalCash: 0,
    goalEvents: [
      { minute: 20, scorer: "Mikey Vass", isUserGoal: true },
      { minute: 55, scorer: "Mikey Vass", isUserGoal: true },
      { minute: 70, scorer: career.squad[11].name, assist: "Mikey Vass", isUserGoal: false },
    ],
  } as never;

  for (let i = 0; i < 6; i++) {
    const fixture = career.fixtures.find(f => !f.played)!;
    career = creditMatchResult(career, fixture, stats).career;
  }

  const race = goldenBootRace(career);
  const you = race.find(r => r.isYou)!;
  check(you.goals === 12, `your goals are counted (${you.goals})`);
  check(race.length > 20, `so is everybody else's (${race.length} scorers in the division)`);
  check(race.every((r, i) => i === 0 || r.goals <= race[i - 1].goals), "the chart is in order");
  check(race.filter(r => r.club === USER && !r.isYou).length > 0, "your team-mates are in it too");
  // Nobody in the chart is from a club that does not exist.
  check(race.every(r => CLUBS.includes(r.club)), "every scorer plays for a club in the division");

  const assists = assistRace(career);
  const yourAssists = assists.find(r => r.isYou)!;
  check(yourAssists.goals === 6, `your assists are counted (${yourAssists.goals})`);
  check(assists.length > 20, `and the division's (${assists.length} creators)`);

  // The save stays small.
  const kb = JSON.stringify(career).length / 1024;
  check(kb < 400, `six weeks in, the career is ${kb.toFixed(0)} KB`);
}

// ── A generated squad always upgrades to the real one ───────────────────────
//
// The rule used to be "…and only if nothing has been earned on it", which meant
// a career that had played two matches with its invented eleven was locked out
// of real players for the rest of the save. Reported as exactly that: Liverpool
// and Man United on real squads, Chelsea permanently on made-up ones.
{
  const invented = generateSquad("chelsea");
  check(shouldUpgradeSquad(invented), "an invented squad is replaced");

  const played = invented.map((p, i) => ({ ...p, careerGoals: i === 3 ? 11 : 0, seasonGoals: i === 3 ? 4 : 0 }));
  check(shouldUpgradeSquad(played), "…even after the invented team-mates have scored");

  const real = invented.map((p, i) => ({ ...p, sofifaId: String(1000 + i) }));
  check(!shouldUpgradeSquad(real), "a real squad is left alone");

  const mixed = real.map((p, i) => (i === 0 ? { ...p, sofifaId: undefined } : p));
  check(!shouldUpgradeSquad(mixed), "…and so is one that is mostly real");

  check(shouldUpgradeSquad([]), "an empty squad is filled");
}

// ── …and so does a division fetched before faces and flags existed ──────────
//
// image_url and nationality joined the league-squads query after clubs started
// being cached, and a career already holding a full leagueSquads list never
// re-fetches on its own — the fetch only fires when the list is empty. Reported
// as exactly this: the versus screen drew photographs and flags for your own
// squad and bare initials for the other nineteen clubs, because your own squad
// comes through a path that always carried those fields and the division did
// not.
{
  const withoutEither: LeagueSquad[] = [
    { club: "Arsenal", players: [{ id: "a1", name: "Saka", position: "RW", overall: 88, goals: 0, assists: 0 }] },
  ];
  check(shouldUpgradeLeagueSquads(withoutEither), "a division with no faces or flags at all is upgraded");

  const withImageOnly: LeagueSquad[] = [
    { club: "Arsenal", players: [{ id: "a1", name: "Saka", position: "RW", overall: 88, goals: 0, assists: 0, image: "https://cdn/a1.png" }] },
  ];
  check(shouldUpgradeLeagueSquads(withImageOnly),
    "…and so is one with photographs but no nationality — nation is the signal, not image");

  const withNation: LeagueSquad[] = [
    { club: "Arsenal", players: [{ id: "a1", name: "Saka", position: "RW", overall: 88, goals: 0, assists: 0, nation: "England" }] },
  ];
  check(!shouldUpgradeLeagueSquads(withNation), "a division that has nationalities is left alone");

  // Real life: twenty clubs, and only one player anywhere needs a nation set to
  // prove the fetch already carries the field — a sparse import is not a stale
  // cache.
  const mostlyBare: LeagueSquad[] = CLUBS.map((c, i) => ({
    club: c,
    players: [{ id: `${c}-1`, name: "Somebody", position: "CM" as const, overall: 70, goals: 0, assists: 0,
      ...(i === 0 ? { nation: "France" } : {}) }],
  }));
  check(!shouldUpgradeLeagueSquads(mostlyBare),
    "one real nationality anywhere in the division is enough to trust the rest of the import");

  check(!shouldUpgradeLeagueSquads([]), "no division at all is not a stale one — there is nothing to upgrade yet");

  // ── The later bug: a full division, nations present, images mostly gone ──
  //
  // A cloud save loaded before a squad's image merge finished — or simply
  // written back over a fuller local copy by an older cloud snapshot — has
  // real nations throughout (nation and image come off the same fetched row)
  // but only a scattering of images. That is not "some players legitimately
  // have no photo"; a real fetch never returns one field without the other, so
  // plenty of nations paired with almost none of the matching images is the
  // regression, not a sparse import. Reported as exactly that: "these players
  // all had images before".
  const regressed: LeagueSquad[] = CLUBS.map(c => ({
    club: c,
    players: Array.from({ length: 20 }, (_, i) => ({
      id: `${c}-${i}`, name: `Player ${i}`, position: "CM" as const, overall: 70,
      goals: 0, assists: 0, nation: "England",
      // Just one photograph survives per club, out of twenty real entries.
      ...(i === 0 ? { image: `https://cdn/${c}-0.png` } : {}),
    })),
  }));
  check(shouldUpgradeLeagueSquads(regressed),
    "a division with nations everywhere but images almost nowhere is stale, not sparse");

  // …but a genuinely well-covered division, real players here and there simply
  // without a photo, is not treated as broken for it.
  const healthy: LeagueSquad[] = CLUBS.map(c => ({
    club: c,
    players: Array.from({ length: 20 }, (_, i) => ({
      id: `${c}-${i}`, name: `Player ${i}`, position: "CM" as const, overall: 70,
      goals: 0, assists: 0, nation: "England",
      ...(i < 17 ? { image: `https://cdn/${c}-${i}.png` } : {}),
    })),
  }));
  check(!shouldUpgradeLeagueSquads(healthy),
    "…most of the division photographed is left alone (17/20 per club is not a regression)");
}

// ── Refreshing a squad keeps what happened in it ────────────────────────────
//
// FC 27 is being written by hand while careers are being played, so a career
// has to be able to say "bring my edits in". The squads change; the eleven
// goals your centre-forward has scored do not.
{
  const before = generateSquad("liverpool").map((p, i) => ({
    ...p,
    sofifaId: String(9000 + i),
    seasonGoals: i, seasonAssists: i * 2,
    careerGoals: i * 3, careerAssists: i * 4,
    leagueGoals: i, leagueAssists: i * 2,
  }));
  // The same men, re-rated and one of them at a new club — an edit, in other
  // words — plus a signing who was not there before.
  const fresh = before.map((p, i) => ({
    ...p, overall: (p.overall ?? 70) + 3, name: `${p.name}`,
    seasonGoals: 0, seasonAssists: 0, careerGoals: 0, careerAssists: 0,
    leagueGoals: 0, leagueAssists: 0,
  })).slice(1).concat([{
    ...before[0], id: "new-signing", sofifaId: "12345", name: "New Signing",
    seasonGoals: 0, seasonAssists: 0, careerGoals: 0, careerAssists: 0,
  }]);

  const merged = mergeSquadStats(fresh, before);
  check(merged.length === fresh.length, "the fresh squad is the one you keep");
  const kept = merged.find(p => p.sofifaId === "9005")!;
  check(kept.seasonGoals === 5 && kept.careerAssists === 20,
    `a man who is still there keeps his numbers (${kept.seasonGoals}G ${kept.careerAssists}A)`);
  check(kept.overall === (before[5].overall ?? 70) + 3, "…and takes the new rating");
  const signing = merged.find(p => p.sofifaId === "12345")!;
  check(signing.seasonGoals === 0, "a new signing arrives on nought");
  check(!merged.some(p => p.sofifaId === "9000" && p.name !== "New Signing"),
    "and a man who has left is gone");

  // The other nineteen, the same way.
  const div = [buildLeagueSquad("Arsenal", roster("Arsenal"))];
  div[0].players[2].goals = 7;
  div[0].players[2].assists = 3;
  const freshDiv = [buildLeagueSquad("Arsenal", roster("Arsenal"))];
  const mergedDiv = mergeLeagueSquadStats(freshDiv, div);
  check(mergedDiv[0].players[2].goals === 7, `a rival's tally survives too (${mergedDiv[0].players[2].goals})`);
  check(mergedDiv[0].players[0].goals === 0, "…and nobody else gains one");
}

if (problems.length) {
  console.error("FAIL");
  for (const p of problems.slice(0, 15)) console.error("  ✗ " + p);
  if (problems.length > 15) console.error(`  …and ${problems.length - 15} more`);
  process.exit(1);
}
console.log("PASS — every goal in the division belongs to a named player, and the charts count them");
