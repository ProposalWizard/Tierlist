/**
 * tests/star/teamRoomStatus.mts — the Team room's round four (Harry, 25 Oct
 * 2026): status and schedules (lib/teamRoom/status.ts), the 🔔 per channel
 * (bells.ts), the note shown once on first open (welcome.ts) and #bugs from
 * players' reports (bugs.ts). Run: npx tsx tests/star/teamRoomStatus.mts
 */
import {
  backAt, cleanSchedules, cleanStatus, clearAt, daysLabel, liveStatus, pauseUntil, presenceOf, scheduleOn, statusLine, type StatusRow,
} from "@/lib/teamRoom/status";
import { bellFor, cleanBells, mutedNow, NO_BELLS, popupFor, ringsWithBells, withBell, withMute } from "@/lib/teamRoom/bells";
import { cleanWelcome, fillName, nextVersion, welcomeDue, welcomeReceipts, welcomeUpdated, type WelcomeRead } from "@/lib/teamRoom/welcome";
import { bugCounts, bugReports, cleanMark, handTaskTitle } from "@/lib/teamRoom/bugs";
import type { BotRow } from "@/lib/teamRoom/channels";

let failed = 0;
const ok = (c: boolean, what: string) => { if (!c) { failed++; console.error(`  FAIL ${what}`); } else console.log(`  ✓ ${what}`); };
// Monday 26 Oct 2026, 14:30 in London (GMT: the clocks went back on 25 Oct, so London = UTC).
const MON = new Date(Date.UTC(2026, 9, 26, 14, 30));
const row = (over: Partial<StatusRow> = {}): StatusRow => ({ person: "Mikey", emoji: null, text: null, clear_at: null, dnd_until: null, schedules: [], tz: "Europe/London", updated_at: MON.toISOString(), ...over });

console.log("Status");
{
  const s = liveStatus(row({ emoji: "🎬", text: "filming clips", clear_at: new Date(MON.getTime() + 3600_000).toISOString() }), MON);
  ok(s.emoji === "🎬" && s.text === "filming clips" && !s.busy && !s.quiet && statusLine(s) === "🎬 filming clips", "a status shows until it clears");
  const gone = liveStatus(row({ emoji: "🎬", text: "x", clear_at: new Date(MON.getTime() - 1).toISOString() }), MON);
  ok(!gone.emoji && !gone.text && statusLine(gone) === "", "a cleared status is gone by itself");
  const dnd = liveStatus(row({ dnd_until: new Date(MON.getTime() + 60_000).toISOString() }), MON);
  ok(dnd.quiet && presenceOf(true, dnd) === "dnd", "do not disturb: quiet, red dot even while active");
  ok(presenceOf(true, liveStatus(null, MON)) === "active" && presenceOf(false, liveStatus(null, MON)) === "away", "green when here, ring when away");
  const c = cleanStatus({ emoji: "  ", text: "x".repeat(300), schedules: "nope" }, "Leo");
  ok(c.emoji === null && c.text?.length === 100 && c.schedules.length === 0 && c.person === "Leo", "a row is cleaned (empty words, too long, bad schedules)");
}

