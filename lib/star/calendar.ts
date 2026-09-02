/**
 * THE SEASON CALENDAR.
 *
 * One place that knows two things: which matchweek every fixture in a season
 * belongs to, and what date that is.
 *
 * ── Why the slots are hard-coded ──
 *
 * They used to be fractions of the season — a cup round at 30%, the next at 50%
 * — which was written to survive a division of any size. It survived it by
 * producing a calendar nobody recognises: a League Cup final in February on one
 * save and in March on another, and two competitions landing on the same week
 * whenever the rounding went against them.
 *
 * These are the slots the PL Draft has used all along (see
 * components/draft/DraftResult.tsx, `buildSchedule`). Copying them exactly means
 * the two game modes describe the same season, which is the point — a player who
 * knows the FA Cup quarter-final is week 22 in one should not have to relearn it
 * in the other.
 *
 * ── Why dates and not just weeks ──
 *
 * "Week 25" is a number in a fixture list. "Sat 14 Feb" is a season. The English
 * game runs on a rhythm — league on Saturday, cups and Europe in midweek — and
 * once the calendar knows real dates it can be shown that way, sorted that way,
 * and talked about that way in the media feed.
 *
 * Nothing here decides WHO you play. That is the draw, and it lives in cups.ts
 * and euro.ts. This only decides when.
 */

// ── The slots ───────────────────────────────────────────────────────────────

/** A season is thirty-eight league weeks. */
export const MATCHWEEKS = 38;

/**
 * Fixtures that happen before a ball is kicked in the league.
 *
 * Both are one-off matches earned by LAST season, which is why a first season
 * can never have either.
 */
export const PRE_SEASON_WEEK = 0;

/**
 * The two domestic cups.
 *
 * The League Cup semi-final is two-legged and the FA Cup's is not, which is both
 * how they actually work and why the League Cup needs six slots for five rounds.
 * Both finals are played after the league finishes.
 */
export const LEAGUE_CUP_SLOTS: CupSlot[] = [
  { round: "Round of 32", week: 3 },
  { round: "Round of 16", week: 8 },
  { round: "Quarter-Final", week: 16 },
  { round: "Semi-Final", week: 25, leg: 1 },
  { round: "Semi-Final", week: 28, leg: 2 },
  { round: "Final", week: POST_SEASON(1) },
];

export const FA_CUP_SLOTS: CupSlot[] = [
  { round: "Round of 32", week: 5 },
  { round: "Round of 16", week: 12 },
  { round: "Quarter-Final", week: 22 },
  { round: "Semi-Final", week: 30 },
  { round: "Final", week: POST_SEASON(2) },
];

/**
 * Europe: eight league-phase matchdays, then the knockout.
 *
 * The knockout slots come in two shapes because the draw does. Finish in the
 * top eight of the league phase and you are seeded straight into the round of
 * sixteen; finish ninth to twenty-fourth and you play a two-legged round of
 * thirty-two first. Twenty-fifth and below is out, with no knockout at all.
 */
export const EURO_LEAGUE_PHASE_WEEKS = [5, 7, 9, 11, 13, 15, 22, 23];

/** Ninth to twenty-fourth: the extra round, and everything a week later. */
export const EURO_KO_SLOTS_WITH_R32: CupSlot[] = [
  { round: "Round of 32", week: 25, leg: 1 },
  { round: "Round of 32", week: 26, leg: 2 },
  { round: "Round of 16", week: 28, leg: 1 },
  { round: "Round of 16", week: 29, leg: 2 },
  { round: "Quarter-Final", week: 31, leg: 1 },
  { round: "Quarter-Final", week: 32, leg: 2 },
  { round: "Semi-Final", week: 34, leg: 1 },
  { round: "Semi-Final", week: 35, leg: 2 },
  { round: "Final", week: 38 },
];

/** Top eight: straight into the last sixteen. */
export const EURO_KO_SLOTS_SEEDED: CupSlot[] = EURO_KO_SLOTS_WITH_R32.filter(
  s => s.round !== "Round of 32",
);

/**
 * The summer tournament, which is the one thing that genuinely runs after
 * everything else — a World Cup is played when the clubs have finished.
 */
export const TOURNAMENT_WEEKS = [
  POST_SEASON(3), POST_SEASON(4), POST_SEASON(5), POST_SEASON(6), POST_SEASON(7),
];

/**
 * A week number past the end of the league.
 *
 * Kept as a number rather than a separate flag so a fixture list is still just
 * a list sorted by week — `nextFixtureFor` and every screen that orders fixtures
 * carry on working with no idea that week 39 is not a league week.
 */
