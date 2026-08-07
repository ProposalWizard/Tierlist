import type { CareerState, Fixture, CupRun, Competition } from "./types";
import { mulberry32, sortLeague } from "./season";

/**
 * CUPS, EUROPE AND THE NATIONAL TEAM
 *
 * There was one competition. Thirty-eight weeks of league football, a title if
 * you finished top, and nothing else to play for — the `Trophy` type has always
 * carried a `competition` field and only ever held one value.
 *
 * All three of these are the same shape underneath: a knockout you are either
 * still in or out of. That is the whole design here — one run type, one
 * progression function, three sets of opponents and three reasons to care.
 *
 * A knockout cannot be drawn up in advance the way a league can, because who you
 * play next depends on whether you are still in it. So a season starts with the
 * FIRST round of each run on the calendar, and winning it puts the next one
 * there. Losing does not: the run is simply over, and the weeks it would have
 * occupied are weeks you do not play.
 */

// ── Who you meet ────────────────────────────────────────────────────────────

/** European opposition. Names and strengths are fixed so a run reads the same way twice. */
const EUROPEAN_CLUBS: [string, number][] = [
  ["Real Madrid", 92], ["Barcelona", 89], ["Bayern Munich", 91], ["Paris SG", 88],
  ["Inter Milan", 85], ["AC Milan", 83], ["Juventus", 84], ["Atlético Madrid", 85],
  ["Borussia Dortmund", 82], ["Napoli", 81], ["Ajax", 76], ["Porto", 77],
  ["Benfica", 78], ["Sevilla", 79], ["Roma", 80], ["Marseille", 75],
];

/** International opposition. */
const NATIONS: [string, number][] = [
  ["Brazil", 91], ["France", 91], ["Argentina", 90], ["Spain", 88], ["Germany", 87],
  ["Portugal", 87], ["Netherlands", 85], ["Italy", 85], ["Belgium", 83], ["Croatia", 82],
  ["Uruguay", 80], ["Denmark", 79], ["Switzerland", 77], ["Mexico", 75],
  ["Japan", 76], ["Senegal", 76], ["Morocco", 78], ["USA", 74],
];

// ── The runs ────────────────────────────────────────────────────────────────

export const CUP_ROUNDS = ["Fourth Round", "Quarter-Final", "Semi-Final", "Final"];
export const EURO_ROUNDS = ["Round of 16", "Quarter-Final", "Semi-Final", "Final"];
export const TOURNAMENT_ROUNDS = ["Group Stage", "Round of 16", "Quarter-Final", "Semi-Final", "Final"];
/** The one round nobody goes out of on a single draw. */
const GROUP_STAGE = "Group Stage";

export function roundsFor(competition: string): string[] {
  if (competition === "FA Cup") return CUP_ROUNDS;
  if (competition === "World Cup" || competition === "European Championship") return TOURNAMENT_ROUNDS;
  return EURO_ROUNDS;
}

/** How many weeks of league football a division of this size produces. */
export function leagueWeeks(clubCount: number): number {
  return Math.max(2, (clubCount - 1) * 2);
}

/**
 * Where each round sits in the calendar.
 *
 * Spread across the league season as fractions of it rather than fixed weeks,
 * so a smaller division does not end up with its cup final after the season has
 * finished. The international tournament is the exception: it runs AFTER the
 * league, the way a summer tournament does, which is also why it can extend a
 * season past its last league fixture.
 */
function roundWeeks(kind: CupRun["kind"], rounds: number, clubCount: number): number[] {
  const lw = leagueWeeks(clubCount);
  if (kind === "international") {
    return Array.from({ length: rounds }, (_, i) => lw + 1 + i);
  }
  // Cup rounds sit at 30/50/70/90% of the season; Europe a week later each time
  // so the two runs never land on the same week.
  const offset = kind === "europe" ? 1 : 0;
  return Array.from({ length: rounds }, (_, i) =>
    Math.max(2, Math.min(lw, Math.round(lw * (0.3 + 0.2 * i)) + offset)));
}

// ── Qualification and call-ups ──────────────────────────────────────────────

