import {
  planReel, perGoalSeconds, musicLevels, segAt, shotAt, seasonLabelOf, goalCaption, reelMusicFor,
  fullGoalCount, angleFor, FULL_GOALS_MAX, MUSIC_DUCK, QUICK_MIN_S, QUICK_MAX_S,
  type ClipTiming, type PlanInput,
} from "../../lib/star/goalClip/reel";
import { bestGoals, type CareerGoal } from "../../lib/star/goalLog";

/**
 * YOUR SEASON IN ONE VIDEO — the plan (lib/star/goalClip/reel.ts).
 *
 *  - Goals play in the order scored, after the title, before the best goal
 *    and the end card.
 *  - A 20-goal season with every recording runs 60–90 s.
 *  - The goal of the season is bestGoals' pick, and it is in the reel.
 *  - No recordings: every goal is a card, the reel still has a length.
 *  - No goals: title + end card only.
 *  - The music dips under each goal's strike and never goes above 1.
 *  - A big season (40+ goals) stays at most ~95 s: past the first goals
 *    the rest go by quick-fire (1.2-1.6 s, strike to net), none dropped,
 *    the goal of the season still gets its full moment.
 *  - The reel never films from the spider-cam or the side (a stand across
 *    the top half of a tall picture).
 */
const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const goal = (i: number, extra: Partial<CareerGoal> = {}): CareerGoal => ({
  id: `1:${i}:league:Chelsea:${10 + i}:0`, season: 1, week: i, minute: 10 + (i * 7) % 80,
  opponent: "Chelsea", club: "Arsenal", home: i % 2 === 0, competition: i % 4 === 0 ? "FA Cup" : "Premier League",
  score: "2-1", distance: 8 + (i % 5) * 3, clipId: `clip-${i}`, ...extra,
});
// A recording like the real ones: lead-in, strike ~1.5 s in, goal ~0.5 s later, 2.2 s after.
const timing = (i: number): ClipTiming => ({ strikeT: 1.4 + (i % 3) * 0.6, goalT: 2.0 + (i % 3) * 0.6 + (i % 2) * 0.3, duration: 4.6 + (i % 3) * 0.6 });

const input = (n: number, withClips = true): PlanInput => {
  const goals = Array.from({ length: n }, (_, i) => goal(i + 1, i === 11 ? { distance: 31, finish: "curl" } : {}));
  const timings: Record<string, ClipTiming> = {};
  if (withClips) goals.forEach((g, i) => { timings[g.clipId!] = timing(i + 1); });
  return { club: "Arsenal", player: "Leo Vale", season: 1, startYear: 2026, goals, timings, stats: { goals: n, assists: 7, apps: 40, avgRating: 7.4, trophies: ["FA Cup"] } };
};