export function POST_SEASON(n: number): number {
  return MATCHWEEKS + n;
}

export interface CupSlot {
  round: string;
  week: number;
  /** 1 or 2 on a two-legged tie; absent on a single match. */
  leg?: 1 | 2;
}

/**
 * Which division a career is playing in.
 *
 * Only the two the game actually runs a season for. The Lineups picker's own
 * `Division` (lib/star/clubs.ts) is a different and wider thing — it also
 * names the promotion pool and the two European competitions, none of which
 * a career ever plays a league season IN.
 */
export type CareerDivision = "premier" | "championship";

/**
 * Which division a career is in, for anything that has to ask.
 *
 * The ONE place `CareerState.division` is read, so "a save from before the
 * Championship existed is a Premier League save" is stated once instead of
 * being re-derived — and correctly — at every call site. Takes the field
 * structurally rather than the whole CareerState so this file goes on
 * importing nothing.
 */
export function divisionOf(career: { division?: CareerDivision }): CareerDivision {
  return career.division ?? "premier";
}

/** What the division is called, on a screen or on a trophy. */
export function leagueNameFor(division: CareerDivision): string {
  return division === "championship" ? "Championship" : "Premier League";
}

/** A Championship season is forty-six games, because it is twenty-four clubs. */
export const CHAMPIONSHIP_MATCHWEEKS = 46;

export function matchweeksFor(division: CareerDivision): number {
  return division === "championship" ? CHAMPIONSHIP_MATCHWEEKS : MATCHWEEKS;
}

/** Is this a week after the league has finished? */
export function isPostSeason(week: number, division: CareerDivision = "premier"): boolean {
  return week > matchweeksFor(division);
}

// ── Dates ───────────────────────────────────────────────────────────────────

/**
 * The season opens on the first Saturday on or after the 15th of August.
 *
 * For 2026 that is the 15th itself, which is what the real fixture list does.
 * Anchoring to a date rather than to "the third Saturday" keeps it in the right
 * fortnight every year without ever landing midweek.
 */
export const OPENING_DAY = { month: 7, day: 15 } as const;   // month is 0-based

const DAY_MS = 86_400_000;

export function openingSaturday(year: number): Date {
  const d = new Date(Date.UTC(year, OPENING_DAY.month, OPENING_DAY.day));
  // 6 is Saturday. Adding this many days lands on the next one, or stays put.
  return new Date(d.getTime() + ((6 - d.getUTCDay() + 7) % 7) * DAY_MS);
}

/**
 * Which calendar year a season kicks off in.
 *
 * `startYear` is the FIFA edition the career began in — 2027 means the 2026/27
 * season, which starts in August 2026. Each season after that is a year on.
 */
export function seasonStartYear(startYear: number, season: number): number {
  return startYear - 1 + Math.max(0, season - 1);
}

/** Which day of the week a fixture is played on. */
export type MatchDay = "saturday" | "tuesday" | "wednesday";

// ── The Championship's own shape ────────────────────────────────────────────

/**
 * FORTY-SIX ROUNDS INTO THIRTY-EIGHT WEEKENDS.
 *
 * A Championship season is eight games longer than a Premier League one and
 * runs across the same August-to-May stretch, so eight of its rounds have to
 * be played in midweek. That is exactly what the real division does.
 *
 * The eight are on TUESDAY, always, and that is a guarantee rather than a
 * preference: both domestic cups are drawn on Wednesday (see `dayFor`), and
 * a Championship club plays no European football at all — which is what
 * frees Tuesday up in the first place. So a midweek league round can never
 * collide with a cup tie, by construction, without anybody having to check
 * the two lists against each other.
 *
 * The weeks below were chosen to spread the extra games across the season
 * and to sit clear of the cup weekends either side of them.
 */
const CHAMPIONSHIP_MIDWEEK_WEEKS = [2, 7, 10, 14, 19, 24, 27, 33];

interface RoundSlot {
  /** 1-38, the weekend this round belongs to. */
  calendarWeek: number;
  day: MatchDay;
}

/**
 * Round number (1-46) to the day it is actually played on.
 *
 * Saturday first in each calendar week, then that week's midweek round if it
 * has one — which is also the order they fall in on the clock, since
 * `fixtureDate` offsets Tuesday three days past its Saturday.
 */
