import { makeInitialCareer, creditMatchResult } from "../../lib/star/careerFlow";
import { generateForMatch, generateForCareer, feedFor, mediaOf, hasFreshMedia } from "../../lib/star/media/feed";
import { templateCount } from "../../lib/star/media/templates";
import { MATCH_DETECTORS, CAREER_DETECTORS, detectMatch } from "../../lib/star/media/detect";
import { buildMatchRecord } from "../../lib/star/media/record";
import { emptyMemory, absorbMatch } from "../../lib/star/media/memory";
import { mulberry32 } from "../../lib/star/season";
import type { CareerState, GoalEvent, MatchStats, StarPlayer } from "../../lib/star/types";
import type { Archetype, StoredPost } from "../../lib/star/media/types";

/**
 * THE FOOTBALL MEDIA ENGINE
 *
 * Statistical rather than golden-file, because the output is generative: there
 * is no "correct" post to compare against, only distributions that either look
 * like a football media world or do not.
 *
 * Four things these measurements caught while the engine was being written, all
 * of them invisible in a handful of hand-read samples:
 *
 *  · The form thread reached "67 goals in 25 matches". It summed goals across
 *    every event that touched it, and a hat-trick fires four detectors.
 *  · Two stat accounts posted the identical line a minute apart, and so did
 *    both broadsheets, and so did two supporters. Nothing stopped a template
 *    being used twice in one cycle.
 *  · `position` meant your position on the pitch AND the club's position in the
 *    table. Whichever wrote last won: "Arsenal — NaNth, 43 points".
 *  · The tabloid typed in lower case, because "raw register" was doing double
 *    duty as "types like a fan".
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const CLUBS = [
  "Arsenal", "Aston Villa", "Bournemouth", "Brentford", "Brighton", "Chelsea",
  "Crystal Palace", "Everton", "Fulham", "Ipswich", "Leicester", "Liverpool",
  "Man City", "Man United", "Newcastle", "Nottingham Forest", "Southampton",
  "Tottenham", "West Ham", "Wolves",
];
const HOWS = ["one_on_one", "tight_angle", "long_range", "volley", "header",
  "penalty", "free_kick", "cutback", "through_ball", "rebound"];

function newCareer(seed = 1): CareerState {
  const player: StarPlayer = {
    firstName: "Michael", lastName: "Sancho", age: 18, skinTone: "light",
    club: CLUBS[seed % CLUBS.length], clubBadge: null, position: "ST",
    nationality: "England", startYear: 2026,
  };
  return makeInitialCareer(player, CLUBS);
}

/** Play one fixture with a scripted or rolled result, and generate the cycle. */
function playOne(career: CareerState, seed: number, force: Partial<MatchStats> = {}): CareerState {
  const fixture = career.fixtures.find(f => !f.played && f.week === career.week)
    ?? career.fixtures.find(f => !f.played);
  if (!fixture) return career;
  const rng = mulberry32(seed);
  const goals = force.goals ?? (rng() < 0.4 ? Math.floor(rng() * 3) + 1 : 0);
  const us = force.homeScore ?? Math.max(goals, Math.floor(rng() * 4));
  const them = force.awayScore ?? Math.floor(rng() * 3);
  const events: GoalEvent[] = [];
  for (let i = 0; i < goals; i++) {
    events.push({
      minute: 3 + Math.floor(rng() * 88), scorer: "Michael Sancho", isUserGoal: true,
      how: HOWS[Math.floor(rng() * HOWS.length)], distance: 4 + Math.round(rng() * 28),
    });
  }
  for (let i = goals; i < us; i++) {
    events.push({
      minute: 3 + Math.floor(rng() * 88), scorer: "Danny Reeves",
      assist: "Michael Sancho", isUserGoal: false, how: "cutback", distance: 8,
    });
  }
  const stats: MatchStats = {
    chances: 3 + Math.floor(rng() * 4), goals,
    assists: force.assists ?? (rng() < 0.25 ? 1 : 0),
    passes: 20 + Math.floor(rng() * 20),
    rating: force.rating ?? Math.round((5.2 + rng() * 3.8) * 10) / 10,
    starMan: goals >= 2, bossChange: 1, teamChange: 1, fansChange: 2,
    wage: 1, goalBonus: goals, sponsorPay: 0, totalCash: 3,
    homeScore: us, awayScore: them, goalEvents: events, minutes: 90, ...force,
  };
  const { career: after } = creditMatchResult(career, fixture, stats);
  after.media = generateForMatch(career, after, fixture, stats);
  return after;
}

