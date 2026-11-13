/**
 * lib/teamRoom/atBots.ts — bots you can @ (Harry, 13 Nov 2026: "can't @ any
 * bots like I should be able to @patch notes bot in general and ask for x
 * patch notes").
 *
 * Type "@Patch bot latest" in any channel. The bot answers in a THREAD under
 * your message, as itself, within a few seconds. The answer is worked out from
 * real data by plain rules: no AI here (the AI bots are in claudeBot.ts).
 *
 * Pure sums, tested in tests/star/teamRoomAtBots.mts. No React, no database.
 * The hands (reading the data, writing the row) are in atBotsServer.ts.
 *
 * A reply is a row in team_bot_posts (only the site's own key can write one):
 *   meta.kind = "reply", meta.reply_to = the message its thread hangs under,
 *   meta.ask = the message that asked (one reply per bot per ask, ever),
 *   meta.by = who asked.
 * A bot's row is never read as a question, so a bot never answers a bot.
 */
import { TEAM_PEOPLE, TEAM_ROOM, type TeamPerson } from "./config";
import { AT_BOTS, botMentionsIn, parseMessage, withoutBotMentions, type AtBotId } from "./extras";
import type { BotRow } from "./channels";
import type { TeamMessage, TeamTask } from "./logic";
import type { NewBotRow } from "./patchBot";
import { isOpen, type BugReport } from "./bugs";
import { checkInsFor, ukDay } from "./today";
import { pushedFor, type TeamJob } from "./jobs";
import { tasksFor } from "./logic";

export const AT_BOT = {
  /** A message older than this is never answered. */
  maxAgeMs: 10 * 60_000,
  /** At most this many patch notes, reports or jobs in one answer. */
  maxItems: 5,
  /** The table's own limit for a post's words. */
  maxBody: 2000,
} as const;

/* ── Reply rows ──────────────────────────────────────────────────────── */

const metaOf = (r: Pick<BotRow, "meta">) => (r.meta && typeof r.meta === "object" ? r.meta : {}) as Record<string, unknown>;
/** A reply in a thread (or a proposal card there): never a post in the channel itself. */
export const isReplyRow = (r: Pick<BotRow, "meta">) => { const k = metaOf(r).kind; return k === "reply" || k === "proposal"; };
export const replyParent = (r: Pick<BotRow, "meta">): number | null => { const n = Number(metaOf(r).reply_to); return Number.isSafeInteger(n) && n > 0 ? n : null; };
export const replyAsk = (r: Pick<BotRow, "meta">): number | null => { const n = Number(metaOf(r).ask); return Number.isSafeInteger(n) && n > 0 ? n : null; };
export const replyPatch = (r: Pick<BotRow, "meta">): string | null => { const v = metaOf(r).patch; return typeof v === "string" && v ? v : null; };
export const replyBy = (r: Pick<BotRow, "meta">): TeamPerson | null => { const p = metaOf(r).by; return (TEAM_PEOPLE as readonly unknown[]).includes(p) ? (p as TeamPerson) : null; };

export interface ReplyLink { label: string; url: string }
export const replyLinks = (r: Pick<BotRow, "meta">): ReplyLink[] => {
  const l = metaOf(r).links;
  return Array.isArray(l) ? l.filter((x): x is ReplyLink => !!x && typeof x.label === "string" && typeof x.url === "string" && x.url.startsWith("/")).slice(0, 6) : [];
};
/** The whole answer: the row's words, or the longer copy kept beside it. */
export const replyText = (r: Pick<BotRow, "meta" | "body">) => { const f = metaOf(r).full; return typeof f === "string" && f ? f : r.body; };

/** Replies under one message (or in one patch note's thread), oldest first. */
export const repliesUnder = (rows: readonly BotRow[], parentId: number) => rows.filter((r) => isReplyRow(r) && !replyPatch(r) && replyParent(r) === parentId).sort((a, b) => a.id - b.id);
export const repliesInPatch = (rows: readonly BotRow[], version: string) => rows.filter((r) => isReplyRow(r) && replyPatch(r) === version).sort((a, b) => a.id - b.id);

