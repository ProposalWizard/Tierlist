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

/** Is this a week after the league has finished? */
export function isPostSeason(week: number): boolean {
  return week > MATCHWEEKS;
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
export function fixtureDate(startYear: number, season: number, week: number, day: MatchDay): Date {
  const opening = openingSaturday(seasonStartYear(startYear, season));
  const saturday = opening.getTime() + (week - 1) * 7 * DAY_MS;
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
export function dayFor(kind: string | undefined, week: number): MatchDay {
  if (!kind || kind === "league") return "saturday";
  if (isPostSeason(week)) return "saturday";
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
): string {
  return formatDate(fixtureDate(startYear, season, week, dayFor(kind, week)));
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
export function calendarMonthOf(startYear: number, season: number, week: number): number {
  return fixtureDate(startYear, season, week, "saturday").getUTCMonth();
}
