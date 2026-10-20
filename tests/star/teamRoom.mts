/**
 * tests/star/teamRoom.mts — the Team room's sums (lib/teamRoom/logic.ts):
 * unread counts, idea order (by stage and by person), to-do lists, note dots,
 * and which pages get the chat bubble.
 */
import {
  bubbleOn, ideasByPerson, ideasByStage, newGivenTasks, notesFor, pageLabel, rankIdeas, tasksFor, tasksGivenBy,
  unreadChat, unreadNotes, upsertById, votersOf,
  type TeamIdea, type TeamMessage, type TeamNote, type TeamTask, type TeamVote,
} from "@/lib/teamRoom/logic";
import { ADMIN_PAGES } from "@/lib/adminRegistry";
import {
  ackedBy, composeBody, decodePoint, mentionsIn, parseMessage, patchAuthor, patchReaders, patchUnread, pointUrl, pointsWaiting,
  quoteLine, seenBy, typingToken, unseenMentions, waitingOnMe, withAck,
  type PatchMeta, type PointBox, type ReadMarks, type TeamAck,
} from "@/lib/teamRoom/extras";

let failed = 0;
const ok = (c: boolean, what: string) => { if (!c) { failed++; console.error(`  FAIL ${what}`); } else console.log(`  ✓ ${what}`); };
const at = (min: number) => new Date(Date.UTC(2026, 9, 19, 10, min)).toISOString();
const T0 = Date.parse(at(0));

console.log("Chat");
const msgs: TeamMessage[] = [
  { id: 1, person: "Harry", body: "a", image_url: null, page: null, pinned: false, created_at: at(1) },
  { id: 2, person: "Mikey", body: "b", image_url: null, page: null, pinned: false, created_at: at(2) },
  { id: 3, person: "Leo", body: "c", image_url: null, page: null, pinned: false, created_at: at(3) },
];
ok(unreadChat(msgs, "Harry", T0) === 2, "your own messages never count as unread");
ok(unreadChat(msgs, "Harry", Date.parse(at(2))) === 1, "only after the moment you last read");
ok(unreadChat(msgs, null, 0) === 0, "no name picked yet → nothing unread");
const up = upsertById(msgs, { ...msgs[0], pinned: true });
ok(up.length === 3 && up[0].pinned, "a live update replaces the row, no double");
ok(upsertById(msgs, { ...msgs[0], id: 9 }).map((m) => m.id).join() === "1,2,3,9", "a new row goes last");

console.log("Ideas");
const ideas: TeamIdea[] = [
  { id: 1, person: "Mikey", title: "Rain", stage: "doing", created_at: at(1), updated_at: at(1) },
  { id: 2, person: "Harry", title: "Hall post", stage: "idea", created_at: at(5), updated_at: at(5) },
  { id: 3, person: "Leo", title: "Rants", stage: "idea", created_at: at(9), updated_at: at(9) },
  { id: 4, person: "Harry", title: "Old one", stage: "done", created_at: at(0), updated_at: at(20) },
  { id: 5, person: "Harry", title: "Older done", stage: "done", created_at: at(0), updated_at: at(10) },
];
const votes: TeamVote[] = [{ idea_id: 2, person: "Harry" }, { idea_id: 2, person: "Mikey" }, { idea_id: 3, person: "Leo" }];
ok(rankIdeas(ideas, votes)[0].id === 2, "most votes first");
ok(ideasByStage(ideas, votes, "idea").map((i) => i.id).join() === "2,3", "Idea column: 2 votes above 1 vote");
ok(ideasByStage(ideas, votes, "done").map((i) => i.id).join() === "4,5", "Done: latest finished on top");
ok(ideasByPerson(ideas, votes, "Harry").map((i) => i.id).join() === "2,4,5", "By person: open before done");
ok(votersOf(votes, 2).join() === "Harry,Mikey", "dots in board order");

console.log("To-dos");
const NOW = Date.parse(at(30));
const tasks: TeamTask[] = [
  { id: 1, owner: "Harry", made_by: "Harry", title: "mine", done_at: null, created_at: at(1) },
  { id: 2, owner: "Harry", made_by: "Leo", title: "from Leo", done_at: null, created_at: at(2) },
  { id: 3, owner: "Harry", made_by: "Harry", title: "ticked", done_at: at(20), created_at: at(0) },
  { id: 4, owner: "Harry", made_by: "Harry", title: "ticked long ago", done_at: new Date(NOW - 30 * 3600_000).toISOString(), created_at: at(0) },
  { id: 5, owner: "Mikey", made_by: "Harry", title: "for Mikey", done_at: null, created_at: at(3) },
];
const l = tasksFor(tasks, "Harry", NOW);
ok(l.mine.map((x) => x.id).join() === "1" && l.given.map((x) => x.id).join() === "2", "yours and given-to-you split");
ok(l.done.map((x) => x.id).join() === "3", "ticked stays a day, then leaves");
ok(l.open === 2, "open count = both open lists");
ok(tasksGivenBy(tasks, "Harry").map((x) => x.id).join() === "5", "jobs you gave Mikey listed for you");
ok(newGivenTasks(tasks, "Harry", Date.parse(at(1))) === 1, "a new job from Leo lights the dot");
ok(newGivenTasks(tasks, "Harry", Date.parse(at(5))) === 0, "…and goes once seen");

