/**
 * tests/star/teamRoomChannels.mts — the Team room's channels, threads,
 * reactions, private DMs and bot posts (lib/teamRoom/channels.ts; Harry,
 * 23 Oct 2026). Run: npx tsx tests/star/teamRoomChannels.mts
 */
import {
  BUILT_IN_CHANNELS, GENERAL, JOBS_CHANNEL, PATCH_CHANNEL, REACTIONS, channelMentions, channelOf, channelStream, channelUnread, cleanName,
  dmAsMessage, dmUnread, dmsWith, isSlug, jobBotPosts, jobDoneBy, jobIsFor, listChannels, mergeStream, newChannelSlug, newestIn, patchBotPosts,
  pinsIn, placeFrom, reactionsOn, roomCounts, roomUrl, rowBotPosts, slugify, tagChannel, threadOf, threadSummary, whoReacted, withReaction,
  withoutChannel, type ChannelRow, type TeamDm, type TeamReaction,
} from "@/lib/teamRoom/channels";
import { composeBody, parseMessage, quoteLine } from "@/lib/teamRoom/extras";
import { chatTag, mayRing, payloadForDm, payloadForMessage, ringsForDm, ringsForMessage } from "@/lib/teamRoom/notify";
import { payloadForPatches } from "@/lib/teamRoom/inbox";
import { markerTitle, type TeamJob } from "@/lib/teamRoom/jobs";
import type { TeamMessage, TeamTask } from "@/lib/teamRoom/logic";

let failed = 0;
const ok = (c: boolean, what: string) => { if (!c) { failed++; console.error(`  FAIL ${what}`); } else console.log(`  ✓ ${what}`); };
const at = (min: number) => new Date(Date.UTC(2026, 9, 23, 10, min)).toISOString();
const msg = (id: number, person: TeamMessage["person"], body: string, min = id): TeamMessage =>
  ({ id, person, body, image_url: null, page: null, pinned: false, created_at: at(min) });

console.log("Channels: the list");
const rows: ChannelRow[] = [
  { slug: "ideas", name: "Ideas Lab", topic: "renamed", made_by: "Mikey", created_at: at(1) },
  { slug: "3d-world", name: "3d-world", topic: null, made_by: "Leo", created_at: at(3) },
  { slug: "aaa", name: "aaa", topic: null, made_by: "Harry", created_at: at(2) },
  { slug: "Bad Slug!", name: "x", topic: null, made_by: "Harry", created_at: at(0) },
];
const list = listChannels(rows);
ok(list.slice(0, 6).map((c) => c.slug).join() === BUILT_IN_CHANNELS.map((c) => c.slug).join(), "the six built-in channels come first, in order");
ok(list.find((c) => c.slug === "ideas")?.name === "Ideas Lab" && list.find((c) => c.slug === "ideas")?.tool === "ideas", "a rename keeps the channel's tool");
ok(list.slice(6).map((c) => c.slug).join() === "aaa,3d-world", "new channels follow, oldest first; a bad slug is left out");
ok(listChannels([]).length === 6, "no rows: just the six");
ok(slugify("Match Engine!") === "match-engine" && slugify("#  ") === "" && slugify("x".repeat(40)).length === 30, "slugify");
ok(cleanName("##  big   room ") === "big room", "a name is tidied");
ok(newChannelSlug("Bugs", list).ok === false && newChannelSlug("", list).ok === false, "a taken or empty name is refused");
const made = newChannelSlug("Shop Art", list);
ok(made.ok && made.slug === "shop-art", "a new name makes its slug");
ok(isSlug("patch-notes") && !isSlug("-x") && !isSlug("A"), "slug rules");

