"use client";
/**
 * components/teamRoom/chat.tsx — the Team chat (bubble and full page).
 *
 * Round two (Harry, 20 Oct 2026): seen faces under each message, Reply,
 * @ suggestions, page cards (🔗 "this page", or # to pick an admin page) and
 * points (👉: draw a box on the page, see components/teamRoom/PointLayer).
 * What a message carries lives in lib/teamRoom/extras.ts.
 *
 * Channels (Harry, 23 Oct 2026): one thread view draws a channel, a thread
 * (a message and its replies) or a private DM (lib/teamRoom/channels.ts).
 * In the Team room a channel hides thread replies and shows "N replies" on
 * the message instead; the chat bubble (no thread panel) still shows them
 * in line, quoted, as before. Reactions (👍 ✅ 👀 🔥 ❌) and DMs need
 * team_room_v3.sql; bot posts (the patch-notes bot, the jobs bot) need nothing.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ADMIN_PAGES } from "@/lib/adminRegistry";
import { TEAM_PEOPLE, TEAM_ROOM, type TeamPerson } from "@/lib/teamRoom/config";
import { stamp, type TeamMessage } from "@/lib/teamRoom/logic";
import {
  AT_BOTS, ackedBy, botMentionsIn, composeBody, parseMessage, patchAuthor, patchReaders, pointsWaiting, quoteLine, seenBy, typingToken, unseenMentions,
  type MessageCard, type ReadMarks, type TeamAck,
} from "@/lib/teamRoom/extras";
import {
  GENERAL, REACTIONS, channelOf, channelStream, parentOf, dmAsMessage, dmKey, dmsWith, jobDoneBy, jobIsFor, listChannels, mergeStream, newestIn,
  reactionsOn, rowBotPosts, threadOf, threadSummary, whoReacted,
  type BotPost, type Reaction, type StreamItem, type TeamReaction,
} from "@/lib/teamRoom/channels";
import {
  addTask, answerBotProposal, deleteDm, deleteMessage, markChannelRead, markSeen, saveStatus, sendAsk, sendDm, sendMessage, setAck, setPinned, startPointing, takeComposeDraft, tickJob, toggleReaction, useTeamRoom,
} from "@/lib/teamRoom/store";
import { ASK_ME, isReplyRow, repliesInPatch, repliesUnder, replyLinks, replyParent, replyPatch, replyText } from "@/lib/teamRoom/atBots";
import { botOwner, canAnswerProposal, isProposal, proposalState } from "@/lib/teamRoom/claudeBot";
import { COMMANDS, askOffer, askedFrom, endOfToday, parseCommand, todayLines, type Command } from "@/lib/teamRoom/asks";
import { liveStatus } from "@/lib/teamRoom/status";
import { HealthLines } from "./roomTools";
import { checkInBody } from "@/lib/teamRoom/today";
import { Av, BotFace, Linked, PAGE_NAMES, nameOfPage, siteOrigins } from "./bits";
import { PATCH_META } from "./roomCounts";
import { patchThread, patchThreadSummary } from "@/lib/teamRoom/patchBot";
import { readPrefs, setPrefs, toggleIn, useRoomPrefs } from "./roomPrefs";
import { StatusBit } from "./roomFace";
import { BugCard, useBugReport } from "./roomBugs";
import "./room.css";

const dayOf = (iso: string) => new Date(iso).toDateString();
const dayLabel = (iso: string, now: number) => {
  const d = new Date(iso);
  if (d.toDateString() === new Date(now).toDateString()) return "Today";
  if (d.toDateString() === new Date(now - 86400_000).toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" });
};

/** What the chat shows: a channel, one message's thread, or a private DM. */
export type ChatView =
  | { kind: "channel"; slug: string }
  | { kind: "thread"; slug: string; parent: number }
  /** A patch note's thread: the Patch bot's post, then every comment on that version ("[pn:0.138] …"). */
  | { kind: "patch"; slug: string; version: string }
  | { kind: "dm"; with: TeamPerson };
const GENERAL_VIEW: ChatView = { kind: "channel", slug: GENERAL };

