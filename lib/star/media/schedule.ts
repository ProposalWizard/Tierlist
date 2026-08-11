import type { StoredPost, Window } from "./types";

/**
 * THE NEWS CYCLE
 *
 * A feed that drops twenty-two posts at the final whistle is a wall of text. A
 * real one has shape: the club posts before anyone has sat down, the supporters
 * are immediate and unfiltered, the numbers arrive when somebody has looked them
 * up, the write-ups come that evening, the back pages come tomorrow and the
 * awards come on Monday.
 *
 * Generation is eager — the whole cycle is computed at full time, once — but
 * REVEAL is gated on a virtual clock. So the wave you see walking out of the
 * ground is genuinely not the whole story, and opening the tab on Tuesday shows
 * things that were not there on Saturday night. It costs one comparison and it
 * is the entire difference between a list and a feed.
 */

/** Minutes after the final whistle that each window opens into. */
const WINDOWS: Record<Window, [number, number]> = {
  instant: [0, 14],
  hour: [15, 90],
  evening: [150, 400],
  nextDay: [1000, 1250],   // ~17-21 hours later
  weekly: [2600, 3000],    // a couple of days on
};

/** season × 10⁶ + week × 10⁴ + minutes. Ordered, and readable in a debugger. */
export function clockAt(season: number, week: number, minutes = 0): number {
  return season * 1_000_000 + week * 10_000 + Math.min(9_999, Math.max(0, Math.round(minutes)));
}

export function timeFor(season: number, week: number, window: Window, jitter: number): number {
  const [lo, hi] = WINDOWS[window];
  return clockAt(season, week, lo + jitter * (hi - lo));
}

/**
 * What the player can see right now.
 *
 * "Now" is where the career has got to — the start of the current week — so
 * everything from earlier weeks is fully visible and the current match's later
 * waves arrive as the week rolls on. The post-match screen passes a deliberately
 * early `now` so it shows the immediate reaction and nothing else.
 */
export function visible(posts: StoredPost[], now: number): StoredPost[] {
  return posts.filter(p => p.at <= now).sort((a, b) => b.at - a.at);
}

/** How the timestamp reads on the card. */
export function relativeTime(at: number, now: number): string {
  const season = Math.floor(at / 1_000_000);
  const nowSeason = Math.floor(now / 1_000_000);
  const week = Math.floor((at % 1_000_000) / 10_000);
  const nowWeek = Math.floor((now % 1_000_000) / 10_000);

  if (season !== nowSeason) return `S${season} W${week}`;
  const weeksAgo = nowWeek - week;
  if (weeksAgo >= 2) return `${weeksAgo}w`;
  if (weeksAgo === 1) return "1w";

  const minutes = at % 10_000;
  const nowMinutes = now % 10_000;
  const diff = Math.max(0, nowMinutes - minutes);
  if (diff < 1) return "now";
  if (diff < 60) return `${Math.round(diff)}m`;
  if (diff < 1440) return `${Math.round(diff / 60)}h`;
  return `${Math.round(diff / 1440)}d`;
}