console.log("Notes");
const notes: TeamNote[] = [
  { id: 1, target_kind: "idea", target_id: "2", owner: "Harry", person: "Mikey", body: "x", created_at: at(4) },
  { id: 2, target_kind: "idea", target_id: "2", owner: "Harry", person: "Harry", body: "y", created_at: at(6) },
  { id: 3, target_kind: "push", target_id: "abc1234", owner: "Harry", person: "Leo", body: "z", created_at: at(7) },
];
ok(unreadNotes(notes, "Harry", 0) === 2, "notes from others on your things count");
ok(unreadNotes(notes, "Harry", 0, "push") === 1, "split by idea / push");
ok(unreadNotes(notes, "Mikey", 0) === 0, "not your idea → no dot");
ok(notesFor(notes, "idea", 2).length === 2, "notes found by idea id (number or text)");

console.log("Where the bubble shows");
const urls = ADMIN_PAGES.map((p) => p.url);
ok(bubbleOn("/admin/team", urls) && bubbleOn("/admin/star", urls), "admin pages");
ok(bubbleOn("/star-gallery-dev", urls) || !urls.includes("/star-gallery-dev"), "a test page in the admin list");
ok(!bubbleOn("/star-dev", urls), "never in the game");
ok(!bubbleOn("/", urls), "never on the home page");
ok(!bubbleOn("/tierlist/abc", urls) || urls.some((u) => u.startsWith("/tierlist")), "an ordinary site page stays clean");
ok(pageLabel("/admin/team?tab=chat", { "/admin/team": "Team board" }) === "Team board", "page tag uses the admin list's name");
ok(pageLabel("/star-goal-clips-dev", {}) === "goal clips", "else a short name from the address");

// ── Round two (lib/teamRoom/extras.ts) ─────────────────────────────────
console.log("Mentions");
ok(mentionsIn("hey @mikey and @Leo, look").join() === "Mikey,Leo", "@names found, any case, board order");
ok(mentionsIn("mail me at x@leo.com").length === 0, "an email address is not a mention");
ok(mentionsIn("@Harry@Mikey").join() === "Harry", "two names glued together: only the first");
ok(mentionsIn("@Leonardo").length === 0, "a longer word is not a mention");

console.log("Replies, cards, points");
const pt: PointBox = { v: 1, id: "ab12", by: "Mikey", to: ["Harry"], n: "numbers look off – “£”", pn: "Team board",
  sel: "#main > div:nth-of-type(2)", ex: 0.1, ey: 0.2, ew: 0.5, eh: 0.25, x: 24, y: 330, w: 320, h: 140, sx: 0, sy: 400, vw: 390, vh: 844 };
const url = pointUrl("/admin/team?tab=chat#old", pt);
ok(url.startsWith("/admin/team?tab=chat#kib-point="), "a point link keeps the page and its ?, drops the old #");
const back = decodePoint(url);
ok(!!back && back.n === pt.n && back.sel === pt.sel && back.to.join() === "Harry" && back.sy === 400, "a point survives the round trip (non-English letters too)");
ok(decodePoint("/admin/team#kib-point=not-json") === null && decodePoint("/admin/team") === null, "a broken or missing point → nothing, no crash");
const body = composeBody("  look at this @Mikey ", { replyTo: 42, links: ["/star-gallery-dev", url] });
ok(body.startsWith("[re:42] look at this @Mikey\n/star-gallery-dev\n"), "a reply, its words and one link per line");
const pm = parseMessage(body);
ok(pm.replyTo === 42 && pm.text === "look at this @Mikey" && pm.mentions.join() === "Mikey", "parsed back: reply, text, mention");
ok(pm.cards.length === 2 && pm.cards[0].path === "/star-gallery-dev" && pm.cards[0].point === null && pm.cards[1].point?.id === "ab12", "two cards: a page and a point");
const full = parseMessage("see https://knowitball.co.uk/star-play-dev?x=1\nhttps://example.com/a", ["https://knowitball.co.uk"]);
ok(full.cards.length === 0 && full.text.includes("https://example.com/a"), "a link inside a sentence stays text");
const own = parseMessage("https://knowitball.co.uk/star-play-dev?x=1\nhttps://example.com/a", ["https://knowitball.co.uk"]);
ok(own.cards.length === 1 && own.cards[0].url === "/star-play-dev?x=1" && own.text === "https://example.com/a", "a whole line linking our own site is a card; other sites stay links");
ok(parseMessage("//evil.com/x").cards.length === 0, "//other-site is never treated as our page");
ok(parseMessage("[re:7]").replyTo === 7 && parseMessage("[re:7]").text === "", "a bare reply token is not shown as text");
ok(quoteLine({ body: `@Harry 👉 x\n${url}`, image_url: null }).startsWith("@Harry 👉 x"), "a quoted point shows its words");
ok(quoteLine(undefined) === "An older message", "a reply to a message not loaded says so");