/** The chat: messages, then the box to type in. `visible` marks it read and seen. */
export function ChatThread({ visible = true, autoFocus, jumpTo, view = GENERAL_VIEW, bots = [], threads = false, onThread, onOpenPatch, jumpBot, onPatchThread, emptyLine, sayTo }: {
  /** A bot's own page: every message typed here is put to that bot ("@Claude " goes on the front). */
  sayTo?: string;
  /** What an empty channel says: what it is for and how to use it, in one line. */
  emptyLine?: string;
  visible?: boolean; autoFocus?: boolean; jumpTo?: number | null;
  view?: ChatView;
  /** Bot posts for this channel (the patch-notes bot, the jobs bot, rows a bot wrote). */
  bots?: BotPost[];
  /** True in the Team room: replies sit in threads (onThread opens one). False in the bubble: replies show in line. */
  threads?: boolean;
  onThread?: (id: number) => void;
  /** Open a patch note in the Patch notes tab (the patch-notes bot's Open). */
  onOpenPatch?: (version: string) => void;
  /** Scroll to a bot post ("patch:0.62") when the room opens on it. */
  jumpBot?: string | null;
  /** Open a patch note's thread (the Patch bot's post: "Reply in thread", "3 replies"). */
  onPatchThread?: (version: string) => void;
}) {
  const s = useTeamRoom();
  const prefs = useRoomPrefs();
  const list = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => Date.now());
  const [zoom, setZoom] = useState<string | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [replyTo, setReplyTo] = useState<TeamMessage | null>(null);
  const [flash, setFlash] = useState<number | null>(null);
  const origins = useMemo(() => siteOrigins(), []);
  const byId = useMemo(() => new Map(s.messages.map((m) => [m.id, m])), [s.messages]);
  const slug = view.kind === "dm" ? null : view.slug;
  const isDm = view.kind === "dm";
  const dmWith = view.kind === "dm" ? view.with : null;
  const parent = view.kind === "thread" ? view.parent : null;
  const general = slug === GENERAL;

  const items: StreamItem[] = useMemo(() => {
    if (view.kind === "dm") return dmsWith(s.dms, s.me, view.with).map((d) => ({ kind: "msg" as const, at: d.created_at, m: dmAsMessage(d) }));
    // A bot's answers (and its proposal cards) sit in the thread they were asked in, in time order.
    if (view.kind === "thread") {
      const p = s.messages.find((m) => m.id === view.parent);
      return [...(p ? [{ kind: "msg" as const, at: p.created_at, m: p }] : []), ...mergeStream(threadOf(s.messages, view.parent), rowBotPosts(repliesUnder(s.botReplies, view.parent)))];
    }
    if (view.kind === "patch") {
      const post = bots.find((b) => b.key === `patch:${view.version}`);
      return [...(post ? [{ kind: "bot" as const, at: post.at, b: post }] : []), ...mergeStream(patchThread(s.messages, view.version), rowBotPosts(repliesInPatch(s.botReplies, view.version)))];
    }
    const own = threads ? channelStream(s.messages, view.slug) : s.messages.filter((m) => channelOf(m.body) === view.slug);
    // Where there is no thread panel (the chat bubble, a bot's own page) the answers show in line.
    const inline = threads ? [] : rowBotPosts(s.botReplies.filter((r) => r.channel === view.slug && !replyPatch(r)));
    return mergeStream(own, [...bots.filter((b) => b.channel === view.slug), ...inline]);
  }, [view, s.messages, s.dms, s.me, bots, threads, s.botReplies]);
  const msgCount = items.length;

  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(id); }, []);
  useLayoutEffect(() => { const el = list.current; if (el && !jumpTo && !jumpBot) el.scrollTop = el.scrollHeight; }, [msgCount, visible, jumpTo, jumpBot]);
  // Read: the open channel (its thread replies too) or DM, up to its newest message (this browser).
  useEffect(() => {
    if (!visible || !s.me) return;
    if (view.kind === "channel") {
      markChannelRead(view.slug, newestIn(s.messages, view.slug));
      // Rows a bot wrote (a Bug bot report) count as new until the channel is opened: "bot:bugs".
      const top = s.botRows.reduce((n, r) => (r.channel === view.slug && r.id > n ? r.id : n), 0);
      if (top) markChannelRead(`bot:${view.slug}`, top);
    }
    if (view.kind === "dm") { const d = dmsWith(s.dms, s.me, view.with); if (d.length) markChannelRead(dmKey(view.with), d[d.length - 1].id); }
  }, [visible, s.me, s.messages, s.dms, s.botRows, view]);

  // Seen = the message was on screen in the open #general (TEAM_ROOM.seenShare of it).
  // Seen marks are one number per person (team_room_v2.sql), so they are kept to #general.
  const onScreen = useRef(new Set<number>());
  const visRef = useRef(visible);
  visRef.current = visible && general;
  const flushSeen = useCallback(() => {
    if (!visRef.current || typeof document === "undefined" || document.visibilityState !== "visible") return;
    const top = Math.max(0, ...Array.from(onScreen.current));
    if (top > 0) markSeen(top);
  }, []);
  useEffect(() => {
    const root = list.current;
    if (!root || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const id = Number((e.target as HTMLElement).dataset.mid);
        if (e.isIntersecting && e.intersectionRatio >= TEAM_ROOM.seenShare) onScreen.current.add(id); else onScreen.current.delete(id);
      }
      flushSeen();
    }, { root, threshold: [0, TEAM_ROOM.seenShare, 1] });
    root.querySelectorAll<HTMLElement>("[data-mid]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [items, flushSeen]);
  useEffect(() => {
    flushSeen();
    document.addEventListener("visibilitychange", flushSeen);
    return () => document.removeEventListener("visibilitychange", flushSeen);
  }, [visible, s.me, flushSeen]);

  const jump = useCallback((id: number) => {
    const el = list.current?.querySelector<HTMLElement>(`[data-mid="${id}"]`);
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    setFlash(id);
    setTimeout(() => setFlash((f) => (f === id ? null : f)), 1600);
  }, []);
  useEffect(() => { if (jumpTo) setTimeout(() => jump(jumpTo), 60); }, [jumpTo, jump]);
  useEffect(() => {
    if (!jumpBot) return;
    setTimeout(() => list.current?.querySelector<HTMLElement>(`[data-bot="${CSS.escape(jumpBot)}"]`)?.scrollIntoView({ block: "center" }), 60);
  }, [jumpBot]);

  const reply = (m: TeamMessage) => {
    if (threads && onThread && view.kind === "channel") { onThread(m.id); setOpenId(null); return; }
    setReplyTo(m); setOpenId(null); setTimeout(() => document.getElementById("tr-compose")?.focus(), 0);
  };

  return (
    <div className="tr-chat">
      <div className="tr-msgs" ref={list} aria-live="polite">
        {s.v2 === "off" && general && (
          <p className="tr-v2off" title={`Run ${TEAM_ROOM.sqlFileV2} once in the Supabase SQL Editor`}>
            Seen faces and “Got it” are saved on this device only until <code>team_room_v2.sql</code> runs.
          </p>
        )}
        {isDm && s.v3 !== "on" && <V3Note what="Private messages" />}
        {items.length === 0 && !(isDm && s.v3 !== "on") && (
          <p className="tr-muted" style={{ textAlign: "center", marginTop: 30 }}>
            {isDm ? `No messages with ${dmWith} yet. Only the two of you can read this.` : view.kind === "thread" ? "That message isn't loaded any more." : emptyLine ?? "No messages yet. Say hello."}
          </p>
        )}
        {items.map((it, i) => {
          const prev = items[i - 1];
          const day = i === 0 || dayOf(it.at) !== dayOf(prev.at);
          if (it.kind === "bot") return <BotRow key={it.b.key} b={it.b} now={now} day={day} onOpenPatch={onOpenPatch} onPatchThread={view.kind === "patch" ? undefined : onPatchThread} />;
          const m = it.m;
          const isParent = parent === m.id;
          // The Team room groups a run of messages from one person (under 5 minutes apart): one face and name.
          const pm = prev?.kind === "msg" ? prev.m : null;
          const cont = threads && !day && !!pm && pm.person === m.person && (Date.parse(m.created_at) - Date.parse(pm.created_at)) < 5 * 60_000 && pm.id !== parent;
          return (
            <MessageRow key={`${isDm ? "d" : "m"}${m.id}`} m={m} me={s.me} now={now} marks={s.marks} acks={s.acks} origins={origins}
              day={day} reply={byId} flash={flash === m.id} dm={isDm} showSeen={general && !isDm}
              hideQuote={(view.kind === "thread" && !isParent) || view.kind === "patch"}
              summary={threads && view.kind === "channel" ? withBotReplies(threadSummary(s.messages, m.id), s.botReplies, m.id) : null}
              reactions={isDm ? [] : s.reactions} canReact={!isDm} v3={s.v3 === "on"} saved={prefs.later.includes(m.id)}
              alsoFrom={view.kind === "channel" && threads ? parentOf(m) : null} flat={threads} cont={cont}
              open={openId === m.id} onOpen={() => setOpenId(openId === m.id ? null : m.id)} onZoom={setZoom}
              onReply={isParent || isDm || view.kind === "patch" ? null : () => reply(m)} onThread={onThread} onJump={jump} />
          );
        })}
        {view.kind === "patch" && <span className="tr-day tr-thread-end">{items.filter((x) => x.kind === "msg").length === 0 ? "No comments yet. Say what you think." : `${items.filter((x) => x.kind === "msg").length} comment${items.filter((x) => x.kind === "msg").length === 1 ? "" : "s"}`}</span>}
        {view.kind === "thread" && items.length > 1 && <span className="tr-day tr-thread-end">{items.length - 1} repl{items.length === 2 ? "y" : "ies"}</span>}
      </div>
      {!(isDm && s.v3 !== "on") && (
        <Composer autoFocus={autoFocus} view={view} sayTo={sayTo} replyTo={view.kind === "thread" || view.kind === "patch" ? null : replyTo} onClearReply={() => setReplyTo(null)} />
      )}
      {zoom && <div className="tr-zoom" onClick={() => setZoom(null)} role="dialog" aria-label="Picture"><img src={zoom} alt="" /></div>}
    </div>
  );
}

