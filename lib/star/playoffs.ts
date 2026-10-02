import type { CareerState, Fixture, LeagueTeam } from "./types";
import { sortLeague, simulateFixtureScore, mulberry32 } from "./season";
import { divisionOf, matchweeksFor, PLAY_OFF_SLOTS, isRegionalDivision } from "./calendar";
import { singleMatchTie } from "./promotion";

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
  /** Third to sixth, in that order (North/South: 2nd to 7th). */
  contenders: string[];
  /**
   * North/South (2026/27 rules): six clubs, one match per tie. Qualifying
   * round 4th v 7th and 5th v 6th, semi-finals 2nd and 3rd at home to the
   * qualifiers' winners, final at the higher finisher's ground. `qualifiers`
   * holds the qualifying round; `semis` the semi-finals, yours first.
   */
  format?: "six";
  qualifiers?: [PlayOffTieState, PlayOffTieState];
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

/**
 * How many go up automatically before the play-offs start; the play-offs are
 * the next four. League Two promotes its top three and plays off 4th-7th, as
 * in real life (Harry, 28 Sep 2026: "real"). Before, every division played
 * off 3rd-6th, so League Two's 3rd was promoted AND in the play-offs.
 * Matches promotion.ts BOUNDARIES (count − 1) and the League table's zones
 * (LeagueScreen LADDER).
 */
