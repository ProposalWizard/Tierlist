import type { CareerState, Fixture, CupRun, Competition } from "./types";
import {
  openCup, playCupRound, yourTie, currentRound, cupStrength, tieWinner,
  CUP_ROUND_NAMES, type CupState, type CupId,
} from "./cups";
import { mulberry32, sortLeague } from "./season";
import {
  PRE_SEASON_WEEK, TOURNAMENT_WEEKS, EURO_LEAGUE_PHASE_WEEKS,
  LEAGUE_CUP_SLOTS, FA_CUP_SLOTS,
} from "./calendar";
import {
  openEuro, poolFor, knockoutSlots, buildEuroTable, leaguePhaseComplete, drawTie,
  currentTie, currentLeg, settleTie, nextRound, firstRound, crownEurope, phaseVerdict,
  type EuroState, type EuroTie,
} from "./euro";

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
    // A summer tournament is played when the clubs have finished, which is the
    // one thing in the calendar that genuinely runs past the last league week.
    return Array.from({ length: rounds }, (_, i) => TOURNAMENT_WEEKS[i] ?? lw + 1 + i);
  }
  // Europe is no longer a counter — see lib/star/euro and seedEurope below. This
  // is left for a career saved mid-run under the old system, which still has to
  // be able to finish it.
  const offset = kind === "europe" ? 1 : 0;
  return Array.from({ length: rounds }, (_, i) =>
    Math.max(2, Math.min(lw, Math.round(lw * (0.3 + 0.2 * i)) + offset)));
}

// ── The one-off matches ─────────────────────────────────────────────────────

/**
 * What last season earned you before this one starts.
 *
 * Both are single matches played the week before the league begins, and both
 * are entirely a consequence of the previous season — which is why a first
 * season can never have either, and why they are the only fixtures in the game
 * that are decided by looking backwards.
 */
export function seedPreSeason(career: CareerState): Fixture[] {
  const last = career.season - 1;
  if (last < 1) return [];
  const won = (competition: string) =>
    (career.trophies ?? []).some(t => t.season === last && t.competition === competition);

  const rng = mulberry32(career.season * 3301 + career.league.length);
  const fixtures: Fixture[] = [];
  const table = sortLeague(career.league);

  // ── Community Shield: champions v FA Cup holders ──
  //
  // You are in it if you were either. Who you meet is the other one, and when
  // you were both — a Double — the opponent is the side that finished second,
  // which is what the real competition does.
  const wonLeague = won("Premier League");
  const wonFaCup = won("FA Cup");
  if (wonLeague || wonFaCup) {
    const other = table.find(t => t.name !== career.player.club) ?? table[0];
    fixtures.push({
      week: PRE_SEASON_WEEK,
      opponent: other?.name ?? "Manchester City",
      home: rng() < 0.5,
      played: false,
      competition: "Community Shield",
      kind: "cup",
      round: "Final",
      opponentStrength: other?.strength ?? 82,
    });
  }

  // ── Super Cup: the two European holders ──
  if (won("Champions League") || won("Europa League")) {
    const pool = poolFor(won("Champions League") ? "Europa League" : "Champions League");
    const opp = pool[Math.floor(rng() * Math.min(9, pool.length))];
    fixtures.push({
      week: PRE_SEASON_WEEK,
      opponent: opp?.name ?? "Sevilla",
      home: false,
      played: false,
      competition: "Super Cup",
      kind: "europe",
      round: "Final",
      opponentStrength: opp?.strength ?? 82,
    });
  }

  return fixtures;
}

// ── Europe ──────────────────────────────────────────────────────────────────

/**
 * Open the European campaign and put all eight league-phase games on the
 * calendar at once.
 *
 * Unlike a knockout, a league phase CAN be drawn up in advance — you know all
 * eight opponents on the day of the draw, and nothing you do changes them. Only
 * the knockout that follows has to be earned a round at a time.
 */