console.log("Seen faces and waiting on me");
const m2: TeamMessage[] = [
  { id: 10, person: "Mikey", body: "hi @Harry", image_url: null, page: null, pinned: false, created_at: at(1) },
  { id: 11, person: "Leo", body: "general", image_url: null, page: null, pinned: false, created_at: at(2) },
  { id: 12, person: "Mikey", body: `@Harry 👉 here\n${url}`, image_url: null, page: null, pinned: false, created_at: at(3) },
  { id: 13, person: "Harry", body: "@Mikey ok", image_url: null, page: null, pinned: false, created_at: at(4) },
];
const marks: ReadMarks = { Harry: 10, Mikey: 13, Leo: 11 };
ok(seenBy(m2[0], marks).join() === "Harry,Leo", "seen by everyone whose mark reached it, never the sender");
ok(seenBy(m2[3], marks).join() === "Mikey", "Leo's mark (11) hasn't reached 13");
ok(seenBy(m2[3], {}).length === 0, "no marks → nobody");
ok(unseenMentions(m2, "Harry", marks).map((m) => m.id).join() === "12", "a mention you've seen (10) stops waiting");
ok(unseenMentions(m2, "Mikey", marks).length === 0, "your own mention of others never waits on you");
const acks: TeamAck[] = [];
ok(pointsWaiting(m2, "Harry", acks).length === 1 && pointsWaiting(m2, "Leo", acks).length === 0, "a point waits only on who it was for");
ok(waitingOnMe(m2, "Harry", marks, acks).map((m) => m.id).join() === "12", "a mention + point in one message counts once");
const acked = withAck(acks, { kind: "point", target: "ab12", person: "Harry", at: at(5) }, true);
ok(waitingOnMe(m2, "Harry", { ...marks, Harry: 13 }, acked).length === 0, "Got it + seen → nothing waiting");
ok(withAck(withAck(acked, acked[0], true), acked[0], false).length === 0, "acks never double, and come off");
ok(ackedBy(acked, "point", "ab12").join() === "Harry", "who pressed Got it");

console.log("Patch-note receipts");
const pn: PatchMeta[] = [
  { version: "0.59", title: "Mikey's patch notes v0.17: …", publishedAt: "2026-10-18T22:00:00Z" },
  { version: "0.58", title: "Leo's patch notes: …", publishedAt: "2026-10-18T21:00:00Z" },
  { version: "0.56", title: "Harry's patch notes: …", publishedAt: "2026-10-14T10:00:00Z" },
];
const pa: TeamAck[] = [{ kind: "patch", target: "0.58", person: "Harry", at: at(1) }];
ok(patchAuthor("Mikey's patch notes v0.17") === "Mikey" && patchAuthor("Knowitball patch notes") === null, "the author from the title");
ok(patchUnread(pn, "Harry", pa, "2026-10-18").map((n) => n.version).join() === "0.59", "Harry: 0.58 read, 0.56 before receipts started");
ok(patchUnread(pn, "Mikey", pa, "2026-10-18").map((n) => n.version).join() === "0.58", "your own patch notes never wait on you");
ok(patchReaders(pn[0], pa).join() === "Mikey" && patchReaders(pn[1], pa).join() === "Harry,Leo", "faces: the author plus who pressed Read");

console.log("Typing @ and #");
ok(JSON.stringify(typingToken("hey @mi", 7)) === JSON.stringify({ kind: "@", query: "mi", start: 4 }), "@ partway through a name");
ok(typingToken("hey #gal", 8)?.kind === "#" && typingToken("hey #gal", 8)?.query === "gal", "# for a page");
ok(typingToken("mail x@le", 9) === null, "not after a letter (an email)");
ok(typingToken("@", 1)?.query === "", "a bare @ shows everyone");

if (failed) { console.error(`\n${failed} failed`); process.exit(1); }
console.log("\nAll passed");
