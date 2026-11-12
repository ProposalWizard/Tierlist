/**
 * tests/star/teamRoomPatchBot.mts — the Patch bot, end to end
 * (lib/teamRoom/patchBot.ts; Harry, 12 Nov 2026). The three promises:
 * it never posts twice, it names the two who did NOT write the note, and the
 * post moves to #patch-notes once everyone has read it.
 * Run: npx tsx tests/star/teamRoomPatchBot.mts
 */
import {
  PATCH_BOT, announcePlan, announceRow, announcedRows, botSettings, botStatusLine, duplicateAnnounces, everyoneRead, nudgePlan, otherBotRows,
  patchBotActivity, patchFlowPosts, patchPostChannel, patchThread, patchThreadSummary, reviewersOf, settingsRow, summaryLine, threadForClaude,
  type BotNote, type NewBotRow,
} from "@/lib/teamRoom/patchBot";
import { GENERAL, PATCH_CHANNEL, channelStream, type BotRow } from "@/lib/teamRoom/channels";
import { composeBody, parseMessage, type TeamAck } from "@/lib/teamRoom/extras";
import { payloadForMessage, ringsForMessage } from "@/lib/teamRoom/notify";
import type { TeamMessage, TeamNote } from "@/lib/teamRoom/logic";

let failed = 0;
const ok = (c: boolean, what: string) => { if (!c) { failed++; console.error(`  FAIL ${what}`); } else console.log(`  ✓ ${what}`); };
const day = (d: number, h = 10) => new Date(Date.UTC(2026, 10, d, h)).toISOString();
const note = (version: string, who: string | null, d: number, summary = ""): BotNote =>
  ({ version, title: who ? `${who}'s patch notes: Thing ${version}` : `Thing ${version}`, publishedAt: day(d), author: who, summary });
let nextId = 1;
/** What the database does with a row the plan made: give it an id and a time. */
const saved = (r: NewBotRow, at = day(12, 11)): BotRow => ({ id: nextId++, ...r, created_at: at });
const msg = (id: number, person: TeamMessage["person"], body: string): TeamMessage =>
  ({ id, person, body, image_url: null, page: null, pinned: false, created_at: day(12, 12) });
const ack = (target: string, person: TeamAck["person"], at = day(13)): TeamAck => ({ kind: "patch", target, person, at });

const OLD = note("0.137", "Harry", 1);
const NEW = note("0.138", "Harry", 12, "The Team room has a working Patch bot. It posts in #general. More words here.");
const LEO = note("0.139", "Leo", 13);
const NOBODY = note("0.140", null, 14);
const notes = [NOBODY, LEO, NEW, OLD];

console.log("Who is asked to review");
ok(reviewersOf(NEW).join() === "Mikey,Leo", "Harry's note asks Mikey and Leo");
ok(reviewersOf(LEO).join() === "Harry,Mikey", "Leo's note asks Harry and Mikey");
ok(reviewersOf({ title: "Mikey's patch notes: x" }).join() === "Harry,Leo", "the author is read from the title when there is no author field");
ok(reviewersOf(NOBODY).join() === "Harry,Mikey,Leo", "nobody's name on it: all three are asked");

console.log("The post");
const row = announceRow(NEW);
ok(row.channel === GENERAL && row.bot === "patch-notes", "it goes in #general as the Patch bot");
ok(row.title === "v0.138 · Thing 0.138", "the title is the version and the note's own title");
ok(row.body.split("\n")[0] === "The Team room has a working Patch bot.", "one line: the summary's first sentence");
ok(/@Mikey @Leo please review\.$/.test(row.body) && !/@Harry/.test(row.body), "it names the two who did not write it, never the author");
ok(row.url === "/admin/team?tab=notes&v=0.138", "Open goes to the patch note");
ok(row.everyone === false, "it is not an @everyone");
ok(summaryLine("x".repeat(300)).length <= 140 && summaryLine("") === "", "a long summary is cut to 140; none stays empty");

