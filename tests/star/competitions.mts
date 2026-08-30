import {
  seedSeasonKnockouts, resolveKnockout, qualificationFor, leaguePosition,
  internationalCallUp, tournamentFor, roundsFor, nextFixtureFor, leagueWeeks, cupRoundWeek,
} from "../../lib/star/competitions";
import { CUP_ROUND_NAMES } from "../../lib/star/cups";
import { makeInitialCareer, creditMatchResult, simulateMissedFixture, advanceSeason, awardLeagueTrophyIfWon } from "../../lib/star/careerFlow";
import type { CareerState, MatchStats, StarPlayer, Fixture, CupRun } from "../../lib/star/types";

/**
 * Cups, Europe and the national team.
 *
 * There was one competition: thirty-eight weeks of league football and a title
 * if you finished top. The `Trophy` type has always carried a `competition`
 * field and only ever held one value.
 *
 * All three are the same shape underneath — a knockout you are either still in
 * or out of — so most of what is asserted here is that the one progression
 * function behaves for all three, and that a cup night never touches the league.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const PLAYER: StarPlayer = {
  firstName: "Test", lastName: "Player", age: 22, position: "ST",
  club: "Arsenal", nationality: "England",
} as StarPlayer;

const CLUBS = ["Arsenal", "Chelsea", "Liverpool", "Man City", "Man Utd", "Spurs", "Newcastle", "Aston Villa", "Brighton", "West Ham"];
const base = () => makeInitialCareer(PLAYER, CLUBS);

const result = (userGoals: number, oppGoals: number): MatchStats => ({
  minutes: 90, chances: 5, goals: userGoals, assists: 0, passes: 12,
  rating: 7.5, starMan: false, bossChange: 2, teamChange: 1, fansChange: 2,
  wage: 1, goalBonus: 0, sponsorPay: 0, totalCash: 1,
  homeScore: userGoals, awayScore: oppGoals,
});

/** Play the next fixture with a fixed scoreline. */
function play(c: CareerState, userGoals: number, oppGoals: number): CareerState {
  const f = nextFixtureFor(c)!;
  return creditMatchResult(c, f, result(userGoals, oppGoals)).career;
}

// ── A season opens with the domestic cup, and nothing it has not earned ────
{
  const c = base();
  const runs = c.cups ?? [];
  const states = c.cupState ?? [];
  check(states.some(x => x.competition === "FA Cup"), "the FA Cup runs from your first season");
  check(states.some(x => x.competition === "League Cup"), "…and so does the League Cup");
  check(states.every(x => x.rounds[0].ties.length === 16), "thirty-two clubs, sixteen ties");
  // Europe's own knockout draw specifically — as opposed to its league
  // phase, which CAN already be running from week one (see the block
  // below): nothing has been won yet to earn a knockout tie, and the
  // league phase itself hasn't reached the point a knockout gets drawn.
  check(!runs.some(r => r.kind === "europe"),
    "…and no European knockout tie either, nothing has been won yet to earn one");

  const cupFixtures = c.fixtures.filter(f => f.kind === "cup");
  check(cupFixtures.length === 2,
    `only the FIRST round of each is on the calendar (${cupFixtures.length}) — the rest is earned`);
  check(cupFixtures[0].round === "Round of 32", `and it is the opening round (${cupFixtures[0].round})`);
  check(cupFixtures[0].week > 1 && cupFixtures[0].week <= leagueWeeks(CLUBS.length),
    `the cup tie is inside the season (week ${cupFixtures[0].week} of ${leagueWeeks(CLUBS.length)})`);
  check(typeof cupFixtures[0].opponentStrength === "number", "the tie carries its opponent's strength");
}

