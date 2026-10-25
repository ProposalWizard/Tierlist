"use client";
/**
 * components/teamRoom/ChatPage.tsx — the Team room, Slack's layout in our
 * colours (Harry, 25 Oct 2026: "I think it's already better than what we
 * have, so we may as well make it already"). The plan page's U0–U14.
 *
 *   Left    the channel list, 220 px (drag its edge 180–320; double-click =
 *           220). « in its header (or Ctrl/⌘+Shift+D) closes it; ⌂ » in the
 *           chat's header opens it again. Remembered per device. ⌂ = back
 *           to the admin home. NO admin icon column inside the room.
 *           Search ⌘K, Activity, Later, Tasks, Starred, Channels (9 presets
 *           + new ones), Direct messages, Bots.
 *   Middle  the channel: header (# name, topic, faces, 🔔, ⋯), tabs
 *           (Messages | its tool | 📌 Pinned), messages, the box.
 *   Right   a thread, 380 px (drag 320–560). Esc closes it.
 *   Phone   the chat fills the screen; ☰ (or a swipe from the left edge)
 *           slides the list over 80% (at most 300 px); ✕, a tap on the dark
 *           strip or a swipe left closes it. Bottom tabs: Home · DMs ·
 *           Activity · You.
 *
 * Red number = only @mentions and DMs. Other new messages = bold name.
 * Where it opens: ?tab=chat&ch=ideas | &dm=Mikey | &m=<id> | &t=<id> | &v=<version>.
 */
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { TEAM_PEOPLE, TEAM_ROOM, type TeamPerson } from "@/lib/teamRoom/config";
import { stamp, tasksFor } from "@/lib/teamRoom/logic";
import { quoteLine } from "@/lib/teamRoom/extras";
import { pushedFor } from "@/lib/teamRoom/jobs";
import {
  GENERAL, PATCH_CHANNEL, channelOf, listChannels, parentOf, pinsIn, roomUrl,
  type BotPost, type Channel, type RoomPlace,
} from "@/lib/teamRoom/channels";
import { addChannel, renameChannel, setChatPageOpen, setPinned, useTeamRoom } from "@/lib/teamRoom/store";
import { Av, ChatThread, RoomGate } from "./parts";
import { V3Note } from "./chat";
import { useBotPosts, useRoomCounts } from "./roomCounts";
import { TOOL_TAB, ToolPanel } from "./roomTools";
import { ActivityPanel, DmsPanel, JumpBox, LaterPanel, YouPanel } from "./roomPanels";
import { PersonFace } from "./roomFace";
import { LIST_W, THREAD_W, clamp, setPrefs, toggleIn, useRoomPrefs } from "./roomPrefs";
import "./teamRoom.css";
import "./room.css";

export type RoomTab = "messages" | "tool" | "pins";
export interface RoomStart { place: RoomPlace; m: number | null; t: number | null; v: string | null; tab?: RoomTab }
/** A screen in the middle that is not a channel or a DM. */
export type RoomView = "activity" | "later" | "you" | "dms";
type Where = RoomPlace | { kind: "view"; view: RoomView };

export default function ChatPage({ first, onOpenPatch, homeHref = TEAM_ROOM.home, onHome }: {
  first?: RoomStart; onOpenPatch?: (version: string) => void;
  /** ⌂: back to the admin home (the Team board). */
  homeHref?: string; onHome?: () => void;
}) {
  useEffect(() => { setChatPageOpen(true); return () => setChatPageOpen(false); }, []);
  return (
    <div className="tr trr-host">
      <RoomGate>
        <Room first={first ?? { place: { kind: "channel", slug: GENERAL }, m: null, t: null, v: null }} onOpenPatch={onOpenPatch} homeHref={homeHref} onHome={onHome} />
      </RoomGate>
    </div>
  );
}

/** True while the window is at most `px` wide. */
function useMaxWidth(px: number) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const q = window.matchMedia(`(max-width: ${px}px)`);
    const f = () => setOn(q.matches);
    f(); q.addEventListener("change", f);
    return () => q.removeEventListener("change", f);
  }, [px]);
  return on;
}

