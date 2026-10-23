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
  ackedBy, composeBody, parseMessage, patchAuthor, patchReaders, pointsWaiting, quoteLine, seenBy, typingToken, unseenMentions,
  type MessageCard, type ReadMarks, type TeamAck,
} from "@/lib/teamRoom/extras";
import {
  GENERAL, REACTIONS, channelOf, channelStream, dmAsMessage, dmKey, dmsWith, jobDoneBy, jobIsFor, listChannels, mergeStream, newestIn,
  reactionsOn, threadOf, threadSummary, whoReacted,
  type BotPost, type Reaction, type StreamItem, type TeamReaction,
} from "@/lib/teamRoom/channels";
import {
  deleteDm, deleteMessage, markChannelRead, markSeen, sendDm, sendMessage, setAck, setPinned, startPointing, tickJob, toggleReaction, useTeamRoom,
} from "@/lib/teamRoom/store";
import { Av, Linked, PAGE_NAMES, nameOfPage, siteOrigins } from "./bits";
import { PATCH_META } from "./roomCounts";

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
  | { kind: "dm"; with: TeamPerson };
const GENERAL_VIEW: ChatView = { kind: "channel", slug: GENERAL };

/** The chat: messages, then the box to type in. `visible` marks it read and seen. */
export function ChatThread({ visible = true, autoFocus, jumpTo, view = GENERAL_VIEW, bots = [], threads = false, onThread, onOpenPatch, jumpBot }: {
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
}) {
  const s = useTeamRoom();
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
    if (view.kind === "thread") {
      const p = s.messages.find((m) => m.id === view.parent);
      return [...(p ? [p] : []), ...threadOf(s.messages, view.parent)].map((m) => ({ kind: "msg" as const, at: m.created_at, m }));
    }
    const own = threads ? channelStream(s.messages, view.slug) : s.messages.filter((m) => channelOf(m.body) === view.slug);
    return mergeStream(own, bots.filter((b) => b.channel === view.slug));
  }, [view, s.messages, s.dms, s.me, bots, threads]);
  const msgCount = items.length;

  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(id); }, []);
  useLayoutEffect(() => { const el = list.current; if (el && !jumpTo && !jumpBot) el.scrollTop = el.scrollHeight; }, [msgCount, visible, jumpTo, jumpBot]);
  // Read: the open channel (its thread replies too) or DM, up to its newest message (this browser).
  useEffect(() => {
    if (!visible || !s.me) return;
    if (view.kind === "channel") markChannelRead(view.slug, newestIn(s.messages, view.slug));
    if (view.kind === "dm") { const d = dmsWith(s.dms, s.me, view.with); if (d.length) markChannelRead(dmKey(view.with), d[d.length - 1].id); }
  }, [visible, s.me, s.messages, s.dms, view]);

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
            {isDm ? `No messages with ${dmWith} yet. Only the two of you can read this.` : view.kind === "thread" ? "That message isn't loaded any more." : "No messages yet. Say hello."}
          </p>
        )}
        {items.map((it, i) => {
          const prev = items[i - 1];
          const day = i === 0 || dayOf(it.at) !== dayOf(prev.at);
          if (it.kind === "bot") return <BotRow key={it.b.key} b={it.b} now={now} day={day} onOpenPatch={onOpenPatch} />;
          const m = it.m;
          const isParent = parent === m.id;
          return (
            <MessageRow key={`${isDm ? "d" : "m"}${m.id}`} m={m} me={s.me} now={now} marks={s.marks} acks={s.acks} origins={origins}
              day={day} reply={byId} flash={flash === m.id} dm={isDm} showSeen={general && !isDm}
              hideQuote={view.kind === "thread" && !isParent}
              summary={threads && view.kind === "channel" ? threadSummary(s.messages, m.id) : null}
              reactions={isDm ? [] : s.reactions} canReact={!isDm} v3={s.v3 === "on"}
              open={openId === m.id} onOpen={() => setOpenId(openId === m.id ? null : m.id)} onZoom={setZoom}
              onReply={isParent || isDm ? null : () => reply(m)} onThread={onThread} onJump={jump} />
          );
        })}
        {view.kind === "thread" && items.length > 1 && <span className="tr-day tr-thread-end">{items.length - 1} repl{items.length === 2 ? "y" : "ies"}</span>}
      </div>
      {!(isDm && s.v3 !== "on") && (
        <Composer autoFocus={autoFocus} view={view} replyTo={view.kind === "thread" ? null : replyTo} onClearReply={() => setReplyTo(null)} />
      )}
      {zoom && <div className="tr-zoom" onClick={() => setZoom(null)} role="dialog" aria-label="Picture"><img src={zoom} alt="" /></div>}
    </div>
  );
}