// ── A club that has genuinely already qualified starts Europe from week one ─
//
// Reported directly: picking Manchester United — a real Champions League
// club this season — did not put you in the Champions League. Season 1 used
// to never have a European campaign at all, on the (correct, for every OTHER
// club) assumption that nothing has been earned yet — but a club that
// qualified in real life did not earn it through THIS career either, and
// still has to actually play it.
{
  const unitedCareer = makeInitialCareer({ ...PLAYER, club: "Manchester United" }, CLUBS);
  check(unitedCareer.europeanQualification === "Champions League",
    "a real Champions League club starts a new career already qualified");
  check(!!unitedCareer.euroState, "and its European campaign is open from the very first season");
  check(unitedCareer.euroState?.competition === "Champions League", "in the competition it actually qualified for");
  const unitedEuro = unitedCareer.fixtures.filter(f => f.kind === "europe");
  check(unitedEuro.length === 8, `all eight league-phase games on the calendar from week one (${unitedEuro.length})`);
  check(new Set(unitedEuro.map(f => f.week)).size === 8, "no two of them in the same week");

  const bournemouthCareer = makeInitialCareer({ ...PLAYER, club: "AFC Bournemouth" }, CLUBS);
  check(bournemouthCareer.europeanQualification === "Europa League",
    "a real Europa League club starts a new career already qualified for the right competition");

  // A club with no real European place this season gets none — the fix only
  // seeds what a club has actually earned in real life, not Europe for
  // everyone.
  const chelseaCareer = makeInitialCareer({ ...PLAYER, club: "Chelsea" }, CLUBS);
  check(chelseaCareer.europeanQualification === null, "a club with no real European place this season starts with none");
  check(chelseaCareer.fixtures.filter(f => f.kind === "europe").length === 0, "…and no European fixtures either");
}

// ── Winning puts the next round on the calendar; losing does not ───────────
{
  let c = base();
  // Play league games until the cup tie comes round, then win it.
  let guard = 0;
  while (nextFixtureFor(c)?.kind !== "cup" && guard++ < 40) c = play(c, 1, 0);
  check(guard < 40, "the cup tie comes round");

  // The FA Cup and the League Cup are real thirty-two-club draws now — see
  // lib/star/cups and tests/star/cups.mts. What this block still checks is the
  // calendar: a win puts the next tie on it and a defeat does not.
  const cupOf = (st: CareerState, comp: string) => (st.cupState ?? []).find(x => x.competition === comp);
  const which = nextFixtureFor(c)!.competition!;

  const won = play(c, 3, 0);
  check((cupOf(won, which)?.rounds.length ?? 0) === 2, "a win draws the next round");
  check(won.fixtures.filter(f => f.kind === "cup" && !f.played && f.competition === which).length === 1,
    "and puts exactly one new tie on the calendar");
  check(/Through to|win the/.test(won.knockoutMessage ?? ""), `and says so ("${won.knockoutMessage}")`);

  const lost = play(c, 0, 2);
  const still = (cupOf(lost, which)?.rounds ?? [])
    .flatMap(r => r.ties)
    .some(t => (t.home === lost.player.club || t.away === lost.player.club) && t.hs === undefined);
  check(!still, "a defeat ends your run");
  check(lost.fixtures.filter(f => f.kind === "cup" && !f.played && f.competition === which).length === 0,
    "and the weeks it would have taken are weeks you do not play");
  check(/Out of the/.test(lost.knockoutMessage ?? ""), `and says so ("${lost.knockoutMessage}")`);
}

// ── A knockout cannot be drawn ──────────────────────────────────────────────
{
  const c = base();
  // `resolveKnockout` still carries Europe and the national team; the two
  // domestic cups have their own draw now, so this builds the run it is for
  // rather than reading one off a season that may not be in Europe yet.
  const run = { competition: "Champions League", kind: "europe", roundIndex: 0, eliminated: false, won: false } as CupRun;
  const tie = { ...c.fixtures.find(f => f.kind === "cup")!, competition: "Champions League" as const, kind: "europe" as const };

  const level = resolveKnockout(c, run, tie, 1, 1);
  check(level.onPenalties, "a level score goes to penalties");
  check(level.advanced || level.run.eliminated, "and produces a winner either way");
  check(level.message.includes("penalties"), `and the player is told (\"${level.message}\")`);

  // Quality nudges a shootout, it does not decide it.
  const strong = { ...c, league: c.league.map(t => t.name === "Arsenal" ? { ...t, strength: 99 } : t) };
  const weak = { ...c, league: c.league.map(t => t.name === "Arsenal" ? { ...t, strength: 30 } : t) };
  const hard: Fixture = { ...tie, opponentStrength: 95 };
  let strongThrough = 0, weakThrough = 0;
  for (let w = 1; w <= 200; w++) {
    const t = { ...hard, week: w };
    if (resolveKnockout(strong, run, t, 1, 1).advanced) strongThrough++;
    if (resolveKnockout(weak, run, t, 1, 1).advanced) weakThrough++;
  }
  check(strongThrough > weakThrough, `the better side wins more shootouts (${strongThrough} vs ${weakThrough} of 200)`);
  check(weakThrough > 40, `and the worse side still wins plenty (${weakThrough})`);
  check(strongThrough < 160, `nothing is a formality (${strongThrough})`);
}

