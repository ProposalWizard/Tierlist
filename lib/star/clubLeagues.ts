import { PREMIER_LEAGUE_CLUBS } from "./clubs";

/**
 * THE FIVE LEAGUES THAT COUNT.
 *
 * Requested directly, for the Ballon d'Or shortlist: a season in the
 * Premier League, LaLiga, the Bundesliga, Ligue 1 or Serie A is judged on
 * its own numbers; a season anywhere else — the Saudi Pro League, a mid-
 * table Portuguese or Belgian side, a Scottish or Turkish giant — is
 * genuinely a weaker level, so the same numbers should count for less.
 * "As easy as it is to perform in a lesser league" was the reasoning given.
 *
 * This game only ever plays out ENGLISH football (career.league is always
 * the Premier League or the Championship — the two divisions this whole
 * career mode models), so the one club whose "league" is ever actually in
 * question by the multiplier below is the player's own. Everyone else with
 * a real shirt in this game — the Champions League/Europa League/Other
 * lists in clubs.ts — is there precisely BECAUSE the Ballon d'Or shortlist
 * (and the international transfer window) needed real rivals outside the
 * closed English system, so their real country matters here too.
 *
 * Not every club in the game needs its exact country on record — only
 * whether it sits in one of the five. Everything not listed below defaults
 * to "no", which is the right default: a club new to clubs.ts should not
 * silently start scoring at full strength for a league it was never
 * actually confirmed to be in.
 */

/**
 * Non-English clubs playing in Spain, Germany, France or Italy's OWN top
 * flight — LaLiga, the Bundesliga, Ligue 1, Serie A. Sourced against the
 * same real 2025/26 season clubs.ts's own Champions/Europa League/Other
 * lists were built from; a club not in one of those four countries' top
 * division (Portugal, Belgium, the Netherlands, Turkey, Scotland, Austria,
 * a Saudi giant, and so on) is deliberately absent — see the module note.
 */
const BIG_FIVE_EUROPEAN_CLUBS = new Set<string>([
  // LaLiga (Spain)
  "Atlético Madrid", "FC Barcelona", "Real Betis Balompié", "Real Madrid",
  "Villarreal CF", "RC Celta", "Real Sociedad", "Sevilla FC",
  // Bundesliga (Germany) — NOT FC Red Bull Salzburg, which is Austrian
  // despite the shared branding with RB Leipzig.
  "Borussia Dortmund", "FC Bayern München", "RB Leipzig", "VfB Stuttgart",
  "TSG 1899 Hoffenheim", "Bayer 04 Leverkusen", "Eintracht Frankfurt", "FC Schalke 04",
  // Ligue 1 (France)
  "Paris Saint-Germain", "RC Lens", "Lille OSC", "Olympique Lyonnais",
  "Olympique de Marseille", "Stade Rennais FC", "AS Monaco", "RC Strasbourg Alsace",
  // Serie A (Italy)
  "Como", "Inter", "Napoli", "Roma", "Juventus", "AC Milan", "Atalanta", "Lazio",
]);

/**
 * True for the Premier League's own current twenty, or a non-English club
 * playing in Spain/Germany/France/Italy's top flight. False for everyone
 * else this game has real data for — including the Championship: a second
 * tier is a real level, but it is not the one this multiplier is judging.
 */
export function isBigFiveLeagueClub(club: string): boolean {
  return PREMIER_LEAGUE_CLUBS.includes(club) || BIG_FIVE_EUROPEAN_CLUBS.has(club);
}

/**
 * The Ballon d'Or score multiplier for a club's league — see the module
 * note for the reasoning and BIG_FIVE_EUROPEAN_CLUBS for exactly who counts.
 */
export const BIG_FIVE_MULTIPLIER = 1;
export const OTHER_LEAGUE_MULTIPLIER = 0.75;

export function leagueMultiplierFor(club: string): number {
  return isBigFiveLeagueClub(club) ? BIG_FIVE_MULTIPLIER : OTHER_LEAGUE_MULTIPLIER;
}
