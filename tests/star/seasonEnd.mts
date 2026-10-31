import { planReel, type ClipTiming } from "../../lib/star/goalClip/reel";
import {
  CHAPTERS_MAX, chaptersFor, goalOfSeason, gotmVotesOf, needsStandIn, nextStopAt, planSeasonEnd, planSeasonEndFor,
  prevStopAt, reelGoalsOf, reelStops, standInFor, standInKey, stopIndexAt, withStandIns,
} from "../../lib/star/goalClip/seasonEnd";
import { synthTrack } from "../../lib/star/goalClip/synth";
import { timingOf } from "../../lib/star/goalClip/reelAudio";
import { bestGoals, type CareerGoal } from "../../lib/star/goalLog";
import {
  FAVOURITES_MAX, favouriteClipIds, favouriteGoals, isFavourite, toggleFavourite, toggleFavouriteIn,
} from "../../lib/star/favouriteGoals";
import { makeInitialCareer } from "../../lib/star/careerFlow";
import type { CareerState, StarPlayer } from "../../lib/star/types";

/**
 * A BETTER END OF SEASON (lib/star/goalClip/seasonEnd.ts, lib/star/favouriteGoals.ts).
 *
 *  - Lost clips: a goal never recorded, one recorded on another phone, one
 *    with a broken recording and one logged twice. The plain plan shows the
 *    first three as drawn cards and the last twice (the bug). The better plan
 *    plays every goal exactly once, in order, each with a video (its
 *    recording or a stand-in made from the goal itself).
 *  - A stand-in is the same every time (seeded by the goal's id).
 *  - Chapter cards: first goal, hat-trick, career milestones; at most 6.
 *  - The goal of the season: your ⭐ first, then the fans' votes, then the game's pick.
 *  - Tap to skip: one stop per goal (its chapter card with it), next/back.
 *  - Favourites: add, remove, only your goals, capped; their recordings protected.
 */
const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const goal = (i: number, extra: Partial<CareerGoal> = {}): CareerGoal => ({
  id: `1:${i}:league:Chelsea:${10 + i}:0`, season: 1, week: i, minute: 10 + (i * 7) % 80,
  opponent: "Chelsea", club: "Arsenal", home: i % 2 === 0, competition: "Premier League",
  score: "2-1", distance: 8 + (i % 5) * 3, how: i % 4 === 0 ? "header" : "one_on_one", clipId: `clip-${i}`, ...extra,
});
const timing = (i: number): ClipTiming => ({ strikeT: 1.4 + (i % 3) * 0.6, goalT: 2.0 + (i % 3) * 0.6, duration: 4.6 + (i % 3) * 0.6 });
const stats = { goals: 0, assists: 3, apps: 30, avgRating: 7.1, trophies: [] as string[] };