/** "3 replies" counts a bot's answers too; its newest answer is the "last reply" when it is the latest. */
function withBotReplies(sum: ReturnType<typeof threadSummary>, replies: readonly { id: number; created_at: string; bot: string; meta?: Record<string, unknown> | null }[], parentId: number) {
  const mine = replies.filter((r) => isReplyRow(r) && !replyPatch(r) && replyParent(r) === parentId);
  if (!mine.length) return { ...sum, bots: [] as string[], lastAt: sum.last?.created_at ?? null };
  const newest = mine.reduce((a, b) => (Date.parse(b.created_at) > Date.parse(a.created_at) ? b : a));
  const lastAt = sum.last && Date.parse(sum.last.created_at) > Date.parse(newest.created_at) ? sum.last.created_at : newest.created_at;
  return { ...sum, count: sum.count + mine.length, bots: Array.from(new Set(mine.map((r) => r.bot))), lastAt };
}

/** The short "run team_room_v3.sql" note, in place of a thing that needs it. */
export function V3Note({ what, inline }: { what: string; inline?: boolean }) {
  return (
    <div role="note" className={`tr-v3note${inline ? " tight" : ""}`} title={`Run ${TEAM_ROOM.sqlFileV3} once in the Supabase SQL Editor`}>
      {what}: run <code>team_room_v3.sql</code> once in the Supabase SQL Editor first.
    </div>
  );
}

