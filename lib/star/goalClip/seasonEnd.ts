/**
 * A BETTER END OF SEASON (Leo, 31 Oct 2026: "also do end of szn stuff
 * better, i see some lost clips, also u should be able to tap to skip a
 * goal, also u should be able to save which goals u want"). Leo's update part
 * "seasonEnd"; off, the season video plans exactly as reel.ts planReelFor.
 *
 * WHY CLIPS WERE LOST. A goal reaches the reel as a CareerGoal; its video is
 * the recording `clipId` points at, on this phone. Goals whose recording was
 * not here (a match you simulated, a goal the recorder was not running for,
 * a recording made on your other phone, one pruned or unreadable) became a
 * drawn card. And the recordings were read with a 2.5 s cap: when the read
 * came in late it REPLACED the plan the reel had already started on, so the
 * goals moved under the clock and some flashed by or were never seen.
 *
 * The fix, here and in components/star/SeasonReel.tsx:
 *  - every goal gets a video: its recording, or a stand-in made from the
 *    goal's own facts (goalClip/synth.ts, seeded by the goal's id so it is
 *    the same every time), never a blank;
 *  - each goal once, in the order scored (a goal logged twice plays once);
 *  - the plan is made once from the first answer and never swapped mid-play.
 *
 * Also here: milestone chapter cards (first goal, hat-trick, career goal
 * 10/25/50/100…), the Goal of the Season picked from your ⭐ favourites,
 * then the fans' Goal of the Month votes, then the game's own pick; the
 * favourites reel; and the "stops" the tap-to-skip jumps between.
 *
 * Pure. Tests: tests/star/seasonEnd.mts.
 */
import type { CareerState } from "../types";
import { bestGoals, goalScore, seasonGoals, type CareerGoal } from "../goalLog";
import { favouriteGoals } from "../favouriteGoals";
import { synthKindFor } from "../media/detect/goalOfMonth";
import type { SynthGoal } from "./synth";
import {
  BEST_AIR_RATE, BEST_CARD_S, BEST_INTRO_S, BEST_SLOW_RATE, CARD_MAX_S, CARD_MIN_S, END_S, TITLE_S,
  angleFor, fullGoalCount, liveWindow, perGoalSeconds, quickSeconds, quickWindow, reelStatsOf, seasonLabelOf,
  type ClipTiming, type ReelBetter, type ReelPlan, type ReelSeg, type ReelShot, type ReelStats,
} from "./reel";

/** A milestone card's length: a beat, quick to tap past. */
export const CHAPTER_S = 1.3;
/** At most this many chapter cards in one reel. */
export const CHAPTERS_MAX = 6;
/** Career goal numbers that get a card. */
export const CAREER_MILESTONES = [10, 25, 50, 75, 100, 150, 200, 250, 300, 400, 500, 600, 700, 800, 900, 1000];

// ── Every goal once ─────────────────────────────────────────────────────────

/** The goals, each once (first time it was logged), in the order given. */
export function reelGoalsOf(goals: readonly CareerGoal[]): CareerGoal[] {
  const seen = new Set<string>();
  const out: CareerGoal[] = [];
  for (const g of goals) {
    if (seen.has(g.id)) continue;
    seen.add(g.id);
    out.push(g);
  }
  return out;
}

/** The key a goal's stand-in video is kept under in the reel's tracks. */
export function standInKey(g: CareerGoal): string {
  return `standin:${g.id}`;
}

/** A usable recording: one whose goal and strike are inside it. */
export function usableTiming(t: ClipTiming | undefined): boolean {
  return !!t && t.duration > 0 && t.goalT > 0 && t.goalT <= t.duration + 0.05;
}

/** Does this goal need a stand-in (no recording here, or a broken one)? */
export function needsStandIn(g: CareerGoal, timings: Record<string, ClipTiming>): boolean {
  return !g.clipId || !usableTiming(timings[g.clipId]);
}

/** The stand-in's recipe: the goal's own match, minute, score and kind,
 *  seeded by its id (the same goal always looks the same). */
export function standInFor(g: CareerGoal, scorer: string, scorerShort: string): SynthGoal {
  const [us, them] = g.score.split("-").map((x) => Number(x));
  const known = Number.isFinite(us) && Number.isFinite(them);
  return {
    home: g.home ? g.club : g.opponent,
    away: g.home ? g.opponent : g.club,
    scorer, scorerShort,
    scorerHome: g.home,
    minute: g.minute,
    ...(known ? { scoreAfter: (g.home ? [us, them] : [them, us]) as [number, number] } : {}),
    competition: g.competition,
    season: g.season,
    week: g.week,
    seed: `reel-standin:${g.id}`,
    kind: synthKindFor(g.how),
  };
}

