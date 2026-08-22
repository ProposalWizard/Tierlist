import type { CareerState, Fixture, LeagueTeam } from "./types";
import { sortLeague, simulateFixtureScore, mulberry32 } from "./season";
import { divisionOf, matchweeksFor, PLAY_OFF_SLOTS } from "./calendar";

/**
 * THE PLAY-OFFS YOU ACTUALLY PLAY.
 *
 * lib/star/promotion.ts can already decide a play-off — it simulates all four
 * clubs and hands back a winner, which is exactly right for a Championship
 * season somebody else is having. This is the other case: the one where YOUR
 * club finished third to sixth, and the last promotion place should be
 * settled by matches you play rather than by a dice roll on your behalf.
 *
 * Seeded the moment the forty-sixth round is credited (see careerFlow), so
 * the fixtures are on the calendar before the league screen next renders:
 * two semi-final legs and, if you win, a final — on the post-season weeks
 * the calendar already holds for them (PLAY_OFF_SLOTS).
 *
 * The other semi-final is simulated, because nobody is playing it. Its
 * winner is decided at the same moment yours is seeded, so the final has an
 * opponent waiting the instant you get there rather than one invented at the
 * last second.
 */

export interface PlayOffTieState {
  home: string;
  away: string;
  /** Leg one then leg two, as scored. Absent entries are unplayed. */
  legs: { hs: number; as: number }[];
  winner?: string;
}

export interface PlayOffState {
  /** Third to sixth, in that order. */
  contenders: string[];
  /** Yours first, the simulated one second. */
  semis: [PlayOffTieState, PlayOffTieState];
  final?: { home: string; away: string; hs?: number; as?: number; winner?: string };
  /** Who went up. Set only when the final is done. */
  promoted?: string;
  /** Set the moment you are knocked out, so the UI can stop offering fixtures. */
  yourRunOver?: boolean;
}

const [SF1, SF2, FINAL] = PLAY_OFF_SLOTS;

function strengthOf(league: LeagueTeam[], club: string): number {
  return league.find(t => t.name === club)?.strength ?? 70;
}

/** Higher seed at home in the second leg, which is what finishing above
 *  somebody is worth. */
function legFixtures(you: string, opponent: string, youAreHigherSeed: boolean): Fixture[] {
  return [
    {
      week: SF1.week, opponent, home: !youAreHigherSeed, played: false,
      kind: "playoff", competition: "Play-Offs", round: "Semi-Final, First Leg",
    },
    {
      week: SF2.week, opponent, home: youAreHigherSeed, played: false,
      kind: "playoff", competition: "Play-Offs", round: "Semi-Final, Second Leg",
    },
  ];
}

/**
 * Did your club make them, and if so what does the run look like?
 *
 * Null for anything that is not "a Championship season just finished with you
 * third to sixth" — a Premier League career, a season still running, an
 * already-seeded run.
 */
export function seedPlayOffs(career: CareerState): { state: PlayOffState; fixtures: Fixture[] } | null {
  if (divisionOf(career) !== "championship") return null;
  if (career.playOffState) return null;

  const table = sortLeague(career.league);
  if (table.length < 6) return null;
  const contenders = table.slice(2, 6).map(t => t.name);
  const you = career.player.club;
  const at = contenders.indexOf(you);
  if (at < 0) return null;

  // 3rd v 6th and 4th v 5th. Whichever of those two ties is yours, the other
  // is the one that gets simulated.
  const pairs: [string, string][] = [
    [contenders[0], contenders[3]],
    [contenders[1], contenders[2]],
  ];
  const yourPairIndex = pairs.findIndex(p => p.includes(you));
  const [highSeed, lowSeed] = pairs[yourPairIndex];
  const opponent = highSeed === you ? lowSeed : highSeed;
  const youAreHigherSeed = highSeed === you;

  const rng = mulberry32(career.season * 4409 + career.league.length * 17);
  const [otherHigh, otherLow] = pairs[1 - yourPairIndex];
  const otherFirst = simulateFixtureScore(
    strengthOf(career.league, otherLow), strengthOf(career.league, otherHigh), rng);
  const otherSecond = simulateFixtureScore(
    strengthOf(career.league, otherHigh), strengthOf(career.league, otherLow), rng);
  const aggHigh = otherFirst.away + otherSecond.home;
  const aggLow = otherFirst.home + otherSecond.away;
  const otherWinner = aggHigh !== aggLow
    ? (aggHigh > aggLow ? otherHigh : otherLow)
    : (rng() < 0.58 ? otherHigh : otherLow);

  const state: PlayOffState = {
    contenders,
    semis: [
      { home: lowSeed, away: highSeed, legs: [] },
      {
        home: otherLow, away: otherHigh,
        legs: [
          { hs: otherFirst.home, as: otherFirst.away },
          { hs: otherSecond.away, as: otherSecond.home },
        ],
        winner: otherWinner,
      },
    ],
  };

  return { state, fixtures: legFixtures(you, opponent, youAreHigherSeed) };
}