console.log("Never twice");
const first = announcePlan({ notes, rows: [] });
ok(first.map((r) => r.meta.version).join() === "0.138,0.139,0.140", "the first run announces the three new notes, oldest first");
ok(!first.some((r) => r.meta.version === "0.137"), "a note from before the start day is never announced");
const rows1 = first.map((r) => saved(r));
ok(announcePlan({ notes, rows: rows1 }).length === 0, "the second run posts nothing");
ok(announcePlan({ notes, rows: rows1.slice(0, 1) }).map((r) => r.meta.version).join() === "0.139,0.140", "a run that stopped half way picks up only what is missing");
ok(announcePlan({ notes: [NEW, NEW], rows: [] }).length === 1, "the same note listed twice is announced once");
ok(announcePlan({ notes, rows: [], enabled: false }).length === 0, "switched off: nothing is announced");
ok(announcePlan({ notes: Array.from({ length: 9 }, (_, i) => note(`1.${i}`, "Leo", 14)), rows: [] }).length === PATCH_BOT.maxPerRun, "one run posts at most 5");
const twice = [saved(announceRow(NEW)), saved(announceRow(NEW)), saved(announceRow(LEO))];
ok(duplicateAnnounces(twice).join() === String(twice[1].id), "two askers at once: the later double is the one deleted");
ok(announcedRows(twice).get("0.138")!.id === twice[0].id, "the oldest post of a version is the one kept");
ok(patchFlowPosts(notes, twice, []).filter((p) => p.version === "0.138").length === 1, "the room draws one post per version even before the double is deleted");

console.log("The room's posts");
const posts = patchFlowPosts(notes, rows1, []);
const p138 = posts.find((p) => p.version === "0.138")!;
ok(p138.channel === GENERAL && p138.flow === true && !p138.pending, "an announced note shows in #general");
ok(p138.mentions!.join() === "Mikey,Leo", "its post names Mikey and Leo");
ok(p138.key === "patch:0.138", "its key is the version (read receipts and links still find it)");
ok(posts.find((p) => p.version === "0.137")!.channel === PATCH_CHANNEL, "a note from before the start day stays in #patch-notes");
ok(patchFlowPosts(notes, [], []).find((p) => p.version === "0.138")!.pending === true, "published but not posted yet: shown as posting…, still in #general");
ok(otherBotRows([...rows1, saved(settingsRow("patch-notes", { enabled: true, nudgeHours: 24 }, "Harry")), { id: 99, bot: "bug", channel: "bugs", title: "t", body: "", url: null, everyone: false, created_at: day(12) }]).map((r) => r.id).join() === "99", "the Patch bot's rows and settings rows are never drawn a second time as plain posts");

console.log("Archive: everyone has read it");
ok(patchPostChannel(NEW, []) === GENERAL, "nobody has read it: #general");
ok(patchPostChannel(NEW, [ack("0.138", "Mikey")]) === GENERAL, "one of two has read it: still #general");
const allRead = [ack("0.138", "Mikey"), ack("0.138", "Leo", day(14))];
ok(everyoneRead(NEW, allRead) && patchPostChannel(NEW, allRead) === PATCH_CHANNEL, "both reviewers have read it (the author counts): #patch-notes");
const archived = patchFlowPosts(notes, rows1, allRead).find((p) => p.version === "0.138")!;
ok(archived.channel === PATCH_CHANNEL && archived.archived === true, "its post moves to #patch-notes, marked archived");
ok(patchFlowPosts(notes, rows1, allRead).find((p) => p.version === "0.139")!.channel === GENERAL, "another note that is not read stays in #general");
ok(patchPostChannel(NOBODY, [ack("0.140", "Harry"), ack("0.140", "Mikey")]) === GENERAL, "a note with no author needs all three");
ok(patchPostChannel(NEW, allRead.slice(0, 1)) === GENERAL, "a read taken back brings it back to #general");

console.log("The thread");
const thread = [
  msg(1, "Mikey", composeBody("Can the bot also say who has read it?", { patch: "0.138" })),
  msg(2, "Leo", composeBody("@Harry the Open button is small on my phone", { patch: "0.138" })),
  msg(3, "Harry", "an ordinary message"),
  msg(4, "Mikey", composeBody("other note", { patch: "0.139" })),
];
ok(thread[0].body === "[pn:0.138] Can the bot also say who has read it?", "a comment is the text with [pn:version] in front");
ok(parseMessage(thread[1].body).patch === "0.138" && parseMessage(thread[1].body).text.startsWith("@Harry"), "the tag is read back and left out of the words");
ok(parseMessage(thread[2].body).patch === null, "an ordinary message is in no patch thread");
ok(patchThread(thread, "0.138").map((m) => m.id).join() === "1,2", "the thread holds that version's comments, oldest first");
ok(patchThreadSummary(thread, "0.138").count === 2 && patchThreadSummary(thread, "0.138").people.join() === "Mikey,Leo", "its line: 2 replies, Mikey and Leo");
ok(channelStream(thread, GENERAL).map((m) => m.id).join() === "3", "comments stay out of #general's own stream");
ok(ringsForMessage(thread[0], { person: "Harry" }).some((r) => r.person === "Harry" && r.why === "reply"), "a comment rings the note's author");
ok(/pn=0\.138/.test(payloadForMessage(thread[0], "reply").url) && /commented on your patch notes v0\.138/.test(payloadForMessage(thread[0], "reply").title), "the buzz says so and opens the thread");

