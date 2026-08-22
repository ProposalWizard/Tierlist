import {
  MATCHWEEKS, CHAMPIONSHIP_MATCHWEEKS, CHAMPIONSHIP_POST_SEASON,
  CHAMPIONSHIP_LEAGUE_CUP_SLOTS, CHAMPIONSHIP_FA_CUP_SLOTS, PLAY_OFF_SLOTS,
  LEAGUE_CUP_SLOTS, FA_CUP_SLOTS, POST_SEASON,
  fixtureDate, dayFor, formatDate, matchweeksFor, isPostSeason,
  transferWindowFor,
} from "../../lib/star/calendar";
import { buildSeasonFixtures } from "../../lib/star/season";
import { CHAMPIONSHIP_CLUBS, PREMIER_LEAGUE_CLUBS } from "../../lib/star/clubs";

/**
 * THE CHAMPIONSHIP FITS IN A SEASON.
 *
 * Forty-six rounds and twenty-four clubs, across the same August-to-May
 * stretch the Premier League's thirty-eight use. That only works because
 * eight rounds are played midweek, and this file exists to prove the eight
 * actually land where they are supposed to — clear of both cups, in order,
 * and inside the season.
 *
 * The last block is the one that matters most: the Premier League's own
 * calendar has to come out of all this completely unchanged.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const START_YEAR = 2027;
const SEASON = 1;

const champDate = (week: number, kind?: string) =>
  fixtureDate(START_YEAR, SEASON, week, dayFor(kind, week, "championship"), "championship");

// ── Forty-six rounds, eight of them midweek ─────────────────────────────────
{
  check(matchweeksFor("championship") === 46, `a Championship season is 46 games (${matchweeksFor("championship")})`);
  check(matchweeksFor("premier") === 38, `a Premier League season is still 38 (${matchweeksFor("premier")})`);

  const days = Array.from({ length: CHAMPIONSHIP_MATCHWEEKS }, (_, i) => dayFor("league", i + 1, "championship"));
  const midweek = days.filter(d => d !== "saturday");
  check(midweek.length === 8, `eight rounds are midweek (${midweek.length})`);
  check(midweek.every(d => d === "tuesday"),
    `and every one of them is a Tuesday (${Array.from(new Set(midweek)).join(", ")})`);

  // 24 clubs really do produce 46 rounds through the existing generator.
  const fixtures = buildSeasonFixtures([...CHAMPIONSHIP_CLUBS]);
  const weeks = new Set(fixtures.map(f => f.week));
  check(CHAMPIONSHIP_CLUBS.length === 24, `there are 24 Championship clubs (${CHAMPIONSHIP_CLUBS.length})`);
  check(weeks.size === 46, `and they generate 46 rounds of fixtures (${weeks.size})`);
  check(fixtures.length === 46 * 12, `each round is twelve matches (${fixtures.length} total)`);
}

// ── The season runs in order, and stays inside August-to-May ────────────────
{
  let last = -Infinity;
  let outOfOrder = 0;
  for (let week = 1; week <= CHAMPIONSHIP_MATCHWEEKS; week++) {
    const t = champDate(week, "league").getTime();
    if (t <= last) outOfOrder++;
    last = t;
  }
  check(outOfOrder === 0, `every round falls strictly after the one before it (${outOfOrder} did not)`);

  const first = champDate(1, "league");
  const final = champDate(CHAMPIONSHIP_MATCHWEEKS, "league");
  check(first.getUTCMonth() === 7, `the season opens in August (${formatDate(first)})`);
  check(final.getUTCMonth() === 4, `and the league ends in May (${formatDate(final)})`);

  // The same stretch of real time the Premier League uses — not a longer one.
  const plFinal = fixtureDate(START_YEAR, SEASON, MATCHWEEKS, "saturday");
  check(final.getTime() === plFinal.getTime(),
    `the last round shares its weekend with the Premier League's (${formatDate(final)} vs ${formatDate(plFinal)})`);
}

// ── A midweek league round can never collide with a cup tie ─────────────────
{
  const leagueDates = new Map<number, number>();
  for (let week = 1; week <= CHAMPIONSHIP_MATCHWEEKS; week++) {
    leagueDates.set(champDate(week, "league").getTime(), week);
  }
  let clashes = 0;
  const cupTies = [...CHAMPIONSHIP_LEAGUE_CUP_SLOTS, ...CHAMPIONSHIP_FA_CUP_SLOTS, ...PLAY_OFF_SLOTS];
  for (const slot of cupTies) {
    const at = champDate(slot.week, "cup").getTime();
    if (leagueDates.has(at)) {
      clashes++;
      problems.push(`  ${slot.round} (week ${slot.week}) lands on league round ${leagueDates.get(at)}`);
    }
  }
  check(clashes === 0, `no cup tie is played on the same day as a league round (${clashes} clash)`);

  // …and the guarantee behind it: cups are Wednesday, midweek league is Tuesday.
  const cupDays = new Set(cupTies
    .filter(s => !isPostSeason(s.week, "championship"))
    .map(s => dayFor("cup", s.week, "championship")));
  check(cupDays.size === 1 && cupDays.has("wednesday"),
    `every in-season cup tie is a Wednesday (${Array.from(cupDays).join(", ")})`);
}

// ── The cups land on the weekends they are meant to mirror ──────────────────
{
  // Each Championship cup slot should share its date with the Premier League
  // slot it corresponds to — same competition, same real weekend.
  const pairs: [string, typeof LEAGUE_CUP_SLOTS, typeof CHAMPIONSHIP_LEAGUE_CUP_SLOTS][] = [
    ["League Cup", LEAGUE_CUP_SLOTS, CHAMPIONSHIP_LEAGUE_CUP_SLOTS],
    ["FA Cup", FA_CUP_SLOTS, CHAMPIONSHIP_FA_CUP_SLOTS],
  ];
  for (const [name, pl, champ] of pairs) {
    check(pl.length === champ.length, `${name}: same number of rounds in both divisions (${pl.length} vs ${champ.length})`);
    for (let i = 0; i < Math.min(pl.length, champ.length); i++) {
      // The finals are post-season in both and are allowed to differ.
      if (isPostSeason(pl[i].week)) continue;
      const a = fixtureDate(START_YEAR, SEASON, pl[i].week, dayFor("cup", pl[i].week));
      const b = champDate(champ[i].week, "cup");
      check(a.getTime() === b.getTime(),
        `${name} ${champ[i].round}${champ[i].leg ? ` leg ${champ[i].leg}` : ""}: same weekend in both divisions (${formatDate(a)} vs ${formatDate(b)})`);
    }
  }
}

// ── The play-offs come last, after the league and both cup finals ───────────
{
  const leagueEnd = champDate(CHAMPIONSHIP_MATCHWEEKS, "league").getTime();
  const lcFinal = champDate(CHAMPIONSHIP_LEAGUE_CUP_SLOTS[CHAMPIONSHIP_LEAGUE_CUP_SLOTS.length - 1].week, "cup").getTime();
  const faFinal = champDate(CHAMPIONSHIP_FA_CUP_SLOTS[CHAMPIONSHIP_FA_CUP_SLOTS.length - 1].week, "cup").getTime();

  check(PLAY_OFF_SLOTS.length === 3, `three play-off fixtures: two semi-final legs and a final (${PLAY_OFF_SLOTS.length})`);
  const [sf1, sf2, poFinal] = PLAY_OFF_SLOTS;
  check(sf1.leg === 1 && sf2.leg === 2, "the semi-final is two legs");
  check(poFinal.round === "Play-Off Final" && poFinal.leg === undefined, "the final is one match");

  const dates = PLAY_OFF_SLOTS.map(s => champDate(s.week, "cup").getTime());
  check(dates.every(d => d > leagueEnd), "every play-off tie is after the league finishes");
  check(dates.every(d => d > lcFinal && d > faFinal), "and after both cup finals");
  check(dates[0] < dates[1] && dates[1] < dates[2], "legs then final, in that order");
  check(PLAY_OFF_SLOTS.every(s => isPostSeason(s.week, "championship")),
    "and all three read as post-season");
}

// ── Transfer windows still work off real dates in the Championship ──────────
{
  const windows = Array.from({ length: CHAMPIONSHIP_MATCHWEEKS }, (_, i) =>
    transferWindowFor(START_YEAR, SEASON, i + 1, "championship"));
  check(windows[0] === "summer", `the season opens with the summer window open (${windows[0]})`);
  check(windows.includes("january"), "the January window is reachable inside a Championship season");
  check(windows.includes(null), "and the window does shut in between");
  // Whatever month a round falls in, its window has to agree with that month.
  let disagreed = 0;
  for (let week = 1; week <= CHAMPIONSHIP_MATCHWEEKS; week++) {
    const month = champDate(week, "league").getUTCMonth();
    const w = windows[week - 1];
    const expected = month === 0 ? "january" : (month === 7 || month === 8) ? "summer" : null;
    if (w !== expected) disagreed++;
  }
  check(disagreed === 0, `every round's window matches its own month (${disagreed} did not)`);
}

// ── The Premier League is untouched ─────────────────────────────────────────
{
  check(PREMIER_LEAGUE_CLUBS.length === 20, `there are still 20 Premier League clubs (${PREMIER_LEAGUE_CLUBS.length})`);
  check(buildSeasonFixtures([...PREMIER_LEAGUE_CLUBS]).length === 38 * 10,
    "and they still generate a 38-round season");

  // Every default-division call has to behave exactly as it did before the
  // Championship existed: Saturday league football, week number == weekend.
  let moved = 0, notSaturday = 0;
  for (let week = 1; week <= MATCHWEEKS; week++) {
    if (dayFor("league", week) !== "saturday") notSaturday++;
    const withDivision = fixtureDate(START_YEAR, SEASON, week, "saturday", "premier");
    const without = fixtureDate(START_YEAR, SEASON, week, "saturday");
    if (withDivision.getTime() !== without.getTime()) moved++;
  }
  check(notSaturday === 0, `every Premier League round is still a Saturday (${notSaturday} were not)`);
  check(moved === 0, `and passing the division explicitly changes nothing (${moved} moved)`);
  check(POST_SEASON(1) === 39 && CHAMPIONSHIP_POST_SEASON(1) === 47,
    `each division's post-season starts after its own last round (${POST_SEASON(1)} / ${CHAMPIONSHIP_POST_SEASON(1)})`);
  check(!isPostSeason(38) && isPostSeason(39),
    "the Premier League's post-season still begins at week 39");
  check(!isPostSeason(46, "championship") && isPostSeason(47, "championship"),
    "and the Championship's at week 47");
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exit(1);
}
console.log("PASS — forty-six rounds fit the season, clear of the cups, play-offs last");
