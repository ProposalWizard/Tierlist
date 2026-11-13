/**
 * tests/star/teamRoomBots.mts — a run of all bots (Harry, 12 Nov 2026: "have
 * you done a run of all bots?"). Two halves:
 *
 *   1. Each bot's sums: it posts once however often it is asked, in the right
 *      channel, naming the right people.
 *   2. THE RUN: every bot's real server code (lib/teamRoom/botsServer.ts)
 *      driven once, then again, against a pretend database held in memory
 *      (the same table and column names as the real one; nothing leaves this
 *      computer). The second run must post nothing.
 *
 * Run: npx tsx tests/star/teamRoomBots.mts
 * Add --table to print the run as the rows of docs/team-room-run.md.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { BOTS, botInfo, botSettings, botStatusLine, settingsRow } from "@/lib/teamRoom/patchBot";
import { BUG_BOT, bugPollPlan, bugReports, bugRowFor, duplicateBugRows, postedFeedbackIds, type FeedbackRow } from "@/lib/teamRoom/bugs";
import { TODAY_BOT, TODAY_CHANNEL, checkInBody, isTodayAsk, todayAskPlan } from "@/lib/teamRoom/today";
import { healthLines, isLimitsPost, latestLimits, limitsPostedFor } from "@/lib/teamRoom/health";
import { BUILT_IN_CHANNELS, jobBotPosts, jobIsFor, rowBotPosts, type BotRow } from "@/lib/teamRoom/channels";
import { mentionsIn } from "@/lib/teamRoom/extras";
import { runBugBot, runHealthBot, runOne, runPatch, runQuarterHour, runTodayBot } from "@/lib/teamRoom/botsServer";
import { BUILT_IN_PATCH_NOTES } from "@/lib/patchNotesData";
import type { TeamMessage } from "@/lib/teamRoom/logic";
import type { TeamJob } from "@/lib/teamRoom/jobs";

let failed = 0;
const ok = (c: boolean, what: string) => { if (!c) { failed++; console.error(`  FAIL ${what}`); } else console.log(`  ✓ ${what}`); };
const at = (d: number, h = 10, m = 0) => new Date(Date.UTC(2026, 10, d, h, m));
let id = 100;
const saved = (r: Omit<BotRow, "id" | "created_at">, when = at(12, 9)): BotRow => ({ ...r, id: id++, created_at: when.toISOString() });
const msg = (person: TeamMessage["person"], body: string, when: Date): TeamMessage => ({ id: id++, person, body, image_url: null, page: null, pinned: false, created_at: when.toISOString() });
const channels = new Set(BUILT_IN_CHANNELS.map((c) => c.slug));

console.log("The list of bots");
ok(BOTS.map((b) => b.bot).join() === "patch-notes,bug,health,today,jobs,claude,harry-bot,mikey-bot,leo-bot", "nine bots: Patch, Bug, Health, Today, Jobs, then Claude and one each for Harry, Mikey and Leo (13 Nov 2026)");
ok(BOTS.every((b) => channels.has(b.channel)), "each bot posts in a channel that exists");
ok(BOTS.every((b) => b.does.length >= 2 && b.runs.length > 20), "each says what it does and when it runs");
ok(BOTS.every((b) => (b.runnable ? !!b.runDoes : !!b.noRun)), "each either has Run now (and says what it does) or says why not");
ok(BOTS.every((b) => b.switchable || !!b.fixed), "each either has a switch or says why not");
ok(botInfo("jobs")!.runnable === false && botInfo("bug")!.switchable === false, "Jobs bot has nothing to run; Bug bot can't be switched off (it lives in the database)");

console.log("Bug bot: a report becomes one card");
const now = at(12, 12).getTime();
const fb = (i: string, minsAgo: number, message = `Report ${i}\nmore words`, extra: Partial<FeedbackRow> = {}): FeedbackRow =>
  ({ id: i, message, page_url: "https://knowitball.co.uk/star-dev?x=1", created_at: new Date(now - minsAgo * 60_000).toISOString(), user_id: null, ...extra });
const card = bugRowFor(fb("a1", 10, "Keeper froze mid dive\nSecond half, the keeper stopped.", { user_id: "u1" }));
ok(card.bot === "bug" && card.channel === "bugs", "the card is the Bug bot's, in #bugs");
ok(card.title === "Keeper froze mid dive" && card.body.includes("Second half"), "title = the report's first line; the words are kept whole");
ok(card.url === "/star-dev?x=1" && card.meta.signed_in === true && card.meta.feedback_id === "a1", "the page is a path on this site; signed in or not; the report's own id rides along");
ok(bugRowFor(fb("a2", 10, "   ")).title === "Bug report" && bugRowFor(fb("a3", 10, "x", { page_url: "javascript:alert(1)" })).url === null, "an empty report still gets a title; a bad page address is dropped");
ok(card.everyone === false && mentionsIn(card.body).length === 0, "a card names nobody (the 🔔 for #bugs decides who is buzzed)");
const reports = [fb("r1", 60), fb("r2", 30), fb("old", 60 * 24 * 5), fb("fresh", 1), fb("r1", 60)];
const plan1 = bugPollPlan({ feedback: reports, rows: [], now });
ok(plan1.map((p) => p.meta.feedback_id).join() === "r1,r2", "the check posts reports of the last 3 days, oldest first; not a 5-day-old one, not one under 2 minutes old, never one twice");
const after1 = plan1.map((p) => saved(p));
ok(bugPollPlan({ feedback: reports, rows: after1, now }).length === 0, "asked again with its own rows: nothing (idempotent)");
const fromTrigger = saved({ bot: "bug", channel: "bugs", title: "Report r2", body: "x", url: null, everyone: false, meta: { feedback_id: "r2", signed_in: false } });
ok(bugPollPlan({ feedback: reports, rows: [fromTrigger], now }).map((p) => p.meta.feedback_id).join() === "r1", "a report the database already posted is left alone");
ok(postedFeedbackIds([...after1, fromTrigger]).size === 2, "cards are matched to reports by the report's id");
ok(duplicateBugRows([...after1, fromTrigger]).join() === String(fromTrigger.id), "the rule and the check landing together: the later double is the one removed");
ok(bugPollPlan({ feedback: Array.from({ length: 30 }, (_, i) => fb(`m${i}`, 10 + i)), rows: [], now }).length === BUG_BOT.maxPerRun, "at most 10 cards in one run");
ok(bugReports(after1, []).length === 2 && bugReports(after1, [])[0].title === "Report r2", "the room draws them as report cards, newest first");

console.log("Today bot: one ask a morning");
const thu9 = at(12, 9, 5); // Thursday 12 Nov 2026, 09:05 UK (GMT)
const mikeyIn = [msg("Mikey", checkInBody("filming"), at(12, 8))];
const ask = todayAskPlan({ now: thu9, rows: [], messages: mikeyIn });
ok(ask.length === 1 && ask[0].bot === TODAY_BOT.bot && ask[0].channel === TODAY_CHANNEL, "it posts once, as the Today bot, in #today");
ok(mentionsIn(ask[0].body).join() === "Harry,Leo" && (ask[0].meta.people as string[]).join() === "Harry,Leo", "it names the two who have not checked in, never the one who has");
ok(ask[0].everyone === false && ask[0].url === "/admin/team?tab=chat&ch=today", "no @everyone; Open goes to #today");
const asked = ask.map((p) => saved(p, thu9));
ok(isTodayAsk(asked[0]) && todayAskPlan({ now: at(12, 9, 20), rows: asked, messages: mikeyIn }).length === 0, "asked again the same day: nothing");
ok(todayAskPlan({ now: at(13, 9, 5), rows: asked, messages: mikeyIn }).length === 1, "the next morning it asks again");
ok(todayAskPlan({ now: at(12, 8, 55), rows: [], messages: [] }).length === 0, "before 09:00 UK: nothing");
ok(todayAskPlan({ now: at(12, 14, 5), rows: [], messages: [] }).length === 0, "after 14:00 UK (a first run late in the day): nothing");
ok(todayAskPlan({ now: at(14, 9, 5), rows: [], messages: [] }).length === 0 && todayAskPlan({ now: at(15, 9, 5), rows: [], messages: [] }).length === 0, "Saturday and Sunday: nothing");
const allIn = [...mikeyIn, msg("Harry", checkInBody("team room"), at(12, 8, 30)), msg("Leo", checkInBody("lag test"), at(12, 8, 40))];
ok(todayAskPlan({ now: thu9, rows: [], messages: allIn }).length === 0, "all three checked in: nothing");
ok(todayAskPlan({ now: thu9, rows: [], messages: mikeyIn, enabled: false }).length === 0, "switched off: nothing");
ok(todayAskPlan({ now: new Date(Date.UTC(2026, 5, 30, 8, 5)), rows: [], messages: [] }).length === 1, "in summer 09:00 UK is 08:00 UTC: it follows UK time");

console.log("Jobs bot: pushed jobs show in #todo");
const jobs: TeamJob[] = [
  { id: "lag-test", title: "Lag test on your phone", owner: "all", from: "Harry", added: at(10).toISOString() } as TeamJob,
  { id: "sql", title: "Run the SQL file", owner: "Mikey", from: "Harry", added: at(11).toISOString() } as TeamJob,
];
const jp = jobBotPosts(jobs);
ok(jp.length === 2 && jp.every((p) => p.bot === "jobs" && p.channel === "todo"), "one post per pushed job, as the Jobs bot, in #todo");
ok(jp[0].everyone === true && jp[1].everyone === false && jp[1].body.includes("For Mikey"), "a job for all says @everyone; a job for one names that person");
ok(new Set(jobBotPosts([...jobs]).map((p) => p.key)).size === 2 && jobBotPosts(jobs)[0].key === "job:lag-test", "drawn from the jobs file each time, keyed by the job's id: it can never double");
ok(jobIsFor(jobs[1], "Mikey") && !jobIsFor(jobs[1], "Leo") && jobIsFor(jobs[0], "Leo"), "only the person a job is for can tick it");

console.log("Settings: every switchable bot has its own switch");
const offRow = saved({ ...settingsRow("today", { enabled: false, nudgeHours: 24 }, "Harry") });
ok(botSettings([offRow], "today").enabled === false && botSettings([offRow], "health").enabled === true && botSettings([offRow]).enabled === true, "switching the Today bot off leaves the others on");
ok(botStatusLine("today", [offRow], botSettings([offRow], "today"), now).tone === "off", "its page says Off");
ok(botStatusLine("health", [], botSettings([], "health"), now).tone === "wait" && botStatusLine("bug", after1, botSettings([], "bug"), now).tone === "ok", "a bot with no post yet says Waiting; one with posts says Working");
ok(botStatusLine("jobs", [], botSettings([], "jobs"), now, 2).tone === "ok" && botStatusLine("jobs", [], botSettings([], "jobs"), now, 0).tone === "wait", "the Jobs bot is Working while a pushed job is showing");

/* ── THE RUN: every bot's server code against a pretend database ───────── */

