"use client";
/**
 * components/teamRoom/roomMe.tsx — Me: each person's own home in the Team room
 * (Harry, 12 Nov 2026: "each person should have their own home page … their
 * settings, their status stuff, their to-do list, what they're currently
 * working on … he can quickly link the marketing studio into his home";
 * "schedules and check-ins, that should definitely be in their home page").
 *
 * Top to bottom: who you are and your status (one tap), today's check-in, your
 * to-do with proposals, what you are working on (your bars), quick links, then
 * notifications, schedules and the look. Also the first-visit notifications
 * question (NotifyAsk): on by default, one tap, per-channel mute stays on 🔔.
 */
import { useEffect, useState } from "react";
import { TEAM_ROOM } from "@/lib/teamRoom/config";
import { endOfToday } from "@/lib/teamRoom/asks";
import { pauseUntil } from "@/lib/teamRoom/status";
import { checkInBody, checkInsFor, ukDay } from "@/lib/teamRoom/today";
import { requestPopups, setPopupsOn, usePopupState } from "@/lib/teamRoom/popups";
import { turnOnPush, usePush } from "@/lib/teamRoom/push";
import { stamp } from "@/lib/teamRoom/logic";
import { saveStatus, sendMessage, useTeamRoom } from "@/lib/teamRoom/store";
import { PersonFace, usePersonStatus } from "./roomFace";
import { TodoList } from "./parts";
import { StatusEditor } from "./roomProfile";
import { ScheduleEditor } from "./roomSchedules";
import { WelcomeEditor } from "./roomWelcome";
import PushToggle from "./PushToggle";
import { LookPicker, QuickLinks } from "./roomPanels";
import { WorkBars, useBoard } from "./roomBoard";
import { setPrefs, useRoomPrefs } from "./roomPrefs";

const ASKED_KEY = "kib-tr-notify-asked";

/** One-tap statuses. "Here" clears; "Off" also pauses buzzes until 9 tomorrow. */
const QUICK = [
  { id: "here", emoji: "🟢", word: "Here" },
  { id: "filming", emoji: "🎬", word: "Filming" },
  { id: "work", emoji: "💼", word: "Work" },
  { id: "off", emoji: "🌙", word: "Off" },
] as const;

export function MeHome({ onGo }: { onGo: (slug: string) => void }) {
  const s = useTeamRoom();
  const prefs = useRoomPrefs();
  const board = useBoard();
  const me = s.me;
  const mine = usePersonStatus(me ?? "Harry");
  const [edit, setEdit] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  if (!me) return null;
  const word = (mine.live.text ?? "").toLowerCase();
  const on = word === "filming" ? "filming" : word === "work" ? "work" : word === "off" ? "off" : !mine.live.text && !mine.live.emoji ? "here" : null;
  const pick = async (id: (typeof QUICK)[number]["id"]) => {
    const now = new Date();
    const r = id === "here" ? await saveStatus({ emoji: null, text: null, clear_at: null, dnd_until: null })
      : id === "off" ? await saveStatus({ emoji: "🌙", text: "Off", clear_at: pauseUntil("tomorrow", now), dnd_until: pauseUntil("tomorrow", now) })
        : await saveStatus({ emoji: id === "filming" ? "🎬" : "💼", text: id === "filming" ? "Filming" : "Work", clear_at: endOfToday(Date.now()), dnd_until: null });
    setMsg(r.ok ? (id === "off" ? "Off until 9 tomorrow: no buzzes, and the others see a red dot." : id === "here" ? "Status cleared." : "Status set until midnight.") : r.error);
  };
  const myBars = board.people.find((p) => p.person === me);
  return (
    <div className="trw-pad trh trh-me">
      <div className="trh-megrid">
        <div className="trh-col">
          <section className="trh-card" aria-label="You">
            <div className="trh-hero">
              <PersonFace p={me} big />
              <span className="tx"><b>{me}</b><small>{{ active: "Active", away: "Away", dnd: "Do not disturb", busy: "Busy" }[mine.presence]}{mine.line ? ` · ${mine.line}` : ""}</small></span>
            </div>
            <div className="trh-chips" role="group" aria-label="Your status">
              {QUICK.map((q) => <button key={q.id} aria-pressed={on === q.id} onClick={() => pick(q.id)}><span aria-hidden>{q.emoji}</span> {q.word}</button>)}
              <button aria-expanded={edit} onClick={() => setEdit(!edit)}>✎ Set a status</button>
            </div>
            {msg && <small className="tr-muted" role="status">{msg}</small>}
            {edit && <StatusEditor />}
          </section>

          <CheckInCard onGo={onGo} />

          <section className="trh-card" aria-label="My to-do">
            <p className="trh-lbl">My to-do</p>
            <div className="trh-todo"><TodoList visible noPush /></div>
          </section>
        </div>

        <div className="trh-col">
          <section className="trh-card" aria-label="Working on">
            <p className="trh-lbl">Working on</p>
            <WorkBars bars={myBars?.bars ?? []} person={me} waiting={myBars?.waiting} empty={board.loaded ? "No bars right now. They show here after a progress update in one of your Claude chats." : "Loading…"} />
          </section>

          <section className="trh-card" aria-label="Quick links"><QuickLinks /></section>

          <section className="trh-card" aria-label="Schedule">
            <ScheduleEditor />
          </section>

          <section className="trh-card" aria-label="Notifications">
            <p className="trh-lbl">Notifications</p>
            <PopupRow />
            <PushToggle />
            <small className="tr-muted">To quieten one channel: open it and tap 🔔 in its top bar (Every new message, Only @mentions, Off, or Mute for 1 hour).</small>
          </section>

          <section className="trh-card" aria-label="How the room looks">
            <p className="trh-lbl">Dark or light</p>
            <LookPicker />
            <p className="trh-lbl" style={{ marginTop: 12 }}>Message look</p>
            <div className="tr-seg trr-seg" role="group" aria-label="Message look">
              <button aria-pressed={prefs.density === "clean"} onClick={() => setPrefs({ density: "clean" })}>Clean · faces</button>
              <button aria-pressed={prefs.density === "compact"} onClick={() => setPrefs({ density: "compact" })}>Compact · tighter</button>
            </div>
          </section>
          <WelcomeEditor />
        </div>
      </div>
    </div>
  );
}