// ── 1. Lost clips ───────────────────────────────────────────────────────────
{
  const goals: CareerGoal[] = Array.from({ length: 12 }, (_, i) => goal(i + 1));
  delete goals[2].clipId;                               // never recorded (a simulated match)
  goals[4] = { ...goals[4], clipId: "clip-other-phone" }; // recorded on another phone
  const log = [...goals.slice(0, 7), { ...goals[6] }, ...goals.slice(7)]; // goal 7 logged twice
  const timings: Record<string, ClipTiming> = {};
  goals.forEach((g, i) => { if (g.clipId && g.clipId.startsWith("clip-") && g.clipId !== "clip-other-phone") timings[g.clipId] = timing(i + 1); });
  timings["clip-9"] = { strikeT: 0, goalT: 0, duration: 3 };   // a broken recording

  // The bug, as it was: cards for the lost ones, goal 7 twice.
  const old = planReel({ club: "Arsenal", player: "Leo Vale", season: 1, startYear: 2027, goals: log, timings, stats: { ...stats, goals: log.length } });
  const oldGoals = old.segs.filter((s) => s.kind === "goal");
  const oldCards = oldGoals.filter((s) => s.kind === "goal" && s.shots.length === 0).length;
  check(oldCards === 3, `the plain plan shows the 3 lost goals as cards (${oldCards})`);
  check(oldGoals.length === 13, `the plain plan plays the twice-logged goal twice (${oldGoals.length})`);

  // The fix.
  const once = reelGoalsOf(log);
  check(once.length === 12 && once.every((g, i) => g.id === goals[i].id), "each goal once, in the order scored");
  const need = once.filter((g) => needsStandIn(g, timings));
  check(need.length === 3, `3 goals need a stand-in (${need.map((g) => g.week).join(",")})`);
  const tracksTimings: Record<string, ClipTiming> = { ...timings };
  const made = new Set<string>();
  for (const g of need) {
    const tr = synthTrack(standInFor(g, "Leo Vale", "Vale"));
    check(!!tr, `a stand-in is made for goal ${g.week}`);
    if (!tr) continue;
    const t = timingOf(tr);
    check(t.goalT > t.strikeT && t.duration > t.goalT, `goal ${g.week}'s stand-in has a strike and a goal (${t.strikeT.toFixed(2)} → ${t.goalT.toFixed(2)} of ${t.duration.toFixed(2)} s)`);
    tracksTimings[standInKey(g)] = t;
    made.add(standInKey(g));
  }
  const video = withStandIns(once, timings, made);
  check(video.every((g, i) => g.id === once[i].id), "stand-ins keep each goal's own id");
  const p = planSeasonEnd({
    mode: "season", club: "Arsenal", player: "Leo Vale", season: 1, startYear: 2027,
    goals: video, logged: once, timings: tracksTimings, stats: { ...stats, goals: 12 }, favourites: new Set(),
  });
  const gs = p.segs.filter((s) => s.kind === "goal");
  check(gs.length === 12, `every goal exactly once (${gs.length})`);
  check(gs.every((s, i) => s.kind === "goal" && s.goal.id === once[i].id && s.n === i + 1 && s.of === 12), "in the order scored, numbered 1..12");
  check(gs.every((s) => s.kind === "goal" && s.shots.length > 0), `never a blank: every goal plays a video (${gs.filter((s) => s.kind === "goal" && !s.shots.length).length} cards)`);
  const best = p.segs.find((s) => s.kind === "best");
  check(!!best && best.kind === "best" && best.shots.length > 0, "the goal of the season plays a video too");
  check(p.segs[0].kind === "title" && p.segs[p.segs.length - 1].kind === "end", "title first, end card last");
  check(p.segs.every((s, i) => i === 0 || Math.abs(s.at - (p.segs[i - 1].at + p.segs[i - 1].dur)) < 1e-9), "segments run back to back");

  // Same goal, same stand-in.
  const a = synthTrack(standInFor(need[0], "Leo Vale", "Vale"));
  const b = synthTrack(standInFor(need[0], "Leo Vale", "Vale"));
  check(!!a && !!b && a.goalT === b.goalT && JSON.stringify(a.frames?.[10] ?? a) === JSON.stringify(b.frames?.[10] ?? b), "a stand-in is the same every time");
  // A header becomes a header, a penalty a penalty.
  check(standInFor(goal(4, { how: "header" }), "x", "x").kind === "header" && standInFor(goal(5, { how: "penalty" }), "x", "x").kind === "penalty", "the stand-in follows how the goal went in");
  const away = standInFor(goal(3, { home: false, score: "3-1" }), "x", "x");
  check(away.home === "Chelsea" && away.away === "Arsenal" && away.scoreAfter?.[0] === 1 && away.scoreAfter?.[1] === 3, "away goal: the right home side and score");
}

// ── 2. Chapters ─────────────────────────────────────────────────────────────
{
  const g = (i: number, match: number, k: number): CareerGoal => ({ ...goal(i), id: `1:${match}:league:Spurs:${10 + i}:${k}`, opponent: "Spurs" });
  const goals = [g(1, 1, 0), g(2, 2, 0), g(3, 3, 0), g(4, 3, 1), g(5, 3, 2), g(6, 4, 0)];
  const ch = chaptersFor(goals, 0);
  check(ch.get(goals[0].id)?.title === "FIRST CAREER GOAL", `first ever goal (${ch.get(goals[0].id)?.title})`);
  check(ch.get(goals[4].id)?.title === "HAT-TRICK", `hat-trick on the third in one match (${ch.get(goals[4].id)?.title})`);
  check(!ch.has(goals[3].id) && !ch.has(goals[5].id), "no card for an ordinary goal");
  const ch2 = chaptersFor(goals, 45);
  check(ch2.get(goals[0].id)?.title === "FIRST GOAL", "first goal of a later season");
  check(ch2.get(goals[4].id)?.title === "50TH CAREER GOAL", `the 50th career goal beats the hat-trick (${ch2.get(goals[4].id)?.title})`);
  const many = Array.from({ length: 30 }, (_, i) => g(i + 1, 1 + Math.floor(i / 3), i % 3));
  const p = planSeasonEnd({ mode: "season", club: "Arsenal", player: "x", season: 1, startYear: 2027, goals: many, timings: {}, stats, favourites: new Set() });
  const cards = p.segs.filter((s) => s.kind === "chapter").length;
  check(cards <= CHAPTERS_MAX && cards >= 3, `at most ${CHAPTERS_MAX} chapter cards (${cards})`);
  check(p.segs.every((s, i) => s.kind !== "chapter" || (p.segs[i + 1]?.kind === "goal" && (p.segs[i + 1] as { goal: CareerGoal }).goal.id === s.goal.id)), "a chapter card comes right before its goal");
}

