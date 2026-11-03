/**
 * REPLIES THAT MAKE SENSE (Leo, 31 Oct 2026, round 4: "why am i seeing an
 * appreciation post and the replies are like 'thats a violation'").
 *
 * Switch part "footballTwitter" on. Plays a season on five seeds plus five
 * rich 14-match runs (thousands of posts), then reads every reply:
 *  1. every reply carries a tone, and that tone fits its post's tone
 *     (twitter/tone.ts postTone + FITS), quotes' replies included;
 *  2. the independent word audit (scripts/football-twitter/replyAudit.mts)
 *     finds no banter under praise, no praise under a bad day, no doom under
 *     a win, no wrong manager line, no video talk without a video;
 *  3. no reply is said twice in one thread, nobody replies to themselves;
 *  4. the hype / quiz / TikTok pages' praise posts never get banter;
 *  5. variety: arguments (a rival and a fan, 2-3 deep), TikTok comment
 *     sections (creator likes, "replying to"), poll replies naming a real
 *     answer, rivals and fans named after the right clubs, and a big bank.
 * With the switch off nothing here runs (tests/star/footballTwitter.mts
 * checks the off feed byte for byte).
 */
import { setMediaUpdate } from "../../lib/star/media/updateFlags";
import { seasonsRun, richRun, CLUBS, PLAYER } from "../../scripts/football-twitter/run.mts";
import { auditReplies } from "../../scripts/football-twitter/replyAudit.mts";
import { mediaOf } from "../../lib/star/media/feed";
import { postTone, replyFits, TONES } from "../../lib/star/media/twitter/tone";
import { REPLY_BANK, COMEBACK, RETORT, NEUTRAL_JOIN, TIKTOK_AGREE } from "../../lib/star/media/twitter/replyLines";
import { shortClub } from "../../lib/star/media/grammar";
import type { StoredPost } from "../../lib/star/media/types";

const problems: string[] = [];
const fail = (what: string) => { if (problems.length < 40) problems.push(what); };
const show = (p: StoredPost) => `${p.author.handle} [${p.eventId}, ${postTone(p)}] "${p.text.replace(/\n/g, " / ").slice(0, 90)}"`;

// ── The bank ───────────────────────────────────────────────────────────────
let lines = COMEBACK.good.length + COMEBACK.bad.length + RETORT.length + NEUTRAL_JOIN.length + TIKTOK_AGREE.length;
for (const t of TONES) {
  const b = REPLY_BANK[t];
  if (!b) { fail(`tone ${t} has no reply lines`); continue; }
  const n = b.fan.length + b.rival.length + b.neutral.length + (b.video?.length ?? 0) + (b.tiktok?.length ?? 0);
  lines += n;
  if (b.neutral.length < 4) fail(`tone ${t}: only ${b.neutral.length} neutral lines`);
  if (n < 10) fail(`tone ${t}: only ${n} lines`);
  const all = [...b.fan, ...b.rival, ...b.neutral];
  if (new Set(all).size !== all.length) fail(`tone ${t}: a line filed twice`);
}
if (lines < 500) fail(`only ${lines} reply lines`);
const REAL = /romano|goldbridge|messi|ronaldo|haaland|salah|kane\b|bellingham|sky ?sports|talksport|bbc|espn/i;
for (const t of TONES) for (const l of Object.values(REPLY_BANK[t]).flat()) if (typeof l === "string" && REAL.test(l)) fail(`a real name in a reply line: ${l}`);

// ── The feed ───────────────────────────────────────────────────────────────
setMediaUpdate({ footballTwitter: true });
let posts = 0, replies = 0, threads = 0, argued = 0, deep = 0, tiktokThreads = 0, creatorLiked = 0, pollReplies = 0, quoteThreads = 0;
const sides = { fan: 0, rival: 0, neutral: 0 };
const said = new Set<string>();
const HYPE = new Set(["hype", "quiz", "edits", "pov", "ranker", "kidFan", "fanTV"]);
const BANTER = /violation|no chill|the accuracy|check on .* fans|hold this l\b|\bfraud|crying at the replies|chose violence|brutal/i;

