import { computeSeasonAwardStats, trophyWinners } from "../../lib/star/seasonAwards";
import { makeInitialCareer } from "../../lib/star/careerFlow";
import { PREMIER_LEAGUE_CLUBS } from "../../lib/star/clubs";
import type { CareerState, StarPlayer, SquadPlayer, LeagueSquad, LeagueResult, Trophy } from "../../lib/star/types";

/**
 * WHAT THE SEASON HANDED OUT.
 *
 * Requested directly: "I'd also like to see some more awards and trophies"
 * — the Golden Boot, the Assist King, a Golden Glove, Player and Young
 * Player of the Season, a Team of the Season, and every trophy the season
 * actually produced. These tests are about the ARITHMETIC — the right
 * name/club/number wins each award, off known stats — not about football
 * outcomes.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

function player(): StarPlayer {
  return {
    firstName: "Test", lastName: "Player", age: 24, skinTone: "light",
    club: "Arsenal", clubBadge: null, position: "ST", nationality: "England", startYear: 2027,
  } as StarPlayer;
}

function squadPlayer(over: Partial<SquadPlayer>): SquadPlayer {
  return {
    id: over.id ?? "sp", name: "Squad Player", shortName: "S. Player", position: "CM",
    seasonGoals: 0, seasonAssists: 0, careerGoals: 0, careerAssists: 0,
    ...over,
  };
}

function baseCareer(): CareerState {
  const base = makeInitialCareer(player(), [...PREMIER_LEAGUE_CLUBS]);
  return {
    ...base,
    leagueSeasonStats: { goals: 5, assists: 2 },
    squad: [
      squadPlayer({ id: "gk", name: "Own Keeper", position: "GK", overall: 70, age: 26 }),
      squadPlayer({ id: "cb", name: "Own Defender", position: "CB", overall: 68, age: 22 }),
    ],
    leagueSquads: [],
    results: [],
    trophies: [],
  };
}

// ── Golden Boot / Assist King: the real top scorer/creator wins, across
// your own squad, every other club, AND your own character ────────────────
{
  const career: CareerState = {
    ...baseCareer(),
    squad: [
      ...baseCareer().squad!,
      squadPlayer({ id: "striker", name: "Prolific Striker", position: "ST", overall: 75, leagueGoals: 18, leagueAssists: 3 }),
    ],
    leagueSquads: [
      { club: "Liverpool", players: [
        { id: "l1", name: "Liverpool Ace", position: "ST", overall: 82, goals: 24, assists: 5 },
        { id: "l2", name: "Liverpool Playmaker", position: "CAM", overall: 80, goals: 4, assists: 15 },
      ] } satisfies LeagueSquad,
      { club: "Chelsea", players: [
        { id: "c1", name: "Chelsea Winger", position: "RW", overall: 78, goals: 12, assists: 9 },
      ] } satisfies LeagueSquad,
    ],
  };
  const stats = computeSeasonAwardStats(career);
  check(stats.goldenBoot?.name === "Liverpool Ace", `Golden Boot goes to the real top scorer (got ${stats.goldenBoot?.name})`);
  check(stats.goldenBoot?.club === "Liverpool", "…correctly attributed to Liverpool");
  check(stats.goldenBoot?.value === 24, `…with the real tally (got ${stats.goldenBoot?.value})`);
  check(stats.assistKing?.name === "Liverpool Playmaker", `Assist King goes to the real top creator (got ${stats.assistKing?.name})`);
  check(stats.assistKing?.value === 15, `…with the real tally (got ${stats.assistKing?.value})`);
}

// ── Your own character is a real candidate, not just background noise ──────
{
  const career: CareerState = {
    ...baseCareer(),
    leagueSeasonStats: { goals: 30, assists: 1 },
  };
  const stats = computeSeasonAwardStats(career);
  check(stats.goldenBoot?.isYou === true, "a dominant season for your own character wins the Golden Boot");
  check(stats.goldenBoot?.value === 30, `…with your real league tally (got ${stats.goldenBoot?.value})`);
}

// ── Nobody scored: no Golden Boot rather than a false zero-goal "winner" ───
{
  const stats = computeSeasonAwardStats({ ...baseCareer(), leagueSeasonStats: { goals: 0, assists: 0 } });
  check(stats.goldenBoot === null, "no goals scored anywhere means no Golden Boot at all");
  check(stats.assistKing === null, "…and no Assist King either");
}

// ── Golden Glove: derived from the real results log, not asserted directly ─
{
  const results: LeagueResult[] = [
    { week: 1, home: "Arsenal", away: "Liverpool", hs: 2, as: 0 }, // Arsenal clean sheet
    { week: 2, home: "Chelsea", away: "Arsenal", hs: 0, as: 1 },   // Arsenal clean sheet (away)
    { week: 3, home: "Arsenal", away: "Chelsea", hs: 1, as: 1 },   // no clean sheet
    { week: 4, home: "Liverpool", away: "Chelsea", hs: 3, as: 0 }, // Liverpool clean sheet
  ];
  const career: CareerState = {
    ...baseCareer(),
    results,
    leagueSquads: [
      { club: "Liverpool", players: [{ id: "lgk", name: "Liverpool Keeper", position: "GK", overall: 85, goals: 0, assists: 0 }] },
      { club: "Chelsea", players: [{ id: "cgk", name: "Chelsea Keeper", position: "GK", overall: 80, goals: 0, assists: 0 }] },
    ],
  };
  const stats = computeSeasonAwardStats(career);
  check(stats.goldenGlove?.name === "Own Keeper", `Arsenal's two clean sheets beat Liverpool's one (got ${stats.goldenGlove?.name})`);
  check(stats.goldenGlove?.value === 2, `…with the real count (got ${stats.goldenGlove?.value})`);
  check(stats.goldenGlove?.club === "Arsenal", "…attributed to the right club");
}

// ── Player of the Season: end product can outrank raw squad rating ─────────
{
  const career: CareerState = {
    ...baseCareer(),
    squad: [
      squadPlayer({ id: "gk", name: "Own Keeper", position: "GK", overall: 70, age: 26 }),
      squadPlayer({ id: "star", name: "Prolific Forward", position: "ST", overall: 74, leagueGoals: 22, leagueAssists: 6 }),
    ],
    leagueSquads: [
      { club: "Real Highflier", players: [{ id: "h1", name: "Highly Rated Nobody", position: "CB", overall: 92, goals: 0, assists: 0 }] },
    ],
  };
  const stats = computeSeasonAwardStats(career);
  check(stats.playerOfSeason?.name === "Prolific Forward",
    `real goals and assists outweigh a bare overall rating (got ${stats.playerOfSeason?.name})`);
}

// ── Young Player of the Season: age cutoff respected, null when nobody
// young enough has a known age at all ───────────────────────────────────────
{
  const withYoungster: CareerState = {
    ...baseCareer(),
    squad: [
      squadPlayer({ id: "old", name: "Old Head", position: "CM", overall: 88, age: 33, leagueGoals: 10 }),
      squadPlayer({ id: "young", name: "Teen Prospect", position: "CAM", overall: 70, age: 18, leagueGoals: 8, leagueAssists: 4 }),
    ],
  };
  const stats = computeSeasonAwardStats(withYoungster);
  check(stats.youngPlayerOfSeason?.name === "Teen Prospect",
    `the best UNDER-22 candidate wins, not simply the best candidate (got ${stats.youngPlayerOfSeason?.name})`);
  check(stats.playerOfSeason?.name === "Old Head", "…while Player of the Season itself has no age limit");

  const nobodyYoung: CareerState = {
    ...baseCareer(),
    squad: [squadPlayer({ id: "old", name: "Old Head", position: "CM", overall: 88, age: 33 })],
  };
  check(computeSeasonAwardStats(nobodyYoung).youngPlayerOfSeason === null,
    "nobody with a known age of 21 or under means no Young Player of the Season");
}

// ── Team of the Season: eleven real, distinct players, no duplicates ───────
{
  const squads: LeagueSquad[] = PREMIER_LEAGUE_CLUBS.filter(c => c !== "Arsenal").map((club, i) => ({
    club,
    players: Array.from({ length: 16 }, (_, j) => ({
      id: `${club}-${j}`, name: `${club} Player ${j}`,
      position: (["GK", "CB", "CB", "RB", "LB", "CDM", "CM", "CM", "RW", "LW", "ST"] as const)[j % 11],
      overall: 60 + ((i * 7 + j * 3) % 30), goals: j, assists: j,
    })),
  }));
  const career: CareerState = { ...baseCareer(), leagueSquads: squads };
  const stats = computeSeasonAwardStats(career);
  check(stats.teamOfSeason.length === 11, `Team of the Season fields a full eleven (got ${stats.teamOfSeason.length})`);
  const keys = stats.teamOfSeason.map(m => `${m.name}@${m.club}`);
  check(new Set(keys).size === keys.length, "…with no player picked for two slots at once");
  check(stats.teamOfSeason.some(m => m.role === "GK"), "…including a goalkeeper");
}

// ── Team of the Season agrees with Player of the Season ────────────────────
//
// Reported directly: Team of the Season used to rank purely on overall, a
// DIFFERENT number from the one Player of the Season is actually decided
// on (overall plus real goals/assists — see compositeScore) — so the
// reigning Player of the Season could miss his own team of the season
// entirely. A real season's end product has to count in both places the
// same way, or the two awards visibly disagree about who had the season.
{
  // A full, ordinary division to fill the other ten slots from, so the
  // striker's slot is decided on its own merits rather than by an empty
  // pool — every outfielder has SOME fitness for every outfield slot (see
  // formations.ts's fitness), so a thin pool gets eaten by the back four
  // before the forwards are ever reached.
  const filler: LeagueSquad[] = PREMIER_LEAGUE_CLUBS.filter(c => c !== "Arsenal").map((club, i) => ({
    club,
    players: Array.from({ length: 12 }, (_, j) => ({
      id: `${club}-${j}`, name: `${club} Player ${j}`,
      position: (["GK", "CB", "CB", "RB", "LB", "CDM", "CM", "CM", "RW", "LW", "CAM"] as const)[j % 11],
      overall: 60 + ((i * 5 + j * 3) % 20), goals: 0, assists: 0,
    })),
  }));
  const career: CareerState = {
    ...baseCareer(),
    // Your own modest-overall striker, but a season nobody at the position
    // can match on end product.
    squad: [squadPlayer({ id: "star", name: "Prolific Forward", position: "ST", overall: 74, leagueGoals: 22, leagueAssists: 6 })],
    leagueSquads: [
      // A much higher-rated striker elsewhere, but a blank season — exactly
      // the case raw overall alone used to pick over the real Player of the
      // Season.
      { club: "Real Highflier", players: [{ id: "h1", name: "Highly Rated Nobody", position: "ST", overall: 92, goals: 0, assists: 0 }] },
      ...filler,
    ],
  };
  const stats = computeSeasonAwardStats(career);
  check(stats.playerOfSeason?.name === "Prolific Forward",
    `the real season wins Player of the Season (got ${stats.playerOfSeason?.name})`);
  const stSlot = stats.teamOfSeason.find(m => m.role === "ST");
  check(stSlot?.name === "Prolific Forward",
    `…and the SAME player takes the striker slot in Team of the Season, not the higher-rated blank season (got ${stSlot?.name})`);
}

// ── Trophy winners: yours, the division's, and honestly unknown ────────────
{
  const trophies: Trophy[] = [
    { season: 3, competition: "Premier League", club: "Arsenal" },
    { season: 3, competition: "Community Shield", club: "Arsenal" },
  ];
  const career: CareerState = {
    ...baseCareer(),
    season: 3,
    trophies,
    lastSeasonWinners: {
      league: "Arsenal", faCup: "Chelsea", leagueCup: "Liverpool",
      championsLeague: "Real Madrid", europaLeague: "Roma",
    },
  };
  const stats = { ...computeSeasonAwardStats(career), season: 3, leagueName: "Premier League" };
  const trophyList = trophyWinners(career, stats);

  const pl = trophyList.find(t => t.competition === "Premier League");
  check(pl?.club === "Arsenal" && pl?.isYou === true, "your own trophy reports as yours");

  const faCup = trophyList.find(t => t.competition === "FA Cup");
  check(faCup?.club === "Chelsea" && faCup?.isYou === false, "a division-wide winner you did not win reports correctly, not as yours");

  const shield = trophyList.find(t => t.competition === "Community Shield");
  check(shield?.club === "Arsenal" && shield?.isYou === true, "a Community Shield you actually played and won is recorded");

  // A Super Cup you were never in still has a real answer — pointed out
  // directly: this game already knows both contestants (that season's
  // Champions League and Europa League winners), so it can guess who won,
  // the same weighted way crownWithoutYou already guesses a European
  // trophy you were not there for. It is still labelled as a guess, not
  // presented with the same confidence as a real result.
  const superCup = trophyList.find(t => t.competition === "Super Cup");
  check(superCup?.club === "Real Madrid" || superCup?.club === "Roma",
    `a Super Cup you were never in still gets a real guessed winner, from the two real contestants (got ${superCup?.club})`);
  check(superCup?.isGuess === true, "…clearly marked as a guess, not a settled result");
  check(superCup?.isYou === false, "…and never marked as yours, since you were not in it");
}

// ── The Double: the runner-up takes the champion's Community Shield slot ───
//
// Arsenal won both the league AND the FA Cup, so the Shield cannot be
// "Arsenal v Arsenal" — the real competition plays the league runner-up in
// the champion's place. Checked by actually seeing BOTH Arsenal (the FA Cup
// holder) and Liverpool (the runner-up standing in) win across several
// seeds: if the Double substitution were broken and Liverpool never
// actually entered the guess as a contestant, only Arsenal could ever come
// out, seed after seed.
{
  const seenWinners = new Set<string>();
  for (let season = 1; season <= 30; season++) {
    const career: CareerState = {
      ...baseCareer(),
      season,
      trophies: [],
      lastSeasonWinners: {
        league: "Arsenal", leagueRunnerUp: "Liverpool", faCup: "Arsenal", // the Double
        leagueCup: "Chelsea", championsLeague: "Real Madrid", europaLeague: "Roma",
      },
    };
    const stats = computeSeasonAwardStats(career);
    const shield = trophyWinners(career, stats).find(t => t.competition === "Community Shield");
    if (shield?.club) seenWinners.add(shield.club);
  }
  check(seenWinners.has("Liverpool"),
    `the runner-up genuinely stands in for the champion's own Double and can win (seen: ${[...seenWinners].join(", ")})`);
  check(seenWinners.has("Arsenal"), "…and the actual FA Cup holder remains the other real contestant");
}

// ── …and genuinely unknown when there is nothing to guess FROM ─────────────
{
  // Season 1 has no predecessor at all — makeInitialCareer never sets
  // lastSeasonWinners, matching seedPreSeason's own "season 1 cannot have
  // either" rule.
  const career = baseCareer();
  const stats = computeSeasonAwardStats(career);
  const trophyList = trophyWinners(career, stats);
  const shield = trophyList.find(t => t.competition === "Community Shield");
  const superCup = trophyList.find(t => t.competition === "Super Cup");
  check(shield?.club === null && !shield?.isGuess, "no predecessor season means no Community Shield guess either");
  check(superCup?.club === null && !superCup?.isGuess, "…and no Super Cup guess");
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems.slice(0, 25)) console.log(`  ✗ ${p}`);
  if (problems.length > 25) console.log(`  ...and ${problems.length - 25} more`);
  process.exit(1);
}
console.log("PASS — Golden Boot/Assist King/Golden Glove/Player of the Season all pick the real numbers, Team of the Season fields eleven distinct players, and trophy winners are honest about what this game does and doesn't know");