console.log("Schedules (T2): on and off by themselves");
{
  const uni = { id: "u", emoji: "🎓", text: "Uni", days: [0, 1, 2, 3, 4], from: "09:00", to: "17:00", pause: true };
  const s = liveStatus(row({ emoji: "🎬", text: "typed", schedules: [uni] }), MON);
  ok(!!s.busy && s.emoji === "🎓" && s.backAt === "5" && s.quiet && statusLine(s) === "🎓 Uni · back at 5", "Monday 14:30: Uni is on, back at 5, buzzes wait");
  ok(presenceOf(true, s) === "busy", "busy beats active (amber)");
  const after = new Date(Date.UTC(2026, 9, 26, 17, 5));
  ok(!liveStatus(row({ schedules: [uni] }), after).busy, "at 17:05 London time it has cleared itself");
  const sat = new Date(Date.UTC(2026, 9, 31, 12, 0));
  ok(!scheduleOn([uni], sat, "Europe/London"), "Saturday: a weekday schedule is off");
  const night = { ...uni, id: "n", days: [0], from: "22:00", to: "02:00" };
  ok(!!scheduleOn([night], new Date(Date.UTC(2026, 9, 27, 0, 30)), "Europe/London"), "past midnight counts from the day it started (Mon 22:00 → Tue 00:30)");
  ok(!liveStatus(row({ schedules: [{ ...uni, pause: false }] }), MON).quiet, "a schedule can leave buzzes on");
  ok(backAt("17:30") === "5:30" && backAt("12:00") === "12" && backAt("08:00") === "8", "back at: 12-hour, no :00");
  ok(daysLabel([0, 1, 2, 3, 4]) === "Mon–Fri" && daysLabel([5]) === "Sat" && daysLabel([0, 2, 4]) === "Mon, Wed, Fri" && daysLabel([5, 6]) === "Weekends", "days read like the plan");
  ok(cleanSchedules([{ days: [9], from: "9", to: "x" }, uni, { ...uni, from: "09:00", to: "09:00" }]).length === 1, "bad schedules are left out");
}

console.log("Clear after and pause");
{
  const now = new Date(2026, 9, 26, 14, 30);
  ok(Date.parse(clearAt("1h", now)!) - now.getTime() === 3600_000 && clearAt("never", now) === null, "1 hour; never");
  const today = new Date(clearAt("today", now)!);
  ok(today.getDate() === 27 && today.getHours() === 0, "today = midnight tonight");
  const week = new Date(clearAt("week", now)!);
  ok(week.getDay() === 1 && week.getHours() === 0 && week.getDate() === 2, "this week = midnight at the end of Sunday");
  const tom = new Date(pauseUntil("tomorrow", now));
  ok(tom.getDate() === 27 && tom.getHours() === 9, "pause until 9 tomorrow");
}

console.log("Bells (U12): every message, only @mentions, off, mute 1 hour");
{
  ok(bellFor(NO_BELLS, "bugs") === "all" && bellFor(NO_BELLS, "health") === "red" && bellFor(NO_BELLS, "general") === "mentions", "the starting setup: #bugs every message, #health only red, the rest mentions");
  ok(bellFor({ ch: { general: "red" }, mute: {} }, "general") === "mentions", "Only red is for #health alone");
  const p1 = withBell(NO_BELLS, "general", "all");
  ok(p1.ch.general === "all" && !("bugs" in withBell(p1, "bugs", "all").ch), "setting back to the start leaves no entry");
  const now = Date.now();
  const m = withMute(p1, "general", new Date(now + 3600_000).toISOString(), now);
  ok(mutedNow(m, "general", now) && !mutedNow(m, "general", now + 3600_001), "mute 1 hour, then on again");
  ok(Object.keys(cleanBells({ ch: { general: "loud", "Bad!": "all", ideas: "off" }, mute: { x: "no" } }).ch).join() === "ideas", "saved bells are cleaned");
  const base = [{ person: "Leo" as const, why: "mention" as const }];
  const r = ringsWithBells({ sender: "Harry", slug: "general", base, prefsOf: { Mikey: withBell(NO_BELLS, "general", "all"), Leo: NO_BELLS }, quiet: [], now });
  ok(r.map((x) => `${x.person}:${x.why}`).join() === "Mikey:message,Leo:mention", "Mikey (every message) and Leo (named) both buzz");
  const off = ringsWithBells({ sender: "Harry", slug: "general", base, prefsOf: { Leo: withBell(NO_BELLS, "general", "off") }, quiet: [], now });
  ok(off.length === 0, "off: never a buzz, even when named");
  ok(ringsWithBells({ sender: "Harry", slug: "bugs", base: [], prefsOf: {}, quiet: ["Leo"], now }).map((x) => x.person).join() === "Mikey", "#bugs buzzes everyone but the sender and anyone with buzzes paused");
  ok(ringsWithBells({ sender: "Harry", slug: "health", base: [], prefsOf: {}, quiet: [], now }).length === 0
    && ringsWithBells({ sender: "Harry", slug: "health", base: [], prefsOf: {}, quiet: [], now, red: true }).length === 2, "#health: only a red post buzzes");
  ok(popupFor({ me: "Leo", sender: "Mikey", slug: "general", namesMe: false, prefs: NO_BELLS, quiet: false, now }) === false
    && popupFor({ me: "Leo", sender: "Mikey", slug: "general", namesMe: true, prefs: NO_BELLS, quiet: false, now })
    && !popupFor({ me: "Leo", sender: "Leo", slug: "bugs", namesMe: true, prefs: NO_BELLS, quiet: false, now }), "computer pop-ups follow your own bell, never your own message");
}

