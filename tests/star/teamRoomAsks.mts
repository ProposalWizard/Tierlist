/**
 * tests/star/teamRoomAsks.mts — messages that become tasks, the / commands
 * and quick links (lib/teamRoom/asks.ts; Harry, 12 Nov 2026).
 * Run: npx tsx tests/star/teamRoomAsks.mts
 */
import {
  ASK_TAG, MAX_LINKS, acceptedTitle, askMessageId, askOffer, askRow, askTitle, askedFrom, asksFor, asksSentBy, cleanLinks, endOfToday, isAsk, isSitePath,
  parseCommand, todayLines, withLink,
} from "@/lib/teamRoom/asks";
import { tasksFor, tasksGivenBy, type TeamTask } from "@/lib/teamRoom/logic";
import { payloadForTask } from "@/lib/teamRoom/notify";

let failed = 0;
const ok = (c: boolean, what: string) => { if (!c) { failed++; console.error(`  FAIL ${what}`); } else console.log(`  ✓ ${what}`); };
const now = Date.UTC(2026, 10, 12, 12);
const task = (id: number, owner: TeamTask["owner"], made_by: TeamTask["made_by"], title: string, done = false): TeamTask =>
  ({ id, owner, made_by, title, done_at: done ? new Date(now).toISOString() : null, created_at: new Date(now - id * 60_000).toISOString() });

console.log("The offer on a message");
const o = askOffer({ person: "Harry", body: "@Mikey do the cup-final thumbnail by Friday" })!;
ok(o.to.join() === "Mikey" && o.title === "Do the cup-final thumbnail by Friday", "\"@Mikey do X\" offers a task for Mikey with the words");
ok(askOffer({ person: "Harry", body: "[#ideas] On it. @Mikey, @Leo check the keeper page" })!.to.join() === "Mikey,Leo", "two names: both are offered (channel tag ignored)");
ok(askOffer({ person: "Harry", body: "[#ideas] On it. @Mikey check the keeper page" })!.title === "On it. check the keeper page", "the names come out of the words");
ok(askOffer({ person: "Harry", body: "thanks @Mikey" }) === null && askOffer({ person: "Harry", body: "@Mikey 👍" }) === null, "a thank-you or one word is not a task");
ok(askOffer({ person: "Harry", body: "@Harry remember the backup" }) === null, "naming only yourself offers nothing");
ok(askOffer({ person: "Harry", body: "no names here at all" }) === null, "no name, no offer");
ok(askOffer({ person: "Leo", body: `@Harry ${"x ".repeat(200)}` })!.title.length <= 140, "a long message is cut to 140");

console.log("The proposal");
const row = askRow(o, "Mikey", "Harry", 12);
ok(row.owner === "Mikey" && row.made_by === "Harry" && row.title === "[ask] Do the cup-final thumbnail by Friday (message 12)", "the row: for Mikey, from Harry, tagged, remembers message 12");
ok(askRow({ title: "y".repeat(300) }, "Leo", "Harry", 7).title.length <= 200 && askMessageId(askRow({ title: "y".repeat(300) }, "Leo", "Harry", 7)) === 7, "never over the to-do's 200 letters, and the message id survives the cut");
const tasks = [task(1, "Mikey", "Harry", row.title), task(2, "Mikey", "Mikey", "My own job"), task(3, "Mikey", "Leo", "A plain job from Leo"), task(4, "Harry", "Leo", `${ASK_TAG}Check the keeper page`)];
ok(isAsk(tasks[0]) && !isAsk(tasks[1]) && askTitle(tasks[0]) === "Do the cup-final thumbnail by Friday (message 12)", "a proposal is known by its tag");
ok(asksFor(tasks, "Mikey").map((t) => t.id).join() === "1" && asksFor(tasks, "Harry").map((t) => t.id).join() === "4", "it waits in its owner's proposals");
ok(asksSentBy(tasks, "Harry").map((t) => t.id).join() === "1", "its sender sees it under Waiting for a yes");
ok(tasksFor(tasks, "Mikey", now).open === 2 && !tasksFor(tasks, "Mikey", now).given.some((t) => t.id === 1), "a proposal is NOT an open job until it is accepted");
ok(!tasksGivenBy(tasks, "Harry").some((t) => t.id === 1), "…and not a job its sender gave, yet");
ok(askedFrom(tasks, 12).join() === "Mikey" && askedFrom(tasks, 99).length === 0, "the message knows it was already sent to Mikey (no second offer)");
const accepted = { ...tasks[0], title: acceptedTitle(tasks[0]) };
ok(!isAsk(accepted) && tasksFor([accepted], "Mikey", now).given.length === 1, "Accept: the tag comes off and it is a job given to Mikey");
ok(askedFrom([accepted], 12).join() === "Mikey", "an accepted one still counts as sent");
ok(payloadForTask(tasks[0]).title === "Harry asked you to do something" && !payloadForTask(tasks[0]).body.includes("[ask]") && /Accept or Decline/.test(payloadForTask(tasks[0]).body), "the buzz asks, without the tag");
ok(payloadForTask(tasks[2]).title === "Leo gave you a job", "a plain job buzzes as before");

