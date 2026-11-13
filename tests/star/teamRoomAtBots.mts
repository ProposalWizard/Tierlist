/**
 * tests/star/teamRoomAtBots.mts — bots you can @, and the AI bots (Harry, 13
 * Nov 2026: "can't @ any bots like I should be able to @patch notes bot in
 * general and ask for x patch notes" · "still no claude bots").
 *
 *   1. The sums: who a message @s, what each bot answers.
 *   2. THE RUN: the real server code (lib/teamRoom/atBotsServer.ts) against a
 *      pretend database held in memory and a PRETEND AI (the real AI service
 *      is never called; nothing leaves this computer).
 *
 * Run: npx tsx tests/star/teamRoomAtBots.mts
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { botMentionsIn, mentionsIn, parseMessage, typingToken, withoutBotMentions } from "@/lib/teamRoom/extras";
import {
  ASK_ME, asksOwed, bugAnswer, duplicateReplies, helpLine, isReplyRow, jobsAnswer, patchAnswer, repliesUnder, replyLinks, replyRow, sinceWhen, todayAnswer,
  type AskNote,
} from "@/lib/teamRoom/atBots";
import {
  CLAUDE_BOT, CANNOT_CHANGE, aiSettings, aiSettingsRow, brainSearch, buildRequest, canChangeAi, claudeGate, costUsd, finishReply, handoffTaskFor, isProposal, proposalState, spendThisMonth,
  tallyRow, wantsChange, type AiCall, type AiRequest, type BrainNote,
} from "@/lib/teamRoom/claudeBot";
import { answerOwed, answerProposal, claimHandoffs, finishHandoff, saveAiSettings, type AtDeps } from "@/lib/teamRoom/atBotsServer";
import { bugReports } from "@/lib/teamRoom/bugs";
import { checkInBody, checkInsFor } from "@/lib/teamRoom/today";
import { BOTS, botInfo } from "@/lib/teamRoom/patchBot";
import type { BotRow } from "@/lib/teamRoom/channels";
import type { TeamMessage, TeamTask } from "@/lib/teamRoom/logic";
import type { TeamJob } from "@/lib/teamRoom/jobs";
import type { TeamPerson } from "@/lib/teamRoom/config";

let failed = 0;
const ok = (c: boolean, what: string) => { if (!c) { failed++; console.error(`  FAIL ${what}`); } else console.log(`  ✓ ${what}`); };
const at = (d: number, h = 10, m = 0, s = 0) => new Date(Date.UTC(2026, 10, d, h, m, s));
const NOW = at(13, 12); // Friday 13 Nov 2026, 12:00 UK
const msg = (id: number, person: TeamPerson, body: string, when: Date = new Date(NOW.getTime() - 60_000)): TeamMessage => ({ id, person, body, image_url: null, page: null, pinned: false, created_at: when.toISOString() });

console.log("Who a message @s");
ok(botMentionsIn("@Patch bot latest").join() === "patch-notes" && botMentionsIn("hey @patch notes bot, 0.137").join() === "patch-notes" && botMentionsIn("@patchbot x").join() === "patch-notes", "\"@Patch bot\", \"@patch notes bot\" and \"@patchbot\" are all the Patch bot");
ok(botMentionsIn("@Claude what is the rule? and @Health bot limits").join() === "claude,health", "two bots in one message: both are named, in order");
ok(botMentionsIn("mail me at x@claude.com").length === 0 && botMentionsIn("the patch bot is good").length === 0, "an email address or a bot's name without @ names nobody");
ok(mentionsIn("@Harry bot what's on").length === 0 && botMentionsIn("@Harry bot what's on").join() === "harry-bot", "\"@Harry bot\" is Harry's bot, not Harry: it never rings Harry");
ok(mentionsIn("@Harry look, @Leo bot says so").join() === "Harry", "…and @Harry beside it is still Harry");
ok(withoutBotMentions("@Patch bot, since Monday") === "since Monday" && withoutBotMentions("@Claude") === "", "the words asked are what is left once the @bot is taken out");
ok(typingToken("hi @pat", 7)?.query === "pat" && typingToken("@patch b", 8)?.query === "patch b" && typingToken("@patch notes", 12) === null, "typing \"@pat\" or \"@patch b\" keeps the suggestion list open");
ok(BOTS.filter((b) => b.bot !== "jobs" || true).every((b) => (ASK_ME[b.bot] ?? ASK_ME.claude).length >= 2), "every bot's page has an Ask me list with at least two examples");

console.log("Patch bot: plain rules over the real patch-note fields");
const notes: AskNote[] = [
  { version: "0.137", title: "Harry's patch notes: Glass UI, real football", author: "Harry", publishedAt: at(12, 21).toISOString(), summary: "Glass stadium is the new look. The ball is a real football.", lines: ["The new Glass look on every career screen", "The real football", "Only one ball at your player's feet", "A quicker test check", "Settings row: UI look"] },
  { version: "0.136", title: "Leo's patch notes: Test pages play like the real game", author: "Leo", publishedAt: at(11, 15).toISOString(), summary: "Every test page now runs the real match. What you test is what players get.", lines: ["Test pages run the real match", "Free kicks on the test page"] },
  { version: "0.135", title: "Leo's patch notes: Free kicks, the top corner goes in", author: "Leo", publishedAt: at(9, 12).toISOString(), summary: "A free kick aimed at the top corner now goes in.", lines: ["Top corner free kicks go in", "Keeper dives later", "Wall jumps"] },
  { version: "0.134", title: "Mikey's patch notes: Game music", author: "Mikey", publishedAt: at(2, 6).toISOString(), summary: "Eleven new tracks.", lines: ["Game music toggle", "Eleven tracks", "Silence in cut scenes"] },
];
const one = patchAnswer("0.137", notes, NOW.getTime());
ok(one.text.includes("v0.137 · Harry · 12 Nov 2026") && one.text.includes("Glass UI, real football"), "\"0.137\": version, author, date and title");
ok((one.text.match(/^• /gm) ?? []).length === 5 && replyLinks({ meta: { links: one.links } })[0].url === "/admin/team?tab=notes&v=0.137", "…with 5 lines of what changed and a link to the note's page inside admin");
ok(patchAnswer("v0.137 please", notes, NOW.getTime()).text === one.text, "\"v0.137\" is the same answer");
const missing = patchAnswer("9.99", notes, NOW.getTime());
ok(missing.text === "I can't find v9.99. The three newest are v0.137, v0.136, v0.135." && missing.links?.length === 3, "an unknown version: says so and lists the three newest");
ok(patchAnswer("latest", notes, NOW.getTime()).text.includes("v0.137") && !patchAnswer("latest", notes, NOW.getTime()).text.includes("v0.136"), "\"latest\": the newest one only");
const last3 = patchAnswer("last 3", notes, NOW.getTime());
ok(["v0.137", "v0.136", "v0.135"].every((v) => last3.text.includes(v)) && !last3.text.includes("v0.134") && (last3.text.match(/^• /gm) ?? []).length >= 7, "\"last 3\": the three newest, each with its lines");
const since = patchAnswer("since Monday", notes, NOW.getTime());
ok(since.text.startsWith("3 patch notes since Monday:") && !since.text.includes("v0.134"), "\"since Monday\" (9 Nov): the three from then on, not the older one");
ok(sinceWhen("since yesterday", NOW.getTime())!.from === at(12, 0).getTime() && sinceWhen("since 10 Nov", NOW.getTime())!.from === at(10, 0).getTime() && sinceWhen("hello", NOW.getTime()) === null, "\"since yesterday\" and \"since 10 Nov\" are read as dates");
const leo = patchAnswer("what did Leo ship", notes, NOW.getTime());
ok(leo.text.startsWith("Leo's 2 newest (of 2):") && leo.text.includes("v0.136") && leo.text.includes("v0.135") && !leo.text.includes("v0.137"), "\"what did Leo ship\": Leo's notes only");
const kicks = patchAnswer("free kicks", notes, NOW.getTime());
ok(kicks.text.startsWith("2 patch notes mention \"free kicks\":") && kicks.text.includes("v0.135") && kicks.text.includes("v0.136"), "a search word: the notes that mention it");
const nothing = patchAnswer("unicorns", notes, NOW.getTime());
ok(nothing.text.startsWith("No patch note mentions \"unicorns\".") && nothing.text.includes("@Patch bot latest") && nothing.text.includes("@Patch bot 0.137"), "nothing found: says so, with two examples of what to ask");
ok(patchAnswer("", notes, NOW.getTime()).text.includes("@Patch bot latest"), "no words at all: what you can ask, never silence");
ok(since.text.length <= 2000 && last3.text.length <= 2000, "an answer fits in one post");

console.log("Bug bot, Today bot, Jobs bot");
const bugRows: BotRow[] = [
  { id: 481, bot: "bug", channel: "bugs", title: "Keeper froze mid dive", body: "x", url: "/star-dev", everyone: false, created_at: at(12, 9).toISOString(), meta: {} },
  { id: 482, bot: "bug", channel: "bugs", title: "Shop button is off the screen", body: "x", url: "/star-dev", everyone: false, created_at: at(13, 9).toISOString(), meta: {} },
];
const reports = bugReports(bugRows, [{ post_id: 481, handed_to: "Leo", fixed_by: "Leo", fixed_at: at(12, 18).toISOString(), updated_by: "Leo", updated_at: at(12, 18).toISOString() }]);
ok(bugAnswer("open", reports).text.startsWith("1 open report:") && bugAnswer("open", reports).text.includes("#482 Shop button") && bugAnswer("open", reports).links?.[0].url === "/admin/team?tab=chat&ch=bugs", "@Bug bot open: the reports nobody has fixed, with a link");
ok(bugAnswer("fixed", reports).text.includes("#481 Keeper froze mid dive") && bugAnswer("fixed", reports).text.includes("fixed by Leo") && bugAnswer("fixed", reports).links?.[0].url.endsWith("tb=fixed"), "@Bug bot fixed: the fixed ones, and who fixed them");
ok(bugAnswer("latest", reports).text.startsWith("The newest of 2 reports (1 open):") && bugAnswer("latest", reports).text.indexOf("#482") < bugAnswer("latest", reports).text.indexOf("#481"), "@Bug bot latest: newest first");
ok(bugAnswer("banana", reports).text.includes("@Bug bot open") && bugAnswer("banana", reports).text.includes("@Bug bot latest"), "@Bug bot with words it doesn't know: what you can ask, two examples");
const todayMsgs = [msg(1, "Mikey", checkInBody("filming the goal replays"), at(13, 8)), msg(2, "Leo", checkInBody("keeper dive timing"), at(13, 8, 30)), msg(3, "Harry", "[#today] @Today bot who is in", at(13, 9))];
const who = todayAnswer("who is in", todayMsgs, NOW.getTime());
ok(who.text.includes("Checked in today (2 of 3):") && who.text.includes("Mikey: filming the goal replays") && who.text.includes("Not yet: Harry."), "@Today bot: who has and who has not checked in today");
ok(!checkInsFor(todayMsgs, "2026-11-13").Harry, "…and asking the Today bot in #today is not itself a check-in");
ok(todayAnswer("", [], NOW.getTime()).text.includes("Nobody has checked in today yet.") && todayAnswer("pizza", [], NOW.getTime()).text.includes("@Today bot who is in"), "nobody in yet: says so; unknown words: what you can ask");
const jobs: TeamJob[] = [{ id: "lag", title: "Lag test on your phone", owner: "all", from: "Harry", added: at(10).toISOString(), prompt: null }];
const tasks: TeamTask[] = [
  { id: 1, owner: "Leo", made_by: "Harry", title: "Fix the cup draw screen", done_at: null, created_at: at(12).toISOString() },
  { id: 2, owner: "Harry", made_by: "Harry", title: "Film the new look", done_at: null, created_at: at(12).toISOString() },
  { id: 3, owner: "Harry", made_by: "Harry", title: "Old one", done_at: at(12).toISOString(), created_at: at(11).toISOString() },
];
const mine = jobsAnswer("mine", "Harry", jobs, tasks, NOW.getTime());
ok(mine.text.startsWith("You have 2 open jobs:") && mine.text.includes("Lag test on your phone (pushed by Harry)") && mine.text.includes("Film the new look") && !mine.text.includes("Old one"), "@Jobs bot mine: the asker's open jobs, pushed and typed, never a ticked one");
ok(jobsAnswer("Leo", "Harry", jobs, tasks, NOW.getTime()).text.startsWith("Leo has 2 open jobs:") && jobsAnswer("Leo", "Harry", jobs, tasks, NOW.getTime()).text.includes("Fix the cup draw screen (from Harry)"), "@Jobs bot Leo: a named person's jobs");
ok(jobsAnswer("mine", "Mikey", [], tasks, NOW.getTime()).text === "You have no open jobs." && jobsAnswer("weather", "Mikey", [], tasks, NOW.getTime()).text.includes("@Jobs bot mine"), "no jobs: says so; unknown words: what you can ask");
ok(helpLine("health").includes("@Health bot limits"), "every bot has its one line of what you can ask");

console.log("Which messages get an answer");
const fresh = msg(10, "Harry", "@Patch bot latest");
ok(asksOwed({ messages: [fresh], rows: [], now: NOW.getTime() }).length === 1, "a fresh @bot message is owed an answer");
ok(asksOwed({ messages: [msg(11, "Harry", "@Patch bot latest", new Date(NOW.getTime() - 11 * 60_000))], rows: [], now: NOW.getTime() }).length === 0, "a message older than 10 minutes is never answered");
const answered = { ...replyRow("patch-notes", fresh, { text: "hi" }), id: 900, created_at: NOW.toISOString() } as BotRow;
ok(asksOwed({ messages: [fresh], rows: [answered], now: NOW.getTime() }).length === 0, "a message a bot has already answered is not answered again");
ok(isReplyRow(answered) && answered.meta!.reply_to === 10 && answered.meta!.by === "Harry" && answered.channel === "general", "the answer hangs under the asking message, as that bot, in the same channel");
const inThread = replyRow("claude", msg(12, "Leo", "[#ideas] [re:7] @Claude sum up this thread"), { text: "x" });
ok(inThread.channel === "ideas" && inThread.meta.reply_to === 7 && inThread.meta.ask === 12, "asked inside a thread: the answer joins that thread, not a new one");
ok(duplicateReplies([answered, { ...answered, id: 901 }, { ...answered, id: 902, bot: "claude" }]).join() === "901", "two answers from one bot to one message: the later one is the double");
ok(repliesUnder([answered], 10).length === 1 && repliesUnder([answered], 11).length === 0, "the room finds a message's answers by its number");

/* ── THE RUN: the server code against a pretend database and a pretend AI ── */

