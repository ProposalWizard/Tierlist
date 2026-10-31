/**
 * A seeded career run through the real media pass, for the Football Twitter
 * feed (Leo's switch part "footballTwitter"). Used by
 * tests/star/footballTwitter.mts (the flag-off fingerprint) and by dump.mts
 * (the text dump read by eye). Nothing here touches the browser.
 *
 *   npx tsx scripts/football-twitter/dump.mts [on|off] [matches] > out.txt
 */
import { createHash } from "node:crypto";
import { makeInitialCareer, creditMatchResult, advanceSeason } from "../../lib/star/careerFlow";
import { generateForMatch, generateForLeagueWeek, generateForCareer, feedFor, mediaOf } from "../../lib/star/media/feed";
import { mulberry32 } from "../../lib/star/season";
import type { CareerState, GoalEvent, MatchStats, StarPlayer } from "../../lib/star/types";

export const CLUBS = [
  "Arsenal", "Aston Villa", "Bournemouth", "Brentford", "Brighton", "Chelsea",
  "Crystal Palace", "Everton", "Fulham", "Ipswich", "Leicester", "Liverpool",
  "Man City", "Man United", "Newcastle", "Nottingham Forest", "Southampton",
  "Tottenham", "West Ham", "Wolves",
];

export const PLAYER: StarPlayer = {
  firstName: "Test", lastName: "Striker", age: 18, skinTone: "light",
  club: "Arsenal", clubBadge: null, position: "ST", nationality: "England", startYear: 2026,
};

const HOWS = ["one_on_one", "long_range", "header", "volley", "penalty", "tight_angle"] as const;

/** Plays `n` matches (wins, draws, heavy defeats, braces, blanks) plus the
 *  rest of the league each week, and one transfer moment half way. */
export function seededRun(n = 14, seed = 4242): CareerState {
  let c = makeInitialCareer(PLAYER, CLUBS);
  for (let m = 0; m < n; m++) {
    const fixture = c.fixtures.find(f => !f.played && f.week === c.week) ?? c.fixtures.find(f => !f.played);
    if (!fixture) break;
    const rng = mulberry32(seed + m * 31);
    const shape = m % 5; // 0 big win, 1 narrow win, 2 loss, 3 draw, 4 hammered
    const us = shape === 0 ? 3 + Math.floor(rng() * 2) : shape === 1 ? 2 : shape === 2 ? 1 : shape === 3 ? 1 : 0;
    const them = shape === 0 ? Math.floor(rng() * 2) : shape === 1 ? 1 : shape === 2 ? 2 : shape === 3 ? 1 : 4;
    const mineCount = shape === 0 ? Math.min(us, 2 + (m % 2)) : shape === 1 ? 1 : shape === 3 ? (m % 2) : 0;
    const events: GoalEvent[] = [];
    for (let i = 0; i < us; i++) {
      const mine = i < mineCount;
      events.push({
        minute: shape === 1 && i === us - 1 ? 89 : 8 + i * 19 + Math.floor(rng() * 12),
        scorer: mine ? "Test Striker" : "Danny Reeves", isUserGoal: mine,
        how: HOWS[Math.floor(rng() * HOWS.length)], distance: 8 + Math.floor(rng() * 22),
      });
    }
    const goals = events.filter(e => e.isUserGoal).length;
    const rating = shape === 4 ? 4.9 : shape === 2 ? 5.8 : Math.round((6.6 + goals * 0.8 + rng() * 0.6) * 10) / 10;
    const stats: MatchStats = {
      chances: 4, goals, assists: shape === 0 ? 1 : 0, passes: 25, rating, starMan: goals >= 2,
      bossChange: 1, teamChange: 1, fansChange: 1, wage: 1, goalBonus: goals, sponsorPay: 0, totalCash: 2,
      homeScore: us, awayScore: them, goalEvents: events, minutes: 90,
    };
    const before = c;
    const { career: after } = creditMatchResult(c, fixture, stats);
    after.media = generateForMatch(before, after, fixture, stats);
    const rest = (after.results ?? []).filter(r => r.week === fixture.week && r.home !== PLAYER.club && r.away !== PLAYER.club);
    if (rest.length) after.media = generateForLeagueWeek({ ...after }, rest);
    c = after;
    if (m === Math.floor(n / 2)) {
      c = { ...c, media: generateForCareer(c, { kind: "award", award: "Player of the Month", detail: "September", won: true }, "potm-test") };
    }
  }
  return c;
}