console.log("/ commands");
ok(parseCommand("hello /todo", "Harry") === null && parseCommand("/tod", "Harry") === null, "only a line that starts with a real command counts");
ok(parseCommand("/todo", "Harry")!.kind === "todo-open", "/todo alone opens the to-do");
const add = parseCommand("/todo  buy   cones ", "Harry")!;
ok(add.kind === "todo-add" && add.title === "buy cones", "/todo words adds a job for you");
const ask = parseCommand("/todo @Mikey film the replays", "Harry")!;
ok(ask.kind === "todo-ask" && ask.to.join() === "Mikey" && ask.title === "Film the replays", "/todo @Mikey words asks Mikey");
ok(parseCommand("/today", "Harry")!.kind === "today-show", "/today shows the day");
const set = parseCommand("/TODAY filming clips", "Harry")!;
ok(set.kind === "today-set" && set.text === "filming clips", "/today words sets your status (any letter case)");
ok(parseCommand("/show", "Harry")!.kind === "show", "/show is known (marked soon)");
ok(new Date(endOfToday(now)).getHours() === 23 && Date.parse(endOfToday(now)) > now, "a /today status clears at the end of today");
const lines = todayLines({ tasks, statusOf: (p) => (p === "Mikey" ? "🎬 filming" : null) });
ok(lines.length === 3 && lines[1].status === "🎬 filming" && lines[0].status === "no status", "/today: one line per person with their status");
ok(lines[1].open === 2 && lines[0].open === 0, "…and their open jobs (proposals not counted)");

console.log("Quick links");
ok(isSitePath("/admin/marketing/studio") && isSitePath("/admin/team?tab=chat&ch=ideas") && !isSitePath("https://evil.example") && !isSitePath("//evil.example") && !isSitePath("javascript:alert(1)"), "only this site's own pages can be pinned");
ok(cleanLinks(["/admin/a", "/admin/a", "http://x", 5, "/admin/b"]).join() === "/admin/a,/admin/b", "saved links are tidied: no doubles, no outside links");
ok(cleanLinks(Array.from({ length: 20 }, (_, i) => `/admin/p${i}`)).length === MAX_LINKS && cleanLinks(null).length === 0, "at most 8; nothing saved = none");
ok(withLink(["/admin/a"], "/admin/b", true).join() === "/admin/a,/admin/b" && withLink(["/admin/a", "/admin/b"], "/admin/a", false).join() === "/admin/b", "pin adds at the end; unpin takes it off");
ok(withLink(["/admin/a"], "/admin/a", true).join() === "/admin/a", "pinning twice keeps one");

if (failed) { console.error(`\n${failed} failed`); process.exit(1); }
console.log("\nAll asks, commands and quick-link checks pass");