type Row = Record<string, unknown>;
/** A pretend Supabase: tables in memory, the handful of calls the bots make. */
function pretendDb(tables: Record<string, Row[]>) {
  let nextId = 1;
  const log: string[] = [];
  const get = (o: Row, path: string): unknown => (path.includes("->>") ? ((o[path.split("->>")[0]] ?? {}) as Row)[path.split("->>")[1]] : o[path]);
  class Q implements PromiseLike<{ data: Row[] | Row | null; error: { message: string; code?: string } | null }> {
    private filters: ((r: Row) => boolean)[] = [];
    private sort: { col: string; asc: boolean } | null = null;
    private max = 1000;
    private mode: "select" | "insert" | "delete" = "select";
    private payload: Row | null = null;
    private one = false;
    constructor(private table: string) {}
    select() { return this; }
    insert(row: Row) { this.mode = "insert"; this.payload = row; return this; }
    delete() { this.mode = "delete"; return this; }
    eq(c: string, v: unknown) { this.filters.push((r) => get(r, c) === v); return this; }
    lt(c: string, v: number) { this.filters.push((r) => (get(r, c) as number) < v); return this; }
    gte(c: string, v: string) { this.filters.push((r) => String(get(r, c)) >= v); return this; }
    like(c: string, v: string) { const pre = v.replace(/%$/, ""); this.filters.push((r) => String(get(r, c)).startsWith(pre)); return this; }
    in(c: string, v: unknown[]) { this.filters.push((r) => v.includes(get(r, c))); return this; }
    order(col: string, o: { ascending: boolean }) { this.sort = { col, asc: o.ascending }; return this; }
    limit(n: number) { this.max = n; return this; }
    single() { this.one = true; return this; }
    maybeSingle() { this.one = true; return this; }
    private run() {
      const t = (tables[this.table] ??= []);
      if (this.mode === "insert") {
        const row = { id: nextId++, created_at: new Date(clock).toISOString(), ...this.payload } as Row;
        t.push(row); log.push(`insert ${this.table}: ${String(row.bot ?? "")} ${String(row.title ?? "")}`);
        return { data: this.one ? row : [row], error: null };
      }
      const hit = t.filter((r) => this.filters.every((f) => f(r)));
      if (this.mode === "delete") { tables[this.table] = t.filter((r) => !hit.includes(r)); return { data: null, error: null }; }
      const s = this.sort;
      const sorted = s ? [...hit].sort((a, b) => (get(a, s.col)! < get(b, s.col)! ? -1 : get(a, s.col)! > get(b, s.col)! ? 1 : 0) * (s.asc ? 1 : -1)) : hit;
      const out = sorted.slice(0, this.max);
      return { data: this.one ? out[0] ?? null : out, error: null };
    }
    then<A, B>(res?: ((v: { data: Row[] | Row | null; error: { message: string; code?: string } | null }) => A | PromiseLike<A>) | null, rej?: ((e: unknown) => B | PromiseLike<B>) | null) { return Promise.resolve(this.run()).then(res, rej); }
  }
  const sb = {
    from: (table: string) => new Q(table),
    // ops_limits(): database 371 MB, Storage 412 MB.
    rpc: async () => ({ data: [{ db_bytes: 371 * 1048576, storage_bytes: 412 * 1048576 }], error: null }),
  };
  return { sb: sb as unknown as SupabaseClient, tables, log };
}
let clock = at(12, 9, 10).getTime();

