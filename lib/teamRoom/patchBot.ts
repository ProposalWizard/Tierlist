/**
 * lib/teamRoom/patchBot.ts — the Patch bot, working end to end (Harry, 12 Nov
 * 2026: "the patch bot coming into general … it does @ the two people who
 * didn't post the patch notes … we can reply in thread … once that thread has
 * been acted on it can move to the patch notes chat as an archive").
 *
 * Pure sums, tested in tests/star/teamRoomPatchBot.mts. No React, no database.
 * The server half (who writes the rows) is patchBotServer.ts.
 *
 * HOW IT WORKS, with no new table:
 *   1. THE POST. When a patch note appears in lib/patchNotesData.ts, the site
 *      writes ONE row into team_bot_posts (bot "patch-notes", channel
 *      "general", meta.kind "announce", meta.version). Asked for again, it
 *      sees the row and writes nothing (announcePlan). Two askers at the same
 *      moment: the later row is deleted (duplicateAnnounces) and the room only
 *      ever draws one post per version.
 *   2. THE THREAD. A comment on the post is an ordinary chat message whose
 *      text starts "[pn:0.138] " (like "[re:12] " for a reply). So a comment
 *      typed on the patch note page lands in the same thread.
 *   3. THE ARCHIVE. Nothing is moved in the database. A post shows in #general
 *      until all three have read the note (its author counts), then in
 *      #patch-notes (patchPostChannel). Take a read back and it returns.
 *   4. SETTINGS (on/off, the nudge). A row with meta.kind "settings"; the
 *      newest one wins. Only the site's own key can write it (the bots route).
 */
import { TEAM_PEOPLE, TEAM_ROOM, type TeamPerson } from "./config";
import { parseMessage, patchAuthor, patchReaders, type PatchMeta, type TeamAck } from "./extras";
import { GENERAL, PATCH_CHANNEL, botName, patchBotPosts, type BotPost, type BotRow } from "./channels";
import type { TeamMessage, TeamNote } from "./logic";

export const PATCH_BOT = {
  bot: "patch-notes",
  /** Patch notes published from this day are announced in #general. Older ones stay in #patch-notes, as before. */
  from: "2026-11-12",
  /** Settings rows sit in a channel nobody has, so they never show as a post. */
  settingsChannel: "bot-settings",
  /** At most this many announcements in one run (a first run after a long gap can't flood #general). */
  maxPerRun: 5,
  /** "Remind people who haven't read it": never, after a day, after two days. */
  nudgeChoices: [0, 24, 48] as readonly number[],
  /** How often the timer asks (vercel.json), in minutes. */
  everyMinutes: 15,
} as const;

/* ── The note's people ───────────────────────────────────────────────── */

export interface BotNote extends PatchMeta { author?: string | null; summary?: string | null }

const isPerson = (s: unknown): s is TeamPerson => typeof s === "string" && (TEAM_PEOPLE as readonly string[]).includes(s);

/** Who wrote a patch note: its author field, else the name its title starts with. */
export function noteAuthor(n: Pick<BotNote, "title" | "author">): TeamPerson | null {
  return isPerson(n.author) ? n.author : patchAuthor(n.title);
}

/** Who is asked to review: the two who did not write it (all three when nobody's name is on it). */
export function reviewersOf(n: Pick<BotNote, "title" | "author">): TeamPerson[] {
  const a = noteAuthor(n);
  return TEAM_PEOPLE.filter((p) => p !== a);
}