function season(seed: number, weeks = 20): CareerState {
  let c = newCareer(seed);
  for (let w = 1; w <= weeks; w++) c = playOne(c, seed * 1000 + w);
  return c;
}

// ── It runs, and it always says something ───────────────────────────────────
{
  let matches = 0, silent = 0, crashed = 0;
  let c = newCareer(3);
  for (let w = 1; w <= 36; w++) {
    if (!c.fixtures.some(f => !f.played)) break;
    try { c = playOne(c, 7000 + w); } catch { crashed++; continue; }
    matches++;
    // Counting the ARRAY is wrong once the 150-post cap bites: it stops growing
    // and every later match reads as silent. What matters is whether this
    // cycle put anything in it.
    const state = mediaOf(c);
    if (!state.posts.some(p => p.id.startsWith(state.lastCycleId))) silent++;
  }
  check(crashed === 0, `no match takes the feed down (${crashed} threw)`);
  check(matches > 30, `matches were actually played (${matches})`);
  // A feed that is empty after a football match is the feature reading as
  // broken, which is why select.ts carries an explicit fallback pairing.
  check(silent === 0, `every match produces at least one post (${silent} silent)`);
}

// ── Determinism ─────────────────────────────────────────────────────────────
{
  // Same career, same match, twice — character for character. The career has
  // already shipped three bugs from state that should have been derived and was
  // lost on reload; this one is derived, so it must survive the reload.
  const a = season(11, 12);
  const b = season(11, 12);
  const pa = mediaOf(a).posts, pb = mediaOf(b).posts;
  check(pa.length === pb.length, `the same career generates the same number of posts (${pa.length} vs ${pb.length})`);
  const same = pa.every((p, i) => p.text === pb[i]?.text && p.author.handle === pb[i]?.author.handle);
  check(same, "…and the identical text from the identical accounts");

  // A replayed match must not post twice.
  const c = season(12, 6);
  const fixture = c.fixtures.find(f => f.played)!;
  const before = mediaOf(c).posts.length;
  const again = generateForMatch(c, c, fixture, {
    chances: 1, goals: 0, assists: 0, passes: 1, rating: 6, starMan: false,
    bossChange: 0, teamChange: 0, fansChange: 0, wage: 0, goalBonus: 0,
    sponsorPay: 0, totalCash: 0, homeScore: 1, awayScore: 0,
  });
  check(again.posts.length >= before, "a replayed cycle never loses posts");
}

// ── Nothing is said twice in the same breath ────────────────────────────────
{
  const c = season(21, 30);
  const posts = mediaOf(c).posts;
  let dupWindow = 0;
  for (let i = 0; i < posts.length; i++) {
    for (let j = i + 1; j < Math.min(posts.length, i + 12); j++) {
      if (posts[i].text === posts[j].text) dupWindow++;
    }
  }
  check(dupWindow === 0, `no post repeats within a twelve-post window (${dupWindow})`);

  // …and no post is a broken sentence. An unresolved slot means a template
  // asked for a fact its event does not carry, which render() drops — this is
  // the belt to that braces.
  const broken = posts.filter(p => /\{|\}/.test(p.text) || /\s{2,}/.test(p.text) || p.text.trim() === "");
  check(broken.length === 0, `no post has a hole in it (${broken.length}: ${broken[0]?.text ?? ""})`);
}

