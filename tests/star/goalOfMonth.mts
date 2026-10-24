import { makeInitialCareer, creditMatchResult } from "../../lib/star/careerFlow";
import { generateForMatch, feedFor, voteGoalOfMonth, applyGoalOfMonthBoost } from "../../lib/star/media/feed";
import {
  goalQuality, bestOf, fanVotes, tally, winnerOf, userWeightFor, GOTM_FANS_BOOST, pickRivalGoals,
} from "../../lib/star/media/detect/goalOfMonth";
import { mulberry32 } from "../../lib/star/season";
import type { CareerState, GoalEvent, MatchStats, StarPlayer } from "../../lib/star/types";
import type { GotmEntry, StoredPost } from "../../lib/star/media/types";

/**
 * GOAL OF THE MONTH (Leo, 22 Oct 2026, plan part 10, option B): your best 3
 * goals of the month against 2 by other players in your league, a fans' vote
 * you can add to, a winner post, and a small fans boost when it is yours.
 */
const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const CLUBS = [
  "Arsenal", "Aston Villa", "Bournemouth", "Brentford", "Brighton", "Chelsea",
  "Crystal Palace", "Everton", "Fulham", "Ipswich", "Leicester", "Liverpool",
  "Man City", "Man United", "Newcastle", "Nottingham Forest", "Southampton",
  "Tottenham", "West Ham", "Wolves",
];

function newCareer(seed = 1): CareerState {
  const player: StarPlayer = {
    firstName: "Michael", lastName: "Sancho", age: 18, skinTone: "light",
    club: CLUBS[seed % CLUBS.length], clubBadge: null, position: "ST",
    nationality: "England", startYear: 2026,
  };
  return makeInitialCareer(player, CLUBS);
}

const HOWS = ["long_range", "penalty", "header", "solo", "free_kick", "cutback", "volley", "one_on_one"];

/** Plays `matches` matches the way page.tsx does. `goalsAt(m)` = your goals in match m. */
function play(c: CareerState, matches: number, goalsAt: (m: number) => number, seed = 1, vote?: (c: CareerState) => CareerState) {
  const log: { career: CareerState; posts: StoredPost[] }[] = [];
  for (let m = 0; m < matches; m++) {
    const fixture = c.fixtures.find(f => !f.played && f.week === c.week) ?? c.fixtures.find(f => !f.played);
    if (!fixture) break;
    const rng = mulberry32(seed * 1000 + m);
    const n = goalsAt(m);
    const events: GoalEvent[] = [];
    for (let i = 0; i < n; i++) {
      const how = HOWS[Math.floor(rng() * HOWS.length)];
      events.push({
        minute: 10 + i * 20 + Math.floor(rng() * 10), scorer: "Michael Sancho", isUserGoal: true, how,
        distance: how === "penalty" ? 11 : 6 + rng() * 26, ...(rng() < 0.2 ? { finish: "curl" as const } : {}),
        ...(rng() < 0.5 ? { clipId: `clip-${m}-${i}` } : {}),
      });
    }
    const stats: MatchStats = {
      chances: n + 2, goals: n, assists: 0, passes: 30, rating: 7.5, starMan: false,
      bossChange: 0, teamChange: 0, fansChange: 0, wage: 1, goalBonus: 0, sponsorPay: 0, totalCash: 1,
      homeScore: n, awayScore: 1, goalEvents: events, minutes: 90,
    };
    const { career: after1 } = creditMatchResult(c, fixture, stats);
    // Without real squads the other matches have no scorers' names: give them
    // some, as the real squads would.
    const after0: CareerState = { ...after1, results: (after1.results ?? []).map(r => ({
      ...r,
      hg: r.hg?.length ? r.hg : Array.from({ length: r.hs }, (_, i) => ({ m: 15 + i * 20, s: `Home${i}`, full: `Sam Home${i}${r.home.length}` })),
      ag: r.ag?.length ? r.ag : Array.from({ length: r.as }, (_, i) => ({ m: 25 + i * 20, s: `Away${i}`, full: `Joe Away${i}${r.away.length}` })),
    })) };
    let after: CareerState = { ...after0, media: generateForMatch(c, after0, fixture, stats) };
    after = applyGoalOfMonthBoost(after);
    if (vote) after = vote(after);
    log.push({ career: after, posts: after.media?.posts ?? [] });
    c = after;
  }
  return { career: c, log };
}

