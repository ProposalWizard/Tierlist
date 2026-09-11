import { ev } from "./kit";
import type { FootballEvent, Subject } from "../types";
import type { LeagueSquad } from "../../types";

/**
 * THE KIDS EVERYONE IS TALKING ABOUT.
 *
 * Requested directly, alongside the High Potential flag itself (admin-ticked
 * per player, `sofifa_players.high_potential`, threaded through as
 * `LeaguePlayer.highPotential`/`SquadPlayer.highPotential`): "these players
 * also get talked about in the media quite a bit because they are basically
 * one of the kids."
 *
 * Scoped the same deliberate way `detect/league.ts` (its immediate
 * neighbour) is: this is about the REST OF THE WORLD's high-potential
 * players — `career.leagueSquads`/`externalSquads`, never your own
 * `career.squad`, which every other detector in this folder already covers
 * on its own terms (your own breakout run already makes real news through
 * `detect/goals.ts`'s streak/haul events). A whole division can carry a
 * dozen tagged wonderkids at once; featuring all of them every single week
 * would cheapen the tag fast, so this picks AT MOST one per week, at a
 * tuned chance of firing at all — "quite a bit", not constantly.
 */

const MAX_PICKS_PER_WEEK = 1;

function clubSubject(name: string): Subject {
  return { kind: "club", name };
}

/**
 * This week's wonderkid feature, if the roll comes up and there is anyone
 * to feature. `rng` is the caller's own seeded stream (see feed.ts's
 * `generateForLeagueWeek`) — deterministic per (season, week) like every
 * other league-wide event, so a replayed week never re-rolls a different kid.
 */
export function detectWonderkidHype(
  squads: LeagueSquad[],
  week: number,
  season: number,
  rng: () => number,
  chance: number,
): FootballEvent[] {
  if (rng() >= chance) return [];

  const pool: { club: string; id: string; name: string; overall: number; age?: number }[] = [];
  for (const s of squads) {
    for (const p of s.players) {
      if (!p.highPotential) continue;
      pool.push({ club: s.club, id: p.id, name: p.name, overall: p.overall, age: p.age });
    }
  }
  if (pool.length === 0) return [];

  // Deterministic pick off the same roll that decided WHETHER to feature
  // anyone — a second rng() call, not a re-roll of the first, so "did
  // something happen" and "what happened" stay independently seeded the
  // way every other detector's own two-stage rolls do.
  const pick = pool[Math.floor(rng() * pool.length) % pool.length];

  return [ev("wonderkid-hype", clubSubject(pick.club), 30, ["rumour"], {
    club: pick.club,
    player: pick.name,
    overall: pick.overall,
    season, week,
    ...(pick.age !== undefined ? { age: pick.age } : {}),
  }, "weekly")].slice(0, MAX_PICKS_PER_WEEK);
}