// ── The voices are measurably different ─────────────────────────────────────
{
  // "They feel different" is not a thing you can assert. "The tabloid is 40%
  // shorter and shouts eight times as often" is.
  let c = newCareer(31);
  for (let w = 1; w <= 34; w++) c = playOne(c, 31_000 + w);
  const posts = mediaOf(c).posts;

  const by = (a: Archetype) => posts.filter(p => p.author.archetype === a);
  const meanLen = (ps: StoredPost[]) => ps.length ? ps.reduce((s, p) => s + p.text.length, 0) / ps.length : 0;
  const capsRate = (ps: StoredPost[]) => ps.length
    ? ps.filter(p => /[A-Z]{4,}/.test(p.text)).length / ps.length : 0;
  const lowerRate = (ps: StoredPost[]) => ps.length
    ? ps.filter(p => p.text === p.text.toLowerCase()).length / ps.length : 0;

  const bs = by("broadsheet"), tab = by("tabloid"), fan = by("fan"), st = by("stats");
  check(bs.length >= 5 && tab.length >= 5 && fan.length >= 5 && st.length >= 5,
    `every voice gets a hearing (bs ${bs.length}, tab ${tab.length}, fan ${fan.length}, stats ${st.length})`);
  check(meanLen(bs) > meanLen(tab) * 1.4,
    `the broadsheet writes longer than the tabloid (${meanLen(bs).toFixed(0)} vs ${meanLen(tab).toFixed(0)})`);
  check(capsRate(tab) > capsRate(bs) + 0.3,
    `and the tabloid shouts and the broadsheet does not (${capsRate(tab).toFixed(2)} vs ${capsRate(bs).toFixed(2)})`);
  check(lowerRate(fan) > 0.3, `supporters type in lower case (${lowerRate(fan).toFixed(2)})`);
  check(lowerRate(tab) < 0.15, `and back pages do not (${lowerRate(tab).toFixed(2)})`);
  check(capsRate(st) < 0.35, `the stat page states rather than shouts (${capsRate(st).toFixed(2)})`);
}

// ── Rivals want what you don't ──────────────────────────────────────────────
{
  let c = newCareer(41);
  for (let w = 1; w <= 30; w++) {
    // Alternate a good afternoon and a humiliation, so both are available.
    c = w % 2 === 0
      ? playOne(c, 41_000 + w, { goals: 2, homeScore: 3, awayScore: 0, rating: 8.5 })
      : playOne(c, 41_000 + w, { goals: 0, homeScore: 0, awayScore: 4, rating: 4.8 });
  }
  const rival = mediaOf(c).posts.filter(p => p.author.archetype === "rivalFan");
  check(rival.length >= 5, `the rival shows up (${rival.length})`);
  const gloating = rival.filter(p => p.tags.includes("shame") || p.tags.includes("drama")).length;
  check(gloating / Math.max(1, rival.length) > 0.5,
    `and shows up mostly for the bad ones (${gloating}/${rival.length})`);
}

// ── The thread arithmetic ───────────────────────────────────────────────────
{
  // Three matches: 3 goals, then 2, then 1. The engine must be able to say
  // "six in three" and must never say "six in six" or, as it once did,
  // "sixty-seven in twenty-five".
  let c = newCareer(51);
  c = playOne(c, 1, { goals: 3, homeScore: 4, awayScore: 0, rating: 9.1 });
  c = playOne(c, 2, { goals: 2, homeScore: 2, awayScore: 1, rating: 8.4 });
  c = playOne(c, 3, { goals: 1, homeScore: 1, awayScore: 0, rating: 8.0 });

  const thread = mediaOf(c).memory.threads.find(t => t.key === "form-hot");
  check(!!thread, "a hot-form thread opened");
  if (thread) {
    const g = Number(thread.facts.goals ?? 0), m = Number(thread.facts.matches ?? 0);
    check(g === 6 && m === 3, `and it knows six in three, not ${g} in ${m}`);
  }
  check(mediaOf(c).memory.streaks.scoring === 3, "and the scoring streak is three");

  // Twenty more matches must not let the numbers run away.
  let d = c;
  for (let w = 4; w <= 24; w++) d = playOne(d, 51_000 + w, { goals: 1, homeScore: 1, awayScore: 0, rating: 7.5 });
  const later = mediaOf(d).memory.threads.find(t => t.key === "form-hot");
  if (later) {
    const g = Number(later.facts.goals ?? 0), m = Number(later.facts.matches ?? 1);
    // The rate is what has to stay sane. The WINDOW is allowed to be long —
    // scoring in twenty-four straight is a real thing that happens and is worth
    // a headline; sixty-seven goals in twenty-five matches is not.
    check(g / m <= 3, `a season on, the run is a rate a footballer could have (${g} in ${m})`);
  }
}

