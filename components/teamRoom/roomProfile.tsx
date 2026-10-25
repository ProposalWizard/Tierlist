"use client";
/**
 * components/teamRoom/roomProfile.tsx — little profiles (plan U0.2): the hover
 * card (a sheet from the bottom on a phone) and "Update status" in You.
 *
 * Hover a face or a name for half a second (computer) or tap it (phone):
 * presence, the status and when it clears, their own time, their last push,
 * and Message. Status: an emoji and a few words, "Clear after" 1 hour /
 * today / this week / never. Pause buzzes: 30 min, 1 hour, until tomorrow.
 */
import { useContext, useEffect, useState } from "react";
import type { TeamPerson } from "@/lib/teamRoom/config";
import { clearAt, clockIn, pauseUntil, PRESENCE_WORD, type ClearAfter, type PauseFor } from "@/lib/teamRoom/status";
import { saveStatus, useTeamRoom } from "@/lib/teamRoom/store";
import { stamp } from "@/lib/teamRoom/logic";
import { TEAM_ROOM } from "@/lib/teamRoom/config";
import { LastPush, PersonFace, useNow, usePersonStatus } from "./roomFace";

const when = (iso: string, now: number) => {
  const d = new Date(iso);
  const t = d.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit" }).replace(":00", "");
  return d.toDateString() === new Date(now).toDateString() ? t : `${d.toLocaleDateString("en-GB", { weekday: "short" })} ${t}`;
};

export function ProfileCard({ p, at, sheet, onClose, onMessage, onStatus }: { p: TeamPerson; at: DOMRect | null; sheet: boolean; onClose: () => void; onMessage: (p: TeamPerson) => void; onStatus: () => void }) {
  const s = useTeamRoom();
  const now = useNow();
  const pushes = useContext(LastPush);
  const { live, presence } = usePersonStatus(p);
  const row = s.statuses[p];
  const their = row?.tz ? clockIn(new Date(now), row.tz) : null;
  const push = pushes[p];
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  const style = !sheet && at ? {
    left: Math.min(Math.max(8, at.left), window.innerWidth - 300),
    top: at.bottom + 260 > window.innerHeight ? Math.max(8, at.top - 250) : at.bottom + 6,
  } : undefined;
  const words = [live.emoji, live.text].filter(Boolean).join(" ");
  return (
    <>
      {/* A computer closes the card when the pointer wanders well away from it and from the face it came from. */}
      <div className={`trr-pcard-scrim${sheet ? " dim" : ""}`} onClick={onClose}
        onMouseMove={sheet ? undefined : (e) => {
          const card = (e.currentTarget.nextElementSibling as HTMLElement | null)?.getBoundingClientRect();
          const near = (r: { left: number; right: number; top: number; bottom: number } | null | undefined) => !!r && e.clientX > r.left - 24 && e.clientX < r.right + 24 && e.clientY > r.top - 24 && e.clientY < r.bottom + 24;
          if (!near(card) && !near(at)) onClose();
        }} />
      <div className={`trr-pcard${sheet ? " sheet" : ""}`} style={style} role="dialog" aria-label={`${p}'s profile`}>
        <div className="top">
          <PersonFace p={p} big />
          <span className="tx"><b>{p}{p === s.me ? " (you)" : ""}</b><small className={`pr ${presence}`}>● {PRESENCE_WORD[presence]}{live.dndUntil ? ` until ${when(live.dndUntil, now)}` : ""}</small></span>
        </div>
        {(words || live.busy) && (
          <p className="line">{words || "Busy"}{live.busy ? ` · until ${live.busy.to} · nothing expected until then` : row?.clear_at ? ` · until ${when(row.clear_at, now)}` : ""}</p>
        )}
        {their && <p className="line muted">🕒 {String(Math.floor(their.min / 60)).padStart(2, "0")}:{String(their.min % 60).padStart(2, "0")} for {p === s.me ? "you" : p}</p>}
        {push && <p className="line muted">⬆ Last push {stamp(push.at, now)}{push.version ? ` · v${push.version}` : ""}</p>}
        <div className="acts">
          {p !== s.me ? <button className="tr-btn" onClick={() => { onMessage(p); onClose(); }}>Message</button>
            : <button className="tr-btn" onClick={() => { onStatus(); onClose(); }}>Update status</button>}
          <a className="tr-btn ghost" href={`${TEAM_ROOM.home}?tab=chat&ch=todo`} onClick={onClose}>Tasks</a>
          {sheet && <button className="tr-btn ghost" onClick={onClose}>Close</button>}
        </div>
      </div>
    </>
  );
}