console.log("Channels: which channel a message is in");
ok(channelOf("hello") === GENERAL, "no tag = #general (every old message lands there)");
ok(channelOf("[#ideas] rain") === "ideas" && withoutChannel("[#ideas] rain") === "rain", "the tag at the front names the channel");
ok(tagChannel("general", "[#ideas] hi") === "hi" && tagChannel("bugs", "hi") === "[#bugs] hi", "tagging: none for #general");
ok(composeBody("hi", { channel: "ideas", replyTo: 12 }) === "[#ideas] [re:12] hi", "compose: channel, then reply, then words");
ok(composeBody("hi", { channel: "general" }) === "hi" && composeBody("hi", { channel: "Bad!" }) === "hi", "compose: no tag for #general or a bad slug");
const pm = parseMessage("[#bugs] [re:7] @Leo look\n/admin/team");
ok(pm.channel === "bugs" && pm.replyTo === 7 && pm.text === "@Leo look" && pm.mentions.join() === "Leo" && pm.cards.length === 1, "parse: channel, reply, words, mention, card");
ok(parseMessage("[re:7] hi").channel === null && parseMessage("[re:7] hi").replyTo === 7, "an old reply still parses");
ok(quoteLine(msg(1, "Harry", "[#ideas] the words")) === "the words", "a quote never shows the tag");

console.log("Threads");
const ms: TeamMessage[] = [
  msg(1, "Harry", "general one"),
  msg(2, "Mikey", "[#ideas] rain idea"),
  msg(3, "Leo", "[#ideas] [re:2] yes please"),
  msg(4, "Harry", "[#ideas] [re:2] on grass only"),
  msg(5, "Mikey", "[re:1] in general"),
  msg(6, "Leo", "[re:999] an old reply to a message no longer loaded"),
  msg(7, "Leo", "[#ideas] @Harry another idea"),
];
ok(channelStream(ms, "ideas").map((m) => m.id).join() === "2,7", "a channel's stream hides its thread replies");
ok(channelStream(ms, GENERAL).map((m) => m.id).join() === "1,6", "a reply to a message not loaded stays in the stream");
ok(threadOf(ms, 2).map((m) => m.id).join() === "3,4", "a thread: its replies, oldest first");
const sum = threadSummary(ms, 2);
ok(sum.count === 2 && sum.last?.id === 4 && sum.people.join() === "Harry,Leo", "the parent's line: 2 replies, last reply, who");
ok(threadSummary(ms, 7).count === 0, "no replies → no line");
ok(newestIn(ms, "ideas") === 7 && newestIn(ms, "bugs") === 0, "newest id in a channel");

console.log("Unread and @ per channel");
ok(channelUnread(ms, "Harry", "ideas", {}, 0) === 3, "never opened, never read: the other two's messages count (replies too)");
ok(channelUnread(ms, "Harry", "ideas", { ideas: 3 }, 0) === 1, "read up to 3 → only 7 is new");
ok(channelUnread(ms, "Harry", "ideas", {}, Date.parse(at(5))) === 1, "a channel never opened here falls back to when the old chat was read");
ok(channelMentions(ms, "Harry", "ideas", {}, 0) === 1, "one of them @'s you");
ok(channelMentions([msg(9, "Leo", "[#bugs] @everyone look")], "Harry", "bugs", {}, 0) === 1, "@everyone counts as a mention");
ok(channelUnread(ms, null, "ideas", {}, 0) === 0, "no name picked → nothing unread");
const counts = roomCounts({
  messages: ms, me: "Harry", reads: { ideas: 3, general: 6 }, chatReadAt: 0, channels: listChannels([]),
  dms: [{ id: 1, from_person: "Mikey", to_person: "Harry", body: "psst", created_at: at(1) }], patchToRead: 2, newJobs: 1,
});
ok(counts.channels.ideas.unread === 1 && counts.channels.ideas.mentions === 1, "counts: #ideas 1 new, 1 @");
ok(counts.channels[PATCH_CHANNEL].unread === 2 && counts.channels[PATCH_CHANNEL].mentions === 2, "counts: unread patch notes are the bot's @everyone posts");
ok(counts.channels[JOBS_CHANNEL].unread === 1, "counts: a new pushed job counts in #bugs");
ok(counts.dms.Mikey === 1 && counts.dms.Leo === 0 && counts.dms.Harry === undefined, "counts: a DM per other person");
ok(counts.total === 1 + 2 + 1 + 1 && counts.patchToRead === 2 && counts.newJobs === 1, "counts: the total, and the parts that have their own badge");
ok(pinsIn([{ ...ms[1], pinned: true }, { ...ms[0], pinned: true }], "ideas").map((m) => m.id).join() === "2", "pins are per channel");

