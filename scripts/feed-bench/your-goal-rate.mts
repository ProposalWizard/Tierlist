/**
 * How often does YOUR goal's own post carry its video? Plays N matches where
 * you score (pure media pass, no browser), with the "yourGoalVideo" flag off
 * (the 16 Oct rule) and on (Leo's 24 Oct update).
 *   npx tsx scripts/feed-bench/your-goal-rate.mts [matches=200]
 */
import { makeInitialCareer, creditMatchResult } from "../../lib/star/careerFlow";
import { generateForMatch, mediaOf } from "../../lib/star/media/feed";
import { setMediaUpdate } from "../../lib/star/media/updateFlags";
import { mulberry32 } from "../../lib/star/season";
import type { CareerState, GoalEvent, MatchStats, StarPlayer } from "../../lib/star/types";

const N = Number(process.argv[2] ?? 200);
const CLUBS = ["Arsenal", "Aston Villa", "Bournemouth", "Brentford", "Brighton", "Chelsea", "Crystal Palace", "Everton", "Fulham", "Ipswich", "Leicester", "Liverpool", "Man City", "Man United", "Newcastle", "Nottingham Forest", "Southampton", "Tottenham", "West Ham", "Wolves"];
function run(on: boolean) {
  setMediaUpdate({ yourGoalVideo: on });
  let withVideo = 0, posts = 0, matches = 0, totalVideos = 0;
  for (let seed = 0; matches < N; seed++) {
    const player: StarPlayer = { firstName: "Test", lastName: "Striker", age: 18, skinTone: "light", club: CLUBS[seed % CLUBS.length], clubBadge: null, position: "ST", nationality: "England", startYear: 2026 };
    let c: CareerState = makeInitialCareer(player, CLUBS);
    for (let m = 0; m < 10 && matches < N; m++) {
      const fixture = c.fixtures.find(f => !f.played && f.week === c.week) ?? c.fixtures.find(f => !f.played);
      if (!fixture) break;
      const rng = mulberry32(seed * 100 + m);
      const n = 1 + Math.floor(rng() * 3);
      const events: GoalEvent[] = Array.from({ length: n }, (_, i) => ({ minute: 10 + i * 25, scorer: i === 0 ? "Test Striker" : "Danny Reeves", isUserGoal: i === 0, how: "one_on_one", distance: 12, clipId: `s${seed}m${m}g${i}` }));
      const stats: MatchStats = { chances: 3, goals: 1, assists: 0, passes: 20, rating: 7.5, starMan: false, bossChange: 1, teamChange: 1, fansChange: 1, wage: 1, goalBonus: 1, sponsorPay: 0, totalCash: 2, homeScore: n, awayScore: 0, goalEvents: events, minutes: 90 };
      const before = c;
      const { career: after } = creditMatchResult(c, fixture, stats);
      after.media = generateForMatch(before, after, fixture, stats);
      const fresh = mediaOf(after).posts.filter(p => !mediaOf(before).posts.some(q => q.id === p.id));
      const yours = fresh.filter(p => p.eventId === "your-highlights");
      totalVideos += fresh.filter(p => p.graphic?.type === "goalVideo").length;
      if (yours.length) { posts++; if (yours[0].graphic?.type === "goalVideo") withVideo++; }
      matches++;
      c = after;
    }
  }
  return { matches, yourPost: posts, withVideo, pct: Math.round(100 * withVideo / Math.max(1, posts)), videosPerMatch: +(totalVideos / matches).toFixed(2) };
}
console.log("off (16 Oct rule):", JSON.stringify(run(false)));
console.log("on  (24 Oct update):", JSON.stringify(run(true)));
