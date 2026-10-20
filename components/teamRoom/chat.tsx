"use client";
/**
 * components/teamRoom/chat.tsx — the Team chat (bubble and full page).
 *
 * Round two (Harry, 20 Oct 2026): seen faces under each message, Reply,
 * @ suggestions, page cards (🔗 "this page", or # to pick an admin page) and
 * points (👉: draw a box on the page, see components/teamRoom/PointLayer).
 * What a message carries lives in lib/teamRoom/extras.ts.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ADMIN_PAGES } from "@/lib/adminRegistry";
import { TEAM_PEOPLE, TEAM_ROOM, type TeamPerson } from "@/lib/teamRoom/config";
import { stamp, type TeamMessage } from "@/lib/teamRoom/logic";
import {
  ackedBy, composeBody, parseMessage, pointsWaiting, quoteLine, seenBy, typingToken, unseenMentions,
  type MessageCard, type ReadMarks, type TeamAck,
} from "@/lib/teamRoom/extras";
import { deleteMessage, markRead, markSeen, sendMessage, setPinned, startPointing, useTeamRoom } from "@/lib/teamRoom/store";
import { Av, Linked, PAGE_NAMES, nameOfPage, siteOrigins } from "./bits";

const dayOf = (iso: string) => new Date(iso).toDateString();
const dayLabel = (iso: string, now: number) => {
  const d = new Date(iso);
  if (d.toDateString() === new Date(now).toDateString()) return "Today";
  if (d.toDateString() === new Date(now - 86400_000).toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" });
};

/** The chat: messages, then the box to type in. `visible` marks it read and seen. */
export function ChatThread({ visible = true, autoFocus, jumpTo }: { visible?: boolean; autoFocus?: boolean; jumpTo?: number | null }) {
  const s = useTeamRoom();
  const list = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => Date.now());
  const [zoom, setZoom] = useState<string | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [replyTo, setReplyTo] = useState<TeamMessage | null>(null);
  const [flash, setFlash] = useState<number | null>(null);
  const origins = useMemo(() => siteOrigins(), []);
  const byId = useMemo(() => new Map(s.messages.map((m) => [m.id, m])), [s.messages]);
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(id); }, []);
  useLayoutEffect(() => { const el = list.current; if (el && !jumpTo) el.scrollTop = el.scrollHeight; }, [s.messages.length, visible, jumpTo]);
  useEffect(() => { if (visible && s.me) markRead("chat"); }, [visible, s.me, s.messages.length]);

  // Seen = the message was on screen in the open chat (TEAM_ROOM.seenShare of it).
  const onScreen = useRef(new Set<number>());
  const visRef = useRef(visible);
  visRef.current = visible;
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
  }, [s.messages, flushSeen]);
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

  return (
    <div className="tr-chat">
      <div className="tr-msgs" ref={list} aria-live="polite">
        {s.v2 === "off" && (
          <p className="tr-v2off" title={`Run ${TEAM_ROOM.sqlFileV2} once in the Supabase SQL Editor`}>
            Seen faces and “Got it” are saved on this device only until <code>team_room_v2.sql</code> runs.
          </p>
        )}
        {s.messages.length === 0 && <p className="tr-muted" style={{ textAlign: "center", marginTop: 30 }}>No messages yet. Say hello.</p>}
        {s.messages.map((m, i) => (
          <MessageRow key={m.id} m={m} me={s.me} now={now} marks={s.marks} acks={s.acks} origins={origins}
            day={i === 0 || dayOf(m.created_at) !== dayOf(s.messages[i - 1].created_at)}
            reply={m.body.startsWith("[re:") ? byId : null} flash={flash === m.id}
            open={openId === m.id} onOpen={() => setOpenId(openId === m.id ? null : m.id)} onZoom={setZoom}
            onReply={() => { setReplyTo(m); setOpenId(null); setTimeout(() => document.getElementById("tr-compose")?.focus(), 0); }}
            onJump={jump} />
        ))}
      </div>
      <Composer autoFocus={autoFocus} replyTo={replyTo} onClearReply={() => setReplyTo(null)} />
      {zoom && <div className="tr-zoom" onClick={() => setZoom(null)} role="dialog" aria-label="Picture"><img src={zoom} alt="" /></div>}
    </div>
  );
}

