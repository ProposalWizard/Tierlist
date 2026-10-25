"use client";
/**
 * components/teamRoom/ChatPage.tsx — the Team chat tab as a Slack-style
 * workspace (Harry, 23 Oct 2026: "channels with all of the tools and things
 * we already have available in team board … reactions, threads, private
 * DMs, a bot that automatically uploads patch notes into a patch notes
 * channel and @'s everyone").
 *
 *   Left        the channel list (#general, #ideas, #marketing, #context,
 *               #bugs, #patch-notes, + new ones), private DMs, @ Waiting on
 *               me, phone notifications. On a phone it is a full-screen list
 *               behind the "# channel ▾" button.
 *   Middle      the channel: Messages, its tool (the ideas board, the jobs,
 *               the marketing links, the Brain, the patch-note receipts) and
 *               📌 Pinned, as tabs under its name.
 *   Right       a thread (a message and its replies). Full screen on a phone.
 *
 * Where it opens: ?tab=chat&ch=ideas | &dm=Mikey | &m=<id> | &t=<id> | &v=<version>
 * (a phone notification lands on the message, its thread, or the patch note).
 * Channels and threads live in the message text (lib/teamRoom/channels.ts);
 * new channels, renames, reactions and DMs need team_room_v3.sql.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { TEAM_PEOPLE, TEAM_ROOM, type TeamPerson } from "@/lib/teamRoom/config";
import { stamp } from "@/lib/teamRoom/logic";
import { patchAuthor, patchReaders, quoteLine } from "@/lib/teamRoom/extras";
import {
  GENERAL, PATCH_CHANNEL, channelOf, listChannels, parentOf, pinsIn, roomUrl,
  type Channel, type ChannelTool, type RoomPlace,
} from "@/lib/teamRoom/channels";
import { addChannel, renameChannel, setAck, setChatPageOpen, setPinned, useTeamRoom } from "@/lib/teamRoom/store";
import { Av, ChatThread, RoomGate, TodoList, WaitingOnMe } from "./parts";
import { V3Note } from "./chat";
import IdeasBoard from "./IdeasBoard";
import PushToggle from "./PushToggle";
import { PATCH_META, useBotPosts, useRoomCounts } from "./roomCounts";

export interface RoomStart { place: RoomPlace; m: number | null; t: number | null; v: string | null }

export default function ChatPage({ first, onOpenPatch }: { first?: RoomStart; onOpenPatch?: (version: string) => void }) {
  useEffect(() => { setChatPageOpen(true); return () => setChatPageOpen(false); }, []);
  return <div className="tr"><RoomGate><Room first={first ?? { place: { kind: "channel", slug: GENERAL }, m: null, t: null, v: null }} onOpenPatch={onOpenPatch} /></RoomGate></div>;
}

const TOOL_TAB: Record<ChannelTool, string | null> = {
  pinned: null, none: null, ideas: "💡 Board", marketing: "🎬 Studio", context: "🧠 Brain", jobs: "✅ Jobs", patches: "📄 Receipts",
};
type Tab = "messages" | "tool" | "pins";

function Room({ first, onOpenPatch }: { first: RoomStart; onOpenPatch?: (version: string) => void }) {
  const s = useTeamRoom();
  const counts = useRoomCounts();
  const bots = useBotPosts();
  const channels = useMemo(() => listChannels(s.channelRows), [s.channelRows]);
  const startThread = (() => {
    if (first.t) return first.t;
    const m = first.m ? s.messages.find((x) => x.id === first.m) : null;
    const p = m ? parentOf(m) : null;
    return p && s.messages.some((x) => x.id === p) ? p : null;
  })();
  const [place, setPlace] = useState<RoomPlace>(first.place);
  const [thread, setThread] = useState<number | null>(startThread);
  const [jump, setJump] = useState<number | null>(first.m && !startThread ? first.m : startThread);
  const [jumpBot] = useState<string | null>(first.v ? `patch:${first.v}` : null);
  const [tab, setTab] = useState<Tab>("messages");
  const [listOpen, setListOpen] = useState(false);
  const channel: Channel | null = place.kind === "channel" ? channels.find((c) => c.slug === place.slug) ?? channels[0] : null;
  const slug = channel?.slug ?? null;

  // The workspace fills the screen below where it starts (no page scroll; the chat scrolls inside).
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const fit = () => {
      const el = box.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY;
      el.style.height = `${Math.max(420, Math.round(window.innerHeight - top - 12))}px`;
    };
    fit();
    const t = setTimeout(fit, 300);
    window.addEventListener("resize", fit);
    return () => { clearTimeout(t); window.removeEventListener("resize", fit); };
  }, []);

  // The address follows where you are, so a link (or a phone buzz) opens the same place.
  useEffect(() => {
    try { window.history.replaceState(null, "", roomUrl(place, { t: thread })); } catch { /* old browser */ }
  }, [place, thread]);

  const go = (p: RoomPlace) => { setPlace(p); setThread(null); setTab("messages"); setListOpen(false); setJump(null); };
  const openThread = (id: number) => setThread(id);
  /** Jump to any message: its channel, its thread if it is a reply. */
  const goTo = (id: number) => {
    const m = s.messages.find((x) => x.id === id);
    if (!m) return;
    const p = parentOf(m);
    const inThread = p && s.messages.some((x) => x.id === p) ? p : null;
    setPlace({ kind: "channel", slug: channelOf(m.body) }); setTab("messages"); setListOpen(false);
    setThread(inThread);
    setJump(null); setTimeout(() => setJump(inThread ?? id), 0);
  };
  const total = counts.total;
  const toolName = channel ? TOOL_TAB[channel.tool] : null;
  const pins = slug ? pinsIn(s.messages, slug) : [];

  return (
    <div className="trw" ref={box} data-thread={thread ? "true" : "false"}>
      <aside className={`ash-panel trw-list${listOpen ? " open" : ""}`} aria-label="Channels and messages">
        <ChannelList channels={channels} place={place} onGo={go} onClose={() => setListOpen(false)} goTo={goTo} />
      </aside>

      <section className="ash-panel trw-main" aria-label={channel ? `#${channel.name}` : `Private messages with ${place.kind === "dm" ? place.with : ""}`}>
        <header className="trw-head">
          <button className="trw-switch" onClick={() => setListOpen(true)} aria-label="All channels and messages" title="All channels and messages">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden><path d="M4 7h16M4 12h16M4 17h16" /></svg>
            {total > 0 && <span className="tr-badge">{total > 99 ? "99+" : total}</span>}
          </button>
          {channel ? <ChannelTitle channel={channel} /> : (
            <div className="trw-title">
              <b><Av p={(place as { with: TeamPerson }).with} sm /> {(place as { with: TeamPerson }).with} <span className="trw-lock">🔒 private</span></b>
              <small>Only you and {(place as { with: TeamPerson }).with} can read this.</small>
            </div>
          )}
          <span className={`tr-live${s.live ? " on" : ""}`} title={s.live ? "Live" : "Live link off — checking once a minute"} />
        </header>
        {channel && (
          <nav className="tr-seg trw-tabs" aria-label={`#${channel.name}`}>
            <button aria-pressed={tab === "messages"} onClick={() => setTab("messages")}>Messages</button>
            {toolName && <button aria-pressed={tab === "tool"} onClick={() => setTab("tool")}>{toolName}</button>}
            <button aria-pressed={tab === "pins"} onClick={() => setTab("pins")}>📌 {pins.length}</button>
          </nav>
        )}
        <div className="trw-body" data-tab={channel ? tab : "messages"}>
          {(!channel || tab === "messages") && (
            <ChatThread key={channel ? `c-${channel.slug}` : `d-${(place as { with: string }).with}`}
              view={channel ? { kind: "channel", slug: channel.slug } : { kind: "dm", with: (place as { with: TeamPerson }).with }}
              threads bots={bots} onThread={openThread} onOpenPatch={onOpenPatch} jumpTo={jump} jumpBot={channel?.slug === PATCH_CHANNEL ? jumpBot : null} />
          )}
          {channel && tab === "tool" && <ToolPanel tool={channel.tool} onOpenPatch={onOpenPatch} />}
          {channel && tab === "pins" && (
            <div className="trw-pad">
              {pins.length === 0 ? <p className="tr-muted">Nothing pinned in #{channel.name}. Tap a message, then 📌 Pin.</p> : pins.map((m) => (
                <div key={m.id} className="tr-pin">
                  <button className="trw-pinbtn" onClick={() => { setTab("messages"); goTo(m.id); }}>{quoteLine(m, 160)}</button>
                  <small>{m.person} · {stamp(m.created_at, Date.now())} · <button className="tr-x" style={{ padding: 0, fontSize: 11 }} onClick={() => setPinned(m.id, false)}>Unpin</button></small>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {thread && slug && (
        <section className="ash-panel trw-thread" aria-label="Thread">
          <header className="trw-head">
            <div className="trw-title"><b>Thread</b><small>in #{channel?.name}</small></div>
            <button className="tr-x trw-close" onClick={() => setThread(null)} aria-label="Close the thread">✕</button>
          </header>
          <div className="trw-body">
            <ChatThread key={`t-${thread}`} view={{ kind: "thread", slug, parent: thread }} threads autoFocus={false} />
          </div>
        </section>
      )}
    </div>
  );
}

/** "# ideas" and its topic, with ✎ to rename (needs team_room_v3.sql). */
function ChannelTitle({ channel }: { channel: Channel }) {
  const s = useTeamRoom();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(channel.name);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { setEditing(false); setName(channel.name); setErr(null); }, [channel.slug, channel.name]);
  if (editing) {
    if (s.v3 !== "on") return <div className="trw-title"><V3Note what="Renaming a channel" inline /><button className="tr-x" onClick={() => setEditing(false)}>✕</button></div>;
    const save = async () => { const r = await renameChannel(channel.slug, name); if (r.ok) setEditing(false); else setErr(r.error); };
    return (
      <div className="trw-title trw-rename">
        <span className="tr-add">
          <input value={name} maxLength={30} aria-label="New name" autoFocus onChange={(e) => { setName(e.target.value); setErr(null); }}
            onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }} />
          <button className="tr-btn" onClick={save} disabled={!name.trim()}>Save</button>
          <button className="tr-x" onClick={() => setEditing(false)} aria-label="Cancel">✕</button>
        </span>
        {err && <span className="tr-err">{err}</span>}
      </div>
    );
  }
  return (
    <div className="trw-title">
      <b><span className="trw-hash">#</span>{channel.name}
        <button className="tr-x trw-edit" onClick={() => setEditing(true)} title="Rename this channel" aria-label="Rename this channel">✎</button></b>
      <small>{channel.topic}</small>
    </div>
  );
}