// ── Rarity: the fifth is not the first ──────────────────────────────────────
{
  let c = newCareer(61);
  const importances: number[] = [];
  for (let i = 0; i < 8; i++) {
    const before = c;
    c = playOne(c, 61_000 + i, { goals: 3, homeScore: 3, awayScore: 0, rating: 9.0 });
    const fixture = before.fixtures.find(f => !f.played)!;
    const rec = buildMatchRecord(before, c, fixture, {
      chances: 5, goals: 3, assists: 0, passes: 20, rating: 9, starMan: true,
      bossChange: 1, teamChange: 1, fansChange: 3, wage: 1, goalBonus: 3,
      sponsorPay: 0, totalCash: 4, homeScore: 3, awayScore: 0, goalEvents: [],
    });
    const events = detectMatch(rec, absorbMatch(mediaOf(before).memory, rec));
    const ht = events.find(e => e.id === "hat-trick");
    if (ht) importances.push(ht.baseImportance);
  }
  check(importances.length >= 5, `hat-tricks were detected (${importances.length})`);
  // Base importance is constant; the scaling lives in importance.ts, so what
  // this proves is that the SEEN counter is rising and available to it.
  const seen = mediaOf(c).memory.seen["hat-trick"] ?? 0;
  check(seen >= 5, `and the engine remembers how many there have been (${seen})`);
}

// ── Career moments go through the same pipeline ─────────────────────────────
{
  let c = season(71, 8);
  const before = mediaOf(c).posts.length;
  c = { ...c, media: generateForCareer(c, { kind: "transfer", from: c.player.club, to: "Real Madrid", fee: 65 }, "t1") };
  const afterTransfer = mediaOf(c).posts.length;
  check(afterTransfer > before, `a transfer produces a cycle (+${afterTransfer - before})`);
  const insider = mediaOf(c).posts.slice(before).some(p => p.author.archetype === "insider");
  check(insider, "…and the transfer insider is in it");

  c = { ...c, media: generateForCareer(c, { kind: "ballon-dor", won: true, total: 1 }, "b1") };
  check(mediaOf(c).posts.length > afterTransfer, "a Ballon d'Or produces one too");

  c = { ...c, media: generateForCareer(c, { kind: "manager-out", name: "Bob Sharp", incoming: "Rui Faria", reason: "Five without a win." }, "m1") };
  const sacked = mediaOf(c).posts.some(p => /sack|leaves|axed/i.test(p.text));
  check(sacked, "and a sacking is reported as one");
}

// ── The news cycle has a shape ──────────────────────────────────────────────
{
  const c = season(81, 10);
  const instant = feedFor(c, "moment").posts.length;
  const settled = feedFor(c, "settled").posts.length;
  check(settled > instant, `walking out of the ground shows less than the week does (${instant} vs ${settled})`);
  check(instant >= 1, "…but it shows something");
}

// ── Walking out of the ground shows THIS match ──────────────────────────────
//
// The post-match screen was bounded above and not below, so its early `now`
// correctly hid the waves that had not landed yet and hid nothing at all of
// every match before it — all of which are timestamped earlier and therefore
// passed the filter. Four games in, the reaction to the game you had just
// played sat at the bottom of a month of history. Reported as exactly that.
{
  for (const weeks of [1, 2, 4, 10, 20]) {
    const c = season(64, weeks);
    const state = mediaOf(c);
    const { posts } = feedFor(c, "moment");
    const stale = posts.filter(p => p.at < state.lastCycleClock);
    check(stale.length === 0,
      `after ${weeks} match(es), the reaction is only this match's (${stale.length} stale posts)`);
    check(posts.length > 0, `after ${weeks} match(es), the reaction is not empty`);
    // And it does not grow with the season, which is the shape of the bug.
    check(posts.length < 14, `after ${weeks} match(es), it is a screenful (${posts.length})`);
  }

  // The screen is only ever opened when there is something on it.
  let opened = 0, empty = 0;
  let c = newCareer(65);
  for (let w = 1; w <= 24; w++) {
    if (!c.fixtures.some(f => !f.played)) break;
    c = playOne(c, 65_000 + w);
    if (!hasFreshMedia(c)) continue;
    opened++;
    if (feedFor(c, "moment").posts.length === 0) empty++;
  }
  check(opened > 15, `the reaction screen opens most weeks (${opened})`);
  check(empty === 0, `and never opens on an empty page (${empty} times)`);
}