// ── 3. Goal of the season ───────────────────────────────────────────────────
{
  const goals = Array.from({ length: 10 }, (_, i) => goal(i + 1, i === 6 ? { distance: 33, finish: "curl" } : {}));
  const auto = goalOfSeason(goals, new Set(), {});
  check(auto?.why === "best" && auto.goal.id === bestGoals(goals, 1)[0].id, "nothing picked: the game's own best goal");
  const voted = goalOfSeason(goals, new Set(), { [goals[2].id]: 1200, [goals[3].id]: 40 });
  check(voted?.why === "votes" && voted.goal.id === goals[2].id, "the fans' Goal of the Month win beats the game's pick");
  const mine = goalOfSeason(goals, new Set([goals[1].id, goals[8].id]), { [goals[8].id]: 30 });
  check(mine?.why === "pick" && mine.goal.id === goals[8].id, "your ⭐ beats the votes; two ⭐s: the one with more votes");
  check(goalOfSeason([], new Set(), {}) === null, "no goals: no goal of the season");
}

// ── 4. Votes read from the Goal of the Month polls ──────────────────────────
{
  const player = { firstName: "Leo", lastName: "Vale", age: 20, skinTone: "light", club: "Arsenal", clubBadge: null, position: "ST", nationality: "England", startYear: 2027 } as unknown as StarPlayer;
  const base = makeInitialCareer(player, ["Arsenal", "Chelsea", "Spurs", "Fulham"]);
  const log = [goal(1), goal(2, { clipId: undefined }), goal(3)];
  const career: CareerState = {
    ...base, goalLog: log,
    media: { ...(base.media ?? {}), posts: [{
      id: "p1", at: 1, author: {} as never, text: "",
      graphic: { type: "gotmPoll", pollId: "x", monthName: "August", entries: [
        { scorer: "Leo Vale", scorerShort: "Vale", club: "Arsenal", isYou: true, detail: "", quality: 50, clipId: "clip-1" },
        { scorer: "Leo Vale", scorerShort: "Vale", club: "Arsenal", isYou: true, detail: "", quality: 60, synth: { home: "Arsenal", away: "Chelsea", scorerHome: true, minute: log[1].minute, season: 1, week: 2, seed: "s" } },
        { scorer: "Other", scorerShort: "O", club: "Spurs", isYou: false, detail: "", quality: 70 },
      ], fanVotes: [300, 500, 200], userWeight: 50, userVote: 0, closed: true, winner: 1 },
    }] } as never,
  };
  const v = gotmVotesOf(career);
  check(v[log[0].id] === 350, `your vote counts for your pick (${v[log[0].id]})`);
  check(v[log[1].id] === 1500, `the winner, found by its match and minute (no recording) (${v[log[1].id]})`);
  check(Object.keys(v).length === 2, "other players' goals are not yours");
}

// ── 5. Tap to skip ──────────────────────────────────────────────────────────
{
  const g = (i: number, match: number, k: number): CareerGoal => ({ ...goal(i), id: `1:${match}:league:Spurs:${10 + i}:${k}` });
  const goals = [g(1, 1, 0), g(2, 2, 0), g(3, 2, 1), g(4, 2, 2), g(5, 3, 0)];
  const timings: Record<string, ClipTiming> = {};
  goals.forEach((x, i) => { timings[x.clipId!] = timing(i); });
  const p = planSeasonEnd({ mode: "season", club: "Arsenal", player: "x", season: 1, startYear: 2027, goals, timings, stats, favourites: new Set() });
  const stops = reelStops(p);
  check(stops.length === 1 + 5 + 1 + 1, `a stop each: title, 5 goals, goal of the season, end (${stops.map((s) => s.kind).join(",")})`);
  check(stops.filter((s) => s.kind === "goal").every((s, i) => s.goalId === goals[i].id), "each goal's stop knows its goal");
  check(stops.every((s, i) => i === 0 || Math.abs(s.at - stops[i - 1].end) < 1e-9) && Math.abs(stops[stops.length - 1].end - p.duration) < 1e-9, "the stops cover the reel end to end");
  const first = p.segs.find((s) => s.kind === "chapter");
  check(!!first && stops[1].at === first.at, "a goal's stop starts at its chapter card");
  check(nextStopAt(stops, 0.5) === stops[1].at, "tap right on the title: the first goal");
  check(nextStopAt(stops, stops[3].at + 0.1) === stops[4].at, "tap right mid-goal: the next goal");
  check(nextStopAt(stops, p.duration - 0.1) === null, "tap right on the end card: nothing after it");
  check(prevStopAt(stops, stops[3].at + 2) === stops[3].at, "tap left well into a goal: back to its start");
  check(prevStopAt(stops, stops[3].at + 0.2) === stops[2].at, "tap left at a goal's start: the goal before");
  check(prevStopAt(stops, 0.1) === 0, "tap left on the title: stays on the title");
  check(stopIndexAt(stops, stops[5].at + 0.01) === 5, "where we are");
}