/** The short "run team_room_v3.sql" note, in place of a thing that needs it. */
export function V3Note({ what, inline }: { what: string; inline?: boolean }) {
  return (
    <p className={`tr-v3note${inline ? " inline" : ""}`} title={`Run ${TEAM_ROOM.sqlFileV3} once in the Supabase SQL Editor`}>
      {what} need <code>team_room_v3.sql</code>. Run it once in the Supabase SQL Editor.
    </p>
  );
}

function MessageRow({ m, me, now, day, open, onOpen, onZoom, onReply, onThread, onJump, marks, acks, origins, reply, flash, dm, showSeen, hideQuote, summary, reactions, canReact, v3 }: {
  m: TeamMessage; me: TeamPerson | null; now: number; day: boolean; open: boolean; onOpen: () => void; onZoom: (u: string) => void;
  onReply: (() => void) | null; onThread?: (id: number) => void; onJump: (id: number) => void; marks: ReadMarks; acks: TeamAck[]; origins: string[];
  reply: Map<number, TeamMessage> | null; flash: boolean; dm: boolean; showSeen: boolean; hideQuote: boolean;
  summary: ReturnType<typeof threadSummary> | null; reactions: TeamReaction[]; canReact: boolean; v3: boolean;
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
      <div className={`tr-msg${mine ? " me" : ""}${atMe ? " at-me" : ""}${flash ? " flash" : ""}`} data-mid={m.id}>
        {!mine && <Av p={m.person} />}
        <div className="tr-bub" data-open={open} onClick={onOpen}>
          <small>
            {!mine && <b>{m.person}</b>}<span>{stamp(m.created_at, now)}</span>
            {m.page && <a className="tr-where" href={m.page} onClick={(e) => e.stopPropagation()} title={`Sent from ${m.page}`}>· {where}</a>}
            {m.pinned && <span className="tr-pinmark" title="Pinned">📌</span>}
            {dm && <span className="tr-lockmark" title="Private: only the two of you can read it">🔒</span>}
            {atMe && <span className="tr-atflag" title="You were named in this">@ you</span>}
          </small>
          {p.replyTo && !hideQuote && (
            <button className="tr-quote" onClick={(e) => { e.stopPropagation(); onJump(p.replyTo!); }} title="Go to the message this answers">
              <b>{original?.person ?? "Reply"}</b><span>{quoteLine(original)}</span>
            </button>
          )}
          {p.text && <p><Linked text={p.text} me={me} /></p>}
          {p.cards.map((c, i) => <PageCard key={i} c={c} acks={acks} me={me} />)}
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
              <span className="faces">{summary.people.map((x) => <Av key={x} p={x} xs />)}</span>
              <b>{summary.count} repl{summary.count === 1 ? "y" : "ies"}</b>
              <span>last reply {summary.last ? stamp(summary.last.created_at, now) : ""}</span>
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
          <span className="tr-acts">
            {canReact && <button onClick={(e) => { e.stopPropagation(); setPicking(!picking); }} title="React: 👍 ✅ 👀 🔥 ❌" aria-expanded={picking}>🙂 React</button>}
            {onReply && <button onClick={(e) => { e.stopPropagation(); onReply(); }} title={onThread ? "Reply in a thread" : "Reply to this message"}>↩ Reply</button>}
            {!dm && <button onClick={(e) => { e.stopPropagation(); setPinned(m.id, !m.pinned); }} title={m.pinned ? "Unpin" : "Pin it for the team"}>{m.pinned ? "Unpin" : "📌 Pin"}</button>}
            {mine && <button onClick={(e) => { e.stopPropagation(); if (dm) deleteDm(m.id); else deleteMessage(m.id); }} title="Delete your message">Delete</button>}
          </span>
        </div>
      </div>
    </>
  );
}