const polls = (c: CareerState) => (c.media?.posts ?? []).filter(p => p.graphic?.type === "gotmPoll");
const winners = (c: CareerState) => (c.media?.posts ?? []).filter(p => p.eventId === "gotm-winner");
type Poll = Extract<NonNullable<StoredPost["graphic"]>, { type: "gotmPoll" }>;

// ── 1. Quality: hardest is best ─────────────────────────────────────────────
{
  const pen = goalQuality({ how: "penalty", distance: 11 });
  const tap = goalQuality({ how: "cutback", distance: 6 });
  const long = goalQuality({ how: "long_range", distance: 30 });
  const fk = goalQuality({ how: "free_kick", distance: 25, finish: "curl" });
  check(pen < tap && tap < long, `penalty < tap-in < 30-yard shot (${pen}, ${tap}, ${long})`);
  check(fk > goalQuality({ how: "free_kick", distance: 25 }), "a curler is worth more than the same free kick straight");
  check(goalQuality({}) >= 0 && goalQuality({ how: "long_range", distance: 60, finish: "chip" }) <= 100, "quality stays 0-100");
  const best = bestOf([{ quality: 10, n: "a" }, { quality: 80, n: "b" }, { quality: 50, n: "c" }, { quality: 80, n: "d" }], 3);
  check(best.map(b => b.n).join("") === "bdc", `best 3 by quality, earlier wins a tie (${best.map(b => b.n).join("")})`);
}

// ── 2. Votes: deterministic, weighted, your tap counts ─────────────────────
{
  const e = (q: number, isYou: boolean): GotmEntry => ({ scorer: "x", scorerShort: "x", club: "c", isYou, detail: "", quality: q });
  const entries = [e(90, false), e(40, true), e(60, true), e(30, false), e(75, false)];
  const a = fanVotes(entries, 30, "s1-3"), b = fanVotes(entries, 30, "s1-3");
  check(a.join() === b.join(), "same seed, same votes");
  check(fanVotes(entries, 30, "s1-4").join() !== a.join(), "another month votes differently");
  // Over many seeds a better goal wins more often.
  let hiBeatsLo = 0;
  for (let s = 0; s < 200; s++) { const v = fanVotes(entries, 30, `k${s}`); if (v[0] > v[3]) hiBeatsLo++; }
  check(hiBeatsLo > 180, `a 90 beats a 30 almost always (${hiBeatsLo}/200)`);
  // Fame helps your goals.
  let famous = 0, unknown = 0;
  for (let s = 0; s < 200; s++) {
    famous += fanVotes(entries, 100, `f${s}`)[1] / fanVotes(entries, 100, `f${s}`).reduce((x, y) => x + y, 0);
    unknown += fanVotes(entries, 0, `f${s}`)[1] / fanVotes(entries, 0, `f${s}`).reduce((x, y) => x + y, 0);
  }
  check(famous > unknown * 1.3, `fame lifts your share (${(famous / 2).toFixed(1)}% v ${(unknown / 2).toFixed(1)}%)`);
  // Your tap adds weight and can swing a close one.
  const poll = { fanVotes: [100, 98, 10], userWeight: userWeightFor([100, 98, 10]) };
  check(winnerOf(poll) === 0, "without your vote the leader wins");
  check(tally({ ...poll, userVote: 1 })[1] === 98 + poll.userWeight, "your vote adds its weight to your pick");
  check(winnerOf({ ...poll, userVote: 1 }) === 1, "your vote can swing a close poll");
  check(poll.userWeight === Math.round(208 * 0.06), `your vote is worth 6% (${poll.userWeight})`);
}