console.log("Reactions");
ok(REACTIONS.join("") === "👍✅👀🔥❌", "the five, in Harry's order");
let rs: TeamReaction[] = [];
rs = withReaction(rs, { message_id: 2, emoji: "👍", person: "Leo", at: at(1) }, true);
rs = withReaction(rs, { message_id: 2, emoji: "👍", person: "Harry", at: at(1) }, true);
rs = withReaction(rs, { message_id: 2, emoji: "👍", person: "Harry", at: at(2) }, true);
rs = withReaction(rs, { message_id: 2, emoji: "🔥", person: "Mikey", at: at(2) }, true);
rs = withReaction(rs, { message_id: 3, emoji: "❌", person: "Mikey", at: at(2) }, true);
const on2 = reactionsOn(rs, 2);
ok(on2.length === 2 && on2[0].emoji === "👍" && on2[0].people.join() === "Harry,Leo", "grouped by emoji, people in board order, no doubles");
ok(whoReacted(rs, 2) === "👍 Harry, Leo · 🔥 Mikey", "who reacted, in one line");
rs = withReaction(rs, { message_id: 2, emoji: "👍", person: "Harry", at: at(3) }, false);
ok(reactionsOn(rs, 2)[0].people.join() === "Leo", "tap again takes yours back");

console.log("Private DMs");
const dms: TeamDm[] = [
  { id: 1, from_person: "Mikey", to_person: "Harry", body: "a", created_at: at(1) },
  { id: 2, from_person: "Harry", to_person: "Mikey", body: "b", created_at: at(2) },
  { id: 3, from_person: "Leo", to_person: "Harry", body: "c", created_at: at(3) },
  { id: 4, from_person: "Mikey", to_person: "Leo", body: "not Harry's", created_at: at(4) },
];
ok(dmsWith(dms, "Harry", "Mikey").map((d) => d.id).join() === "1,2", "a conversation is just the two of you");
ok(dmsWith(dms, "Harry", "Harry").length === 0 && dmsWith(dms, null, "Leo").length === 0, "no DM with yourself or with no name");
ok(dmUnread(dms, "Harry", "Mikey", {}) === 1 && dmUnread(dms, "Harry", "Mikey", { "dm:Mikey": 1 }) === 0, "a DM is new until you open it");
ok(dmAsMessage(dms[0]).person === "Mikey" && dmAsMessage(dms[0]).pinned === false, "a DM draws as a message");
ok(ringsForDm({ from_person: "Mikey", to_person: "Harry" }).map((r) => r.person).join() === "Harry", "a DM rings only its reader");
const dp = payloadForDm({ id: 1, from_person: "Mikey", body: "hi  there" });
ok(dp.url === "/admin/team?tab=chat&dm=Mikey" && dp.body === "hi there" && /private/.test(dp.title), "a DM buzz opens the DM");

console.log("Phone buzzes still work with channels");
ok(mayRing("[#ideas] [re:4] ok") && mayRing("[#ideas] @Leo") && !mayRing("[#ideas] ok"), "a reply or @ behind a channel tag still asks to ring");
ok(chatTag("[#ideas] [re:2] hi") === "kib-chat-2", "a thread's buzzes group by the thread");
const rings = ringsForMessage({ person: "Leo", body: "[#ideas] [re:2] @Harry yes" }, { person: "Mikey" });
ok(rings.map((r) => `${r.person}:${r.why}`).join() === "Harry:mention,Mikey:reply", "a thread reply rings the parent's writer and the @");
const pl = payloadForMessage({ id: 3, person: "Leo", body: "[#ideas] [re:2] yes", image_url: null }, "reply");
ok(pl.url === "/admin/team?tab=chat&ch=ideas&m=3&t=2" && pl.title === "Leo replied to you in #ideas" && pl.body === "yes", "the buzz opens the channel and the thread");
ok(payloadForMessage({ id: 1, person: "Leo", body: "@Harry hi", image_url: null }, "mention").url === "/admin/team?tab=chat&m=1", "#general's buzz is as before");