const CHAMPIONSHIP_ROUNDS: RoundSlot[] = (() => {
  const midweek = new Set(CHAMPIONSHIP_MIDWEEK_WEEKS);
  const out: RoundSlot[] = [];
  for (let w = 1; w <= MATCHWEEKS; w++) {
    out.push({ calendarWeek: w, day: "saturday" });
    if (midweek.has(w)) out.push({ calendarWeek: w, day: "tuesday" });
  }
  return out;
})();

/** Which weekend a Championship week falls on. Post-season weeks carry on
 *  past the end of the league, one weekend each, the same as the Premier
 *  League's do. */
function championshipCalendarWeek(week: number): number {
  const slot = CHAMPIONSHIP_ROUNDS[week - 1];
  if (slot) return slot.calendarWeek;
  return MATCHWEEKS + (week - CHAMPIONSHIP_MATCHWEEKS);
}

/** A week number past the end of the Championship season. */
export function CHAMPIONSHIP_POST_SEASON(n: number): number {
  return CHAMPIONSHIP_MATCHWEEKS + n;
}

export function postSeasonFor(division: CareerDivision, n: number): number {
  return division === "championship" ? CHAMPIONSHIP_POST_SEASON(n) : POST_SEASON(n);
}

/**
 * When a fixture is actually played.
 *
 * League football on Saturday. Everything else in the midweek that FOLLOWS that
 * Saturday, which is where English football puts it — the cup tie belongs to the
 * week it interrupts, not to the one before.
 *
 * Europe takes Tuesday and the domestic cups take Wednesday, and that split is
 * doing real work rather than being decorative: week 5 has a European matchday
 * and an FA Cup round, week 25 has a European leg and a League Cup semi-final
 * leg. Put them on the same day and the fixture list has you playing twice in an
 * evening.
 */
export function fixtureDate(
  startYear: number, season: number, week: number, day: MatchDay,
  division: CareerDivision = "premier",
): Date {
  const opening = openingSaturday(seasonStartYear(startYear, season));
  // A Premier League week IS its weekend. A Championship week is a round,
  // and eight of the forty-six share a weekend with the round before them —
  // see CHAMPIONSHIP_ROUNDS.
  const calendarWeek = division === "championship" ? championshipCalendarWeek(week) : week;
  const saturday = opening.getTime() + (calendarWeek - 1) * 7 * DAY_MS;
  // Pre-season sits in the week BEFORE the opening Saturday, which is what
  // week 0 means: the Community Shield is played the weekend before it starts.
  const offset = day === "saturday" ? 0 : day === "tuesday" ? 3 : 4;
  return new Date(saturday + offset * DAY_MS);
}

/**
 * Which day a competition plays on. See fixtureDate.
 *
 * Everything left over after the league has finished goes back to Saturday —
 * the cup finals and the summer tournament are occasions, and there is no
 * league fixture left for them to be squeezed around.
 */