type Row = Record<string, unknown>;
let clock = NOW.getTime();
function pretendDb(tables: Record<string, Row[]>) {
  let nextId = 1000;
  const writes: string[] = [];
  class Q implements PromiseLike<{ data: Row[] | Row | null; error: { message: string } | null }> {
    private filters: ((r: Row) => boolean)[] = [];
    private sort: { col: string; asc: boolean } | null = null;
    private max = 1000;
    private mode: "select" | "insert" | "delete" | "update" = "select";
    private payload: Row | null = null;
    private one = false;
    constructor(private table: string) {}
    select() { return this; }
    insert(row: Row) { this.mode = "insert"; this.payload = row; return this; }
    update(row: Row) { this.mode = "update"; this.payload = row; return this; }
    delete() { this.mode = "delete"; return this; }
    eq(c: string, v: unknown) { this.filters.push((r) => r[c] === v); return this; }
    lt(c: string, v: number) { this.filters.push((r) => (r[c] as number) < v); return this; }
    gte(c: string, v: string) { this.filters.push((r) => String(r[c]) >= v); return this; }
    like(c: string, v: string) { const pre = v.replace(/%$/, ""); this.filters.push((r) => String(r[c]).startsWith(pre)); return this; }
    in(c: string, v: unknown[]) { this.filters.push((r) => v.includes(r[c])); return this; }
    order(col: string, o: { ascending: boolean }) { this.sort = { col, asc: o.ascending }; return this; }
    limit(n: number) { this.max = n; return this; }
    single() { this.one = true; return this; }
    maybeSingle() { this.one = true; return this; }
    private run() {
      const t = (tables[this.table] ??= []);
      if (this.mode === "insert") {
        const row = { id: nextId++, created_at: new Date(clock).toISOString(), ...this.payload } as Row;
        t.push(row); writes.push(`insert ${this.table}`);
        return { data: this.one ? row : [row], error: null };
      }
      const hit = t.filter((r) => this.filters.every((f) => f(r)));
      if (this.mode === "delete") { tables[this.table] = t.filter((r) => !hit.includes(r)); if (hit.length) writes.push(`delete ${this.table}`); return { data: null, error: null }; }
      if (this.mode === "update") { hit.forEach((r) => Object.assign(r, this.payload)); writes.push(`update ${this.table}`); return { data: null, error: null }; }
      const s = this.sort;
      const sorted = s ? [...hit].sort((a, b) => ((a[s.col] as number) < (b[s.col] as number) ? -1 : (a[s.col] as number) > (b[s.col] as number) ? 1 : 0) * (s.asc ? 1 : -1)) : hit;
      const out = sorted.slice(0, this.max);
      return { data: this.one ? out[0] ?? null : out, error: null };
    }
    then<A, B>(res?: ((v: { data: Row[] | Row | null; error: { message: string } | null }) => A | PromiseLike<A>) | null, rej?: ((e: unknown) => B | PromiseLike<B>) | null) { return Promise.resolve(this.run()).then(res, rej); }
  }
  return { sb: { from: (table: string) => new Q(table) } as unknown as SupabaseClient, tables, writes };
}

