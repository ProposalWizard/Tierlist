/**
 * GOAL OF THE MONTH — the glue (Leo, 22 Oct 2026, plan part 10, option B).
 *
 * The rules themselves are in detect/goalOfMonth.ts. This file reads the
 * career, keeps `MediaState.gotm` and writes the two posts:
 *
 * - THE POLL: at your first match of a new month, the month before gets a
 *   poll from the league's account: your best 3 goals of it against 2 by
 *   other players in your league, each with its video. No goals, no poll.
 * - THE WINNER: the poll closes at your next match after it opened (about a
 *   week of game time, so there is always a week to vote). A post names the
 *   winner with its video. If it is yours, the fans bar goes up by
 *   GOTM_FANS_BOOST (3 points of 100), paid by `applyGoalOfMonthBoost`.
 *
 * Runs at the end of `generateForMatch` (feed.ts), so it follows that
 * function's replay guard: a replayed match never adds goals or polls twice.
 */
import type { CareerState, Fixture, MatchStats } from "../types";
import type {
  GotmEntry, GotmPoll, GotmState, MatchRecord, MediaAccount, MediaState, StoredPost,
} from "./types";
import { monthOfCareer, MONTH_NAMES } from "../potm";
import { divisionOf, leagueNameFor } from "../calendar";
import { fameOf } from "../fame";
import { buildRoster } from "./accounts";
import { metricsFor, rngFor, shortClub } from "./grammar";
import {
  bestOf, describeGoal, fanVotes, goalQuality, GOTM_FANS_BOOST, pickRivalGoals,
  synthKindFor, synthOf, userWeightFor, winnerOf,
} from "./detect/goalOfMonth";

const POST_CAP = 150;
/** Closed polls kept in `gotm.polls`. */
const POLLS_KEPT = 2;

export function emptyGotm(): GotmState {
  return { goals: [], rivals: {}, polls: [] };
}

const keyOf = (season: number, month: number) => season * 100 + month;
const rivalKey = (season: number, month: number) => `${season}-${month}`;

function authorOf(acc: MediaAccount): StoredPost["author"] {
  return {
    handle: acc.handle, name: acc.name, archetype: acc.archetype, platform: acc.platform, verified: acc.verified,
    initials: acc.avatar.initials, tint: acc.avatar.tint, tint2: acc.avatar.tint2, glyph: acc.avatar.glyph,
  };
}

/** Your goals in this match, as poll entries. */
function yourEntries(before: CareerState, fixture: Fixture, stats: MatchStats, record: MatchRecord): GotmEntry[] {
  const you = `${before.player.firstName} ${before.player.lastName}`;
  const club = before.player.club;
  const home = fixture.home ? club : fixture.opponent;
  const away = fixture.home ? fixture.opponent : club;
  const events = stats.goalEvents ?? [];
  const out: GotmEntry[] = [];
  for (const g of record.goals) {
    if (!g.isUser) continue;
    const ev = events.find(e => e.isUserGoal && e.minute === g.minute && e.scorer === g.scorer);
    const judged = { how: g.how, distance: g.distance, finish: ev?.finish };
    const sa = g.scoreAfter;
    out.push({
      scorer: you,
      scorerShort: before.player.lastName,
      club,
      isYou: true,
      detail: describeGoal(judged, shortClub(fixture.opponent)),
      quality: goalQuality(judged),
      ...(g.clipId ? { clipId: g.clipId } : {
        synth: {
          home, away, scorerHome: fixture.home,
          minute: g.minute,
          ...(sa ? { scoreAfter: (fixture.home ? [sa.us, sa.them] : [sa.them, sa.us]) as [number, number] } : {}),
          seed: `gu${record.season}.${record.week}.${g.minute}`,
          kind: synthKindFor(g.how),
        },
      }),
    });
  }
  return out;
}

function replacePost(posts: StoredPost[], id: string, f: (p: StoredPost) => StoredPost): StoredPost[] {
  return posts.map(p => (p.id === id ? f(p) : p));
}

/**
 * After your match: close last week's poll, file this match's goals, and open
 * the poll for a month that has just finished.
 */