// ── 3. Rivals: two goals from other matches, never yours ────────────────────
{
  const results = [
    { week: 1, home: "Arsenal", away: "Chelsea", hs: 2, as: 0, hg: [{ m: 10, s: "Saka", full: "Bukayo Saka" }, { m: 50, s: "Odegaard" }], ag: [] },
    { week: 2, home: "Liverpool", away: "Wolves", hs: 1, as: 1, hg: [{ m: 30, s: "Salah", full: "Mohamed Salah" }], ag: [{ m: 70, s: "Cunha" }] },
    { week: 2, home: "Everton", away: "Fulham", hs: 0, as: 1, hg: [], ag: [{ m: 12, s: "Jimenez" }] },
  ];
  const r = pickRivalGoals(results, "Liverpool", () => true, "seed", "Premier League", 1);
  check(r.length === 2, `two rival goals (${r.length})`);
  check(r.every(x => x.club !== "Liverpool" && !x.isYou), "never your club's");
  check(new Set(r.map(x => x.synth?.home)).size === 2, "from two different matches");
  check(r.every(x => !!x.synth?.seed && (x.synth.kind === "long_range" || x.synth.kind === "run_in")), "each has a made video: a long shot or a solo run");
  check(JSON.stringify(r) === JSON.stringify(pickRivalGoals(results, "Liverpool", () => true, "seed", "Premier League", 1)), "same seed, same picks");
}

// ── 4. A season: polls, winners, boost ──────────────────────────────────────
{
  const run = play(newCareer(2), 20, m => (m % 3 === 0 ? 2 : m % 3 === 1 ? 1 : 0), 2);
  const c = run.career;
  const ps = polls(c);
  check(ps.length >= 3, `a poll most months (${ps.length} in 20 matches)`);
  for (const p of ps) {
    const g = p.graphic as Poll;
    const mine = g.entries.filter(e => e.isYou);
    check(mine.length >= 1 && mine.length <= 3, `1-3 of yours in ${g.monthName} (${mine.length})`);
    check(g.entries.filter(e => !e.isYou).length === 2, `2 rivals in ${g.monthName} (${g.entries.filter(e => !e.isYou).length})`);
    check(g.entries.every(e => !!e.clipId || !!e.synth), "every entry has a video");
    check(g.fanVotes.length === g.entries.length && g.fanVotes.every(v => v > 0), "every entry has fan votes");
  }
  // Your 3 best really are your best of that month.
  const poll0 = c.media?.gotm?.polls[0];
  if (poll0) {
    const mineQ = poll0.entries.filter(e => e.isYou).map(e => e.quality);
    check(mineQ.length <= 3, "at most 3 of yours");
  }
  const ws = winners(c);
  const closed = ps.filter(p => (p.graphic as Poll).closed);
  check(closed.every(p => ws.some(w => w.id === `${(p.graphic as Poll).pollId}:winner`)) && ws.length >= 2, `a winner post for each closed poll (${ws.length} winners, ${closed.length} closed polls still in the feed)`);
  check(ws.every(w => w.text.includes("Goal of the Month:") && w.graphic?.type === "goalVideo"), "winner post names it and plays the video");
  check((c.media?.gotm?.polls ?? []).filter(p => !p.closed).length <= 1, "at most one poll open");
  // Poll closes at the next match after it opened.
  for (let i = 0; i < run.log.length - 1; i++) {
    const opened = run.log[i].posts.filter(p => p.eventId === "gotm-poll").map(p => p.id);
    const prev = i ? new Set(run.log[i - 1].posts.map(p => p.id)) : new Set<string>();
    for (const id of opened.filter(x => !prev.has(x))) {
      const next = run.log[i + 1].posts.find(p => p.id === id);
      check(!next || (next.graphic as Poll).closed === true, `poll ${id} closes at the next match`);
    }
  }
  // Shown in the post-match moment when it opens.
  const opensAt = run.log.findIndex((l, i) => l.posts.some(p => p.eventId === "gotm-poll" && !(i && run.log[i - 1].posts.some(q => q.id === p.id))));
  if (opensAt >= 0) {
    const moment = feedFor(run.log[opensAt].career, "moment").posts;
    check(moment.some(p => p.eventId === "gotm-poll"), "the new poll shows on the post-match screen");
    check(feedFor(run.log[opensAt].career, "settled").posts.some(p => p.eventId === "gotm-poll"), "and in the feed");
  }
}