/** The list's edge (or the thread's): drag to resize, double-click for the starting width. */
function DragEdge({ value, range, onChange, side, label }: {
  value: number; range: { start: number; min: number; max: number }; onChange: (w: number) => void; side: "list" | "thread"; label: string;
}) {
  const start = useRef<{ x: number; w: number } | null>(null);
  return (
    <div className={`trr-edge ${side}`} role="separator" aria-orientation="vertical" aria-label={label} title={`${label} · double-click: back to ${range.start} px`}
      aria-valuemin={range.min} aria-valuemax={range.max} aria-valuenow={value} tabIndex={0}
      onPointerDown={(e) => { start.current = { x: e.clientX, w: value }; (e.target as HTMLElement).setPointerCapture(e.pointerId); }}
      onPointerMove={(e) => {
        if (!start.current) return;
        const dx = e.clientX - start.current.x;
        onChange(clamp(start.current.w + (side === "list" ? dx : -dx), range.min, range.max));
      }}
      onPointerUp={() => { start.current = null; }} onPointerCancel={() => { start.current = null; }}
      onDoubleClick={() => onChange(range.start)}
      onKeyDown={(e) => {
        const step = e.key === "ArrowLeft" ? -10 : e.key === "ArrowRight" ? 10 : 0;
        if (step) { e.preventDefault(); onChange(clamp(value + (side === "list" ? step : -step), range.min, range.max)); }
      }} />
  );
}