/** Has this bot already answered this message? (One answer per bot per ask, however many times it is triggered.) */
export const alreadyAnswered = (rows: readonly BotRow[], bot: string, askId: number) => rows.some((r) => r.bot === bot && isReplyRow(r) && replyAsk(r) === askId);

/** Two triggers landing in the same second can both write: the ids to delete, keeping the oldest answer of each bot to each ask. */
export function duplicateReplies(rows: readonly BotRow[]): number[] {
  const seen = new Set<string>();
  const out: number[] = [];
  for (const r of [...rows].sort((a, b) => a.id - b.id)) {
    const ask = replyAsk(r);
    if (!isReplyRow(r) || !ask) continue;
    const key = `${r.bot}|${ask}`;
    if (seen.has(key)) out.push(r.id); else seen.add(key);
  }
  return out;
}

export interface BotAnswer {
  text: string;
  links?: ReplyLink[];
  /** Extra facts kept beside the row (the Health bot's coloured lines, an AI reply's cost). */
  meta?: Record<string, unknown>;
}

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : s);

/** The row a bot's answer is saved as. */
export function replyRow(bot: string, m: Pick<TeamMessage, "id" | "person" | "body">, a: BotAnswer): NewBotRow {
  const p = parseMessage(m.body);
  const ask = withoutBotMentions(p.text);
  const text = a.text.trim() || "…";
  return {
    bot, channel: p.channel ?? "general",
    title: clip(`Answered ${m.person}: ${ask || "(no words)"}`, 200),
    body: clip(text, AT_BOT.maxBody), url: null, everyone: false,
    meta: {
      kind: "reply", reply_to: p.replyTo ?? m.id, ask: m.id, by: m.person,
      ...(p.patch ? { patch: p.patch } : {}),
      ...(a.links?.length ? { links: a.links.slice(0, 6) } : {}),
      ...(text.length > AT_BOT.maxBody ? { full: text.slice(0, 6000) } : {}),
      ...(a.meta ?? {}),
    },
  };
}

/* ── Which messages get an answer ────────────────────────────────────── */

export interface AskFor { bot: AtBotId; message: TeamMessage; words: string }

/**
 * The answers still owed: every @bot in a message from a person, not older
 * than 10 minutes, that this bot has not answered yet. `messages` are people's
 * messages only (bots write to another table), so a bot never answers a bot.
 */
export function asksOwed(input: { messages: readonly TeamMessage[]; rows: readonly BotRow[]; now: number }): AskFor[] {
  const out: AskFor[] = [];
  for (const m of [...input.messages].sort((a, b) => a.id - b.id)) {
    if (!(TEAM_PEOPLE as readonly string[]).includes(m.person)) continue;
    const age = input.now - (Date.parse(m.created_at) || 0);
    if (age > AT_BOT.maxAgeMs || age < -60_000) continue;
    const text = parseMessage(m.body).text;
    for (const bot of botMentionsIn(text)) {
      if (!alreadyAnswered(input.rows, bot, m.id)) out.push({ bot, message: m, words: withoutBotMentions(text) });
    }
  }
  return out;
}

/* ── "Ask me": what each bot understands ─────────────────────────────── */

export const botHandle = (bot: string) => `@${AT_BOTS.find((b) => b.bot === bot)?.name ?? bot}`;

