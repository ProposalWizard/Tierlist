/**
 * tests/star/teamRoomWays.mts — every channel has its own way of working
 * (Harry, 12 Nov 2026). The tabs each channel carries, #today's check-ins and
 * week grid, and the Health bot's four coloured lines.
 * Run: npx tsx tests/star/teamRoomWays.mts
 */
import { BUILT_IN_CHANNELS, CHANNEL_HOW, channelHow, channelStream, listChannels, tabFor, tabsFor, rowBotPosts, type BotRow } from "@/lib/teamRoom/channels";
import { TODAY_CHANNEL, checkInBody, checkInsFor, notCheckedIn, ukDay, weekDays, weekGrid } from "@/lib/teamRoom/today";
import { healthLevel, healthLines, healthPosts, isLimitsPost, latestLimits } from "@/lib/teamRoom/health";
import { limitsPost } from "@/lib/backup/plan";
import type { TeamMessage } from "@/lib/teamRoom/logic";

let failed = 0;
const ok = (c: boolean, what: string) => { if (!c) { failed++; console.error(`  FAIL ${what}`); } else console.log(`  ✓ ${what}`); };
const at = (d: number, h = 10, m = 0) => new Date(Date.UTC(2026, 10, d, h, m)).toISOString();
let id = 1;
const msg = (person: TeamMessage["person"], body: string, when: string): TeamMessage => ({ id: id++, person, body, image_url: null, page: null, pinned: false, created_at: when });

console.log("The tabs each channel carries");
const ch = (slug: string) => listChannels([]).find((c) => c.slug === slug)!;
const names = (slug: string) => tabsFor(ch(slug)).map((t) => t.name).join(" | ");
ok(names("general") === "Messages | Pinned", "#general: Messages | Pinned");
ok(names("ideas") === "Ideas board | Messages", "#ideas: Ideas board | Messages");
ok(names("todo") === "Tasks | Messages", "#todo: Tasks | Messages");
ok(names("bugs") === "Open reports | Fixed | Messages", "#bugs: Open reports | Fixed | Messages");
ok(names("health") === "Limits | Messages", "#health: Limits | Messages");
ok(names("patch-notes") === "Archive | Messages", "#patch-notes: Archive | Messages");
ok(names("marketing") === "Production board | Messages", "#marketing: Production board | Messages");
ok(names("today") === "Today | This week | Messages", "#today: Today | This week | Messages");
ok(names("connectors") === "Messages", "#connectors has nothing of its own yet: chat only, no empty tab");
ok(BUILT_IN_CHANNELS.every((c) => tabsFor(c).some((t) => t.id === "messages")), "every channel can still be talked in");
ok(BUILT_IN_CHANNELS.every((c) => new Set(tabsFor(c).map((t) => t.id)).size === tabsFor(c).length), "no channel lists a tab twice");
ok(tabFor(ch("bugs")) === "open" && tabFor(ch("general")) === "messages", "a channel opens on its own first tab");
ok(tabFor(ch("bugs"), "fixed") === "fixed" && tabFor(ch("bugs"), "week") === "open", "a tab asked for is kept only when the channel has it");
const custom = listChannels([{ slug: "3d-world", name: "3d-world", topic: null, made_by: "Mikey", created_at: at(1) }]).find((c) => c.slug === "3d-world")!;
ok(tabsFor(custom).map((t) => t.id).join() === "messages,pins", "a channel someone added: Messages | Pinned");
ok(BUILT_IN_CHANNELS.every((c) => (CHANNEL_HOW[c.slug] ?? "").length > 20 && !CHANNEL_HOW[c.slug].includes("\n")), "every preset says what it is for, in one line");
ok(channelHow(custom).includes("#3d-world"), "an added channel's empty line names it");

