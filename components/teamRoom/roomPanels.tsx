"use client";
/**
 * components/teamRoom/roomPanels.tsx — the Team room's screens that are not
 * a channel: Activity (things for you), Later (saved messages), You (your
 * status, buzzes and look), the DM list (phone) and the ⌘K jump box.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { TEAM_PEOPLE, type TeamPerson } from "@/lib/teamRoom/config";
import { stamp, type TeamMessage } from "@/lib/teamRoom/logic";
import { parseMessage, quoteLine } from "@/lib/teamRoom/extras";
import { GENERAL, channelOf, dmsWith, listChannels, parentOf, type Channel, type RoomPlace } from "@/lib/teamRoom/channels";
import { useTeamRoom } from "@/lib/teamRoom/store";
import { Av, WaitingOnMe } from "./parts";
import PushToggle from "./PushToggle";
import { useRoomCounts } from "./roomCounts";
import { setPrefs, toggleIn, useRoomPrefs } from "./roomPrefs";
import { PersonFace } from "./roomFace";
import { StatusEditor } from "./roomProfile";
import { WelcomeEditor } from "./roomWelcome";

const where = (m: TeamMessage, names: Map<string, string>) => {
  const c = channelOf(m.body);
  return `#${names.get(c) ?? c}`;
};

/** Activity: @mentions you haven't seen, points waiting, replies in threads you are in, unread DMs. */
export function ActivityPanel({ onJump, onDm }: { onJump: (id: number) => void; onDm: (p: TeamPerson) => void }) {
  const s = useTeamRoom();
  const counts = useRoomCounts();
  const names = useMemo(() => new Map(listChannels(s.channelRows).map((c) => [c.slug, c.name])), [s.channelRows]);
  const now = Date.now();
  // Replies under a message you wrote or replied in, from the others, in the last 3 days.
  const replies = useMemo(() => {
    if (!s.me) return [];
    const mineIn = new Set<number>();
    for (const m of s.messages) {
      if (m.person !== s.me) continue;
      const p = parentOf(m);
      mineIn.add(p ?? m.id);
    }
    return s.messages.filter((m) => {
      const p = parentOf(m);
      return p && mineIn.has(p) && m.person !== s.me && now - (Date.parse(m.created_at) || 0) < 3 * 86400_000;
    }).sort((a, b) => b.id - a.id).slice(0, 20);
  }, [s.messages, s.me, now]);
  const dmFrom = TEAM_PEOPLE.filter((p) => p !== s.me && (counts.dms[p] ?? 0) > 0);
  return (
    <div className="trw-pad trr-panel">
      <p className="tr-lbl">For you</p>
      <WaitingOnMe onJump={onJump} />
      {dmFrom.length > 0 && (<>
        <p className="tr-lbl" style={{ marginTop: 10 }}>New private messages</p>
        {dmFrom.map((p) => {
          const last = dmsWith(s.dms, s.me, p).slice(-1)[0];
          return (
            <button key={p} className="trr-item" onClick={() => onDm(p)}>
              <Av p={p} /><span className="tx"><b>{p} <span className="trr-n">{counts.dms[p]}</span></b><small>{last?.body ?? ""}</small></span>
            </button>
          );
        })}
      </>)}
      <p className="tr-lbl" style={{ marginTop: 10 }}>Replies in your threads</p>
      {replies.length === 0 ? <p className="tr-muted">No replies in the last 3 days.</p> : replies.map((m) => (
        <button key={m.id} className="trr-item" onClick={() => onJump(m.id)}>
          <Av p={m.person} /><span className="tx"><b>{m.person} <small>replied in {where(m, names)} · {stamp(m.created_at, now)}</small></b><small>{quoteLine(m, 120)}</small></span>
        </button>
      ))}
    </div>
  );
}

/** Later: messages saved with 🔖, on this device. */
export function LaterPanel({ onJump }: { onJump: (id: number) => void }) {
  const s = useTeamRoom();
  const prefs = useRoomPrefs();
  const names = useMemo(() => new Map(listChannels(s.channelRows).map((c) => [c.slug, c.name])), [s.channelRows]);
  const saved = prefs.later.map((id) => s.messages.find((m) => m.id === id)).filter((m): m is TeamMessage => !!m);
  const now = Date.now();
  return (
    <div className="trw-pad trr-panel">
      {saved.length === 0 ? <p className="tr-muted">Nothing saved. Hover a message (tap it on a phone) and press 🔖 to keep it here.</p> : saved.map((m) => (
        <div key={m.id} className="trr-item">
          <Av p={m.person} />
          <button className="tx" onClick={() => onJump(m.id)}><b>{m.person} <small>{where(m, names)} · {stamp(m.created_at, now)}</small></b><small>{quoteLine(m, 160)}</small></button>
          <button className="tr-x" onClick={() => setPrefs({ later: toggleIn(prefs.later, m.id) })} title="Take it off Later" aria-label="Take it off Later">✕</button>
        </div>
      ))}
    </div>
  );
}

