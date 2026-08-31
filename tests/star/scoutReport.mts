import { scoutReportFor } from "../../lib/star/scoutReport";
import { groundFor, crowdFor, GROUNDS } from "../../lib/star/stadiums";
import { makeInitialCareer, creditMatchResult } from "../../lib/star/careerFlow";
import { PREMIER_LEAGUE_CLUBS } from "../../lib/star/clubs";
import type { CareerState, Fixture, LeagueSquad, MatchStats, StarPlayer } from "../../lib/star/types";

/**
 * THE SCOUT REPORT.
 *
 * The arithmetic under test: top scorer/assist king/best player read
 * straight off the opponent's real squad data, strengths/weaknesses are
 * genuinely derived (not just always populated), a club with no squad
 * data degrades to "not enough scouted" rather than crashing or lying, and
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
  check(r.strengths.length === 0 && r.weaknesses.length === 0, "and no invented strengths/weaknesses either");
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
}

// ── Strengths and weaknesses are genuinely relative, not always the same two ─
{
  let c = base();
  // Every club identical bar one, which is clearly stronger up front and
  // clearly weaker at the back — the derivation should find exactly that,
  // not some fixed pair of categories regardless of the numbers.
  const flat = c.league.map(t => squadFor(t.name, 0));
  const standout = flat.map(s => s.club === c.league[5].name
    ? {
      ...s,
      players: s.players.map(p =>
        ["ST", "LW", "RW", "CAM"].includes(p.position) ? { ...p, overall: p.overall + 25 }
          : ["GK", "CB", "LB", "RB"].includes(p.position) ? { ...p, overall: Math.max(30, p.overall - 25) }
            : p),
    }
    : s);
  c = { ...c, leagueSquads: standout };

  const r = scoutReportFor(c, c.league[5].name, 1);
  check(r.strengths.some(f => f.label === "Attack"), `a genuinely stronger attack is flagged as a strength (${JSON.stringify(r.strengths)})`);
  check(r.weaknesses.some(f => f.label === "Defence"), `a genuinely weaker defence is flagged as a weakness (${JSON.stringify(r.weaknesses)})`);
  check(r.tacticalHint.length > 0, "and there's a hint to go with it");

  const balanced = scoutReportFor({ ...c, leagueSquads: flat }, c.league[3].name, 1);
  check(balanced.strengths.length === 0 && balanced.weaknesses.length === 0,
    `a genuinely balanced squad gets no invented factors either way (${JSON.stringify(balanced.strengths)} / ${JSON.stringify(balanced.weaknesses)})`);
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
