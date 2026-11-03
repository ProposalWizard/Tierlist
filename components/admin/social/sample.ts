/**
 * A sample career for the Social Studio when this device has none: six league
 * matches through the real media pass, so the feed has something in it.
 */
import { makeInitialCareer, creditMatchResult } from "@/lib/star/careerFlow";
import { generateForMatch, generateForLeagueWeek } from "@/lib/star/media/feed";
import { mulberry32 } from "@/lib/star/season";
import { PREMIER_LEAGUE_CLUBS } from "@/lib/star/clubs";
import type { CareerState, GoalEvent, MatchStats, StarPlayer } from "@/lib/star/types";

export function sampleCareer(matches = 6): CareerState {
  const player: StarPlayer = {
    firstName: "Sam", lastName: "Studio", age: 18, skinTone: "light",
    club: "Arsenal", clubBadge: null, position: "ST", nationality: "England", startYear: 2026,
  };
  let c: CareerState = makeInitialCareer(player, [...PREMIER_LEAGUE_CLUBS]);
  for (let m = 0; m < matches; m++) {
    const fixture = c.fixtures.find(f => !f.played && f.week === c.week) ?? c.fixtures.find(f => !f.played);
    if (!fixture) break;
    const rng = mulberry32(500 + m);
    const k = 1 + Math.floor(rng() * 3);
    const events: GoalEvent[] = [];
    for (let i = 0; i < k; i++) {
      const mine = rng() < 0.6;
      events.push({ minute: 8 + i * 22 + Math.floor(rng() * 12), scorer: mine ? "Sam Studio" : "Danny Reeves", isUserGoal: mine, how: mine && rng() < 0.3 ? "long_range" : "one_on_one", distance: 10 + Math.floor(rng() * 20) });
    }
    const goals = events.filter(e => e.isUserGoal).length;
    const stats: MatchStats = {
      chances: 4, goals, assists: 0, passes: 25, rating: 6.8 + goals * 0.6, starMan: goals >= 2,
      bossChange: 1, teamChange: 1, fansChange: 1, wage: 1, goalBonus: goals, sponsorPay: 0, totalCash: 2,
      homeScore: k, awayScore: Math.floor(rng() * 2), goalEvents: events, minutes: 90,
    };
    const before = c;
    const { career: after } = creditMatchResult(c, fixture, stats);
    after.media = generateForMatch(before, after, fixture, stats);
    const rest = (after.results ?? []).filter(r => r.week === fixture.week && r.home !== player.club && r.away !== player.club);
    if (rest.length) after.media = generateForLeagueWeek({ ...after }, rest);
    c = after;
  }
  return c;
}