const brain: BrainNote[] = [
  { id: "RUL-TEAM-003", summary: "Progress updates every 5 minutes on every task, with % and time left on every bar.", tags: "process,team", body: "" },
  { id: "RUL-TEAM-021", summary: "Patch notes only when Mikey says create patch notes; never offered after a push.", tags: "team,patch", body: "Applies in every chat Mikey works in." },
  { id: "FACT-3D-002", summary: "A script packs the 3D model files small.", tags: "three-d", body: "" },
];
let aiCalls: AiRequest[] = [];
let aiSays = "Mikey gets patch notes only when he says \"create patch notes\" (RUL-TEAM-021).";
const pretendAi: AiCall = async (req) => { aiCalls.push(req); return { text: aiSays, inputTokens: 2000, outputTokens: 300, stop: "end_turn" }; };
let keySet = true;
const deps: AtDeps = { ai: () => ({ call: keySet ? pretendAi : null, own: false }), notes, brain, jobs: async () => jobs, limits: async () => ({ title: "Limits · 2026-11-13 · All green", body: "🟢 Database: 371 MB of 500 MB (74%)", level: "green", lines: [{ what: "Database", level: "green" }] }), origin: "https://knowitball.co.uk" };

console.log("THE RUN: each bot answers once, in a thread");
const db = pretendDb({
  team_messages: [
    msg(1, "Mikey", checkInBody("filming the goal replays"), at(13, 8)), msg(2, "Leo", checkInBody("keeper dive timing"), at(13, 8, 30)),
    msg(20, "Harry", "@Patch bot latest"), msg(21, "Harry", "[#bugs] @Bug bot open"), msg(22, "Leo", "[#today] @Today bot who is in"),
    msg(23, "Mikey", "[#todo] @Jobs bot mine"), msg(24, "Harry", "[#health] @Health bot limits"), msg(25, "Leo", "@Bug bot sing me a song"),
    msg(26, "Harry", "@Patch bot latest", new Date(NOW.getTime() - 30 * 60_000)),
  ] as unknown as Row[],
  team_bot_posts: [...bugRows, { id: 490, bot: "today", channel: "today", title: "What are you on today?", body: "@Harry one line is enough. @Patch bot latest", url: null, everyone: false, created_at: new Date(NOW.getTime() - 60_000).toISOString(), meta: { kind: "ask" } }] as unknown as Row[],
  team_tasks: tasks as unknown as Row[], team_bug_marks: [],
});
const posts = () => db.tables.team_bot_posts as unknown as BotRow[];
const replies = (bot?: string) => posts().filter((r) => isReplyRow(r) && (!bot || r.bot === bot));
const r1 = await answerOwed(db.sb, deps, { now: NOW });
ok(r1.ok && r1.answered === 6 && replies().length === 6, "first run: six answers for six fresh @bot messages");
const pr = replies("patch-notes")[0];
ok(pr.meta!.reply_to === 20 && pr.channel === "general" && pr.body.includes("v0.137 · Harry") && replyLinks(pr)[0].label === "Open v0.137", "Patch bot answered in a thread under Harry's message, with the note and its link");
ok(replies("bug").some((r) => r.channel === "bugs" && r.body.startsWith("2 open reports:")) && replies("today")[0].body.includes("Not yet: Harry.") && replies("jobs")[0].body.startsWith("You have 1 open job:"), "Bug, Today and Jobs bots each answered from the real rows, in the channel they were asked in");
ok(replies("health")[0].body.includes("Database: 371 MB") && Array.isArray(replies("health")[0].meta!.lines), "Health bot answered with the limits read this minute (the same reading as its Run now)");
ok(replies("bug").some((r) => r.meta!.ask === 25 && r.body.includes("@Bug bot open")), "a bot with words it doesn't understand still answers: one line of what you can ask");
ok(!replies().some((r) => r.meta!.ask === 26), "the 30-minute-old message got no answer");
ok(!replies().some((r) => r.meta!.ask === 490) && replies().length === 6, "the Today bot's own post says \"@Patch bot latest\": no bot answered it (a bot never answers a bot)");
const r2 = await answerOwed(db.sb, deps, { now: NOW });
ok(r2.answered === 0 && replies().length === 6, "second run: nothing new (asked twice, answered once)");
(db.tables.team_messages as Row[]).push(msg(30, "Leo", "@Patch bot 0.136") as unknown as Row);
const both = await Promise.all([answerOwed(db.sb, deps, { now: NOW, only: 30 }), answerOwed(db.sb, deps, { now: NOW }), answerOwed(db.sb, deps, { now: NOW, only: 30 })]);
ok(replies().filter((r) => r.meta!.ask === 30).length === 1 && both.every((b) => b.ok), "three triggers at the same moment (two browsers and the timer): still one answer");
ok((await answerOwed(db.sb, deps, { now: NOW, only: 26 })).answered === 0, "asked directly for the old message: still no answer");