// ── 1. A full 20-goal season ────────────────────────────────────────────────
{
  const inp = input(20);
  const p = planReel(inp);
  const kinds = p.segs.map((s) => s.kind);
  check(kinds[0] === "title" && kinds[kinds.length - 1] === "end", `title first, end last (${kinds.join(",")})`);
  const goals = p.segs.filter((s) => s.kind === "goal");
  check(goals.length === 20, `every goal is in it (${goals.length})`);
  check(goals.every((s, i) => s.kind === "goal" && s.goal.id === inp.goals[i].id && s.n === i + 1), "goals in the order scored");
  check(goals.every((s) => s.kind === "goal" && s.shots.length === 1), "every goal with a recording plays it");
  check(p.duration >= 60 && p.duration <= 90, `20 goals run 60-90 s (${p.duration.toFixed(1)} s)`);
  check(goals.every((s) => s.dur >= 2 && s.dur <= 4.5), `each goal 2-4.5 s (${goals.map((s) => s.dur.toFixed(1)).join(" ")})`);
  // Each goal's shot starts before the strike and ends after the goal.
  check(goals.every((s, i) => s.kind === "goal" && s.shots[0].from <= timing(i + 1).strikeT && s.shots[0].to > timing(i + 1).goalT), "each clip runs from before the strike to after it goes in");
  const best = bestGoals(inp.goals, 1)[0];
  check(p.bestId === best.id, `the goal of the season is bestGoals' pick (${p.bestId} v ${best.id})`);
  const b = p.segs.find((s) => s.kind === "best");
  check(!!b && b.kind === "best" && b.goal.id === best.id && b.shots.some((x) => x.rate < 1), "the best goal is replayed slowed down");
  check(p.segs.some((s) => s.kind === "bestIntro"), "a GOAL OF THE SEASON beat before it");
  // Segments touch end to end.
  let at = 0;
  for (const s of p.segs) { check(Math.abs(s.at - at) < 1e-9, `segment ${s.kind} starts where the last ended`); at += s.dur; }
  check(Math.abs(at - p.duration) < 1e-9, "the length is the sum of the segments");
  // segAt and shotAt find the right moment.
  const g5 = goals[4];
  const m = segAt(p, g5.at + 0.5);
  check(m.seg === g5 && Math.abs(m.into - 0.5) < 1e-9, "segAt finds a goal by time");
  const sh = g5.kind === "goal" ? shotAt(g5.shots, 0.5) : null;
  check(!!sh && Math.abs(sh.t - (g5.kind === "goal" ? g5.shots[0].from + 0.5 : 0)) < 1e-9, "shotAt gives the clip time");
  // The music: starts silent, dips at every strike, stays in 0..1.
  const lv = musicLevels(p, inp.timings);
  check(lv[0].gain === 0, "music fades in from silence");
  check(lv.every((x) => x.gain >= 0 && x.gain <= 1), "music level stays 0..1");
  check(lv.every((x, i) => i === 0 || x.at >= lv[i - 1].at), "music points in time order");
  const dips = lv.filter((x) => x.gain <= MUSIC_DUCK && x.at > 2 && x.at < p.duration - 1).length;
  check(dips >= 20, `the music ducks under every goal (${dips} low points)`);
  check(lv[lv.length - 1].gain === 0 && Math.abs(lv[lv.length - 1].at - p.duration) < 1e-9, "music ends silent at the end");
  check(reelMusicFor(p) === "03-winning", "a season with a trophy gets the winning track");
}

// ── 2. No recordings on this phone ──────────────────────────────────────────
{
  const p = planReel(input(20, false));
  const goals = p.segs.filter((s) => s.kind === "goal");
  check(goals.length === 20 && goals.every((s) => s.kind === "goal" && s.shots.length === 0), "no recordings: every goal is a card");
  check(p.duration > 30 && p.duration <= 90, `no recordings: still a real reel (${p.duration.toFixed(1)} s)`);
  const b = p.segs.find((s) => s.kind === "best");
  check(!!b && b.kind === "best" && b.shots.length === 0 && b.dur > 2, "no recordings: the best goal is a card");
}

// ── 3. No goals ─────────────────────────────────────────────────────────────
{
  const inp = input(0);
  inp.stats = { goals: 0, assists: 1, apps: 9, avgRating: 6.4, trophies: [] };
  const p = planReel(inp);
  check(p.segs.map((s) => s.kind).join(",") === "title,end", `no goals: title + end only (${p.segs.map((s) => s.kind).join(",")})`);
  check(p.bestId === null, "no goals: no goal of the season");
  check(p.duration > 5 && p.duration < 15, `no goals: short (${p.duration} s)`);
  check(musicLevels(p, {}).every((x) => x.gain >= 0 && x.gain <= 1), "no goals: music line valid");
  check(reelMusicFor(p) === "08-lobby", "no goals, no trophies: the calm track");
}

// ── 4. One goal, and a long season ──────────────────────────────────────────
{
  const p = planReel(input(1));
  check(p.segs.filter((s) => s.kind === "goal").length === 1 && p.segs.some((s) => s.kind === "best"), "one goal: it is also the goal of the season");
  check(perGoalSeconds(40) >= 2.4 && perGoalSeconds(3) <= 4.2, "per-goal time stays 2.4-4.2 s");
  const big = planReel(input(45));
  check(big.segs.filter((s) => s.kind === "goal").length === 45, "45 goals: every one is still in it");
}

