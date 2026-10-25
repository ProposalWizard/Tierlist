/**
 * lib/teamRoom/channels.ts — the Team room as a Slack-style workspace
 * (Harry, 23 Oct 2026: "channels with all of the tools and things we already
 * have available in team board … reactions, threads, private DMs, a bot that
 * automatically uploads patch notes into a patch notes channel and @'s
 * everyone"). Pure sums, tested in tests/star/teamRoomChannels.mts.
 *
 * HOW A MESSAGE KNOWS ITS CHANNEL (no new column). Like a reply's
 * "[re:123]", the channel rides at the very front of the message text:
 *
 *   "[#ideas] text…"            a message in #ideas
 *   "text…"                     no tag = #general (so every old message lands there)
 *   "[#ideas] [re:12] text…"    a reply in the thread under message 12 (in #ideas)
 *
 * So channels and threads reach everyone with no database change, and the
 * phone buzzes keep working (they read the same text). Only things that
 * must be shared or private need team_room_v3.sql: new or renamed
 * channels (team_channels), reactions (team_reactions), private DMs
 * (team_dms, row rules let only its two people read it) and a place for a
 * future bot to post (team_bot_posts).
 *
 * BOT POSTS are never written by the browser. The patch-notes bot is drawn
 * from the patch-notes list the site was built with (one post per patch
 * note, @everyone); the jobs bot from team/jobs.json. A later Claude bot
 * writes rows into team_bot_posts with the site's own key.
 */
import { TEAM_PEOPLE, TEAM_ROOM, type TeamPerson } from "./config";
import { CHANNEL_TAG, mentionsIn, parseMessage, patchAuthor, type PatchMeta } from "./extras";
import { jobOwners, markerJobId, type TeamJob } from "./jobs";
import type { TeamMessage, TeamTask } from "./logic";

/* ── Channels ─────────────────────────────────────────────────────────── */

/** The tool a channel carries beside its messages. */
export type ChannelTool = "pinned" | "ideas" | "marketing" | "context" | "jobs" | "patches" | "bugs" | "none";

export interface Channel {
  slug: string;
  name: string;
  topic: string;
  tool: ChannelTool;
  /** One of the nine presets the room starts with (can be renamed, never removed). */
  builtIn: boolean;
}

/** A channel saved in team_channels: a new one, or a built-in one renamed. */
export interface ChannelRow { slug: string; name: string; topic: string | null; made_by: TeamPerson; created_at: string }

export const GENERAL = "general";
export const PATCH_CHANNEL = "patch-notes";
/** To-dos (typed and pushed jobs) live in #todo since 25 Oct 2026 ("To-dos leave #bugs, so #bugs is only bugs"). */
export const JOBS_CHANNEL = "todo";
export const TODO_CHANNEL = JOBS_CHANNEL;
/** Players' bug reports post themselves here (the Bug bot, team_room_v4.sql). */
export const BUGS_CHANNEL = "bugs";

/**
 * The nine presets (Harry, 25 Oct 2026: "channels down the side replace the
 * separate sections"). Order as on the plan page. Presets can be renamed,
 * muted and starred, never deleted.
 */
export const BUILT_IN_CHANNELS: readonly Channel[] = [
  { slug: GENERAL, name: "general", topic: "The team chat: anything and everything", tool: "pinned", builtIn: true },
  { slug: "ideas", name: "ideas", topic: "New ideas, votes and where each one is", tool: "ideas", builtIn: true },
  { slug: JOBS_CHANNEL, name: "todo", topic: "Jobs for each of us: typed here or pushed in team/jobs.json", tool: "jobs", builtIn: true },
  { slug: BUGS_CHANNEL, name: "bugs", topic: "Players' bug reports post themselves here", tool: "bugs", builtIn: true },
  { slug: "health", name: "health", topic: "Is the site well: a morning post once the Health bot exists", tool: "none", builtIn: true },
  { slug: PATCH_CHANNEL, name: "patch-notes", topic: "Every patch note as it ships, with who has read it", tool: "patches", builtIn: true },
  { slug: "connectors", name: "connectors", topic: "Talk about the services we connect to (Supabase, Vercel, Higgsfield…)", tool: "none", builtIn: true },
  { slug: "marketing", name: "marketing", topic: "Videos: the Studio, uploads and the production board", tool: "marketing", builtIn: true },
  { slug: "context", name: "context", topic: "Facts and rulings that should become Brain notes", tool: "context", builtIn: true },
];

const SLUG = /^[a-z0-9][a-z0-9-]{0,29}$/;
export const isSlug = (s: unknown): s is string => typeof s === "string" && SLUG.test(s);