function MessageRow({ m, me, now, day, open, onOpen, onZoom, onReply, onJump, marks, acks, origins, reply, flash }: {
  m: TeamMessage; me: TeamPerson | null; now: number; day: boolean; open: boolean; onOpen: () => void; onZoom: (u: string) => void;
  onReply: () => void; onJump: (id: number) => void; marks: ReadMarks; acks: TeamAck[]; origins: string[];
  reply: Map<number, TeamMessage> | null; flash: boolean;
}) {
  const mine = m.person === me;
  const p = useMemo(() => parseMessage(m.body, origins), [m.body, origins]);
  const where = nameOfPage(m.page ?? "");
  const atMe = !!me && !mine && (p.mentions.includes(me) || p.cards.some((c) => c.point?.to.includes(me)));
  const seen = seenBy(m, marks);
  const others = TEAM_PEOPLE.filter((x) => x !== m.person);
  const original = p.replyTo ? reply?.get(p.replyTo) : undefined;
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
            {atMe && <span className="tr-atflag" title="You were named in this">@ you</span>}
          </small>
          {p.replyTo && (
            <button className="tr-quote" onClick={(e) => { e.stopPropagation(); onJump(p.replyTo!); }} title="Go to the message this answers">
              <b>{original?.person ?? "Reply"}</b><span>{quoteLine(original)}</span>
            </button>
          )}
          {p.text && <p><Linked text={p.text} me={me} /></p>}
          {p.cards.map((c, i) => <PageCard key={i} c={c} acks={acks} me={me} />)}
          {m.image_url && <img src={m.image_url} alt="Picture sent in the chat" loading="lazy" onClick={(e) => { e.stopPropagation(); onZoom(m.image_url!); }} />}
          <span className="tr-seen" title={seen.length ? `Seen by ${seen.join(" and ")}` : "Not seen yet"} aria-label={seen.length ? `Seen by ${seen.join(" and ")}` : "Not seen yet"}>
            {others.map((x) => <Av key={x} p={x} xs off={!seen.includes(x)} title={seen.includes(x) ? `${x} has seen it` : `${x} hasn't seen it yet`} />)}
          </span>
          <span className="tr-acts">
            <button onClick={(e) => { e.stopPropagation(); onReply(); }} title="Reply to this message">↩ Reply</button>
            <button onClick={(e) => { e.stopPropagation(); setPinned(m.id, !m.pinned); }} title={m.pinned ? "Unpin" : "Pin it for the team"}>{m.pinned ? "Unpin" : "📌 Pin"}</button>
            {mine && <button onClick={(e) => { e.stopPropagation(); deleteMessage(m.id); }} title="Delete your message">Delete</button>}
          </span>
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

function Composer({ autoFocus, replyTo, onClearReply }: { autoFocus?: boolean; replyTo: TeamMessage | null; onClearReply: () => void }) {
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

  const [hide, setHide] = useState(false);
  const tok = hide ? null : typingToken(text, caret);
  const people = tok?.kind === "@" ? TEAM_PEOPLE.filter((p) => p !== s.me && p.toLowerCase().startsWith(tok.query)) : [];
  const pages = tok?.kind === "#" ? PAGES.filter((p) => p.name.toLowerCase().includes(tok.query) || p.url.toLowerCase().includes(tok.query)).slice(0, 6) : [];
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
    const url = (window.location.pathname + window.location.search).slice(0, 190);
    const name = nameOfPage(window.location.pathname) || document.title;
    setLinks((l) => (l.some((x) => x.url === url) ? l : [...l, { url, name }]));
  };

  const send = async () => {
    if (busy || (!text.trim() && !file && links.length === 0)) return;
    setBusy(true); setErr(null);
    const body = composeBody(text, { replyTo: replyTo?.id, links: links.map((l) => l.url) });
    const r = await sendMessage(body, file, typeof window === "undefined" ? null : window.location.pathname + window.location.search);
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
        <button className="tr-iconbtn" onClick={() => fileRef.current?.click()} title="Add a picture" aria-label="Add a picture">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="10" r="1.8" /><path d="m21 16-5-5-8 8" /></svg>
        </button>
        <button className="tr-iconbtn" onClick={addThisPage} title="Link this page (or type # to pick one)" aria-label="Link this page">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></svg>
        </button>
        <button className="tr-iconbtn" onClick={() => startPointing()} disabled={!s.me} title="Point at part of this page (Shift+X)" aria-label="Point at part of this page">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden><path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4" /><circle cx="12" cy="12" r="2.4" /></svg>
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { setFile(e.target.files?.[0] ?? null); e.target.value = ""; }} />
        <textarea id="tr-compose" ref={box} rows={1} value={text} autoFocus={autoFocus} placeholder="Message… @ or #" aria-label="Message the team"
          onChange={(e) => { setText(e.target.value); setHide(false); setCaret(e.target.selectionStart ?? e.target.value.length); resize(e.target); }}
          onSelect={(e) => setCaret((e.target as HTMLTextAreaElement).selectionStart ?? 0)}
          onPaste={(e) => { const f = Array.from(e.clipboardData.files).find((x) => x.type.startsWith("image/")); if (f) { e.preventDefault(); setFile(f); } }}
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
          <Av p={m.person} sm /><span><b>@ from {m.person}</b><small>{quoteLine(m, 60)}</small></span>
        </button>
      ))}
    </div>
  );
}

export { PAGE_NAMES };