function MessageRow({ m, me, now, day, open, onOpen, onZoom, onReply, onThread, onJump, marks, acks, origins, reply, flash, dm, showSeen, hideQuote, summary, reactions, canReact, v3, saved = false, alsoFrom = null, flat = false, cont = false }: {
  m: TeamMessage; me: TeamPerson | null; now: number; day: boolean; open: boolean; onOpen: () => void; onZoom: (u: string) => void;
  onReply: (() => void) | null; onThread?: (id: number) => void; onJump: (id: number) => void; marks: ReadMarks; acks: TeamAck[]; origins: string[];
  reply: Map<number, TeamMessage> | null; flash: boolean; dm: boolean; showSeen: boolean; hideQuote: boolean;
  summary: ReturnType<typeof withBotReplies> | null; reactions: TeamReaction[]; canReact: boolean; v3: boolean;
  /** Saved for later (🔖, this device). */
  saved?: boolean;
  /** A thread reply shown in the channel ("Also send to #channel"): the message it answers. */
  alsoFrom?: number | null;
  /** The Team room: no bubbles, your own messages show your face and name too. */
  flat?: boolean;
  /** Same person as the message above, within 5 minutes: no face or name, the time shows on hover. */
  cont?: boolean;
}) {
  const mine = m.person === me;
  const [picking, setPicking] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const p = useMemo(() => parseMessage(m.body, origins), [m.body, origins]);
  const where = nameOfPage(m.page ?? "");
  const atMe = !!me && !mine && (p.mentions.includes(me) || p.cards.some((c) => c.point?.to.includes(me)));
  const seen = seenBy(m, marks);
  const others = TEAM_PEOPLE.filter((x) => x !== m.person);
  const original = p.replyTo ? reply?.get(p.replyTo) : undefined;
  const reacts = canReact ? reactionsOn(reactions, m.id) : [];
  const react = async (e: Reaction) => {
    setPicking(false);
    if (!v3) { setNote("v3"); return; }
    const r = await toggleReaction(m.id, e);
    setNote(r.ok ? null : r.error);
  };
  useEffect(() => { if (!open) { setPicking(false); setNote(null); } }, [open]);
  return (
    <>
      {day && <span className="tr-day">{dayLabel(m.created_at, now)}</span>}
      <div className={`tr-msg${mine ? " me" : ""}${atMe ? " at-me" : ""}${flash ? " flash" : ""}${cont ? " cont" : ""}`} data-mid={m.id}>
        {(!mine || flat) && !cont && <Av p={m.person} card={flat} />}
        <div className="tr-bub" data-open={open} onClick={onOpen}>
          <small>
            {(!mine || flat) && !cont && <b data-person={flat ? m.person : undefined}>{m.person}</b>}{flat && !cont && <StatusBit p={m.person} />}<span className="tm">{stamp(m.created_at, now)}</span>
            {m.page && <a className="tr-where" href={m.page} onClick={(e) => e.stopPropagation()} title={`Sent from ${m.page}`}>· {where}</a>}
            {m.pinned && <span className="tr-pinmark" title="Pinned">📌</span>}
            {dm && <span className="tr-lockmark" title="Private: only the two of you can read it">🔒</span>}
            {atMe && <span className="tr-atflag" title="You were named in this">@ you</span>}
          </small>
          {alsoFrom && p.also && (
            <span className="tr-alsoline">replied to a thread: <button onClick={(e) => { e.stopPropagation(); onThread?.(alsoFrom); }}>{quoteLine(reply?.get(alsoFrom), 50) || "open it"}</button></span>
          )}
          {p.replyTo && !hideQuote && !(alsoFrom && p.also) && (
            <button className="tr-quote" onClick={(e) => { e.stopPropagation(); onJump(p.replyTo!); }} title="Go to the message this answers">
              <b>{original?.person ?? "Reply"}</b><span>{quoteLine(original)}</span>
            </button>
          )}
          {p.text && <p><Linked text={p.text} me={me} /></p>}
          {p.cards.map((c, i) => <PageCard key={i} c={c} acks={acks} me={me} />)}
          {mine && !dm && <AskOfferRow m={m} />}
          {m.image_url && <img src={m.image_url} alt="Picture sent in the chat" loading="lazy" onClick={(e) => { e.stopPropagation(); onZoom(m.image_url!); }} />}
          {reacts.length > 0 && (
            <span className="tr-reacts" aria-label="Reactions">
              {reacts.map((x) => {
                const minePressed = !!me && x.people.includes(me);
                return (
                  <button key={x.emoji} className="tr-react" aria-pressed={minePressed} title={`${x.people.join(", ")} · tap to ${minePressed ? "take yours back" : "add yours"}`}
                    onClick={(e) => { e.stopPropagation(); react(x.emoji); }}>
                    <span aria-hidden>{x.emoji}</span><b>{x.people.length}</b>
                  </button>
                );
              })}
            </span>
          )}
          {open && reacts.length > 0 && <span className="tr-whoreact">{whoReacted(reactions, m.id)}</span>}
          {summary && summary.count > 0 && (
            <button className="tr-threadline" onClick={(e) => { e.stopPropagation(); onThread?.(m.id); }} title="Open the thread">
              <span className="faces">{summary.people.map((x) => <Av key={x} p={x} xs />)}{summary.bots.map((b) => <BotFace key={b} bot={b} className="tr-botav xs" />)}</span>
              <b>{summary.count} repl{summary.count === 1 ? "y" : "ies"}</b>
              <span>last reply {summary.lastAt ? stamp(summary.lastAt, now) : ""}</span>
            </button>
          )}
          {showSeen && (
            <span className="tr-seen" title={seen.length ? `Seen by ${seen.join(" and ")}` : "Not seen yet"} aria-label={seen.length ? `Seen by ${seen.join(" and ")}` : "Not seen yet"}>
              {others.map((x) => <Av key={x} p={x} xs off={!seen.includes(x)} title={seen.includes(x) ? `${x} has seen it` : `${x} hasn't seen it yet`} />)}
            </span>
          )}
          {picking && (
            <span className="tr-picker" role="group" aria-label="React">
              {REACTIONS.map((e) => <button key={e} onClick={(ev) => { ev.stopPropagation(); react(e); }} aria-label={`React ${e}`}>{e}</button>)}
            </span>
          )}
          {note && (note === "v3" ? <V3Note what="Reactions" inline /> : <span className="tr-err">{note}</span>)}
          {/* In the Team room a computer shows 😀 💬 🔖 ⋯ on hover (class "hv"); a tap (or ⋯) shows every action in line, with words. */}
          <span className="tr-acts">
            {canReact && <button className="hv" onClick={(e) => { e.stopPropagation(); setPicking(!picking); }} title="React: 👍 ✅ 👀 🔥 ❌" aria-label="React" aria-expanded={picking}>🙂<span className="t">React</span></button>}
            {onReply && <button className="hv" onClick={(e) => { e.stopPropagation(); onReply(); }} title={onThread ? "Reply in a thread" : "Reply to this message"} aria-label={onThread ? "Reply in a thread" : "Reply"}>{onThread ? "💬" : "↩"}<span className="t">{onThread ? "Reply in thread" : "Reply"}</span></button>}
            {!dm && <button className="hv" onClick={(e) => { e.stopPropagation(); setPrefs({ later: toggleIn(readPrefs().later, m.id) }); }} title={saved ? "Take it off Later" : "Save for later (Activity → Later)"} aria-label={saved ? "Saved for later" : "Save for later"} aria-pressed={saved}>🔖<span className="t">{saved ? "Saved" : "Save for later"}</span></button>}
            {!dm && <button onClick={(e) => { e.stopPropagation(); setPinned(m.id, !m.pinned); }} title={m.pinned ? "Unpin" : "Pin it for the team"}>📌<span className="t">{m.pinned ? "Unpin" : "Pin"}</span></button>}
            {!dm && me && <button onClick={async (e) => { e.stopPropagation(); const r = await addTask(`${quoteLine(m, 150)} (from ${m.person}, message ${m.id})`, me); setNote(r.ok ? "Added to your tasks in #todo." : r.error); }} title="Make it a task in #todo">✓<span className="t">Make a task</span></button>}
            {!dm && <button onClick={async (e) => { e.stopPropagation(); try { await navigator.clipboard.writeText(`${window.location.origin}${TEAM_ROOM.home}?tab=chat${channelOf(m.body) !== GENERAL ? `&ch=${channelOf(m.body)}` : ""}&m=${m.id}`); setNote("Link copied."); } catch { setNote("Could not copy here."); } }} title="Copy a link to this message">🔗<span className="t">Copy link</span></button>}
            {mine && <button onClick={(e) => { e.stopPropagation(); if (dm) deleteDm(m.id); else deleteMessage(m.id); }} title="Delete your message">🗑<span className="t">Delete</span></button>}
            <button className="hv more" onClick={(e) => { e.stopPropagation(); onOpen(); }} title={open ? "Close" : "More: pin, task, copy link, delete"} aria-label="More">{open ? "✕" : "⋯"}<span className="t">{open ? "Close" : "More"}</span></button>
          </span>
        </div>
      </div>
    </>
  );
}

/**
 * Under your own message that @'s someone with a job in it ("@Mikey do X"):
 * one faint button, "＋ Add as task for Mikey". It lands in their to-do as a
 * proposal they Accept or Decline (lib/teamRoom/asks.ts). Once sent, it says so.
 */
function AskOfferRow({ m }: { m: TeamMessage }) {
  const s = useTeamRoom();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const offer = useMemo(() => askOffer(m), [m]);
  if (!offer) return null;
  const sent = askedFrom(s.tasks, m.id);
  const left = offer.to.filter((p) => !sent.includes(p));
  const send = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setBusy(true); setErr(null);
    for (const p of left) { const r = await sendAsk(p, offer.title, m.id); if (!r.ok) { setErr(r.error); break; } }
    setBusy(false);
  };
  return (
    <span className="tr-askrow">
      {left.length > 0 && <button className="tr-askbtn" disabled={busy} onClick={send} title={`"${offer.title}" goes to their to-do as a proposal: they Accept or Decline`}>＋ Add as task for {left.join(" and ")}</button>}
      {sent.length > 0 && <span className="tr-asksent">✓ Sent to {sent.join(" and ")}&apos;s to-do</span>}
      {err && <span className="tr-err">{err}</span>}
    </span>
  );
}