export function seedEurope(career: CareerState): { state: EuroState | null; fixtures: Fixture[] } {
  const competition = career.europeanQualification;
  if (
    competition !== "Champions League" &&
    competition !== "Europa League"
  ) {
    return { state: null, fixtures: [] };
  }
  const rng = mulberry32(career.season * 5441 + career.league.length * 7);
  const mine = career.league.find(t => t.name === career.player.club);
  const finish = career.lastSeasonPosition ?? 4;
  const state = openEuro(competition, career.player.club, mine?.strength ?? 75, finish, rng);

  const fixtures: Fixture[] = state.leaguePhase.map((m, i) => ({
    week: EURO_LEAGUE_PHASE_WEEKS[i] ?? 5 + i * 2,
    opponent: m.opponent,
    home: m.home,
    played: false,
    competition,
    kind: "europe",
    round: `League Phase · MD${i + 1}`,
    opponentStrength: state.clubs.find(c => c.name === m.opponent)?.strength ?? 78,
  }));

  return { state, fixtures };
}

/** The fixture for a European knockout round, once it has been drawn. */
export function euroTieFixture(
  state: EuroState,
  career: CareerState,
  tie: EuroTie,
  legIndex: number,
): Fixture | null {
  const position = state.position ?? 24;
  const slots = knockoutSlots(position);
  const slot = slots.find(s =>
    s.round === tie.round && (s.leg ?? 1) === legIndex + 1);
  if (!slot) return null;
  const leg = tie.legs[legIndex];
  return {
    week: slot.week,
    opponent: tie.opponent,
    home: leg?.home ?? false,
    played: false,
    competition: state.competition,
    kind: "europe",
    round: tie.legs.length > 1 ? `${tie.round} · Leg ${legIndex + 1}` : tie.round,
    opponentStrength: tie.opponentStrength,
  };
}

// ── Qualification and call-ups ──────────────────────────────────────────────

/**
 * What a player's club earns for next season.
 *
 * Mirrors the draft game's rules exactly:
 *
 *   Champions League — top 5 by league, OR won UCL/EL last season (if outside top 5).
 *   Europa League    — 6th or 7th by league, OR FA Cup / League Cup winner
 *                      at 8th or below (both cups treated identically, pot 2).
 *
 * Cascade: when a cup winner is already qualified through the league (positions
 * 1-7), the cup slot drops to the next available unqualified team. From the
 * player's perspective, a cup win never demotes them — winning the FA Cup at
 * 5th still earns Champions League from the league position, not Europa League
 * from the cup. The EL spot cascades to the 8th-place team (or whoever is next)
 * but those teams are AI-controlled and we do not track their cup results.
 *
 * The top-5 threshold scales with club count: `Math.round(n * 0.25)` gives 5
 * for a 20-club PL (the canonical case), and a sensible number for shorter
 * test leagues. No Conference League.
 */
