/**
 * FEED BENCH — SEED. Builds a career that has played N league matches, with a
 * full social feed (your goals recorded, other matches' made goals), and
 * writes it as JSON for measure.mjs to load into the browser.
 *
 *   npx tsx scripts/feed-bench/seed.mts [matches=20] [out=/tmp/feed-seed.json]
 *
 * Recorded goals reuse the two real recordings in tests/star/fixtures/goalClips
 * under new ids, so every video is drawn from a real 22-man recording.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { makeInitialCareer, creditMatchResult } from "../../lib/star/careerFlow";
import { generateForMatch, generateForLeagueWeek, mediaOf } from "../../lib/star/media/feed";
import { mulberry32 } from "../../lib/star/season";
import type { CareerState, GoalEvent, MatchStats, StarPlayer } from "../../lib/star/types";

const N = Number(process.argv[2] ?? 20);
const OUT = process.argv[3] ?? "/tmp/feed-seed.json";
const CLUBS = [
  "Arsenal", "Aston Villa", "Bournemouth", "Brentford", "Brighton", "Chelsea",
  "Crystal Palace", "Everton", "Fulham", "Ipswich", "Leicester", "Liverpool",
  "Man City", "Man United", "Newcastle", "Nottingham Forest", "Southampton",
  "Tottenham", "West Ham", "Wolves",
];
const player: StarPlayer = {
  firstName: "Test", lastName: "Striker", age: 18, skinTone: "light",
  club: "Arsenal", clubBadge: null, position: "ST", nationality: "England", startYear: 2026,
};
let c: CareerState = makeInitialCareer(player, CLUBS);
const templates = ["scramble.json", "lay-off.json"].map(f =>
  JSON.parse(readFileSync(new URL(`../../tests/star/fixtures/goalClips/${f}`, import.meta.url), "utf8")));
const clips: { id: string; createdAt: string; track: unknown }[] = [];
let made = 0;
for (let m = 0; m < N; m++) {
  const fixture = c.fixtures.find(f => !f.played && f.week === c.week) ?? c.fixtures.find(f => !f.played);
  if (!fixture) break;
  const rng = mulberry32(100 + m);
  const n = 1 + Math.floor(rng() * 4);
  const events: GoalEvent[] = [];
  for (let i = 0; i < n; i++) {
    const id = `bench-m${m}-g${i}`;
    const mine = rng() < 0.6;
    events.push({
      minute: 5 + i * 20 + Math.floor(rng() * 15), scorer: mine ? "Test Striker" : "Danny Reeves",
      isUserGoal: mine, how: "one_on_one", distance: 10 + Math.floor(rng() * 15), clipId: id,
    });
    const t = templates[(m + i) % 2];
    const createdAt = new Date(Date.UTC(2026, 9, 1, 0, made++)).toISOString();
    clips.push({ id, createdAt, track: { ...t, meta: { ...t.meta, id, createdAt, minute: events[i].minute } } });
  }
  const goals = events.filter(e => e.isUserGoal).length;
  const stats: MatchStats = {
    chances: 4, goals, assists: 0, passes: 25, rating: 7.4, starMan: goals >= 2,
    bossChange: 1, teamChange: 1, fansChange: 1, wage: 1, goalBonus: goals, sponsorPay: 0, totalCash: 2,
    homeScore: n, awayScore: Math.floor(rng() * 2), goalEvents: events, minutes: 90,
  };
  const before = c;
  const { career: after } = creditMatchResult(c, fixture, stats);
  after.media = generateForMatch(before, after, fixture, stats);
  const rest = (after.results ?? []).filter(r => r.week === fixture.week && r.home !== player.club && r.away !== player.club);
  if (rest.length) after.media = generateForLeagueWeek({ ...after }, rest);
  c = after;
}
// No first-time tours or locks in the way of the bench.
delete (c as { unlocks?: unknown }).unlocks;
const posts = mediaOf(c).posts;
const vids = posts.filter(p => p.graphic && ("clips" in p.graphic) && (((p.graphic as { clips?: unknown[] }).clips?.length ?? 0) + (((p.graphic as { synth?: unknown[] }).synth?.length) ?? 0)) > 0);
writeFileSync(OUT, JSON.stringify({ career: c, clips }));
console.log(`matches ${N} · posts ${posts.length} · with video ${vids.length} · recordings ${clips.length} · week ${c.week} → ${OUT}`);