const EMOJIS = ["🎬", "🎓", "💼", "🏋️", "🍽️", "🔧", "🎮", "🚗", "🤒", "🏖️", "💤", "📵"];
const CLEAR: { id: ClearAfter; label: string }[] = [{ id: "1h", label: "1 hour" }, { id: "today", label: "Today" }, { id: "week", label: "This week" }, { id: "never", label: "Never" }];
const PAUSE: { id: PauseFor; label: string }[] = [{ id: "30m", label: "30 min" }, { id: "1h", label: "1 hour" }, { id: "tomorrow", label: "Until tomorrow 9am" }];

/** You → Update status, and Pause buzzes. */
export function StatusEditor() {
  const s = useTeamRoom();
  const now = useNow();
  const me = s.me;
  const row = me ? s.statuses[me] : undefined;
  const mine = usePersonStatus(me ?? "Harry").live;
  const live = me ? mine : null;
  const [emoji, setEmoji] = useState(row?.emoji ?? "");
  const [text, setText] = useState(row?.text ?? "");
  const [after, setAfter] = useState<ClearAfter>("today");
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { setEmoji(row?.emoji ?? ""); setText(row?.text ?? ""); }, [row?.emoji, row?.text]);
  if (!me) return null;
  const run = async (patch: Parameters<typeof saveStatus>[0], ok: string) => { const r = await saveStatus(patch); setMsg(r.ok ? ok : r.error); };
  const dnd = row?.dnd_until && Date.parse(row.dnd_until) > now ? row.dnd_until : null;
  return (
    <div className="trr-status">
      <p className="tr-lbl">Update status</p>
      <div className="trr-emojis" role="group" aria-label="Pick an emoji">
        {EMOJIS.map((e) => <button key={e} aria-pressed={emoji === e} onClick={() => setEmoji(emoji === e ? "" : e)}>{e}</button>)}
      </div>
      <span className="tr-add">
        <input value={text} maxLength={100} placeholder="What you're doing (e.g. filming clips)" aria-label="Status words" onChange={(e) => setText(e.target.value)} />
      </span>
      <div className="trr-chips" role="group" aria-label="Clear after">
        <small>Clear after</small>
        {CLEAR.map((c) => <button key={c.id} aria-pressed={after === c.id} onClick={() => setAfter(c.id)}>{c.label}</button>)}
      </div>
      <div className="trr-row-btns">
        <button className="tr-btn" disabled={!emoji && !text.trim()} onClick={() => run({ emoji: emoji || null, text: text.trim() || null, clear_at: clearAt(after, new Date()) }, "Status set.")}>Save status</button>
        {(row?.emoji || row?.text) && <button className="tr-btn ghost" onClick={() => { setEmoji(""); setText(""); run({ emoji: null, text: null, clear_at: null }, "Status cleared."); }}>Clear</button>}
      </div>
      {live?.busy && <small className="tr-muted">A schedule is on now ({live.busy.emoji} {live.busy.text}), so the others see that until {live.busy.to}.</small>}

      <p className="tr-lbl" style={{ marginTop: 12 }}>Pause buzzes (do not disturb)</p>
      <div className="trr-chips" role="group" aria-label="Pause buzzes">
        {PAUSE.map((c) => <button key={c.id} onClick={() => run({ dnd_until: pauseUntil(c.id, new Date()) }, "Buzzes paused. Your dot is red for the others.")}>{c.label}</button>)}
        {dnd && <button aria-pressed onClick={() => run({ dnd_until: null }, "Buzzes back on.")}>Resume (paused until {when(dnd, now)})</button>}
      </div>
      {msg && <small className="tr-muted" role="status">{msg}</small>}
      {s.v4 === "off" && <small className="tr-muted">Kept on this device until <code>{TEAM_ROOM.sqlFileV4}</code> runs; the others can&apos;t see it yet.</small>}
    </div>
  );
}