console.log("Claude: off without a key");
keySet = false; aiCalls = [];
(db.tables.team_messages as Row[]).push(msg(40, "Harry", "@Claude what is the rule on patch notes for Mikey?") as unknown as Row);
await answerOwed(db.sb, deps, { now: NOW, only: 40 });
const offReply = replies("claude").find((r) => r.meta!.ask === 40)!;
ok(offReply.body.startsWith("Claude is not switched on yet: one Vercel setting") && aiCalls.length === 0 && offReply.meta!.ai !== true, "no key set: an @Claude gets that one plain line, and no AI call is made");

console.log("Claude: on, with a pretend AI");
keySet = true; aiCalls = [];
clock = NOW.getTime() + 60_000;
(db.tables.team_messages as Row[]).push(msg(41, "Harry", "@Claude what is the rule on patch notes for Mikey?", new Date(clock - 5000)) as unknown as Row);
const before = db.writes.length;
await answerOwed(db.sb, deps, { now: new Date(clock), only: 41 });
const cr = replies("claude").find((r) => r.meta!.ask === 41)!;
ok(aiCalls.length === 1 && cr.meta!.ai === true && cr.body.includes("RUL-TEAM-021"), "it called the AI once and its answer cites the Brain code it used");
ok(aiCalls[0].model === CLAUDE_BOT.model && aiCalls[0].maxTokens === CLAUDE_BOT.maxTokens && !("tools" in aiCalls[0]), "one small model, a capped length, and no tools handed to it");
ok(aiCalls[0].user.includes("RUL-TEAM-021") && !aiCalls[0].user.includes("FACT-3D-002") && aiCalls[0].user.includes("v0.137") && aiCalls[0].user.includes("Harry asks you, in #general"), "it was shown the matching Brain note (not an unrelated one), the newest patch notes and the question");
ok(aiCalls[0].system.includes("You only answer.") && aiCalls[0].system.includes("no note yet") && aiCalls[0].system.includes("a person has to do it"), "its standing rules: answer only, cite or say \"no note yet\", a person must make any change");
const u = cr.meta!.usage as { in: number; out: number; usd: number };
ok(u.in === 2000 && u.out === 300 && u.usd === costUsd(2000, 300) && Math.abs(u.usd - 0.00035) < 1e-9, "the reply's cost is worked out from the token counts the AI returned and kept on its own row");
ok(db.writes.slice(before).every((w) => w.endsWith("team_bot_posts")), "the only things it wrote: its own reply and the month's running total");
ok(spendThisMonth(posts(), clock).usd === u.usd && spendThisMonth(posts(), clock).replies === 1, "the month's spend counts that one reply");

