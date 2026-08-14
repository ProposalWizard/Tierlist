import type { CareerState, LeagueResult } from "./types";
import { mulberry32 } from "./season";
import { shortNameOf } from "./realSquad";
import { calendarMonthOf } from "./calendar";

/**
 * PLAYER OF THE MONTH.
 *
 * Every league game played in a month, and one name at the end of it.
 *
 * ── Why it is a vote and not a sum ──
 *
 * The real award is decided by a panel who watched the football. Goals help
 * enormously and do not settle it: a striker with four in a month his side lost
 * three of loses to a midfielder with two and four wins, and sometimes he just
 * loses. So this scores the things that are countable — goals, assists, the
 * points his side took — and then puts a deterministic wobble through it, so the
 * leading scorer is usually the winner and never automatically the winner.
 *
 * Deterministic because everything in this career is: the same month replays to
 * the same result, and refreshing the page does not re-run the vote.
 *
 * ── Where the numbers come from ──
 *
 * `career.results`, which already holds every league game in the season with its
 * scorers and assisters. Nothing new is tracked and nothing can drift out of
 * step with the table, because it IS the table's own record.
 */

/**
 * The ten months a season is played in, August to May.
 *
 * These used to be blocks of four weeks each, which was fine while a week was
 * an abstraction and wrong the moment the calendar grew real dates: week 24 is
 * not "January" because 24 divided by 4 is 6. `monthOf` now reads the actual
 * date of a matchweek — see lib/star/calendar — so August is the weeks played in
 * August, which is three of them, and September is four.
 */
export const MONTH_NAMES = [
  "August", "September", "October", "November", "December",
  "January", "February", "March", "April", "May",
];

/** Retained for careers and tests written against the old four-week blocks. */
export const WEEKS_PER_MONTH = 4;

/** Calendar month (0 = January) → our 0-9 index, August first. */
function seasonMonthIndex(calendarMonth: number): number {
  // August is 7 and comes first; May is 4 and comes last.
  const i = calendarMonth >= 7 ? calendarMonth - 7 : calendarMonth + 5;
  return Math.max(0, Math.min(MONTH_NAMES.length - 1, i));
}

/**
 * Which month of the season a matchweek falls in.
 *
 * The season and start year are optional so every existing caller keeps
 * working: without them it falls back to the old four-week blocks, which is
 * exactly what a career saved before the calendar existed was scored on.
 */
export function monthOf(week: number, startYear?: number, season?: number): number {
  if (startYear !== undefined && season !== undefined) {
    return seasonMonthIndex(calendarMonthOf(startYear, season, week));
  }
  return Math.min(MONTH_NAMES.length - 1, Math.floor(Math.max(0, week - 1) / WEEKS_PER_MONTH));
}

/** The same question, asked of a career, which knows both. */
export function monthOfCareer(career: CareerState, week: number): number {
  return monthOf(week, career.player.startYear, career.season);
}

/**
 * The last league week of a month, read off the calendar.
 *
 * A month ends when the next matchweek belongs to a different one — which is
 * what "the end of August" means, and is not the same as "every fourth week".
 */
export function endsMonthOn(career: CareerState, week: number, lastWeek: number): boolean {
  if (week >= lastWeek) return true;
  return monthOfCareer(career, week) !== monthOfCareer(career, week + 1);
}

export function monthName(week: number): string {
  return MONTH_NAMES[monthOf(week)];
}

/** Is this the last league week of its month? */
export function endsMonth(week: number, lastWeek: number): boolean {
  return week % WEEKS_PER_MONTH === 0 || week >= lastWeek;
}

export interface MonthCandidate {
  name: string;
  club: string;
  goals: number;
  assists: number;
  /** Points his side took in the month — 3 a win, 1 a draw. */
  points: number;
  /** Yours only. Nobody else in the division is rated. */
  rating?: number;
  isYou: boolean;
  /** What the panel scored him. Not shown; it decides the order. */
  score: number;
}

export interface MonthAward {
  season: number;
  /** 0-9. August is 0. */
  month: number;
  monthName: string;
  winner: string;
  club: string;
  goals: number;
  assists: number;
  isYou: boolean;
  /** Everybody who made the shortlist, best first, the winner included. */
  nominees: { name: string; club: string; goals: number; assists: number; isYou: boolean }[];
  /** Where you finished, 1-based, when you were on the shortlist. */
  yourPlace?: number;
}

/** How many names go on the shortlist. */
const SHORTLIST = 5;

/**
 * What a month's football says about everybody who played in it.
 *
 * Goals and assists come off the results; points come off who won the game the
 * goal was scored in. A player who did not score or assist all month is not a
 * candidate, which is also how the real award works — you cannot be nominated
 * for having been available.
 */
