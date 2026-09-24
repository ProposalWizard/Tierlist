/**
 * ONE ENGINE — HOW A TEST SCREEN IS SET UP TO BE THE REAL GAME.
 *
 * Asked for directly: "there has to be a way that ANY new feature used the
 * base engine — when we are trialling new features that can be extra stuff
 * built on top of the base engine." And then: "if an area is specific for
 * tuning (i.e the play area) it should be the base game with guardrails +
 * adaptable gameplay — but adapting that gameplay should only happen inside
 * the test area and not uniformly."
 *
 * So this file is the difference between the real career match and a test
 * screen, written down in one place. Everything the real match gets, a test
 * screen gets too, unless a dial on the Play Area says otherwise — and a dial
 * is a prop passed to ONE mount of the engine, never a change to the engine.
 * Nothing here can reach a career.
 *
 * What an audit of the test screens found, and what each line below fixes
 * (23 Sep 2026, measured against app/star-dev/page.tsx's own <CanvasMatch>):
 *
 *   - Drag power is a fraction of the canvas HEIGHT. The gallery played at
 *     340 px wide on a phone (7.6% harder per finger-pixel than the real
 *     match's 366) and Infinite Match at 460 on a desktop (16% softer).
 *     → `realMatchWidth`: every test screen plays at the real match's size.
 *   - No weather, ever, where the real game has some in ~4 matches in 10.
 *     → the Play Area's Weather dial, starting on the real game.
 *   - The gallery had no squad at all: every head a blank circle, team-mates
 *     finishing on the generic formula (no curl, no chip, no first-time
 *     finish), a 62 keeper where a real side has its own.
 *     → `buildTestCareer` + `withRealSquads`: the same real squads the real
 *     game loads, from the same two fetches.
 *   - Infinite Match drained a 90-minute energy bar over 10,000 minutes, so
 *     from about minute 150 every kick was 30% weaker.
 *     → `FATIGUE_RESET_MINUTES`: fresh legs every 90, like a new match.
 */

import { makeInitialCareer } from "./careerFlow";
import { clubsForDivision } from "./scoutOffers";
import { DEFAULT_RULE_BOOK } from "./ruleBook";
import { conditionsFor, type Conditions } from "./weather";
import { fetchRealSquad, mergeSquadStats } from "./realSquad";
import { fetchLeagueSquads, mergeLeagueSquadStats, syncLeagueStrengthFromSquads } from "./leagueSquads";
import type { CareerState, Fixture, StarPlayer } from "./types";
import type { PlaySettings } from "./playArea";

/** The real match's column: Tailwind `max-w-sm`, inside 12 px of padding
 *  either side (app/star-dev/page.tsx's match phase). */
export const REAL_MATCH_MAX_W = 384;
export const REAL_MATCH_GUTTER = 24;

/**
 * The width, in CSS px, the real career match is played at on a screen this
 * wide. 366 on a 390 px phone, 384 on anything wider than 408.
 *
 * It matters because the engine reads a drag as a fraction of the canvas —
 * the same finger movement on a smaller canvas is a longer pull and a harder
 * kick. A test screen that plays at any other size is a different game.
 */
export function realMatchWidth(viewportW: number): number {
  if (!(viewportW > 0)) return REAL_MATCH_MAX_W;
  return Math.max(200, Math.min(REAL_MATCH_MAX_W, Math.round(viewportW - REAL_MATCH_GUTTER)));
}

/** A real match is ninety minutes; a test match that runs for thousands gets
 *  fresh legs every ninety, as if each were its own match. */
export const FATIGUE_RESET_MINUTES = 90;

/**
 * A career for a test screen to play in: a real club in the chosen division,
 * the Play Area's own power and technique, and a first league fixture to play.
 * Its squads are the generated stand-ins until `withRealSquads` swaps the
 * real ones in — the same order the real game loads them in.
 */
export function buildTestCareer(s: PlaySettings, seed: number): { career: CareerState; fixture: Fixture } | null {
  const clubs = clubsForDivision(s.division);
  if (clubs.length === 0) return null;
  const club = clubs[Math.abs(Math.floor(seed)) % clubs.length];
  const player = {
    firstName: "Test", lastName: "Player", age: 20,
    club, position: s.position, nationality: "England",
  } as StarPlayer;
  const base = makeInitialCareer(player, [...clubs], s.division);
  const career: CareerState = {
    ...base,
    skills: { ...base.skills, power: s.power, technique: s.technique },
    ruleBook: {
      ...(base.ruleBook ?? {}),
      FA: { ...DEFAULT_RULE_BOOK, matchLengthMinutes: s.matchMinutes },
    },
  };
  const fixture = career.fixtures.find((f) => !f.played && (!f.kind || f.kind === "league"));
  if (!fixture) return null;
  return { career, fixture };
}

/**
 * The same real squads the real game plays with — your club's and every club
 * in the division — fetched and merged by the exact functions the real game's
 * own refresh uses (app/star-dev/page.tsx, handleRefreshPhotos). Without it a
 * test screen's team-mates and opponents are invented, and the engine really
 * does play invented men differently: no identity means no finishing bonus,
 * no curl, no chip, a keeper with no rating of his own.
 *
 * Never throws: a failed fetch is the generated squad the career already has,
 * which is exactly what the real game falls back to as well.
 */
export async function withRealSquads(career: CareerState): Promise<CareerState> {
  try {
    const clubs = career.league.map((t) => t.name);
    const [freshSquad, freshLeague] = await Promise.all([
      fetchRealSquad(career.player.club),
      fetchLeagueSquads(clubs),
    ]);
    const squad = mergeSquadStats(freshSquad, career.squad ?? []);
    const leagueSquads = mergeLeagueSquadStats(freshLeague, career.leagueSquads ?? []);
    return { ...career, squad, leagueSquads, league: syncLeagueStrengthFromSquads(career.league, leagueSquads) };
  } catch {
    return career;
  }
}

/** The weather a test match is played in — the real game's roll unless the
 *  Weather dial says clear. */
export function testConditions(s: PlaySettings, career: CareerState, fixture: Fixture): Conditions | undefined {
  if (s.weather === "clear") return undefined;
  return conditionsFor(career.season, fixture.week, career.homeCity);
}

/** The weather's name on screen — a test screen should say when the wind is
 *  doing something to the ball. Null for a clear day. */
export function conditionsLabel(c: Conditions | undefined): string | null {
  if (!c || c.weather === "clear") return null;
  return c.label;
}