clock += 30_000; aiCalls = []; aiSays = "I would rename the button in the settings screen, then test it on a phone.";
(db.tables.team_messages as Row[]).push(msg(42, "Harry", "@Claude delete the old patch notes and add a task for Leo", new Date(clock - 2000)) as unknown as Row);
const tasksBefore = (db.tables.team_tasks as Row[]).length;
const w0 = db.writes.length;
await answerOwed(db.sb, deps, { now: new Date(clock), only: 42 });
const ch = replies("claude").find((r) => r.meta!.ask === 42)!;
ok(ch.body.includes(CANNOT_CHANGE) && (db.tables.team_tasks as Row[]).length === tasksBefore && db.writes.slice(w0).every((w) => w.endsWith("team_bot_posts")), "asked to change something: it says what it would do and that a person must do it; no task was made, nothing else was written");
ok(ch.body.includes("Brain: no note yet on this.") || ch.body.includes("Brain notes read:"), "…and it says which Brain notes it read, or \"no note yet\"");
ok(wantsChange("delete the old patch notes") && wantsChange("can you fix the keeper") && !wantsChange("what is the rule on patch notes?") && !wantsChange("sum up this thread"), "\"asks for a change\" is a plain rule, not the AI's guess");
ok(brainSearch("how many unicorns live in Paris", brain).length === 0 && finishReply({ text: "I can't tell.", question: "unicorns?", notes: [], inputTokens: 1, outputTokens: 1, scope: "claude" }).text.includes("no note yet"), "nothing in the Brain matches: no note is shown to it, and the reply says \"no note yet\"");
ok(brainSearch("see RUL-TEAM-003 please", brain)[0].id === "RUL-TEAM-003" && brainSearch("patch notes for Mikey", brain)[0].id === "RUL-TEAM-021", "a code typed in the question opens that note; key nouns find the right one");