console.log("THE RUN: each bot once, then again, against a pretend database");
// A pretend patch note, published "now", so the Patch bot has something new to announce whatever the real list holds.
(BUILT_IN_PATCH_NOTES as unknown as Row[]).push({ version: "99.1", title: "Leo's patch notes: A pretend note for the run", publishedAt: new Date(clock - 20 * 60_000).toISOString(), author: "Leo", summary: "A pretend patch note so the run has one to announce. It is not a real note." });
const newestNote = { version: "99.1" };
const db = pretendDb({
  team_bot_posts: [],
  team_acks: [],
  team_members: [],
  feedback: [
    { id: "f-1", message: "Shop button is off the screen\nOn my phone the Buy button is cut off.", page_url: "https://knowitball.co.uk/star-dev", created_at: new Date(clock - 40 * 60_000).toISOString(), user_id: null },
    { id: "f-2", message: "Old report from last week", page_url: null, created_at: new Date(clock - 6 * 86400_000).toISOString(), user_id: "u9" },
  ],
  team_messages: [{ id: 1, person: "Mikey", body: checkInBody("filming the goal replays"), image_url: null, page: null, pinned: false, created_at: new Date(clock - 30 * 60_000).toISOString() }],
});
const posts = () => db.tables.team_bot_posts as unknown as BotRow[];
const table: string[][] = [];
const note = (bot: string, did: string, result: string) => table.push([bot, did, result]);