/** You: your status, buzzes and the look. Built up over the next slices. */
export function YouPanel() {
  const s = useTeamRoom();
  const prefs = useRoomPrefs();
  return (
    <div className="trw-pad trr-panel trr-you">
      {s.me && (
        <div className="trr-youcard">
          <PersonFace p={s.me} big />
          <span className="tx"><b>{s.me}</b><small>{s.online.includes(s.me) ? "● Active" : "○ Away"} · the others see your dot and status</small></span>
        </div>
      )}
      <StatusEditor />
      <p className="tr-lbl" style={{ marginTop: 6 }}>Buzzes on this device</p>
      <PushToggle />
      <p className="tr-lbl" style={{ marginTop: 10 }}>Message look</p>
      <div className="tr-seg trr-seg" role="group" aria-label="Message look">
        <button aria-pressed={prefs.density === "clean"} onClick={() => setPrefs({ density: "clean" })}>Clean · faces</button>
        <button aria-pressed={prefs.density === "compact"} onClick={() => setPrefs({ density: "compact" })}>Compact · tighter</button>
      </div>
      <small className="tr-muted">Kept on this device. Clean shows a 36 px face by each message; Compact uses 20 px faces and less space.</small>
      <WelcomeEditor />
    </div>
  );
}

/** The DM list (phone's DMs tab). */
export function DmsPanel({ onGo }: { onGo: (p: TeamPerson) => void }) {
  const s = useTeamRoom();
  const counts = useRoomCounts();
  const now = Date.now();
  return (
    <div className="trw-pad trr-panel">
      {TEAM_PEOPLE.filter((p) => p !== s.me).map((p) => {
        const last = dmsWith(s.dms, s.me, p).slice(-1)[0];
        const n = counts.dms[p] ?? 0;
        return (
          <button key={p} className={`trr-item big${n ? " unread" : ""}`} onClick={() => onGo(p)}>
            <PersonFace p={p} />
            <span className="tx"><b>{p} {last && <small>{stamp(last.created_at, now)}</small>}</b><small>{last ? `${last.from_person === s.me ? "You: " : ""}${last.body}` : "No messages yet. Only the two of you can read this."}</small></span>
            {n > 0 && <span className="trr-n">{n}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** ⌘K: type a few letters, jump to a channel, a person or a message. */
export function JumpBox({ channels, onClose, onGo, onJump }: {
  channels: Channel[]; onClose: () => void; onGo: (p: RoomPlace) => void; onJump: (id: number) => void;
}) {
  const s = useTeamRoom();
  const [q, setQ] = useState("");
  const [pick, setPick] = useState(0);
  const box = useRef<HTMLInputElement>(null);
  useEffect(() => { box.current?.focus(); }, []);
  const t = q.trim().toLowerCase().replace(/^#/, "");
  type Hit = { key: string; label: string; sub?: string; go: () => void; face?: TeamPerson };
  const hits: Hit[] = useMemo(() => {
    const out: Hit[] = [];
    for (const c of channels) if (!t || c.name.toLowerCase().includes(t) || c.slug.includes(t)) out.push({ key: `c${c.slug}`, label: `# ${c.name}`, sub: c.topic, go: () => onGo({ kind: "channel", slug: c.slug }) });
    for (const p of TEAM_PEOPLE) if (p !== s.me && (!t || p.toLowerCase().includes(t))) out.push({ key: `p${p}`, label: p, sub: "Direct message", face: p, go: () => onGo({ kind: "dm", with: p }) });
    if (t.length >= 2) {
      const msgs = s.messages.filter((m) => parseMessage(m.body).text.toLowerCase().includes(t)).slice(-12).reverse();
      for (const m of msgs) out.push({ key: `m${m.id}`, label: quoteLine(m, 80), sub: `${m.person} · #${channelOf(m.body) || GENERAL}`, face: m.person, go: () => onJump(m.id) });
    }
    return out.slice(0, 20);
  }, [t, channels, s.me, s.messages, onGo, onJump]);
  useEffect(() => setPick(0), [t]);
  return (
    <div className="trr-jump-wrap" onClick={onClose}>
      <div className="trr-jump" role="dialog" aria-label="Jump to" onClick={(e) => e.stopPropagation()}>
        <input ref={box} value={q} placeholder="Jump to a channel, a person or words in a message…" aria-label="Jump to"
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setPick((pick + 1) % Math.max(1, hits.length)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setPick((pick + hits.length - 1) % Math.max(1, hits.length)); }
            if (e.key === "Enter") { e.preventDefault(); hits[pick]?.go(); }
            if (e.key === "Escape") onClose();
          }} />
        <div className="trr-jump-l" role="listbox">
          {hits.length === 0 && <p className="tr-muted" style={{ padding: 12 }}>Nothing matches “{q}”.</p>}
          {hits.map((h, i) => (
            <button key={h.key} role="option" aria-selected={i === pick} className={i === pick ? "on" : ""} onMouseEnter={() => setPick(i)} onClick={h.go}>
              {h.face ? <Av p={h.face} sm /> : <span className="ic" aria-hidden>#</span>}
              <span className="tx"><b>{h.label}</b>{h.sub && <small>{h.sub}</small>}</span>
            </button>
          ))}
        </div>
        <p className="trr-jump-foot">↑ ↓ to pick · Enter to go · Esc to close</p>
      </div>
    </div>
  );
}