/** /today: one line per person, above the message box. */
function TodayPanel({ onClose }: { onClose: () => void }) {
  const s = useTeamRoom();
  const lines = todayLines({ tasks: s.tasks, statusOf: (p) => { const l = liveStatus(s.statuses[p], new Date()); return [l.emoji, l.text].filter(Boolean).join(" ") || null; } });
  return (
    <div className="tr-today" role="status">
      <p className="tr-lbl">Today<button className="tr-x" onClick={onClose} aria-label="Close">✕</button></p>
      {lines.map((l) => (
        <div key={l.person} className="tr-todayrow">
          <Av p={l.person} sm />
          <span><b>{l.person}</b> <small>{l.status}</small><br /><small>{l.open === 0 ? "no open jobs" : `${l.open} open job${l.open === 1 ? "" : "s"}${l.first ? ` · newest: ${l.first}` : ""}`}</small></span>
        </div>
      ))}
    </div>
  );
}

/** A bot's post: the patch-notes bot (@everyone, read receipts), the jobs bot (✅ ticks the job), or a row a bot wrote. */
function BotRow({ b, now, day, onOpenPatch, onPatchThread }: { b: BotPost; now: number; day: boolean; onOpenPatch?: (v: string) => void; onPatchThread?: (version: string) => void }) {
  const s = useTeamRoom();
  const me = s.me;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const meta = b.version ? PATCH_META.find((n) => n.version === b.version) : undefined;
  const job = b.jobId ? s.jobs.find((j) => j.id === b.jobId) : undefined;
  const readers = meta ? patchReaders(meta, s.acks) : [];
  const author = meta ? patchAuthor(meta.title) : null;
  const done = job ? jobDoneBy(s.tasks, job.id) : [];
  // The Patch bot's thread: comments on this version (or, for a reminder, on the note it is about).
  const threadVersion = b.version ?? b.threadOf;
  const thread = threadVersion && onPatchThread ? patchThreadSummary(s.messages, threadVersion) : null;
  // The Bug bot's post is a report card (roomBugs.tsx).
  const bug = useBugReport(b.bot === "bug" ? b.postId : undefined);
  // An answer in a thread, or a person's bot's card ("This needs Harry's Claude. Send it?").
  const row = { meta: b.meta ?? null, bot: b.bot };
  const reply = b.meta?.kind === "reply";
  const card = isProposal(row) ? { state: proposalState(row), owner: botOwner(b.bot), mine: canAnswerProposal({ ...row, meta: { ...row.meta, state: "waiting" } }, me) } : null;
  const run = async (f: () => Promise<{ ok: boolean; error?: string }>) => {
    setBusy(true); setErr(null);
    const r = await f();
    setBusy(false);
    if (!r.ok) setErr(r.error ?? "Not saved.");
  };
  return (
    <>
      {day && <span className="tr-day">{dayLabel(b.at, now)}</span>}
      <div className="tr-msg tr-botmsg" data-bot={b.key}>
        <BotFace bot={b.bot} />
        <div className="tr-bub tr-botbub">
          <small><b>{b.meta?.from_claude ? `${String(b.meta.from_claude)}'s Claude` : b.bot === "patch-notes" ? "Patch bot" : b.name}</b><span className="tr-bottag">{b.meta?.from_claude ? "VIA BOT" : "BOT"}</span><span>{stamp(b.at, now)}</span>
            {b.archived && <span className="tr-archived" title="Everyone has read it, so it moved here from #general">archived</span>}
            {b.pending && <span className="tr-archived" title="The site posts it within 15 minutes (or when one of us next opens an admin page)">posting…</span>}
          </small>
          {reply ? (<>
            <p className="tr-botreply"><Linked text={replyText({ body: b.body, meta: b.meta })} me={me} /></p>
            {Array.isArray(b.meta?.lines) && <HealthLines row={{ body: b.body.split("\n").slice(1).join("\n"), meta: b.meta ?? null }} />}
            {replyLinks({ meta: b.meta }).length > 0 && <span className="tr-botfoot">{replyLinks({ meta: b.meta }).map((l) => <a key={l.url} className="tr-btn ghost" href={l.url}>{l.label}</a>)}</span>}
          </>) : card ? (
            <div className="tr-propose" data-state={card.state} data-proposal={b.postId}>
              <p className="tr-bott">This needs {card.owner}&apos;s Claude. {card.state === "waiting" ? "Send it?" : ""}</p>
              <p className="tr-botb">{String(b.meta?.by ?? "Someone")} asked: “{String(b.meta?.question ?? "")}” · Why: {String(b.meta?.why ?? "it needs more than a quick answer")}.</p>
              {card.state === "waiting" && (card.mine ? (
                <span className="tr-botfoot">
                  <button className="tr-btn" disabled={busy} onClick={() => run(() => answerBotProposal(b.postId!, true))}>Accept</button>
                  <button className="tr-btn ghost" disabled={busy} onClick={() => run(() => answerBotProposal(b.postId!, false))}>Decline</button>
                  <small>Accept puts one job in your to-do for your own Claude chat. Nothing is changed by the bot.</small>
                </span>
              ) : <p className="tr-propstate">Waiting for {card.owner}. Only {card.owner} can press Accept or Decline.</p>)}
              {card.state === "declined" && <p className="tr-propstate">Declined by {card.owner}. Nothing was sent.</p>}
              {(card.state === "accepted" || card.state === "picked") && (<>
                <p className="tr-propstate ok">Sent to {card.owner}&apos;s Claude · waiting. {card.state === "picked" ? `${card.owner}'s Claude chat has taken it.` : `It is in ${card.owner}'s to-do, and ${card.owner}'s Claude will pick it up in ${card.owner === me ? "your" : "their"} next chat.`}</p>
                {card.mine && typeof b.meta?.prompt === "string" && <span className="tr-botfoot"><CopyText text={b.meta.prompt} label="Copy for my Claude" /></span>}
              </>)}
              {card.state === "done" && <p className="tr-propstate ok">Done: {card.owner}&apos;s Claude replied below.</p>}
            </div>
          ) : bug ? <BugCard report={bug} /> : b.bot === "health" ? (<>
            <p className="tr-bott">{b.title}</p>
            <HealthLines row={{ body: b.body, meta: b.meta ?? null }} />
          </>) : (<>
            <p className="tr-bott">{b.everyone && <span className="tr-everyone">@everyone</span>} {b.title}</p>
            {b.body && <p className="tr-botb"><Linked text={b.body} me={me} /></p>}
            {b.mentions && b.mentions.length > 0 && !b.archived && (
              <p className="tr-botask">{b.mentions.map((p) => <span key={p} className={`tr-at${p === me ? " me" : ""}`}>@{p}</span>)} please review.</p>
            )}
          </>)}
          {meta && (
            <span className="tr-botfoot">
              <span className="faces" title={`Read by ${readers.join(", ") || "nobody yet"}`}>
                {TEAM_PEOPLE.map((p) => <Av key={p} p={p} xs off={!readers.includes(p)} title={p === author ? `${p} wrote it` : readers.includes(p) ? `${p} has read it` : `${p} hasn't yet`} />)}
              </span>
              {me && me !== author && (
                <button className={`tr-btn${readers.includes(me) ? " ghost" : ""}`} disabled={busy}
                  onClick={() => run(() => setAck("patch", meta.version, !readers.includes(me)))}>
                  {readers.includes(me) ? "✓ Read and understood" : "Read and understood"}
                </button>
              )}
              {onOpenPatch ? <button className="tr-btn ghost" onClick={() => onOpenPatch(meta.version)}>Open</button>
                : b.url && <a className="tr-btn ghost" href={b.url}>Open</a>}
              {onPatchThread && thread && thread.count === 0 && <button className="tr-btn ghost" onClick={() => onPatchThread(meta.version)} title="Comment on this patch note in its thread">💬 Reply in thread</button>}
            </span>
          )}
          {thread && thread.count > 0 && (
            <button className="tr-threadline" onClick={() => onPatchThread!(threadVersion!)} title="Open the thread">
              <span className="faces">{thread.people.map((x) => <Av key={x} p={x} xs />)}</span>
              <b>{thread.count} repl{thread.count === 1 ? "y" : "ies"}</b>
              <span>last reply {thread.last ? stamp(thread.last.created_at, now) : ""}</span>
            </button>
          )}
          {job && (
            <span className="tr-botfoot">
              <span className="faces" title={`Done: ${done.join(", ") || "nobody yet"}`}>
                {(job.owner === "all" ? TEAM_PEOPLE : [job.owner]).map((p) => <Av key={p} p={p} xs off={!done.includes(p)} title={done.includes(p) ? `${p}: done` : `${p}: not yet`} />)}
              </span>
              {jobIsFor(job, me) && me && (
                <button className={`tr-btn${done.includes(me) ? " ghost" : ""}`} disabled={busy} title="✅ ticks this job in your To-do"
                  onClick={() => run(() => tickJob(job, !done.includes(me)))}>
                  {done.includes(me) ? "✅ Done" : "✅ Mark done"}
                </button>
              )}
              {b.url && <a className="tr-btn ghost" href={b.url}>To-do</a>}
            </span>
          )}
          {!meta && !job && !bug && !reply && !card && b.url && <span className="tr-botfoot"><a className="tr-btn ghost" href={b.url}>Open</a></span>}
          {err && <span className="tr-err">{err}</span>}
        </div>
      </div>
    </>
  );
}