function ChannelList({ channels, place, onGo, onClose, goTo }: {
  channels: Channel[]; place: RoomPlace; onGo: (p: RoomPlace) => void; onClose: () => void; goTo: (id: number) => void;
}) {
  const s = useTeamRoom();
  const counts = useRoomCounts();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const add = async () => {
    const r = await addChannel(name);
    if (r.ok) { setAdding(false); setName(""); if (r.slug) onGo({ kind: "channel", slug: r.slug }); } else setErr(r.error);
  };
  return (
    <div className="trw-lwrap">
      <div className="trw-lhead">
        <b>Team room</b>
        <span className="trw-here" title="Who's here now">
          {TEAM_PEOPLE.map((p) => <Av key={p} p={p} xs off={!s.online.includes(p)} title={`${p}${p === s.me ? " (you)" : ""}: ${s.online.includes(p) ? "here now" : "away"}`} />)}
        </span>
        <button className="tr-x trw-lclose" onClick={onClose} aria-label="Close the list">✕</button>
      </div>
      <p className="tr-lbl">Channels</p>
      {channels.map((c) => {
        const n = counts.channels[c.slug] ?? { unread: 0, mentions: 0 };
        const on = place.kind === "channel" && place.slug === c.slug;
        return (
          <button key={c.slug} className={`trw-ch${n.unread ? " unread" : ""}`} aria-current={on ? "page" : undefined} onClick={() => onGo({ kind: "channel", slug: c.slug })} title={c.topic}>
            <span className="trw-hash">#</span><span className="nm">{c.name}</span>
            {n.mentions > 0 && <span className="trw-at" title={`${n.mentions} for you`}>@{n.mentions > 1 ? n.mentions : ""}</span>}
            {n.unread > 0 && <span className="trw-n">{n.unread > 99 ? "99+" : n.unread}</span>}
          </button>
        );
      })}
      {adding ? (
        s.v3 !== "on" ? <div className="trw-addbox"><V3Note what="New channels" inline /><button className="tr-x" onClick={() => setAdding(false)}>✕</button></div> : (
          <div className="trw-addbox">
            <span className="tr-add">
              <input value={name} placeholder="new-channel" maxLength={30} aria-label="New channel name" autoFocus
                onChange={(e) => { setName(e.target.value); setErr(null); }} onKeyDown={(e) => { if (e.key === "Enter") add(); if (e.key === "Escape") setAdding(false); }} />
              <button className="tr-btn" onClick={add} disabled={!name.trim()}>Add</button>
              <button className="tr-x" onClick={() => setAdding(false)} aria-label="Cancel">✕</button>
            </span>
            {err && <span className="tr-err">{err}</span>}
          </div>
        )
      ) : <button className="trw-ch trw-addch" onClick={() => setAdding(true)}><span className="trw-hash">+</span><span className="nm">Add channel</span></button>}

      <p className="tr-lbl" style={{ marginTop: 14 }}>Direct messages <span aria-hidden>🔒</span></p>
      {TEAM_PEOPLE.filter((p) => p !== s.me).map((p) => {
        const n = counts.dms[p] ?? 0;
        const on = place.kind === "dm" && place.with === p;
        return (
          <button key={p} className={`trw-ch${n ? " unread" : ""}`} aria-current={on ? "page" : undefined} onClick={() => onGo({ kind: "dm", with: p })} title={`Private messages with ${p}`}>
            <Av p={p} sm /><span className="nm">{p}</span>
            <span className={`trw-dot${s.online.includes(p) ? " on" : ""}`} title={s.online.includes(p) ? "Here now" : "Away"} />
            {n > 0 && <span className="trw-n">{n}</span>}
          </button>
        );
      })}

      <p className="tr-lbl" style={{ marginTop: 14 }}>@ Waiting on me</p>
      <WaitingOnMe onJump={goTo} />
      <div className="trw-pushrow"><PushToggle /></div>
    </div>
  );
}

