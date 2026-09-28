/**
 * MATCH-DAY PREFERENCES (v0.15). Per-device, not career data — the same
 * convention as postMatchPrefs.ts and the match speed/mute keys.
 *
 *   - Live-score notifications (item 35): the clubs whose goals pop up during
 *     your match. None are ticked by default.
 *   - Developer info (item 24): the substitute's minute and ladder on the
 *     pre-match card. Off for normal players; Settings → Developer tools.
 */

const FOLLOW_KEY = "star-live-score-teams";
const DEV_INFO_KEY = "star-dev-info";

/**
 * ── One-off games (28 Sep 2026) ──
 *
 * Harry: on the match-day Fixtures page, a bell on each OTHER game, for
 * live-score notifications on that one game only. Stored beside the club
 * ticks as `{ season, week, home, away }` — so a bell never follows a club
 * beyond that week — and fed into the SAME mechanism: the match screen asks
 * `followedTeams()` which clubs to pop goals for, and gets the club ticks
 * plus the two clubs of every belled game in the week being played. Which
 * week that is, the match-day screen says (`setLiveScoreWeek`) as it opens.
 */
const FIXTURE_KEY = "star-live-score-fixtures";
const NOW_KEY = "star-live-score-week";

export interface FollowedFixture { season: number; week: number; home: string; away: string }

/** The clubs you have ticked in Settings → Live scores (club ticks only). */
export function followedClubs(): string[] {
  try {
    const raw = localStorage.getItem(FOLLOW_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function followedFixtures(): FollowedFixture[] {
  try {
    const raw = localStorage.getItem(FIXTURE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list)
      ? list.filter((f): f is FollowedFixture => !!f && typeof f.season === "number" && typeof f.week === "number" && typeof f.home === "string" && typeof f.away === "string")
      : [];
  } catch {
    return [];
  }
}

const sameGame = (a: FollowedFixture, b: FollowedFixture) =>
  a.season === b.season && a.week === b.week && a.home === b.home && a.away === b.away;

export function isFixtureFollowed(f: FollowedFixture): boolean {
  return followedFixtures().some((x) => sameGame(x, f));
}

/** Bell or un-bell one other game. Returns whether it is now followed. */
export function toggleFollowedFixture(f: FollowedFixture): boolean {
  const now = followedFixtures();
  const on = now.some((x) => sameGame(x, f));
  const next = on ? now.filter((x) => !sameGame(x, f)) : [...now, f];
  // Old bells for past seasons are dropped as the list is rewritten.
  const tidy = next.filter((x) => x.season >= f.season - 1);
  try { localStorage.setItem(FIXTURE_KEY, JSON.stringify(tidy)); } catch { /* ignore */ }
  return !on;
}

/** The week about to be played (set by the match-day screen). */
export function setLiveScoreWeek(season: number, week: number): void {
  try { localStorage.setItem(NOW_KEY, JSON.stringify({ season, week })); } catch { /* ignore */ }
}
function liveScoreWeek(): { season: number; week: number } | null {
  try {
    const v = JSON.parse(localStorage.getItem(NOW_KEY) ?? "null");
    return v && typeof v.season === "number" && typeof v.week === "number" ? v : null;
  } catch {
    return null;
  }
}
/** The clubs of every belled game in the week being played. */
function belledClubsNow(): string[] {
  const now = liveScoreWeek();
  if (!now) return [];
  return followedFixtures()
    .filter((f) => f.season === now.season && f.week === now.week)
    .flatMap((f) => [f.home, f.away]);
}

/**
 * The clubs whose goals pop up during your match: the clubs you have ticked,
 * plus both clubs of every game you have belled for this week.
 */
export function followedTeams(): string[] {
  return Array.from(new Set([...followedClubs(), ...belledClubsNow()]));
}

export function setFollowedTeams(clubs: string[]): void {
  try { localStorage.setItem(FOLLOW_KEY, JSON.stringify(Array.from(new Set(clubs)))); } catch { /* ignore */ }
}

/** Tick or untick one club in Settings. Returns the new club list. */
export function toggleFollowedClub(club: string): string[] {
  const now = followedClubs();
  const next = now.includes(club) ? now.filter((c) => c !== club) : [...now, club];
  setFollowedTeams(next);
  return next;
}

/**
 * Tick or untick one club from inside a match. Returns everything now
 * followed (club ticks plus this week's bells), which is what the match's
 * list shows. Unticking a club that is only followed through a bell drops
 * that bell, so the tick really does go off.
 */
export function toggleFollowedTeam(club: string): string[] {
  const clubs = followedClubs();
  if (clubs.includes(club)) {
    setFollowedTeams(clubs.filter((c) => c !== club));
  } else if (belledClubsNow().includes(club)) {
    const now = liveScoreWeek();
    const keep = followedFixtures().filter((f) => !(now && f.season === now.season && f.week === now.week && (f.home === club || f.away === club)));
    try { localStorage.setItem(FIXTURE_KEY, JSON.stringify(keep)); } catch { /* ignore */ }
  } else {
    setFollowedTeams([...clubs, club]);
  }
  return followedTeams();
}

/** Developer info on screen (the sub's planned minute and ladder). Off by default. */
export function devInfoOn(): boolean {
  try { return localStorage.getItem(DEV_INFO_KEY) === "1"; } catch { return false; }
}

export function setDevInfo(on: boolean): void {
  try { localStorage.setItem(DEV_INFO_KEY, on ? "1" : "0"); } catch { /* ignore */ }
}