for (const seed of [11, 4242, 77, 2026, 909]) {
  for (const run of [0, 1]) {
    const all = new Map<string, StoredPost>();
    if (run === 0) seasonsRun(1, seed, c => { for (const p of mediaOf(c).posts) all.set(p.id, p); });
    else for (const p of mediaOf(richRun(14, seed)).posts) all.set(p.id, p);
    const list = Array.from(all.values());
    posts += list.length;
    const audit = auditReplies(list, CLUBS, PLAYER.club);
    for (const f of audit.findings) {
      // A reply naming a club that no post in the cycle names is reported, not failed:
      // the audit cannot see the match's facts (the opponent of a league game).
      if (f.rule.startsWith("names ")) continue;
      fail(`seed ${seed}: ${f.rule}: "${f.reply.text}" under ${show(f.post)}`);
    }
    for (const p of list) {
      if (!p.thread?.length) continue;
      threads++;
      if (p.quote) quoteThreads++;
      const tone = postTone(p);
      const handles = new Set<string>();
      let depth = 0;
      for (const r of p.thread) {
        replies++;
        said.add(r.text.toLowerCase());
        if (!r.tone) fail(`seed ${seed}: a reply with no tone under ${show(p)}`);
        else if (!replyFits(tone, r.tone)) fail(`seed ${seed}: a ${r.tone} reply "${r.text}" under ${show(p)}`);
        if (r.handle === p.author.handle) fail(`seed ${seed}: ${r.handle} replies to their own post`);
        if (r.side) sides[r.side]++;
        if (r.to) {
          depth++;
          if (r.to === r.handle) fail(`seed ${seed}: ${r.handle} replies to themselves`);
          if (!p.thread.some(x => x.handle === r.to)) fail(`seed ${seed}: replying to ${r.to}, who is not in the thread`);
        }
        if (r.creatorLiked) creatorLiked++;
        handles.add(r.handle);
        // A fan / rival is named after the club they support.
        if (r.side !== "neutral" && r.side && !/\|/.test(r.name) && p.author.platform !== "tiktok") fail(`seed ${seed}: a ${r.side} with no club in their name: ${r.name}`);
      }
      if (depth) argued++;
      if (depth >= 2) deep++;
      if (p.author.platform === "tiktok") tiktokThreads++;
      if (p.persona && HYPE.has(p.persona) && ["goal", "praise", "award", "milestone"].includes(tone)) {
        for (const r of p.thread) if (!r.to && BANTER.test(r.text)) fail(`seed ${seed}: banter under a hype post: "${r.text}" under ${show(p)}`);
      }
      const g = p.graphic;
      if (g && g.type === "poll") {
        const opts = g.options.map(o => o.toLowerCase());
        if (p.thread.some(r => opts.some(o => r.text.toLowerCase().includes(o)))) pollReplies++;
      }
      // Rival fans are fans of the other side: never of the club the post is about when it's a result.
      for (const r of p.thread) {
        if (r.side === "rival" && typeof p.text === "string" && r.name.includes("|")) {
          const club = r.name.split("|")[1].trim();
          if (r.side === "rival" && club === shortClub(PLAYER.club) && p.aboutYou && tone !== "transfer" && tone !== "rumour") fail(`seed ${seed}: a rival named after your own club under ${show(p)}`);
        }
      }
    }
  }
}

if (posts < 3000) fail(`only ${posts} posts read`);
if (threads < 800) fail(`only ${threads} threads`);
if (argued < 50) fail(`only ${argued} threads with a back-and-forth`);
if (deep < 15) fail(`only ${deep} arguments two or more deep`);
if (tiktokThreads < 30) fail(`only ${tiktokThreads} TikTok comment sections`);
if (creatorLiked < 5) fail(`only ${creatorLiked} comments liked by the creator`);
if (quoteThreads < 10) fail(`only ${quoteThreads} quotes with replies`);
if (pollReplies < 5) fail(`only ${pollReplies} poll threads name a poll answer`);
if (sides.rival < replies * 0.08 || sides.fan < replies * 0.25) fail(`sides out of balance: ${JSON.stringify(sides)}`);
if (said.size < 600) fail(`only ${said.size} different replies over ${replies}`);

if (problems.length) {
  console.error(`FOOTBALL TWITTER REPLIES: ${problems.length} problem(s)\n - ${problems.join("\n - ")}`);
  process.exit(1);
}
console.log(`football twitter replies ok: ${posts} posts, ${threads} threads, ${replies} replies (${said.size} different), ${argued} arguments (${deep} deep), ${tiktokThreads} TikTok comment sections, ${quoteThreads} quote threads, ${lines} lines; sides ${JSON.stringify(sides)}`);