/** "Harry's patch notes: B14 Running" → "B14 Running". */
export const shortPatchTitle = (t: string) => (t ?? "").replace(/^(Harry|Mikey|Leo)['’]s patch notes\s*(v[\d.]+\w*)?\s*[:—-]?\s*/i, "").trim() || "Patch notes";

/** One line from a note's summary: its first sentence, at most `max` letters. */
export function summaryLine(summary: string | null | undefined, max = 140): string {
  const s = (summary ?? "").replace(/\s+/g, " ").trim();
  if (!s) return "";
  const first = /^(.{20,}?[.!?])(\s|$)/.exec(s)?.[1] ?? s;
  return first.length > max ? first.slice(0, max - 1).replace(/[\s,;:]+\S*$/, "") + "…" : first;
}

/* ── Rows the bot wrote ──────────────────────────────────────────────── */

export type PatchRowKind = "announce" | "nudge" | "settings";
const metaOf = (r: Pick<BotRow, "meta">) => (r.meta && typeof r.meta === "object" ? r.meta : {}) as Record<string, unknown>;
export const isPatchBotRow = (r: Pick<BotRow, "bot">) => r.bot === PATCH_BOT.bot;
export const isSettingsRow = (r: Pick<BotRow, "meta" | "channel">) => metaOf(r).kind === "settings" || r.channel === PATCH_BOT.settingsChannel;
export function patchRowKind(r: Pick<BotRow, "bot" | "meta" | "channel">): PatchRowKind | null {
  if (isSettingsRow(r)) return "settings";
  if (!isPatchBotRow(r)) return null;
  const k = metaOf(r).kind;
  return k === "announce" || k === "nudge" ? k : null;
}
export const rowVersion = (r: Pick<BotRow, "meta">): string | null => {
  const v = metaOf(r).version;
  return typeof v === "string" && v ? v : null;
};

/** version → its announcement (the OLDEST row wins, so a double never shows). */
export function announcedRows(rows: readonly BotRow[]): Map<string, BotRow> {
  const out = new Map<string, BotRow>();
  for (const r of [...rows].sort((a, b) => a.id - b.id)) {
    const v = rowVersion(r);
    if (v && patchRowKind(r) === "announce" && !out.has(v)) out.set(v, r);
  }
  return out;
}

/** Announcements written twice (two askers at once): the ids to delete, keeping the oldest of each version. */
export function duplicateAnnounces(rows: readonly BotRow[]): number[] {
  const keep = announcedRows(rows);
  return rows.filter((r) => patchRowKind(r) === "announce" && rowVersion(r) && keep.get(rowVersion(r)!)!.id !== r.id).map((r) => r.id);
}

/* ── Settings ────────────────────────────────────────────────────────── */

export interface BotSettings { enabled: boolean; nudgeHours: number; by: TeamPerson | null; at: string | null }
export const DEFAULT_BOT_SETTINGS: BotSettings = { enabled: true, nudgeHours: 24, by: null, at: null };

/** A bot's settings: its newest settings row, cleaned. No row = on, nudge after a day. */
export function botSettings(rows: readonly BotRow[], bot: string = PATCH_BOT.bot): BotSettings {
  const row = rows.filter((r) => r.bot === bot && isSettingsRow(r)).sort((a, b) => b.id - a.id)[0];
  if (!row) return { ...DEFAULT_BOT_SETTINGS };
  const m = metaOf(row);
  const h = Number(m.nudgeHours);
  return {
    enabled: m.enabled !== false,
    nudgeHours: PATCH_BOT.nudgeChoices.includes(h) ? h : DEFAULT_BOT_SETTINGS.nudgeHours,
    by: isPerson(m.by) ? m.by : null,
    at: row.created_at,
  };
}

export interface NewBotRow { bot: string; channel: string; title: string; body: string; url: string | null; everyone: boolean; meta: Record<string, unknown> }

/** The row that saves a bot's settings (written by the site's key only). */
export function settingsRow(bot: string, s: Pick<BotSettings, "enabled" | "nudgeHours">, by: TeamPerson | null): NewBotRow {
  return {
    bot, channel: PATCH_BOT.settingsChannel, title: `${botName(bot)} ${s.enabled ? "on" : "off"}`, body: "", url: null, everyone: false,
    meta: { kind: "settings", enabled: !!s.enabled, nudgeHours: PATCH_BOT.nudgeChoices.includes(s.nudgeHours) ? s.nudgeHours : DEFAULT_BOT_SETTINGS.nudgeHours, by },
  };
}

/* ── What to post ────────────────────────────────────────────────────── */

export const patchUrl = (version: string) => `${TEAM_ROOM.home}?tab=notes&v=${encodeURIComponent(version)}`;

/** The announcement for one note: title, one line, Open, and the two reviewers named. */
export function announceRow(n: BotNote): NewBotRow {
  const who = reviewersOf(n);
  const author = noteAuthor(n);
  const line = summaryLine(n.summary) || `New patch notes${author ? ` from ${author}` : ""}.`;
  return {
    bot: PATCH_BOT.bot, channel: GENERAL, title: `v${n.version} · ${shortPatchTitle(n.title)}`.slice(0, 200),
    body: `${line}\n${who.map((p) => `@${p}`).join(" ")} please review.`, url: patchUrl(n.version), everyone: false,
    meta: { kind: "announce", version: n.version, author, reviewers: who },
  };
}

/**
 * The notes to announce now: published from `from`, not announced yet, oldest
 * first, at most maxPerRun. Run it twice with the rows it made: nothing.
 * Switched off: nothing (a note published while it is off is announced when it
 * is switched back on).
 */
export function announcePlan(input: { notes: readonly BotNote[]; rows: readonly BotRow[]; enabled?: boolean; from?: string; max?: number }): NewBotRow[] {
  if (input.enabled === false) return [];
  const start = Date.parse(input.from ?? PATCH_BOT.from) || 0;
  const have = announcedRows(input.rows);
  const seen = new Set<string>();
  return input.notes
    .filter((n) => (Date.parse(n.publishedAt) || 0) >= start && !have.has(n.version))
    .filter((n) => (seen.has(n.version) ? false : (seen.add(n.version), true)))
    .sort((a, b) => (Date.parse(a.publishedAt) || 0) - (Date.parse(b.publishedAt) || 0))
    .slice(0, input.max ?? PATCH_BOT.maxPerRun)
    .map(announceRow);
}

/** Has everyone read it? (The author counts as having read their own.) */
export const everyoneRead = (n: PatchMeta, acks: readonly TeamAck[]) => patchReaders(n, acks as TeamAck[]).length === TEAM_PEOPLE.length;

/** Where a patch note's post shows: #general until all three have read it, then #patch-notes. */
export const patchPostChannel = (n: PatchMeta, acks: readonly TeamAck[]) => (everyoneRead(n, acks) ? PATCH_CHANNEL : GENERAL);

/**
 * One reminder per note: `nudgeHours` after its announcement, to whoever has
 * still not read it. Never a second one for the same note; none when off (0).
 */
export function nudgePlan(input: { notes: readonly BotNote[]; rows: readonly BotRow[]; acks: readonly TeamAck[]; nudgeHours: number; now: number; enabled?: boolean }): NewBotRow[] {
  if (input.enabled === false || !(input.nudgeHours > 0)) return [];
  const nudged = new Set(input.rows.filter((r) => patchRowKind(r) === "nudge").map(rowVersion));
  const out: NewBotRow[] = [];
  for (const [version, row] of Array.from(announcedRows(input.rows))) {
    if (nudged.has(version)) continue;
    if (input.now - (Date.parse(row.created_at) || 0) < input.nudgeHours * 3600_000) continue;
    const n = input.notes.find((x) => x.version === version);
    if (!n) continue;
    const read = patchReaders(n, input.acks as TeamAck[]);
    const waiting = reviewersOf(n).filter((p) => !read.includes(p));
    if (!waiting.length) continue;
    out.push({
      bot: PATCH_BOT.bot, channel: GENERAL, title: `Still to read: v${version} · ${shortPatchTitle(n.title)}`.slice(0, 200),
      body: `${waiting.map((p) => `@${p}`).join(" ")} this one is waiting on you.`, url: patchUrl(version), everyone: false,
      meta: { kind: "nudge", version, people: waiting },
    });
  }
  return out;
}

/* ── The posts the room draws ────────────────────────────────────────── */

/**
 * Every Patch bot post. A note in the new flow (announced, or published from
 * PATCH_BOT.from and waiting for the site to post it) shows in #general with
 * its reviewers named, then in #patch-notes once everyone has read it. Older
 * notes stay in #patch-notes as they always were. One post per version, always.
 */
export function patchFlowPosts(notes: readonly BotNote[], rows: readonly BotRow[], acks: readonly TeamAck[], from: string = PATCH_BOT.from): BotPost[] {
  const start = Date.parse(from) || 0;
  const have = announcedRows(rows);
  const base = patchBotPosts(notes);
  const out: BotPost[] = base.map((p) => {
    const n = notes.find((x) => x.version === p.version)!;
    const row = have.get(n.version);
    const inFlow = !!row || (Date.parse(n.publishedAt) || 0) >= start;
    if (!inFlow) return p;
    const who = reviewersOf(n);
    const author = noteAuthor(n);
    const archived = everyoneRead(n, acks);
    return {
      ...p, at: row?.created_at ?? p.at, channel: archived ? PATCH_CHANNEL : GENERAL, everyone: false,
      body: row ? row.body.split("\n")[0] : summaryLine(n.summary) || `New patch notes${author ? ` from ${author}` : ""}.`,
      mentions: who, flow: true, archived, pending: !row,
    };
  });
  // Reminders follow their note: gone from #general once everyone has read it.
  for (const r of rows) {
    if (patchRowKind(r) !== "nudge") continue;
    const n = notes.find((x) => x.version === rowVersion(r));
    out.push({
      key: `row:${r.id}`, bot: PATCH_BOT.bot, name: botName(PATCH_BOT.bot), channel: n && everyoneRead(n, acks) ? PATCH_CHANNEL : GENERAL, at: r.created_at,
      title: r.title, body: r.body, url: r.url && r.url.startsWith("/") ? r.url : null, everyone: false, postId: r.id, threadOf: n?.version,
    });
  }
  return out.sort((a, b) => (Date.parse(a.at) || 0) - (Date.parse(b.at) || 0));
}

/** Rows that are NOT the Patch bot's own (those are drawn by patchFlowPosts) and not a settings row. */
export const otherBotRows = (rows: readonly BotRow[]) => rows.filter((r) => !isSettingsRow(r) && !(isPatchBotRow(r) && patchRowKind(r)));

/* ── The thread ──────────────────────────────────────────────────────── */

/** The patch note a message comments on ("[pn:0.138] …"), or null. */
export const patchThreadOf = (m: Pick<TeamMessage, "body">) => parseMessage(m.body).patch;

/** Every comment on one patch note, oldest first. */
export function patchThread(messages: readonly TeamMessage[], version: string): TeamMessage[] {
  return messages.filter((m) => patchThreadOf(m) === version).sort((a, b) => a.id - b.id);
}

export function patchThreadSummary(messages: readonly TeamMessage[], version: string) {
  const r = patchThread(messages, version);
  return { count: r.length, last: r[r.length - 1] ?? null, people: TEAM_PEOPLE.filter((p) => r.some((m) => m.person === p)) };
}

/**
 * "Copy thread for Claude": a tidy block the author pastes into their own
 * Claude chat with "make the changes suggested". The version, who wrote it,
 * every comment with its author (pictures and page links said so), then the
 * older Notes on the same version, then the ask.
 */
export function threadForClaude(input: { note: Pick<BotNote, "version" | "title" | "author">; messages: readonly TeamMessage[]; notes?: readonly TeamNote[]; origin?: string }): string {
  const { note } = input;
  const author = noteAuthor(note);
  const thread = patchThread(input.messages, note.version);
  const old = (input.notes ?? []).filter((n) => n.target_kind === "patch" && String(n.target_id) === note.version).sort((a, b) => a.id - b.id);
  const when = (iso: string) => new Date(iso).toISOString().slice(0, 16).replace("T", " ") + " UTC";
  const lines: string[] = [
    `PATCH NOTE v${note.version}: ${shortPatchTitle(note.title)}`,
    `Written by: ${author ?? "unknown"}`,
    `Page: ${input.origin ?? ""}${patchUrl(note.version)}`,
    "",
    `TEAM COMMENTS (${thread.length + old.length})`,
  ];
  if (!thread.length && !old.length) lines.push("(none yet)");
  let i = 0;
  for (const m of thread) {
    const p = parseMessage(m.body);
    const extra = [...(m.image_url ? [`picture: ${m.image_url}`] : []), ...p.cards.map((c) => `page: ${c.url.split("#")[0]}${c.point?.n ? ` (pointed at: "${c.point.n}")` : ""}`)];
    lines.push(`${++i}. ${m.person} (${when(m.created_at)}): ${p.text.replace(/\s*\n\s*/g, " / ") || "(no words)"}${extra.length ? ` [${extra.join("; ")}]` : ""}`);
  }
  for (const n of old) {
    const quotes = n.body.split("\n").filter((l) => l.startsWith("> ")).map((l) => `"${l.slice(2)}"`);
    const said = n.body.split("\n").filter((l) => !l.startsWith("> ")).join(" / ");
    lines.push(`${++i}. ${n.person} (${when(n.created_at)}, note on the page)${quotes.length ? ` about ${quotes.join(", ")}` : ""}: ${said}`);
  }
  lines.push("", `ASK: Read the comments above on patch note v${note.version} and make the changes suggested. Tell me first if you disagree with any of them, and why.`);
  return lines.join("\n");
}

/* ── The bot's page ──────────────────────────────────────────────────── */

export interface BotEvent { at: string; text: string }

/** The last few things the Patch bot did, newest first: posts, reminders, archives, switch on/off. */
export function patchBotActivity(input: { notes: readonly BotNote[]; rows: readonly BotRow[]; acks: readonly TeamAck[]; max?: number }): BotEvent[] {
  const out: BotEvent[] = [];
  const have = announcedRows(input.rows);
  for (const [version, row] of Array.from(have)) {
    const n = input.notes.find((x) => x.version === version);
    const who = n ? reviewersOf(n) : [];
    out.push({ at: row.created_at, text: `Posted v${version} in #general${who.length ? ` and asked ${who.join(" and ")} to review` : ""}` });
    if (n && everyoneRead(n, input.acks)) {
      const key = version;
      const last = input.acks.filter((a) => a.kind === "patch" && (a.target === key || a.target.startsWith(`${key}@`))).map((a) => a.at).sort().pop();
      out.push({ at: last && last > row.created_at ? last : row.created_at, text: `Everyone has read v${version}: moved its thread to #patch-notes` });
    }
  }
  for (const r of input.rows) {
    const k = patchRowKind(r);
    if (k === "nudge") out.push({ at: r.created_at, text: `Reminded ${((metaOf(r).people as unknown[]) ?? []).filter(isPerson).join(" and ") || "the readers"} about v${rowVersion(r) ?? "?"}` });
    if (k === "settings" && r.bot === PATCH_BOT.bot) {
      const m = metaOf(r);
      out.push({ at: r.created_at, text: `${isPerson(m.by) ? m.by : "Someone"} saved its settings: ${m.enabled === false ? "off" : "on"}, reminder ${Number(m.nudgeHours) > 0 ? `after ${Number(m.nudgeHours)} hours` : "never"}` });
    }
  }
  return out.sort((a, b) => (Date.parse(b.at) || 0) - (Date.parse(a.at) || 0)).slice(0, input.max ?? 5);
}

export interface BotInfo {
  bot: string; name: string; icon: string; channel: string;
  /** What it does, one line each. */
  does: string[];
  /** When it runs. */
  runs: string;
  /** Can it be switched off from its page? If not, why. */
  switchable: boolean; fixed?: string;
}

/** The bots that exist today. A bot is a small job the site runs, not a person to chat with. */
export const BOTS: readonly BotInfo[] = [
  {
    bot: PATCH_BOT.bot, name: "Patch bot", icon: "📣", channel: GENERAL,
    does: [
      "Posts each new patch note in #general: its title, one line, an Open button.",
      "Names the two people who did not write it and asks them to review.",
      "Keeps every comment on that note in one thread (comments typed on the patch note page land there too).",
      "Moves the post and its thread to #patch-notes once all three have read it.",
    ],
    runs: `Every ${PATCH_BOT.everyMinutes} minutes on the site's timer, and the moment any of us opens an admin page after a deploy.`,
    switchable: true,
  },
  {
    bot: "bug", name: "Bug bot", icon: "🐞", channel: "bugs",
    does: ["Turns each bug report a player sends into a report card in #bugs.", "Each card can be handed to one of us and marked fixed."],
    runs: "The moment a player sends a report (it runs inside the database).",
    switchable: false, fixed: "Always on: it lives inside the database, so this page can't switch it off.",
  },
  {
    bot: "health", name: "Health bot", icon: "🩺", channel: "health",
    does: ["Posts the site's limits (database, storage, backups) in #health every morning.", "Posts in red, and buzzes, when a backup fails."],
    runs: "08:00 UK time, every day, once the limits job runs (it needs CRON_SECRET set in Vercel).",
    switchable: false, fixed: "Runs on the site's timer; it can't be switched off from here yet.",
  },
];
export const botInfo = (bot: string) => BOTS.find((b) => b.bot === bot) ?? null;

/** A plain line for a bot's page: is it really posting? */
export function botStatusLine(bot: string, rows: readonly BotRow[], settings: BotSettings, now: number): { tone: "ok" | "wait" | "off"; text: string } {
  if (bot === PATCH_BOT.bot) {
    if (!settings.enabled) return { tone: "off", text: `Switched off${settings.by ? ` by ${settings.by}` : ""}. New patch notes are not announced until it is on again.` };
    const n = announcedRows(rows).size;
    return n ? { tone: "ok", text: `Working: ${n} patch note${n === 1 ? "" : "s"} announced.` }
      : { tone: "wait", text: `On and waiting: it posts the next patch note published from ${new Date(PATCH_BOT.from).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}.` };
  }
  const mine = rows.filter((r) => r.bot === bot && !isSettingsRow(r)).sort((a, b) => b.id - a.id);
  if (!mine.length) return { tone: "wait", text: bot === "health" ? "Not posting yet: no morning post has arrived. It starts at 08:00 UK once the limits job runs." : "Not posting yet: no report has come in since it was set up." };
  const days = Math.floor((now - (Date.parse(mine[0].created_at) || 0)) / 86400_000);
  return { tone: "ok", text: `Working: ${mine.length} post${mine.length === 1 ? "" : "s"}, the last ${days <= 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`}.` };
}

/** The last things any other bot did: its newest rows. */
export function rowBotActivity(bot: string, rows: readonly BotRow[], max = 5): BotEvent[] {
  return rows.filter((r) => r.bot === bot && !isSettingsRow(r)).sort((a, b) => b.id - a.id).slice(0, max).map((r) => ({ at: r.created_at, text: r.title }));
}
