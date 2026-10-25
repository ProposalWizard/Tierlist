/**
 * lib/teamRoom/extras.ts — the Team room's second round (Harry, 20 Oct 2026):
 * "read receipts in chat, and reply to current chats - also working @ ing and
 * linking other pages directly into chat … highlight part of a page and it
 * @'s them to look at it … patch notes … read receipts and notes".
 *
 * Pure sums, tested in tests/star/teamRoom.mts. No React, no database.
 *
 * Replies, @mentions, page cards and points all live INSIDE the message text,
 * so they reach everyone with or without team_room_v2.sql. Only "who has
 * seen it" and "Got it" / "Read and understood" need the new tables.
 *
 *   [re:123] text…                  a reply to message 123 (first thing in the text)
 *   @Mikey                          a mention
 *   /admin/team?tab=chat            a line that is only a site link = a page card
 *   /star-gallery-dev#kib-point=…   a page card that points at part of that page
 */
import { TEAM_PEOPLE, type TeamPerson } from "./config";
import type { TeamMessage } from "./logic";

/** The newest message id each person has had on screen (team_read_marks). */
export type ReadMarks = Partial<Record<TeamPerson, number>>;
export type AckKind = "point" | "patch";
export interface TeamAck { kind: AckKind; target: string; person: TeamPerson; at: string }

export interface PointBox {
  v: 1;
  /** Short random id: "Got it" is saved against it. */
  id: string;
  by: TeamPerson;
  to: TeamPerson[];
  /** The note. */
  n: string;
  /** Page name, for the card. */
  pn?: string;
  /** The element the box sits in (CSS selector), and the box as fractions of that element. */
  sel?: string; ex?: number; ey?: number; ew?: number; eh?: number;
  /** The box on screen when drawn (px), the page scroll then, and the window size then. */
  x: number; y: number; w: number; h: number; sx: number; sy: number; vw: number; vh: number;
}

export interface MessageCard { url: string; path: string; point: PointBox | null }
export interface ParsedMessage {
  replyTo: number | null; text: string; cards: MessageCard[]; mentions: TeamPerson[];
  /** The channel tag at the front ("[#ideas] "), or null = #general (lib/teamRoom/channels.ts). */
  channel: string | null;
}

