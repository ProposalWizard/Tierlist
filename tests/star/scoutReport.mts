import { scoutReportFor } from "../../lib/star/scoutReport";
import { groundFor, crowdFor, GROUNDS } from "../../lib/star/stadiums";
import { makeInitialCareer, creditMatchResult } from "../../lib/star/careerFlow";
import { PREMIER_LEAGUE_CLUBS } from "../../lib/star/clubs";
import { shortNameOf } from "../../lib/star/realSquad";
import { surname } from "../../lib/star/media/grammar";
import { openEuro, simulateEuroMatchday } from "../../lib/star/euro";
import { mulberry32 } from "../../lib/star/season";
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

  // Three league games for Chelsea this season: scored ONCE in the 1st,
  // nothing in the 2nd, TWICE (a brace) in the 3rd — so the count, not just
  // whether it happened, is actually exercised. The assist king sets up the
  // 3rd only. Mix of home and away so the home/away goal-log split runs too.
  const results: LeagueResult[] = [
    { week: 1, home: opponent, away: "Fulham FC", hs: 1, as: 0, hg: [{ m: 30, s: scorer.name }] },
    { week: 2, home: "Everton", away: opponent, hs: 2, as: 1, ag: [{ m: 60, s: "Someone Else" }] },
    {
      week: 3, home: opponent, away: "Brentford", hs: 3, as: 0,
      hg: [{ m: 10, s: "Someone Else" }, { m: 70, s: scorer.name, a: assister.name }, { m: 80, s: scorer.name }],
    },
  ];
  c = { ...c, results };

  const r = scoutReportFor(c, opponent, 4);
  check(r.topScorer?.form?.length === 3, `three league games played, three entries (${r.topScorer?.form?.length})`);
  check(JSON.stringify(r.topScorer?.form) === JSON.stringify([1, 0, 2]),
    `one goal in game 1, none in game 2, a brace in game 3, oldest first (${JSON.stringify(r.topScorer?.form)})`);
  check(JSON.stringify(r.topAssister?.form) === JSON.stringify([0, 0, 1]),
    `the assist king only actually assisted once, in the third (${JSON.stringify(r.topAssister?.form)})`);

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
  check(JSON.stringify(r.topScorer?.form) === JSON.stringify([1, 0, 1]),
    `both the played-match ("Dijk") and simulated-match ("van Dijk") log spellings still match the real scorer (${JSON.stringify(r.topScorer?.form)})`);
}

// ── Five games played still means five entries, not capped at three ────────
{
  let c = base();
  const opponent = "Chelsea";
  c = { ...c, leagueSquads: c.league.map((t, i) => squadFor(t.name, i * 3)) };
  const squad = c.leagueSquads!.find(s => s.club === opponent)!.players;
  const scorer = squad.reduce((a, b) => (b.goals > a.goals ? b : a));

  // Six league games played — the scorer scored in the FIRST (which should
  // age out of the last-five window) and the LAST (which should be the most
  // recent entry). If the form strip were still capped at three, or reading
  // the wrong window, this comes out wrong either way.
  const results: LeagueResult[] = [1, 2, 3, 4, 5, 6].map(week => ({
    week, home: opponent, away: `Opponent ${week}`, hs: (week === 1 || week === 6) ? 1 : 0, as: 0,
    hg: (week === 1 || week === 6) ? [{ m: 10, s: scorer.name }] : undefined,
  }));
  c = { ...c, results };

  const r = scoutReportFor(c, opponent, 8);
  check(r.topScorer?.form?.length === 5, `capped at five, not stuck at three (${r.topScorer?.form?.length})`);
  check(JSON.stringify(r.topScorer?.form) === JSON.stringify([0, 0, 0, 0, 1]),
    `week 1's goal aged out, week 6's (the most recent) is the only one left (${JSON.stringify(r.topScorer?.form)})`);
}

