import { makeInitialCareer, creditMatchResult } from "../../lib/star/careerFlow";
import { generateForMatch, generateForLeagueWeek, generateForCareer, feedFor, mediaOf } from "../../lib/star/media/feed";
import { clipsFor } from "../../lib/star/media/graphics";
import { clipStyleFor, clipVariantFor } from "../../lib/star/media/clipStyle";
import { buildMatchRecord } from "../../lib/star/media/record";
import { mulberry32 } from "../../lib/star/season";
import { GoalRecorder } from "../../lib/star/goalClip/recorder";
import { makeEdit, editDuration, editFrameCount, momentAt, posterMoment, shotLength, clipFileName, REPLAY_RATE, WIDE, TALL } from "../../lib/star/goalClip/edit";
import { trackDuration, type ClipBody, type GoalTrack } from "../../lib/star/goalClip/track";
import type { CareerState, GoalEvent, MatchStats, StarPlayer } from "../../lib/star/types";
import type { FootballEvent, StoredPost } from "../../lib/star/media/types";

/**
 * GOAL VIDEOS IN THE FEED (Leo, 7 Oct 2026: "it makes it look like theres
 * videos but you cant play them … Id love if it would show goals from the
 * match"). A post plays the goals it is about, and only goals that were seen;
 * a post with nothing seen carries no video. Plus the cuts a video is made of
 * (lib/star/goalClip/edit.ts).
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

// ── 1. Which goals a post plays ─────────────────────────────────────────────
{
  const c = newCareer(3);
  const fixture = c.fixtures.find(f => !f.played)!;
  const goals: GoalEvent[] = [
    { minute: 23, scorer: "Michael Sancho", isUserGoal: true, how: "one_on_one", distance: 12, clipId: "A" },
    { minute: 51, scorer: "Bukayo Saka", assist: "Michael Sancho", isUserGoal: false, how: "cutback", distance: 8, clipId: "B" },
    { minute: 77, scorer: "Michael Sancho", isUserGoal: true, how: "free_kick", distance: 24, clipId: "C" },
    { minute: 88, scorer: "Danny Reeves", isUserGoal: false, how: "cutback", distance: 6 },
  ];
  const stats: MatchStats = {
    chances: 5, goals: 2, assists: 1, passes: 30, rating: 8.6, starMan: true,
    bossChange: 1, teamChange: 1, fansChange: 2, wage: 1, goalBonus: 2, sponsorPay: 0, totalCash: 3,
    homeScore: 4, awayScore: 1, goalEvents: goals, minutes: 90,
  };
  const { career: after } = creditMatchResult(c, fixture, stats);
  const r = buildMatchRecord(c, after, fixture, stats);
  check(r.goals.filter(g => g.clipId).length === 3, `the record keeps each seen goal's recording (${r.goals.filter(g => g.clipId).length})`);
  const ev = (o: Partial<FootballEvent>): FootballEvent => ({
    id: "x", subject: { kind: "club", name: r.club }, facts: {}, tags: [], baseImportance: 50, window: "instant", ...o,
  });
  const ids = (e: FootballEvent) => clipsFor(e, r).join(",");
  check(ids(ev({ subject: { kind: "you", name: "Michael Sancho" }, tags: ["goal"], facts: { minute: 77 } })) === "C", `a post about your 77th-minute goal plays that goal (${ids(ev({ subject: { kind: "you", name: "Michael Sancho" }, tags: ["goal"], facts: { minute: 77 } }))})`);
  check(ids(ev({ subject: { kind: "you", name: "Michael Sancho" }, tags: ["goal"] })) === "A,C", "a post about your goals plays yours, in order");
  check(ids(ev({ id: "teammate-goal", subject: { kind: "teammate", name: "Bukayo Saka" }, tags: ["goal"], facts: { scorer: "Bukayo Saka" } })) === "B", "a team-mate's goal plays his");
  check(ids(ev({ id: "teammate-goal", subject: { kind: "teammate", name: "Danny Reeves" }, tags: ["goal"], facts: { scorer: "Danny Reeves" } })) === "",
    "a goal nobody saw plays nothing — never someone else's goal as if it were his");
  check(ids(ev({ subject: { kind: "you", name: "Michael Sancho" }, tags: ["goal"], facts: { minute: 88 } })) === "", "a post about an unseen minute plays nothing");
  check(ids(ev({ tags: ["drama"] })) === "A,B,C", "a post about the match plays every goal seen");
  check(ids(ev({ subject: { kind: "manager", name: "Boss" }, tags: ["manager"] })) === "", "a manager meme plays nothing");
  check(ids(ev({ id: "cheeky-miss", subject: { kind: "you", name: "Michael Sancho" }, tags: ["shame"] })) === "", "a missed penalty plays nothing");
  check(ids(ev({ facts: { club: "Somewhere Else FC" } })) === "", "another club's match plays nothing");
  check(clipsFor(ev({}), null).length === 0, "no match, no video");
}

// ── 2. Over many matches: videos only where goals were seen ─────────────────
{
  let c = newCareer(7);
  let thumbs = 0, withClips = 0, bad = 0, stillsWhenNothingSeen = 0, clipsWhenNothingSeen = 0;
  // The club's own goal post (TV pictures) and a fan's phone video.
  let videos = 0, clubVideos = 0, fanVideos = 0, videoBad = 0, videoWhenNothingSeen = 0, videoNotOneGoal = 0;
  let noHighlights = 0, highlightsShort = 0, noYours = 0;
  for (let m = 0; m < 30; m++) {
    const fixture = c.fixtures.find(f => !f.played && f.week === c.week) ?? c.fixtures.find(f => !f.played);
    if (!fixture) break;
    const rng = mulberry32(100 + m);
    const seenThisMatch = m % 3 !== 2;           // every third match was skipped: nothing seen
    const n = 1 + Math.floor(rng() * 3);
    const events: GoalEvent[] = [];
    const ids: string[] = [];
    const mineIds: string[] = [];
    for (let i = 0; i < n; i++) {
      const id = `m${m}-g${i}`;
      const mine = rng() < 0.6;
      if (mine && seenThisMatch) mineIds.push(id);
      events.push({
        minute: 5 + i * 25 + Math.floor(rng() * 20), scorer: mine ? "Michael Sancho" : "Danny Reeves",
        isUserGoal: mine, how: "one_on_one", distance: 10,
        ...(seenThisMatch ? { clipId: id } : {}),
      });
      if (seenThisMatch) ids.push(id);
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
    const fresh: StoredPost[] = mediaOf(after).posts.filter(p => !mediaOf(before).posts.some(q => q.id === p.id));
    // Every match: the highlights and your goals, always (Leo, 8 Oct 2026).
    const hl = fresh.filter(p => p.eventId === "match-highlights");
    const yh = fresh.filter(p => p.eventId === "your-highlights");
    const total = stats.homeScore + stats.awayScore;
    if (total > 0) {
      const g = hl[0]?.graphic;
      if (hl.length !== 1 || g?.type !== "goalVideo" || !g.priority) noHighlights++;
      else if (g.clips.length + (g.synth?.length ?? 0) !== total) highlightsShort++;
    } else if (hl.length) noHighlights++;
    if (goals > 0) {
      const g = yh[0]?.graphic;
      if ((yh.length !== 1 || g?.type !== "goalVideo" || !g.priority || g.clips.length + (g.synth?.length ?? 0) !== goals)) noYours++;
    }
    for (const p of fresh) {
      if (p.eventId === "match-highlights" || p.eventId === "your-highlights") continue;
      if (p.graphic?.type === "goalVideo") {
        videos++;
        if (p.author.archetype === "club") clubVideos++;
        if (p.author.archetype === "fan") fanVideos++;
        if (!p.graphic.clips.length || p.graphic.clips.some(id => !ids.includes(id))) videoBad++;
        if (!seenThisMatch) videoWhenNothingSeen++;
        // The club's full-time post plays every goal of ours that was seen, in
        // order; its goal posts are about YOUR goals: only yours.
        if (p.author.archetype === "club") {
          const fullTime = /Thank you for the support/.test(p.text);
          if (fullTime ? p.graphic.clips.join(",") !== ids.join(",") : p.graphic.clips.some(id => !mineIds.includes(id))) videoNotOneGoal++;
        }
        continue;
      }
      if (p.graphic?.type !== "thumbnail") continue;
      thumbs++;
      const cl = p.graphic.clips ?? [];
      if (cl.length) withClips++;
      if (cl.some(id => !ids.includes(id))) bad++;
      if (!seenThisMatch) { if (cl.length) clipsWhenNothingSeen++; else stillsWhenNothingSeen++; }
    }
    c = after;
  }
  check(noHighlights === 0, `every match with a goal gets one HIGHLIGHTS video, made first (${noHighlights} matches missed it)`);
  check(highlightsShort === 0, `the HIGHLIGHTS video holds every goal of the match, both sides (${highlightsShort} short)`);
  check(noYours === 0, `every match you score in gets a video of your goals, made first (${noYours} missed)`);
  check(thumbs > 0, `video-style posts happen (${thumbs})`);
  check(withClips > 0, `some of them play a real goal (${withClips} of ${thumbs})`);
  check(bad === 0, `a post never plays a goal from another match (${bad})`);
  check(clipsWhenNothingSeen === 0, `a match nobody watched never gets a video (${clipsWhenNothingSeen})`);
  check(clubVideos > 0, `the club posts its goal on the TV pictures (${clubVideos})`);
  check(fanVideos > 0, `fans post their phone video (${fanVideos})`);
  check(videoBad === 0, `a goal video only ever plays this match's seen goals (${videoBad} wrong)`);
  check(videoWhenNothingSeen === 0, `no goal video from a match nobody watched (${videoWhenNothingSeen})`);
  check(videoNotOneGoal === 0, `the club's full-time post plays the match's goals, its goal posts only yours (${videoNotOneGoal} wrong)`);
  console.log(`  feed: ${thumbs} video-style posts, ${withClips} play a real goal, ${stillsWhenNothingSeen} are pictures (nothing seen); goal videos: ${videos} (club ${clubVideos}, fans ${fanVideos})`);
}

// ── 3. The cuts ─────────────────────────────────────────────────────────────
function track(id: string, goalAt = 2.2): GoalTrack {
  const bodies: ClipBody[] = [
    { id: "you", role: "you", side: "us", kit: { shirt: "#ef4444", shorts: "#fff" } },
    { id: "keeper", role: "keeper", side: "them", kit: { shirt: "#facc15", shorts: "#111" } },
  ];
  const rec = new GoalRecorder();
  rec.begin(bodies);
  let t = 0, k = false, g = false;
  while (t < 1 + goalAt + 3) {
    t += 1 / 60;
    rec.frame(1 / 60, {
      ball: { x: 34, y: Math.max(-1, 14 - Math.max(0, t - 1) * 12), z: 0.5 },
      bodies: [{ x: 33, y: 15, z: 0 }, { x: 34, y: 0.6, z: 0 }],
      keeper: { dive: 0, lunge: 0, dir: 0, kind: null },
    });
    if (!k && t >= 1) { k = true; rec.event("shot", "you"); }
    if (!g && t >= 1 + goalAt) {
      g = true;
      rec.markGoal({ id, minute: 63, minuteLabel: "63", scorer: "Sam Carter", scorerShort: "Carter", scorerBody: "you", isYou: true, home: "Arsenal", away: "Chelsea", youAreHome: true });
    }
  }
  rec.finishNow();
  return rec.take()[0];
}
{
  const a = track("a"), b = track("b", 1.4);
  const wide = makeEdit([a], "broadcast");
  check(wide.w === WIDE.w && wide.h === WIDE.h, "TV and page videos are 16:9");
  check(makeEdit([a], "fan").w === TALL.w && makeEdit([a], "fan").h === TALL.h, "a fan's video is portrait");
  check(wide.shots.length === 3 && !wide.shots[0].replay && wide.shots[1].replay && wide.shots[2].replay && wide.shots[0].angle === "tv" && wide.shots[1].angle === "net" && wide.shots[2].angle === "high", "the club's video (cut 1): TV live, then replays from behind the goal and the spider-cam");
  // Every cut: live first, every replay covers the goal, from a camera other than the live one.
  for (const style of ["broadcast", "reverse", "tiktok"] as const) for (let v = 0; v < 3; v++) {
    const e = makeEdit([a], style, "old", v);
    const reps = e.shots.filter(sh => sh.replay);
    check(!e.shots[0].replay, `${style} cut ${v + 1}: starts live`);
    check(reps.length >= 1 && reps.every(sh => sh.from < a.goalT && sh.to > a.goalT && sh.rate < 1), `${style} cut ${v + 1}: every replay covers the goal, slowed`);
    if (style !== "tiktok") check(reps.every(sh => sh.angle !== e.shots[0].angle), `${style} cut ${v + 1}: replays from another camera`);
  }
  const cuts = new Set([0, 1, 2].map(v => makeEdit([a], "broadcast", "old", v).shots.map(sh => sh.angle).join(">")));
  check(cuts.size === 3, "the club's three cuts are three different videos");
  const tk = makeEdit([a], "tiktok", "old", 0);
  check(tk.w === TALL.w && tk.h === TALL.h, "a TikTok edit is portrait");
  check(tk.shots.some(sh => !sh.replay && sh.rate < 0.5 && sh.from <= a.strikeT && sh.to >= a.goalT), "a TikTok edit slows right down through the strike and the goal");
  check(tk.shots.some(sh => !!sh.caption), "a TikTok edit has captions");
  // An account always cuts its goals the same way; different accounts differ.
  check(clipVariantFor({ handle: "@GoalCamHD", name: "GoalCam", archetype: "aggregator", platform: "youtube" }) === clipVariantFor({ handle: "@GoalCamHD", name: "x", archetype: "aggregator", platform: "youtube" }), "an account's cut is fixed by its handle");
  check(clipStyleFor({ handle: "@x", name: "x", archetype: "meme", platform: "x" }) === "tiktok" && clipStyleFor({ handle: "@x", name: "x", archetype: "fan", platform: "tiktok" }) === "tiktok", "meme pages and TikTok accounts post the TikTok edit");
  const rev = makeEdit([a], "reverse");
  check(rev.shots[0].angle === "net" && rev.shots[1].angle === "tv", "a page's video: behind the goal, then TV slow motion");
  check(makeEdit([a], "fan").shots.length === 1, "a fan's video is one take");
  const rep = wide.shots[1];
  check(rep.from < a.goalT && rep.to > a.goalT && rep.rate === REPLAY_RATE, `the replay covers the goal, slowed (${rep.from.toFixed(2)}–${rep.to.toFixed(2)} at ${rep.rate}x)`);
  check(Math.abs(editDuration(wide) - wide.shots.reduce((t, sh) => t + shotLength(sh), 0)) < 1e-9, "the video's length is the shots' lengths");
  check(editFrameCount(wide) === Math.round(editDuration(wide) * wide.fps), "frames = length × 30");
  // Time only moves forward inside a shot, and every frame lands on a shot.
  let last = -1, lastShot = 0, ok = true;
  for (let i = 0; i < editFrameCount(wide); i++) {
    const m = momentAt(wide, i / wide.fps);
    if (m.shot !== lastShot) { lastShot = m.shot; last = -1; }
    if (m.t < last - 1e-9) ok = false;
    last = m.t;
  }
  check(ok, "inside each shot the goal plays forwards");
  const p = posterMoment(wide);
  check(p.shot === 0 && p.t < a.goalT && a.goalT - p.t < 0.3, `the still is the ball about to go in (${p.t.toFixed(2)} vs goal ${a.goalT.toFixed(2)})`);
  const reel = makeEdit([a, b], "broadcast");
  check(reel.shots.length === 3 && reel.shots[0].track === 0 && reel.shots[1].track === 1 && reel.shots[2].track === 1 && reel.shots[2].replay, "a reel: every goal live, then the last one again");
  check(clipFileName(a, "mp4") === "Goal-Carter-63-Arsenal-v-Chelsea.mp4", `a file name a phone keeps (${clipFileName(a, "mp4")})`);
  check(clipFileName([a, b], "webm") === "Highlights-Arsenal-v-Chelsea.webm", `a reel is named after the match, not its first goal (${clipFileName([a, b], "webm")})`);
  check(clipFileName(a, "mp4", "broadcast") === "Goal-Carter-63-Arsenal-v-Chelsea-TV.mp4" && clipFileName(a, "mp4", "fan") === "Goal-Carter-63-Arsenal-v-Chelsea-Fan-cam.mp4",
    `the TV and the fan's video of one goal save as two files (${clipFileName(a, "mp4", "broadcast")}, ${clipFileName(a, "mp4", "fan")})`);
}


// ── After the whistle: your match's videos on top, every time ──────────────
// Leo, 8 Oct 2026: "I want to finish my match and instantly see my loaded
// highlights of the game and my highlights, and THEN see other matches."
// The other matches of the week are in the same screen, as in the game.
{
  let c = newCareer(9);
  const rng = mulberry32(77);
  let played = 0, hlNotFirst = 0, yoursNotSecond = 0, brokenText = 0;
  for (let w = 0; w < 30; w++) {
    const fixture = c.fixtures.find(f => !f.played);
    if (!fixture) break;
    const us = Math.floor(rng() * 4), them = Math.floor(rng() * 3);
    const events: GoalEvent[] = [];
    let mine = 0, set = 0;
    for (let k = 0; k < us; k++) {
      const m = rng() < 0.5;
      const a = !m && rng() < 0.3;
      if (m) mine++; if (a) set++;
      events.push({ minute: 10 + k * 20, scorer: m ? "Michael Sancho" : "Bukayo Saka", ...(a ? { assist: "Michael Sancho" } : {}),
        isUserGoal: m, how: "one_on_one", distance: 10, ...(rng() < 0.5 ? { clipId: `p${w}-${k}` } : {}) });
    }
    const stats: MatchStats = {
      chances: 4, goals: mine, assists: set, passes: 20, rating: 7, starMan: false,
      bossChange: 0, teamChange: 0, fansChange: 0, wage: 1, goalBonus: 0, sponsorPay: 0, totalCash: 1,
      homeScore: us, awayScore: them, goalEvents: events, minutes: 90,
    };
    const { career: after } = creditMatchResult(c, fixture, stats);
    after.media = generateForMatch(c, after, fixture, stats);
    const others = (after.results ?? [])
      .filter(r => r.week === fixture.week && r.home !== after.player.club && r.away !== after.player.club)
      .map((x, i) => ({ ...x,
        hg: Array.from({ length: x.hs }, (_, k) => ({ m: 10 + k * 20, s: `H${i}`, full: `Hal H${i}` })),
        ag: Array.from({ length: x.as }, (_, k) => ({ m: 15 + k * 20, s: `A${i}`, full: `Abe A${i}` })) }));
    if (others.length) after.media = generateForLeagueWeek({ ...after, media: after.media }, others);
    // Every fourth match ends a month: the Player of the Month post is made
    // straight after it, as in app/star-dev/page.tsx. That used to push your
    // match off the post-match screen (seen in the game, 8 Oct 2026).
    if (w % 4 === 3) after.media = generateForCareer({ ...after, media: after.media },
      { kind: "award", won: false, award: "March Player of the Month", detail: "Someone else takes it." }, `potm-t-${w}`);
    const { posts } = feedFor(after, "moment");
    played++;
    if (us + them > 0 && posts[0]?.eventId !== "match-highlights") hlNotFirst++;
    if (mine + set > 0 && posts[us + them > 0 ? 1 : 0]?.eventId !== "your-highlights") yoursNotSecond++;
    const bad = posts.filter(p => /^-\.|\s-\.\s/.test(p.text));
    if (bad.length) console.log(bad.map(p => `${p.author.handle} ${p.eventId} ${p.text}`));
    brokenText += bad.length;
    c = after;
  }
  check(played >= 20, `enough matches (${played})`);
  check(hlNotFirst === 0, `the match's HIGHLIGHTS is the first post after every match with a goal (${hlNotFirst} not)`);
  check(yoursNotSecond === 0, `your goals' video comes straight after it (${yoursNotSecond} not)`);
  check(brokenText === 0, `no post reads "-." for a missing score (${brokenText})`);
}

if (problems.length) { console.error("goalVideoFeed FAILED:\n  - " + problems.join("\n  - ")); process.exit(1); }
console.log("goalVideoFeed: all checks passed");
