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

if (failed) { console.error(`\n${failed} failed`); process.exit(1); }
console.log("\nAll passed");