/**
 * The goals as the reel plays them: a goal without a usable recording points
 * at its stand-in (standInKey) when `made` has one. The originals are not
 * changed (the best-goal pick still reads the real ones).
 */
export function withStandIns(goals: readonly CareerGoal[], timings: Record<string, ClipTiming>, made: ReadonlySet<string>): CareerGoal[] {
  return goals.map((g) => {
    if (!needsStandIn(g, timings)) return g;
    const key = standInKey(g);
    return made.has(key) ? { ...g, clipId: key } : g;
  });
}

// ── Votes and the goal of the season ────────────────────────────────────────

interface PollLike {
  type?: string;
  entries?: { isYou?: boolean; clipId?: string; synth?: { season?: number; week?: number; minute?: number } }[];
  fanVotes?: number[];
  userVote?: number;
  userWeight?: number;
  closed?: boolean;
  winner?: number;
}

/** The fans' Goal of the Month votes for your goals, by goal id (a win adds 1000). */
export function gotmVotesOf(career: CareerState): Record<string, number> {
  const out: Record<string, number> = {};
  const log = career.goalLog ?? [];
  for (const p of career.media?.posts ?? []) {
    const g = p.graphic as PollLike | undefined;
    if (!g || g.type !== "gotmPoll" || !Array.isArray(g.entries)) continue;
    g.entries.forEach((e, i) => {
      if (!e?.isYou) return;
      const goal = e.clipId
        ? log.find((x) => x.clipId === e.clipId)
        : e.synth ? log.find((x) => x.season === e.synth!.season && x.week === e.synth!.week && x.minute === e.synth!.minute) : undefined;
      if (!goal) return;
      const votes = (g.fanVotes?.[i] ?? 0) + (g.userVote === i ? g.userWeight ?? 0 : 0) + (g.closed && g.winner === i ? 1000 : 0);
      out[goal.id] = Math.max(out[goal.id] ?? 0, votes);
    });
  }
  return out;
}

/**
 * The Goal of the Season: your favourite of the season (the fans' votes then
 * the game's score settle two), else the goal the fans voted for most (a
 * Goal of the Month win first), else the game's own pick (bestGoals).
 */
export function goalOfSeason(
  goals: readonly CareerGoal[], favs: ReadonlySet<string>, votes: Record<string, number>,
): { goal: CareerGoal; why: "pick" | "votes" | "best" } | null {
  if (!goals.length) return null;
  const rank = (a: CareerGoal, b: CareerGoal) => (votes[b.id] ?? 0) - (votes[a.id] ?? 0) || goalScore(b) - goalScore(a) || a.id.localeCompare(b.id);
  const picked = goals.filter((g) => favs.has(g.id)).sort(rank);
  if (picked.length) return { goal: picked[0], why: "pick" };
  const voted = goals.filter((g) => (votes[g.id] ?? 0) > 0).sort(rank);
  if (voted.length) return { goal: voted[0], why: "votes" };
  return { goal: bestGoals(goals, 1)[0], why: "best" };
}

// ── Milestones ──────────────────────────────────────────────────────────────

const ordinal = (n: number) => {
  const t = n % 100;
  if (t >= 11 && t <= 13) return `${n}TH`;
  return `${n}${n % 10 === 1 ? "ST" : n % 10 === 2 ? "ND" : n % 10 === 3 ? "RD" : "TH"}`;
};

/** The match a goal was scored in (its id without minute and order). */
export function matchKeyOf(g: CareerGoal): string {
  return g.id.split(":").slice(0, -2).join(":") || g.id;
}

/**
 * The chapter cards, by goal id: a career milestone (10th, 25th, 50th…
 * career goal), a hat-trick (on its third goal), the first goal of the
 * season (your first ever, when it is). One card per goal, the biggest.
 */
export function chaptersFor(goals: readonly CareerGoal[], careerGoalsBefore: number, shortName: (c: string) => string = (c) => c): Map<string, { title: string; sub: string }> {
  const out = new Map<string, { title: string; sub: string }>();
  const perMatch = new Map<string, number>();
  goals.forEach((g, i) => {
    const k = matchKeyOf(g);
    const inMatch = (perMatch.get(k) ?? 0) + 1;
    perMatch.set(k, inMatch);
    const careerN = careerGoalsBefore + i + 1;
    if (CAREER_MILESTONES.includes(careerN) && careerN > 1) out.set(g.id, { title: `${ordinal(careerN)} CAREER GOAL`, sub: `v ${shortName(g.opponent)}` });
    else if (inMatch === 3) out.set(g.id, { title: "HAT-TRICK", sub: `v ${shortName(g.opponent)} · ${g.competition}` });
    else if (i === 0) out.set(g.id, careerGoalsBefore === 0 ? { title: "FIRST CAREER GOAL", sub: "Where it all starts" } : { title: "FIRST GOAL", sub: "of the season" });
  });
  return out;
}

