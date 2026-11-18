/**
 * lib/rankingsPaused.ts — the Rankings pause (Mikey, 17 Nov 2026).
 *
 * "make the rankings mode unavailable right now ... I don't want you to delete
 * anything." While RANKINGS_PAUSED is true, every page that shows ranking
 * pictures (tierlists, vote rankings, blind rankings, the search) shows the
 * "not running right now" page instead (app/paused), and the Rankings games
 * are left off the home page and the menus. Nothing in the database or in
 * Storage is touched. Admin pages still work. Set to false to bring it back.
 */
export const RANKINGS_PAUSED = true;

/** Paths the pause covers: the path itself and everything under it. */
const PAUSED_PREFIXES = [
  "/tierlists",
  "/tierlist",
  "/create",
  "/play",
  "/rankings",
  "/blind-rankings",
  "/vote",
  "/find",
  "/api/blind-rankings",
];

/** Game links that are Rankings (home tiles, site menu, top bar). */
export const PAUSED_HREFS = new Set(["/tierlists", "/blind-rankings"]);

export function isRankingsPath(pathname: string): boolean {
  return PAUSED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

/** Drop the Rankings links from a list of game links while paused. */
export function withoutPaused<T extends { href: string }>(games: readonly T[]): T[] {
  return RANKINGS_PAUSED ? games.filter((g) => !PAUSED_HREFS.has(g.href)) : [...games];
}