export function goalOfMonthAfterMatch(
  media: MediaState,
  before: CareerState,
  after: CareerState,
  fixture: Fixture,
  stats: MatchStats,
  record: MatchRecord,
  cycleClock: number,
): MediaState {
  if (fixture.kind === "international") return media;
  const g0 = media.gotm ?? emptyGotm();
  let gotm: GotmState = { goals: [...(g0.goals ?? [])], rivals: { ...(g0.rivals ?? {}) }, polls: [...(g0.polls ?? [])], boostDue: g0.boostDue };
  let posts = media.posts;
  const added: StoredPost[] = [];
  const season = record.season;
  const month = monthOfCareer(before, fixture.week);
  const now = keyOf(season, month);
  const roster = buildRoster(after);
  const competition = leagueNameFor(divisionOf(before));
  const acc = roster.find(a => a.archetype === "league" && a.name === competition)
    ?? roster.find(a => a.archetype === "league")
    ?? roster.find(a => a.archetype === "club" && a.allegiance?.club === before.player.club)
    ?? roster[0];

  // 1. Close any poll that opened before this match.
  gotm.polls = gotm.polls.map(p => {
    if (p.closed || p.openedAt >= cycleClock || !acc) return p;
    const winner = winnerOf(p);
    const w = p.entries[winner];
    // Kept slim once closed (the post keeps the full poll): a save has to fit
    // in localStorage.
    const closed: GotmPoll = { ...p, closed: true, winner, winnerIsYou: !!w?.isYou, entries: [], fanVotes: [] };
    posts = replacePost(posts, p.postId, post => (post.graphic?.type === "gotmPoll"
      ? { ...post, graphic: { ...post.graphic, closed: true, winner, userVote: p.userVote } } : post));
    if (w) {
      const rng = rngFor("gotm-winner", p.id);
      added.push({
        id: `${p.id}:winner`,
        at: cycleClock + 20,
        author: authorOf(acc),
        text: w.isYou
          ? `🏆 ${p.monthName} Goal of the Month: ${w.scorer}! ${w.detail}. The fans have spoken.`
          : `🏆 ${p.monthName} Goal of the Month: ${w.scorer} (${shortClub(w.club)}). ${w.detail}.`,
        graphic: {
          type: "goalVideo",
          title: `GOAL OF THE MONTH | ${w.scorerShort.toUpperCase()}`,
          clips: w.clipId ? [w.clipId] : [],
          ...(w.synth ? { synth: [synthOf(w)!] } : {}),
        },
        metrics: metricsFor(acc.followers, w.isYou ? 75 : 55, rng),
        eventId: "gotm-winner",
        tags: ["goal", "award"],
        scope: w.isYou ? "club" : "league",
      });
      if (w.isYou) gotm.boostDue = (gotm.boostDue ?? 0) + GOTM_FANS_BOOST;
    }
    return closed;
  });

  // 2. File this match's goals under their month.
  for (const e of yourEntries(before, fixture, stats, record)) gotm.goals.push({ ...e, season, month });

  // 3. Other players' best two of this month so far (kept per month, so the
  //    last month of a season still has them after the results reset).
  const rk = rivalKey(season, month);
  const rivals = pickRivalGoals(
    after.results ?? [], before.player.club, w => monthOfCareer(before, w) === month,
    `${season}-${month}-${before.player.club}`, competition, season, 2, shortClub,
  );
  if (rivals.length >= (gotm.rivals[rk]?.length ?? 0)) gotm.rivals[rk] = rivals;

  // 4. A month that has finished gets its poll (only the latest such month:
  //    a long gap never opens a pile of old polls at once).
  const done = gotm.goals.filter(g => keyOf(g.season, g.month) < now);
  if (done.length && acc) {
    const last = done.reduce((m, g) => Math.max(m, keyOf(g.season, g.month)), 0);
    const pSeason = Math.floor(last / 100), pMonth = last % 100;
    const id = `gotm-${pSeason}-${pMonth}`;
    if (!gotm.polls.some(p => p.id === id)) {
      const mine = bestOf(done.filter(g => keyOf(g.season, g.month) === last), 3)
        .map(({ season: _s, month: _m, ...e }) => e as GotmEntry);
      const theirs = gotm.rivals[rivalKey(pSeason, pMonth)] ?? [];
      // A poll needs a choice: one goal and nobody else's is no poll.
      if (mine.length + theirs.length >= 2) {
      const entries = [...mine, ...theirs].sort((a, b) => b.quality - a.quality);
      const seed = `${before.player.firstName}${before.player.lastName}-${id}`;
      const votes = fanVotes(entries, fameOf(after), seed);
      const userWeight = userWeightFor(votes);
      const monthName = MONTH_NAMES[pMonth] ?? "This month";
      const postId = `${id}:poll`;
      const rng = rngFor("gotm-poll", id);
      gotm.polls.push({
        id, season: pSeason, month: pMonth, monthName, postId, openedAt: cycleClock,
        entries, fanVotes: votes, userWeight,
      });
      added.push({
        id: postId,
        at: cycleClock + 30,
        author: authorOf(acc),
        text: theirs.length
          ? `🗳️ ${monthName} Goal of the Month. ${mine.length === 1 ? `${mine[0].scorerShort}'s goal is` : `${mine[0].scorerShort} has ${mine.length}`} up against the best of the rest. Which one gets your vote?`
          : `🗳️ ${monthName} Goal of the Month. Which of ${mine[0].scorerShort}'s ${mine.length} goals was the best? Your vote counts.`,
        graphic: { type: "gotmPoll", pollId: id, monthName, entries, fanVotes: votes, userWeight },
        metrics: metricsFor(acc.followers, 70, rng),
        eventId: "gotm-poll",
        tags: ["goal", "award"],
        scope: "club",
      });
      }
    }
  }
  // Everything before this month has had its chance.
  gotm.goals = gotm.goals.filter(g => keyOf(g.season, g.month) >= now);
  for (const k of Object.keys(gotm.rivals)) {
    const [s, m] = k.split("-").map(Number);
    if (keyOf(s, m) < now && !gotm.polls.some(p => !p.closed && p.season === s && p.month === m)) delete gotm.rivals[k];
  }
  const open = gotm.polls.filter(p => !p.closed);
  gotm.polls = [...gotm.polls.filter(p => p.closed).slice(-POLLS_KEPT), ...open];

  if (added.length) posts = [...posts, ...added].sort((a, b) => a.at - b.at).slice(-(media.studio?.postCap ?? POST_CAP));
  return { ...media, posts, gotm };
}