function Room({ first, onOpenPatch, homeHref, onHome }: { first: RoomStart; onOpenPatch?: (version: string) => void; homeHref: string; onHome?: () => void }) {
  const s = useTeamRoom();
  const counts = useRoomCounts();
  const bots = useBotPosts();
  const prefs = useRoomPrefs();
  const narrow = useMaxWidth(900);
  const phone = useMaxWidth(760);
  const channels = useMemo(() => listChannels(s.channelRows), [s.channelRows]);
  const startThread = (() => {
    if (first.t) return first.t;
    const m = first.m ? s.messages.find((x) => x.id === first.m) : null;
    const p = m ? parentOf(m) : null;
    return p && s.messages.some((x) => x.id === p) ? p : null;
  })();
  const [where, setWhere] = useState<Where>(first.place);
  const [thread, setThread] = useState<number | null>(startThread);
  const [jump, setJump] = useState<number | null>(first.m && !startThread ? first.m : startThread);
  const [jumpBot] = useState<string | null>(first.v ? `patch:${first.v}` : null);
  const [tab, setTab] = useState<RoomTab>(first.tab ?? "messages");
  const [drawer, setDrawer] = useState(false);
  const [jumper, setJumper] = useState(false);
  // Drag widths live here while dragging, saved when the drag settles.
  const [listW, setListW] = useState<number | null>(null);
  const [threadW, setThreadW] = useState<number | null>(null);
  const place: RoomPlace | null = where.kind === "view" ? null : where;
  const channel: Channel | null = place?.kind === "channel" ? channels.find((c) => c.slug === place.slug) ?? channels[0] : null;
  const slug = channel?.slug ?? null;
  // On a computer the list follows the saved setting; under 900 px it lays over the chat when open.
  const listShown = narrow ? drawer : prefs.listOpen;

  useEffect(() => {
    if (!place) return;
    try { window.history.replaceState(null, "", roomUrl(place, { t: thread })); } catch { /* old browser */ }
  }, [place, thread]);

  const closeDrawer = () => setDrawer(false);
  const go = (w: Where) => { setWhere(w); setThread(null); setTab("messages"); setDrawer(false); setJump(null); };
  const goTo = useCallback((id: number) => {
    const m = s.messages.find((x) => x.id === id);
    if (!m) return;
    const p = parentOf(m);
    const inThread = p && s.messages.some((x) => x.id === p) ? p : null;
    setWhere({ kind: "channel", slug: channelOf(m.body) }); setTab("messages"); setDrawer(false);
    setThread(inThread);
    setJump(null); setTimeout(() => setJump(inThread ?? id), 0);
  }, [s.messages]);
  const toggleList = useCallback(() => {
    if (narrow) setDrawer((d) => !d); else setPrefs({ listOpen: !prefs.listOpen });
  }, [narrow, prefs.listOpen]);

  // Keys (same as Slack): Ctrl/⌘+Shift+D list in and out, Ctrl/⌘+K jump, Esc closes.
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.shiftKey && (e.key === "d" || e.key === "D")) { e.preventDefault(); toggleList(); return; }
      if (mod && !e.shiftKey && (e.key === "k" || e.key === "K")) { e.preventDefault(); setJumper(true); return; }
      if (e.key === "Escape") {
        if (jumper) { setJumper(false); return; }
        if (drawer) { setDrawer(false); return; }
        const typing = (e.target as HTMLElement | null)?.closest?.("textarea, input");
        if (thread && !typing) setThread(null);
      }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [toggleList, jumper, drawer, thread]);

  // Phone: a swipe right from the left edge opens the list; a swipe left on it closes it.
  const touch = useRef<{ x: number; y: number; edge: boolean } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => { const t = e.touches[0]; touch.current = { x: t.clientX, y: t.clientY, edge: t.clientX < 24 }; };
  const onTouchEnd = (e: React.TouchEvent) => {
    const st = touch.current; touch.current = null;
    if (!st || !narrow) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - st.x, dy = Math.abs(t.clientY - st.y);
    if (dy > 50) return;
    if (!drawer && st.edge && dx > 60) setDrawer(true);
    if (drawer && dx < -60) setDrawer(false);
  };

  const toolName = channel ? TOOL_TAB[channel.tool] : null;
  const pins = slug ? pinsIn(s.messages, slug) : [];
  const chBots = channel ? botsIn(bots, channel.slug) : 0;
  const forYou = counts.mentions;
  const w = listW ?? prefs.listW;
  const tw = threadW ?? prefs.threadW;
  const homeBtn = onHome
    ? <button className="trr-home" onClick={onHome} title="Back to the admin home" aria-label="Back to the admin home"><HomeIcon /></button>
    : <Link className="trr-home" href={homeHref} title="Back to the admin home" aria-label="Back to the admin home"><HomeIcon /></Link>;
  const view = where.kind === "view" ? where.view : null;

  return (
    <div className="trr" data-list={listShown ? "open" : "closed"} data-narrow={narrow} data-phone={phone} data-thread={thread && slug ? "true" : "false"}
      data-density={prefs.density} style={{ ["--trr-list" as string]: `${w}px`, ["--trr-thread" as string]: `${tw}px` }}
      onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {narrow && drawer && <div className="trr-scrim" onClick={closeDrawer} aria-hidden />}
      <aside className="trr-list" aria-label="Channels and messages" aria-hidden={!listShown}>
        <ChannelList channels={channels} where={where} onGo={go} homeBtn={homeBtn} narrow={narrow}
          onClose={() => (narrow ? setDrawer(false) : setPrefs({ listOpen: false }))} onSearch={() => setJumper(true)} />
      </aside>
      {!narrow && listShown && <DragEdge value={w} range={LIST_W} side="list" label="Channel list width"
        onChange={(n) => { setListW(n); setPrefs({ listW: n }); }} />}

      <section className="trr-main" aria-label={channel ? `#${channel.name}` : place?.kind === "dm" ? `Private messages with ${place.with}` : "Team room"}>
        <header className="trr-head">
          {(narrow || !listShown) && (
            <span className="trr-open">
              {!phone && homeBtn}
              <button className="trr-iconbtn" onClick={toggleList} aria-label="Open the channel list" title="Open the channel list (Ctrl/⌘+Shift+D)">
                {narrow ? <MenuIcon /> : <span aria-hidden className="trr-chev">»</span>}
                {forYou > 0 && narrow && <span className="tr-badge">{forYou > 99 ? "99+" : forYou}</span>}
              </button>
            </span>
          )}
          {channel ? <ChannelTitle channel={channel} />
            : place?.kind === "dm" ? (
              <div className="trr-title">
                <b><Av p={place.with} sm /> {place.with} <span className="trw-lock">🔒 private</span></b>
                <small>Only you and {place.with} can read this.</small>
              </div>
            ) : <div className="trr-title"><b>{VIEW_NAME[view!]}</b><small>{VIEW_LINE[view!]}</small></div>}
          {channel && (
            <span className="trr-members" title={`Everyone is in every channel: Harry, Mikey and Leo${chBots ? `, plus ${chBots} bot${chBots === 1 ? "" : "s"} posting here` : ""}`}>
              <span className="faces">{TEAM_PEOPLE.map((p) => <Av key={p} p={p} xs off={!s.online.includes(p)} />)}</span>
              <small>3{chBots ? ` · ${chBots} bot${chBots === 1 ? "" : "s"}` : ""}</small>
            </span>
          )}
          {channel && <ChannelMenu channel={channel} />}
          <span className={`tr-live${s.live ? " on" : ""}`} title={s.live ? "Live" : "Live link off: checking once a minute"} />
        </header>
        {channel && (
          <nav className="trr-tabs" aria-label={`#${channel.name}`}>
            <button aria-pressed={tab === "messages"} onClick={() => setTab("messages")}>Messages</button>
            {toolName && <button aria-pressed={tab === "tool"} onClick={() => setTab("tool")}>{toolName}</button>}
            <button aria-pressed={tab === "pins"} onClick={() => setTab("pins")}>📌 Pinned{pins.length ? ` ${pins.length}` : ""}</button>
          </nav>
        )}
        <div className="trw-body" data-tab={channel ? tab : view ? "tool" : "messages"}>
          {place && (!channel || tab === "messages") && (
            <ChatThread key={channel ? `c-${channel.slug}` : `d-${(place as { with: string }).with}`}
              view={channel ? { kind: "channel", slug: channel.slug } : { kind: "dm", with: (place as { with: TeamPerson }).with }}
              threads bots={bots} onThread={setThread} onOpenPatch={onOpenPatch} jumpTo={jump} jumpBot={channel?.slug === PATCH_CHANNEL ? jumpBot : null} />
          )}
          {channel && tab === "tool" && <ToolPanel tool={channel.tool} onOpenPatch={onOpenPatch} />}
          {channel && tab === "pins" && (
            <div className="trw-pad">
              {pins.length === 0 ? <p className="tr-muted">Nothing pinned in #{channel.name}. Hover a message (tap on a phone), then 📌 Pin.</p> : pins.map((m) => (
                <div key={m.id} className="tr-pin">
                  <button className="trw-pinbtn" onClick={() => { setTab("messages"); goTo(m.id); }}>{quoteLine(m, 160)}</button>
                  <small>{m.person} · {stamp(m.created_at, Date.now())} · <button className="tr-x" style={{ padding: 0, fontSize: 11 }} onClick={() => setPinned(m.id, false)}>Unpin</button></small>
                </div>
              ))}
            </div>
          )}
          {view === "activity" && <ActivityPanel onJump={goTo} onDm={(p) => go({ kind: "dm", with: p })} />}
          {view === "later" && <LaterPanel onJump={goTo} />}
          {view === "you" && <YouPanel />}
          {view === "dms" && <DmsPanel onGo={(p) => go({ kind: "dm", with: p })} />}
        </div>
      </section>

      {thread && slug && (<>
        {!phone && <DragEdge value={tw} range={THREAD_W} side="thread" label="Thread width" onChange={(n) => { setThreadW(n); setPrefs({ threadW: n }); }} />}
        <section className="trr-thread" aria-label="Thread">
          <header className="trr-head">
            <div className="trr-title"><b>Thread</b><small># {channel?.name}</small></div>
            <button className="tr-x trw-close" onClick={() => setThread(null)} aria-label="Close the thread" title="Close the thread (Esc)">✕</button>
          </header>
          <div className="trw-body">
            <ChatThread key={`t-${thread}`} view={{ kind: "thread", slug, parent: thread }} threads autoFocus={false} />
          </div>
        </section>
      </>)}

      {phone && (
        <nav className="trr-bottom" aria-label="Team room">
          <BottomTab on={!!place && place.kind === "channel" && !drawer} label="Home" icon={<HomeIcon />} onClick={() => { if (place?.kind === "channel") setDrawer(true); else go({ kind: "channel", slug: slug ?? GENERAL }); }} />
          <BottomTab on={view === "dms" || place?.kind === "dm"} label="DMs" icon={<span aria-hidden>✉︎</span>} n={Object.values(counts.dms).reduce((a, b) => a + (b ?? 0), 0)} onClick={() => go({ kind: "view", view: "dms" })} />
          <BottomTab on={view === "activity" || view === "later"} label="Activity" icon={<BellIcon />} n={counts.mentions - Object.values(counts.dms).reduce((a, b) => a + (b ?? 0), 0)} onClick={() => go({ kind: "view", view: "activity" })} />
          <BottomTab on={view === "you"} label="You" icon={s.me ? <Av p={s.me} sm /> : <span aria-hidden>☺︎</span>} onClick={() => go({ kind: "view", view: "you" })} />
        </nav>
      )}
      {jumper && <JumpBox channels={channels} onClose={() => setJumper(false)} onGo={(w2) => { setJumper(false); go(w2); }} onJump={(id) => { setJumper(false); goTo(id); }} />}
    </div>
  );
}