/** The tappable examples on each bot's page; the first two are the ones its "I didn't follow" line gives. */
export const ASK_ME: Record<string, { say: string; gets: string }[]> = {
  "patch-notes": [
    { say: "latest", gets: "the newest patch note" },
    { say: "0.137", gets: "that version" },
    { say: "last 3", gets: "the three newest" },
    { say: "since Monday", gets: "every note from then on" },
    { say: "what did Leo ship", gets: "Leo's newest notes" },
    { say: "free kicks", gets: "notes with those words" },
  ],
  bug: [
    { say: "open", gets: "reports nobody has fixed yet" },
    { say: "latest", gets: "the newest reports" },
    { say: "fixed", gets: "reports marked fixed" },
  ],
  health: [
    { say: "limits", gets: "the database, storage and backup, read this minute" },
    { say: "how full is the database", gets: "the same four lines" },
  ],
  today: [
    { say: "who is in", gets: "who has and has not checked in today" },
    { say: "today", gets: "the same" },
  ],
  jobs: [
    { say: "mine", gets: "your open jobs" },
    { say: "Leo", gets: "Leo's open jobs" },
  ],
  claude: [
    { say: "what is the rule on patch notes for Mikey?", gets: "an answer from the Brain notes, with their codes" },
    { say: "sum up this thread", gets: "a short summary of the thread it is asked in" },
    { say: "what shipped this week?", gets: "an answer from the 5 newest patch notes" },
  ],
};

/** One short line: what you can ask, with two examples. Never silence. */
export function helpLine(bot: string, lead = "I didn't follow that."): string {
  const ex = ASK_ME[bot] ?? [];
  const h = botHandle(bot);
  return `${lead} You can ask me, for example: "${h} ${ex[0]?.say ?? "help"}" or "${h} ${ex[1]?.say ?? "help"}".`;
}

/* ── Patch bot ───────────────────────────────────────────────────────── */

export interface AskNote { version: string; title: string; author: string | null; publishedAt: string; summary?: string | null; lines?: string[] }