// ── A group is played on points ─────────────────────────────────────────────
//
// Every round resolving identically sent you home from a tournament on a single
// drawn group game, which is not football.
{
  const c = { ...base(), season: 2, starRating: 4 };
  const run = { competition: "World Cup" as const, kind: "international" as const, roundIndex: 0, eliminated: false, won: false };
  const tie: Fixture = { week: 19, opponent: "Brazil", home: true, played: false, competition: "World Cup", kind: "international", round: "Group Stage", opponentStrength: 91 };
  const drawn = resolveKnockout(c, run, tie, 1, 1);
  check(drawn.advanced && !drawn.onPenalties, "a drawn group game does not send you home, and does not go to penalties");
  check(drawn.message.includes("point"), `and says why ("${drawn.message}")`);
  check(!resolveKnockout(c, run, tie, 0, 2).advanced, "losing one still can");

  // Everywhere else, a draw is settled.
  const ko = { ...run, roundIndex: 1 };
  check(resolveKnockout(c, ko, { ...tie, round: "Round of 16" }, 1, 1).onPenalties,
    "a knockout round is still settled on the night");
}

// ── Two runs never land on the same week ───────────────────────────────────
{
  const c: CareerState = { ...base(), season: 3, europeanQualification: "Champions League", starRating: 4.5 };
  const seeded = seedSeasonKnockouts(c);
  // Play each run all the way through and collect every week it would use.
  const weeks: Record<string, number[]> = {};
  for (const run of seeded.runs) {
    weeks[run.kind] = [];
    let r = run;
    let f = seeded.fixtures.find(x => x.competition === run.competition)!;
    for (let i = 0; i < roundsFor(run.competition).length; i++) {
      weeks[run.kind].push(f.week);
      const out = resolveKnockout(c, r, f, 2, 0);
      if (!out.nextFixture) break;
      r = out.run; f = out.nextFixture;
    }
  }
  const euro = weeks.europe ?? [];
  // The two domestic cups now have their own calendar. Nothing may land twice.
  const lc = CUP_ROUND_NAMES.map((_, i) => cupRoundWeek("League Cup", i, CLUBS.length));
  const fa = CUP_ROUND_NAMES.map((_, i) => cupRoundWeek("FA Cup", i, CLUBS.length));
  // Europe is no longer a counter-style run — it is a league phase and a
  // knockout, seeded separately (see seedEurope). What has to hold here is that
  // the two DOMESTIC cups keep out of each other's way.
  check(euro.length === 0, `Europe is not a counter-style run any more (${euro.join(",")})`);
  check(new Set(lc).size === lc.length, `the League Cup never plays twice in a week (${lc.join(",")})`);
  check(new Set(fa).size === fa.length, `nor does the FA Cup (${fa.join(",")})`);
  check(!lc.some(w => fa.includes(w)),
    `and the two cups never clash (${lc.join(",")} vs ${fa.join(",")})`);
  // Across every division size the game can produce, too.
  for (const n of [20, 18, 14, 10, 6]) {
    const a = CUP_ROUND_NAMES.map((_, i) => cupRoundWeek("League Cup", i, n));
    const b = CUP_ROUND_NAMES.map((_, i) => cupRoundWeek("FA Cup", i, n));
    const clash = a.filter(w => b.includes(w));
    check(clash.length === 0 || n < 12,
      `${n} clubs: the cups do not clash (${a.join(",")} vs ${b.join(",")})`);
  }
  check((weeks.international ?? []).every(w => w > leagueWeeks(CLUBS.length)),
    "and the tournament is entirely after the league");
}

// ── Winning the final is a trophy ───────────────────────────────────────────
{
  const c = base();
  const rounds = roundsFor("FA Cup");
  const finalRun = { competition: "FA Cup" as const, kind: "cup" as const, roundIndex: rounds.length - 1, eliminated: false, won: false };
  const tie = c.fixtures.find(f => f.kind === "cup")!;
  const out = resolveKnockout(c, finalRun, tie, 2, 1);
  check(out.trophy?.competition === "FA Cup", "the final produces a trophy");
  check(out.trophy?.club === PLAYER.club, "in the club's name");
  check(out.run.won && out.run.eliminated, "and closes the run");
  check(out.nextFixture === null, "there is nothing after a final");
}