const VIEW_NAME: Record<RoomView, string> = { activity: "Activity", later: "Later", you: "You", dms: "Direct messages" };
const VIEW_LINE: Record<RoomView, string> = {
  activity: "@mentions, replies in your threads, points and DMs",
  later: "Messages you saved with 🔖 (this device)",
  you: "Your status, buzzes and how the room looks",
  dms: "Private chats: only the two of you can read one",
};

/** How many bots post in a channel. */
function botsIn(bots: readonly BotPost[], slug: string): number {
  return new Set(bots.filter((b) => b.channel === slug).map((b) => b.bot)).size;
}

function BottomTab({ on, label, icon, n = 0, onClick }: { on: boolean; label: string; icon: ReactNode; n?: number; onClick: () => void }) {
  return (
    <button aria-current={on ? "page" : undefined} onClick={onClick}>
      <span className="ic">{icon}{n > 0 && <span className="tr-badge">{n > 99 ? "99+" : n}</span>}</span>
      <span>{label}</span>
    </button>
  );
}

/** "# ideas" and its topic. Rename is under ⋯ (needs team_room_v3.sql). */
function ChannelTitle({ channel }: { channel: Channel }) {
  return (
    <div className="trr-title">
      <b><span className="trw-hash">#</span>{channel.name}</b>
      <small>{channel.topic}</small>
    </div>
  );
}