/**
 * Several whole seasons (every fixture, then advanceSeason), with about half
 * of your goals "recorded" (a clipId, as the real match gives) so both kinds
 * of goal video are made. For the video-rule test and the long dumps.
 */
export function seasonsRun(seasons = 2, seed = 4242, onStep?: (c: CareerState) => void): CareerState {
  let c = makeInitialCareer(PLAYER, CLUBS);
  let m = 0;
  for (let s = 0; s < seasons; s++) {
    for (let guard = 0; guard < 80; guard++) {
      const fixture = c.fixtures.find(f => !f.played && f.week === c.week) ?? c.fixtures.find(f => !f.played);
      if (!fixture) break;
      const rng = mulberry32(seed + m * 31);
      const roll = rng();
      const us = roll < 0.12 ? 0 : roll < 0.45 ? 1 : roll < 0.75 ? 2 : roll < 0.92 ? 3 : 5;
      const them = Math.floor(rng() * (roll < 0.12 ? 5 : 3));
      const events: GoalEvent[] = [];
      for (let i = 0; i < us; i++) {
        const mine = rng() < 0.45;
        events.push({
          minute: Math.min(90, 6 + i * 17 + Math.floor(rng() * 16)),
          scorer: mine ? "Test Striker" : "Danny Reeves", isUserGoal: mine,
          how: HOWS[Math.floor(rng() * HOWS.length)], distance: 8 + Math.floor(rng() * 24),
          ...(mine && rng() < 0.5 ? { clipId: `rec-${s}-${m}-${i}` } : {}),
        });
      }
      const goals = events.filter(e => e.isUserGoal).length;
      const rating = Math.round(Math.max(4.6, Math.min(9.8, 5.6 + goals * 0.9 + (us - them) * 0.2 + rng() * 1.2)) * 10) / 10;
      const stats: MatchStats = {
        chances: 4, goals, assists: rng() < 0.2 ? 1 : 0, passes: 25, rating, starMan: rating >= 8,
        bossChange: 1, teamChange: 1, fansChange: 1, wage: 1, goalBonus: goals, sponsorPay: 0, totalCash: 2,
        homeScore: us, awayScore: them, goalEvents: events, minutes: rng() < 0.1 ? 60 : 90,
      };
      const before = c;
      const { career: after } = creditMatchResult(c, fixture, stats);
      after.media = generateForMatch(before, after, fixture, stats);
      const rest = (after.results ?? []).filter(r => r.week === fixture.week && r.home !== PLAYER.club && r.away !== PLAYER.club);
      if (rest.length) after.media = generateForLeagueWeek({ ...after }, rest);
      c = after;
      m++;
      onStep?.(c);
      if (m % 9 === 4) { c = { ...c, media: generateForCareer(c, { kind: "award", award: "Player of the Month", detail: "the month", won: true }, `potm-${m}`) }; onStep?.(c); }
      if (m % 23 === 11) { c = { ...c, media: generateForCareer(c, { kind: "manager-out", name: "Graham Pell", incoming: "Luis Moreda", reason: "results" }, `mgr-${m}`) }; onStep?.(c); }
    }
    if (s < seasons - 1) {
      const media = c.media;
      c = advanceSeason(c, false).career;
      c = { ...c, media: c.media ?? media };
    }
  }
  return c;
}

/** seededRun, then the off-the-pitch moments: a contract, the manager
 *  sacked, a transfer to another club. For the dump and its checks. */
export function richRun(n = 14, seed = 4242): CareerState {
  let c = seededRun(n, seed);
  c = { ...c, media: generateForCareer(c, { kind: "contract", club: c.player.club, wage: 90_000, seasons: 4 }, "ft-contract") };
  c = { ...c, week: c.week + 1 };
  c = { ...c, media: generateForCareer(c, { kind: "manager-out", name: "Graham Pell", incoming: "Luis Moreda", reason: "results" }, "ft-sack") };
  c = { ...c, week: c.week + 1 };
  c = { ...c, media: generateForCareer(c, { kind: "transfer", from: c.player.club, to: "Chelsea", fee: 68_000_000 }, "ft-move") };
  return c;
}

/** Everything the feed makes and shows, as one string. */
export function fingerprintText(c: CareerState): string {
  const m = mediaOf(c);
  return JSON.stringify({
    posts: m.posts, trends: m.trends, memory: m.memory,
    settled: feedFor(c, "settled").posts.map(p => p.id),
    moment: feedFor(c, "moment").posts.map(p => p.id),
  });
}

export function fingerprint(c: CareerState): string {
  return createHash("sha256").update(fingerprintText(c)).digest("hex");
}