/** What finishing in this position earns you for next season. */
export function qualificationFor(position: number, clubCount: number): Competition | null {
  const cl = Math.max(1, Math.round(clubCount * 0.2));   // top fifth
  const el = Math.max(2, Math.round(clubCount * 0.4));   // …down to the top two fifths
  if (position <= cl) return "Champions League";
  if (position <= el) return "Europa League";
  return null;
}

/** Where the player's club finished, 1-based. */
export function leaguePosition(career: CareerState): number {
  return sortLeague(career.league).findIndex(t => t.name === career.player.club) + 1;
}

/**
 * Is the player in the international squad?
 *
 * Reputation first, form second. A teenager at a mid-table club is not going to
 * be picked, which is the point — the national team is something to reach,
 * not something you start with.
 */
export function internationalCallUp(career: CareerState): boolean {
  const form = career.form.length
    ? career.form.reduce((s, r) => s + r, 0) / career.form.length
    : 6.5;
  return career.starRating >= 3.0 || career.fame >= 45 || (career.starRating >= 2.6 && form >= 7.6);
}

/** The tournament, if there is one this season. Alternates, every other year. */
export function tournamentFor(season: number): Competition | null {
  if (season % 2 !== 0) return null;
  return season % 4 === 0 ? "World Cup" : "European Championship";
}

// ── Building a season's knockouts ───────────────────────────────────────────

function pickOpponent(
  kind: CupRun["kind"],
  career: CareerState,
  rng: () => number,
): { opponent: string; strength: number } {
  if (kind === "cup") {
    const others = career.league.filter(t => t.name !== career.player.club);
    const t = others[Math.floor(rng() * others.length)];
    return { opponent: t?.name ?? "Non-League XI", strength: t?.strength ?? 55 };
  }
  const pool = kind === "europe" ? EUROPEAN_CLUBS : NATIONS;
  const [name, strength] = pool[Math.floor(rng() * pool.length)];
  return { opponent: name, strength };
}

function makeRoundFixture(
  run: CupRun,
  career: CareerState,
  week: number,
  rng: () => number,
): Fixture {
  const { opponent, strength } = pickOpponent(run.kind, career, rng);
  return {
    week,
    opponent,
    home: rng() < 0.5,
    played: false,
    competition: run.competition,
    kind: run.kind,
    round: roundsFor(run.competition)[run.roundIndex],
    opponentStrength: strength,
  };
}

/**
 * The knockouts a season opens with: the domestic cup always, Europe if it was
 * earned last season, and the national team if the player is being picked.
 *
 * Only the first round of each is on the calendar. The rest is earned.
 */
export function seedSeasonKnockouts(career: CareerState): { runs: CupRun[]; fixtures: Fixture[] } {
  const rng = mulberry32(career.season * 7919 + career.league.length);
  const clubCount = career.league.length;
  const runs: CupRun[] = [];
  const fixtures: Fixture[] = [];

  const open = (competition: Competition, kind: CupRun["kind"]) => {
    const run: CupRun = { competition, kind, roundIndex: 0, eliminated: false, won: false };
    runs.push(run);
    const weeks = roundWeeks(kind, roundsFor(competition).length, clubCount);
    fixtures.push(makeRoundFixture(run, career, weeks[0], rng));
  };

  open("FA Cup", "cup");
  if (career.europeanQualification) open(career.europeanQualification, "europe");

  const tournament = tournamentFor(career.season);
  if (tournament && internationalCallUp(career)) open(tournament, "international");

  return { runs, fixtures };
}

// ── Progressing a run ───────────────────────────────────────────────────────

export interface KnockoutOutcome {
  /** The run after this result. */
  run: CupRun;
  /** The next round's fixture, when there is one. */
  nextFixture: Fixture | null;
  /** A trophy, when the final was won. */
  trophy: { season: number; competition: string; club: string } | null;
  /** What to tell the player. */
  message: string;
  /** True when the tie went to penalties. */
  onPenalties: boolean;
  /** Did the player go through? */
  advanced: boolean;
}

/**
 * Settle a knockout tie and move the run on.
 *
 * A knockout cannot be drawn, so a level score goes to penalties — decided on a
 * coin weighted by the two sides' quality rather than a straight 50-50, because
 * the better team really is a little likelier to win a shootout, and a run that
 * ends on a pure coin toss reads as arbitrary.
 */