// ── 5. Boost only when yours wins; vote stored and one tap only ─────────────
{
  let yourWins = 0, theirWins = 0, boostOk = true;
  for (let seed = 1; seed <= 6; seed++) {
    let c = newCareer(seed);

    for (let m = 0; m < 14; m++) {
      const before = c;
      const r = play(c, 1, () => ((m + seed) % 2 === 0 ? 2 : 1), seed * 10 + m);
      c = r.career;
      const newWinner = c.media!.posts.find(p => p.eventId === "gotm-winner" && !before.media?.posts.some(q => q.id === p.id));

      if (newWinner) {
        const pollId = newWinner.id.replace(/:winner$/, "");
        const poll = c.media!.gotm!.polls.find(p => p.id === pollId)!;
        const yours = !!poll.winnerIsYou;
        check(poll.entries.length === 0, "a closed poll is kept slim");
        if (yours) yourWins++; else theirWins++;
        check((c.media!.gotm!.boostDue ?? 0) === 0, "the boost is paid once");
        // fansChange is 0 in these matches, so only weekly drift and the boost move it.
        if (yours && !(c.relationships.fans >= Math.min(100, before.relationships.fans + GOTM_FANS_BOOST) - 2)) boostOk = false;
      }
    }
  }
  check(boostOk, "your win lifts the fans bar by the boost");
  console.log(`  winners over 6 careers: ${yourWins} yours, ${theirWins} other players`);
  check(yourWins + theirWins > 0, `polls were decided (${yourWins} yours, ${theirWins} theirs)`);

  // Direct check: boost paid only when boostDue is set.
  const base = newCareer(4);
  const withMedia = play(base, 1, () => 1).career;
  const due: CareerState = { ...withMedia, media: { ...withMedia.media!, gotm: { ...withMedia.media!.gotm!, boostDue: GOTM_FANS_BOOST } } };
  const paid = applyGoalOfMonthBoost(due);
  check(paid.relationships.fans === Math.min(100, due.relationships.fans + GOTM_FANS_BOOST), `+${GOTM_FANS_BOOST} fans when yours won`);
  check(applyGoalOfMonthBoost(paid).relationships.fans === paid.relationships.fans, "paid once only");
  check(applyGoalOfMonthBoost(withMedia).relationships.fans === withMedia.relationships.fans, "no boost when nothing of yours won");

  // Voting.
  const s = play(newCareer(5), 10, m => (m % 2 ? 1 : 2), 5).log.map(l => l.career).find(x => (x.media?.gotm?.polls ?? []).some(p => !p.closed))!;
  const open = s.media!.posts.find(p => p.graphic?.type === "gotmPoll" && !(p.graphic as Poll).closed);
  check(!!open, "an open poll to vote in");
  if (open) {
    const voted = voteGoalOfMonth(s, open.id, 1);
    const g = voted.media!.posts.find(p => p.id === open.id)!.graphic as Poll;
    check(g.userVote === 1, "your vote is stored on the post");
    check(voted.media!.gotm!.polls.find(p => p.id === g.pollId)!.userVote === 1, "and in career.media.gotm");
    const again = voteGoalOfMonth(voted, open.id, 2);
    check((again.media!.posts.find(p => p.id === open.id)!.graphic as Poll).userVote === 1, "one tap per poll");
    check(voteGoalOfMonth(s, open.id, 99) === s, "a bad index changes nothing");
  }
}

// ── 6. No goals, no poll; old save without the new fields ───────────────────
{
  const none = play(newCareer(6), 14, () => 0, 6).career;
  check(polls(none).length === 0, `no goals, no poll (${polls(none).length})`);
  check(winners(none).length === 0, "and no winner");

  // An old save: media without `gotm`, posts without the poll type.
  let old = play(newCareer(8), 3, () => 1, 8).career;
  const { gotm: _drop, ...mediaNoGotm } = old.media!;
  old = { ...old, media: mediaNoGotm };
  let crashed = false;
  try {
    const r = play(old, 8, () => 1, 9).career;
    check(Array.isArray(r.media?.gotm?.polls), "an old save picks up the new fields");
    check(applyGoalOfMonthBoost(old) === old, "boost on an old save is a no-op");
    check(voteGoalOfMonth(old, "nope", 0) === old, "vote on an old save is a no-op");
    const bare: CareerState = { ...old, media: undefined };
    check(applyGoalOfMonthBoost(bare) === bare, "no media at all is fine");
  } catch (e) { crashed = true; problems.push(`old save crashed: ${(e as Error).message}`); }
  check(!crashed, "an old save does not crash");
}

if (problems.length) {
  console.error(`goalOfMonth: ${problems.length} problem(s)`);
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log("goalOfMonth: all checks pass");
