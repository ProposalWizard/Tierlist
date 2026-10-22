/**
 * YOUR SEASON IN ONE VIDEO — the plan (Leo, 22 Oct 2026: "make it GREAT,
 * something players will love").
 *
 * At the end of every season, before the awards, the player sees a reel:
 *  1. a title card (club, season, the club's colours),
 *  2. every goal of the season, in order: about 3 s each, from just before
 *     the strike to just after it goes in, from the camera that suits it,
 *     with a small caption ("34' v Arsenal · FA Cup"). A big season stays
 *     at most ~95 s: past the first goals (25 at most, fewer the more there
 *     are) the rest go by quick-fire, strike to net, ~1.4 s each, a
 *     "GOAL 31 · 32 · 33" counter ticking. None is dropped.
 *  3. the goal of the season again, slowed down,
 *  4. an end card: goals, assists, average rating, trophies.
 *
 * A goal with no recording on this phone (simulated, or played on another
 * device) becomes a card with a drawn mini pitch instead, so the reel is
 * never blank.
 *
 * This file is only numbers: the order, the timings, the cards, the music's
 * loudness line. Pure; tests in tests/star/seasonReel.mts. Drawing is
 * reelRender.ts; the screen is components/star/SeasonReel.tsx.
 */
import { seasonStartYear } from "../calendar";
import type { CareerState } from "../types";
import { seasonGoals, bestGoals, type CareerGoal } from "../goalLog";
import type { ClipAngle } from "./cameras";

/** The timings the plan needs from a recording (none of its frames). */
export interface ClipTiming {
  /** Clip seconds the ball crossed the line. */
  goalT: number;
  /** Clip seconds of the strike that scored. */
  strikeT: number;
  /** The recording's length, seconds. */
  duration: number;
  /** Was it a header or a volley (the slow replay goes slower still). */
  air?: boolean;
}

/** One camera run of a recording. */
export interface ReelShot {
  angle: ClipAngle;
  /** Clip seconds. */
  from: number;
  to: number;
  /** 1 live, below 1 slow motion. */
  rate: number;
  replay: boolean;
}

export type ReelSeg =
  | { kind: "title"; at: number; dur: number }
  /** A goal: its recording (shots) or, with no recording, a card (shots empty). */
  /** `quick`: one of the quick-fire run past the first goals of a big season
   *  (strike to net only, about 1.4 s). */
  | { kind: "goal"; at: number; dur: number; goal: CareerGoal; n: number; of: number; shots: ReelShot[]; quick?: boolean }
  /** "GOAL OF THE SEASON", a beat before the replay. */
  | { kind: "bestIntro"; at: number; dur: number; goal: CareerGoal; n: number }
  /** The goal of the season again: live, then slow. A card when no recording. */
  | { kind: "best"; at: number; dur: number; goal: CareerGoal; n: number; shots: ReelShot[] }
  | { kind: "end"; at: number; dur: number };

export interface ReelStats {
  goals: number;
  assists: number;
  apps: number;
  /** 0 when no rated appearance. */
  avgRating: number;
  /** This season's trophies (competition names), in the order won. */
  trophies: string[];
}

export interface ReelPlan {
  club: string;
  player: string;
  /** "2026/27". */
  seasonLabel: string;
  season: number;
  segs: ReelSeg[];
  duration: number;
  stats: ReelStats;
  /** The goal of the season (its id), or null with no goals. */
  bestId: string | null;
}

// ── Timings ────────────────────────────────────────────────────────────────
export const TITLE_S = 3.6;
export const END_S = 6;
export const BEST_INTRO_S = 1.5;
/** The goals' part of the reel aims at this many seconds in all… */
export const GOALS_TARGET_S = 64;
/** …with each goal between these. */
export const GOAL_MIN_S = 2.4;
export const GOAL_MAX_S = 4.2;
/** Seconds kept after the ball goes in (the net ripples, the crowd goes up). */
export const AFTER_GOAL_S = 1.0;
/** A goal with no recording: its card is a little shorter than a clip. */
export const CARD_MIN_S = 2.2;
export const CARD_MAX_S = 3.0;
/** A big season: at most this many goals get their full few seconds… */
export const FULL_GOALS_MAX = 25;
/** …and the goals part of the reel stays inside this, the rest going by
 *  quick-fire (strike to net, these many seconds each). */