const MARKETING_LINKS = [
  { url: "/admin/marketing/studio", name: "Studio", line: "The editing suite: watch a cut, leave notes and edits for Claude" },
  { url: "/admin/marketing/uploads", name: "Uploads", line: "Put videos and pictures into private storage" },
  { url: "/admin/marketing", name: "Production board", line: "Every video and the step it is at" },
  { url: "/admin/marketing/client", name: "Knowitball client", line: "Our voice, audience, rules and best scripts" },
];

/** The tool a channel carries: the board, the jobs, the links, the Brain, the receipts. */
function ToolPanel({ tool, onOpenPatch }: { tool: ChannelTool; onOpenPatch?: (v: string) => void }) {
  if (tool === "ideas") return <div className="trw-pad"><IdeasBoard /></div>;
  if (tool === "jobs") return <div className="trw-pad trw-jobs"><TodoList visible /></div>;
  if (tool === "marketing") return (
    <div className="trw-pad trw-links">
      {MARKETING_LINKS.map((l) => (
        <a key={l.url} className="tr-pcard" href={l.url}><span className="ic" aria-hidden>🎬</span><span className="tx"><b>{l.name}</b><small>{l.line}</small></span><span className="go" aria-hidden>›</span></a>
      ))}
    </div>
  );
  if (tool === "context") return (
    <div className="trw-pad trw-links">
      <p className="tr-muted">Drop facts and rulings here as messages. They become Brain notes (brain/ in the code) when a Claude chat writes them up; later a Claude bot will propose them here for a yes or no.</p>
      <a className="tr-pcard" href="https://github.com/ProposalWizard/Tierlist/blob/main/brain/_index.md" target="_blank" rel="noreferrer">
        <span className="ic" aria-hidden>🧠</span><span className="tx"><b>The Brain&apos;s index</b><small>Every note on GitHub, one line each</small></span><span className="go" aria-hidden>↗</span>
      </a>
    </div>
  );
  if (tool === "patches") return <Receipts onOpenPatch={onOpenPatch} />;
  return null;
}