export function resolveKnockout(
  career: CareerState,
  run: CupRun,
  fixture: Fixture,
  userScore: number,
  oppScore: number,
): KnockoutOutcome {
  const rounds = roundsFor(run.competition);
  const roundName = rounds[run.roundIndex] ?? "Final";
  const isFinal = run.roundIndex >= rounds.length - 1;
  const rng = mulberry32(career.season * 131 + fixture.week * 17 + run.roundIndex);

  let advanced = userScore > oppScore;
  let onPenalties = false;
  // A group is played on points, so a draw is a point and you go through on it.
  // Sending someone home from a tournament on a single drawn group game — which
  // is what treating every round identically did — is not football.
  if (userScore === oppScore && roundName === GROUP_STAGE) {
    advanced = true;
  } else if (userScore === oppScore) {
    onPenalties = true;
    const mine = career.league.find(t => t.name === career.player.club)?.strength ?? 65;
    const theirs = fixture.opponentStrength ?? 70;
    // Quality is worth a nudge, never a decision: bounded well inside a coin flip.
    advanced = rng() < Math.max(0.3, Math.min(0.7, 0.5 + (mine - theirs) / 200));
  }

  const side = run.kind === "international" ? nationOf(career) : career.player.club;

  if (!advanced) {
    return {
      run: { ...run, eliminated: true },
      nextFixture: null,
      trophy: null,
      onPenalties,
      advanced: false,
      message: onPenalties
        ? `Out of the ${run.competition} on penalties in the ${roundName}.`
        : `Knocked out of the ${run.competition} in the ${roundName}.`,
    };
  }

  if (isFinal) {
    return {
      run: { ...run, won: true, eliminated: true },
      nextFixture: null,
      trophy: { season: career.season, competition: run.competition, club: side },
      onPenalties,
      advanced: true,
      message: onPenalties
        ? `🏆 ${run.competition} winners — on penalties!`
        : `🏆 ${run.competition} winners!`,
    };
  }

  const nextRun: CupRun = { ...run, roundIndex: run.roundIndex + 1 };
  const weeks = roundWeeks(run.kind, rounds.length, career.league.length);
  const nextRng = mulberry32(career.season * 977 + run.roundIndex * 31 + fixture.week);
  return {
    run: nextRun,
    nextFixture: makeRoundFixture(nextRun, career, weeks[nextRun.roundIndex], nextRng),
    trophy: null,
    onPenalties,
    advanced: true,
    message: onPenalties
      ? `Through to the ${rounds[nextRun.roundIndex]} on penalties.`
      : roundName === GROUP_STAGE && userScore === oppScore
        ? `A point is enough — into the ${rounds[nextRun.roundIndex]}.`
        : `Into the ${rounds[nextRun.roundIndex]}.`,
  };
}

/** The national side, named off the player's own nationality. */
export function nationOf(career: CareerState): string {
  return career.player.nationality || "England";
}

/**
 * The next match to be played.
 *
 * Was `fixtures.find(f => !f.played)`, which relied on the array being in
 * calendar order — true for a league built up front, and false the moment a
 * knockout appends a round that was earned mid-season. Ordered by week, with
 * league football first when two land in the same one.
 */
const KIND_ORDER: Record<string, number> = { league: 0, cup: 1, europe: 2, international: 3 };

export function nextFixtureFor(career: CareerState): Fixture | null {
  let best: Fixture | null = null;
  for (const f of career.fixtures) {
    if (f.played) continue;
    if (!best) { best = f; continue; }
    if (f.week !== best.week) { if (f.week < best.week) best = f; continue; }
    if ((KIND_ORDER[f.kind ?? "league"] ?? 0) < (KIND_ORDER[best.kind ?? "league"] ?? 0)) best = f;
  }
  return best;
}

/** How a fixture reads on the team sheet. */
export function fixtureLabel(f: Fixture): string {
  if (!f.kind || f.kind === "league") return "League";
  return f.round ? `${f.competition} · ${f.round}` : f.competition ?? "Cup";
}