export const GOALS_BUDGET_S = 72;
export const QUICK_S = 1.4;
export const QUICK_MIN_S = 1.2;
export const QUICK_MAX_S = 1.6;
/** The goal of the season's slow replay. */
export const BEST_SLOW_RATE = 0.4;
export const BEST_AIR_RATE = 0.3;
/** The goal of the season with no recording: one big card. */
export const BEST_CARD_S = 3.6;

/** How long each goal gets in a season of `n` goals. */
export function perGoalSeconds(n: number): number {
  if (n <= 0) return GOAL_MAX_S;
  return Math.max(GOAL_MIN_S, Math.min(GOAL_MAX_S, GOALS_TARGET_S / n));
}

/**
 * How many of a season's `n` goals get their full moment; the rest (the
 * last ones scored) are the quick-fire run. Up to 25 goals: all of them.
 * Past that, as many as fit so the goals part stays about GOALS_BUDGET_S.
 */
export function fullGoalCount(n: number): number {
  if (n <= FULL_GOALS_MAX) return n;
  const fit = Math.floor((GOALS_BUDGET_S - n * QUICK_S) / (GOAL_MIN_S - QUICK_S));
  return Math.max(0, Math.min(FULL_GOALS_MAX, fit));
}

/** Seconds per quick-fire goal: QUICK_S, shorter only for a giant season. */
export function quickSeconds(n: number, full: number): number {
  const q = n - full;
  if (q <= 0) return QUICK_S;
  return Math.max(QUICK_MIN_S, Math.min(QUICK_S, (GOALS_BUDGET_S - full * perGoalSeconds(n)) / q));
}

/** A quick-fire goal's window: from just before the strike to just after it
 *  goes in, `len` seconds (QUICK_MIN_S..QUICK_MAX_S). */
export function quickWindow(t: ClipTiming, len: number): { from: number; to: number } {
  const to = Math.min(t.duration, t.goalT + 0.35);
  const want = Math.max(QUICK_MIN_S, Math.min(QUICK_MAX_S, to - (t.strikeT - 0.2)));
  const L = Math.max(QUICK_MIN_S, Math.min(want, len + 0.2));
  return { from: Math.max(0, to - L), to };
}

/** "2026/27" for season `season` of a career that started in `startYear`. */
export function seasonLabelOf(startYear: number, season: number): string {
  // startYear 2027 is the 2026/27 season (calendar.ts seasonStartYear).
  const y = seasonStartYear(startYear || 2027, Math.max(1, season));
  return `${y}/${String((y + 1) % 100).padStart(2, "0")}`;
}

/**
 * The camera that suits a goal in a TALL picture (the reel is 9:16). Behind
 * the net looking out is the one that fills a tall frame with football (sky
 * a sliver, the ball coming at you); the TV gantry shows the distance of a
 * long one and gives every third goal a change of view. The spider-cam
 * ("high") and the side camera put a stand across the top half of a tall
 * frame, so the reel never uses them (the goal videos still do).
 */
export function angleFor(g: CareerGoal, i: number): ClipAngle {
  const how = (g.how ?? "").toLowerCase();
  if (how.includes("header") || how.includes("pen")) return "net";
  if (how.includes("free") || how.includes("long") || (g.distance ?? 0) >= 20) return "tv";
  return i % 3 === 2 ? "tv" : "net";
}

/** The live window of a goal: `len` seconds ending AFTER_GOAL_S after it goes in. */
export function liveWindow(t: ClipTiming, len: number): { from: number; to: number } {
  const after = Math.min(AFTER_GOAL_S, Math.max(0.4, len * 0.3));
  const to = Math.min(t.duration, t.goalT + after);
  // Always start a beat before the strike, even if that runs a little long.
  const from = Math.max(0, Math.min(to - len, t.strikeT - 0.5));
  return { from, to };
}

/** The small caption under a goal: "34' v Arsenal · FA Cup". */
export function goalCaption(g: CareerGoal, shortName: (club: string) => string = (c) => c): string {
  return `${g.minute}' v ${shortName(g.opponent)} · ${g.competition}`;
}

export interface PlanInput {
  club: string;
  player: string;
  season: number;
  startYear: number;
  /** The season's goals, in the order scored. */
  goals: CareerGoal[];
  /** The recordings this phone has, by clip id. */
  timings: Record<string, ClipTiming>;
  stats: ReelStats;
}