console.log("The note shown once on first open");
{
  const w = cleanWelcome({ body: "Hello {name}", lines: { Mikey: " a line ", Bob: "x" }, version: 2, updated_by: "Harry" })!;
  ok(w.lines.Mikey === "a line" && !("Bob" in w.lines) && fillName(w.body, "Leo") === "Hello Leo", "{name} fills in; unknown names are dropped");
  const reads: WelcomeRead[] = [{ person: "Mikey", version: 1, at: "2026-10-25T10:00:00Z" }, { person: "Leo", version: 2, at: "2026-10-25T11:00:00Z" }];
  ok(welcomeDue(w, reads, "Mikey") && !welcomeDue(w, reads, "Leo") && welcomeUpdated(w, reads, "Mikey"), "shown again after an edit, marked UPDATED, until Got it");
  ok(!welcomeDue(cleanWelcome({ body: "  ", lines: {} }), [], "Mikey") && !welcomeDue(w, [], null), "an empty note never shows");
  const rc = welcomeReceipts(w, reads);
  ok(rc.map((x) => `${x.person}:${x.at ? "read" : x.older ? "older" : "not"}`).join() === "Mikey:older,Leo:read", "who has read it (Harry's view)");
  ok(nextVersion(w, true) === 3 && nextVersion(w, false) === 2 && nextVersion(null, false) === 1, "Show again moves the version on");
}

console.log("#bugs: Bug bot cards");
{
  const rows: BotRow[] = [
    { id: 5, bot: "bug", channel: "bugs", title: "Keeper froze", body: "Keeper froze", url: "/star-dev", everyone: false, created_at: "2026-10-25T10:00:00Z", meta: { signed_in: true } },
    { id: 7, bot: "bug", channel: "bugs", title: "Button off screen", body: "b", url: "https://x.example/evil", everyone: false, created_at: "2026-10-25T11:00:00Z" },
    { id: 6, bot: "patch-notes", channel: "patch-notes", title: "v1", body: "", url: null, everyone: true, created_at: "2026-10-25T10:30:00Z" },
  ];
  const marks = [cleanMark({ post_id: 5, handed_to: "Leo", fixed_by: "Leo", fixed_at: "2026-10-25T12:00:00Z", updated_by: "Leo" })!];
  const list = bugReports(rows, marks);
  ok(list.map((b) => b.number).join() === "7,5" && list[1].mark?.fixed_by === "Leo" && list[1].signedIn && list[0].page === null, "reports newest first, with marks; an outside link is dropped");
  ok(JSON.stringify(bugCounts(list, "Leo")) === JSON.stringify({ open: 1, mine: 0, fixed: 1 }), "Open · Mine · fixed counts");
  ok(handTaskTitle(list[0]) === "🐞 Bug #7: Button off screen", "Hand to… makes a #todo task that names the report");
  ok(cleanMark({ post_id: "x", updated_by: "Leo" }) === null && cleanMark({ post_id: 3, updated_by: "Bob" }) === null, "bad marks are left out");
}

if (failed) { console.error(`\n${failed} failed`); process.exit(1); }
console.log("\nAll status, bell, note and bug checks passed.");