// Patch bot
const p1 = await runPatch(db.sb, new Date(clock));
const announced = posts().filter((r) => r.bot === "patch-notes");
ok(p1.ok && announced.length >= 1 && announced.every((r) => r.channel === "general"), `Patch bot: announced ${announced.length} patch note(s) in #general (${p1.text})`);
const mine = announced.find((r) => (r.meta as Row).version === newestNote.version);
ok(!!mine && mentionsIn(mine.body).length === 2 && !mentionsIn(mine.body).includes((mine.meta as Row).author as never), `Patch bot: v${newestNote.version} names the two who did not write it`);
const p2 = await runPatch(db.sb, new Date(clock));
ok(p2.ok && p2.posted === 0 && posts().filter((r) => r.bot === "patch-notes").length === announced.length, "Patch bot: run again, nothing more is posted");
note("Patch bot", `Run 1 announced ${announced.length} note(s) in #general, newest v${newestNote.version} naming ${mentionsIn(mine!.body).join(" and ")}. Run 2 posted 0.`, p1.ok && p2.posted === 0 ? "works" : "FAILED");

// Bug bot
const b1 = await runBugBot(db.sb, new Date(clock));
const cards = posts().filter((r) => r.bot === "bug");
ok(b1.ok && b1.posted === 1 && cards.length === 1 && cards[0].channel === "bugs" && cards[0].title === "Shop button is off the screen", `Bug bot: 1 card in #bugs for the 40-minute-old report, none for the week-old one (${b1.text})`);
const b2 = await runBugBot(db.sb, new Date(clock));
ok(b2.ok && b2.posted === 0 && posts().filter((r) => r.bot === "bug").length === 1, `Bug bot: run again, nothing more (${b2.text})`);
note("Bug bot", "Run 1 posted 1 card in #bugs for a 40-minute-old report and none for a 6-day-old one. Run 2 posted 0.", b1.posted === 1 && b2.posted === 0 ? "works" : "FAILED");