console.log("Copy thread for Claude");
const oldNote: TeamNote = { id: 7, target_kind: "patch", target_id: "0.138", owner: "Harry", person: "Leo", body: "> Posts in #general\nlove this", created_at: day(12, 9) };
const text = threadForClaude({ note: NEW, messages: thread, notes: [oldNote], origin: "https://knowitball.co.uk" });
ok(text.startsWith("PATCH NOTE v0.138: Thing 0.138\nWritten by: Harry"), "it opens with the version and who wrote it");
ok(text.includes("https://knowitball.co.uk/admin/team?tab=notes&v=0.138"), "it links the patch note");
ok(text.includes("1. Mikey (") && text.includes("Can the bot also say who has read it?") && text.includes("2. Leo ("), "every comment, numbered, with its author");
ok(!text.includes("other note") && !text.includes("[pn:"), "no other note's comments, no tags");
ok(text.includes('3. Leo (') && text.includes('about "Posts in #general": love this'), "the older Notes on the page come too, with the line they quote");
ok(/make the changes suggested/.test(text.split("\n").pop()!), "it ends with the ask");
ok(threadForClaude({ note: LEO, messages: [] }).includes("(none yet)"), "an empty thread says so");

console.log("Nudge and settings");
const hour = 3600_000;
const at12 = Date.parse(day(12, 11));
const one = [saved(announceRow(NEW), day(12, 11))];
ok(nudgePlan({ notes, rows: one, acks: [], nudgeHours: 24, now: at12 + 23 * hour }).length === 0, "no reminder before 24 hours");
const n = nudgePlan({ notes, rows: one, acks: [ack("0.138", "Mikey")], nudgeHours: 24, now: at12 + 25 * hour });
ok(n.length === 1 && /@Leo/.test(n[0].body) && !/@Mikey/.test(n[0].body), "after 24 hours it reminds only who has not read it");
ok(nudgePlan({ notes, rows: [...one, saved(n[0])], acks: [], nudgeHours: 24, now: at12 + 99 * hour }).length === 0, "never a second reminder for the same note");
ok(nudgePlan({ notes, rows: one, acks: allRead, nudgeHours: 24, now: at12 + 99 * hour }).length === 0, "everyone has read it: no reminder");
ok(nudgePlan({ notes, rows: one, acks: [], nudgeHours: 0, now: at12 + 99 * hour }).length === 0, "reminder set to Never: none");
ok(botSettings([]).enabled === true && botSettings([]).nudgeHours === 24, "no settings saved: on, reminder after a day");
const offRow = saved(settingsRow("patch-notes", { enabled: false, nudgeHours: 48 }, "Mikey"));
const onRow = saved(settingsRow("patch-notes", { enabled: true, nudgeHours: 48 }, "Harry"));
ok(botSettings([offRow]).enabled === false && botSettings([offRow]).by === "Mikey", "switched off by Mikey");
ok(botSettings([offRow, onRow]).enabled === true && botSettings([onRow, offRow]).enabled === true, "the newest settings row wins, whatever the order");
ok(botSettings([offRow], "health").enabled === true, "one bot's switch does not touch another's");
ok(botStatusLine("patch-notes", [offRow], botSettings([offRow]), at12).tone === "off", "its page says Off");
ok(botStatusLine("patch-notes", rows1, botSettings(rows1), at12).tone === "ok", "with posts: Working");
ok(botStatusLine("health", [], botSettings([], "health"), at12).text.startsWith("Not posting yet"), "Health bot with no post says honestly it is not posting yet");
const log = patchBotActivity({ notes, rows: [...rows1, offRow], acks: allRead });
ok(log.length <= 5 && log.some((e) => /Posted v0\.138 in #general and asked Mikey and Leo/.test(e.text)), "the last things: the post, and who was asked");
ok(log.some((e) => /Everyone has read v0\.138/.test(e.text)) && log.some((e) => /Mikey saved its settings: off/.test(e.text)), "…the archive, and the switch");

if (failed) { console.error(`\n${failed} failed`); process.exit(1); }
console.log("\nAll Patch bot checks pass");