export const POINT_KEY = "kib-point=";
const REPLY = /^\[re:(\d{1,12})\]\s?/;
/** "[#ideas] " at the very front: the message's channel (23 Oct 2026, channels.ts). Comes before any [re:…]. */
export const CHANNEL_TAG = /^\[#([a-z0-9][a-z0-9-]{0,29})\]\s?/;
const MENTION = /(^|[^\w@])@(harry|mikey|leo)\b/gi;

const isName = (s: unknown): s is TeamPerson => typeof s === "string" && (TEAM_PEOPLE as readonly string[]).includes(s);
const proper = (s: string) => (s[0].toUpperCase() + s.slice(1).toLowerCase()) as TeamPerson;

function b64url(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function unb64url(s: string): string {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

const r3 = (n: number | undefined, d: number) => Math.round((Number.isFinite(n) ? n! : d) * 1000) / 1000;
export function encodePoint(p: PointBox): string {
  const clean: PointBox = {
    v: 1, id: p.id.slice(0, 16), by: p.by, to: p.to.filter(isName), n: p.n.slice(0, 300),
    ...(p.pn ? { pn: p.pn.slice(0, 60) } : {}),
    ...(p.sel ? { sel: p.sel.slice(0, 400), ex: r3(p.ex, 0), ey: r3(p.ey, 0), ew: r3(p.ew, 1), eh: r3(p.eh, 1) } : {}),
    x: Math.round(p.x), y: Math.round(p.y), w: Math.round(p.w), h: Math.round(p.h),
    sx: Math.round(p.sx), sy: Math.round(p.sy), vw: Math.round(p.vw), vh: Math.round(p.vh),
  };
  return b64url(JSON.stringify(clean));
}

/** The point inside a link's #kib-point=…, or null if there is none or it is broken. */
export function decodePoint(hashOrUrl: string): PointBox | null {
  const i = hashOrUrl.indexOf(POINT_KEY);
  if (i < 0) return null;
  try {
    const raw = hashOrUrl.slice(i + POINT_KEY.length).split("&")[0];
    const p = JSON.parse(unb64url(raw)) as PointBox;
    const nums = [p.x, p.y, p.w, p.h, p.sx, p.sy, p.vw, p.vh];
    if (p.v !== 1 || typeof p.id !== "string" || !isName(p.by) || !Array.isArray(p.to)) return null;
    if (nums.some((n) => typeof n !== "number" || !Number.isFinite(n)) || p.w <= 0 || p.h <= 0) return null;
    return { ...p, to: p.to.filter(isName), n: String(p.n ?? "") };
  } catch { return null; }
}

/** The link that opens `path` and draws the point there. */
export function pointUrl(path: string, p: PointBox): string {
  return `${path.split("#")[0]}#${POINT_KEY}${encodePoint(p)}`;
}

/** Who a text mentions, in board order. "@Mikey" and "@mikey" both count; "x@leo.com" does not. */
export function mentionsIn(text: string): TeamPerson[] {
  const found = new Set<TeamPerson>();
  const re = new RegExp(MENTION.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text ?? ""))) found.add(proper(m[2]));
  return TEAM_PEOPLE.filter((p) => found.has(p));
}

/**
 * Split a message into its reply, its text, its cards and its mentions.
 * `origins` = this site's own addresses (e.g. https://knowitball.co.uk):
 * a full link to one of them on its own line is a card too.
 */
export function parseMessage(body: string, origins: string[] = []): ParsedMessage {
  let rest = body ?? "";
  let channel: string | null = null;
  const ch = CHANNEL_TAG.exec(rest);
  if (ch) { channel = ch[1]; rest = rest.slice(ch[0].length); }
  let replyTo: number | null = null;
  const r = REPLY.exec(rest);
  if (r) { replyTo = Number(r[1]); rest = rest.slice(r[0].length); }
  const cards: MessageCard[] = [];
  const lines: string[] = [];
  for (const line of rest.split("\n")) {
    const t = line.trim();
    let path: string | null = null;
    if (/^\/(?!\/)\S*$/.test(t)) path = t;
    else if (!/\s/.test(t)) {
      const o = origins.find((x) => x && (t === x || t.startsWith(x + "/") || t.startsWith(x + "#") || t.startsWith(x + "?")));
      if (o) path = t.slice(o.length) || "/";
      if (path && !path.startsWith("/")) path = "/" + path;
    }
    if (path) cards.push({ url: path, path: path.split(/[?#]/)[0] || "/", point: decodePoint(path) });
    else lines.push(line);
  }
  const text = lines.join("\n").replace(/^\s*\n+|\n+\s*$/g, "");
  return { replyTo, text, cards, mentions: mentionsIn(rest), channel };
}

/**
 * Build the text that goes in the database: [#channel] (not for #general),
 * [re:id], the words, then one link per line.
 */
export function composeBody(text: string, opts: { replyTo?: number | null; links?: string[]; channel?: string | null } = {}): string {
  const ch = opts.channel && opts.channel !== "general" && /^[a-z0-9][a-z0-9-]{0,29}$/.test(opts.channel) ? `[#${opts.channel}] ` : "";
  const head = ch + (opts.replyTo ? `[re:${opts.replyTo}] ` : "");
  const links = (opts.links ?? []).filter(Boolean);
  return (head + [text.trim(), ...links].filter(Boolean).join("\n")).slice(0, 2000);
}

/** The others (not the sender) who have had this message on screen. */
export function seenBy(m: Pick<TeamMessage, "id" | "person">, marks: ReadMarks): TeamPerson[] {
  return TEAM_PEOPLE.filter((p) => p !== m.person && (marks[p] ?? 0) >= m.id);
}

/** Messages that name you, from the other two, that you have not had on screen. */
export function unseenMentions(messages: TeamMessage[], me: TeamPerson | null, marks: ReadMarks): TeamMessage[] {
  if (!me) return [];
  const mine = marks[me] ?? 0;
  return messages.filter((m) => m.person !== me && m.id > mine && mentionsIn(m.body).includes(me));
}

/** Points sent to you that you have not pressed "Got it" on. */
export function pointsWaiting(messages: TeamMessage[], me: TeamPerson | null, acks: TeamAck[]): { message: TeamMessage; point: PointBox; url: string }[] {
  if (!me) return [];
  const out: { message: TeamMessage; point: PointBox; url: string }[] = [];
  for (const m of messages) {
    if (m.person === me) continue;
    for (const c of parseMessage(m.body).cards) {
      const p = c.point;
      if (p && p.to.includes(me) && !acks.some((a) => a.kind === "point" && a.target === p.id && a.person === me)) out.push({ message: m, point: p, url: c.url });
    }
  }
  return out;
}

/** "Waiting on me": mentions not yet seen + points not yet "Got it". A message counts once. */
export function waitingOnMe(messages: TeamMessage[], me: TeamPerson | null, marks: ReadMarks, acks: TeamAck[]): TeamMessage[] {
  const by = new Map<number, TeamMessage>();
  unseenMentions(messages, me, marks).forEach((m) => by.set(m.id, m));
  pointsWaiting(messages, me, acks).forEach((x) => by.set(x.message.id, x.message));
  return Array.from(by.values()).sort((a, b) => a.id - b.id);
}

/** Who pressed "Got it" (or "Read and understood"), in board order. */
export function ackedBy(acks: TeamAck[], kind: AckKind, target: string): TeamPerson[] {
  return TEAM_PEOPLE.filter((p) => acks.some((a) => a.kind === kind && a.target === target && a.person === p));
}

/** Add or take away one ack, without doubles. */
export function withAck(acks: TeamAck[], a: TeamAck, on: boolean): TeamAck[] {
  const rest = acks.filter((x) => !(x.kind === a.kind && x.target === a.target && x.person === a.person));
  return on ? [...rest, a] : rest;
}

export interface PatchMeta { version: string; title: string; publishedAt: string; updatedAt?: string | null; updateNote?: string | null }

/**
 * An updated patch note is news again (Leo, 24 Oct 2026: "if u update an old
 * patch notes then make sure its clear … just make it like unread … or even
 * push to front"). So a note's time is when it last changed, and its read
 * receipt is per update: "0.108@2026-10-24T01:30:00Z" once it has been updated,
 * plain "0.108" before. Reading the first version does not count for the update.
 * Only a real update counts: an "updateNote" saying what changed and an update
 * time after the publish time (older notes carry updatedAt = publishedAt).
 */
export const patchIsUpdated = (n: PatchMeta): boolean =>
  !!n.updateNote && !!n.updatedAt && (Date.parse(n.updatedAt) || 0) > (Date.parse(n.publishedAt) || 0);
export const patchTime = (n: PatchMeta): string => (patchIsUpdated(n) ? n.updatedAt! : n.publishedAt);
export const patchReadKey = (n: PatchMeta): string => (patchIsUpdated(n) ? `${n.version}@${n.updatedAt}` : n.version);
/** "Mikey's patch notes …" → Mikey. Nobody's name first → null. */
export function patchAuthor(title: string): TeamPerson | null {
  const m = /^(harry|mikey|leo)['’]s\b/i.exec((title ?? "").trim());
  return m ? proper(m[1]) : null;
}

/**
 * Patch notes a person still has to read: published on or after `from`
 * (TEAM_ROOM.patchReceiptsFrom), not their own, and not marked
 * "Read and understood".
 */
export function patchUnread(notes: PatchMeta[], person: TeamPerson, acks: TeamAck[], from: string): PatchMeta[] {
  const start = Date.parse(from) || 0;
  return notes.filter((n) => (Date.parse(patchTime(n)) || 0) >= start && patchAuthor(n.title) !== person
    && !acks.some((a) => a.kind === "patch" && a.target === patchReadKey(n) && a.person === person));
}

/** Who has read a patch note: its author counts as having read it. */
export function patchReaders(note: PatchMeta, acks: TeamAck[]): TeamPerson[] {
  const author = patchAuthor(note.title);
  const key = patchReadKey(note);
  return TEAM_PEOPLE.filter((p) => p === author || acks.some((a) => a.kind === "patch" && a.target === key && a.person === p));
}

/** The one line a reply shows of the message it answers. */
export function quoteLine(m: Pick<TeamMessage, "body" | "image_url"> | undefined, max = 90): string {
  if (!m) return "An older message";
  const p = parseMessage(m.body);
  const t = p.text.replace(/\s+/g, " ").trim()
    || (p.cards[0]?.point ? `👉 ${p.cards[0].point.n || "Pointed at a page"}` : p.cards[0] ? "🔗 A page" : m.image_url ? "📷 Picture" : "…");
  return t.length > max ? t.slice(0, max - 1) + "…" : t;
}

/** The @… or #… being typed just before the cursor, if any. */
export function typingToken(text: string, caret: number): { kind: "@" | "#"; query: string; start: number } | null {
  const before = text.slice(0, caret);
  const m = /(^|\s)([@#])([\w-]{0,30})$/.exec(before);
  if (!m) return null;
  return { kind: m[2] as "@" | "#", query: m[3].toLowerCase(), start: caret - m[3].length - 1 };
}