export function dayFor(
  kind: string | undefined, week: number, division: CareerDivision = "premier",
): MatchDay {
  const league = !kind || kind === "league";
  // Eight Championship rounds are played on a Tuesday — see
  // CHAMPIONSHIP_ROUNDS. Everything else about the week is unchanged.
  if (league && division === "championship" && week >= 1 && week <= CHAMPIONSHIP_MATCHWEEKS) {
    return CHAMPIONSHIP_ROUNDS[week - 1].day;
  }
  if (league) return "saturday";
  if (isPostSeason(week, division)) return "saturday";
  if (kind === "europe") return "tuesday";
  return "wednesday";
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Sat 15 Aug". What goes on a fixture row. */
export function formatDate(d: Date): string {
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** "Sat 15 Aug 2026". For anywhere the year is not obvious from context. */
export function formatDateFull(d: Date): string {
  return `${formatDate(d)} ${d.getUTCFullYear()}`;
}

/** "22/08/26" — day/month/year, zero-padded. A real calendar date rather
 *  than a fixture row (see formatDate/formatDateFull for that) — for
 *  anywhere that wants to read like an actual phone. */
export function formatDateNumeric(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yy = String(d.getUTCFullYear() % 100).padStart(2, "0");
  return `${dd}/${mm}/${yy}`;
}

/**
 * The date a fixture is played, as a string, straight off the fixture.
 *
 * The one function every screen actually wants.
 */
export function fixtureDateLabel(
  startYear: number,
  season: number,
  week: number,
  kind?: string,
  division: CareerDivision = "premier",
): string {
  return formatDate(fixtureDate(startYear, season, week, dayFor(kind, week, division), division));
}

// ── The Championship's cups, and the play-offs ──────────────────────────────

/**
 * The same two cups on the same real weekends as the Premier League's, in
 * Championship round numbers rather than Premier League ones.
 *
 * They have to be restated rather than shared: week 8 is the eighth weekend
 * of a Premier League season and the eighth ROUND of a Championship one, and
 * by the eighth round the Championship is only into its sixth weekend. Each
 * number below is the round whose weekend matches the Premier League slot it
 * mirrors — round 4 sits on weekend 3, round 10 on weekend 8, and so on.
 */
export const CHAMPIONSHIP_LEAGUE_CUP_SLOTS: CupSlot[] = [
  { round: "Round of 32", week: 4 },        // weekend 3
  { round: "Round of 16", week: 10 },       // weekend 8
  { round: "Quarter-Final", week: 20 },     // weekend 16
  { round: "Semi-Final", week: 31, leg: 1 },// weekend 25
  { round: "Semi-Final", week: 35, leg: 2 },// weekend 28
  { round: "Final", week: CHAMPIONSHIP_POST_SEASON(1) },
];

export const CHAMPIONSHIP_FA_CUP_SLOTS: CupSlot[] = [
  { round: "Round of 32", week: 6 },        // weekend 5
  { round: "Round of 16", week: 15 },       // weekend 12
  { round: "Quarter-Final", week: 27 },     // weekend 22
  { round: "Semi-Final", week: 37 },        // weekend 30
  { round: "Final", week: CHAMPIONSHIP_POST_SEASON(2) },
];

/**
 * THE PLAY-OFFS.
 *
 * Third through sixth, for the one promotion place the automatic two leave
 * behind: 3rd v 6th and 4th v 5th over two legs, then a single final. Played
 * after the league AND after both cup finals, which is the order the real
 * season runs in — the play-off final is the last match of the English
 * season, every year.
 */
export const PLAY_OFF_SLOTS: CupSlot[] = [
  { round: "Play-Off Semi-Final", week: CHAMPIONSHIP_POST_SEASON(3), leg: 1 },
  { round: "Play-Off Semi-Final", week: CHAMPIONSHIP_POST_SEASON(4), leg: 2 },
  { round: "Play-Off Final", week: CHAMPIONSHIP_POST_SEASON(5) },
];

export function leagueCupSlotsFor(division: CareerDivision): CupSlot[] {
  return division === "championship" ? CHAMPIONSHIP_LEAGUE_CUP_SLOTS : LEAGUE_CUP_SLOTS;
}

export function faCupSlotsFor(division: CareerDivision): CupSlot[] {
  return division === "championship" ? CHAMPIONSHIP_FA_CUP_SLOTS : FA_CUP_SLOTS;
}

// ── Months, for the award ───────────────────────────────────────────────────

/**
 * Which calendar month a matchweek falls in.
 *
 * Player of the Month used to divide the season into ten equal blocks of four
 * weeks and call them August to May. That was close enough while a week was an
 * abstraction; now that a week has a date it is simply wrong — week 24 is not
 * "January" because 24 divided by 4 is 6.
 *
 * Returns a 0-based calendar month (0 = January), read off the real date.
 */
export function calendarMonthOf(
  startYear: number, season: number, week: number,
  division: CareerDivision = "premier",
): number {
  return fixtureDate(startYear, season, week, "saturday", division).getUTCMonth();
}

// ── Transfer windows ────────────────────────────────────────────────────────

/**
 * Real dates, not a fraction of the season — the same reasoning as the rest
 * of this file. Summer: open from kick-off through the 30th of September,
 * shut the moment October 1st arrives. January: open the whole month, shut
 * the moment February 1st arrives. Both are UTC calendar months read straight
 * off `fixtureDate`, so "shuts on October 1st" falls out of the boundary
 * between month 8 (September) and month 9 (October) rather than a day
 * counted by hand — precise at exactly the boundary that matters, and every
 * week within a month is either fully open or fully closed, which is the
 * only precision a week-at-a-time career actually needs.
 */
export type TransferWindow = "summer" | "january" | null;

export function transferWindowFor(
  startYear: number, season: number, week: number,
  division: CareerDivision = "premier",
): TransferWindow {
  const month = fixtureDate(startYear, season, week, "saturday", division).getUTCMonth(); // 0 = January
  if (month === 0) return "january";
  if (month === 7 || month === 8) return "summer";       // August, September
  return null;
}

export function transferWindowOpen(
  startYear: number, season: number, week: number,
  division: CareerDivision = "premier",
): boolean {
  return transferWindowFor(startYear, season, week, division) !== null;
}
