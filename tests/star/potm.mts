import {
  MONTH_NAMES, WEEKS_PER_MONTH, monthOf, monthName, endsMonth,
  monthCandidates, voteMonth, monthRace, alreadyAwarded, faceOf,
} from "../../lib/star/potm";
import { buildLeagueSquad, type RosterRow } from "../../lib/star/leagueSquads";
import { buildGraphic } from "../../lib/star/media/graphics";
import { shortClub } from "../../lib/star/media/grammar";
import { detectMatch } from "../../lib/star/media/detect";
import { chooseTemplate } from "../../lib/star/media/templates";
import { emptyMemory } from "../../lib/star/media/memory";
import { buildMatchRecord } from "../../lib/star/media/record";
import { makeInitialCareer, creditMatchResult } from "../../lib/star/careerFlow";
import { nextFixtureFor } from "../../lib/star/competitions";
import type { CareerState } from "../../lib/star/types";

/**
 * PLAYER OF THE MONTH.
 *
 * The award is a VOTE, not a sum. Goals help enormously and do not settle it: a
 * striker with four in a month his side lost three of loses to a midfielder with
 * two and four wins, and sometimes he just loses. So what has to hold is that
 * the leading scorer is a strong favourite and never a certainty — a total is
 * wrong in one direction and a coin toss is wrong in the other.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };
const pct = (n: number, d: number) => `${((n / d) * 100).toFixed(1)}%`;

function mulberry(a: number) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CLUBS = [
  "Liverpool", "Arsenal", "Manchester City", "Chelsea", "Tottenham Hotspur",
  "Manchester United", "Newcastle United", "Aston Villa", "Brighton & Hove Albion",
  "West Ham United", "Everton", "Fulham FC", "Crystal Palace", "Brentford",
  "Wolverhampton Wanderers", "Nottingham Forest", "AFC Bournemouth", "Leeds United",
  "Burnley", "Sunderland",
];

// ── The calendar ────────────────────────────────────────────────────────────
{
  check(MONTH_NAMES.length === 10, `a season is ten months (${MONTH_NAMES.length})`);
  check(monthOf(1) === 0 && monthName(1) === "August", "week 1 is August");
  check(monthOf(4) === 0 && monthOf(5) === 1, "the month turns after four weeks");
  check(monthOf(38) === MONTH_NAMES.length - 1, `the last week is ${monthName(38)}`);
  check(monthOf(-3) === 0, "a nonsense week does not fall off the front");
  check(monthOf(999) === MONTH_NAMES.length - 1, "…nor off the back");

  check(endsMonth(4, 38) && !endsMonth(3, 38), "the month ends on its fourth week");
  check(endsMonth(38, 38), "…and the season's last week always ends one");
  check(endsMonth(37, 37), "even when the season is short");
  // Every week belongs to exactly one month, and every month has weeks in it.
  const seen = new Set(Array.from({ length: 38 }, (_, i) => monthOf(i + 1)));
  check(seen.size === MONTH_NAMES.length, `every month has football in it (${seen.size})`);
}

// ── A month of results turns into candidates ────────────────────────────────
{
  const player = {
    firstName: "Mikey", lastName: "Vass", age: 16, position: "ST",
    club: "Liverpool", nationality: "England",
  } as never;
  const base = makeInitialCareer(player, CLUBS);
  const career: CareerState = {
    ...base,
    results: [
      // Week 1: you score twice and win; a rival scores once and loses.
      { week: 1, home: "Liverpool", away: "Everton", hs: 2, as: 1,
        hg: [{ m: 20, s: "Vass" }, { m: 55, s: "Vass", a: "Salah" }],
        ag: [{ m: 70, s: "Calvert-Lewin" }] },
      // Week 2: a hat-trick for somebody whose side lost anyway.
      { week: 2, home: "Arsenal", away: "Chelsea", hs: 3, as: 4,
        hg: [{ m: 5, s: "Saka" }, { m: 30, s: "Saka" }, { m: 66, s: "Saka", a: "Rice" }],
        ag: [{ m: 10, s: "Palmer" }, { m: 40, s: "Palmer" }, { m: 61, s: "Jackson" }, { m: 88, s: "Jackson" }] },
      // Week 5 is next month and must not count.
      { week: 5, home: "Liverpool", away: "Arsenal", hs: 9, as: 0,
        hg: Array.from({ length: 9 }, (_, i) => ({ m: 5 + i * 9, s: "Vass" })) },
    ],
  };

  const aug = monthCandidates(career, 0);
  const by = (n: string) => aug.find(c => c.name === n);
  check(by("Vass")?.goals === 2, `your two count and September's nine do not (${by("Vass")?.goals})`);
  check(by("Saka")?.goals === 3, `a hat-trick counts (${by("Saka")?.goals})`);
  check(by("Salah")?.assists === 1, `an assist counts (${by("Salah")?.assists})`);
  check(by("Rice")?.assists === 1, "…for anybody, at any club");
  check(by("Vass")?.isYou === true, "you are recognised as you");
  check(by("Saka")?.isYou === false, "and nobody else is");
  check(!aug.some(c => c.name === "Van Dijk"), "a man who did nothing is not a candidate");

  // Points follow the club, so a scorer's side's month counts for him.
  check(by("Vass")?.points === 3, `your side took three points (${by("Vass")?.points})`);
  check(by("Saka")?.points === 0, `Arsenal took none (${by("Saka")?.points})`);
  check(by("Palmer")?.points === 3, `Chelsea took three (${by("Palmer")?.points})`);

  // September is its own month.
  const sep = monthCandidates(career, 1);
  check(sep.find(c => c.name === "Vass")?.goals === 9, "September counts September");
  check(monthCandidates(career, 7).length === 0, "a month with no football has no candidates");
}

// ── The vote: a favourite, not a certainty ──────────────────────────────────
{
  const player = {
    firstName: "Test", lastName: "Player", age: 20, position: "ST",
    club: "Liverpool", nationality: "England",
  } as never;
  const base = makeInitialCareer(player, CLUBS);

  // Four men, four/three/two/one goals, each in a win so nothing but the goals
  // separates them. Run across three thousand seasons so the vote's own seed
  // moves while the football does not.
  const N = 3000;
  const tally: Record<string, number> = {};
  for (let season = 1; season <= N; season++) {
    const career: CareerState = {
      ...base, season,
      results: [
        { week: 1, home: "Arsenal", away: "Everton", hs: 4, as: 0,
          hg: [{ m: 5, s: "Four" }, { m: 20, s: "Four" }, { m: 40, s: "Four" }, { m: 60, s: "Four" }] },
        { week: 2, home: "Chelsea", away: "Burnley", hs: 3, as: 0,
          hg: [{ m: 12, s: "Three" }, { m: 40, s: "Three" }, { m: 70, s: "Three", a: "Helper" }] },
        { week: 3, home: "Everton", away: "Burnley", hs: 2, as: 0,
          hg: [{ m: 12, s: "Two" }, { m: 60, s: "Two" }] },
        { week: 3, home: "Leeds United", away: "Brentford", hs: 1, as: 0,
          hg: [{ m: 12, s: "One" }] },
      ],
    };
    tally[voteMonth(career, 0)!.winner] = (tally[voteMonth(career, 0)!.winner] ?? 0) + 1;
  }
  const share = (n: string) => (tally[n] ?? 0) / N;

  // The shape the award has in life. Measured, not asserted at a guess.
  check(share("Four") > 0.6 && share("Four") < 0.9,
    `the leading scorer is a strong favourite and not a certainty (${pct(tally.Four ?? 0, N)})`);
  check(share("Three") > 0.1,
    `the man behind him takes it often enough to argue about (${pct(tally.Three ?? 0, N)})`);
  check(share("Two") > 0 && share("Two") < 0.1,
    `a two-goal month is an outside chance (${pct(tally.Two ?? 0, N)})`);
  check(share("One") === 0, `and a one-goal month never wins it (${pct(tally.One ?? 0, N)})`);
  check(share("Helper") === 0, "nor does an assist on its own");
  // …and the order is monotonic: more goals is always a better chance.
  check(share("Four") > share("Three") && share("Three") > share("Two") && share("Two") >= share("One"),
    "more goals is always a better chance");
}

// ── The same month always votes the same way ────────────────────────────────
{
  const player = {
    firstName: "Test", lastName: "Player", age: 20, position: "ST",
    club: "Liverpool", nationality: "England",
  } as never;
  const career: CareerState = {
    ...makeInitialCareer(player, CLUBS),
    results: [
      { week: 1, home: "Arsenal", away: "Everton", hs: 3, as: 1,
        hg: [{ m: 5, s: "A" }, { m: 20, s: "B", a: "A" }, { m: 40, s: "A" }],
        ag: [{ m: 70, s: "C" }] },
    ],
  };
  const a = voteMonth(career, 0)!;
  const b = voteMonth(career, 0)!;
  check(a.winner === b.winner, "the vote is deterministic");
  check(JSON.stringify(a.nominees) === JSON.stringify(b.nominees), "…shortlist and all");

  check(a.nominees.length > 0 && a.nominees.length <= 5, `a shortlist of at most five (${a.nominees.length})`);
  check(a.nominees[0].name === a.winner, "the winner heads the shortlist");
  check(a.monthName === "August", `it is named (${a.monthName})`);
  check(a.month === 0 && a.season === career.season, "and dated");
  check(voteMonth(career, 6) === null, "a month with no football awards nothing");
}

// ── Your place on the shortlist ─────────────────────────────────────────────
{
  const player = {
    firstName: "Mikey", lastName: "Vass", age: 16, position: "ST",
    club: "Liverpool", nationality: "England",
  } as never;
  const withYou: CareerState = {
    ...makeInitialCareer(player, CLUBS),
    results: [
      { week: 1, home: "Liverpool", away: "Everton", hs: 3, as: 0,
        hg: [{ m: 5, s: "Vass" }, { m: 20, s: "Vass" }, { m: 40, s: "Vass" }] },
      { week: 2, home: "Arsenal", away: "Chelsea", hs: 1, as: 0, hg: [{ m: 9, s: "Saka" }] },
    ],
  };
  const mine = voteMonth(withYou, 0)!;
  check(mine.yourPlace !== undefined, "a month you scored in puts you on the shortlist");
  check(mine.nominees.some(n => n.isYou), "…and marks which one is you");
  check(mine.yourPlace! <= 2, `a hat-trick in a win places you high (${mine.yourPlace})`);

  const withoutYou: CareerState = {
    ...withYou,
    results: [{ week: 1, home: "Arsenal", away: "Chelsea", hs: 1, as: 0, hg: [{ m: 9, s: "Saka" }] }],
  };
  const theirs = voteMonth(withoutYou, 0)!;
  check(theirs.yourPlace === undefined, "a month you did nothing in leaves you off it");
  check(theirs.isYou === false, "…and somebody else wins it");
}

// ── The race, before the vote ───────────────────────────────────────────────
{
  const player = {
    firstName: "Test", lastName: "Player", age: 20, position: "ST",
    club: "Liverpool", nationality: "England",
  } as never;
  const career: CareerState = {
    ...makeInitialCareer(player, CLUBS),
    results: [
      { week: 1, home: "Arsenal", away: "Everton", hs: 4, as: 0,
        hg: [{ m: 5, s: "Big" }, { m: 20, s: "Big" }, { m: 40, s: "Big" }, { m: 60, s: "Big" }] },
      { week: 2, home: "Chelsea", away: "Burnley", hs: 1, as: 0, hg: [{ m: 12, s: "Small" }] },
    ],
  };
  const race = monthRace(career, 0);
  check(race[0].name === "Big", `the race is led by the numbers, not by a vote (${race[0].name})`);
  check(race.every((c, i) => i === 0 || c.score <= race[i - 1].score), "and is in order");
  // …and it disagrees with the award often enough to be worth reporting.
  check(monthRace(career, 0)[0].name === monthRace(career, 0)[0].name, "the race is stable");
}

// ── Played through the season, it awards once a month ───────────────────────
{
  const player = {
    firstName: "Mikey", lastName: "Vass", age: 16, position: "ST",
    club: "Liverpool", nationality: "England",
  } as never;
  let c: CareerState = {
    ...makeInitialCareer(player, CLUBS),
    leagueSquads: CLUBS.map(x => buildLeagueSquad(x, roster(x))),
  };

  const stats = {
    homeScore: 2, awayScore: 1, chances: 2, goals: 1, assists: 1, passes: 10,
    rating: 7.6, starMan: false, bossChange: 0, teamChange: 0, fansChange: 0,
    wage: 0, goalBonus: 0, sponsorPay: 0, totalCash: 0,
    goalEvents: [{ minute: 20, scorer: "Mikey Vass", isUserGoal: true }],
  } as never;

  let awardedAt: number[] = [];
  for (let w = 0; w < 26; w++) {
    const f = nextFixtureFor(c);
    if (!f) break;
    const out = creditMatchResult(c, f, stats);
    c = out.career;
    if (out.potmAwarded) awardedAt.push(out.potmAwarded.month);
  }

  check(awardedAt.length >= 4, `a run of matches awards several months (${awardedAt.length})`);
  check(new Set(awardedAt).size === awardedAt.length, `and never the same month twice (${awardedAt.join(",")})`);
  check(awardedAt.every((m, i) => i === 0 || m > awardedAt[i - 1]), "in order");
  check((c.potm ?? []).length === awardedAt.length, "each one is kept on the career");
  check(alreadyAwarded(c, awardedAt[0]), "…and an awarded month is not re-awarded");
  check(!alreadyAwarded(c, 9), "a month that has not happened is not awarded");

  // Winning one is an honour on your record; somebody else winning is not.
  const yoursWon = (c.potm ?? []).filter(a => a.isYou).length;
  const honours = (c.awards ?? []).filter(a => a.kind === "Player of the Month").length;
  check(honours === yoursWon, `only the ones you won go on your honours (${honours} of ${yoursWon})`);
}

// ── The nominees graphic ────────────────────────────────────────────────────
//
// A shortlist card is eight names, eight clubs and eight sets of colours, and
// every one of those is a chance to render something unreadable or something
// blank. What has to hold: the right eight in the right order, a club label that
// fits the box it is drawn in, and nothing at all when the month has not
// produced a shortlist yet.
{
  const player = {
    firstName: "Mikey", lastName: "Vass", age: 19, position: "ST",
    club: "Liverpool", nationality: "England",
  } as never;
  const base = makeInitialCareer(player, CLUBS);

  // Ten different scorers across August, on ten different clubs, so there is
  // more than a shortlist's worth to cut down.
  const scorers = CLUBS.slice(0, 10).map((club, i) => ({ club, name: `Scorer${i}`, goals: 10 - i }));
  const results = scorers.map((s, i) => ({
    week: 1 + (i % 4),
    home: s.club, away: CLUBS[19 - (i % 10)], hs: s.goals, as: 0,
    hg: Array.from({ length: s.goals }, (_, g) => ({ m: 3 + g * 8, s: s.name })),
    ag: [],
  }));
  // …and you, on four goals, so a middling entry is present and identified.
  results.push({
    week: 2, home: "Liverpool", away: "Burnley", hs: 4, as: 0,
    hg: Array.from({ length: 4 }, (_, g) => ({ m: 10 + g * 15, s: "Vass" })), ag: [],
  });
  const career: CareerState = { ...base, results: results as never };

  const asRecord = (week: number, month = 0) =>
    ({ week, potmRace: { month, monthName: "August", contenders: 9, goals: 0, assists: 0,
      decidesToday: false, decidesNextWeek: true, leader: "x" } }) as never;
  const asEvent = { id: "potm-decides", facts: {}, subject: { kind: "you" }, tags: [] } as never;
  const rng = mulberry(7);

  const spec = buildGraphic("potmNominees", asEvent, asRecord(4), career, {} as never, rng);
  check(spec?.type === "potmNominees", `the last round of a busy month makes a card (${spec?.type})`);

  if (spec?.type === "potmNominees") {
    check(spec.month === "August", `it names the month it is about (${spec.month})`);
    check(spec.nominees.length === 8, `eight nominees, not ten (${spec.nominees.length})`);
    check(spec.winner === undefined, "and no winner, because nobody has voted yet");

    // The order is the month's football, best first.
    const race = monthRace(career, 0).slice(0, 8);
    check(
      spec.nominees.every((n, i) => n.name === race[i].name),
      "the card is in the same order as the race it is drawn from",
    );
    check(spec.nominees[0].goals >= spec.nominees[7].goals, "…which puts the strongest month first");

    const you = spec.nominees.find(n => n.isYou);
    check(you?.name === "Vass", `you are on it and marked as you (${you?.name})`);
    check(spec.nominees.filter(n => n.isYou).length === 1, "and exactly once");
    check(spec.nominees.every(n => n.club.length > 0), "every nominee has a club to be drawn in");
  }

  // A month nobody has played is not a shortlist with gaps — it is no card.
  const empty = buildGraphic("potmNominees", asEvent, asRecord(30, 7), career, {} as never, rng);
  check(empty === undefined, "a month with no football produces no card at all");

  // Nor is a thin one. Three scorers in a grid of eight is five empty boxes.
  const thin: CareerState = {
    ...base,
    results: [{
      week: 1, home: "Arsenal", away: "Everton", hs: 3, as: 0,
      hg: [{ m: 10, s: "A" }, { m: 20, s: "B" }, { m: 30, s: "C" }], ag: [],
    }] as never,
  };
  check(
    buildGraphic("potmNominees", asEvent, asRecord(4), thin, {} as never, rng) === undefined,
    "and neither does a month only three men scored in",
  );
}

// ── The shortlist is news whether or not you are on it ──────────────────────
//
// This was the bug: the card was gated behind your being in the top three of the
// race, so it appeared in months you were having a good one and vanished in the
// months you were not. A graphic that only shows up when you are winning is not
// a media feed. What has to hold now is that the last round of a month always
// produces the card, and that being on the list only changes the sentence over
// it.
{
  // A round to go, which is when the shortlist goes up. NOT the last round —
  // by then the vote has run and the winner exists, and the winner card has it.
  const race = (place: number | undefined, contenders = 9) => ({
    monthName: "August", place, contenders, goals: place ? 4 : 0,
    assists: place ? 1 : 0, decidesToday: false, decidesNextWeek: true, leader: "Haaland",
  });
  const record = (potmRace: unknown) => ({
    id: "s1-w4-league-Everton", season: 1, week: 4, competition: "Premier League",
    kind: "league", derby: false, home: true, neutral: false,
    club: "Liverpool", opponent: "Everton", clubStrength: 80, opponentStrength: 72,
    score: { us: 2, them: 1 }, result: "win", goals: [], potmRace,
    you: {
      name: "Mikey Vass", shortName: "Vass", position: "ST", squadNumber: 19, rating: 7.4,
      goals: 1, assists: 0, seasonGoals: 6, seasonAssists: 2, careerGoals: 6,
      careerAppearances: 4, minutes: 90, starMan: false,
    },
    table: { after: { position: 3, points: 9, gd: 4 }, before: { position: 4, points: 6, gd: 3 }, matchesLeft: 34 },
    context: { managerName: "R. Hughes", teamMorale: 70, fanOpinion: 70, bossOpinion: 70 },
  }) as never;

  const fire = (r: unknown) => detectMatch(r as never, emptyMemory()).filter(e => e.id === "potm-decides");

  const notOnIt = fire(record(race(undefined)));
  check(notOnIt.length === 1, `the last round fires when you are nowhere near it (${notOnIt.length})`);
  check(notOnIt[0]?.facts.place === undefined, "…with no place, because you do not have one");
  check(notOnIt[0]?.facts.leader === "Haaland", "…and the man who does");

  const onIt = fire(record(race(1)));
  check(onIt[0]?.facts.place === 1, "leading it still says so");
  check(
    (onIt[0]?.baseImportance ?? 0) > (notOnIt[0]?.baseImportance ?? 0),
    "leading it is the bigger story of the two",
  );

  // A month with nobody in it is still not a shortlist.
  check(fire(record(race(undefined, 3))).length === 0, "three contenders produce no card");

  // …and on the round that actually decides it, the shortlist stands down.
  const decided = { ...race(2), decidesToday: true, decidesNextWeek: false };
  check(fire(record(decided)).length === 0,
    "the last round does not publish a shortlist — the vote has already run");

  // …and the line that gets written has to exist for both. A template that
  // requires a place cannot serve a player who has not got one, and before this
  // there was no other template — which is the whole reason nothing appeared.
  for (const [label, ev] of [["not nominated", notOnIt[0]], ["nominated", onIt[0]]] as const) {
    const t = chooseTemplate(ev, "stats", "analyse", emptyMemory(), mulberry(3), false);
    check(!!t, `${label}: a stats account has a line for it`);
    check(t?.graphic === "potmNominees", `${label}: and the line carries the shortlist card (${t?.graphic})`);
  }
}

// ── The winner reaches the feed ─────────────────────────────────────────────
//
// A month of football that ends with nobody saying who won it is the gap this
// closes: the award existed, went onto your honours if you won it, and was never
// once mentioned. What has to hold is that the match which decides a month
// carries the award on its record, that it fires exactly once, and that the
// winner being somebody else does not make it silent.
{
  const player = {
    firstName: "Mikey", lastName: "Vass", age: 16, position: "ST",
    club: "Liverpool", nationality: "England",
  } as never;
  let c: CareerState = {
    ...makeInitialCareer(player, CLUBS),
    leagueSquads: CLUBS.map(x => buildLeagueSquad(x, roster(x))),
  };
  const stats = {
    homeScore: 2, awayScore: 1, chances: 2, goals: 1, assists: 1, passes: 10,
    rating: 7.6, starMan: false, bossChange: 0, teamChange: 0, fansChange: 0,
    wage: 0, goalBonus: 0, sponsorPay: 0, totalCash: 0,
    goalEvents: [{ minute: 20, scorer: "Mikey Vass", isUserGoal: true }],
  } as never;

  let awarded = 0, carried = 0, posted = 0, shortlists = 0;
  const winners = new Set<string>();
  for (let w = 0; w < 20; w++) {
    const f = nextFixtureFor(c);
    if (!f) break;
    const before = c;
    const out = creditMatchResult(c, f, stats);
    c = out.career;
    if (out.potmAwarded) awarded++;

    const rec = buildMatchRecord(before, c, f, stats);
    if (rec.potmAward) {
      carried++;
      winners.add(rec.potmAward.winner);
      check(rec.potmAward.monthName.length > 0, "the award on the record knows its month");
    }
    const events = detectMatch(rec, emptyMemory());
    const award = events.filter(e => e.id === "potm-won" || e.id === "potm-winner");
    const list = events.filter(e => e.id === "potm-decides");
    posted += award.length;
    shortlists += list.length;
    check(award.length <= 1, "the award is announced once, not once per detector");
    // The two cards never land in the same cycle: one is a question and the
    // other is its answer.
    check(!(award.length && list.length), "a shortlist and its winner never post together");
  }

  check(awarded > 0, `months were awarded (${awarded})`);
  check(carried === awarded, `every award reaches the record (${carried} of ${awarded})`);
  check(posted === awarded, `and every one of them is posted (${posted} of ${awarded})`);
  check(shortlists > 0, `and the shortlist still goes up in the round before (${shortlists})`);
  check(winners.size > 0, "the winners have names");

  // The card the post carries.
  const spec = buildGraphic(
    "potmWinner",
    { id: "potm-winner", tags: [], subject: { kind: "you" },
      facts: { month: "September", winner: "Haaland", winnerClub: "Manchester City",
        goals: 6, assists: 1, place: 4 } } as never,
    { week: 8 } as never, c, {} as never, mulberry(11),
  );
  if (spec?.type === "potmWinner") {
    check(spec.lastName === "Haaland", `the surname is set on its own (${spec.lastName})`);
    check(spec.month === "September", "and the month it was won in");
    check(spec.goals === 6 && spec.assists === 1, "with the numbers that won it");
    check(!("runnerUp" in spec), "and nothing about who he beat — the card does not say it");
    check(spec.yourPlace === 4, "and where you came");
    check(spec.isYou === false && spec.number === undefined, "somebody else's card is not yours");
  } else {
    check(false, "the winner card built");
  }

  const yours = buildGraphic(
    "potmWinner",
    { id: "potm-won", tags: [], subject: { kind: "you" },
      facts: { month: "October", goals: 7, assists: 3 } } as never,
    { week: 12 } as never, { ...c, squadNumber: 19 }, {} as never, mulberry(12),
  );
  if (yours?.type === "potmWinner") {
    check(yours.isYou, "winning it yourself is marked");
    check(yours.firstName === "Mikey" && yours.lastName === "Vass",
      `and it uses your full name (${yours.firstName} ${yours.lastName})`);
    check(yours.number === 19, `with your shirt number where a photograph would be (${yours.number})`);
    check(yours.face === undefined, "…and never somebody else's face");
    check(yours.yourPlace === undefined, "\"you finished 1st\" is not worth saying to a winner");
  } else {
    check(false, "your own winner card built");
  }

  // …and the same card once you have taken a picture. The shirt is a fallback,
  // not a rule, and `own` is what tells the renderer this one has a room behind
  // it rather than being a cut-out on transparent.
  const withPhoto = {
    ...c, squadNumber: 19,
    player: { ...c.player, portrait: "data:image/webp;base64,AAAA" },
  } as CareerState;
  const shot = buildGraphic(
    "potmWinner",
    { id: "potm-won", tags: [], subject: { kind: "you" },
      facts: { month: "October", goals: 7, assists: 3 } } as never,
    { week: 12 } as never, withPhoto, {} as never, mulberry(13),
  );
  if (shot?.type === "potmWinner") {
    check(shot.face === "data:image/webp;base64,AAAA", "your photograph is used when you have one");
    check(shot.own === true, "…and is marked as yours, so it is treated rather than stood on the plate");
    check(shot.number === undefined, "the shirt number steps aside for it");
  } else {
    check(false, "the winner card built with a photograph");
  }
}

// ── Both cards actually reach the feed, over a real season ──────────────────
//
// The regression this exists to stop: `record.ts` asked the OLD four-week
// `monthOf` while `careerFlow` used the real calendar, so the two disagreed
// about which month a week belonged to. `monthRace` was handed an index the
// results were not filed under, came back with two or three contenders instead
// of nine, tripped the "fewer than six is not a shortlist" guard, and the
// nominees card silently never rendered. Reported as exactly that: the winner
// showed up in the feed and the nominees never did.
//
// Counting them over a played season is the only way to catch it — every piece
// in isolation looked right.
{
  const player = {
    firstName: "Mikey", lastName: "Vass", age: 16, position: "ST",
    club: "Liverpool", nationality: "England",
  } as never;
  let c: CareerState = {
    ...makeInitialCareer(player, CLUBS),
    leagueSquads: CLUBS.map(x => buildLeagueSquad(x, roster(x))),
  };
  const stats = {
    homeScore: 2, awayScore: 1, chances: 2, goals: 1, assists: 1, passes: 10,
    rating: 7.6, starMan: false, bossChange: 0, teamChange: 0, fansChange: 0,
    wage: 0, goalBonus: 0, sponsorPay: 0, totalCash: 0,
    goalEvents: [{ minute: 20, scorer: "Mikey Vass", isUserGoal: true }],
  } as never;

  let shortlists = 0, winners = 0, awards = 0;
  const monthsSeen = new Set<string>();
  for (let w = 0; w < 30; w++) {
    const f = nextFixtureFor(c);
    if (!f) break;
    const before = c;
    const out = creditMatchResult(c, f, stats);
    c = out.career;
    if (out.potmAwarded) awards++;

    const rec = buildMatchRecord(before, c, f, stats);
    const events = detectMatch(rec, emptyMemory());
    for (const e of events) {
      if (e.id === "potm-decides") {
        shortlists++;
        monthsSeen.add(String(e.facts.month));
        // …and the card it carries must actually build. A fired event with no
        // graphic is the same silence with an extra step.
        const card = buildGraphic("potmNominees", e, rec, c, emptyMemory(), mulberry(w + 1));
        check(card?.type === "potmNominees", `week ${f.week}: the shortlist event builds its card`);
        if (card?.type === "potmNominees") {
          check(card.nominees.length === 8, `week ${f.week}: eight nominees (${card.nominees.length})`);
        }
      }
      if (e.id === "potm-won" || e.id === "potm-winner") winners++;
    }
  }

  check(awards > 0, `months were awarded (${awards})`);
  check(shortlists > 0, `and the shortlist card fired at all (${shortlists})`);
  check(winners > 0, `as did the winner card (${winners})`);
  // One shortlist per month, and never the same month twice.
  check(monthsSeen.size === shortlists,
    `one shortlist per month, not several (${shortlists} cards, ${monthsSeen.size} months)`);
  // The two are a pair: a month that gets a winner should have had a shortlist
  // the round before it.
  check(Math.abs(shortlists - winners) <= 1,
    `the two arrive in pairs (${shortlists} shortlists, ${winners} winners)`);
}

// ── Faces ───────────────────────────────────────────────────────────────────
//
// A candidate is a string, not a player, and the two halves of the division
// write that string differently: your own club's goals are filed by surname,
// everybody else's by shortNameOf. Getting a photograph onto a tile means
// matching one against the other, through accents and two-part surnames, and
// showing nothing at all rather than the wrong man.
{
  const player = {
    firstName: "Mikey", lastName: "Vass", age: 19, position: "ST",
    club: "Liverpool", nationality: "England",
  } as never;
  const career: CareerState = {
    ...makeInitialCareer(player, CLUBS),
    squad: [
      { id: "1", name: "Danny Reeves", shortName: "Reeves", position: "CM",
        seasonGoals: 0, seasonAssists: 0, careerGoals: 0, careerAssists: 0,
        imageUrl: "https://cdn/reeves.png" },
      { id: "2", name: "Sam Nolan", shortName: "Nolan", position: "CB",
        seasonGoals: 0, seasonAssists: 0, careerGoals: 0, careerAssists: 0 },
    ] as never,
    leagueSquads: [
      { club: "Arsenal", players: [
        { id: "a1", name: "M. Ødegaard", position: "CAM", overall: 88, goals: 0, assists: 0, image: "https://cdn/ode.png" },
        { id: "a2", name: "V. van Dijk", position: "CB", overall: 89, goals: 0, assists: 0, image: "https://cdn/vvd.png" },
        { id: "a3", name: "K. Havertz", position: "ST", overall: 84, goals: 0, assists: 0 },
      ] },
    ] as never,
  };

  check(faceOf(career, "Reeves", "Liverpool") === "https://cdn/reeves.png",
    "a team-mate filed by surname finds his photograph");
  check(faceOf(career, "Nolan", "Liverpool") === undefined,
    "a team-mate the database has no photograph of gets none");
  check(faceOf(career, "Ødegaard", "Arsenal") === "https://cdn/ode.png",
    "another club's scorer, filed the way nameGoals files him");
  check(faceOf(career, "Odegaard", "Arsenal") === "https://cdn/ode.png",
    "…and the accent is not allowed to lose him");
  check(faceOf(career, "van Dijk", "Arsenal") === "https://cdn/vvd.png",
    "a two-part surname is a surname, not its last word");
  check(faceOf(career, "Havertz", "Arsenal") === undefined, "no image, no face");
  check(faceOf(career, "Nobody", "Arsenal") === undefined, "an unknown name gets nothing");
  check(faceOf(career, "Ødegaard", "Chelsea") === undefined,
    "and a name is only looked for at the club it was filed under");

  // What the card ends up carrying: photographs for the eight, the back of a
  // shirt for the one man who never had a photograph taken.
  // Eight clubs that are not yours, so nothing here can be mistaken for you.
  const others = CLUBS.filter(c => c !== "Liverpool" && c !== "Burnley").slice(0, 8);
  const withYou: CareerState = {
    ...career,
    squadNumber: 19,
    results: [
      ...others.map((club, i) => ({
        week: 1 + (i % 4), home: club, away: "Sunderland", hs: 9 - i, as: 0,
        hg: Array.from({ length: 9 - i }, (_, g) => ({
          // The first is Ødegaard, filed at Arsenal, which is the squad his
          // photograph is in. The rest are nobody, and get monograms.
          m: 4 + g * 9, s: club === "Arsenal" ? "Ødegaard" : `Man${i}`,
        })),
        ag: [],
      })),
      // Six for you, clear of the tie at the bottom of the eight, so the test is
      // about what your tile carries rather than about whether you made the cut.
      { week: 2, home: "Liverpool", away: "Burnley", hs: 7, as: 0,
        hg: [
          ...Array.from({ length: 6 }, (_, g) => ({ m: 8 + g * 12, s: "Vass" })),
          { m: 85, s: "Reeves" },
        ], ag: [] },
    ] as never,
  };
  const asRecordFor = (month: number) =>
    ({ week: 4, potmRace: { month, monthName: "August", contenders: 9, goals: 0, assists: 0,
      decidesToday: false, decidesNextWeek: true, leader: "x" } }) as never;
  const card = buildGraphic("potmNominees", { id: "potm-decides", facts: {}, subject: { kind: "you" }, tags: [] } as never,
    asRecordFor(0), withYou, {} as never, mulberry(5));
  if (card?.type === "potmNominees") {
    const mine = card.nominees.find(n => n.isYou);
    check(mine?.number === 19, `your tile carries your squad number (${mine?.number})`);
    check(mine?.face === undefined, "…and never a photograph of somebody else");
    const ode = card.nominees.find(n => n.name === "Ødegaard");
    check(ode?.face === "https://cdn/ode.png", `a real footballer carries his (${ode?.face})`);
    check(card.nominees.filter(n => n.number !== undefined).length === 1,
      "exactly one tile is a shirt back");
  } else {
    check(false, "the card built at all");
  }
}

// ── Club names at caption width ─────────────────────────────────────────────
{
  const expected: Record<string, string> = {
    "Wolverhampton Wanderers": "Wolves",
    "Manchester United": "Man Utd",
    "Manchester City": "Man City",
    "Brighton & Hove Albion": "Brighton",
    "AFC Bournemouth": "Bournemouth",
    "Fulham FC": "Fulham",
    "Leeds United": "Leeds",
    "Newcastle United": "Newcastle",
    "West Ham United": "West Ham",
    "Tottenham Hotspur": "Tottenham",
    "Nottingham Forest": "Nottingham Forest",
    "Crystal Palace": "Crystal Palace",
    "Aston Villa": "Aston Villa",
    "Liverpool": "Liverpool",
  };
  for (const [full, want] of Object.entries(expected)) {
    check(shortClub(full) === want, `${full} → ${want} (got ${shortClub(full)})`);
  }
  // The two Manchesters and the two Uniteds must stay tellable apart.
  const shorts = CLUBS.map(shortClub);
  check(new Set(shorts).size === CLUBS.length, "no two clubs shorten to the same caption");
  check(shorts.every(s => s.length >= 4), `nothing shortens to an initial (${shorts.filter(s => s.length < 4)})`);
}

function roster(club: string, n = 24): RosterRow[] {
  const rng = mulberry(club.length * 17);
  const POS = ["GK", "CB", "CB,LB", "RB", "LB", "CDM", "CM", "CM,CAM", "CAM", "LW", "RW", "ST"];
  return Array.from({ length: n }, (_, i) => ({
    id: `${club}-${i}`, name: `${club.slice(0, 3)}P${i}`,
    positions: POS[i % POS.length], overall: 60 + Math.floor(rng() * 32),
  }));
}

if (problems.length) {
  console.error("FAIL");
  for (const p of problems.slice(0, 15)) console.error("  ✗ " + p);
  if (problems.length > 15) console.error(`  …and ${problems.length - 15} more`);
  process.exit(1);
}
console.log("PASS — a month of football, a shortlist, and a vote that favours the leading scorer without obeying him");
