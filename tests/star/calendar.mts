import {
  MATCHWEEKS, PRE_SEASON_WEEK, LEAGUE_CUP_SLOTS, FA_CUP_SLOTS,
  EURO_LEAGUE_PHASE_WEEKS, EURO_KO_SLOTS_WITH_R32, EURO_KO_SLOTS_SEEDED,
  TOURNAMENT_WEEKS, openingSaturday, seasonStartYear, fixtureDate, formatDate,
  dayFor, isPostSeason, calendarMonthOf, POST_SEASON,
} from "../../lib/star/calendar";
import { cupRoundWeek, cupSecondLegWeek } from "../../lib/star/competitions";
import { CUP_ROUND_NAMES } from "../../lib/star/cups";
import { knockoutSlots, firstRound, nextRound } from "../../lib/star/euro";

/**
 * THE CALENDAR.
 *
 * Two things have to be true and neither is obvious from reading the numbers.
 *
 * You cannot play twice on the same day. The fixture list interleaves four
 * competitions and the old scheduler put a European tie and a domestic cup round
 * on the same week twice a season — which was invisible because a "week" had no
 * day in it. Now that it does, "same week" is only a clash if it is also the
 * same day, and that is what gets checked.
 *
 * And the league runs Saturday to Saturday from mid-August to May. If week 38
 * lands in July the season is wrong however tidy the arithmetic looks.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const START_YEAR = 2027;   // a career begun in FC 27 → the 2026/27 season

// ── It opens on a Saturday in the middle of August ──────────────────────────
{
  for (const year of [2026, 2027, 2028, 2029, 2030, 2031]) {
    const d = openingSaturday(year);
    check(d.getUTCDay() === 6, `${year} opens on a Saturday (${formatDate(d)})`);
    check(d.getUTCMonth() === 7, `${year} opens in August (${formatDate(d)})`);
    check(d.getUTCDate() >= 15 && d.getUTCDate() <= 21,
      `${year} opens in the right week of it (${formatDate(d)})`);
  }
  // 15 August 2026 IS a Saturday, so the first season opens on the date itself.
  check(formatDate(openingSaturday(2026)) === "Sat 15 Aug", `2026 opens on the 15th (${formatDate(openingSaturday(2026))})`);

  check(seasonStartYear(START_YEAR, 1) === 2026, "a career begun in FC 27 plays 2026/27 first");
  check(seasonStartYear(START_YEAR, 5) === 2030, "and 2030/31 in its fifth season");
}

// ── Thirty-eight Saturdays, August to May ───────────────────────────────────
{
  const first = fixtureDate(START_YEAR, 1, 1, "saturday");
  const last = fixtureDate(START_YEAR, 1, MATCHWEEKS, "saturday");
  check(first.getUTCMonth() === 7, `week 1 is in August (${formatDate(first)})`);
  check(last.getUTCMonth() === 4, `week 38 is in May (${formatDate(last)})`);
  check(last.getUTCFullYear() === 2027, `and in the second half of the season (${last.getUTCFullYear()})`);

  let saturdays = 0;
  for (let w = 1; w <= MATCHWEEKS; w++) {
    if (fixtureDate(START_YEAR, 1, w, "saturday").getUTCDay() === 6) saturdays++;
  }
  check(saturdays === MATCHWEEKS, `every league week is a Saturday (${saturdays}/${MATCHWEEKS})`);

  // The midweek that FOLLOWS the Saturday, which is where English football
  // puts a cup tie — the tie belongs to the week it interrupts.
  const tue = fixtureDate(START_YEAR, 1, 5, "tuesday");
  const wed = fixtureDate(START_YEAR, 1, 5, "wednesday");
  const sat = fixtureDate(START_YEAR, 1, 5, "saturday");
  check(tue.getUTCDay() === 2 && wed.getUTCDay() === 3, "Tuesday is a Tuesday and Wednesday a Wednesday");
  check(tue.getTime() > sat.getTime() && wed.getTime() > tue.getTime(), "and both come after the Saturday");
  check(wed.getTime() < fixtureDate(START_YEAR, 1, 6, "saturday").getTime(),
    "…and before the next one");
}

// ── Nobody plays twice on one day ───────────────────────────────────────────
{
  // Every fixture a maximal season can contain: both domestic cups, a European
  // campaign that goes the whole way from ninth in the league phase, and the
  // league itself.
  type Slot = { label: string; week: number; day: string };
  const slots: Slot[] = [];
  for (let w = 1; w <= MATCHWEEKS; w++) slots.push({ label: "League", week: w, day: "saturday" });
  for (const s of LEAGUE_CUP_SLOTS) {
    slots.push({ label: `League Cup ${s.round}`, week: s.week, day: dayFor("cup", s.week) });
  }
  for (const s of FA_CUP_SLOTS) {
    slots.push({ label: `FA Cup ${s.round}`, week: s.week, day: dayFor("cup", s.week) });
  }
  EURO_LEAGUE_PHASE_WEEKS.forEach((w, i) => {
    slots.push({ label: `Europe MD${i + 1}`, week: w, day: dayFor("europe", w) });
  });
  for (const s of EURO_KO_SLOTS_WITH_R32) {
    slots.push({ label: `Europe ${s.round}`, week: s.week, day: dayFor("europe", s.week) });
  }

  const seen = new Map<string, string>();
  const clashes: string[] = [];
  for (const s of slots) {
    const key = `${s.week}|${s.day}`;
    const already = seen.get(key);
    if (already) clashes.push(`${already} and ${s.label} both on week ${s.week} ${s.day}`);
    else seen.set(key, s.label);
  }
  check(clashes.length === 0, `no two fixtures share a day (${clashes.slice(0, 3).join("; ")})`);

  // Three in a week is the ceiling, and it is a real one: Saturday, Tuesday,
  // Wednesday is what a side in Europe and both cups actually plays in the
  // heaviest weeks of a season. Four would mean two on one of those days.
  const perWeek = new Map<number, number>();
  for (const s of slots) perWeek.set(s.week, (perWeek.get(s.week) ?? 0) + 1);
  const heavy = Array.from(perWeek.entries()).filter(([, n]) => n > 3);
  check(heavy.length === 0, `no week has four matches in it (${heavy.map(([w, n]) => `w${w}:${n}`).join(",")})`);
  const threes = Array.from(perWeek.entries()).filter(([, n]) => n === 3).map(([w]) => w).sort((a, b) => a - b);
  check(threes.join(",") === "5,22,25,28",
    `the three-match weeks are the ones the Draft has (${threes.join(",")})`);
}

// ── The slots match the ones the Draft uses ─────────────────────────────────
//
// Copied deliberately rather than derived, so if either game mode moves a round
// this fails and somebody has to decide whether both should move.
{
  check(cupRoundWeek("League Cup", 0) === 3, `League Cup R32 is week 3 (${cupRoundWeek("League Cup", 0)})`);
  check(cupRoundWeek("League Cup", 1) === 8, "League Cup R16 is week 8");
  check(cupRoundWeek("League Cup", 2) === 16, "League Cup QF is week 16");
  check(cupRoundWeek("League Cup", 3) === 25, "League Cup SF first leg is week 25");
  check(cupSecondLegWeek("League Cup", 3) === 28, "…and the second is week 28");
  check(cupSecondLegWeek("FA Cup", 3) === null, "the FA Cup semi-final has only one leg");

  check(cupRoundWeek("FA Cup", 0) === 5, "FA Cup R32 is week 5");
  check(cupRoundWeek("FA Cup", 1) === 12, "FA Cup R16 is week 12");
  check(cupRoundWeek("FA Cup", 2) === 22, "FA Cup QF is week 22");
  check(cupRoundWeek("FA Cup", 3) === 30, "FA Cup SF is week 30");

  // Both finals are played after the league has finished.
  check(isPostSeason(cupRoundWeek("League Cup", 4)), "the League Cup final is after the season");
  check(isPostSeason(cupRoundWeek("FA Cup", 4)), "and so is the FA Cup final");
  check(cupRoundWeek("League Cup", 4) < cupRoundWeek("FA Cup", 4),
    "with the FA Cup last, which is how the season ends");

  check(EURO_LEAGUE_PHASE_WEEKS.join(",") === "5,7,9,11,13,15,22,23",
    `Europe's eight matchdays (${EURO_LEAGUE_PHASE_WEEKS.join(",")})`);
  check(TOURNAMENT_WEEKS.every(w => isPostSeason(w)),
    "and a World Cup is played when the clubs have finished");
}

// ── The European knockout depends on where you finished ─────────────────────
{
  check(firstRound(3) === "Round of 16", "the top eight are seeded into the last sixteen");
  check(firstRound(9) === "Round of 32", "ninth has a play-off round first");
  check(firstRound(24) === "Round of 32", "and so does twenty-fourth");
  check(firstRound(25) === null, "twenty-fifth is out with nothing");

  const seeded = knockoutSlots(4);
  const viaR32 = knockoutSlots(12);
  check(seeded.length === EURO_KO_SLOTS_SEEDED.length, "a seeded run is two matches shorter");
  check(viaR32.length === seeded.length + 2, "because the play-off is two legs");
  check(!seeded.some(s => s.round === "Round of 32"), "and has no play-off in it");

  // Every round leads to the next, and the final leads nowhere.
  check(nextRound(4, "Round of 16") === "Quarter-Final", "R16 leads to the quarter-final");
  check(nextRound(12, "Round of 32") === "Round of 16", "the play-off leads to the last sixteen");
  check(nextRound(4, "Final") === null, "and the final leads nowhere");

  // Two legs on everything except the final, which is one match on neutral turf.
  const legs = viaR32.filter(s => s.round !== "Final");
  check(legs.every(s => s.leg === 1 || s.leg === 2), "every knockout tie is two-legged");
  check(viaR32.filter(s => s.round === "Final").every(s => s.leg === undefined),
    "except the final");
  // Both legs of a tie in consecutive weeks, never the same one.
  for (const round of ["Round of 32", "Round of 16", "Quarter-Final", "Semi-Final"]) {
    const pair = viaR32.filter(s => s.round === round).map(s => s.week);
    check(pair.length === 2 && pair[1] === pair[0] + 1,
      `${round} legs are a week apart (${pair.join(",")})`);
  }
}

// ── Months are months, not blocks of four weeks ─────────────────────────────
{
  // The bug this replaced: week 24 was "January" because 24 / 4 is 6.
  const monthOfWeek = (w: number) => calendarMonthOf(START_YEAR, 1, w);
  check(monthOfWeek(1) === 7, "week 1 is August");
  check(monthOfWeek(MATCHWEEKS) === 4, "week 38 is May");

  // Every month from August to May has football in it, and none is empty.
  const months = new Set<number>();
  for (let w = 1; w <= MATCHWEEKS; w++) months.add(monthOfWeek(w));
  check(months.size === 10, `ten months of football (${months.size})`);
  for (const m of [7, 8, 9, 10, 11, 0, 1, 2, 3, 4]) {
    check(months.has(m), `month ${m} has football in it`);
  }

  // August is short because the season starts in the middle of it — which is
  // the whole reason blocks of four were wrong.
  const august = Array.from({ length: MATCHWEEKS }, (_, i) => i + 1).filter(w => monthOfWeek(w) === 7);
  check(august.length < 4, `August is a short month (${august.length} weeks)`);
}

// ── Pre-season and post-season sit either side of it ────────────────────────
{
  check(PRE_SEASON_WEEK === 0, "the one-off matches are week 0");
  const shield = fixtureDate(START_YEAR, 1, PRE_SEASON_WEEK, "saturday");
  check(shield.getTime() < fixtureDate(START_YEAR, 1, 1, "saturday").getTime(),
    `the Community Shield is before the league starts (${formatDate(shield)})`);
  check(dayFor("cup", POST_SEASON(1)) === "saturday",
    "a final played after the season is a Saturday occasion");
  check(dayFor("cup", 12) === "wednesday", "a domestic cup round in season is a Wednesday");
  check(dayFor("europe", 12) === "tuesday", "and a European night is a Tuesday");
  check(dayFor("league", 12) === "saturday", "league football is Saturday");
}

if (problems.length) {
  console.error("FAIL");
  for (const p of problems.slice(0, 15)) console.error("  ✗ " + p);
  if (problems.length > 15) console.error(`  …and ${problems.length - 15} more`);
  process.exit(1);
}
console.log("PASS — thirty-eight Saturdays from August to May, and nobody plays twice in a day");