/** Today's check-in: one line, saved as your message in #today. */
function CheckInCard({ onGo }: { onGo: (slug: string) => void }) {
  const s = useTeamRoom();
  const today = ukDay(Date.now()).day;
  const mine = s.me ? checkInsFor(s.messages, today)[s.me] : undefined;
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    if (!text.trim()) return;
    const r = await sendMessage(checkInBody(text), null, "/admin/team?tab=chat&ch=today");
    if (r.ok) { setText(""); setErr(null); } else setErr(r.error);
  };
  return (
    <section className="trh-card" aria-label="Today's check-in">
      <p className="trh-lbl">Today</p>
      {mine
        ? <p className="trh-checked"><b>{mine.text}</b><small>checked in {stamp(mine.at, Date.now())}</small></p>
        : <p className="tr-muted">You have not checked in today. One line: what are you on?</p>}
      <span className="tr-add">
        <input value={text} maxLength={200} placeholder={mine ? "Change today's line…" : "e.g. filming the goal replays"} aria-label="Today's check-in" onChange={(e) => { setText(e.target.value); setErr(null); }} onKeyDown={(e) => { if (e.key === "Enter") save(); }} />
        <button className="tr-btn" onClick={save} disabled={!text.trim()}>{mine ? "Update" : "Check in"}</button>
      </span>
      {err && <p className="tr-err">{err}</p>}
      <button className="trh-linkbtn" onClick={() => onGo("today")}>See everyone in #today →</button>
    </section>
  );
}

/** Pop-ups on this computer: on or off, with the reason when the browser says no. */
function PopupRow() {
  const pop = usePopupState();
  return (
    <div className={`tr-push${pop === "on" ? " on" : ""}`}>
      <span className="tx">
        <b>Pop-ups on this computer: {pop === "on" ? "On" : "Off"}</b>
        <small>{pop === "blocked" ? "Blocked for this site in the browser's settings. Allow notifications there, then reload." : pop === "unsupported" ? "This browser can't show them." : "A pop-up when a message comes in while you are on another tab or channel."}</small>
      </span>
      {pop === "on" ? <button className="tr-btn ghost" onClick={() => setPopupsOn(false)}>Turn off</button>
        : <button className="tr-btn" disabled={pop === "blocked" || pop === "unsupported"} onClick={() => requestPopups()}>Turn on pop-ups</button>}
    </div>
  );
}

/**
 * The first-visit question (Harry: "notifications should be asked when we
 * first come in … the auto should be on for phone and for computer"). A
 * browser only lets a site ask from a tap, so "on by default" means: the
 * green button is Turn on, and one tap does both. Asked once per device.
 */
export function NotifyAsk() {
  const s = useTeamRoom();
  const pop = usePopupState();
  const push = usePush();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let asked = true;
    try { asked = !!localStorage.getItem(ASKED_KEY); } catch { /* private window: don't nag */ }
    if (!asked) setShow(true);
  }, []);
  if (!show || !s.me) return null;
  // Already on for this device (set up before today): nothing to ask.
  const allOn = pop === "on" && (push.state === "on" || push.state === "unsupported" || push.state === "notReady");
  const done = (v: string) => { try { localStorage.setItem(ASKED_KEY, v); } catch { /* private window */ } setShow(false); };
  if (allOn) return null;
  const canPush = push.state === "off";
  const turnOn = async () => {
    setBusy(true);
    await requestPopups();
    if (canPush) await turnOnPush();
    setBusy(false);
    done("on");
  };
  return (
    <div className="trh-askwrap" role="dialog" aria-label="Notifications">
      <div className="trh-ask">
        <b>Turn on notifications?</b>
        <p>A pop-up on this computer and a buzz on this phone when a message comes in. You can mute any channel with its 🔔, or turn everything off under Me.</p>
        {push.state === "iphone" && <small>On an iPhone the buzz works only from the KIB Admin app on your Home Screen (Share → Add to Home Screen).</small>}
        {push.state === "notReady" && <small>Phone buzzes are not switched on for the site yet (one Vercel setting), so this turns on the computer pop-ups.</small>}
        {(pop === "blocked" || push.state === "blocked") && <small>This browser has notifications blocked for the site. Allow them in its site settings, then reload.</small>}
        <div className="bt">
          <button className="tr-btn" onClick={turnOn} disabled={busy}>{busy ? "…" : "Turn on"}</button>
          <button className="tr-btn ghost" onClick={() => done("later")} disabled={busy}>Not now</button>
        </div>
        <small>Asked once on this device. Change it any time: <a href={`${TEAM_ROOM.home}?tab=chat&view=me`}>Me → Notifications</a>.</small>
      </div>
    </div>
  );
}