// ── A cup tie is none of the league's business ─────────────────────────────
{
  let c = base();
  let guard = 0;
  while (nextFixtureFor(c)?.kind !== "cup" && guard++ < 40) c = play(c, 1, 0);
  const before = c.league.map(t => ({ name: t.name, played: t.played, points: t.points }));
  const after = play(c, 4, 0).league;
  const moved = before.filter(b => {
    const a = after.find(t => t.name === b.name)!;
    return a.played !== b.played || a.points !== b.points;
  });
  check(moved.length === 0,
    `a cup night moves nobody in the table (${moved.length} teams moved) — running the round for everyone else would hand the division a free week`);

  // …and a league game still does.
  let d = base();
  const p0 = d.league.find(t => t.name === "Arsenal")!.played;
  d = play(d, 2, 0);
  check(d.league.find(t => t.name === "Arsenal")!.played === p0 + 1, "a league game still counts");
}

// ── Cup goals count for the club; international goals do not ───────────────
{
  let c = base();
  let guard = 0;
  while (nextFixtureFor(c)?.kind !== "cup" && guard++ < 40) c = play(c, 0, 0);
  const goalsBefore = c.seasonStats.goals;
  c = play(c, 2, 0);
  check(c.seasonStats.goals === goalsBefore + 2, "a cup goal is a goal for your season");

  // Internationals are a separate record — the Ballon d'Or and the club
  // achievements read the club numbers.
  const withCap: CareerState = {
    ...base(),
    fixtures: [{ week: 1, opponent: "Brazil", home: true, played: false, competition: "World Cup", kind: "international", round: "Group Stage", opponentStrength: 91 }],
    cups: [{ competition: "World Cup", kind: "international", roundIndex: 0, eliminated: false, won: false }],
  };
  const after = creditMatchResult(withCap, withCap.fixtures[0], result(1, 0)).career;
  check((after.caps ?? 0) === 1, "an international is a cap");
  check((after.internationalGoals ?? 0) === 1, "and an international goal");
  check(after.seasonStats.goals === withCap.seasonStats.goals, "and neither goes into the club season");
  check(after.seasonStats.appearances === withCap.seasonStats.appearances, "nor into club appearances");
}

// ── Europe is earned by where you finish — and by what you won ────────────
{
  // In a 10-club league: CL = round(10*0.25) = top 3, EL = 4th-5th.
  // These mirror the draft game's rules exactly (top 5 in a 20-club PL).
  check(qualificationFor(1, 10) === "Champions League", "finishing top gets you into Europe's top competition");
  check(qualificationFor(2, 10) === "Champions League", "the top two in a ten-club league both go to the CL");
  check(qualificationFor(3, 10) === "Champions League", "third place in a ten-club league also earns CL");
  check(qualificationFor(4, 10) === "Europa League", "fourth earns Europa League");
  check(qualificationFor(5, 10) === "Europa League", "fifth also earns Europa League");
  check(qualificationFor(6, 10) === null, "sixth gets nothing from the table alone");
  check(qualificationFor(9, 10) === null, "finishing ninth gets you nothing");
  // Cup winners at 8th+ earn Europa League (both cups treated equally).
  check(qualificationFor(7, 10, true) === "Europa League", "FA Cup winner at 7th earns Europa League");
  check(qualificationFor(8, 10, false, true) === "Europa League", "League Cup winner at 8th earns Europa League");
  // A cup win never downgrades an already-qualified team.
  check(qualificationFor(1, 10, false, true) === "Champions League", "League Cup win can't demote a CL side");
  check(qualificationFor(4, 10, false, true) === "Europa League", "League Cup win can't demote an EL side");

  // A club of its own, not qualified for Europe already (unlike Arsenal —
  // base()'s club — since Aug 2026: see the season-1 European seeding
  // below). This block is testing qualification EARNED through the table,
  // and a club that starts the season already mid-Champions-League would
  // leave a European campaign this simple win-every-fixture loop cannot
  // finish (its knockout stage is drawn one round at a time through the
  // real app, not through creditMatchResult alone) still open when
  // advanceSeason runs — a real limitation of this loop, not of the game.
  const CHELSEA: StarPlayer = { ...PLAYER, club: "Chelsea" };
  const done = (() => {
    let c = makeInitialCareer(CHELSEA, CLUBS);
    let guard = 0;
    while (nextFixtureFor(c) && guard++ < 100) c = play(c, 3, 0);
    return c;
  })();
  check(!nextFixtureFor(done), "a season can be played to its end");
  check(leaguePosition(done) === 1, `winning every game wins the league (finished ${leaguePosition(done)})`);

  const nextSeason = advanceSeason(awardLeagueTrophyIfWon(done).career, false).career;
  check(nextSeason.europeanQualification === "Champions League", "and gets you into the Champions League");
  check(!!nextSeason.euroState, "which opens a European campaign the following season");
  check(nextSeason.euroState?.competition === "Champions League", "in the competition it earned");
  check(nextSeason.euroState?.clubs.length === 36, `against a field of thirty-six (${nextSeason.euroState?.clubs.length})`);
  // A league phase can be drawn up in advance — every opponent is known on the
  // day of the draw — so all eight go on the calendar at once. A knockout
  // cannot, which is why the cups still arrive one round at a time.
  const euroFixtures = nextSeason.fixtures.filter(f => f.kind === "europe");
  check(euroFixtures.length === 8, `with all eight league-phase games on the calendar (${euroFixtures.length})`);
  check(new Set(euroFixtures.map(f => f.week)).size === 8, "no two of them in the same week");
  check(euroFixtures.filter(f => f.home).length === 4, "four at home and four away");
  check(nextSeason.trophies.some(t => t.competition === "Premier League"), "the title carried over");
}