// Today bot
const t1 = await runTodayBot(db.sb, new Date(clock));
const asks = posts().filter((r) => r.bot === "today");
ok(t1.ok && t1.posted === 1 && asks.length === 1 && asks[0].channel === "today" && mentionsIn(asks[0].body).join() === "Harry,Leo", `Today bot: asked Harry and Leo in #today, not Mikey who had checked in (${t1.text})`);
const t2 = await runTodayBot(db.sb, new Date(clock));
ok(t2.ok && t2.posted === 0 && t2.text.includes("already asked"), `Today bot: run again, nothing more (${t2.text})`);
note("Today bot", "Run 1 at 09:10 on a Thursday asked Harry and Leo in #today (Mikey had checked in). Run 2 posted 0: already asked today.", t1.posted === 1 && t2.posted === 0 ? "works" : "FAILED");

// Health bot (the 08:00 job's own code; then Run now)
const h1 = await runHealthBot(db.sb, new Date(clock));
const hp = posts().filter((r) => r.bot === "health");
ok(h1.ok && hp.length === 1 && hp[0].channel === "health" && isLimitsPost(hp[0]), `Health bot: one limits post in #health (${h1.text})`);
const hl = healthLines(hp[0]).filter((l) => !l.note);
ok(hl.length === 4 && hl[0].level === "green" && hl[1].level === "green", "Health bot: four lines, database 74% and Storage 40% both green");
ok(hl[2].level === "unknown" && hl[3].level === "red" && h1.red === true, "Health bot: R2 not connected here = not read (grey); no backup found = red, so the post is red");
ok(rowBotPosts(hp)[0].name === "Health bot" && limitsPostedFor(posts(), "2026-11-12"), "Health bot: it shows as Health bot, for today's date");
const h2 = await runOne(db.sb, "health", "Harry", new Date(clock));
const manual = posts().filter((r) => r.bot === "health" && (r.meta as Row).manual === true);
ok(h2.ok && manual.length === 1 && manual[0].title.endsWith("asked for by Harry") && latestLimits(posts())?.id === manual[0].id, "Health bot: Run now posts the same four lines, marked asked for by Harry");
note("Health bot", "The 08:00 job's code posted 4 coloured lines in #health (database 74% green, Storage 40% green, R2 not read, backup not found = red). Run now posted a second one marked \"asked for by Harry\".", h1.ok && h2.ok ? "works with fake data only" : "FAILED");

// Switched off
await db.sb.from("team_bot_posts").insert(settingsRow("today", { enabled: false, nudgeHours: 24 }, "Harry"));
clock = at(13, 9, 10).getTime();
const tOff = await runTodayBot(db.sb, new Date(clock));
ok(tOff.ok && tOff.off === true && tOff.posted === 0, "Today bot switched off: the next morning it asks nobody");
await db.sb.from("team_bot_posts").insert(settingsRow("health", { enabled: false, nudgeHours: 24 }, "Harry"));
const hOff = await runHealthBot(db.sb, new Date(clock));
ok(hOff.off === true && hOff.posted === 0, "Health bot switched off: no morning post");

// The quarter-hour run, all three together
const q = await runQuarterHour(db.sb, new Date(clock));
ok(q.ok && q.runs.map((r) => r.bot).join() === "patch-notes,bug,today", "the 15-minute run does Patch, Bug and Today together");
ok(q.runs[0].text.includes("reminded about v99.1") && q.runs[1].posted === 0 && q.runs[2].off === true, "a day later: the Patch bot sends its one reminder, the Bug bot has nothing new, the Today bot is off");
const q2 = await runQuarterHour(db.sb, new Date(clock));
ok(q2.runs.every((r) => r.posted === 0), "…and the run after that posts nothing at all");
const none = await runOne(db.sb, "jobs", "Harry", new Date(clock));
ok(!none.ok && none.posted === 0, "Run now on the Jobs bot is refused: it has nothing to run");
note("Jobs bot", "2 pushed jobs drawn as 2 posts in #todo (one for everyone, one for Mikey); no rows are written, so it cannot double. Run now is refused: nothing to run.", "works");
ok(posts().every((r) => channels.has(r.channel) || r.channel === "bot-settings"), "every row any bot wrote is in a channel that exists (or is a settings row)");

if (process.argv.includes("--table")) {
  console.log("\n| Bot | What was done | Result |\n|---|---|---|");
  for (const r of table) console.log(`| ${r.join(" | ")} |`);
}
console.log(failed ? `\n${failed} FAILED` : "\nAll bot checks passed");
process.exit(failed ? 1 : 0);