/** A small copy button (the text for your own Claude chat). */
function CopyText({ text, label }: { text: string; label: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  return (
    <button className="tr-btn ghost" onClick={async () => { try { await navigator.clipboard.writeText(text); setState("copied"); } catch { setState("failed"); } setTimeout(() => setState("idle"), 2200); }}>
      {state === "copied" ? "✓ Copied" : state === "failed" ? "Could not copy here" : label}
    </button>
  );
}

/** A link to one of the site's pages, as a card. A point also shows its note and who has pressed Got it. */
function PageCard({ c, acks, me }: { c: MessageCard; acks: TeamAck[]; me: TeamPerson | null }) {
  const pt = c.point;
  const name = pt?.pn || nameOfPage(c.path);
  const got = pt ? ackedBy(acks, "point", pt.id) : [];
  return (
    <a className={`tr-pcard${pt ? " point" : ""}`} href={c.url} onClick={(e) => e.stopPropagation()} title={pt ? `Open ${name} and see the part ${pt.by} pointed at` : `Open ${name}`}>
      <span className="ic" aria-hidden>{pt ? "👉" : "🔗"}</span>
      <span className="tx">
        <b>{name}</b>
        {pt?.n && <span className="nt">“{pt.n}”</span>}
        <small>{pt ? `For ${pt.to.join(" and ") || "the team"} · tap to see it on the page` : c.path}</small>
        {pt && (
          <span className="got">
            {pt.to.map((x) => <span key={x} className={`g${got.includes(x) ? " on" : ""}`}><Av p={x} xs off={!got.includes(x)} />{got.includes(x) ? "Got it" : x === me ? "Waiting on you" : "Not yet"}</span>)}
          </span>
        )}
      </span>
      <span className="go" aria-hidden>›</span>
    </a>
  );
}

type Attach = { url: string; name: string };
const PAGES = ADMIN_PAGES.map((p) => ({ url: p.url, name: p.name })).concat([{ url: "/admin/team", name: "Team board" }, { url: "/admin/patch-notes", name: "Patch notes" }])
  .filter((p, i, a) => a.findIndex((x) => x.url === p.url) === i);

/** What each bot is for, under its name in the @ list. */
const BOT_HINT: Record<string, string> = {
  "patch-notes": "ask for patch notes", bug: "players' bug reports", health: "the site's limits now", today: "who has checked in", jobs: "your open jobs",
  claude: "ask a question", "harry-bot": "Harry's helper", "mikey-bot": "Mikey's helper", "leo-bot": "Leo's helper",
};

function Composer({ autoFocus, replyTo, onClearReply, view, sayTo }: { autoFocus?: boolean; replyTo: TeamMessage | null; onClearReply: () => void; view: ChatView; sayTo?: string }) {
  const s = useTeamRoom();
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [links, setLinks] = useState<Attach[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [caret, setCaret] = useState(0);
  const [pick, setPick] = useState(0);
  const [also, setAlso] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const isDm = view.kind === "dm";
  const chName = view.kind === "dm" ? "" : listChannels(s.channelRows).find((c) => c.slug === view.slug)?.name ?? view.slug;
  const placeholder = sayTo ? `Ask ${sayTo.slice(1)}` : view.kind === "dm" ? `Message ${view.with}` : view.kind === "thread" ? "Reply in the thread" : view.kind === "patch" ? `Comment on v${view.version}` : `Message #${chName}`;

  const [hide, setHide] = useState(false);
  const tok = hide ? null : typingToken(text, caret);
  const people = tok?.kind === "@" ? TEAM_PEOPLE.filter((p) => p !== s.me && p.toLowerCase().startsWith(tok.query)) : [];
  // Bots you can @ (not in a private DM: a bot never reads those). "@pat", "@patch b" and "@bot" all find Patch bot.
  const botList = tok?.kind === "@" && view.kind !== "dm" && !sayTo
    ? AT_BOTS.filter((b) => { const n = b.name.toLowerCase(); return n.startsWith(tok.query) || n.replace(/\s/g, "").startsWith(tok.query.replace(/\s/g, "")) || n.split(" ").some((w) => tok.query.length > 0 && w.startsWith(tok.query)); })
    : [];
  const pages = tok?.kind === "#" ? PAGES.filter((p) => p.name.toLowerCase().includes(tok.query) || p.url.toLowerCase().includes(tok.query)).slice(0, tok.query ? 6 : 8) : [];
  const options: { key: string; label: string; sub?: string; bot?: string }[] = tok?.kind === "@"
    ? [...people.map((p) => ({ key: p, label: p })), ...botList.map((b) => ({ key: b.bot, label: b.name, sub: BOT_HINT[b.bot], bot: b.bot }))]
    : pages.map((p) => ({ key: p.url, label: p.name, sub: p.url }));
  // An "Ask me" example on a bot's page lands here once ("@Patch bot latest").
  useEffect(() => {
    if (view.kind !== "channel") return;
    const d = takeComposeDraft();
    if (!d) return;
    setText(d); setCaret(d.length);
    requestAnimationFrame(() => { box.current?.focus(); box.current?.setSelectionRange(d.length, d.length); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => setPick(0), [tok?.kind, tok?.query]);

  const resize = (el: HTMLTextAreaElement) => { el.style.height = "auto"; el.style.height = `${Math.min(120, el.scrollHeight)}px`; };
  const choose = (i: number) => {
    if (!tok) return;
    const end = tok.start + 1 + tok.query.length;
    if (tok.kind === "@") {
      const name = options[i]?.label;
      if (!name) return;
      const next = `${text.slice(0, tok.start)}@${name} ${text.slice(end)}`;
      setText(next);
      const at = tok.start + name.length + 2;
      requestAnimationFrame(() => { box.current?.setSelectionRange(at, at); setCaret(at); box.current?.focus(); });
    } else {
      const pg = pages[i];
      if (!pg) return;
      setText(`${text.slice(0, tok.start)}${text.slice(end)}`.replace(/ {2,}/g, " "));
      setLinks((l) => (l.some((x) => x.url === pg.url) ? l : [...l, { url: pg.url, name: pg.name }]));
      requestAnimationFrame(() => { box.current?.setSelectionRange(tok.start, tok.start); setCaret(tok.start); box.current?.focus(); });
    }
  };
  const addThisPage = () => {
    // In the Team room itself (the full chat on a phone) "this page" is the chat:
    // open the page list instead (Harry, 21 Oct 2026: link a page didn't work on mobile).
    if (window.location.pathname.startsWith(TEAM_ROOM.home)) {
      const at = box.current?.selectionStart ?? text.length;
      const next = `${text.slice(0, at)}${at > 0 && !/\s$/.test(text.slice(0, at)) ? " " : ""}#${text.slice(at)}`;
      const caretAt = next.length - (text.length - at);
      setText(next); setHide(false); setCaret(caretAt);
      requestAnimationFrame(() => { box.current?.focus(); box.current?.setSelectionRange(caretAt, caretAt); setCaret(caretAt); });
      return;
    }
    const url = (window.location.pathname + window.location.search).slice(0, 190);
    const name = nameOfPage(window.location.pathname) || document.title;
    setLinks((l) => (l.some((x) => x.url === url) ? l : [...l, { url, name }]));
  };

  const [today, setToday] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const said = (t: string) => { setDone(t); setTimeout(() => setDone((d) => (d === t ? null : d)), 3500); };
  /** A line that starts with /todo, /today or /show is a command: nothing is posted in the chat. */
  const runCommand = async (c: Command): Promise<{ ok: true } | { ok: false; error: string }> => {
    if (c.kind === "show") { said("/show (record your screen for the team) is coming soon. Until then: Admin home → Videos."); return { ok: true }; }
    if (c.kind === "today-show") { setToday(true); return { ok: true }; }
    if (c.kind === "today-set") {
      // /today words: your check-in for the day (a message in #today) and your status until midnight.
      const sent = await sendMessage(checkInBody(c.text), null, "/admin/team?tab=chat&ch=today");
      if (!sent.ok) return sent;
      const r = await saveStatus({ text: c.text, clear_at: endOfToday(Date.now()) });
      said(`Checked in for today in #today${r.ok ? ", and your status is set until midnight" : ""}: ${c.text}`);
      return { ok: true };
    }
    if (c.kind === "todo-open") { window.location.assign(`${TEAM_ROOM.home}?tab=chat&ch=todo`); return { ok: true }; }
    if (c.kind === "todo-add") { const r = await addTask(c.title, s.me); if (r.ok) said("Added to your to-do."); return r; }
    for (const p of c.to) { const r = await sendAsk(p, c.title); if (!r.ok) return r; }
    said(`Sent to ${c.to.join(" and ")}'s to-do as a proposal.`);
    return { ok: true };
  };
  const send = async () => {
    if (busy || (!text.trim() && !file && links.length === 0)) return;
    setBusy(true); setErr(null);
    let r: { ok: true } | { ok: false; error: string };
    const command = !file && links.length === 0 ? parseCommand(text, s.me) : null;
    if (command) {
      r = await runCommand(command);
    } else if (view.kind === "dm") {
      r = await sendDm(view.with, composeBody(text, { links: links.map((l) => l.url) }));
    } else {
      const to = view.kind === "thread" ? view.parent : replyTo?.id;
      // A patch note's thread lives in #general's messages whatever channel its post shows in.
      // On a bot's own page every message is put to that bot.
      const words = sayTo && !botMentionsIn(text).length ? `${sayTo} ${text}` : text;
      const body = view.kind === "patch" ? composeBody(words, { links: links.map((l) => l.url), patch: view.version })
        : composeBody(words, { replyTo: to, links: links.map((l) => l.url), channel: view.slug, also: view.kind === "thread" && also });
      r = await sendMessage(body, file, typeof window === "undefined" ? null : window.location.pathname + window.location.search);
    }
    setBusy(false);
    if (r.ok) { setText(""); setFile(null); setLinks([]); setAlso(false); onClearReply(); if (box.current) box.current.style.height = "auto"; } else setErr(r.error);
  };
  const canSend = !busy && (!!text.trim() || !!file || links.length > 0);
  return (
    <div className="tr-composer">
      {options.length > 0 && (
        <div className="tr-suggest" role="listbox" aria-label={tok?.kind === "@" ? "Who to mention" : "Pages to link"}>
          <p className="tr-lbl">{tok?.kind === "@" ? "Mention" : "Link a page"}</p>
          {options.map((o, i) => (
            <button key={o.key} role="option" aria-selected={i === pick} className={i === pick ? "on" : ""}
              onPointerDown={(e) => e.preventDefault()} onClick={() => choose(i)}>
              {o.bot ? <BotFace bot={o.bot} className="tr-botav sm" /> : tok?.kind === "@" ? <Av p={o.key as TeamPerson} sm /> : <span className="ic">🔗</span>}
              <span>{o.label}{o.bot && <span className="tr-bottag">BOT</span>}{o.sub ? <small>{o.sub}</small> : null}</span>
            </button>
          ))}
        </div>
      )}
      {today && <TodayPanel onClose={() => setToday(false)} />}
      {done && <p className="tr-cmddone" role="status">{done}</p>}
      {sayTo && !text && (
        <div className="tr-sugg" aria-label="Things you can ask">
          {(ASK_ME[AT_BOTS.find((b) => `@${b.name}` === sayTo)?.bot ?? ""] ?? ASK_ME.claude).slice(0, 3).map((x) => (
            <button key={x.say} title={x.gets} onClick={() => { setText(x.say); setCaret(x.say.length); requestAnimationFrame(() => box.current?.focus()); }}>{x.say}</button>
          ))}
        </div>
      )}
      {view.kind === "channel" && !sayTo && !text && !replyTo && (
        <div className="tr-sugg" aria-label="Commands you can type">
          {COMMANDS.map((c) => (
            <button key={c.cmd} title={c.soon ? `${c.hint} (soon)` : c.hint} className={c.soon ? "soon" : ""}
              onClick={() => { setText(`${c.cmd} `); setHide(false); requestAnimationFrame(() => { box.current?.focus(); const n = c.cmd.length + 1; box.current?.setSelectionRange(n, n); setCaret(n); }); }}>
              {c.cmd}{c.soon && <small> soon</small>}
            </button>
          ))}
        </div>
      )}
      {replyTo && (
        <div className="tr-replying">
          <span>Replying to <b>{replyTo.person}</b>: {quoteLine(replyTo, 70)}</span>
          <button className="tr-x" onClick={onClearReply} aria-label="Stop replying">✕</button>
        </div>
      )}
      {links.map((l) => (
        <div key={l.url} className="tr-attach"><span className="ic">🔗</span><span><b>{l.name}</b> <small>{l.url}</small></span>
          <button className="tr-x" onClick={() => setLinks((x) => x.filter((y) => y.url !== l.url))} aria-label={`Remove the link to ${l.name}`}>✕</button></div>
      ))}
      {file && preview && (
        <div className="tr-attach"><img src={preview} alt="" /><span>Picture ready to send</span><button className="tr-x" onClick={() => setFile(null)} aria-label="Remove the picture">✕</button></div>
      )}
      <div className="tr-compose">
        {!isDm && (
          <button className="tr-iconbtn" onClick={() => fileRef.current?.click()} title="Add a picture" aria-label="Add a picture">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="10" r="1.8" /><path d="m21 16-5-5-8 8" /></svg>
          </button>
        )}
        <button className="tr-iconbtn" onClick={addThisPage} title="Link this page (in the Team room: pick a page; or type # anywhere)" aria-label="Link this page">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></svg>
        </button>
        {!isDm && (
          <button className="tr-iconbtn" onClick={() => startPointing()} disabled={!s.me} title="Point at part of this page (Shift+X)" aria-label="Point at part of this page">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden><path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4" /><circle cx="12" cy="12" r="2.4" /></svg>
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { setFile(e.target.files?.[0] ?? null); e.target.value = ""; }} />
        <textarea id={view.kind === "thread" || view.kind === "patch" ? "tr-compose-thread" : "tr-compose"} ref={box} rows={1} value={text} autoFocus={autoFocus} placeholder={placeholder} aria-label={placeholder.replace(/… @ or #$|…$/, "")}
          onChange={(e) => { setText(e.target.value); setHide(false); setCaret(e.target.selectionStart ?? e.target.value.length); resize(e.target); }}
          onSelect={(e) => setCaret((e.target as HTMLTextAreaElement).selectionStart ?? 0)}
          onPaste={(e) => { if (isDm) return; const f = Array.from(e.clipboardData.files).find((x) => x.type.startsWith("image/")); if (f) { e.preventDefault(); setFile(f); } }}
          onKeyDown={(e) => {
            if (options.length > 0) {
              if (e.key === "ArrowDown") { e.preventDefault(); setPick((pick + 1) % options.length); return; }
              if (e.key === "ArrowUp") { e.preventDefault(); setPick((pick + options.length - 1) % options.length); return; }
              if ((e.key === "Enter" || e.key === "Tab") && !e.shiftKey) { e.preventDefault(); choose(pick); return; }
              if (e.key === "Escape") { e.preventDefault(); setHide(true); return; }
            }
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); }
          }} />
        <button className="tr-send" onClick={send} disabled={!canSend}>{busy ? "…" : "Send"}</button>
      </div>
      {view.kind === "thread" && (
        <label className="tr-also"><input type="checkbox" checked={also} onChange={(e) => setAlso(e.target.checked)} /> Also send to #{chName}</label>
      )}
      {err && <p className="tr-err" style={{ padding: "0 12px 8px" }}>{err}</p>}
    </div>
  );
}

/** "Waiting on me": messages that name you you haven't seen, and points you haven't said Got it to. */
export function WaitingOnMe({ onJump }: { onJump?: (id: number) => void }) {
  const s = useTeamRoom();
  const mentions = unseenMentions(s.messages, s.me, s.marks);
  const points = pointsWaiting(s.messages, s.me, s.acks);
  if (!s.me) return null;
  if (mentions.length === 0 && points.length === 0) return <p className="tr-muted">Nothing waiting on you.</p>;
  return (
    <div className="tr-waiting">
      {points.map((x) => (
        <a key={`p${x.point.id}`} className="tr-wait" href={x.url} title="Open the page and see it">
          <Av p={x.message.person} sm /><span><b>👉 {x.point.pn ?? "A page"}</b><small>{x.point.n || "Pointed at part of a page"}</small></span>
        </a>
      ))}
      {mentions.filter((m) => !points.some((x) => x.message.id === m.id)).map((m) => (
        <button key={`m${m.id}`} className="tr-wait" onClick={() => onJump?.(m.id)} title="Go to the message">
          <Av p={m.person} sm /><span><b>@ from {m.person}{channelOf(m.body) !== GENERAL ? ` in #${channelOf(m.body)}` : ""}</b><small>{quoteLine(m, 60)}</small></span>
        </button>
      ))}
    </div>
  );
}

export { PAGE_NAMES };