/** A bot's post: the patch-notes bot (@everyone, read receipts), the jobs bot (✅ ticks the job), or a row a bot wrote. */
function BotRow({ b, now, day, onOpenPatch }: { b: BotPost; now: number; day: boolean; onOpenPatch?: (v: string) => void }) {
  const s = useTeamRoom();
  const me = s.me;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const meta = b.version ? PATCH_META.find((n) => n.version === b.version) : undefined;
  const job = b.jobId ? s.jobs.find((j) => j.id === b.jobId) : undefined;
  const readers = meta ? patchReaders(meta, s.acks) : [];
  const author = meta ? patchAuthor(meta.title) : null;
  const done = job ? jobDoneBy(s.tasks, job.id) : [];
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
        <span className="tr-botav" aria-hidden>{b.bot === "patch-notes" ? "📣" : b.bot === "jobs" ? "🧰" : "🤖"}</span>
        <div className="tr-bub tr-botbub">
          <small><b>{b.name}</b><span className="tr-bottag">BOT</span><span>{stamp(b.at, now)}</span></small>
          <p className="tr-bott">{b.everyone && <span className="tr-everyone">@everyone</span>} {b.title}</p>
          {b.body && <p className="tr-botb">{b.body}</p>}
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
            </span>
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
          {!meta && !job && b.url && <span className="tr-botfoot"><a className="tr-btn ghost" href={b.url}>Open</a></span>}
          {err && <span className="tr-err">{err}</span>}
        </div>
      </div>
    </>
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

function Composer({ autoFocus, replyTo, onClearReply, view }: { autoFocus?: boolean; replyTo: TeamMessage | null; onClearReply: () => void; view: ChatView }) {
  const s = useTeamRoom();
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [links, setLinks] = useState<Attach[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [caret, setCaret] = useState(0);
  const [pick, setPick] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const isDm = view.kind === "dm";
  const chName = view.kind === "dm" ? "" : listChannels(s.channelRows).find((c) => c.slug === view.slug)?.name ?? view.slug;
  const placeholder = view.kind === "dm" ? `Message ${view.with} (only you two)…` : view.kind === "thread" ? "Reply in the thread… @ or #" : `Message #${chName}… @ or #`;

  const [hide, setHide] = useState(false);
  const tok = hide ? null : typingToken(text, caret);
  const people = tok?.kind === "@" ? TEAM_PEOPLE.filter((p) => p !== s.me && p.toLowerCase().startsWith(tok.query)) : [];
  const pages = tok?.kind === "#" ? PAGES.filter((p) => p.name.toLowerCase().includes(tok.query) || p.url.toLowerCase().includes(tok.query)).slice(0, tok.query ? 6 : 8) : [];
  const options = tok?.kind === "@" ? people.map((p) => ({ key: p, label: p })) : pages.map((p) => ({ key: p.url, label: p.name, sub: p.url }));
  useEffect(() => setPick(0), [tok?.kind, tok?.query]);

  const resize = (el: HTMLTextAreaElement) => { el.style.height = "auto"; el.style.height = `${Math.min(120, el.scrollHeight)}px`; };
  const choose = (i: number) => {
    if (!tok) return;
    const end = tok.start + 1 + tok.query.length;
    if (tok.kind === "@") {
      const name = people[i];
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

  const send = async () => {
    if (busy || (!text.trim() && !file && links.length === 0)) return;
    setBusy(true); setErr(null);
    let r: { ok: true } | { ok: false; error: string };
    if (view.kind === "dm") {
      r = await sendDm(view.with, composeBody(text, { links: links.map((l) => l.url) }));
    } else {
      const to = view.kind === "thread" ? view.parent : replyTo?.id;
      const body = composeBody(text, { replyTo: to, links: links.map((l) => l.url), channel: view.slug });
      r = await sendMessage(body, file, typeof window === "undefined" ? null : window.location.pathname + window.location.search);
    }
    setBusy(false);
    if (r.ok) { setText(""); setFile(null); setLinks([]); onClearReply(); if (box.current) box.current.style.height = "auto"; } else setErr(r.error);
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
              {tok?.kind === "@" ? <Av p={o.key as TeamPerson} sm /> : <span className="ic">🔗</span>}
              <span>{o.label}{"sub" in o && o.sub ? <small>{o.sub}</small> : null}</span>
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
        <textarea id={view.kind === "thread" ? "tr-compose-thread" : "tr-compose"} ref={box} rows={1} value={text} autoFocus={autoFocus} placeholder={placeholder} aria-label={placeholder.replace(/… @ or #$|…$/, "")}
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