export function qualificationFor(
  position: number,
  clubCount: number,
  wonFaCup = false,
  wonLeagueCup = false,
  wonEuroComp = false,
): Competition | null {
  const cl = Math.round(clubCount * 0.25);  // PL: top 5
  const elBottom = cl + 2;                   // PL: 7th

  if (position <= cl) return "Champions League";
  if (wonEuroComp) return "Champions League";         // UCL/EL winner outside top 5
  if (position <= elBottom) return "Europa League";   // 6th or 7th
  if (wonFaCup || wonLeagueCup) return "Europa League";  // cup winner at 8th+
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

  // The FA Cup and the League Cup are real draws (lib/star/cups, seedCups), and
  // Europe is a real league phase (lib/star/euro, seedEurope). What is left here
  // is the national team, which is still a counter-style run — and rightly so:
  // a World Cup is five matches against five nations, and there is no table to
  // build or draw to redo.
  const tournament = tournamentFor(career.season);
  if (tournament && internationalCallUp(career)) open(tournament, "international");

  // …and the two matches last season earned.
  fixtures.push(...seedPreSeason(career));

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


// ── The two domestic cups ───────────────────────────────────────────────────

/**
 * Open both cups and put your first-round tie on the calendar.
 *
 * The League Cup runs early and finishes before the FA Cup starts its later
 * rounds, which is both how the two actually sit in a season and how they avoid
 * landing on the same week as each other.
 */
export function seedCups(career: CareerState): { states: CupState[]; fixtures: Fixture[] } {
  const rng = mulberry32(career.season * 6151 + career.league.length * 13);
  const states = [openCup("League Cup", career.league, rng), openCup("FA Cup", career.league, rng)];
  const fixtures: Fixture[] = [];
  for (const st of states) {
    const f = cupFixtureFor(st, career, 0);
    if (f) fixtures.push(f);
  }
  return { states, fixtures };
}

/**
 * Where each cup round sits in the season.
 *
 * The League Cup runs early and is done by about the sixty per cent mark; the
 * FA Cup starts later and finishes near the end. That is both how the two sit in
 * a real season and how they stay out of each other's way.
 *
 * The fractions are not evenly spaced, and that is the point: at 38 weeks the
 * obvious even spread put a League Cup round and an FA Cup round both in week
 * 18, and you cannot play two cup ties in the same week. These interleave, and
 * anything that still collides after rounding is pushed a week later.
 */
export function cupRoundWeek(competition: CupId, roundIndex: number, _clubCount?: number): number {
  const slots = competition === "League Cup" ? LEAGUE_CUP_SLOTS : FA_CUP_SLOTS;
  // One entry per ROUND, not per match: the League Cup's two-legged semi-final
  // occupies two slots and is still the fourth round of the competition.
  const byRound: string[] = [];
  for (const s of slots) if (!byRound.includes(s.round)) byRound.push(s.round);
  const round = byRound[Math.min(roundIndex, byRound.length - 1)];
  const slot = slots.find(s => s.round === round);
  return slot?.week ?? 3 + roundIndex * 6;
}

/**
 * The second leg of a round, when it has one.
 *
 * Only the League Cup semi-final does, which is exactly how it works in England
 * and the reason that competition needs six dates for five rounds.
 */
export function cupSecondLegWeek(competition: CupId, roundIndex: number): number | null {
  const slots = competition === "League Cup" ? LEAGUE_CUP_SLOTS : FA_CUP_SLOTS;
  const byRound: string[] = [];
  for (const s of slots) if (!byRound.includes(s.round)) byRound.push(s.round);
  const round = byRound[Math.min(roundIndex, byRound.length - 1)];
  return slots.find(s => s.round === round && s.leg === 2)?.week ?? null;
}

/** Your fixture for the round this cup is on, if you are in it. */
export function cupFixtureFor(state: CupState, career: CareerState, roundIndex: number): Fixture | null {
  const tie = yourTie(state, career.player.club);
  if (!tie || tie.hs !== undefined) return null;
  const home = tie.home === career.player.club;
  const opponent = home ? tie.away : tie.home;
  return {
    week: cupRoundWeek(state.competition, roundIndex, career.league.length),
    opponent,
    home,
    played: false,
    competition: state.competition as Competition,
    kind: "cup",
    round: currentRound(state)?.name,
    opponentStrength: cupStrength(opponent, career.league),
  };
}

export interface CupTieOutcome {
  states: CupState[];
  nextFixture: Fixture | null;
  trophy: { season: number; competition: string; club: string } | null;
  message: string;
}

/**
 * Settle your tie, then play the rest of the round and draw the next one.
 *
 * The whole country's cup moves on at once, which is the point: you do not just
 * beat somebody and get handed another random opponent, you go back into a hat
 * with everybody else who won this weekend.
 *
 * Returns null when this fixture is not one of the two real cups — Europe and
 * the national team still go through the old run.
 */
export function settleCupTie(
  career: CareerState,
  fixture: Fixture,
  userScore: number,
  oppScore: number,
): CupTieOutcome | null {
  const states = career.cupState ?? [];
  const idx = states.findIndex(st => st.competition === fixture.competition && !st.winner);
  if (idx < 0) return null;

  const club = career.player.club;
  const before = states[idx];
  const roundName = currentRound(before)?.name ?? CUP_ROUND_NAMES[0];
  const rng = mulberry32(career.season * 977 + fixture.week * 31 + idx * 7);

  // Reported from your point of view; the tie wants home and away.
  const hs = fixture.home ? userScore : oppScore;
  const as = fixture.home ? oppScore : userScore;
  const after = playCupRound(before, career.league, club, { hs, as }, rng);
  const next = states.map((st, i) => (i === idx ? after : st));

  const tie = before.rounds[before.rounds.length - 1]?.ties
    .find(t => t.home === club || t.away === club);
  const played = after.rounds[before.rounds.length - 1]?.ties
    .find(t => t.home === club || t.away === club);
  const won = played ? tieWinner(played) === club : false;
  const onPens = played?.pens !== undefined;
  const opponent = tie ? (tie.home === club ? tie.away : tie.home) : fixture.opponent;

  if (!won) {
    return {
      states: next,
      nextFixture: null,
      trophy: null,
      message: onPens
        ? `Out of the ${fixture.competition} on penalties, beaten by ${opponent} in the ${roundName}.`
        : `Out of the ${fixture.competition} — ${opponent} win the ${roundName} tie.`,
    };
  }

  if (after.winner === club) {
    return {
      states: next,
      nextFixture: null,
      trophy: { season: career.season, competition: String(fixture.competition), club },
      message: `${club} win the ${fixture.competition}!${onPens ? " On penalties." : ""}`,
    };
  }

  const roundIndex = after.rounds.length - 1;
  return {
    states: next,
    nextFixture: cupFixtureFor(after, career, roundIndex),
    trophy: null,
    message: `Through to the ${currentRound(after)?.name}${onPens ? ", on penalties" : ""}.`,
  };
}

// ── Playing in Europe ───────────────────────────────────────────────────────

export interface EuroOutcome {
  state: EuroState;
  /** The next European fixture this result created, if any. */
  nextFixture: Fixture | null;
  trophy: { season: number; competition: string; club: string } | null;
  message: string;
}

/**
 * Record a European result and move the campaign on.
 *
 * Three different things happen here depending on where in the campaign you
 * are, and keeping them in one function is deliberate — they are one sequence,
 * and splitting them is how a campaign ends up half in the league phase and half
 * in the knockout.
 *
 *  1. A league-phase game just fills in a scoreline. Nothing is decided until
 *     all eight are played, and then the table is built and it decides
 *     everything at once: through, into the play-off, or out.
 *  2. The first leg of a tie puts the second leg on the calendar and says
 *     nothing else. A one-goal lead at half-time in a tie is not a result.
 *  3. The second leg settles it on aggregate, and drawing the next round.
 *
 * Returns null when this fixture is not European, so the caller can fall
 * through to whatever else it might be.
 */
export function settleEuro(
  career: CareerState,
  fixture: Fixture,
  userScore: number,
  oppScore: number,
): EuroOutcome | null {
  const state = career.euroState;
  if (!state || fixture.kind !== "europe") return null;
  // The Super Cup is a European fixture that is not part of the campaign — one
  // match, its own trophy, and it must not be mistaken for a league-phase game.
  if (fixture.competition === "Super Cup") return null;
  if (fixture.competition !== state.competition) return null;

  const yourStrength = career.league.find(t => t.name === career.player.club)?.strength ?? 75;
  const rng = mulberry32(career.season * 8161 + fixture.week * 29 + userScore * 7 + oppScore);

  // ── 1. The league phase ──
  const mdIndex = state.leaguePhase.findIndex(
    m => m.us === undefined && m.opponent === fixture.opponent);
  if (mdIndex >= 0) {
    const leaguePhase = state.leaguePhase.map((m, i) =>
      (i === mdIndex ? { ...m, us: userScore, them: oppScore } : m));
    const next: EuroState = { ...state, leaguePhase };
    if (!leaguePhaseComplete(next)) {
      const left = leaguePhase.filter(m => m.us === undefined).length;
      return {
        state: next,
        nextFixture: null,
        trophy: null,
        message: `${result(userScore, oppScore)} in the ${state.competition} league phase — ${left} to play.`,
      };
    }

    // All eight in: build the table, and it decides the rest of the campaign.
    const table = buildEuroTable(next, career.player.club, career.season * 104729 + 17);
    const position = table.findIndex(r => r.isYou) + 1;
    const settled: EuroState = { ...next, table, position };
    const opening = firstRound(position);
    if (!opening) {
      return {
        state: { ...settled, eliminated: true, winner: crownEurope(settled, career.season * 31 + 5) },
        nextFixture: null,
        trophy: null,
        message: `${ordinalOf(position)} in the ${state.competition} league phase. ${phaseVerdict(position)}`,
      };
    }
    const tie = drawTie(settled, opening, career.player.club, rng);
    const withTie: EuroState = { ...settled, ties: [tie] };
    return {
      state: withTie,
      nextFixture: euroTieFixture(withTie, career, tie, 0),
      trophy: null,
      message: `${ordinalOf(position)} in the ${state.competition} league phase. ${phaseVerdict(position)}`,
    };
  }

  // ── 2 and 3. The knockout ──
  const tie = currentTie(state);
  if (!tie) return null;
  const legIndex = currentLeg(state) ?? 0;
  const legs = tie.legs.map((l, i) =>
    (i === legIndex ? { ...l, us: userScore, them: oppScore } : l));
  const played: EuroTie = { ...tie, legs };

  // A first leg is not a result.
  if (legs.some(l => l.us === undefined)) {
    const withLeg: EuroState = {
      ...state,
      ties: state.ties.map((t, i) => (i === state.ties.length - 1 ? played : t)),
    };
    const agg = `${legs[0].us}-${legs[0].them}`;
    return {
      state: withLeg,
      nextFixture: euroTieFixture(withLeg, career, played, legIndex + 1),
      trophy: null,
      message: `${agg} in the first leg. It is settled at ${tie.opponent}.`,
    };
  }

  const decided = settleTie(played, yourStrength, rng);
  const ties = state.ties.map((t, i) => (i === state.ties.length - 1 ? decided : t));
  const us = legs.reduce((s, l) => s + (l.us ?? 0), 0);
  const them = legs.reduce((s, l) => s + (l.them ?? 0), 0);
  const aggregate = legs.length > 1 ? ` (${us}-${them} on aggregate)` : "";

  if (decided.result === "L") {
    const out: EuroState = {
      ...state, ties, eliminated: true,
      winner: crownEurope({ ...state, ties }, career.season * 31 + 5),
    };
    return {
      state: out,
      nextFixture: null,
      trophy: null,
      message: decided.onPenalties
        ? `Out of the ${state.competition} on penalties in the ${tie.round}.`
        : `Out of the ${state.competition} in the ${tie.round}${aggregate}.`,
    };
  }

  if (tie.round === "Final") {
    const won: EuroState = { ...state, ties, won: true, winner: career.player.club };
    return {
      state: won,
      nextFixture: null,
      trophy: { season: career.season, competition: state.competition, club: career.player.club },
      message: decided.onPenalties
        ? `🏆 ${state.competition} winners — on penalties!`
        : `🏆 ${state.competition} winners!`,
    };
  }

  const after = nextRound(state.position ?? 24, tie.round);
  if (!after) {
    return { state: { ...state, ties }, nextFixture: null, trophy: null, message: "Through." };
  }
  const drawn = drawTie({ ...state, ties }, after, career.player.club, rng);
  const advanced: EuroState = { ...state, ties: [...ties, drawn] };
  return {
    state: advanced,
    nextFixture: euroTieFixture(advanced, career, drawn, 0),
    trophy: null,
    message: decided.onPenalties
      ? `Through to the ${after} on penalties. ${drawn.opponent} next.`
      : `Into the ${after}${aggregate}. ${drawn.opponent} next.`,
  };
}

function result(us: number, them: number): string {
  return us > them ? "Won" : us === them ? "Drew" : "Lost";
}

function ordinalOf(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