/** ⋯ on a channel: rename, star, copy link. */
function ChannelMenu({ channel }: { channel: Channel }) {
  const s = useTeamRoom();
  const prefs = useRoomPrefs();
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(channel.name);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => { setOpen(false); setRenaming(false); setName(channel.name); setErr(null); }, [channel.slug, channel.name]);
  const starred = prefs.starred.includes(channel.slug);
  const save = async () => { const r = await renameChannel(channel.slug, name); if (r.ok) { setRenaming(false); setOpen(false); } else setErr(r.error); };
  return (
    <span className="trr-pop-anchor">
      <button className="trr-iconbtn" aria-expanded={open} aria-label={`More for #${channel.name}`} title="More" onClick={() => setOpen(!open)}>⋯</button>
      {open && (<>
        <div className="trr-menu-scrim" onClick={() => setOpen(false)} />
        <div className="trr-menu" role="menu">
          {renaming ? (
            s.v3 !== "on" ? <V3Note what="Renaming a channel" inline /> : (
              <div className="trr-menu-form">
                <span className="tr-add">
                  <input value={name} maxLength={30} aria-label="New name" autoFocus onChange={(e) => { setName(e.target.value); setErr(null); }}
                    onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setRenaming(false); }} />
                  <button className="tr-btn" onClick={save} disabled={!name.trim()}>Save</button>
                </span>
                {err && <span className="tr-err">{err}</span>}
                {channel.builtIn && <small className="tr-muted">A preset: it can be renamed, never deleted.</small>}
              </div>
            )
          ) : (<>
            <button role="menuitem" onClick={() => setRenaming(true)}>✎ Rename #{channel.name}</button>
            <button role="menuitem" onClick={() => { setPrefs({ starred: toggleIn(prefs.starred, channel.slug) }); setOpen(false); }}>{starred ? "☆ Unstar" : "★ Star (top of the list)"}</button>
            <button role="menuitem" onClick={async () => {
              try { await navigator.clipboard.writeText(window.location.origin + roomUrl({ kind: "channel", slug: channel.slug })); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* no clipboard */ }
            }}>{copied ? "✓ Link copied" : "🔗 Copy link"}</button>
          </>)}
        </div>
      </>)}
    </span>
  );
}