/** The whole reel, in order, with every start time. */
export function planReel(input: PlanInput): ReelPlan {
  const goals = input.goals;
  const segs: ReelSeg[] = [];
  let at = 0;
  const push = (s: ReelSeg) => { segs.push(s); at += s.dur; };
  push({ kind: "title", at, dur: TITLE_S });

  const len = perGoalSeconds(goals.length);
  const cardLen = Math.max(CARD_MIN_S, Math.min(CARD_MAX_S, len * 0.8));
  const full = fullGoalCount(goals.length);
  const qLen = quickSeconds(goals.length, full);
  goals.forEach((g, i) => {
    const t = g.clipId ? input.timings[g.clipId] : undefined;
    if (i >= full) {
      // The quick-fire run: strike to net, the counter ticking.
      if (t && t.goalT > 0 && t.duration > 0) {
        const w = quickWindow(t, qLen);
        const shot: ReelShot = { angle: angleFor(g, i), from: w.from, to: w.to, rate: 1, replay: false };
        push({ kind: "goal", at, dur: w.to - w.from, goal: g, n: i + 1, of: goals.length, shots: [shot], quick: true });
      } else {
        push({ kind: "goal", at, dur: qLen, goal: g, n: i + 1, of: goals.length, shots: [], quick: true });
      }
      return;
    }
    if (t && t.goalT > 0 && t.duration > 0) {
      const w = liveWindow(t, len);
      const shot: ReelShot = { angle: angleFor(g, i), from: w.from, to: w.to, rate: 1, replay: false };
      push({ kind: "goal", at, dur: w.to - w.from, goal: g, n: i + 1, of: goals.length, shots: [shot] });
    } else {
      push({ kind: "goal", at, dur: cardLen, goal: g, n: i + 1, of: goals.length, shots: [] });
    }
  });

  const best = goals.length ? bestGoals(goals, 1)[0] : null;
  if (best) {
    const n = goals.indexOf(best) + 1;
    push({ kind: "bestIntro", at, dur: BEST_INTRO_S, goal: best, n });
    const t = best.clipId ? input.timings[best.clipId] : undefined;
    if (t && t.goalT > 0 && t.duration > 0) {
      const liveFrom = Math.max(0, t.strikeT - 1.4);
      const liveTo = Math.min(t.duration, t.goalT + 0.5);
      const slowFrom = Math.max(0, t.strikeT - 0.45);
      const slowTo = Math.min(t.duration, t.goalT + 0.6);
      const rate = t.air ? BEST_AIR_RATE : BEST_SLOW_RATE;
      const shots: ReelShot[] = [
        { angle: "tv", from: liveFrom, to: liveTo, rate: 1, replay: false },
        { angle: "net", from: slowFrom, to: slowTo, rate, replay: true },
      ];
      const dur = shots.reduce((a, s) => a + (s.to - s.from) / s.rate, 0);
      push({ kind: "best", at, dur, goal: best, n, shots });
    } else {
      push({ kind: "best", at, dur: BEST_CARD_S, goal: best, n, shots: [] });
    }
  }
  push({ kind: "end", at, dur: END_S });

  return {
    club: input.club,
    player: input.player,
    season: input.season,
    seasonLabel: seasonLabelOf(input.startYear, input.season),
    segs,
    duration: at,
    stats: input.stats,
    bestId: best?.id ?? null,
  };
}

/** The end card's numbers, read off a career whose season has just ended
 *  (the reel is shown BEFORE the rollover, so the tallies are still live). */
export function reelStatsOf(career: CareerState): ReelStats {
  const s = career.seasonStats;
  const season = career.season;
  const trophies = (career.trophies ?? []).filter((t) => t.season === season).map((t) => t.competition);
  return {
    goals: s?.goals ?? 0,
    assists: s?.assists ?? 0,
    apps: s?.appearances ?? 0,
    avgRating: s && s.ratingCount > 0 ? Math.round((s.totalRating / s.ratingCount) * 100) / 100 : 0,
    trophies,
  };
}

/** The plan for a career, given the timings of the recordings on this phone. */
export function planReelFor(career: CareerState, timings: Record<string, ClipTiming>, player: string): ReelPlan {
  return planReel({
    club: career.thisSeasonClub ?? career.player.club,
    player,
    season: career.season,
    startYear: career.player.startYear,
    goals: seasonGoals(career),
    timings,
    stats: reelStatsOf(career),
  });
}

/** What is on screen at reel time `t`: the segment and how far into it. */
export function segAt(plan: ReelPlan, t: number): { seg: ReelSeg; i: number; into: number } {
  const segs = plan.segs;
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    if (t < s.at + s.dur || i === segs.length - 1) return { seg: s, i, into: Math.max(0, Math.min(s.dur, t - s.at)) };
  }
  return { seg: segs[0], i: 0, into: 0 };
}