/** "Match Engine!" → "match-engine". Empty when nothing usable is left. */
export function slugify(name: string): string {
  return (name ?? "").toLowerCase().replace(/^#+/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30).replace(/-+$/, "");
}

/** A channel's name as typed, tidied: no #, no double spaces, at most 30 letters. */
export const cleanName = (name: string) => (name ?? "").replace(/^#+/, "").replace(/\s+/g, " ").trim().slice(0, 30);

/**
 * Every channel: the nine presets first (with any rename saved), then
 * new ones in the order they were made. A saved row with a bad slug is left out.
 */
export function listChannels(rows: readonly ChannelRow[]): Channel[] {
  const saved = new Map<string, ChannelRow>();
  for (const r of rows) if (isSlug(r.slug) && !saved.has(r.slug)) saved.set(r.slug, r);
  const out: Channel[] = BUILT_IN_CHANNELS.map((c) => {
    const r = saved.get(c.slug);
    return r ? { ...c, name: cleanName(r.name) || c.name, topic: r.topic?.trim() || c.topic } : { ...c };
  });
  const extra = rows.filter((r) => isSlug(r.slug) && !BUILT_IN_CHANNELS.some((c) => c.slug === r.slug))
    .filter((r, i, a) => a.findIndex((x) => x.slug === r.slug) === i)
    .sort((a, b) => (Date.parse(a.created_at) || 0) - (Date.parse(b.created_at) || 0));
  for (const r of extra) out.push({ slug: r.slug, name: cleanName(r.name) || r.slug, topic: r.topic?.trim() || "", tool: "none", builtIn: false });
  return out;
}

/** A new channel's slug from its name: refused if empty or taken. */
export function newChannelSlug(name: string, channels: readonly Channel[]): { ok: true; slug: string; name: string } | { ok: false; error: string } {
  const nm = cleanName(name);
  const slug = slugify(nm);
  if (!slug) return { ok: false, error: "Give the channel a name (letters or numbers)." };
  if (channels.some((c) => c.slug === slug || c.name.toLowerCase() === nm.toLowerCase())) return { ok: false, error: `#${slug} already exists.` };
  return { ok: true, slug, name: nm };
}

/* ── Which channel a message is in ───────────────────────────────────── */

const TAG = CHANNEL_TAG;

/** The channel a message's text puts it in ("general" when it has no tag). */
export function channelOf(body: string): string {
  return TAG.exec(body ?? "")?.[1] ?? GENERAL;
}

/** The text without its channel tag. */
export const withoutChannel = (body: string) => (body ?? "").replace(TAG, "");

/** Put the channel tag on the front (none for #general). */
export function tagChannel(slug: string, body: string): string {
  const rest = withoutChannel(body);
  return !isSlug(slug) || slug === GENERAL ? rest : `[#${slug}] ${rest}`;
}

/** A thread reply sent with "Also send to #channel" ticked shows in the channel too ("[also]" after its [re:…]). */
export const alsoInChannel = (body: string) => parseMessage(body).also;

/** The message a thread reply answers, or null for a message in the channel itself. */
export const parentOf = (m: Pick<TeamMessage, "body">) => parseMessage(m.body).replyTo;

/**
 * The channel's own stream: its messages that are not thread replies. A
 * reply whose message isn't loaded (too old) stays in the stream, quoted,
 * as it always was, so nothing goes missing.
 */
export function channelStream(messages: readonly TeamMessage[], slug: string): TeamMessage[] {
  const ids = new Set(messages.map((m) => m.id));
  return messages.filter((m) => {
    if (channelOf(m.body) !== slug) return false;
    const p = parentOf(m);
    return !(p && ids.has(p)) || alsoInChannel(m.body);
  });
}

/** Every reply under one message, oldest first. */
export function threadOf(messages: readonly TeamMessage[], parentId: number): TeamMessage[] {
  return messages.filter((m) => parentOf(m) === parentId).sort((a, b) => a.id - b.id);
}

export interface ThreadSummary { count: number; last: TeamMessage | null; people: TeamPerson[] }
/** "3 replies · last reply 10:04", and the faces of who replied. */
export function threadSummary(messages: readonly TeamMessage[], parentId: number): ThreadSummary {
  const r = threadOf(messages, parentId);
  return { count: r.length, last: r[r.length - 1] ?? null, people: TEAM_PEOPLE.filter((p) => r.some((m) => m.person === p)) };
}

/* ── Unread and @ counts per channel ─────────────────────────────────── */

/** The newest message id read in each channel (and "dm:Mikey" for a DM), on this browser. */
export type ChannelReads = Record<string, number>;

/**
 * Has `me` read message `m`? Yes if it is in a channel read past it. A
 * channel never opened on this browser falls back to when the old single
 * chat was last read (`chatReadAt`), so the switch to channels doesn't
 * light up the whole history.
 */
function isRead(m: Pick<TeamMessage, "id" | "created_at">, key: string, reads: ChannelReads, chatReadAt: number) {
  const r = reads[key];
  return r !== undefined ? m.id <= r : (Date.parse(m.created_at) || 0) <= chatReadAt;
}

/** New messages from the other two in one channel (thread replies count). */
export function channelUnread(messages: readonly TeamMessage[], me: TeamPerson | null, slug: string, reads: ChannelReads, chatReadAt: number): number {
  if (!me) return 0;
  return messages.filter((m) => m.person !== me && channelOf(m.body) === slug && !isRead(m, slug, reads, chatReadAt)).length;
}

/** Of those, the ones that @ you (or @all / @everyone / @team). */
export function channelMentions(messages: readonly TeamMessage[], me: TeamPerson | null, slug: string, reads: ChannelReads, chatReadAt: number): number {
  if (!me) return 0;
  return messages.filter((m) => m.person !== me && channelOf(m.body) === slug && !isRead(m, slug, reads, chatReadAt)
    && (mentionsIn(m.body).includes(me) || /(^|[^\w@])@(all|everyone|team)\b/i.test(m.body))).length;
}

/** The newest id in a channel (its thread replies included): what "read" moves up to. */
export function newestIn(messages: readonly TeamMessage[], slug: string): number {
  return messages.reduce((n, m) => (channelOf(m.body) === slug && m.id > n ? m.id : n), 0);
}

/* ── Reactions ────────────────────────────────────────────────────────── */

/** The five, in the order they show (Harry's plan: 👍 ✅ 👀 🔥 ❌). Must match team_room_v3.sql. */
export const REACTIONS = ["👍", "✅", "👀", "🔥", "❌"] as const;
export type Reaction = (typeof REACTIONS)[number];
export const isReaction = (s: unknown): s is Reaction => typeof s === "string" && (REACTIONS as readonly string[]).includes(s);

export interface TeamReaction { message_id: number; emoji: Reaction; person: TeamPerson; at: string }

/** The reactions on one message: each emoji used, who used it (board order). */
export function reactionsOn(list: readonly TeamReaction[], messageId: number): { emoji: Reaction; people: TeamPerson[] }[] {
  const on = list.filter((r) => r.message_id === messageId);
  return REACTIONS.map((emoji) => ({ emoji, people: TEAM_PEOPLE.filter((p) => on.some((r) => r.emoji === emoji && r.person === p)) }))
    .filter((x) => x.people.length > 0);
}

/** Add or take away one reaction, without doubles. */
export function withReaction(list: readonly TeamReaction[], r: TeamReaction, on: boolean): TeamReaction[] {
  const rest = list.filter((x) => !(x.message_id === r.message_id && x.emoji === r.emoji && x.person === r.person));
  return on ? [...rest, r] : rest;
}

/** "👍 Harry, Mikey · 👀 Leo" — who reacted, for the line under an open message. */
export function whoReacted(list: readonly TeamReaction[], messageId: number): string {
  return reactionsOn(list, messageId).map((x) => `${x.emoji} ${x.people.join(", ")}`).join(" · ");
}

/* ── Private DMs ──────────────────────────────────────────────────────── */

export interface TeamDm { id: number; from_person: TeamPerson; to_person: TeamPerson; body: string; created_at: string }

export const dmKey = (other: TeamPerson) => `dm:${other}`;

/** The conversation between you and one other person, oldest first. */
export function dmsWith(dms: readonly TeamDm[], me: TeamPerson | null, other: TeamPerson): TeamDm[] {
  if (!me || me === other) return [];
  return dms.filter((d) => (d.from_person === me && d.to_person === other) || (d.from_person === other && d.to_person === me))
    .sort((a, b) => a.id - b.id);
}

/** DMs from `other` to you that you haven't opened yet on this browser. */
export function dmUnread(dms: readonly TeamDm[], me: TeamPerson | null, other: TeamPerson, reads: ChannelReads): number {
  if (!me) return 0;
  const r = reads[dmKey(other)] ?? 0;
  return dms.filter((d) => d.from_person === other && d.to_person === me && d.id > r).length;
}

/** A DM drawn with the chat's message row (no pin, no thread, no reactions). */
export function dmAsMessage(d: TeamDm): TeamMessage {
  return { id: d.id, person: d.from_person, body: d.body, image_url: null, page: null, pinned: false, created_at: d.created_at };
}

/* ── Bot posts ────────────────────────────────────────────────────────── */

export type BotName = "patch-notes" | "jobs" | string;

export interface BotPost {
  /** Unique across bots: "patch:0.62", "job:lag-test", "row:12". */
  key: string;
  bot: BotName;
  /** The name on the post ("Patch notes bot"). */
  name: string;
  channel: string;
  at: string;
  title: string;
  body: string;
  /** Where "Open" goes (inside the site), or null. */
  url: string | null;
  /** Says @everyone (every phone with alerts on was buzzed for it). */
  everyone: boolean;
  /** A patch note's version (its read receipts), or a pushed job's id (its ✅). */
  version?: string;
  jobId?: string;
  /** A row a bot wrote (team_bot_posts.id): the Bug bot's card reads its marks by it. */
  postId?: number;
}

/** A row a future bot (a Claude routine) wrote into team_bot_posts with the site's own key. */
export interface BotRow { id: number; bot: string; channel: string; title: string; body: string; url: string | null; everyone: boolean; created_at: string; meta?: Record<string, unknown> | null }

export const BOT_NAMES: Record<string, string> = { "patch-notes": "Patch notes bot", jobs: "Jobs bot", bug: "Bug bot" };
export const botName = (bot: string) => BOT_NAMES[bot] ?? `${bot.replace(/[-_]+/g, " ").replace(/^\w/, (c) => c.toUpperCase())} bot`;

/** "Harry's patch notes: B14 Running" → "B14 Running". */
const shortTitle = (t: string) => (t ?? "").replace(/^(Harry|Mikey|Leo)['’]s patch notes\s*(v[\d.]+\w*)?\s*[:—-]?\s*/i, "").trim() || "Patch notes";

/**
 * The patch-notes bot: one post per patch note published on or after `from`,
 * oldest first, each saying @everyone. Nothing is written anywhere: the posts
 * come from the patch-notes list this deploy was built with, so a new patch
 * note shows the moment it reaches the site (the same moment its phone buzz goes).
 */
export function patchBotPosts(notes: readonly PatchMeta[], from: string = TEAM_ROOM.patchReceiptsFrom): BotPost[] {
  const start = Date.parse(from) || 0;
  return notes.filter((n) => (Date.parse(n.publishedAt) || 0) >= start)
    .map((n) => {
      const who = patchAuthor(n.title);
      return {
        key: `patch:${n.version}`, bot: "patch-notes", name: botName("patch-notes"), channel: PATCH_CHANNEL, at: n.publishedAt,
        title: `v${n.version} · ${shortTitle(n.title)}`, body: `New patch notes${who ? ` from ${who}` : ""}. Read them, then press Read and understood.`,
        url: `${TEAM_ROOM.home}?tab=notes&v=${encodeURIComponent(n.version)}`, everyone: true, version: n.version,
      };
    })
    .sort((a, b) => (Date.parse(a.at) || 0) - (Date.parse(b.at) || 0));
}

/** The jobs bot in #bugs: one post per job that arrived by push (team/jobs.json). */
export function jobBotPosts(jobs: readonly TeamJob[]): BotPost[] {
  return jobs.map((j) => ({
    key: `job:${j.id}`, bot: "jobs", name: botName("jobs"), channel: JOBS_CHANNEL, at: j.added,
    title: j.title, body: `For ${j.owner === "all" ? "everyone" : j.owner} · from ${j.from}`, url: `${TEAM_ROOM.home}?tab=todo`,
    everyone: j.owner === "all", jobId: j.id,
  })).sort((a, b) => (Date.parse(a.at) || 0) - (Date.parse(b.at) || 0));
}

/** Rows a future bot wrote (team_bot_posts), as posts. A row with a bad channel goes to #general. */
export function rowBotPosts(rows: readonly BotRow[]): BotPost[] {
  return rows.map((r) => ({
    key: `row:${r.id}`, bot: r.bot, name: botName(r.bot), channel: isSlug(r.channel) ? r.channel : GENERAL, at: r.created_at,
    title: r.title, body: r.body, url: r.url && r.url.startsWith("/") ? r.url : null, everyone: !!r.everyone, postId: r.id,
  }));
}

/** Who has ticked a pushed job (each person ticks their own, by the [job:id] marker rows). */
export function jobDoneBy(tasks: readonly TeamTask[], jobId: string): TeamPerson[] {
  return TEAM_PEOPLE.filter((p) => {
    const marks = tasks.filter((x) => x.owner === p && x.made_by === p && markerJobId(x) === jobId).sort((a, b) => b.id - a.id);
    return !!marks[0]?.done_at;
  });
}

/** Can `me` tick this pushed job (it is theirs, or for all)? */
export const jobIsFor = (job: Pick<TeamJob, "owner">, me: TeamPerson | null) => !!me && jobOwners(job).includes(me);

/** One stream of messages and bot posts, oldest first. */
export type StreamItem = { kind: "msg"; at: string; m: TeamMessage } | { kind: "bot"; at: string; b: BotPost };
export function mergeStream(messages: readonly TeamMessage[], bots: readonly BotPost[]): StreamItem[] {
  const items: StreamItem[] = [
    ...messages.map((m) => ({ kind: "msg" as const, at: m.created_at, m })),
    ...bots.map((b) => ({ kind: "bot" as const, at: b.at, b })),
  ];
  return items.sort((a, b) => (Date.parse(a.at) || 0) - (Date.parse(b.at) || 0) || (a.kind === "msg" && b.kind === "msg" ? a.m.id - b.m.id : 0));
}

/* ── The address ─────────────────────────────────────────────────────── */

export type RoomPlace = { kind: "channel"; slug: string } | { kind: "dm"; with: TeamPerson };

/** ?ch=ideas | ?dm=Mikey → where the room opens. Anything else → #general. */
export function placeFrom(q: { ch?: string | null; dm?: string | null }): RoomPlace {
  const dm = q.dm ? q.dm[0].toUpperCase() + q.dm.slice(1).toLowerCase() : null;
  if (dm && (TEAM_PEOPLE as readonly string[]).includes(dm)) return { kind: "dm", with: dm as TeamPerson };
  return { kind: "channel", slug: isSlug(q.ch) ? q.ch : GENERAL };
}

/** The Team room address for a place (and a message, and an open thread). */
export function roomUrl(place: RoomPlace, opts: { m?: number | null; t?: number | null } = {}): string {
  const q = new URLSearchParams({ tab: "chat" });
  if (place.kind === "dm") q.set("dm", place.with);
  else if (place.slug !== GENERAL) q.set("ch", place.slug);
  if (opts.m) q.set("m", String(opts.m));
  if (opts.t) q.set("t", String(opts.t));
  return `${TEAM_ROOM.home}?${q.toString()}`;
}

/* ── Every count the room shows ──────────────────────────────────────── */

export interface ChannelCount { unread: number; mentions: number }
export interface RoomCounts {
  channels: Record<string, ChannelCount>;
  dms: Partial<Record<TeamPerson, number>>;
  /** Everything new for you: every channel's unread + every DM + patch notes to read + new jobs. */
  total: number;
  /** Of those, the ones that @ you (a DM and an unread patch note's @everyone count). */
  mentions: number;
  /** The two parts that also have their own badge (the bell, the To-do): left out of the chat bubble's number. */
  patchToRead: number;
  newJobs: number;
}

/**
 * The badges: per channel (unread, and how many of them @ you), per DM, and
 * the totals for the chat bubble and the side menu. #patch-notes adds the
 * patch notes you still have to read (the bot's @everyone posts); #bugs adds
 * pushed jobs for you that you haven't seen.
 */
export function roomCounts(input: {
  messages: readonly TeamMessage[]; me: TeamPerson | null; reads: ChannelReads; chatReadAt: number;
  channels: readonly Channel[]; dms: readonly TeamDm[]; patchToRead: number; newJobs: number;
}): RoomCounts {
  const { messages, me, reads, chatReadAt } = input;
  const out: RoomCounts = { channels: {}, dms: {}, total: 0, mentions: 0, patchToRead: input.patchToRead, newJobs: input.newJobs };
  for (const c of input.channels) {
    const n: ChannelCount = { unread: channelUnread(messages, me, c.slug, reads, chatReadAt), mentions: channelMentions(messages, me, c.slug, reads, chatReadAt) };
    if (c.slug === PATCH_CHANNEL) { n.unread += input.patchToRead; n.mentions += input.patchToRead; }
    if (c.slug === JOBS_CHANNEL) n.unread += input.newJobs;
    out.channels[c.slug] = n;
    out.total += n.unread;
    out.mentions += n.mentions;
  }
  for (const p of TEAM_PEOPLE) {
    if (p === me) continue;
    const n = dmUnread(input.dms, me, p, reads);
    out.dms[p] = n;
    out.total += n;
    out.mentions += n;
  }
  return out;
}

/** Pinned messages in one channel, newest first. */
export function pinsIn(messages: readonly TeamMessage[], slug: string): TeamMessage[] {
  return messages.filter((m) => m.pinned && channelOf(m.body) === slug).sort((a, b) => b.id - a.id);
}
