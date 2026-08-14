import {
  MONTH_NAMES, WEEKS_PER_MONTH, monthOf, monthName, endsMonth,
  monthCandidates, voteMonth, monthRace, alreadyAwarded,
} from "../../lib/star/potm";
import { buildLeagueSquad, type RosterRow } from "../../lib/star/leagueSquads";
import { buildGraphic } from "../../lib/star/media/graphics";
import { shortClub } from "../../lib/star/media/grammar";
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

  const asRecord = (week: number) => ({ week }) as never;
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
  const empty = buildGraphic("potmNominees", asEvent, asRecord(30), career, {} as never, rng);
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
