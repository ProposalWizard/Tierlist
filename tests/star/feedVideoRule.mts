/**
 * FOOTBALL TWITTER v2 (Leo, 31 Oct 2026): "NO MORE TWEETS ABOUT VIDEOS THAT
 * DONT HAVE VIDEOS U CAN WATCH", plus the variety and the old bugs.
 *
 * Plays two whole seasons on three seeds with the switch part on, keeps every
 * post ever made (the save keeps only the newest 150), and fails on:
 *  1. any post whose words point at a video (its own, a reply's) with no
 *     playable goal video attached (its own or the quoted post's);
 *  2. a video post with no goal in it, a recorded clip without its made
 *     stand-in, or a TikTok video without its sound line;
 *  3. an account using the same line twice inside FT_REPEAT_WEEKS weeks
 *     (read from the career memory, week by week);
 *  4. the old bugs: "AXED"/sacked lines for a manager arriving, a banter reply
 *     laughing at the side that won, poll shares that do not add up to 100,
 *     "im actually shaking. what a player" after a poor rating;
 *  5. other clubs' thrashings taking over the feed.
 */
import { setMediaUpdate } from "../../lib/star/media/updateFlags";
import { seasonsRun } from "../../scripts/football-twitter/run.mts";
import { feedFor, mediaOf, FT_REPEAT_WEEKS } from "../../lib/star/media/feed";
import { hasPlayableVideo } from "../../lib/star/media/twitter/videoWords";
import { shortClub } from "../../lib/star/media/grammar";
import type { StoredPost } from "../../lib/star/media/types";

setMediaUpdate({ footballTwitter: true });

const problems: string[] = [];
const fail = (what: string) => { if (problems.length < 40) problems.push(what); };

// An independent, deliberately broad list (not the one the feed uses).
const VIDEO_TALK = /\b(video|videos|clip|clips|edit|edits|edited|watch|replay|replays|footage|filmed|slow-?mo|highlights?|sound on|stream|streaming|live now|live reaction|full reaction|pov|wait for it|on loop|rewind)\b|🎥|📹|📼|▶/i;
const show = (p: StoredPost) => `${p.author.handle} [${p.eventId}] ${p.text.replace(/\n/g, " / ").slice(0, 110)}`;

let total = 0, videos = 0, tiktoks = 0, threads = 0, quotesWithVideo = 0;
const personasSeen = new Set<string>();
const weekOf = (at: number) => Math.floor(at / 1_000_000) * 52 + Math.floor((at % 1_000_000) / 10_000);