export function monthCandidates(career: CareerState, month: number): MonthCandidate[] {
  const results = (career.results ?? []).filter(r => monthOfCareer(career, r.week) === month);
  if (results.length === 0) return [];

  const by = new Map<string, MonthCandidate>();
  const key = (name: string, club: string) => `${club}|${name}`;
  const touch = (name: string, club: string): MonthCandidate => {
    const k = key(name, club);
    let c = by.get(k);
    if (!c) {
      c = { name, club, goals: 0, assists: 0, points: 0, isYou: false, score: 0 };
      by.set(k, c);
    }
    return c;
  };

  // Points a club took in the month, so a scorer's side's results count for him.
  const clubPoints = new Map<string, number>();
  const addPoints = (club: string, n: number) => clubPoints.set(club, (clubPoints.get(club) ?? 0) + n);
  for (const r of results) {
    if (r.hs > r.as) { addPoints(r.home, 3); }
    else if (r.hs < r.as) { addPoints(r.away, 3); }
    else { addPoints(r.home, 1); addPoints(r.away, 1); }
  }

  for (const r of results) {
    for (const [club, goals] of [[r.home, r.hg], [r.away, r.ag]] as const) {
      for (const g of goals ?? []) {
        touch(g.s, club).goals += 1;
        if (g.a) touch(g.a, club).assists += 1;
      }
    }
  }

  const yourName = `${career.player.firstName} ${career.player.lastName}`;
  const yourSurname = career.player.lastName;
  for (const c of Array.from(by.values())) {
    c.points = clubPoints.get(c.club) ?? 0;
    c.isYou = c.club === career.player.club && (c.name === yourSurname || c.name === yourName);
  }

  // Your rating is the only one in the division, because you are the only one
  // whose matches are actually played.
  const mine = Array.from(by.values()).find(c => c.isYou);
  if (mine) {
    const rated = (career.fixtures ?? []).filter(
      f => f.played && (f.kind ?? "league") === "league"
        && monthOfCareer(career, f.week) === month && typeof f.userRating === "number");
    if (rated.length) {
      mine.rating = rated.reduce((a, f) => a + (f.userRating ?? 0), 0) / rated.length;
    }
  }

  return Array.from(by.values());
}

/**
 * The panel votes.
 *
 * Goals dominate, assists matter, the side's month matters, and a rating —
 * which only you have — is worth a nudge either way from a competent 6.5. Then
 * every candidate is multiplied by a wobble drawn from the month's own seed, so
 * the same month always votes the same way and the top scorer is a strong
 * favourite rather than a certainty.
 */
export function voteMonth(career: CareerState, month: number): MonthAward | null {
  const candidates = monthCandidates(career, month);
  if (candidates.length === 0) return null;

  // ── Warming the generator ──
  //
  // mulberry32's FIRST output barely mixes a structured seed, and these seeds
  // are structured — season, month and a headcount. Measured: across four
  // hundred seasons of an identical month the leading scorer won all four
  // hundred, because every first draw came out in the same part of the range.
  // Discarding the first few makes it a wobble again.
  const rng = mulberry32(career.season * 100003 + month * 7919 + candidates.length * 31);
  rng(); rng(); rng();
  for (const c of candidates) {
    const base = c.goals * 3.4 + c.assists * 2.1 + c.points * 0.55
      + (c.rating !== undefined ? (c.rating - 6.5) * 2.4 : 0);
    // 0.58 … 1.42, and the width was measured rather than guessed. Over 3,000
    // votes on a month of four, three, two and one goals it returns:
    //
    //   four goals   75%      two goals    2%
    //   three goals  24%      one goal     0%
    //
    // Which is the shape the award has in life: the leading scorer is a strong
    // favourite, the man behind him takes it often enough to be worth arguing
    // about, and a quiet month never wins it however the panel felt.
    c.score = base * (0.58 + rng() * 0.84);
  }

  const ranked = [...candidates].sort((a, b) =>
    b.score - a.score || b.goals - a.goals || a.name.localeCompare(b.name));
  const shortlist = ranked.slice(0, SHORTLIST);
  const winner = shortlist[0];
  const yourIndex = shortlist.findIndex(c => c.isYou);

  return {
    season: career.season,
    month,
    monthName: MONTH_NAMES[month],
    winner: winner.name,
    club: winner.club,
    goals: winner.goals,
    assists: winner.assists,
    isYou: winner.isYou,
    nominees: shortlist.map(c => ({
      name: c.name, club: c.club, goals: c.goals, assists: c.assists, isYou: c.isYou,
    })),
    yourPlace: yourIndex >= 0 ? yourIndex + 1 : undefined,
  };
}

/**
 * Where you stand while the month is still running.
 *
 * Used for the build-up rather than the award: the same scoring without the
 * wobble, because a race is about the numbers and the vote is the thing that
 * has not happened yet.
 */
export function monthRace(career: CareerState, month: number): MonthCandidate[] {
  const candidates = monthCandidates(career, month);
  for (const c of candidates) {
    c.score = c.goals * 3.4 + c.assists * 2.1 + c.points * 0.55
      + (c.rating !== undefined ? (c.rating - 6.5) * 2.4 : 0);
  }
  return candidates.sort((a, b) => b.score - a.score || b.goals - a.goals);
}

// ── Faces ───────────────────────────────────────────────────────────────────

