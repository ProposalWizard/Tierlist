/**
 * DAILY REAL GOAL (Leo, 22 Oct 2026, plan part 8; decided 8a: on the phone
 * only, no leaderboard). One real goal a day, the same for everyone: the UTC
 * date picks it from DAILY_LIST. Score it (★ or better) to keep your streak.
 * The streak is kept in this browser (localStorage), nowhere else.
 *
 * DAILY_LIST IS APPEND-ONLY. Day 0 is DAILY_START; day n plays DAILY_LIST[n].
 * Never reorder or remove an entry (that would change a day everyone already
 * played); add new goals at the END, before the list runs out. After its end
 * it goes round again from the start.
 *
 * Pure: no React. tests/star/realGoals.mts checks it.
 */

/** The first daily goal's day (UTC). */
export const DAILY_START = "2026-10-22";

/**
 * The goals, one a day from DAILY_START. A mix of bangers ("bg-…"), the
 * World Cup / Euro favourites and the 2017/18 leagues' best ("wy…").
 * Append only.
 */
export const DAILY_LIST: string[] = [
  // 22 Oct 2026: 121 days (to 20 Feb 2027). Bangers, the 2017/18 Worldies, World Cup / Euro favourites.
  "bg-rooney-mancity-2011", "wy241160349", "bg-aguero-qpr-2012", "wy259874767", "bg-bale-liverpool-2018", "wy245883705",
  "bg-lamela-arsenal-2021", "wy259967017", "bg-messi-realmadrid-2017", "wy196689299", "bg-kane-darmstadt-2023", "wy262119252",
  "bg-messi-bayern-2015", "wy238901337", "bg-altintop-kazakhstan-2010", "wy88950513", "bg-quagliarella-napoli-2018", "wy234993548",
  "bg-can-watford-2017", "wy89983628", "bg-ronaldo-juventus-2018", "wy224340372", "bg-bellingham-slovakia-2024", "wy261066318",
  "bg-messi-realmadrid-2011", "wy247151596", "bg-neymar-villarreal-2015", "wy259751694", "bg-yamal-france-2024", "wy192673992",
  "bg-bale-barcelona-2014", "wy88585724", "bg-sergiroberto-psg-2017", "wy218870556", "bg-drogba-bayern-2012", "wy259350708",
  "bg-lewandowski-augsburg-2021", "wy190006767", "bg-mandzukic-realmadrid-2017", "wy89148495", "bg-messi-liverpool-2019", "wy222335506",
  "bg-yamal-espanyol-2025", "wy263153952", "bg-lewandowski-wolfsburg-2015", "wy251616187", "bg-kvaratskhelia-atalanta-2023", "wy88222586",
  "bg-robben-dortmund-2013", "wy227299664", "bg-vanpersie-spain-2014", "wy259958556", "bg-adam-chelsea-2015", "wy216905473",
  "bg-leao-sassuolo-2020", "wy258613749", "bg-cahill-netherlands-2014", "wy211332376", "bg-rodri-inter-2023", "wy89857551",
  "bg-ramos-atletico-2014", "wy208891443", "bg-messi-manutd-2011", "wy258973361", "bg-dimarco-frosinone-2023", "wy232238105",
  "bg-ibrahimovic-bastia-2013", "wy88965462", "bg-giroud-crystalpalace-2017", "wy206829963", "bg-mkhitaryan-sunderland-2016", "wy88950384",
  "bg-hernandez-atalanta-2022", "wy206868897", "bg-totti-lazio-2015", "wy89856754", "bg-schick-scotland-2021", "wy185750710",
  "bg-garnacho-everton-2023", "wy258928212", "bg-origi-barcelona-2019", "wy188291909", "bg-higuain-frosinone-2016", "wy260087964",
  "bg-rodriguez-uruguay-2014", "wy229711456", "bg-xhaka-bremen-2024", "wy262103326", "bg-salah-everton-2017", "wy178169461",
  "bg-benarfa-saintetienne-2015", "wy88260871", "bg-gotze-argentina-2014", "wy251317075", "bg-ibrahimovic-anderlecht-2013", "wy89984068",
  "bg-son-burnley-2019", "wy239137327", "bg-alli-crystalpalace-2016", "wy261066161", "bg-bellingham-barcelona-2023", "wy187950006",
  "bg-cisse-chelsea-2012", "wy88949633", "bg-vanpersie-astonvilla-2013", "wy218695560", "bg-ronaldo-sampdoria-2019", "wy261447152",
  "bg-lucasmoura-ajax-2019", "wy180055162", "bg-wilshere-norwich-2013", "wy89280365", "bg-ibrahimovic-england-2012", "wy189333832",
  "bg-rooney-westham-2014", "wy90589254", "bg-messi-athletic-2015", "wy226094261", "bg-richarlison-serbia-2022", "wy279010313",
  "bg-messi-betis-2019",
  // ← append new goals here
];