console.log("#today: check-ins");
const M: TeamMessage[] = [
  msg("Mikey", "[#today] filming the goal replays", at(11, 9)),
  msg("Leo", "[#today] lag test page", at(11, 9, 30)),
  msg("Mikey", "[#today] sound for the replays", at(12, 8)),
  msg("Mikey", "[#today] sound, then the shop pictures", at(12, 11)),
  msg("Leo", "[#today] [re:3] nice", at(12, 11, 5)),
  msg("Harry", "on the Team room today", at(12, 9)),
  msg("Harry", "[#ideas] check-ins as a grid", at(12, 9)),
];
const today = checkInsFor(M, "2026-11-12");
ok(today.Mikey?.text === "sound, then the shop pictures", "a person's check-in is their NEWEST #today line that day");
ok(!today.Leo, "a thread reply in #today is not a check-in");
ok(!today.Harry, "a message in another channel is not a check-in");
ok(notCheckedIn(M, "2026-11-12").join() === "Harry,Leo" && notCheckedIn(M, "2026-11-11").join() === "Harry", "who has not checked in, by day");
ok(checkInBody("  filming   the replays ") === "[#today] filming the replays", "a check-in is saved as a #today message, tidied");
ok(channelStream([msg("Harry", checkInBody("x y"), at(12))], TODAY_CHANNEL).length === 1, "…so it also shows in #today's Messages");
ok(ukDay(new Date(Date.UTC(2026, 5, 30, 23, 30))).day === "2026-07-01", "the day is the UK day (summer time: 23:30 UTC is already tomorrow)");
ok(ukDay(new Date(Date.UTC(2026, 10, 12, 23, 30))).day === "2026-11-12", "…and in winter 23:30 UTC is still today");
const wk = weekDays(new Date(Date.UTC(2026, 10, 12, 12)));
ok(wk.length === 7 && wk[0] === "2026-11-09" && wk[6] === "2026-11-15", "the week runs Monday to Sunday");
ok(weekDays(new Date(Date.UTC(2026, 10, 15, 12)))[0] === "2026-11-09" && weekDays(new Date(Date.UTC(2026, 10, 9, 1)))[0] === "2026-11-09", "Sunday and Monday both belong to the same week");
const grid = weekGrid(M, new Date(Date.UTC(2026, 10, 12, 12)));
ok(grid[3].today && grid[3].cells.Mikey?.text === "sound, then the shop pictures" && grid[2].cells.Leo?.text === "lag test page", "the grid has each day's check-in in its cell");
ok(grid[4].future && !grid[3].future && grid[0].cells.Harry === null, "days still to come are marked; an empty day is empty");

console.log("#health: the four coloured lines");
const post = limitsPost({ day: "2026-11-12", dbBytes: 490e6, storageBytes: 400e6, r2: { total: 1.2e9, folders: [{ folder: "patch-notes", bytes: 7e8 }] }, backup: null });
const row = (i: number, p: { title: string; body: string }, meta: Record<string, unknown>, when = at(12, 8)): BotRow => ({ id: i, bot: "health", channel: "health", title: p.title, body: p.body, url: null, everyone: false, created_at: when, meta });
const R = row(5, post, { kind: "limits", red: post.red, level: post.level, day: "2026-11-12", lines: post.lines });
const L = healthLines(R);
ok(L.length === 4, "the morning post has four lines: database, storage, R2, backup");
ok(L.map((l) => l.level).join() === "red,green,green,red", "each line carries its own colour (database 93% red, no backup red)");
ok(L.every((l) => !/^[🟢🟠🔴⚪]/u.test(l.text)) && L[0].text.startsWith("Database:"), "the dot is drawn by the room, not left in the words");
ok(healthLevel(R) === "red" && isLimitsPost(R), "the post's level is its worst line");
ok(healthLines({ body: post.body, meta: null }).map((l) => l.level).join() === "red,green,green,red", "with no levels saved beside it, the colour is read from the line's own dot");
const noted = healthLines({ body: `${post.body}\nNote: R2 is not connected here`, meta: { lines: post.lines } });
ok(noted.length === 5 && noted[4].note && noted[4].level === "unknown", "a Note line has no colour");
const notice = row(6, { title: "Morning limits did not run: CRON_SECRET missing", body: "Set it in Vercel." }, { kind: "no-secret" }, at(13, 8));
const settings: BotRow = { id: 7, bot: "health", channel: "bot-settings", title: "Health bot off", body: "", url: null, everyone: false, created_at: at(13), meta: { kind: "settings", enabled: false } };
ok(healthPosts([R, notice, settings]).map((r) => r.id).join() === "6,5", "history: its posts newest first, never a settings row");
ok(latestLimits([R, notice, settings])?.id === 5, "the newest LIMITS post is the one shown on top (a notice is not)");
ok(rowBotPosts([R])[0].channel === "health" && rowBotPosts([R])[0].name === "Health bot" && !!rowBotPosts([R])[0].meta, "in the chat it shows in #health as Health bot, with its colours");

console.log(failed ? `\n${failed} FAILED` : "\nAll passed");
process.exit(failed ? 1 : 0);
