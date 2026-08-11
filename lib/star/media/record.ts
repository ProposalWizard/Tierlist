import type { CareerState, Fixture, MatchStats } from "../types";
import { sortLeague } from "../season";
import { isDerby } from "../rivals";
import type { MatchRecord, GoalRecord, TableSnapshot } from "./types";

/**
 * THE SEAM.
 *
 * One function, called once at full time, that turns the career into the frozen
 * description everything downstream reads. Nothing past this point touches
 * CareerState, which is the whole reason the rest of the engine is testable
 * without building a career first.
 *
 * It takes the career on BOTH sides of the match because half of what a media
 * feed says is a comparison — "went top", "into the relegation places", "his
 * fiftieth" — and none of that is visible in the after state alone.
 */

function snapshot(career: CareerState): TableSnapshot {
  const sorted = sortLeague(career.league);
  const i = sorted.findIndex(t => t.name === career.player.club);
  const me = sorted[i];
  return {
    position: i + 1,
    points: me?.points ?? 0,
    gd: me ? me.goalsFor - me.goalsAgainst : 0,
  };
}

/**
 * Running score after each goal.
 *
 * The match records goals with a minute and a scorer and nothing else, so
 * "equaliser" and "winner" are not stored anywhere — but they are recoverable,
 * because the final score and the order of your side's goals are both known. The
 * opposition's goals are not individually recorded, so they are distributed
 * across the ninety minutes deterministically: it is a reconstruction, not an
 * invention, and it is only ever used to decide whether a goal levelled it or
 * won it.
 */
function withRunningScore(goals: GoalRecord[], us: number, them: number): GoalRecord[] {
  const ours = [...goals].sort((a, b) => a.minute - b.minute);
  // Their goals, spread through the match at stable minutes.
  const theirs: number[] = [];
  for (let i = 0; i < them; i++) theirs.push(Math.round(((i + 1) / (them + 1)) * 88) + 2);

  let u = 0, t = 0, ti = 0;
  const out: GoalRecord[] = [];
  for (const g of ours) {
    while (ti < theirs.length && theirs[ti] <= g.minute) { t++; ti++; }
    u++;
    out.push({ ...g, scoreAfter: { us: u, them: t } });
  }
  // Guard: if the recorded goals do not add up to the scoreline (a chained
  // team-mate goal that was never logged, say), the reconstruction is not
  // trustworthy and the fact is better absent than wrong.
  if (u !== us) return ours.map(g => ({ ...g, scoreAfter: undefined }));
  return out;
}

export function buildMatchRecord(
  before: CareerState,
  after: CareerState,
  fixture: Fixture,
  stats: MatchStats,
): MatchRecord {
  const kind = fixture.kind ?? "league";
  const competition = fixture.competition ?? "Premier League";
  const clubs = before.league.map(t => t.name);
  const derby = fixture.derby ?? isDerby(before.player.club, fixture.opponent, clubs);
  const strength = (name: string) => before.league.find(t => t.name === name)?.strength ?? fixture.opponentStrength ?? 65;

  const us = stats.homeScore;
  const them = stats.awayScore;

  const beforeTable = snapshot(before);
  const afterTable = snapshot(after);
  const sortedAfter = sortLeague(after.league);
  const leader = sortedAfter[0];
  const dropZone = sortedAfter[sortedAfter.length - 3];
  const me = sortedAfter.find(t => t.name === after.player.club);

  const goals = withRunningScore(
    (stats.goalEvents ?? []).map(e => ({
      minute: e.minute,
      scorer: e.scorer,
      assist: e.assist,
      isUser: e.isUserGoal,
      how: e.how as GoalRecord["how"],
      distance: e.distance,
    })),
    us, them,
  );

  const knockout = after.knockoutMessage ?? "";
  const cup = kind !== "league"
    ? {
      advanced: /through|into/i.test(knockout),
      eliminated: /out/i.test(knockout) && !/through/i.test(knockout),
      trophy: knockout.startsWith("🏆"),
    }
    : undefined;

  return {
    id: `s${before.season}-w${before.week}-${kind}-${fixture.opponent.replace(/\s+/g, "")}`,
    season: before.season,
    week: before.week,
    competition,
    kind,
    round: fixture.round,
    derby,
    home: fixture.home,
    neutral: fixture.round === "Final",

    club: before.player.club,
    opponent: fixture.opponent,
    clubStrength: strength(before.player.club),
    opponentStrength: strength(fixture.opponent),

    score: { us, them },
    result: us > them ? "win" : us < them ? "loss" : "draw",

    you: {
      name: `${before.player.firstName} ${before.player.lastName}`,
      shortName: before.player.lastName,
      goals: stats.goals,
      assists: stats.assists,
      rating: stats.rating,
      starMan: stats.starMan,
      minutes: stats.minutes ?? 90,
      chances: stats.chances,
      passes: stats.passes,
      hooked: stats.hooked ?? null,
      captain: !!after.captain,
      squadNumber: after.squadNumber ?? 0,
      position: before.player.position,
      seasonGoals: after.seasonStats.goals,
      seasonAssists: after.seasonStats.assists,
      careerGoals: after.careerStats.goals,
      careerAssists: after.careerStats.assists,
      careerAppearances: after.careerStats.appearances,
      clubAppearances: after.clubAppearances ?? after.careerStats.appearances,
    },

    goals,

    table: {
      before: beforeTable,
      after: afterTable,
      leaderGap: (leader?.points ?? 0) - (me?.points ?? 0),
      relegationGap: (me?.points ?? 0) - (dropZone?.points ?? 0),
      matchesLeft: after.fixtures.filter(f => !f.played && (f.kind ?? "league") === "league").length,
      clubs: after.league.length,
    },

    cup,

    context: {
      managerName: after.manager?.name ?? "the manager",
      conditions: "",
      fansStanding: after.relationships.fans,
      fame: after.fame,
      starRating: after.starRating,
    },
  };
}