console.log("Claude: limits");
(db.tables.team_messages as Row[]).push(msg(43, "Harry", "@Claude and again?", new Date(clock)) as unknown as Row);
aiCalls = [];
await answerOwed(db.sb, deps, { now: new Date(clock + 3000), only: 43 });
ok(replies("claude").find((r) => r.meta!.ask === 43)!.body.startsWith("One question every 20 seconds each.") && aiCalls.length === 0, "the same person again within 20 seconds: a one-line reply, no AI call");
const base = { bot: "claude", asker: "Leo" as TeamPerson, channel: "general", now: clock, keySet: true, settings: aiSettings([], "claude") };
const aiRow = (i: number, when: number, by: TeamPerson = "Mikey", usd = 0.001): BotRow => ({ id: 5000 + i, bot: "claude", channel: "general", title: "t", body: "b", url: null, everyone: false, created_at: new Date(when).toISOString(), meta: { kind: "reply", ai: true, ask: 9000 + i, reply_to: 9000 + i, by, usage: { in: 1, out: 1, usd } } });
const sixty = Array.from({ length: 60 }, (_, i) => aiRow(i, clock - 3600_000 - i * 1000));
const g60 = claudeGate({ ...base, rows: sixty });
ok(!g60.ok && g60.note === "day" && claudeGate({ ...base, rows: sixty.slice(1) }).ok, "60 AI answers in a day for the whole team: the 61st is refused; 59 is fine");
const capped = claudeGate({ ...base, rows: [aiRow(1, clock - 86400_000, "Mikey", 20)] });
ok(!capped.ok && capped.note === "cap" && capped.text.startsWith("I've hit this month's limit (£20.00 of £20.00 this month)."), "at £20 for the month: \"I've hit this month's limit\"");
ok(claudeGate({ ...base, rows: [aiRow(1, at(1, 0).getTime() - 3 * 86400_000, "Mikey", 20)] }).ok, "last month's spend does not count: a new calendar month starts at £0");
const tallyOnly = [{ ...tallyRow("claude", { ...spendThisMonth([], clock), usd: 19.999, replies: 9000 }), id: 1, created_at: new Date(clock).toISOString() } as BotRow];
ok(!claudeGate({ ...base, rows: tallyOnly }).ok && spendThisMonth(tallyOnly, clock).replies === 9000, "the running total alone (old reply rows gone from the table) still stops it");
ok(spendThisMonth([aiRow(1, clock, "Mikey", NaN)], clock).usd === CLAUDE_BOT.worstCaseUsd, "a reply with no recorded cost is counted at the worst-case price");
(db.tables.team_bot_posts as Row[]).push({ ...tallyRow("claude", { ...spendThisMonth([], clock), usd: 20, replies: 500 }), id: 7000, created_at: new Date(clock).toISOString() } as unknown as Row);
clock += 60_000; aiCalls = [];
(db.tables.team_messages as Row[]).push(msg(44, "Mikey", "@Claude one more?", new Date(clock - 1000)) as unknown as Row);
await answerOwed(db.sb, deps, { now: new Date(clock), only: 44 });
ok(replies("claude").find((r) => r.meta!.ask === 44)!.body.startsWith("I've hit this month's limit") && aiCalls.length === 0, "THE RUN at the cap: it replies \"I've hit this month's limit\" and makes no AI call");
db.tables.team_bot_posts = (db.tables.team_bot_posts as Row[]).filter((r) => r.id !== 7000 && r.bot !== "claude-tally");
const offSave = await saveAiSettings(db.sb, "claude", "Leo", { enabled: false });
clock += 60_000;
(db.tables.team_messages as Row[]).push(msg(45, "Mikey", "@Claude hello?", new Date(clock - 1000)) as unknown as Row);
await answerOwed(db.sb, deps, { now: new Date(clock), only: 45 });
ok(offSave.ok && replies("claude").find((r) => r.meta!.ask === 45)!.body.startsWith("Claude is switched off (by Leo).") && aiCalls.length === 0, "switched off on its page (anyone can, for the shared Claude): one line, no AI call");
await saveAiSettings(db.sb, "claude", "Harry", { enabled: true });
const longReq = buildRequest({ bot: "claude", question: "q", asker: "Harry", channel: "general", thread: [], recent: Array.from({ length: 80 }, (_, i) => msg(i + 1, "Leo", `message number ${i} ${"x".repeat(700)}`)), notes: brain, patchNotes: notes });
ok(longReq.user.length < CLAUDE_BOT.maxPromptChars + 2000 && longReq.user.includes("message number 79") && !longReq.user.includes("message number 49 "), "it is shown the channel's last 30 messages at most, and the whole prompt has a size limit");