/** #patch-notes → Receipts: every patch note since the receipts started, who has read it, your button. */
function Receipts({ onOpenPatch }: { onOpenPatch?: (v: string) => void }) {
  const s = useTeamRoom();
  const start = Date.parse(TEAM_ROOM.patchReceiptsFrom) || 0;
  const notes = PATCH_META.filter((n) => (Date.parse(n.publishedAt) || 0) >= start);
  return (
    <div className="trw-pad trw-receipts">
      {notes.map((n) => {
        const readers = patchReaders(n, s.acks);
        const author = patchAuthor(n.title);
        const mine = !!s.me && readers.includes(s.me);
        return (
          <div key={n.version} className="trw-rc">
            <span className="tx"><b>v{n.version}</b><small>{n.title}</small></span>
            <span className="faces">{TEAM_PEOPLE.map((p) => <Av key={p} p={p} xs off={!readers.includes(p)} title={p === author ? `${p} wrote it` : readers.includes(p) ? `${p} has read it` : `${p} hasn't yet`} />)}</span>
            {s.me && s.me !== author && (
              <button className={`tr-btn${mine ? " ghost" : ""}`} onClick={() => setAck("patch", n.version, !mine)} title={mine ? "Take back your Read and understood" : "Say you have read and understood it"}>{mine ? "✓ Read" : "Read"}</button>
            )}
            {onOpenPatch && <button className="tr-btn ghost" onClick={() => onOpenPatch(n.version)}>Open</button>}
          </div>
        );
      })}
      {s.v2 === "off" && <p className="tr-muted">Ticks here are saved on this device only until <code>{TEAM_ROOM.sqlFileV2}</code> runs.</p>}
    </div>
  );
}