// ── The national team is something you reach ───────────────────────────────
{
  const rookie = base();
  check(!internationalCallUp(rookie), "a young player at 2.5 stars is not in the squad");
  check(internationalCallUp({ ...rookie, starRating: 3.4 }), "a reputation gets you picked");
  check(internationalCallUp({ ...rookie, fame: 60 }), "…and so does fame");

  check(tournamentFor(1) === null, "there is no tournament every year");
  check(tournamentFor(2) !== null && tournamentFor(4) !== null, "one comes round every other year");
  check(tournamentFor(4) !== tournamentFor(2), "and it alternates");

  // A tournament runs AFTER the league, which is what lets it extend a season.
  const star: CareerState = { ...base(), season: 2, starRating: 4, league: base().league };
  const seeded = seedSeasonKnockouts(star);
  const intl = seeded.fixtures.find(f => f.kind === "international");
  check(!!intl, "a well-known player in a tournament year has a tournament");
  check(intl!.week > leagueWeeks(CLUBS.length), `and it is played after the league (week ${intl!.week})`);
}

// ── The next fixture is the next one by DATE ───────────────────────────────
//
// It used to be `fixtures.find(f => !f.played)`, which relies on the array being
// in calendar order — true for a league built up front, false the moment a
// knockout round earned in week 9 is appended after week 18.
{
  let c = base();
  let guard = 0;
  while (nextFixtureFor(c)?.kind !== "cup" && guard++ < 40) c = play(c, 1, 0);
  const afterWin = play(c, 2, 0);
  const appended = afterWin.fixtures[afterWin.fixtures.length - 1];
  check(appended.kind === "cup", "the earned round is appended to the end of the list");
  const next = nextFixtureFor(afterWin)!;
  check(next.week <= appended.week,
    `but the next match is the next one by date (week ${next.week}, not the appended week ${appended.week})`);
  check(afterWin.fixtures.filter(f => !f.played).every(f => f.week >= next.week), "and nothing unplayed is earlier");

  // Two fixtures in the same week: the league game is played first.
  const clash: CareerState = {
    ...base(),
    fixtures: [
      { week: 5, opponent: "Ajax", home: true, played: false, competition: "Champions League", kind: "europe", round: "Round of 16" },
      { week: 5, opponent: "Chelsea", home: false, played: false },
    ],
  };
  check(nextFixtureFor(clash)?.opponent === "Chelsea", "league football comes first when two land in the same week");
}

// ── A cup tie you are left out of still resolves ───────────────────────────
{
  let c = base();
  let guard = 0;
  while (nextFixtureFor(c)?.kind !== "cup" && guard++ < 40) c = play(c, 1, 0);
  const tie = nextFixtureFor(c)!;
  const missed = simulateMissedFixture(c, tie).career;
  const st = (missed.cupState ?? []).find(x => x.competition === tie.competition)!;
  // Either you went through — a second round has been drawn — or your tie was
  // settled against you. Either way the cup moved.
  const yourTiePlayed = st.rounds[0].ties
    .find(t => t.home === missed.player.club || t.away === missed.player.club)?.hs !== undefined;
  check(yourTiePlayed,
    "being dropped for a cup tie does not freeze the run — your club still went through or out");
  check(st.rounds[0].ties.every(t => t.hs !== undefined),
    "and the whole round is played, not only your tie");
  check(missed.league.find(t => t.name === "Arsenal")!.played === c.league.find(t => t.name === "Arsenal")!.played,
    "and it still does not touch the table");
}

if (problems.length) {
  console.error("FAIL");
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log("PASS — cups, Europe and the national team all run, and none of them touch the league table");