// ── 6. Favourites ───────────────────────────────────────────────────────────
{
  const player = { firstName: "Leo", lastName: "Vale", age: 20, skinTone: "light", club: "Arsenal", clubBadge: null, position: "ST", nationality: "England", startYear: 2027 } as unknown as StarPlayer;
  const base = makeInitialCareer(player, ["Arsenal", "Chelsea", "Spurs", "Fulham"]);
  const log = [goal(1), goal(2, { clipId: undefined }), goal(3), { ...goal(4), season: 2, id: "2:4:league:Chelsea:40:0" }];
  let c: CareerState = { ...base, goalLog: log };
  check(favouriteGoals(c).length === 0 && !c.favouriteGoals, "a save with none: nothing added");
  c = toggleFavourite(c, log[2].id);
  c = toggleFavourite(c, log[0].id);
  c = toggleFavourite(c, log[1].id);
  check(isFavourite(c, log[0].id) && isFavourite(c, log[2].id), "⭐ adds");
  check(favouriteGoals(c).map((g) => g.id).join() === [log[0].id, log[1].id, log[2].id].join(), "favourites in the order scored");
  check(favouriteClipIds(c).join() === "clip-1,clip-3", "their recordings are kept (a goal with none adds none)");
  c = toggleFavourite(c, log[0].id);
  check(!isFavourite(c, log[0].id) && c.favouriteGoals!.length === 2, "⭐ again takes it off");
  const same = toggleFavourite(c, "not-a-goal");
  check(same === c, "only your own goals can be favourites");
  let big: string[] = [];
  for (let i = 0; i < FAVOURITES_MAX + 20; i++) big = toggleFavouriteIn(big, `g${i}`);
  check(big.length === FAVOURITES_MAX && big[big.length - 1] === `g${FAVOURITES_MAX + 19}`, `capped at ${FAVOURITES_MAX}, newest kept`);

  // The favourites reel: your ⭐ goals from every season, no chapters, its own end card.
  const fc = { ...c, favouriteGoals: [log[3].id, log[0].id, log[2].id] };
  const p = planSeasonEndFor(fc, "favourites", favouriteGoals(fc), { "clip-1": timing(1), "clip-3": timing(3) }, "Leo Vale", new Set(fc.favouriteGoals));
  const gs = p.segs.filter((s) => s.kind === "goal");
  check(gs.length === 3 && gs.map((s) => (s as { goal: CareerGoal }).goal.id).join() === [log[0].id, log[2].id, log[3].id].join(), "the favourites reel: every favourite, oldest first, across seasons");
  check(!p.segs.some((s) => s.kind === "chapter" || s.kind === "best"), "no chapters or goal of the season in it");
  check(p.better?.mode === "favourites" && p.better.tiles?.[0][1] === "3" && p.seasonLabel === "GOALS", "its own title and end card");
}

// ── 7. The plain plan is unchanged ──────────────────────────────────────────
{
  const goals = Array.from({ length: 6 }, (_, i) => goal(i + 1));
  const timings: Record<string, ClipTiming> = {};
  goals.forEach((g, i) => { timings[g.clipId!] = timing(i + 1); });
  const p = planReel({ club: "Arsenal", player: "x", season: 1, startYear: 2027, goals, timings, stats });
  check(p.better === undefined && !p.segs.some((s) => s.kind === "chapter"), "the plain plan has no chapters and no better block");
}

if (problems.length) {
  console.error(`seasonEnd: ${problems.length} problem(s)\n - ${problems.join("\n - ")}`);
  process.exit(1);
}
console.log("seasonEnd: all checks passed");