/** Within a segment's shots: which shot, and the clip time. */
export function shotAt(shots: ReelShot[], into: number): { shot: ReelShot; i: number; t: number; intoShot: number } | null {
  let acc = 0;
  for (let i = 0; i < shots.length; i++) {
    const s = shots[i];
    const len = (s.to - s.from) / s.rate;
    if (into < acc + len || i === shots.length - 1) {
      const k = Math.max(0, Math.min(len, into - acc));
      return { shot: s, i, t: s.from + k * s.rate, intoShot: k };
    }
    acc += len;
  }
  return null;
}

// ── The music bed's loudness ────────────────────────────────────────────────

/** A point on a loudness line (seconds, 0..1). */
export interface LevelPoint { at: number; gain: number }

export const MUSIC_TITLE = 0.85;
export const MUSIC_UNDER = 0.5;
export const MUSIC_DUCK = 0.42;
export const MUSIC_END = 1;
/** Under the quick-fire run the music leads (no dip per goal: 1.4 s goals
 *  would make it pump). */
export const MUSIC_MONTAGE = 0.7;

/**
 * The music's loudness line: fades in under the title, sits under the goals,
 * dips under each goal's roar (from the strike to just after it goes in),
 * stays low under the slow replay's commentary, swells on the end card and
 * fades out at the very end.
 */
export function musicLevels(plan: ReelPlan, timings: Record<string, ClipTiming>): LevelPoint[] {
  const pts: LevelPoint[] = [{ at: 0, gain: 0 }, { at: 1.6, gain: MUSIC_TITLE }];
  for (const s of plan.segs) {
    if (s.kind === "goal" && s.quick) {
      pts.push({ at: s.at, gain: MUSIC_MONTAGE }, { at: s.at + s.dur, gain: MUSIC_MONTAGE });
    } else if (s.kind === "goal") {
      pts.push({ at: s.at, gain: MUSIC_UNDER });
      const t = s.goal.clipId ? timings[s.goal.clipId] : undefined;
      const shot = s.shots[0];
      if (t && shot) {
        const strike = s.at + Math.max(0, t.strikeT - shot.from);
        const goal = s.at + Math.max(0, t.goalT - shot.from);
        pts.push({ at: Math.max(s.at, strike - 0.25), gain: MUSIC_UNDER });
        pts.push({ at: Math.max(s.at, strike), gain: MUSIC_DUCK });
        pts.push({ at: Math.min(s.at + s.dur, goal + 0.7), gain: MUSIC_DUCK });
        pts.push({ at: s.at + s.dur, gain: MUSIC_UNDER });
      } else {
        pts.push({ at: s.at + s.dur, gain: MUSIC_UNDER });
      }
    } else if (s.kind === "bestIntro") {
      pts.push({ at: s.at, gain: MUSIC_UNDER });
      pts.push({ at: s.at + s.dur * 0.5, gain: MUSIC_TITLE });
      pts.push({ at: s.at + s.dur, gain: MUSIC_TITLE });
    } else if (s.kind === "best") {
      pts.push({ at: s.at + 0.3, gain: s.shots.length ? MUSIC_DUCK : MUSIC_UNDER });
      pts.push({ at: s.at + s.dur, gain: s.shots.length ? MUSIC_DUCK : MUSIC_UNDER });
    } else if (s.kind === "end") {
      pts.push({ at: s.at + 0.8, gain: MUSIC_END });
      pts.push({ at: Math.max(s.at + 0.8, s.at + s.dur - 1.4), gain: MUSIC_END });
      pts.push({ at: s.at + s.dur, gain: 0 });
    }
  }
  pts.sort((a, b) => a.at - b.at);
  return pts;
}

/** The track the reel plays: a winning season's anthem, or the lobby's
 *  calmer one when there is nothing to celebrate. */
export function reelMusicFor(plan: ReelPlan): "03-winning" | "10-good-spell" | "08-lobby" {
  if (plan.stats.goals === 0 && plan.stats.trophies.length === 0) return "08-lobby";
  return plan.stats.trophies.length > 0 ? "03-winning" : "10-good-spell";
}

/** A kind line for the end card. */
export function endLine(plan: ReelPlan): string {
  const g = plan.stats.goals;
  if (plan.stats.trophies.length > 0) return "Silverware. Remember this one.";
  if (g === 0) return "No goals this time. Next season is yours.";
  if (g >= 30) return "A season people will talk about for years.";
  if (g >= 15) return "What a season.";
  return "Onwards. Next season, more.";
}
