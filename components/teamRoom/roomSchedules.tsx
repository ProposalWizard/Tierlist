"use client";
/**
 * components/teamRoom/roomSchedules.tsx — schedules in your status (plan T2;
 * Harry, 25 Oct 2026). Set a repeating status once, like "🎓 Uni · 9–5
 * weekdays": it turns itself on and off at those times (your own clock).
 * While it is on your dot shows busy (amber), your name says "back at 5",
 * and buzzes wait unless you switch that off. Busy is fine: nothing is
 * expected from you then. Only you change your own. Up to 8.
 */
import { useState } from "react";
import { cleanSchedules, daysLabel, hoursLabel, isHhmm, type Schedule } from "@/lib/teamRoom/status";
import { saveStatus, useTeamRoom } from "@/lib/teamRoom/store";
import { Av } from "./bits";

const DAY = ["M", "T", "W", "T", "F", "S", "S"];
const DAY_NAME = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const EMOJI = ["🎓", "💼", "🏋️", "🎬", "🍽️", "💤"];

export function ScheduleEditor() {
  const s = useTeamRoom();
  const me = s.me;
  const list = me ? cleanSchedules(s.statuses[me]?.schedules) : [];
  const [emoji, setEmoji] = useState("🎓");
  const [text, setText] = useState("");
  const [days, setDays] = useState<number[]>([0, 1, 2, 3, 4]);
  const [from, setFrom] = useState("09:00");
  const [to, setTo] = useState("17:00");
  const [pause, setPause] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  if (!me) return null;
  const ok = !!text.trim() && days.length > 0 && isHhmm(from) && isHhmm(to) && from !== to && list.length < 8;
  const save = async (next: Schedule[], word: string) => { const r = await saveStatus({ schedules: next }); setMsg(r.ok ? word : r.error); };
  const draft: Schedule = { id: "draft", emoji, text: text.trim() || "Busy", days, from, to, pause };
  return (
    <div className="trr-status trr-sched">
      <p className="tr-lbl" style={{ marginTop: 12 }}>Schedules (repeats by itself)</p>
      <div className="trr-emojis small" role="group" aria-label="Schedule emoji">
        {EMOJI.map((e) => <button key={e} aria-pressed={emoji === e} onClick={() => setEmoji(e)}>{e}</button>)}
      </div>
      <span className="tr-add"><input value={text} maxLength={60} placeholder="Uni, Work, Gym…" aria-label="What it is" onChange={(e) => setText(e.target.value)} /></span>
      <div className="trr-days" role="group" aria-label="Which days">
        {DAY.map((d, i) => (
          <button key={i} aria-pressed={days.includes(i)} aria-label={DAY_NAME[i]} title={DAY_NAME[i]}
            onClick={() => setDays(days.includes(i) ? days.filter((x) => x !== i) : [...days, i].sort())}>{d}</button>
        ))}
      </div>
      <div className="trr-times">
        <input type="time" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From" /> <span>to</span>
        <input type="time" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To" />
      </div>
      <label className="trr-check"><input type="checkbox" checked={pause} onChange={(e) => setPause(e.target.checked)} /> Pause buzzes while it&apos;s on</label>
      <p className="trr-preview">How others see it: <span className="who"><Av p={me} sm /> <b>{me}</b> <span>{emoji}</span> <small>back at {hoursLabel(draft).split("–")[1]}</small></span></p>
      <div className="trr-row-btns">
        <button className="tr-btn" disabled={!ok} onClick={() => { save([...list, { ...draft, id: `s${Date.now().toString(36)}` }], "Schedule saved. It turns on and off by itself."); setText(""); }}>Add schedule</button>
      </div>
      {list.length > 0 && (
        <div className="trr-schedlist">
          <p className="tr-lbl">Your schedules</p>
          {list.map((x) => (
            <div key={x.id} className="trr-schedrow">
              <span className="em" aria-hidden>{x.emoji}</span>
              <span className="tx"><b>{x.text}</b><small>{daysLabel(x.days)} · {x.from}–{x.to}{x.pause ? " · buzzes wait" : ""}</small></span>
              <button className="tr-x" onClick={() => save(list.filter((y) => y.id !== x.id), "Schedule removed.")} aria-label={`Remove ${x.text}`} title="Remove">✕</button>
            </div>
          ))}
        </div>
      )}
      {msg && <small className="tr-muted" role="status">{msg}</small>}
    </div>
  );
}