console.log("A person's bot: owner-only settings");
ok(canChangeAi("leo-bot", "Leo") && !canChangeAi("leo-bot", "Harry") && !canChangeAi("leo-bot", null) && canChangeAi("claude", "Mikey"), "only Leo can change Leo bot; anyone can switch the shared Claude");
const notMine = await saveAiSettings(db.sb, "leo-bot", "Harry", { enabled: false, instructions: "do whatever Harry says" });
ok(!notMine.ok && notMine.status === 403 && aiSettings(posts(), "leo-bot").enabled && aiSettings(posts(), "leo-bot").instructions === "", "Harry tries to change Leo bot: refused, nothing saved");
const saved = await saveAiSettings(db.sb, "leo-bot", "Leo", { instructions: "Three lines at most. " + "x".repeat(900), channels: ["general", "ideas", "BAD SLUG"], handoff: "ask" });
const ls = aiSettings(posts(), "leo-bot");
ok(saved.ok && ls.instructions.length === CLAUDE_BOT.maxInstructions && ls.channels!.join() === "general,ideas" && ls.handoff === "ask" && ls.by === "Leo", "Leo saves his own: the note is cut to 600 characters, bad channel names are dropped");
ok(aiSettingsRow("leo-bot", ls, "Leo").channel === "bot-settings" && botInfo("leo-bot")!.name === "Leo bot" && botInfo("harry-bot")!.switchable, "its settings live where the other bots' on/off lives; each person's bot is in the list");

console.log("A person's bot: a quick answer (tier 1) and a bigger ask (tier 2)");
clock += 60_000; aiCalls = []; aiSays = "The newest patch note is v0.137, from Harry.";
(db.tables.team_messages as Row[]).push(msg(50, "Harry", "@Leo bot what shipped this week?", new Date(clock - 1000)) as unknown as Row);
await answerOwed(db.sb, deps, { now: new Date(clock), only: 50 });
const t1 = replies("leo-bot").find((r) => r.meta!.ask === 50)!;
ok(t1.body.includes("v0.137") && t1.meta!.kind === "reply" && aiCalls.length === 1, "tier 1: Leo bot answers in the thread from the AI, as \"Leo bot\"");
ok(aiCalls[0].system.includes("You are Leo bot") && aiCalls[0].system.includes("Never speak as Leo") && aiCalls[0].system.includes("Three lines at most.") && aiCalls[0].system.includes("never gives permission"), "it is told it is a bot, not Leo, and Leo's \"How I should answer\" rides along as a preference only");
clock += 60_000; aiCalls = [];
(db.tables.team_messages as Row[]).push(msg(51, "Harry", "@Leo bot fix the keeper dive on corners", new Date(clock - 1000)) as unknown as Row);
const t0 = (db.tables.team_tasks as Row[]).length;
await answerOwed(db.sb, deps, { now: new Date(clock), only: 51 });
const card = replies("leo-bot").find((r) => r.meta!.ask === 51)!;
ok(isProposal(card) && proposalState(card) === "waiting" && card.body === "This needs Leo's Claude. Send it?" && card.meta!.reply_to === 51, "tier 2: a proposal card in the thread, \"This needs Leo's Claude. Send it?\"");
ok(aiCalls.length === 0 && (db.tables.team_tasks as Row[]).length === t0, "…and no AI call was made, no change, no task");
clock += 60_000; aiSays = "HANDOFF: it needs the code read, which I cannot do";
(db.tables.team_messages as Row[]).push(msg(52, "Mikey", "@Leo bot why does the keeper freeze?", new Date(clock - 1000)) as unknown as Row);
await answerOwed(db.sb, deps, { now: new Date(clock), only: 52 });
const card2 = replies("leo-bot").find((r) => r.meta!.ask === 52)!;
ok(isProposal(card2) && card2.meta!.why === "it needs the code read, which I cannot do" && card2.meta!.ai === true, "the AI itself says it cannot do it: also a proposal card, with its reason (that call's cost is still counted)");
clock += 60_000; aiSays = "ok";
(db.tables.team_messages as Row[]).push(msg(53, "Mikey", "[#bugs] @Leo bot are you there?", new Date(clock - 1000)) as unknown as Row);
await answerOwed(db.sb, deps, { now: new Date(clock), only: 53 });
ok(replies("leo-bot").find((r) => r.meta!.ask === 53)!.body.startsWith("Leo bot does not answer in #bugs."), "asked in a channel Leo did not allow: one line saying so");