for (const seed of [4242, 77, 2026]) {
  const all = new Map<string, StoredPost>();
  const lastUse = new Map<string, number>();
  let repeats = 0;
  const c = seasonsRun(2, seed, step => {
    const m = mediaOf(step);
    for (const p of m.posts) all.set(p.id, p);
    // 3. A key that moves to a new week while its last use was under FT_REPEAT_WEEKS ago.
    for (const [k, w] of Object.entries(m.memory.ftSaid ?? {})) {
      const prev = lastUse.get(k);
      if (prev !== undefined && w !== prev && Math.abs(w - prev) < FT_REPEAT_WEEKS) {
        repeats++;
        if (repeats <= 3) fail(`seed ${seed}: "${k.slice(0, 80)}" used in week ${prev} and again in week ${w}`);
      }
      lastUse.set(k, w);
    }
  });
  const you = shortClub(c.player.club);
  const posts = Array.from(all.values());
  total += posts.length;
  for (const p of posts) {
    if (p.persona) personasSeen.add(p.persona);
    const words = [p.text, ...(p.thread ?? []).map(r => r.text)].join("\n");
    // 1. Video talk needs a video.
    if (VIDEO_TALK.test(words) && !hasPlayableVideo(p)) fail(`seed ${seed}: talks about a video with none: ${show(p)}`);
    // 2. Every video is a real one.
    const g = p.graphic;
    if (g && (g.type === "goalVideo" || g.type === "thumbnail")) {
      const n = (g.clips?.length ?? 0) + (g.synth?.length ?? 0);
      if (g.type === "goalVideo" && n === 0) fail(`seed ${seed}: an empty goal video: ${show(p)}`);
      if (n > 0) videos++;
      if (g.type === "goalVideo" && (p.persona || p.eventId.endsWith("highlights")) && g.clips.length && g.standIn?.length !== g.clips.length) {
        fail(`seed ${seed}: recorded clips without stand-ins: ${show(p)}`);
      }
      for (const id of g.clips ?? []) if (!id.startsWith("rec-")) fail(`seed ${seed}: a clip id that was never recorded (${id})`);
    }
    if (p.author.platform === "tiktok" && p.persona && hasPlayableVideo(p)) {
      tiktoks++;
      if (!p.sound) fail(`seed ${seed}: TikTok video with no sound line: ${show(p)}`);
    }
    if (p.sound && !hasPlayableVideo(p)) fail(`seed ${seed}: a sound line with no video: ${show(p)}`);
    if (p.thread?.length) threads++;
    if (p.quote?.graphic) quotesWithVideo++;
    // 4. Old bugs.
    if (p.eventId === "manager-in" && /AXED|sacked|leaves|clearing his desk|lose his job|lost that dressing room/i.test(p.text)) fail(`seed ${seed}: arriving manager treated as sacked: ${show(p)}`);
    if (p.graphic?.type === "poll") {
      const v = p.graphic.votes, sum = Math.max(1, v.reduce((a, b) => a + b, 0));
      const pct = v.reduce((a, b) => a + Math.round((b / sum) * 100), 0);
      if (pct !== 100) fail(`seed ${seed}: poll shares add to ${pct}%: ${show(p)}`);
    }
    if (/actually shaking\. what a player$/i.test(p.text.trim())) {
      const r = Number(p.text.match(/(\d+\.\d) rating/)?.[1] ?? NaN);
      if (!(r >= 6.5) && /poor-showing|anonymous|hammered|loss/.test(p.eventId)) fail(`seed ${seed}: "shaking, what a player" after a bad day: ${show(p)}`);
    }
    const yourWin = ["win", "rout", "derby-win", "comeback"].includes(p.eventId) && p.text.includes(you) && !p.text.includes(`${you} fans after`);
    if (yourWin && p.scope === "club") {
      for (const r of p.thread ?? []) {
        if (new RegExp(`(check on|not the) ${you} fans|${you} fans (are )?not going to like`, "i").test(r.text)) fail(`seed ${seed}: banter reply laughs at the winners: ${r.text} under ${show(p)}`);
      }
    }
  }
  if (repeats > 0) fail(`seed ${seed}: ${repeats} line(s) repeated inside ${FT_REPEAT_WEEKS} weeks`);
  // 5. Balance: other clubs' thrashings are a small part of what is shown.
  const shown = feedFor(c, "settled").posts;
  const thrash = shown.filter(p => p.scope === "league" && ["hammered", "rout", "embarrassed"].includes(p.eventId)).length;
  if (shown.length && thrash / shown.length > 0.15) fail(`seed ${seed}: other clubs' thrashings are ${thrash}/${shown.length} of the feed`);
}

if (personasSeen.size < 35) fail(`only ${personasSeen.size} kinds of invented account posted in six seasons`);
if (tiktoks < 5) fail(`only ${tiktoks} TikTok videos in six seasons`);
if (quotesWithVideo < 3) fail(`only ${quotesWithVideo} quotes carry their video`);

if (problems.length) {
  console.error(`FEED VIDEO RULE: ${problems.length} problem(s)\n - ${problems.join("\n - ")}`);
  process.exit(1);
}
console.log(`feed video rule ok: ${total} posts over 6 seasons, ${videos} with video, ${tiktoks} TikTok videos, ${quotesWithVideo} quoted videos, ${threads} with replies, ${personasSeen.size} kinds of account`);