const DAY_MS = 86_400_000;
/** "2026-10-22" for a time, in UTC. */
export const utcDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);
/** Whole UTC days since 1970 for "YYYY-MM-DD". */
export const dayNumber = (date: string) => Math.floor(Date.parse(`${date}T00:00:00Z`) / DAY_MS);
/** The day before "YYYY-MM-DD". */
export const dayBefore = (date: string) => utcDate(Date.parse(`${date}T00:00:00Z`) - DAY_MS);

/** Day n of the daily list for a date (0 = DAILY_START). Before the start: day 0. */
export function dailyIndex(date: string, list: string[] = DAILY_LIST): number {
  if (!list.length) return -1;
  const n = Math.max(0, dayNumber(date) - dayNumber(DAILY_START));
  return n < list.length ? n : n % list.length;
}
export function dailyGoalId(date: string, list: string[] = DAILY_LIST): string | null {
  const i = dailyIndex(date, list);
  return i < 0 ? null : list[i];
}
/** "Daily #1" for the start day. */
export const dailyNumber = (date: string) => Math.max(0, dayNumber(date) - dayNumber(DAILY_START)) + 1;

// ─────────────────────────────────────────────────────────────────────────
//  THE STREAK (this phone only)
// ─────────────────────────────────────────────────────────────────────────

export interface DailyState {
  /** The last day you beat (scored) the daily goal. */
  last: string | null;
  /** Days in a row up to `last`. */
  streak: number;
  /** The longest streak ever. */
  best: number;
  /** Per day: the best stars and % on that day's goal. */
  days: Record<string, { stars: number; pct: number }>;
}
export const EMPTY_DAILY: DailyState = { last: null, streak: 0, best: 0, days: {} };

/** A try at the day's goal: a goal (★1+) beats it; a beaten day in a row adds one, a missed day starts again at 1. */
export function recordDaily(s: DailyState, date: string, stars: number, pct: number): DailyState {
  const was = s.days[date] ?? { stars: 0, pct: 0 };
  const days = { ...s.days, [date]: { stars: Math.max(was.stars, stars), pct: Math.max(was.pct, Math.round(pct)) } };
  if (stars < 1 || s.last === date) return { ...s, days };
  const streak = s.last === dayBefore(date) ? s.streak + 1 : 1;
  return { last: date, streak, best: Math.max(s.best, streak), days };
}

/** The streak as it stands today: still alive if you beat yesterday's or today's, else 0. */
export function currentStreak(s: DailyState, today: string): number {
  if (!s.last) return 0;
  return s.last === today || s.last === dayBefore(today) ? s.streak : 0;
}

export const beatToday = (s: DailyState, today: string) => (s.days[today]?.stars ?? 0) > 0;

const KEY = "star-real-goals-daily-v1";
export function loadDaily(): DailyState {
  try {
    const raw = localStorage.getItem(KEY);
    const v = raw ? JSON.parse(raw) : null;
    return v && typeof v === "object" && typeof v.streak === "number" && v.days ? v : { ...EMPTY_DAILY };
  } catch { return { ...EMPTY_DAILY }; }
}
export function saveDaily(s: DailyState): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private window: this visit only */ }
}