console.log("Bots");
const notes = [
  { version: "0.62", title: "Leo's patch notes v0.20: Goals", publishedAt: "2026-10-21T09:00:00Z" },
  { version: "0.50", title: "Mikey's patch notes: Old", publishedAt: "2026-10-10T09:00:00Z" },
  { version: "0.64", title: "Mikey's patch notes v0.20: Shop", publishedAt: "2026-10-21T08:00:00Z" },
];
const pb = patchBotPosts(notes, "2026-10-18");
ok(pb.map((b) => b.version).join() === "0.64,0.62", "the patch-notes bot: one post per note since receipts began, oldest first");
ok(pb.every((b) => b.channel === PATCH_CHANNEL && b.everyone && b.name === "Patch notes bot"), "…in #patch-notes, @everyone, by the Patch notes bot");
ok(pb[1].title === "v0.62 · Goals" && /from Leo/.test(pb[1].body), "…titled by version and name, says who wrote it");
const pp = payloadForPatches([notes[0]]);
ok(pp.title === "@everyone New patch notes from Leo · v0.62" && pp.url === "/admin/team?tab=chat&ch=patch-notes&v=0.62", "the buzz says @everyone and opens the bot's post");
const job: TeamJob = { id: "lag", owner: "all", title: "Lag test", prompt: null, from: "Harry", added: at(5) };
const jb = jobBotPosts([job, { ...job, id: "m1", owner: "Mikey", added: at(1) }]);
ok(jb.map((b) => b.jobId).join() === "m1,lag" && jb.every((b) => b.channel === JOBS_CHANNEL), "the jobs bot: one post per pushed job in #bugs");
ok(jb[1].everyone && !jb[0].everyone, "a job for all says @everyone");
const tasks: TeamTask[] = [
  { id: 1, owner: "Harry", made_by: "Harry", title: markerTitle(job), done_at: at(6), created_at: at(6) },
  { id: 2, owner: "Leo", made_by: "Leo", title: markerTitle(job), done_at: null, created_at: at(6) },
];
ok(jobDoneBy(tasks, "lag").join() === "Harry", "✅ ticks are each person's own");
ok(jobIsFor(job, "Leo") && !jobIsFor({ owner: "Mikey" }, "Leo") && !jobIsFor(job, null), "only a job's owners can tick it");
const rb = rowBotPosts([{ id: 4, bot: "claude", channel: "Bad!", title: "t", body: "", url: "https://evil.example", everyone: false, created_at: at(1) }]);
ok(rb[0].channel === GENERAL && rb[0].url === null && rb[0].name === "Claude bot", "a future bot's row: a bad channel goes to #general; only site links");
const st = mergeStream([msg(2, "Leo", "x", 2), msg(1, "Leo", "y", 9)], pb.slice(0, 1).map((b) => ({ ...b, at: at(5) })));
ok(st.map((x) => (x.kind === "msg" ? x.m.id : "bot")).join() === "2,bot,1", "messages and bot posts in time order");

console.log("The address");
ok(placeFrom({ ch: "ideas" }).kind === "channel" && (placeFrom({ ch: "ideas" }) as { slug: string }).slug === "ideas", "?ch=ideas");
ok((placeFrom({ dm: "mikey" }) as { with: string }).with === "Mikey" && placeFrom({ dm: "bob" }).kind === "channel", "?dm=mikey; an unknown name → #general");
ok((placeFrom({ ch: "Bad!" }) as { slug: string }).slug === GENERAL, "a bad channel → #general");
ok(roomUrl({ kind: "channel", slug: "general" }) === "/admin/team?tab=chat" && roomUrl({ kind: "channel", slug: "ideas" }, { t: 2 }) === "/admin/team?tab=chat&ch=ideas&t=2", "roomUrl");

if (failed) { console.error(`\n${failed} failed`); process.exit(1); }
console.log("\nAll channel checks passed.");