const dayText = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" });
const shortTitle = (t: string) => (t ?? "").replace(/^(Harry|Mikey|Leo)['’]s patch notes\s*(v[\d.]+\w*)?\s*[:—-]?\s*/i, "").trim() || "Patch notes";
const t = (iso: string) => Date.parse(iso) || 0;
export const patchNoteUrl = (version: string) => `${TEAM_ROOM.home}?tab=notes&v=${encodeURIComponent(version)}`;

/** A note's "what changed" lines: its own list, else its summary cut into sentences. 3 to 5 of them. */
export function noteLines(n: AskNote, max = 5): string[] {
  const own = (n.lines ?? []).map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
  const fromSummary = (n.summary ?? "").split(/(?<=[.!?])\s+/).map((l) => l.trim()).filter((l) => l.length > 8);
  const all = own.length >= 3 ? own : [...own, ...fromSummary.filter((s) => !own.includes(s))];
  // "@Mikey" inside a note's own words is not a mention here: the @ comes off.
  return all.slice(0, max).map((l) => clip(l.replace(/@(?=\w)/g, ""), 120));
}

function noteBlock(n: AskNote, lines: number): string {
  const head = `v${n.version} · ${n.author ?? "the team"} · ${dayText(n.publishedAt)}\n${shortTitle(n.title)}`;
  const body = noteLines(n, lines).map((l) => `• ${l}`).join("\n");
  return body ? `${head}\n${body}` : head;
}

const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** "since Monday", "since yesterday", "today", "this week", "since 10 Nov", "since 2026-11-10": the start (ms) and how to say it, or null. */
export function sinceWhen(words: string, now: number): { from: number; label: string } | null {
  const w = words.toLowerCase();
  const today = Date.parse(`${ukDay(now).day}T00:00:00Z`);
  const wd = ukDay(now).weekday;
  const day = DAYS.findIndex((d) => new RegExp(`\\b(?:since|from|after)\\s+(?:last\\s+)?${d}\\b`).test(w));
  if (day >= 0) { const back = (wd - day + 7) % 7 || 7; return { from: today - back * 86400_000, label: `since ${DAYS[day][0].toUpperCase()}${DAYS[day].slice(1)}` }; }
  if (/\b(?:since\s+)?yesterday\b/.test(w)) return { from: today - 86400_000, label: "since yesterday" };
  if (/\bthis week\b/.test(w)) return { from: today - ((wd + 6) % 7) * 86400_000, label: "this week" };
  if (/\blast week\b|\bpast week\b/.test(w)) return { from: today - 7 * 86400_000, label: "in the last 7 days" };
  if (/\btoday\b/.test(w)) return { from: today, label: "today" };
  const iso = /\b(?:since|from|after)\s+(\d{4}-\d{2}-\d{2})\b/.exec(w);
  if (iso && Date.parse(iso[1])) return { from: Date.parse(iso[1]), label: `since ${dayText(iso[1])}` };
  const dm = new RegExp(`\\b(?:since|from|after)\\s+(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTHS.join("|")})[a-z]*`).exec(w);
  if (dm) {
    const y = new Date(now).getUTCFullYear();
    let from = Date.UTC(y, MONTHS.indexOf(dm[2]), Number(dm[1]));
    if (from > now) from = Date.UTC(y - 1, MONTHS.indexOf(dm[2]), Number(dm[1]));
    return { from, label: `since ${dayText(new Date(from).toISOString())}` };
  }
  return null;
}

const STOP = new Set(["the", "a", "an", "of", "for", "about", "on", "in", "and", "to", "with", "any", "notes", "note", "patch", "show", "me", "find", "search", "please", "what", "did", "ship", "shipped", "is", "are", "was", "that", "it", "has", "have", "had", "been", "anything", "something", "changed", "change", "changes", "new", "do", "we", "you", "get", "give", "tell", "which", "when", "there"]);

/** The Patch bot's answer to "@Patch bot <words>". `notes` in any order. */
export function patchAnswer(words: string, notes: readonly AskNote[], now: number): BotAnswer {
  const all = [...notes].sort((a, b) => t(b.publishedAt) - t(a.publishedAt));
  const w = words.toLowerCase().trim();
  const newest3 = all.slice(0, 3).map((n) => `v${n.version}`).join(", ");
  const give = (list: AskNote[], lead: string, more = 0): BotAnswer => ({
    text: [lead, ...list.map((n) => noteBlock(n, list.length === 1 ? 5 : 3)), more > 0 ? `…and ${more} more. Ask for one by its number.` : ""].filter(Boolean).join("\n\n"),
    links: list.map((n) => ({ label: `Open v${n.version}`, url: patchNoteUrl(n.version) })),
  });
  if (!w || /^(help|\?+|what can (i|you) (ask|do).*)$/.test(w)) return { text: helpLine("patch-notes", "Ask me for patch notes.") };
  if (!all.length) return { text: "There are no patch notes on the site yet." };

  // A version number: "0.137", "v0.137", "0.61h".
  const ver = /(?:^|[^\w.])v?(\d+\.\d+[a-z]?)(?![\w.]*\d)/i.exec(words);
  if (ver) {
    const n = all.find((x) => x.version.toLowerCase() === ver[1].toLowerCase());
    return n ? give([n], "") : { text: `I can't find v${ver[1]}. The three newest are ${newest3}.`, links: all.slice(0, 3).map((x) => ({ label: `Open v${x.version}`, url: patchNoteUrl(x.version) })) };
  }

  const who = TEAM_PEOPLE.find((p) => new RegExp(`\\b${p}(?:'s)?\\b`, "i").test(words)) ?? null;
  const since = sinceWhen(words, now);
  const count = /\b(?:last|latest|newest|recent|past)\s+(\d{1,2})\b/.exec(w) ?? /\b(\d{1,2})\s+(?:latest|newest|most recent)\b/.exec(w);
  let pool = all;
  if (who) pool = pool.filter((n) => n.author === who);
  if (since) pool = pool.filter((n) => t(n.publishedAt) >= since.from);
  const whose = who ? `${who}'s` : "the";

  if (since) {
    if (!pool.length) return { text: `No patch notes${who ? ` from ${who}` : ""} ${since.label}. The newest is ${newest3.split(", ")[0]}.`, links: [{ label: `Open ${newest3.split(", ")[0]}`, url: patchNoteUrl(all[0].version) }] };
    return give(pool.slice(0, AT_BOT.maxItems), `${pool.length} patch note${pool.length === 1 ? "" : "s"}${who ? ` from ${who}` : ""} ${since.label}:`, pool.length - AT_BOT.maxItems);
  }
  if (count) {
    const n = Math.max(1, Math.min(AT_BOT.maxItems, Number(count[1])));
    if (!pool.length) return { text: `${who} has no patch notes on the site.` };
    return give(pool.slice(0, n), `${whose[0].toUpperCase()}${whose.slice(1)} ${Math.min(n, pool.length)} newest:`);
  }
  if (who) {
    if (!pool.length) return { text: `${who} has no patch notes on the site.` };
    return give(pool.slice(0, 3), `${who}'s ${Math.min(3, pool.length)} newest (of ${pool.length}):`);
  }
  if (/\b(latest|newest|last|recent|current)\b/.test(w)) return give([all[0]], "The newest patch note:");

  // Anything else is a search: every word must be in the note's title, summary or lines.
  const terms = w.replace(/[^\w\s.-]/g, " ").split(/\s+/).filter((x) => x.length > 1 && !STOP.has(x));
  if (!terms.length) return { text: helpLine("patch-notes") };
  const hay = (n: AskNote) => `${n.title} ${n.summary ?? ""} ${(n.lines ?? []).join(" ")}`.toLowerCase();
  const found = all.filter((n) => { const h = hay(n); return terms.every((x) => h.includes(x)); });
  if (!found.length) return { text: `No patch note mentions "${terms.join(" ")}". ${helpLine("patch-notes", "")}`.replace(/\s+/g, " ") };
  return give(found.slice(0, 3), `${found.length} patch note${found.length === 1 ? "" : "s"} mention${found.length === 1 ? "s" : ""} "${terms.join(" ")}"${found.length > 3 ? ", newest first" : ""}:`, found.length - 3);
}

/* ── Bug bot ─────────────────────────────────────────────────────────── */

const bugsUrl = (fixed: boolean) => `${TEAM_ROOM.home}?tab=chat&ch=bugs${fixed ? "&tb=fixed" : ""}`;

export function bugAnswer(words: string, reports: readonly BugReport[]): BotAnswer {
  const w = words.toLowerCase();
  const line = (b: BugReport) => `• #${b.number} ${clip(b.title, 80)} · ${dayText(b.at)}${b.mark?.fixed_at ? ` · fixed by ${b.mark.fixed_by ?? "someone"}` : b.mark?.handed_to ? ` · with ${b.mark.handed_to}` : ""}`;
  const list = (rows: BugReport[], lead: string, none: string, fixed: boolean): BotAnswer => rows.length
    ? { text: [lead, ...rows.slice(0, AT_BOT.maxItems).map(line), rows.length > AT_BOT.maxItems ? `…and ${rows.length - AT_BOT.maxItems} more in #bugs.` : ""].filter(Boolean).join("\n"), links: [{ label: fixed ? "Open Fixed" : "Open reports", url: bugsUrl(fixed) }] }
    : { text: none, links: [{ label: "Open #bugs", url: bugsUrl(false) }] };
  const open = reports.filter(isOpen);
  const done = reports.filter((b) => !isOpen(b));
  if (/\b(fixed|done|closed|solved)\b/.test(w)) return list(done, `${done.length} report${done.length === 1 ? "" : "s"} marked fixed:`, "No report is marked fixed yet.", true);
  if (/\b(open|unfixed|waiting|todo|to do|outstanding)\b/.test(w)) return list(open, `${open.length} open report${open.length === 1 ? "" : "s"}:`, "No open reports: every report is marked fixed, or none has come in.", false);
  if (/\b(latest|newest|recent|last|new|all|reports?|bugs?)\b/.test(w)) return list([...reports], `The newest of ${reports.length} report${reports.length === 1 ? "" : "s"} (${open.length} open):`, "No player has sent a report yet.", false);
  return { text: helpLine("bug", w ? "I didn't follow that." : "Ask me about players' bug reports.") };
}

/* ── Today bot ───────────────────────────────────────────────────────── */

export function todayAnswer(words: string, messages: readonly TeamMessage[], now: number): BotAnswer {
  const w = words.toLowerCase();
  if (w && !/\b(who|today|in|checked|check|status|everyone|team|here|working|on)\b/.test(w)) return { text: helpLine("today") };
  const have = checkInsFor(messages, ukDay(now).day);
  const inn = TEAM_PEOPLE.filter((p) => have[p]);
  const out = TEAM_PEOPLE.filter((p) => !have[p]);
  const lines = [
    inn.length ? `Checked in today (${inn.length} of ${TEAM_PEOPLE.length}):` : "Nobody has checked in today yet.",
    ...inn.map((p) => `• ${p}: ${clip(have[p]!.text, 140)}`),
    out.length ? `Not yet: ${out.join(", ")}.` : "That is everyone.",
  ];
  return { text: lines.join("\n"), links: [{ label: "Open #today", url: `${TEAM_ROOM.home}?tab=chat&ch=today` }] };
}

/* ── Jobs bot ────────────────────────────────────────────────────────── */

export function jobsAnswer(words: string, asker: TeamPerson, jobs: readonly TeamJob[], tasks: readonly TeamTask[], now: number): BotAnswer {
  const w = words.toLowerCase();
  const named = TEAM_PEOPLE.find((p) => new RegExp(`\\b${p}(?:'s)?\\b`, "i").test(words));
  if (!named && w && !/\b(mine|my|me|jobs?|todo|to-do|to do|tasks?|open|list|what)\b/.test(w)) return { text: helpLine("jobs") };
  const who = named ?? asker;
  const pushed = pushedFor([...jobs], [...tasks], who, now).open;
  const typed = tasksFor([...tasks], who, now);
  const own = [...typed.given, ...typed.mine];
  const total = pushed.length + own.length;
  const whose = who === asker ? "You have" : `${who} has`;
  if (!total) return { text: `${whose} no open jobs.`, links: [{ label: "Open #todo", url: `${TEAM_ROOM.home}?tab=chat&ch=todo` }] };
  const lines = [
    ...pushed.map((j) => `• ${clip(j.title, 110)} (pushed by ${j.from})`),
    ...own.map((x) => `• ${clip(x.title, 110)}${x.made_by !== who ? ` (from ${x.made_by})` : ""}`),
  ];
  return {
    text: [`${whose} ${total} open job${total === 1 ? "" : "s"}:`, ...lines.slice(0, AT_BOT.maxItems), total > AT_BOT.maxItems ? `…and ${total - AT_BOT.maxItems} more in #todo.` : ""].filter(Boolean).join("\n"),
    links: [{ label: "Open #todo", url: `${TEAM_ROOM.home}?tab=chat&ch=todo` }],
  };
}

/* ── Health bot ──────────────────────────────────────────────────────── */

/** The Health bot's answer is the limits read this minute (the same reading as its Run now). The server reads them and passes the post in. */
export function healthAnswer(post: { title: string; body: string; level: string; lines: unknown } | null): BotAnswer {
  if (!post) return { text: "I could not read the limits just now. Try again in a minute, or press Run now on my page." };
  return { text: `${post.title}\n${post.body}`, meta: { lines: post.lines, level: post.level }, links: [{ label: "Open #health", url: `${TEAM_ROOM.home}?tab=chat&ch=health` }] };
}