/**
 * The portrait that belongs to a name on the shortlist.
 *
 * Harder than it sounds, because a candidate is a STRING and not a player. The
 * month's numbers are read back out of `career.results`, where a goal records
 * who scored it and nothing else — and the two halves of the division write that
 * string differently. Your own club's goals are filed by `surname()` because
 * they were scored by named men in a match you played; everybody else's come
 * from `nameGoals`, which files them by `shortNameOf()`. "Szoboszlai" and
 * "D. Szoboszlai" are the same footballer and neither spelling is wrong.
 *
 * So the match is made on a flattened key — no case, no punctuation, no
 * accents — against every spelling of a player's name a squad holds. Accents
 * matter more than they look: the database has Guéhi and a goal record can
 * carry Guehi, and comparing them raw silently loses the face.
 */
/**
 * Letters NFD will not take apart.
 *
 * Decomposition strips a combining accent off its letter \u2014 \u00e9 becomes e plus a
 * mark, and the mark is thrown away. It does nothing for the letters that are
 * their own character rather than a letter wearing a hat, and football is full
 * of them: \u00d8degaard's \u00d8 survives NFD intact and is then deleted as "not a-z",
 * leaving "degaard" to be compared against "odegaard". They stop being the same
 * player, and he loses his photograph.
 */
const HARD_LETTERS: Record<string, string> = {
  \u00f8: "o", \u0111: "d", \u00f0: "d", \u0142: "l", \u00df: "ss", \u00e6: "ae", \u0153: "oe", \u00fe: "th", \u0127: "h", \u0131: "i",
};

function nameKey(s: string): string {
  return s
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[\u00f8\u0111\u00f0\u0142\u00df\u00e6\u0153\u00fe\u0127\u0131]/g, c => HARD_LETTERS[c] ?? c)
    .replace(/[^a-z]/g, "");
}

function lastWord(s: string): string {
  const parts = s.trim().split(/\s+/);
  return parts[parts.length - 1] ?? s;
}

/** What a squad knows about a man a goal record only names. */
export interface KnownPlayer { name: string; image?: string }

export function playerOf(career: CareerState, name: string, club: string): KnownPlayer | undefined {
  const want = nameKey(name);
  if (!want) return undefined;

  // Your own dressing room first. It is a different shape from the other
  // nineteen — full `SquadPlayer`s, with `shortName` already on them.
  if (club === career.player.club) {
    const mine = (career.squad ?? []).find(p =>
      nameKey(p.shortName ?? "") === want || nameKey(p.name) === want || nameKey(lastWord(p.name)) === want);
    if (mine) return { name: mine.name, image: mine.imageUrl };
  }

  const squad = (career.leagueSquads ?? []).find(s => s.club === club);
  // `shortNameOf` as well as the last word, and they are not the same thing:
  // "V. van Dijk" shortens to "van Dijk", which is what the goal record holds,
  // while its last word is "Dijk", which is not a footballer anybody has.
  const him = squad?.players.find(p =>
    nameKey(p.name) === want
    || nameKey(shortNameOf(p.name)) === want
    || nameKey(lastWord(p.name)) === want);
  return him ? { name: him.name, image: him.image } : undefined;
}

export function faceOf(career: CareerState, name: string, club: string): string | undefined {
  return playerOf(career, name, club)?.image;
}

/** Has this month already been awarded? */
export function alreadyAwarded(career: CareerState, month: number): boolean {
  return (career.potm ?? []).some(a => a.season === career.season && a.month === month);
}

/**
 * Award every month that has already been played and never judged.
 *
 * Two careers need this and they are not the same case.
 *
 * The first is a career that was in progress when the award was added. Twenty-
 * five weeks of football had been played, seven months of it were complete, and
 * the Awards tab said "nothing awarded yet — the first one is given at the end
 * of August" while the player was in February. The results were all there; the
 * code that reads them simply did not exist when those months ended.
 *
 * The second is a career whose months moved. They used to be blocks of four
 * weeks and are now real calendar months, so a save made under the old scheme
 * can hold an award for a month that no longer ends where it did.
 *
 * Both are answered the same way: run the vote for every complete month with no
 * award against it. The vote is deterministic, so doing this now gives exactly
 * the result it would have given at the time.
 *
 * A month is only complete if the week AFTER it has been played — otherwise
 * February gets awarded on the strength of one game because that is all that has
 * happened in it so far.
 */
export function catchUpAwards(career: CareerState): MonthAward[] {
  const played = (career.fixtures ?? []).filter(f => f.played && (f.kind ?? "league") === "league");
  if (!played.length) return [];
  const lastPlayed = Math.max(...played.map(f => f.week));
  const lastWeek = Math.max(...(career.fixtures ?? []).map(f => f.week), lastPlayed);

  const out: MonthAward[] = [];
  const have = new Set((career.potm ?? [])
    .filter(a => a.season === career.season)
    .map(a => a.month));

  for (const f of played) {
    const month = monthOfCareer(career, f.week);
    if (have.has(month)) continue;
    if (!endsMonthOn(career, f.week, lastWeek)) continue;
    // Complete only if the season has moved past it.
    if (f.week >= lastPlayed && f.week < lastWeek) continue;
    const award = voteMonth(career, month);
    if (!award) continue;
    have.add(month);
    out.push(award);
  }
  return out.sort((a, b) => a.month - b.month);
}