function Section({ id, title, children, extra }: { id: string; title: string; children: ReactNode; extra?: ReactNode }) {
  const prefs = useRoomPrefs();
  const folded = prefs.folded.includes(id);
  return (
    <div className="trr-sec">
      <button className="trr-sech" aria-expanded={!folded} onClick={() => setPrefs({ folded: toggleIn(prefs.folded, id) })}>
        <span aria-hidden className="tw">{folded ? "▸" : "▾"}</span>{title}{extra}
      </button>
      {!folded && children}
    </div>
  );
}

function ChannelList({ channels, where, onGo, onClose, onSearch, homeBtn, narrow }: {
  channels: Channel[]; where: Where; onGo: (w: Where) => void; onClose: () => void; onSearch: () => void; homeBtn: ReactNode; narrow: boolean;
}) {
  const s = useTeamRoom();
  const counts = useRoomCounts();
  const prefs = useRoomPrefs();
  const bots = useBotPosts();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const add = async () => {
    const r = await addChannel(name);
    if (r.ok) { setAdding(false); setName(""); if (r.slug) onGo({ kind: "channel", slug: r.slug }); } else setErr(r.error);
  };
  const now = Date.now();
  const tasks = s.me ? tasksFor(s.tasks, s.me, now).open + pushedFor(s.jobs, s.tasks, s.me, now).open.length : 0;
  const dmTotal = Object.values(counts.dms).reduce((a, b) => a + (b ?? 0), 0);
  const activity = counts.mentions - dmTotal;
  const isView = (v: RoomView) => where.kind === "view" && where.view === v;
  const chRow = (c: Channel) => {
    const n = counts.channels[c.slug] ?? { unread: 0, mentions: 0 };
    const on = where.kind === "channel" && where.slug === c.slug;
    return (
      <button key={c.slug} className={`trr-row${n.unread ? " unread" : ""}`} aria-current={on ? "page" : undefined} onClick={() => onGo({ kind: "channel", slug: c.slug })} title={c.topic}>
        <span className="trw-hash">#</span><span className="nm">{c.name}</span>
        {n.mentions > 0 && <span className="trr-n" title={`${n.mentions} for you`}>{n.mentions > 99 ? "99+" : n.mentions}</span>}
      </button>
    );
  };
  const starred = channels.filter((c) => prefs.starred.includes(c.slug));
  const botList = botMembers(bots);
  return (
    <div className="trr-lwrap">
      <div className="trr-lhead">
        {homeBtn}
        <b>Team room</b>
        {narrow
          ? <button className="trr-iconbtn" onClick={onClose} aria-label="Close the list" title="Close">✕</button>
          : <button className="trr-fold" onClick={onClose} aria-label="Close the channel list" title="Close the list (Ctrl/⌘+Shift+D)">«</button>}
      </div>
      <div className="trr-lscroll">
        <button className="trr-row trr-search" onClick={onSearch}><span className="ic" aria-hidden>🔍</span><span className="nm">Search</span><kbd>⌘K</kbd></button>
        <button className={`trr-row${activity ? " unread" : ""}`} aria-current={isView("activity") ? "page" : undefined} onClick={() => onGo({ kind: "view", view: "activity" })}>
          <span className="ic" aria-hidden><BellIcon /></span><span className="nm">Activity</span>{activity > 0 && <span className="trr-n">{activity}</span>}
        </button>
        <button className="trr-row" aria-current={isView("later") ? "page" : undefined} onClick={() => onGo({ kind: "view", view: "later" })}>
          <span className="ic" aria-hidden>🔖</span><span className="nm">Later</span>{prefs.later.length > 0 && <span className="trr-c">{prefs.later.length}</span>}
        </button>
        <button className="trr-row" onClick={() => onGo({ kind: "channel", slug: "todo" })} title="Your open jobs (#todo)">
          <span className="ic" aria-hidden>✓</span><span className="nm">Tasks</span>{tasks > 0 && <span className="trr-c">{tasks}</span>}
        </button>

        {starred.length > 0 && <Section id="starred" title="Starred">{starred.map(chRow)}</Section>}
        <Section id="channels" title="Channels">
          {channels.filter((c) => !prefs.starred.includes(c.slug)).map(chRow)}
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
          ) : <button className="trr-row trr-add" onClick={() => setAdding(true)}><span className="trw-hash">+</span><span className="nm">Add channel</span></button>}
        </Section>

        <Section id="dms" title="Direct messages">
          {TEAM_PEOPLE.filter((p) => p !== s.me).map((p) => {
            const n = counts.dms[p] ?? 0;
            const on = where.kind === "dm" && where.with === p;
            return (
              <button key={p} className={`trr-row${n ? " unread" : ""}`} aria-current={on ? "page" : undefined} onClick={() => onGo({ kind: "dm", with: p })} title={`Private messages with ${p}`}>
                <PersonFace p={p} /><span className="nm">{p}</span>
                {n > 0 && <span className="trr-n">{n}</span>}
              </button>
            );
          })}
        </Section>

        <Section id="bots" title="Bots">
          {botList.map((b) => (
            <button key={b.bot} className="trr-row trr-bot" onClick={() => onGo({ kind: "channel", slug: b.channel })} title={`${b.name}: ${b.line}`}>
              <span className="trr-botface" aria-hidden>{b.icon}</span>
              <span className="nm"><span className="bn">{b.name}<span className="tr-bottag">BOT</span></span><small>{b.line}</small></span>
            </button>
          ))}
        </Section>
      </div>
      {s.me && (
        <button className="trr-me" onClick={() => onGo({ kind: "view", view: "you" })} aria-current={isView("you") ? "page" : undefined} title="Your status, buzzes and look">
          <PersonFace p={s.me} /><span className="nm"><b>{s.me}</b><small>{s.online.includes(s.me) ? "Active" : "Away"}</small></span>
        </button>
      )}
    </div>
  );
}