// ── The plan ────────────────────────────────────────────────────────────────

export interface BetterPlanInput {
  mode: "season" | "favourites";
  club: string;
  player: string;
  season: number;
  startYear: number;
  /** The goals in the order scored, each pointing at the video the reel
   *  plays (withStandIns). */
  goals: CareerGoal[];
  /** The same goals as logged (for the best pick and the chapters). */
  logged?: CareerGoal[];
  timings: Record<string, ClipTiming>;
  stats: ReelStats;
  favourites: ReadonlySet<string>;
  votes?: Record<string, number>;
  /** Your career goals before this season (the milestone numbers). */
  careerGoalsBefore?: number;
  /** End-card tiles for the favourites reel. */
  tiles?: [string, string][];
  shortName?: (c: string) => string;
}

/** The better reel, in order, with every start time. */
export function planSeasonEnd(input: BetterPlanInput): ReelPlan {
  const goals = reelGoalsOf(input.goals);
  const logged = reelGoalsOf(input.logged ?? input.goals);
  const segs: ReelSeg[] = [];
  let at = 0;
  const push = (s: ReelSeg) => { segs.push(s); at += s.dur; };
  push({ kind: "title", at, dur: TITLE_S });

  const len = perGoalSeconds(goals.length);
  const cardLen = Math.max(CARD_MIN_S, Math.min(CARD_MAX_S, len * 0.8));
  const full = fullGoalCount(goals.length);
  const qLen = quickSeconds(goals.length, full);
  const chapters = input.mode === "season" ? chaptersFor(logged, input.careerGoalsBefore ?? 0, input.shortName) : new Map();
  let chapterCount = 0;
  goals.forEach((g, i) => {
    const t = g.clipId ? input.timings[g.clipId] : undefined;
    const ch = chapters.get(g.id);
    if (ch && i < full && chapterCount < CHAPTERS_MAX) {
      chapterCount++;
      push({ kind: "chapter", at, dur: CHAPTER_S, goal: g, n: i + 1, title: ch.title, sub: ch.sub });
    }
    if (i >= full) {
      if (usableTiming(t)) {
        const w = quickWindow(t!, qLen);
        push({ kind: "goal", at, dur: w.to - w.from, goal: g, n: i + 1, of: goals.length, shots: [{ angle: angleFor(g, i), from: w.from, to: w.to, rate: 1, replay: false }], quick: true });
      } else {
        push({ kind: "goal", at, dur: qLen, goal: g, n: i + 1, of: goals.length, shots: [], quick: true });
      }
      return;
    }
    if (usableTiming(t)) {
      const w = liveWindow(t!, len);
      push({ kind: "goal", at, dur: w.to - w.from, goal: g, n: i + 1, of: goals.length, shots: [{ angle: angleFor(g, i), from: w.from, to: w.to, rate: 1, replay: false }] });
    } else {
      push({ kind: "goal", at, dur: cardLen, goal: g, n: i + 1, of: goals.length, shots: [] });
    }
  });

  const pick = input.mode === "season" ? goalOfSeason(logged, input.favourites, input.votes ?? {}) : null;
  if (pick) {
    const n = logged.findIndex((g) => g.id === pick.goal.id) + 1;
    const best = goals[n - 1] ?? pick.goal; // the one that points at its video
    push({ kind: "bestIntro", at, dur: BEST_INTRO_S, goal: best, n });
    const t = best.clipId ? input.timings[best.clipId] : undefined;
    if (usableTiming(t)) {
      const shots: ReelShot[] = [
        { angle: "tv", from: Math.max(0, t!.strikeT - 1.4), to: Math.min(t!.duration, t!.goalT + 0.5), rate: 1, replay: false },
        { angle: "net", from: Math.max(0, t!.strikeT - 0.45), to: Math.min(t!.duration, t!.goalT + 0.6), rate: t!.air ? BEST_AIR_RATE : BEST_SLOW_RATE, replay: true },
      ];
      push({ kind: "best", at, dur: shots.reduce((a, s) => a + (s.to - s.from) / s.rate, 0), goal: best, n, shots });
    } else {
      push({ kind: "best", at, dur: BEST_CARD_S, goal: best, n, shots: [] });
    }
  }
  push({ kind: "end", at, dur: END_S });

  const better: ReelBetter = {
    mode: input.mode,
    heading: input.mode === "favourites" ? "MY FAVOURITE" : "YOUR SEASON",
    favCount: goals.filter((g) => input.favourites.has(g.id)).length,
    ...(pick ? { bestWhy: pick.why } : {}),
    ...(input.tiles ? { tiles: input.tiles } : {}),
  };
  return {
    club: input.club,
    player: input.player,
    season: input.season,
    seasonLabel: input.mode === "favourites" ? "GOALS" : seasonLabelOf(input.startYear, input.season),
    segs,
    duration: at,
    stats: input.stats,
    bestId: pick?.goal.id ?? null,
    better,
  };
}

