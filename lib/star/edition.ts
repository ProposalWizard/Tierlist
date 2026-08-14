/**
 * WHICH EDITION THE CAREER IS PLAYED IN.
 *
 * One number, in one place. It was written out as a literal `2026` in seven
 * files — two library defaults, a route default, and four components — so
 * moving the game on a year meant finding all seven and hoping.
 *
 * `fifa_year` in `sofifa_players` is four digits: 2026 is FC 26 and the 2025/26
 * season, 2027 is FC 27 and 2026/27.
 *
 * ── FC 27 does not come from EA ──
 *
 * It does not exist yet. It is the FC 26 Premier League cloned a year older by
 * supabase/migrations/fc27_clone_premier_league.sql and then edited by hand in
 * /admin/football/players as the transfer window plays out. So this pointing at
 * 2027 means the game reads a database that is being written to daily, which is
 * the intent — see the note on caching below.
 */
export const STAR_FIFA_YEAR = 2027;

/** "2026/27", for anything that shows the player which season this is. */
export const STAR_SEASON_LABEL = `${STAR_FIFA_YEAR - 1}/${String(STAR_FIFA_YEAR % 100).padStart(2, "0")}`;

/** "FC 27", the way the admin screens spell an edition. */
export const STAR_EDITION_LABEL = `FC ${String(STAR_FIFA_YEAR % 100).padStart(2, "0")}`;

/**
 * Every request for squad data goes out with this.
 *
 * `no-store`, deliberately. The database behind FC 27 is being edited while the
 * game is being played — a rating corrected, a signing moved to his new club —
 * and a cached response would show yesterday's squad with no way to tell. It
 * costs one round trip on a screen that already makes one.
 */
export const SQUAD_FETCH_INIT: RequestInit = { cache: "no-store" };