// ── The Feed keeps about a month, and no more ───────────────────────────────
{
  const c = season(66, 20);
  const { posts, now } = feedFor(c, "settled");
  const week = (at: number) => Math.floor((at % 1_000_000) / 10_000);
  const oldest = Math.min(...posts.map(p => p.at));
  check(posts.length > 0, "the Feed has something in it");
  check(week(now) - week(oldest) <= 4,
    `the Feed reaches back about a month, not a season (${week(now) - week(oldest)} weeks)`);
  check(mediaOf(c).posts.length > posts.length,
    "…while the history behind it is still kept, for the record");
}

// ── It fits in a save ───────────────────────────────────────────────────────
{
  let c = newCareer(91);
  for (let w = 1; w <= 120; w++) c = playOne(c, 91_000 + w);
  const bytes = JSON.stringify(c.media).length;
  check(mediaOf(c).posts.length <= 150, `the feed is capped (${mediaOf(c).posts.length})`);
  check(bytes < 90_000, `and stays small enough for localStorage (${(bytes / 1024).toFixed(1)} KB after 120 matches)`);
  check(mediaOf(c).memory.recent.length <= 12, "memory stays bounded too");
}

// ── Coverage ────────────────────────────────────────────────────────────────
{
  check(MATCH_DETECTORS.length >= 40, `enough detectors to notice things (${MATCH_DETECTORS.length})`);
  check(CAREER_DETECTORS.length >= 8, `…including away from a Saturday (${CAREER_DETECTORS.length})`);
  check(templateCount() >= 100, `enough authored lines (${templateCount()})`);

  // Every detector must fire SOMETIMES and none must fire ALWAYS. One that
  // never fires is dead content; one that always fires is not an event.
  let c = newCareer(101);
  const fired = new Map<string, number>();
  let matches = 0;
  for (let w = 1; w <= 90; w++) {
    const before = c;
    const forced = w % 9 === 0 ? { goals: 3, homeScore: 4, awayScore: 1, rating: 9.0 }
      : w % 7 === 0 ? { goals: 0, homeScore: 0, awayScore: 4, rating: 4.6 }
      : w % 5 === 0 ? { goals: 1, homeScore: 1, awayScore: 0, rating: 7.8 } : {};
    c = playOne(c, 101_000 + w, forced);
    const fixture = before.fixtures.find(f => !f.played);
    if (!fixture) break;
    matches++;
    for (const [id, n] of Object.entries(mediaOf(c).memory.seen)) fired.set(id, n);
  }
  const always = [...fired.entries()].filter(([id, n]) => n >= matches && id !== "win" && id !== "draw" && id !== "loss");
  check(always.length === 0, `no detector fires on every single match (${always.map(a => a[0]).join(", ")})`);
  check(fired.size >= 20, `a wide spread of events actually occurs (${fired.size} distinct)`);
}

// ── A scorer stands under his own team ──────────────────────────────────────
//
// "Forest 0-1 Liverpool" with "Isak 59'" printed under Forest reads as Forest
// having scored in a game they lost. The goals belong to a side, so they are
// listed on that side.
{
  let seen = 0, wrongSide = 0;
  let c = newCareer(73);
  for (let w = 1; w <= 20; w++) {
    if (!c.fixtures.some(f => !f.played)) break;
    const fixture = c.fixtures.find(f => !f.played)!;
    const wasHome = fixture.home;
    c = playOne(c, 73_000 + w);
    // Only this week's — the feed keeps the previous matches too, and they were
    // played at the other end of the country.
    const cycle = mediaOf(c).lastCycleId;
    for (const p of mediaOf(c).posts.filter(x => x.id.startsWith(cycle))) {
      const g = p.graphic;
      if (!g || g.type !== "scoreline") continue;
      const ours = wasHome ? g.homeScorers ?? [] : g.awayScorers ?? [];
      const theirs = wasHome ? g.awayScorers ?? [] : g.homeScorers ?? [];
      if (ours.length + theirs.length === 0) continue;
      seen += 1;
      // Only our goals are ever named, so the other side must always be empty.
      if (theirs.length > 0) wrongSide += 1;
    }
  }
  check(seen > 5, `scorelines with goals on them were produced (${seen})`);
  check(wrongSide === 0, `every scorer is listed under his own team (${wrongSide} were not)`);
}

if (problems.length) {
  console.log("FAIL");
  for (const p of problems) console.log("  ✗ " + p);
  process.exit(1);
}
console.log("PASS — the world reacts, in thirteen different voices, and remembers");