export interface PlayOffOutcome {
  state: PlayOffState;
  /** A new fixture this result earned — the final, when you win the semi. */
  fixtures: Fixture[];
  /** Through, out, promoted, or beaten in the final. */
  result: "through" | "eliminated" | "promoted" | "lost-final";
  message: string;
}

/**
 * Apply one play-off match you have just played.
 *
 * Two-legged until it is not: the semi-final is only decided once the second
 * leg is in, and the final is one match. Aggregate level after the second leg
 * goes the higher seed's way slightly more often than not — the same
 * shorthand for extra time and penalties that promotion.ts uses, kept
 * identical on purpose so a simulated play-off and a played one resolve a
 * dead heat the same way.
 */
export function settlePlayOffFixture(
  career: CareerState, fixture: Fixture, userScore: number, oppScore: number,
): PlayOffOutcome | null {
  const state = career.playOffState;
  if (!state || fixture.kind !== "playoff") return null;

  const you = career.player.club;
  const hs = fixture.home ? userScore : oppScore;
  const as = fixture.home ? oppScore : userScore;
  const rng = mulberry32(career.season * 6607 + fixture.week * 41);

  // ── The final ──
  if (state.final && !state.final.winner) {
    const won = userScore !== oppScore
      ? userScore > oppScore
      : rng() < 0.5;
    const winner = won ? you : fixture.opponent;
    const next: PlayOffState = {
      ...state,
      final: { ...state.final, hs, as, winner },
      promoted: winner,
      yourRunOver: true,
    };
    return {
      state: next, fixtures: [],
      result: won ? "promoted" : "lost-final",
      message: won
        ? `Promoted. ${you} win the play-off final and go up.`
        : `Beaten in the final. ${fixture.opponent} go up instead.`,
    };
  }

  // ── The semi-final ──
  const yours = state.semis[0];
  const legs = [...yours.legs, { hs, as }];
  if (legs.length < 2) {
    return {
      state: { ...state, semis: [{ ...yours, legs }, state.semis[1]] },
      fixtures: [],
      result: "through",
      message: `First leg done: ${hs}-${as}. It is settled at the second.`,
    };
  }

  // Aggregate. `yours.home` is the club at home in the FIRST leg, which is
  // the lower seed — so the higher seed's aggregate is the away goals of leg
  // one plus the home goals of leg two.
  const higherSeed = yours.away;
  const aggHigh = legs[0].as + legs[1].hs;
  const aggLow = legs[0].hs + legs[1].as;
  const winner = aggHigh !== aggLow
    ? (aggHigh > aggLow ? higherSeed : yours.home)
    : (rng() < 0.58 ? higherSeed : yours.home);
  const won = winner === you;

  const semis: [PlayOffTieState, PlayOffTieState] = [
    { ...yours, legs, winner }, state.semis[1],
  ];

  if (!won) {
    return {
      state: { ...state, semis, yourRunOver: true, promoted: undefined },
      fixtures: [],
      result: "eliminated",
      message: `Out on aggregate. ${winner} go to the final instead.`,
    };
  }

  const otherWinner = state.semis[1].winner!;
  // Wembley: no second leg and no home advantage to hand out, so whoever is
  // named "home" is only a label. Keeping YOU as home keeps the scoreline the
  // right way round for a result reported from your point of view.
  const final = { home: you, away: otherWinner };
  return {
    state: { ...state, semis, final },
    fixtures: [{
      week: FINAL.week, opponent: otherWinner, home: true, played: false,
      kind: "playoff", competition: "Play-Offs", round: "Play-Off Final",
    }],
    result: "through",
    message: `Through to the final. ${otherWinner} are waiting.`,
  };
}

/** Has the league been played out? Used to decide when to seed. */
export function leagueSeasonComplete(career: CareerState, week: number): boolean {
  return week >= matchweeksFor(divisionOf(career));
}
