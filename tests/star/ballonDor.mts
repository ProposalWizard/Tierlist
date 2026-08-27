import { computeBallonDorShortlist, trophyTierOf } from "../../lib/star/ballonDor";
import { leagueMultiplierFor, isBigFiveLeagueClub } from "../../lib/star/clubLeagues";
import { resolveSeasonWinners } from "../../lib/star/careerFlow";
import { makeInitialCareer } from "../../lib/star/careerFlow";
import { PREMIER_LEAGUE_CLUBS } from "../../lib/star/clubs";
import type { CareerState, StarPlayer, LeagueSquad, Trophy } from "../../lib/star/types";
import type { CupState } from "../../lib/star/cups";

/**
 * THE BALLON D'OR SHORTLIST.
 *
 * Requested directly, after the first ceremony: trophies should score
 * points (tiered — Champions League/your league/an international trophy
 * above the Europa League/FA Cup, above the League Cup, above the Super
 * Cup/Community Shield), rivals should be judged off real numbers wherever
 * this game actually has them, and a season in a weaker league should
 * count for less than one in the Premier League/LaLiga/the Bundesliga/
 * Ligue 1/Serie A. These tests are about the ARITHMETIC — the right
 * points, the right multiplier, the right shortlist — not the ceremony's
 * own reveal animation.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

function player(overrides: Partial<StarPlayer> = {}): StarPlayer {
  return {
    firstName: "Test", lastName: "Player", age: 24, skinTone: "light",
    club: "Arsenal", clubBadge: null, position: "ST", nationality: "England", startYear: 2027,
    ...overrides,
  } as StarPlayer;
}

function baseCareer(): CareerState {
  const base = makeInitialCareer(player(), [...PREMIER_LEAGUE_CLUBS]);
  return { ...base, leagueSquads: [], externalSquads: [], trophies: [] };
}

// ── Trophy tiers ─────────────────────────────────────────────────────────
{
  check(trophyTierOf("Champions League") === "major", "the Champions League is a major trophy");
  check(trophyTierOf("Premier League") === "major", "so is your own league's title");
  check(trophyTierOf("Championship") === "major", "…whichever division it actually is");
  check(trophyTierOf("World Cup") === "major", "…and a World Cup");
  check(trophyTierOf("European Championship") === "major", "…or a Euros");
  check(trophyTierOf("Europa League") === "medium", "the Europa League is a medium trophy");
  check(trophyTierOf("FA Cup") === "medium", "so is the FA Cup");
  check(trophyTierOf("League Cup") === "minor", "the League Cup is a minor trophy");
  check(trophyTierOf("Super Cup") === "small", "the Super Cup is a small one");
  check(trophyTierOf("Community Shield") === "small", "…and so is the Community Shield");
  check(trophyTierOf("Not A Real Trophy") === null, "an unknown competition has no tier at all");

  // The tiers actually rank the way they were asked for.
  const pts = (c: string) => trophyTierOf(c);
  const order = ["small", "minor", "medium", "major"];
  check(order.indexOf(pts("Champions League")!) > order.indexOf(pts("Europa League")!),
    "major genuinely outranks medium");
  check(order.indexOf(pts("Europa League")!) > order.indexOf(pts("League Cup")!),
    "medium genuinely outranks minor");
  check(order.indexOf(pts("League Cup")!) > order.indexOf(pts("Super Cup")!),
    "minor genuinely outranks small");
}

// ── League multiplier ───────────────────────────────────────────────────
{
  check(leagueMultiplierFor("Arsenal") === 1, "a Premier League club gets full credit");
  check(leagueMultiplierFor("Real Madrid") === 1, "…and LaLiga");
  check(leagueMultiplierFor("FC Bayern München") === 1, "…and the Bundesliga");
  check(leagueMultiplierFor("Paris Saint-Germain") === 1, "…and Ligue 1");
  check(leagueMultiplierFor("Napoli") === 1, "…and Serie A");
  check(leagueMultiplierFor("FC Red Bull Salzburg") < 1, "Austria's Bundesliga is not one of the five, despite the branding");
  check(leagueMultiplierFor("Al Hilal") < 1, "the Saudi Pro League gets the lower multiplier");
  check(leagueMultiplierFor("FC Porto") < 1, "…and Portugal's own top flight");
  check(leagueMultiplierFor("Queens Park Rangers") < 1, "…and the Championship — English, but not top flight");
  check(!isBigFiveLeagueClub("Al Nassr"), "isBigFiveLeagueClub agrees");
  check(isBigFiveLeagueClub("Liverpool"), "…in both directions");
}

// ── Trophies genuinely move the score, tiered correctly ────────────────
//
// resolveSeasonWinners (careerFlow.ts) reads who actually won the league
// off the real table, and who won the FA Cup off the real cup bracket — on
// purpose, the same source advanceSeason itself trusts — so a trophy has
// to be backed by that same real state, not just dropped into
// career.trophies on its own, for the scoring engine to see it as a club's
// actual win. Real gameplay never produces the two disagreeing (a title
// is only ever awarded once the table already says so — see
// awardLeagueTrophyIfWon); these tests build that same consistency by hand.
{
  // Someone else clearly tops the table by default — an untouched, all-zero
  // table would leave every club tied, and Arsenal (first in the array)
  // would win that tie by construction, silently crediting the trophy in
  // the "without" case too.
  const someoneElseWonTheLeague = baseCareer().league.map(t =>
    t.name === "Liverpool" ? { ...t, points: 200, goalsFor: 200, goalsAgainst: 0 } : t);
  const withoutTrophy: CareerState = {
    ...baseCareer(),
    season: 2, league: someoneElseWonTheLeague,
    seasonStats: { appearances: 30, goals: 10, hatTricks: 0, passes: 0, assists: 5, starMan: 2, totalRating: 30 * 7, ratingCount: 30 },
  };
  const leagueTrophy: Trophy = { season: 2, competition: "Premier League", club: "Arsenal" };
  const arsenalWonTheLeague = withoutTrophy.league.map(t =>
    t.name === "Arsenal" ? { ...t, points: 300, goalsFor: 300, goalsAgainst: 0 } : t);
  const withMajor: CareerState = { ...withoutTrophy, league: arsenalWonTheLeague, trophies: [leagueTrophy] };

  const shieldTrophy: Trophy = { season: 2, competition: "Community Shield", club: "Arsenal" };
  const withSmall: CareerState = { ...withoutTrophy, trophies: [shieldTrophy] };

  const scoreOf = (c: CareerState) => computeBallonDorShortlist(c).entries.find(e => e.isPlayer)?.score ?? 0;
  const base = scoreOf(withoutTrophy);
  const major = scoreOf(withMajor);
  const small = scoreOf(withSmall);
  check(major > base, `winning your league genuinely raises the score (${base} -> ${major})`);
  check(small > base, `so does the Community Shield, just less (${base} -> ${small})`);
  check(major - base > small - base, `a major trophy is worth clearly more than a small one (+${major - base} vs +${small - base})`);
}

// ── A real domestic rival is judged on his REAL tracked numbers ────────────
{
  const rivalSquad: LeagueSquad = {
    club: "Liverpool",
    players: [
      { id: "star", name: "Prolific Striker", position: "ST", overall: 82, goals: 28, assists: 6 },
      { id: "dud", name: "Quiet Squad Player", position: "CM", overall: 82, goals: 0, assists: 0 },
    ],
  };
  const career: CareerState = {
    ...baseCareer(), season: 2, leagueSquads: [rivalSquad],
    seasonStats: { appearances: 30, goals: 2, hatTricks: 0, passes: 0, assists: 1, starMan: 0, totalRating: 30 * 6.2, ratingCount: 30 },
  };
  const { entries } = computeBallonDorShortlist(career);
  const star = entries.find(e => e.name === "Prolific Striker");
  const dud = entries.find(e => e.name === "Quiet Squad Player");
  check(!!star, "the real 28-goal season shows up on the shortlist at all");
  check(star!.score > (dud?.score ?? 0),
    `…and clearly outscores an identically-rated team-mate who never actually scored (${star?.score} vs ${dud?.score ?? "not even on the list"})`);
  check(star!.goals === 28 && star!.assists === 6, `his real season, not an estimate (${star?.goals}G ${star?.assists}A)`);
}

// ── The league multiplier applies to the WHOLE score, not just trophies ────
{
  const bigFive: LeagueSquad = { club: "Napoli", players: [{ id: "a", name: "Big Five Rival", position: "ST", overall: 80, goals: 20, assists: 5 }] };
  const other: LeagueSquad = { club: "FC Porto", players: [{ id: "b", name: "Other League Rival", position: "ST", overall: 80, goals: 20, assists: 5 }] };
  const career: CareerState = { ...baseCareer(), season: 2, leagueSquads: [bigFive, other] };
  const { entries } = computeBallonDorShortlist(career);
  const a = entries.find(e => e.name === "Big Five Rival")!;
  const b = entries.find(e => e.name === "Other League Rival")!;
  check(a.score > b.score, `identical stats, but the Serie A season outscores the Portuguese one (${a.score} vs ${b.score})`);
  check(Math.abs(a.score - b.score / 0.75) < 1, `…by exactly the stated multiplier, not a fudge (${a.score} vs ${(b.score / 0.75).toFixed(1)})`);
}

// ── An international trophy is yours alone, never a club's ─────────────────
{
  const rivalSquad: LeagueSquad = { club: "Liverpool", players: [{ id: "r", name: "Club Rival", position: "ST", overall: 80, goals: 15, assists: 3 }] };
  const withCup: CareerState = {
    ...baseCareer(), season: 4, leagueSquads: [rivalSquad],
    trophies: [{ season: 4, competition: "World Cup", club: "Arsenal" }],
    seasonStats: { appearances: 30, goals: 15, hatTricks: 0, passes: 0, assists: 3, starMan: 0, totalRating: 30 * 7, ratingCount: 30 },
  };
  const { entries } = computeBallonDorShortlist(withCup);
  const you = entries.find(e => e.isPlayer)!;
  const rival = entries.find(e => e.name === "Club Rival")!;
  check(you.trophies.includes("World Cup"), "the World Cup shows up on your own entry");
  check(!rival.trophies.includes("World Cup"), "…and nowhere near a team-mate who shares your CLUB but not your nation's tournament");
}

// ── The shortlist is a real top ten, and it is deterministic ───────────────
{
  const squads: LeagueSquad[] = PREMIER_LEAGUE_CLUBS.filter(c => c !== "Arsenal").map((club, i) => ({
    club,
    players: Array.from({ length: 18 }, (_, j) => ({
      id: `${club}-${j}`, name: `${club} Player ${j}`,
      position: (["GK", "CB", "CB", "RB", "LB", "CDM", "CM", "CM", "RW", "LW", "ST"] as const)[j % 11],
      overall: 60 + ((i * 7 + j * 3) % 35), goals: (j * 3 + i) % 20, assists: (j * 2 + i) % 12,
    })),
  }));
  const career: CareerState = { ...baseCareer(), season: 3, leagueSquads: squads };
  const first = computeBallonDorShortlist(career);
  const second = computeBallonDorShortlist(career);
  check(first.entries.length <= 10, `at most ten make the shortlist (${first.entries.length})`);
  check(first.entries.length > 0, "…and it is not empty given a real division to draw from");
  check(JSON.stringify(first.entries) === JSON.stringify(second.entries),
    "the exact same career produces the exact same shortlist twice — nothing in here uses Math.random");
  const sorted = first.entries.every((e, i) => i === 0 || first.entries[i - 1].score >= e.score);
  check(sorted, "the shortlist is genuinely sorted by score, best first");
  check(first.entries.every((e, i) => e.rank === i + 1), "ranks are 1..N in order, no gaps or duplicates");
}

// ── resolveSeasonWinners resolves BEFORE rollover, which is the whole point ─
//
// finishCupToWinner/resolveSeasonWinners read the winner off career.cupState
// itself (an already-decided bracket), not career.trophies — so the fixture
// needs a real CupState with its winner already set, the same as a genuinely
// finished cup would look.
{
  const faCup: CupState = { competition: "FA Cup", rounds: [], winner: "Chelsea" };
  const career: CareerState = { ...baseCareer(), season: 5, cupState: [faCup] };
  const winners = resolveSeasonWinners(career);
  check(winners.faCup === "Chelsea", `a real winner this season resolves correctly, whoever it was (${winners.faCup})`);
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems.slice(0, 25)) console.log(`  ✗ ${p}`);
  if (problems.length > 25) console.log(`  ...and ${problems.length - 25} more`);
  process.exit(1);
}
console.log("PASS — trophies score in the right tiers, real rivals are judged on real numbers, the league multiplier applies fairly, and the shortlist is a real, deterministic top ten");