// ── The table snippet always shows five rows, SLIDING at the edges rather ──
// ── than shrinking — reported directly from a 20th-placed club only ever
// showing 3 rows (itself plus the two above) instead of a real 5-row window.
{
  let c = base();
  const table = c.league.map(t => t.name);
  const topClub = table[0], midClub = table[10], secondClub = table[1], bottomClub = table[table.length - 1];

  const top = scoutReportFor(c, topClub, 1);
  check(top.tableSnippet.length === 5, `still five rows even right at the top (${top.tableSnippet.length})`);
  check(top.tableSnippet[0].position === 1 && top.tableSnippet[4].position === 5,
    `1st place shows 1st through 5th, not clamped down to 3 rows (${JSON.stringify(top.tableSnippet.map(r => r.position))})`);
  check(top.tableSnippet[0].isOpponent, "the opponent is still the FIRST row, not re-centred once slid");

  // The exact case reported: 2nd from the bottom shows 5 rows sliding to
  // include one MORE below them, not just clamping to fewer above.
  const second = scoutReportFor(c, secondClub, 1);
  check(second.tableSnippet.length === 5, `2nd place also gets a full five rows (${second.tableSnippet.length})`);
  check(second.tableSnippet[0].position === 1 && second.tableSnippet[4].position === 5,
    `2nd place slides the window down to 1st-5th rather than showing only 4 rows (${JSON.stringify(second.tableSnippet.map(r => r.position))})`);

  const mid = scoutReportFor(c, midClub, 1);
  const oppRow = mid.tableSnippet.find(r => r.isOpponent)!;
  check(mid.tableSnippet.length === 5, `five rows in the middle of the table too (${mid.tableSnippet.length})`);
  check(oppRow.club === midClub, "…genuinely centred on the opponent when there's room to be");

  // The exact case reported: last place (Hull City, 20th in a 20-team
  // division) must still show 5 rows — 16th through 20th — not just 3.
  const bottom = scoutReportFor(c, bottomClub, 1);
  check(bottom.tableSnippet.length === 5, `still five rows dead last, not clamped down to 3 (${bottom.tableSnippet.length})`);
  check(bottom.tableSnippet[4].position === table.length && bottom.tableSnippet[0].position === table.length - 4,
    `last place shows the final five positions, sliding the window up (${JSON.stringify(bottom.tableSnippet.map(r => r.position))})`);
  check(bottom.tableSnippet[4].isOpponent, "the opponent is still the LAST row, not re-centred once slid");
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

// ── A Champions League opponent — never in career.league/career.results,
// but euroState.liveTable/results tell the exact same kind of story now
// that simulateEuroMatchday names real goals. This is the actual feature
// requested: "who have they played, what was the result, who scored, who
// assisted" for a club never in your own division. ────────────────────────
{
  const b = base();
  let c: CareerState = { ...b, euroState: openEuro("Champions League", b.player.club, 78, 3, mulberry32(1)) };
  const opponent = c.euroState!.leaguePhase[0].opponent;
  const squads = c.euroState!.clubs.map(cl => squadFor(cl.name, 0));

  // Not in the domestic league or its results log at all.
  check(!c.league.some(t => t.name === opponent), "sanity check: this club genuinely isn't in the domestic division");

  const after = simulateEuroMatchday(c.euroState!, 0, b.player.club, opponent, true, 2, 1, mulberry32(5), squads);
  c = { ...c, euroState: after, externalSquads: squads };

  const r = scoutReportFor(c, opponent, 1);
  check(r.club === opponent, "the report is about the right Champions League club");
  check(r.table !== null, `a real Champions League standings position, not the "not in the table" null the old version always gave (${JSON.stringify(r.table)})`);
  check(r.recentResults.length === 1, `the opponent's one played Champions League game shows up as a recent result (${r.recentResults.length})`);
  check(r.recentResults[0]?.opponent !== undefined, "…naming who THEY played, not just a scoreline");
  check(r.topScorer !== null, `a real Champions League top scorer, not null (${JSON.stringify(r.topScorer)})`);
  check((r.topScorer?.goals ?? 0) > 0 && (r.topScorer?.form?.length ?? 0) === 1,
    `their top scorer carries real goals and a one-game form strip from the Champions League game just simulated (${JSON.stringify(r.topScorer)})`);
  check(r.bestPlayer !== null, "the best-player card still works exactly as it did before (needs no fixture history, just OVR)");
}

// ── …and a Champions League club with no squad supplied degrades exactly
// the same honest way a domestic club with no squad data does — the table
// position still shows (it doesn't need a squad), the player cards don't. ──
{
  const b = base();
  let c: CareerState = { ...b, euroState: openEuro("Champions League", b.player.club, 78, 3, mulberry32(1)) };
  const opponent = c.euroState!.leaguePhase[0].opponent;
  const after = simulateEuroMatchday(c.euroState!, 0, b.player.club, opponent, true, 2, 1, mulberry32(5));
  c = { ...c, euroState: after };

  const r = scoutReportFor(c, opponent, 1);
  check(r.table !== null, "the Champions League table position needs no squad data and still shows");
  check(r.topScorer === null && r.topAssister === null && r.bestPlayer === null,
    "…but with no squad ever fetched for them, the player cards degrade honestly rather than crashing or inventing one");
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