/** The goals a career's reel plays: this season's, or your favourites. */
export function betterReelGoals(career: CareerState, mode: "season" | "favourites"): CareerGoal[] {
  return reelGoalsOf(mode === "favourites" ? favouriteGoals(career) : seasonGoals(career));
}

/** The favourites reel's end card: favourites, seasons, longest, career goals. */
export function favouriteTiles(career: CareerState, goals: readonly CareerGoal[]): [string, string][] {
  const seasons = new Set(goals.map((g) => g.season)).size;
  const longest = goals.reduce((m, g) => Math.max(m, g.distance ?? 0), 0);
  return [
    ["FAVOURITES", String(goals.length)],
    ["SEASONS", String(seasons)],
    ["LONGEST", longest > 0 ? `${Math.round(longest)}M` : "–"],
    ["CAREER GOALS", String((career.goalLog ?? []).length)],
  ];
}

/** The plan for a career (the screen's one call): `videoGoals` already point
 *  at their stand-ins where needed. */
export function planSeasonEndFor(
  career: CareerState, mode: "season" | "favourites", videoGoals: CareerGoal[], timings: Record<string, ClipTiming>,
  player: string, favourites: ReadonlySet<string>, shortName?: (c: string) => string,
): ReelPlan {
  const logged = betterReelGoals(career, mode);
  const before = (career.goalLog ?? []).filter((g) => g.season < career.season).length;
  const stats = mode === "favourites"
    ? { goals: logged.length, assists: logged.filter((g) => !!g.assist).length, apps: 0, avgRating: 0, trophies: [] }
    : reelStatsOf(career);
  return planSeasonEnd({
    mode, club: career.thisSeasonClub ?? career.player.club, player, season: career.season, startYear: career.player.startYear,
    goals: videoGoals, logged, timings, stats, favourites, votes: mode === "season" ? gotmVotesOf(career) : {},
    careerGoalsBefore: before, ...(mode === "favourites" ? { tiles: favouriteTiles(career, logged) } : {}),
    ...(shortName ? { shortName } : {}),
  });
}

// ── Tap to skip ─────────────────────────────────────────────────────────────

/** One step of the reel the taps jump between: the title, each goal (with
 *  its chapter card), the goal of the season, the end card. */
export interface ReelStop {
  at: number;
  end: number;
  kind: "title" | "goal" | "best" | "end";
  /** The goal on screen (its id as logged, stand-ins mapped back). */
  goalId?: string;
}

export function reelStops(plan: ReelPlan): ReelStop[] {
  const out: ReelStop[] = [];
  let pendingChapter: number | null = null;
  for (const s of plan.segs) {
    if (s.kind === "chapter") { pendingChapter = s.at; continue; }
    if (s.kind === "best") { const last = out[out.length - 1]; if (last?.kind === "best") { last.end = s.at + s.dur; continue; } }
    const kind: ReelStop["kind"] = s.kind === "bestIntro" || s.kind === "best" ? "best" : s.kind === "goal" ? "goal" : s.kind;
    const at = pendingChapter ?? s.at;
    pendingChapter = null;
    out.push({ at, end: s.at + s.dur, kind, ...("goal" in s ? { goalId: s.goal.id } : {}) });
  }
  return out;
}

/** Which stop reel time `t` is in. */
export function stopIndexAt(stops: readonly ReelStop[], t: number): number {
  for (let i = 0; i < stops.length; i++) if (t < stops[i].end) return i;
  return Math.max(0, stops.length - 1);
}

/** Tap right: the start of the next stop (null when on the last one). */
export function nextStopAt(stops: readonly ReelStop[], t: number): number | null {
  const i = stopIndexAt(stops, t);
  return i + 1 < stops.length ? stops[i + 1].at : null;
}

/** Tap left: back to the start of this goal, or the one before when already
 *  near its start (stories-style). */
export function prevStopAt(stops: readonly ReelStop[], t: number, grace = 0.8): number {
  const i = stopIndexAt(stops, t);
  if (t - stops[i].at > grace || i === 0) return stops[i].at;
  return stops[i - 1].at;
}
