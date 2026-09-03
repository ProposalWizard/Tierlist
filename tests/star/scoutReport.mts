import { scoutReportFor, keyInsightFor } from "../../lib/star/scoutReport";
import { groundFor, crowdFor, GROUNDS } from "../../lib/star/stadiums";
import { makeInitialCareer, creditMatchResult } from "../../lib/star/careerFlow";
import { PREMIER_LEAGUE_CLUBS } from "../../lib/star/clubs";
import { shortNameOf } from "../../lib/star/realSquad";
import { surname } from "../../lib/star/media/grammar";
import type { CareerState, Fixture, LeagueResult, LeagueSquad, MatchStats, StarPlayer } from "../../lib/star/types";

/**
 * THE SCOUT REPORT.
 *
 * The arithmetic under test: top scorer/assist king/best player read
 * straight off the opponent's real squad data, their form strips read the
 * same scorer/assister log the results page itself is built from (not a
 * separate history nothing else tracks), recent results and the table
 * snippet are genuinely centred on the opponent, a club with no squad data
 * degrades to "not enough scouted" rather than crashing or lying, and
 * headToHead actually accumulates across matches the way a real record
 * would. Presentation (ScoutReport.tsx) isn't tested here — just the data
 * it's handed.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

function player(): StarPlayer {
  return {
    firstName: "Test", lastName: "Player", age: 22, position: "ST",
    club: "Arsenal", nationality: "England",
  } as StarPlayer;
}

const base = () => makeInitialCareer(player(), [...PREMIER_LEAGUE_CLUBS]);

function stats(over: Partial<MatchStats>): MatchStats {
  return {
    chances: 3, goals: 0, assists: 0, passes: 8, rating: 7.0, starMan: false,
    bossChange: 0, teamChange: 0, fansChange: 0, wage: 1, goalBonus: 0,
    sponsorPay: 0, totalCash: 1, homeScore: 1, awayScore: 0,
    ...over,
  };
}

function squadFor(club: string, offset: number): LeagueSquad {
  const positions = ["GK", "CB", "CB", "LB", "RB", "CDM", "CM", "CAM", "LW", "RW", "ST"] as const;
  return {
    club,
    players: positions.map((pos, i) => ({
      id: `${club}-${i}`, name: `${club} Player ${i}`, position: pos,
      overall: 60 + ((offset + i * 5) % 30),
      goals: i === 9 ? 10 + offset : i, // the ST is always top scorer, distinct per club
      assists: i === 7 ? 8 + offset : i, // the CAM is always top assister
    })),
  };
}

// ── No squad data: degrades honestly, does not crash or invent a scout ─────
{
  const c = base();
  const r = scoutReportFor(c, "Chelsea", 1);
  check(r.club === "Chelsea", "the report is about the right club");
  check(r.topScorer === null && r.topAssister === null && r.bestPlayer === null,
    "no squad data means no player-level scouting");
  check(r.recentResults.length === 0, "and no games to report on before any have been played");
  // The table itself is independent of squad data — every club is in
  // career.league from the start, even at 0 played.
  check(r.tableSnippet.some(row => row.club === "Chelsea"), "the table snippet still works with no squad data at all");
  check(r.headToHead === null, "no history yet against a club never played");
}

// ── With real squad data: the actual best players are found ────────────────
{
  let c = base();
  c = { ...c, leagueSquads: c.league.map((t, i) => squadFor(t.name, i * 3)) };
  const opponent = c.league.find(t => t.name !== "Arsenal")!.name;
  const squad = c.leagueSquads!.find(s => s.club === opponent)!;
  const r = scoutReportFor(c, opponent, 1);

  const realTopScorer = squad.players.reduce((a, b) => (b.goals > a.goals ? b : a));
  const realTopAssister = squad.players.reduce((a, b) => (b.assists > a.assists ? b : a));
  const realBest = squad.players.reduce((a, b) => (b.overall > a.overall ? b : a));

  check(r.topScorer?.name === realTopScorer.name && r.topScorer?.value === realTopScorer.goals,
    `the real top scorer is found (${r.topScorer?.name} vs ${realTopScorer.name})`);
  check(r.topAssister?.name === realTopAssister.name, "…and the real top assister");
  check(r.bestPlayer?.name === realBest.name && r.bestPlayer?.value === realBest.overall, "…and the real best player, by OVR");
  check(r.bestPlayer?.form === undefined, "the top-rated card has no single event to track a form strip against");

  // Every card carries the same three real numbers, not just its headline
  // stat — no per-player "matches" field exists anywhere in the game (only
  // team-level `played`), so the card footer sticks to goals/assists/OVR.
  check(r.topScorer?.goals === realTopScorer.goals && r.topScorer?.assists === realTopScorer.assists && r.topScorer?.overall === realTopScorer.overall,
    "the top scorer card carries its own real goals/assists/OVR, not just the headline stat");
  check(r.topAssister?.goals === realTopAssister.goals && r.topAssister?.assists === realTopAssister.assists && r.topAssister?.overall === realTopAssister.overall,
    "…and so does the assist king card");
  check(r.bestPlayer?.goals === realBest.goals && r.bestPlayer?.assists === realBest.assists && r.bestPlayer?.overall === realBest.overall,
    "…and the top-rated card");
}

// ── Form strips read the real scorer/assister log, not a separate history ──
{
  let c = base();
  const opponent = "Chelsea";
  c = { ...c, leagueSquads: c.league.map((t, i) => squadFor(t.name, i * 3)) };
  const squad = c.leagueSquads!.find(s => s.club === opponent)!.players;
  const scorer = squad.reduce((a, b) => (b.goals > a.goals ? b : a));
  const assister = squad.reduce((a, b) => (b.assists > a.assists ? b : a));

  // Three league games for Chelsea this season: scored in the 1st and 3rd,
  // not the 2nd; the assist king sets up the 3rd only. Mix of home and away
  // so the home/away goal-log split is actually exercised.
  const results: LeagueResult[] = [
    { week: 1, home: opponent, away: "Fulham FC", hs: 1, as: 0, hg: [{ m: 30, s: scorer.name }] },
    { week: 2, home: "Everton", away: opponent, hs: 2, as: 1, ag: [{ m: 60, s: "Someone Else" }] },
    { week: 3, home: opponent, away: "Brentford", hs: 2, as: 0, hg: [{ m: 10, s: "Someone Else" }, { m: 70, s: scorer.name, a: assister.name }] },
  ];
  c = { ...c, results };

  const r = scoutReportFor(c, opponent, 4);
  check(r.topScorer?.form?.length === 3, `three league games played, three entries (${r.topScorer?.form?.length})`);
  check(JSON.stringify(r.topScorer?.form) === JSON.stringify([true, false, true]),
    `scored games 1 and 3, not 2, oldest first (${JSON.stringify(r.topScorer?.form)})`);
  check(JSON.stringify(r.topAssister?.form) === JSON.stringify([false, false, true]),
    `the assist king only actually assisted the third (${JSON.stringify(r.topAssister?.form)})`);

  // Recent results themselves: real scores, real opponents, oldest first.
  check(r.recentResults.length === 3, "one row per game played");
  check(r.recentResults[0].result === "W" && r.recentResults[0].opponent === "Fulham FC" && r.recentResults[0].scoreFor === 1,
    `game 1 read correctly (${JSON.stringify(r.recentResults[0])})`);
  check(r.recentResults[1].result === "L" && r.recentResults[1].opponent === "Everton" && r.recentResults[1].scoreFor === 1 && r.recentResults[1].scoreAgainst === 2,
    `game 2 read correctly as the away side (${JSON.stringify(r.recentResults[1])})`);
  check(r.recentResults[2].result === "W" && r.recentResults[2].opponent === "Brentford",
    `game 3 read correctly (${JSON.stringify(r.recentResults[2])})`);
}

// ── Form strips still match against the log's real shape: a bare surname ──
// The fabricated fixture above wrote the scorer/assister's FULL name straight
// into `hg`/`ag` — production never does that. A goal scored in a match you
// actually played is logged as `surname(scorer)` (lib/star/media/grammar.ts);
// one simulated without you is logged as `shortNameOf(scorer)`
// (lib/star/realSquad.ts) — and those two don't even agree with each other on
// a multi-word surname ("Dijk" vs "van Dijk"). This block uses BOTH real
// helpers, on a player whose full name is more than two words, to prove the
// form strip still lines up rather than silently going all-blank.
{
  let c = base();
  const opponent = "Chelsea";
  c = { ...c, leagueSquads: c.league.map((t, i) => squadFor(t.name, i * 3)) };
  const squad = c.leagueSquads!.find(s => s.club === opponent)!.players;
  const scorer = { ...squad.reduce((a, b) => (b.goals > a.goals ? b : a)), name: "V. van Dijk" };
  squad[squad.findIndex(p => p.id === scorer.id)] = scorer;

  const results: LeagueResult[] = [
    // Logged the way a match YOU played logs it: surname() → "Dijk".
    { week: 1, home: opponent, away: "Fulham FC", hs: 1, as: 0, hg: [{ m: 30, s: surname(scorer.name) }] },
    { week: 2, home: "Everton", away: opponent, hs: 2, as: 1, ag: [{ m: 60, s: "Someone Else" }] },
    // Logged the way a simulated match logs it: shortNameOf() → "van Dijk".
    { week: 3, home: opponent, away: "Brentford", hs: 2, as: 0, hg: [{ m: 10, s: "Someone Else" }, { m: 70, s: shortNameOf(scorer.name) }] },
  ];
  c = { ...c, results };

  const r = scoutReportFor(c, opponent, 4);
  check(JSON.stringify(r.topScorer?.form) === JSON.stringify([true, false, true]),
    `both the played-match ("Dijk") and simulated-match ("van Dijk") log spellings still match the real scorer (${JSON.stringify(r.topScorer?.form)})`);
}

// ── The table snippet is genuinely centred on the opponent, clamped at the edges ─
{
  let c = base();
  const table = c.league.map(t => t.name);
  const topClub = table[0], midClub = table[10], bottomClub = table[table.length - 1];

  const top = scoutReportFor(c, topClub, 1);
  check(top.tableSnippet[0].position === 1, `clamped at the top, not showing a negative position (${top.tableSnippet[0].position})`);
  check(top.tableSnippet.some(r => r.isOpponent && r.club === topClub), "the opponent is marked within it");

  const mid = scoutReportFor(c, midClub, 1);
  const oppRow = mid.tableSnippet.find(r => r.isOpponent)!;
  check(mid.tableSnippet.length === 5, `two either side in the middle of the table (${mid.tableSnippet.length})`);
  check(oppRow.club === midClub, "…genuinely centred on the opponent, not some fixed slice");

  const bottom = scoutReportFor(c, bottomClub, 1);
  check(bottom.tableSnippet[bottom.tableSnippet.length - 1].position === table.length,
    `clamped at the bottom too, not running past the last club (${bottom.tableSnippet[bottom.tableSnippet.length - 1].position})`);
}

// ── Head-to-head actually accumulates, and only for club matches ───────────
{
  let c = base();
  const f = (over: Partial<Fixture>): Fixture => ({ week: 1, opponent: "Chelsea", home: true, played: false, kind: "league", ...over });

  c = creditMatchResult(c, f({ week: 1 }), stats({ homeScore: 2, awayScore: 0 })).career; // win
  c = creditMatchResult(c, f({ week: 2 }), stats({ homeScore: 1, awayScore: 1 })).career; // draw
  c = creditMatchResult(c, f({ week: 3, kind: "cup", competition: "FA Cup" }), stats({ homeScore: 0, awayScore: 2 })).career; // loss, still a club match

  check(c.headToHead?.["Chelsea"]?.wins === 1, `a win is recorded (${c.headToHead?.["Chelsea"]?.wins})`);
  check(c.headToHead?.["Chelsea"]?.draws === 1, `a draw is recorded (${c.headToHead?.["Chelsea"]?.draws})`);
  check(c.headToHead?.["Chelsea"]?.losses === 1, `and a cup loss counts too — it's still Chelsea (${c.headToHead?.["Chelsea"]?.losses})`);

  const r = scoutReportFor(c, "Chelsea", 4);
  check(r.headToHead?.wins === 1 && r.headToHead?.draws === 1 && r.headToHead?.losses === 1,
    "the scout report reads the same record back");

  // A replay does not double-count.
  const replayed = c.fixtures.find(x => x.week === 1)!;
  const after = creditMatchResult(c, replayed, stats({ homeScore: 2, awayScore: 0 })).career;
  check(after.headToHead?.["Chelsea"]?.wins === 1, "re-crediting the same match does not inflate the record");

  // An international "opponent" never gets a club head-to-head entry.
  const intl = creditMatchResult(base(), { week: 1, opponent: "Brazil", home: true, played: false, kind: "international" },
    stats({ homeScore: 1, awayScore: 0 })).career;
  check(!intl.headToHead?.["Brazil"], "a nation never gets a club head-to-head entry");
}

// ── The key insight is built from real facts, in the right priority order ──
{
  let c = base();
  const noScout = scoutReportFor(c, "Chelsea", 1);
  check(keyInsightFor(noScout) !== null, "the table position alone is still worth a sentence, even with no squad data");

  c = { ...c, leagueSquads: c.league.map((t, i) => squadFor(t.name, i * 3)) };
  const opponent = "Chelsea";
  const squad = c.leagueSquads!.find(s => s.club === opponent)!.players;
  const scorer = squad.reduce((a, b) => (b.goals > a.goals ? b : a));

  const scouted = scoutReportFor(c, opponent, 1);
  const insight = keyInsightFor(scouted)!;
  check(insight.includes(opponent), `it names the actual club (${insight})`);
  check(insight.includes(scorer.name), `it leads with the real top scorer over the assist king when both exist (${insight})`);

  // A relegation-zone club reads differently from one push for the top —
  // both derived from the same real `report.table`, nothing hardcoded.
  const table = c.league.map(t => t.name);
  const bottomInsight = keyInsightFor(scoutReportFor(c, table[table.length - 1], 1))!;
  const topInsight = keyInsightFor(scoutReportFor(c, table[0], 1))!;
  check(bottomInsight !== topInsight, "bottom of the table and top of the table don't read the same");
}

// ── Grounds ──────────────────────────────────────────────────────────────
{
  check(groundFor("Crystal Palace").name === "Selhurst Park", "a real club gets its real ground");
  check(groundFor("Some Made Up FC").name.includes("Some Made Up FC"), "an unknown club still gets something sensible, not a crash");
  const crowds = new Set([1, 2, 3, 4, 5].map(w => crowdFor("Arsenal", w)));
  check(crowds.size > 1, "the crowd varies week to week rather than being one fixed number");
  check(crowdFor("Arsenal", 1) === crowdFor("Arsenal", 1), "…but is stable for the same fixture, not re-rolled every render");
  check(Object.keys(GROUNDS).length > 40, `every club in the game has a real ground (${Object.keys(GROUNDS).length})`);
}

if (problems.length) {
  console.error("FAIL");
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log("PASS — the scout report tells you the truth about who you're about to play, or admits it doesn't know");