// ── 4b. A big season: the quick-fire run ───────────────────────────────────
for (const n of [26, 30, 40, 45, 50]) {
  const inp = input(n);
  const p = planReel(inp);
  const goals = p.segs.filter((s) => s.kind === "goal");
  const quick = goals.filter((s) => s.kind === "goal" && s.quick);
  check(goals.length === n, `${n} goals: none dropped (${goals.length})`);
  check(p.duration <= 95, `${n} goals: at most 95 s (${p.duration.toFixed(1)} s)`);
  check(quick.length === n - fullGoalCount(n) && fullGoalCount(n) <= FULL_GOALS_MAX, `${n} goals: the last ${n - fullGoalCount(n)} are quick-fire (${quick.length})`);
  check(goals.every((s, i) => (s.kind === "goal" && !!s.quick) === (i >= fullGoalCount(n))), `${n} goals: the quick-fire run comes after the full ones`);
  check(quick.every((s) => s.dur >= QUICK_MIN_S - 1e-9 && s.dur <= QUICK_MAX_S + 1e-9), `${n} goals: each quick one 1.2-1.6 s (${quick.map((s) => s.dur.toFixed(2)).join(" ")})`);
  check(quick.every((s) => {
    if (s.kind !== "goal" || !s.shots.length) return true;
    const t = inp.timings[s.goal.clipId!];
    return s.shots[0].from <= t.strikeT + 0.05 && s.shots[0].to > t.goalT;
  }), `${n} goals: each quick one shows the strike and the ball going in`);
  const b = p.segs.find((s) => s.kind === "best");
  check(!!b && b.kind === "best" && b.dur > 5 && b.shots.some((x) => x.rate < 1), `${n} goals: the goal of the season keeps its full slow replay`);
  const lv = musicLevels(p, inp.timings);
  check(lv.every((x) => x.gain >= 0 && x.gain <= 1), `${n} goals: music line valid`);
  if (n === 40) console.log(`  40 goals: ${(p.duration).toFixed(1)} s, ${goals.length - quick.length} full + ${quick.length} quick-fire`);
}
{
  const p = planReel(input(40, false));
  check(p.duration <= 95, `40 goals, no recordings: at most 95 s (${p.duration.toFixed(1)} s)`);
  const p20 = planReel(input(20));
  check(p20.segs.every((s) => !(s.kind === "goal" && s.quick)), "20 goals: no quick-fire run");
}
{
  const kinds = ["header", "penalty", "long_range", "free_kick", "one_on_one", "cutback"];
  const used = new Set<string>();
  for (let i = 0; i < 30; i++) used.add(angleFor(goal(i, { how: kinds[i % kinds.length] }), i));
  check(!used.has("high") && !used.has("side"), `the reel never uses the spider-cam or side camera (${[...used].join(",")})`);
  const b = planReel(input(20)).segs.find((s) => s.kind === "best");
  check(!!b && b.kind === "best" && b.shots.every((x) => x.angle !== "high" && x.angle !== "side"), "the goal of the season: no spider-cam either");
}

// ── 5. Words ────────────────────────────────────────────────────────────────
check(seasonLabelOf(2026, 1) === "2026/27" && seasonLabelOf(2026, 4) === "2029/30" && seasonLabelOf(2026, 74) === "2099/00", "season labels");
check(goalCaption(goal(3, { minute: 34, opponent: "Arsenal", competition: "FA Cup" })) === "34' v Arsenal · FA Cup", "the caption reads 34' v Arsenal · FA Cup");

if (problems.length) {
  console.error(`seasonReel: ${problems.length} problem(s)\n - ${problems.join("\n - ")}`);
  process.exit(1);
}
console.log("seasonReel: all checks passed");