/** The bots that exist, with their live line (what each one is doing). */
export function botMembers(bots: readonly BotPost[]) {
  const last = (bot: string) => bots.filter((b) => b.bot === bot).sort((a, b) => (Date.parse(b.at) || 0) - (Date.parse(a.at) || 0))[0];
  const ago = (iso?: string) => (iso ? stamp(iso, Date.now()) : "nothing yet");
  const patch = last("patch-notes");
  const job = last("jobs");
  const bug = last("bug");
  return [
    { bot: "patch-notes", name: "Patch bot", icon: "📄", channel: PATCH_CHANNEL, line: patch ? `last post ${ago(patch.at)} · #patch-notes` : "posts each patch note · #patch-notes" },
    { bot: "jobs", name: "Jobs bot", icon: "🧰", channel: "todo", line: job ? `last job ${ago(job.at)} · #todo` : "posts pushed jobs · #todo" },
    { bot: "bug", name: "Bug bot", icon: "🐞", channel: "bugs", line: bug ? `last report ${ago(bug.at)} · #bugs` : "posts bug reports · #bugs" },
  ];
}

const HomeIcon = () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden><path d="M3 10.5 12 4l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /></svg>;
const MenuIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden><path d="M4 7h16M4 12h16M4 17h16" /></svg>;
export const BellIcon = ({ off }: { off?: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" /><path d="M10 20.5a2.2 2.2 0 0 0 4 0" />{off && <path d="M4 4l16 16" />}
  </svg>
);