/**
 * Your vote: one tap per poll, on an open poll. A second tap, or a tap on a
 * closed poll, changes nothing.
 */
export function voteGoalOfMonth(career: CareerState, postId: string, index: number): CareerState {
  const media = career.media;
  if (!media) return career;
  const post = media.posts.find(p => p.id === postId);
  const g = post?.graphic;
  if (!g || g.type !== "gotmPoll" || g.closed || g.userVote !== undefined) return career;
  if (!Number.isInteger(index) || index < 0 || index >= g.entries.length) return career;
  const posts = replacePost(media.posts, postId, p => (p.graphic?.type === "gotmPoll" ? { ...p, graphic: { ...p.graphic, userVote: index } } : p));
  const gotm = media.gotm
    ? { ...media.gotm, polls: media.gotm.polls.map(p => (p.id === g.pollId && !p.closed ? { ...p, userVote: index } : p)) }
    : media.gotm;
  return { ...career, media: { ...media, posts, ...(gotm ? { gotm } : {}) } };
}

/** Pays the fans boost for a Goal of the Month you won (once). */
export function applyGoalOfMonthBoost(career: CareerState): CareerState {
  const due = career.media?.gotm?.boostDue ?? 0;
  if (!due || !career.media?.gotm) return career;
  const fans = Math.max(0, Math.min(100, (career.relationships?.fans ?? 50) + due));
  return {
    ...career,
    relationships: { ...career.relationships, fans },
    media: { ...career.media, gotm: { ...career.media.gotm, boostDue: 0 } },
  };
}