console.log("Accept and Decline: only the owner");
const notOwner = await answerProposal(db.sb, card.id, "Harry", true, "https://knowitball.co.uk");
ok(!notOwner.ok && notOwner.status === 403 && proposalState(posts().find((r) => r.id === card.id)!) === "waiting" && (db.tables.team_tasks as Row[]).length === t0, "Harry presses Accept on Leo bot's card: refused, still waiting, no job");
const acc = await answerProposal(db.sb, card.id, "Leo", true, "https://knowitball.co.uk");
const made = (db.tables.team_tasks as Row[]).filter((t) => handoffTaskFor(String(t.title)) === card.id);
ok(acc.ok && acc.state === "accepted" && made.length === 1 && made[0].owner === "Leo" && made[0].made_by === "Leo" && String(made[0].title).startsWith("🤖 For my Claude: fix the keeper dive on corners"), "Leo presses Accept: exactly one job, in Leo's own to-do, made in Leo's name by Leo's press");
const accRow = posts().find((r) => r.id === card.id)!;
ok(String(accRow.meta!.prompt).includes("Harry asked in #general: fix the keeper dive on corners") && String(accRow.meta!.prompt).includes("https://knowitball.co.uk/admin/team?tab=chat&m=51&t=51") && String(accRow.meta!.prompt).includes("wait for my yes before changing anything"), "the card keeps the text for Leo's Claude: who asked what, the thread and its link, and \"wait for my yes\"");
await answerProposal(db.sb, card.id, "Leo", true);
ok((db.tables.team_tasks as Row[]).filter((t) => handoffTaskFor(String(t.title)) === card.id).length === 1, "Accept pressed twice: still one job");
const dec = await answerProposal(db.sb, card2.id, "Leo", false);
ok(dec.ok && dec.state === "declined" && (db.tables.team_tasks as Row[]).filter((t) => handoffTaskFor(String(t.title)) === card2.id).length === 0, "Decline: no job at all");
ok((await answerProposal(db.sb, card2.id, "Leo", true)).ok && (db.tables.team_tasks as Row[]).filter((t) => handoffTaskFor(String(t.title)) === card2.id).length === 0, "Accept after Decline does nothing: the card is closed");

console.log("The pipe to and from the owner's own Claude chat");
ok((await claimHandoffs(db.sb, "Harry")).length === 0, "Harry's chat asks for jobs: none (the job is Leo's)");
const got = await claimHandoffs(db.sb, "Leo");
ok(got.length === 1 && got[0].id === card.id && got[0].prompt.includes("fix the keeper dive on corners") && got[0].token.length >= 16, "Leo's chat takes the job once, with its text and a one-time token");
ok((await claimHandoffs(db.sb, "Leo")).length === 0 && proposalState(posts().find((r) => r.id === card.id)!) === "picked", "a second chat of Leo's gets nothing: it is taken");
ok(!(await finishHandoff(db.sb, card.id, "wrong-token", "done")).ok, "a reply with the wrong token is refused");
const fin = await finishHandoff(db.sb, card.id, got[0].token, "Proposed: start the dive 4 frames earlier. Waiting for Leo's yes.");
const back = posts().find((r) => r.meta?.from_claude === "Leo");
ok(fin.ok && !!back && back.meta!.reply_to === 51 && back.title === "Leo's Claude replied" && proposalState(posts().find((r) => r.id === card.id)!) === "done", "Leo's Claude's reply lands in the same thread, marked as from Leo's Claude, and the card says done");
ok(!(await finishHandoff(db.sb, card.id, got[0].token, "again")).ok, "it can reply once only");

console.log("A person's bot: off switch");
await saveAiSettings(db.sb, "leo-bot", "Leo", { enabled: false });
clock += 60_000; aiCalls = [];
(db.tables.team_messages as Row[]).push(msg(54, "Harry", "@Leo bot fix the shop button", new Date(clock - 1000)) as unknown as Row);
await answerOwed(db.sb, deps, { now: new Date(clock), only: 54 });
const offR = replies("leo-bot").find((r) => r.meta!.ask === 54)!;
ok(offR.body.startsWith("Leo bot is switched off (by Leo).") && !isProposal(offR) && aiCalls.length === 0, "Leo switched his bot off: one line, no card, no AI call");
ok(duplicateReplies(posts()).length === 0 && replies().every((r) => r.body.length <= 2000 && r.title.length >= 1 && r.title.length <= 200), "after the whole run: no double answers, and every row fits the table's limits");
ok(parseMessage("@Leo bot fix it").mentions.length === 0, "none of this ever counted as an @ of a person");

console.log(failed ? `\n${failed} FAILED` : "\nAll @bot checks passed");
process.exit(failed ? 1 : 0);