export function autoPromotionPlaces(division: ReturnType<typeof divisionOf>): number {
  return division === "league_two" ? 3
    : division === "national_league" || division === "national_league_north" || division === "national_league_south" ? 1
    : 2;
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
  // League Two now plays off 4th-7th, as in real life (autoPromotionPlaces
  // below); the others keep 3rd-6th.
  // Every division except the Premier League ends in real play-offs —
  // 3rd-to-6th, the exact same shape the Championship always had. League
  // One/Two and the National League have their own real play-off brackets
  // (League One 3rd-6th, League Two 4th-7th, National League 2nd-7th with
  // byes) but this reuses the Championship's own fidelity rather than
  // building three more distinct brackets — a deliberate simplification,
  // matched to how deep the existing Championship simulation itself goes.
  if (divisionOf(career) === "premier") return null;
  if (career.playOffState) return null;
  if (isRegionalDivision(divisionOf(career))) return seedSixClubPlayOffs(career);

  const table = sortLeague(career.league);
  const first = autoPromotionPlaces(divisionOf(career));
  if (table.length < first + 4) return null;
  const contenders = table.slice(first, first + 4).map(t => t.name);
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

// ── North/South: six clubs, one match a tie ─────────────────────────────────

const QUALIFIER_ROUND = "Play-Off Qualifier";
const SEMI_ROUND = "Play-Off Semi-Final";
const FINAL_ROUND = "Play-Off Final";

function strengthMap(league: LeagueTeam[]): Map<string, number> {
  return new Map(league.map(t => [t.name, t.strength]));
}

function tieState(t: ReturnType<typeof singleMatchTie>): PlayOffTieState {
  return { home: t.home, away: t.away, legs: t.legs, winner: t.winner };
}

/** Your club finished 2nd to 7th in North or South. Whatever doesn't involve
 *  you is played out now, so each round has its opponent waiting. */
function seedSixClubPlayOffs(career: CareerState): { state: PlayOffState; fixtures: Fixture[] } | null {
  const table = sortLeague(career.league).map(t => t.name);
  if (table.length < 7) return null;
  const contenders = table.slice(1, 7); // 2nd..7th
  const you = career.player.club;
  const at = contenders.indexOf(you);
  if (at < 0) return null;
  const [second, third, fourth, fifth, sixth, seventh] = contenders;
  const strength = strengthMap(career.league);
  const rng = mulberry32(career.season * 4409 + career.league.length * 17 + 6);

  const q1: PlayOffTieState = { home: fourth, away: seventh, legs: [] };
  const q2: PlayOffTieState = { home: fifth, away: sixth, legs: [] };
  const inQ1 = q1.home === you || q1.away === you;
  const inQ2 = q2.home === you || q2.away === you;
  const played = (t: PlayOffTieState): PlayOffTieState => tieState(singleMatchTie(t.home, t.away, strength, rng));
  const quals: [PlayOffTieState, PlayOffTieState] = [inQ1 ? q1 : played(q1), inQ2 ? q2 : played(q2)];

  // Semi-finals: 2nd v winner of 5th/6th, 3rd v winner of 4th/7th.
  const semiFor2nd = { home: second, away: quals[1].winner ?? "" };
  const semiFor3rd = { home: third, away: quals[0].winner ?? "" };
  let yours: PlayOffTieState, other: PlayOffTieState, fixture: Fixture;
  if (you === second || you === third || inQ2 || inQ1) {
    // Which semi is yours: through 2nd's (you are 2nd, 5th or 6th) or 3rd's.
    const throughSecond = you === second || inQ2;
    const mine = throughSecond ? semiFor2nd : semiFor3rd;
    const theirs = throughSecond ? semiFor3rd : semiFor2nd;
    other = tieState(singleMatchTie(theirs.home, theirs.away, strength, rng));
    if (you === second || you === third) {
      yours = { home: mine.home, away: mine.away, legs: [] };
      fixture = {
        week: SF2.week, opponent: mine.away, home: true, played: false,
        kind: "playoff", competition: "Play-Offs", round: SEMI_ROUND,
      };
    } else {
      // You start in the qualifying round; the semi's away side is you if you win it.
      yours = { home: mine.home, away: "", legs: [] };
      const q = inQ1 ? q1 : q2;
      const opp = q.home === you ? q.away : q.home;
      fixture = {
        week: SF1.week, opponent: opp, home: q.home === you, played: false,
        kind: "playoff", competition: "Play-Offs", round: QUALIFIER_ROUND,
      };
    }
  } else return null;

  return {
    state: { contenders, format: "six", qualifiers: quals, semis: [yours, other] },
    fixtures: [fixture],
  };
}

/** You're out: play the rest of the bracket so the promoted club is known
 *  now (promotion.ts takes it as the truth rather than re-rolling). */
function finishWithoutYou(career: CareerState, state: PlayOffState, beatYou: string): PlayOffState {
  const strength = strengthMap(career.league);
  const rng = mulberry32(career.season * 9173 + 61);
  const order = state.contenders;
  const higher = (a: string, b: string) => (order.indexOf(a) <= order.indexOf(b) ? [a, b] : [b, a]);
  let yourSemiWinner = beatYou;
  const semis = [...state.semis] as [PlayOffTieState, PlayOffTieState];
  if (!semis[0].winner) {
    // Knocked out in the qualifier: the club that beat you plays your semi.
    const t = singleMatchTie(semis[0].home, beatYou, strength, rng);
    semis[0] = tieState(t);
    yourSemiWinner = t.winner;
  }
  const [h, a] = higher(yourSemiWinner, semis[1].winner!);
  const fin = singleMatchTie(h, a, strength, rng);
  return { ...state, semis, final: { home: h, away: a, hs: fin.legs[0]?.hs, as: fin.legs[0]?.as, winner: fin.winner }, promoted: fin.winner };
}

/** One North/South play-off match you've just played. */
function settleSixClubFixture(
  career: CareerState, state: PlayOffState, fixture: Fixture, userScore: number, oppScore: number,
): PlayOffOutcome {
  const you = career.player.club;
  const hs = fixture.home ? userScore : oppScore;
  const as = fixture.home ? oppScore : userScore;
  const rng = mulberry32(career.season * 6607 + fixture.week * 41 + 6);
  // Level: extra time and penalties — a coin flip, a little the home side's way.
  const won = userScore !== oppScore ? userScore > oppScore : rng() < (fixture.home ? 0.55 : 0.45);
  const winner = won ? you : fixture.opponent;
  const after = userScore === oppScore ? " after extra time and penalties" : "";
  const order = state.contenders;
  const youHigher = (opp: string) => order.indexOf(you) < order.indexOf(opp);

  if (fixture.round === FINAL_ROUND) {
    return {
      state: { ...state, final: { ...(state.final ?? { home: you, away: fixture.opponent }), hs, as, winner }, promoted: winner, yourRunOver: true },
      fixtures: [],
      result: won ? "promoted" : "lost-final",
      message: won ? `Promoted${after}. ${you} win the play-off final and go up.` : `Beaten in the final${after}. ${fixture.opponent} go up instead.`,
    };
  }

  if (fixture.round === QUALIFIER_ROUND) {
    const quals = state.qualifiers!.map(q => (q.home === you || q.away === you ? { ...q, legs: [{ hs, as }], winner } : q)) as [PlayOffTieState, PlayOffTieState];
    if (!won) {
      return { state: finishWithoutYou(career, { ...state, qualifiers: quals, yourRunOver: true }, winner), fixtures: [], result: "eliminated",
        message: `Out in the qualifying round${after}. ${winner} go through.` };
    }
    const semi = { ...state.semis[0], away: you };
    return {
      state: { ...state, qualifiers: quals, semis: [semi, state.semis[1]] },
      fixtures: [{ week: SF2.week, opponent: semi.home, home: false, played: false, kind: "playoff", competition: "Play-Offs", round: SEMI_ROUND }],
      result: "through",
      message: `Through${after}. ${semi.home} at home in the semi-final.`,
    };
  }

  // The semi-final.
  const semi = { ...state.semis[0], legs: [{ hs, as }], winner };
  if (!won) {
    return { state: finishWithoutYou(career, { ...state, semis: [semi, state.semis[1]], yourRunOver: true }, winner), fixtures: [], result: "eliminated",
      message: `Out in the semi-final${after}. ${winner} go to the final.` };
  }
  const opp = state.semis[1].winner!;
  const home = youHigher(opp);
  return {
    state: { ...state, semis: [semi, state.semis[1]], final: home ? { home: you, away: opp } : { home: opp, away: you } },
    fixtures: [{ week: FINAL.week, opponent: opp, home, played: false, kind: "playoff", competition: "Play-Offs", round: FINAL_ROUND }],
    result: "through",
    message: `Through to the final${after}. ${opp} are waiting${home ? ", at yours" : ""}.`,
  };
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
  if (state.format === "six") return settleSixClubFixture(career, state, fixture, userScore, oppScore);

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
