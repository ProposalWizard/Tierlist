/**
 * EVERY GOAL OF YOUR CAREER — a small record per goal, kept in the save
 * (Leo, 22 Oct 2026: "Your season in one video" and "Career goals gallery").
 *
 * Before this the save kept a season's goals only as numbers: each match's
 * GoalEvents went into the tallies and were gone. The season reel and the
 * Stats → Goals gallery both need the goals themselves, so creditMatchResult
 * adds one line per goal of yours here.
 *
 * Small on purpose: about 120 bytes a goal. The video itself never goes in
 * the save; `clipId` points at the recording on the phone that made it
 * (lib/star/goalClip/store.ts).
 *
 * Pure. Tests: tests/star/goalLog.mts.
 */
import type { CareerState, Fixture, GoalEvent, MatchStats } from "./types";

export interface CareerGoal {
  /** Unique in the career: season, fixture week, minute, order in the match. */
  id: string;
  season: number;
  /** The fixture's week (a cup round's slot, a league week). */
  week: number;
  minute: number;
  opponent: string;
  /** The club you scored for. */
  club: string;
  home: boolean;
  /** "Premier League" for a league game, else the competition's name. */
  competition: string;
  /** The final score, yours first ("3-1"). */
  score: string;
  how?: string;
  distance?: number;
  finish?: "chip" | "curl";
  assist?: string;
  clipId?: string;
}

/** The most goals the save keeps (a 25-season legend scores about 600). */
export const GOAL_LOG_MAX = 1200;

/** How a fixture's competition reads ("League" when it is a league game). */
export function competitionOf(fixture: Fixture, leagueName = "League"): string {
  if (fixture.competition) return fixture.competition;
  if (fixture.kind === "playoff") return "Play-Offs";
  return leagueName;
}

/**
 * The goal log after this match: your goals from it added on the end. Pure;
 * returns the old list untouched when you did not score. Re-crediting the
 * same match replaces its goals rather than doubling them.
 */
export function logMatchGoals(
  career: CareerState,
  fixture: Fixture,
  stats: MatchStats,
  leagueName = "League",
): CareerGoal[] | undefined {
  const mine = (stats.goalEvents ?? []).filter((e) => e.isUserGoal);
  if (mine.length === 0) return career.goalLog;
  const comp = competitionOf(fixture, leagueName);
  const key = `${career.season}:${fixture.week}:${fixture.kind ?? "league"}:${fixture.opponent}`;
  const rows: CareerGoal[] = mine.map((e: GoalEvent, i) => ({
    id: `${key}:${e.minute}:${i}`,
    season: career.season,
    week: fixture.week,
    minute: e.minute,
    opponent: fixture.opponent,
    club: career.player.club,
    home: fixture.home,
    competition: comp,
    score: `${stats.homeScore}-${stats.awayScore}`,
    ...(e.how ? { how: e.how } : {}),
    ...(typeof e.distance === "number" ? { distance: Math.round(e.distance * 10) / 10 } : {}),
    ...(e.finish ? { finish: e.finish } : {}),
    ...(e.assist ? { assist: e.assist } : {}),
    ...(e.clipId ? { clipId: e.clipId } : {}),
  }));
  const kept = (career.goalLog ?? []).filter((g) => !g.id.startsWith(`${key}:`));
  const all = [...kept, ...rows];
  return all.length > GOAL_LOG_MAX ? all.slice(all.length - GOAL_LOG_MAX) : all;
}

/** This season's goals, in the order they were scored. */
export function seasonGoals(career: CareerState, season = career.season): CareerGoal[] {
  return (career.goalLog ?? []).filter((g) => g.season === season);
}

/**
 * How special a goal is, for "best goal" picks: distance, a chip or a curler,
 * a late one, a big game. Bigger is better. Not a rating anyone sees.
 */
export function goalScore(g: CareerGoal): number {
  let s = 0;
  const d = g.distance ?? 12;
  s += Math.max(0, d - 8) * 1.6; // a 30-yard (27 m) strike: ~30
  if (g.finish === "chip") s += 9;
  if (g.finish === "curl") s += 7;
  const how = (g.how ?? "").toLowerCase();
  if (how.includes("free")) s += 10;
  if (how.includes("volley") || how.includes("bicycle") || how.includes("overhead")) s += 12;
  if (how.includes("solo") || how.includes("dribble")) s += 8;
  if (how.includes("pen")) s -= 8;
  if (g.minute >= 85) s += 6;
  const [us, them] = g.score.split("-").map(Number);
  if (Number.isFinite(us) && Number.isFinite(them) && us - them === 1) s += 4; // a goal in a one-goal win
  if (g.competition.includes("Final") || g.competition === "Champions League") s += 4;
  if (g.clipId) s += 0.5; // a tie goes to the one with a video
  return s;
}

/** The best `n` goals, best first. */
export function bestGoals(goals: readonly CareerGoal[], n = 10): CareerGoal[] {
  return [...goals].sort((a, b) => goalScore(b) - goalScore(a) || a.id.localeCompare(b.id)).slice(0, n);
}

/**
 * Recordings that must never be pruned from this phone: the season whose
 * reel has not been made yet, and the career's best 10 (they go into the
 * Hall of Fame with the career).
 */
export function protectedClipIds(career: CareerState | null | undefined): string[] {
  if (!career) return [];
  const log = career.goalLog ?? [];
  const reelPending = log.filter((g) => g.clipId && (career.reelDoneSeason ?? 0) < g.season);
  const best = bestGoals(log.filter((g) => g.clipId), 10);
  return Array.from(new Set([...reelPending, ...best].map((g) => g.clipId as string)));
}
