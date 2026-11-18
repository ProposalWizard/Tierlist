"use client";
/**
 * components/teamRoom/roomBoard.tsx — the Team board as a tab INSIDE the Team
 * room (Harry, 12 Nov 2026: "why don't we just have the team board here as a
 * tab … that has our bars, and maybe a temporary chat on that page"; "none of
 * this page other than the activity pushes and the current work is being
 * used").
 *
 * Only three things: pushes a day (two weeks), current-work bars, and a small
 * notes box. The notes are ordinary messages in a quiet channel of their own
 * ("[#board] …"), so they need no table and replace a "#team-board" chat
 * channel. The full board (pull requests, every push) stays at Admin → Team.
 *
 * 13 Nov 2026 (Harry: "this can be improved visually, where is the live
 * now/active now?"): an Active now strip on top and a state on every card
 * (the rule is lib/teamRoom/activeNow.ts), current work first with three
 * kinds of bar (in progress, waiting, done folded to a ticked line), a slim
 * chart with today marked, cards at their own heights, notes at the side.
 * Everything this tab draws is BoardPanel below + roomBoard.css (classes
 * "tbb-…"), so it can be changed without touching another screen. PushBars
 * and WorkBars above BoardPanel are still used by Me → Working on.
 */
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { TEAM_PEOPLE, TEAM_ROOM, type TeamPerson } from "@/lib/teamRoom/config";
import { stamp } from "@/lib/teamRoom/logic";
import { liveStatus, statusLine } from "@/lib/teamRoom/status";
import { activeNow, activeStrip, barState, foldDone, waitsOn, type ActiveState } from "@/lib/teamRoom/activeNow";
import { parseMessage } from "@/lib/teamRoom/extras";
import { demoBoard } from "@/lib/teamRoom/demo";
import { deleteMessage, isDemoRoom, sendMessage, useTeamRoom } from "@/lib/teamRoom/store";
import type { DevBar } from "@/lib/devStatus";
import { Av } from "./bits";
import "./roomBoard.css";

/** The quiet channel the board's notes ride in (never in the channel list). */
export const BOARD_NOTES = "board";

export interface BoardPerson { person: TeamPerson; week: number | null; weekComplete: boolean; days: (number | null)[]; bars: DevBar[]; waiting: string | null; last: string | null; /** Latest progress update from a Claude chat. */ updateAt: string | null; /** Latest push. */ pushAt: string | null }
interface BoardView { people: BoardPerson[]; problems: string[]; loaded: boolean }

type RawPerson = { person: string; pushes?: { at: string; title: string }[]; count?: { week: number; days: (number | null)[]; weekComplete: boolean; last: string | null } | null; status?: { at: string; bars: DevBar[]; waiting: string | null } | null };

/** The API's rows cut down to what this tab shows. Pushes a day fall back to the branch's own changes when GitHub's push log could not be read. */
export function boardPeople(raw: readonly RawPerson[], now: number): BoardPerson[] {
  return TEAM_PEOPLE.map((p) => {
    const r = raw.find((x) => x.person === p);
    const work = (r?.pushes ?? []).filter((x) => !/^Merge\b/i.test(x.title));
    const days = r?.count?.days ?? Array.from({ length: 14 }, (_, i) => {
      const from = now - (14 - i) * 86400_000, to = from + 86400_000;
      return work.filter((x) => { const t = Date.parse(x.at); return t >= from && t < to; }).length;
    });
    return {
      person: p, week: r?.count ? r.count.week : r ? work.filter((x) => now - Date.parse(x.at) < 7 * 86400_000).length : null,
      weekComplete: r?.count ? r.count.weekComplete : true, days,
      bars: r?.status?.bars ?? [], waiting: r?.status?.waiting ?? null,
      last: [r?.status?.at, r?.count?.last, work[0]?.at].filter((x): x is string => !!x).sort().pop() ?? null,
      updateAt: r?.status?.at ?? null, pushAt: [r?.count?.last, work[0]?.at].filter((x): x is string => !!x).sort().pop() ?? null,
    };
  });
}

let cache: { at: number; view: BoardView } | null = null;
const REFRESH_MS = 60_000;

/** The board's rows, shared by the Team board tab and Me → Working on. Asked once a minute while on screen. */
export function useBoard(): BoardView {
  const [view, setView] = useState<BoardView>(cache?.view ?? { people: boardPeople([], Date.now()), problems: [], loaded: false });
  useEffect(() => {
    let live = true;
    const load = async () => {
      if (cache && Date.now() - cache.at < REFRESH_MS - 1000) { setView(cache.view); return; }
      let next: BoardView;
      if (isDemoRoom()) next = { people: boardPeople(demoBoard(Date.now()).people, Date.now()), problems: [], loaded: true };
      else {
        try {
          const r = await fetch("/api/admin/team", { cache: "no-store" });
          const j = (await r.json()) as { people?: RawPerson[]; problems?: string[]; error?: string };
          next = r.ok && j.people ? { people: boardPeople(j.people, Date.now()), problems: j.problems ?? [], loaded: true }
            : { people: boardPeople([], Date.now()), problems: [j.error ?? `The board answered ${r.status}.`], loaded: true };
        } catch { next = { people: boardPeople([], Date.now()), problems: ["Could not reach the site to load the board."], loaded: true }; }
      }
      cache = { at: Date.now(), view: next };
      if (live) setView(next);
    };
    // The room decides who you are a moment after it mounts: wait for that, then ask.
    const first = setTimeout(load, 400);
    const id = setInterval(() => { if (document.visibilityState === "visible") load(); }, REFRESH_MS);
    return () => { live = false; clearTimeout(first); clearInterval(id); };
  }, []);
  return view;
}

/** Pushes a day for two weeks. An unknown day (before GitHub's log starts) is left empty, never drawn as zero. */
export function PushBars({ days, person }: { days: (number | null)[]; person: TeamPerson }) {
  const top = Math.max(2, ...days.map((n) => n ?? 0));
  return (
    <div className="trh-chart" role="img" aria-label={`${person}: pushes a day for two weeks: ${days.map((n) => n ?? "unknown").join(", ")}`}>
      <div className={`trh-bars ${person}`}>
        {days.map((n, i) => <i key={i} className={n ? "" : n === null ? "na" : "z"} style={{ height: n ? `${Math.max(8, (n / top) * 100)}%` : undefined }} title={`${13 - i === 0 ? "today" : `${13 - i} days ago`}: ${n ?? "not known"}`} />)}
      </div>
      <div className="trh-axis"><span>2 weeks ago</span><span>today</span></div>
    </div>
  );
}

export function WorkBars({ bars, person, waiting, empty }: { bars: DevBar[]; person: TeamPerson; waiting?: string | null; empty: string }) {
  if (!bars.length) return <p className="tr-muted">{empty}</p>;
  return (
    <div className={`trh-works ${person}`}>
      {bars.map((b, i) => (
        <div key={i} className="trh-work">
          <div className="t"><b>{b.label}</b><span>{b.pct}%</span></div>
          <div className="trh-track" role="img" aria-label={`${b.pct} percent`}><i style={{ width: `${b.pct}%` }} /></div>
          {b.note && <small>{b.note}</small>}
        </div>
      ))}
      {waiting && <p className="trh-wait">Waiting on: <b>{waiting}</b></p>}
    </div>
  );
}

/** A slim chart: pushes a day for two weeks, today's bar marked. An unknown day is left empty, never drawn as zero. */
function Spark({ days, person }: { days: (number | null)[]; person: TeamPerson }) {
  const top = Math.max(2, ...days.map((n) => n ?? 0));
  const today = days[days.length - 1];
  return (
    <div className={`tbb-spark ${person}`} role="img" aria-label={`${person}: pushes a day for two weeks: ${days.map((n) => n ?? "unknown").join(", ")}`}>
      <div className="bars">
        {days.map((n, i) => <i key={i} className={`${n ? "" : n === null ? "na" : "z"}${i === days.length - 1 ? " today" : ""}`} style={{ height: n ? `${Math.max(12, (n / top) * 100)}%` : undefined }} title={`${days.length - 1 - i === 0 ? "today" : `${days.length - 1 - i} days ago`}: ${n ?? "not known"}`} />)}
      </div>
      <div className="axis"><span>Pushes a day · 2 weeks</span><span>today{today === null ? "" : `: ${today}`}</span></div>
    </div>
  );
}

/** The dot and words for a person's state: green and pulsing when live. */
function StateLine({ st }: { st: ActiveState }) {
  return <span className={`tbb-state ${st.kind}`}><i className="tbb-dot" aria-hidden />{st.label}{st.detail ? <small> · {st.detail}</small> : null}</span>;
}

/** Current work in three kinds: in progress (big %), waiting (amber, who it waits on), done (one quiet ticked line each, folded past 3). */
function Work({ bars, person, me, today }: { bars: DevBar[]; person: TeamPerson; me: TeamPerson | null; today: boolean }) {
  const open = bars.filter((b) => barState(b) !== "done");
  const done = foldDone(bars.filter((b) => barState(b) === "done"));
  return (
    <div className={`tbb-work ${person}`}>
      {open.map((b, i) => {
        const waiting = barState(b) === "waiting";
        const who = waiting ? waitsOn(`${b.note} ${b.label}`, person) : [];
        return (
          <div key={i} className={`tbb-bar${waiting ? " waiting" : ""}`}>
            <div className="t"><b>{b.label}</b><span className="pct">{b.pct}<small>%</small></span></div>
            <div className="track" role="img" aria-label={`${b.pct} percent`}><i style={{ width: `${b.pct}%` }} /></div>
            {(b.note || waiting) && <div className="n">
              {waiting && <span className="tbb-chip amber">{who.length ? `Waits on ${who.map((p) => (p === me ? "you" : p)).join(", ")}` : "Waiting"}</span>}
              {b.note && <small>{b.note}</small>}
            </div>}
          </div>
        );
      })}
      {(done.shown.length > 0) && (
        <ul className="tbb-done">
          {done.shown.map((b, i) => <li key={i}><span className="tick" aria-hidden>✓</span><span>{b.label}{b.note ? <small> · {b.note}</small> : null}</span></li>)}
          {done.more > 0 && <li className="more">+{done.more} done{today ? " today" : ""}</li>}
        </ul>
      )}
    </div>
  );
}

export function BoardPanel() {
  const s = useTeamRoom();
  const board = useBoard();
  // The words "5 min ago" and the 20-minute rule move on without a reload.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(id); }, []);
  const states = useMemo(() => {
    const out = {} as Record<TeamPerson, ActiveState>;
    for (const c of board.people) {
      const mine = s.messages.filter((m) => m.person === c.person);
      out[c.person] = activeNow({
        here: s.online.includes(c.person), status: statusLine(liveStatus(s.statuses[c.person], new Date(now))),
        updateAt: c.updateAt, pushAt: c.pushAt, messageAt: mine.length ? mine.reduce((a, m) => (m.created_at > a ? m.created_at : a), mine[0].created_at) : null,
      }, now);
    }
    return out;
  }, [board.people, s.messages, s.online, s.statuses, now]);
  const strip = activeStrip(states, now);
  // On a computer a card with live work is wider than an empty one; cards keep their own heights.
  const liveBars = (c: BoardPerson) => c.bars.filter((b) => barState(b) !== "done").length;
  const cols = board.people.map((c) => `minmax(0, ${liveBars(c) >= 2 ? 1.3 : c.bars.length ? 1.1 : 0.9}fr)`).join(" ");
  return (
    <div className="trw-pad trh trh-board tbb">
      {board.problems.map((p) => <p key={p} className="trh-warn" role="status">{p}</p>)}
      <section className={`tbb-now${strip.live.length ? " live" : ""}`} aria-label="Active now" aria-live="polite">
        <i className="tbb-dot" aria-hidden />
        {strip.live.length ? (
          <>
            <b>Active now</b>
            <span className="who">{strip.live.map((p) => <span key={p} className="p"><Av p={p} card />{p}{states[p].kind === "working" ? <small>working · via Claude chat</small> : null}</span>)}</span>
          </>
        ) : <span>{strip.words}</span>}
      </section>
      <div className="tbb-layout">
        <div className="tbb-cards" style={{ "--tbb-cols": cols } as CSSProperties}>
          {board.people.map((c) => {
            const st = states[c.person];
            const waitMe = !!s.me && waitsOn(c.waiting, c.person).includes(s.me);
            const today = !!c.updateAt && new Date(c.updateAt).toDateString() === new Date(now).toDateString();
            return (
              <section key={c.person} className={`tbb-card ${c.person}${st.live ? " live" : ""}`} aria-label={c.person} data-state={st.kind}>
                <header>
                  <Av p={c.person} card />
                  <span className="id"><b>{c.person}{c.person === s.me ? <small> (you)</small> : null}</b><StateLine st={st} /></span>
                  <span className="week" title="Pushes this week">{!board.loaded ? "…" : c.week === null ? <small>no pushes read</small> : <><b>{c.week}{c.weekComplete ? "" : "+"}</b><small>push{c.week === 1 ? "" : "es"} this week</small></>}</span>
                </header>
                {waitMe && c.waiting && <p className="tbb-you" role="status"><b>Waiting on you</b><span>{c.waiting.replace(/^\s*you\s*[:,-]\s*/i, "")}</span></p>}
                {c.bars.length > 0 ? (
                  <>
                    <p className="tbb-lbl">Current work{c.updateAt ? <span> · updated {stamp(c.updateAt, now)}</span> : null}</p>
                    <Work bars={c.bars} person={c.person} me={s.me} today={today} />
                    {!waitMe && c.waiting && <p className="tbb-wait">Waiting on: <b>{c.waiting}</b></p>}
                  </>
                ) : (
                  <p className="tbb-none">{!board.loaded ? "Loading…" : c.last ? <>No work posted today. <span>Last update {stamp(c.last, now)}.</span></> : `No work posted yet. Bars show after a progress update in one of ${c.person}'s Claude chats.`}</p>
                )}
                <Spark days={c.days} person={c.person} />
              </section>
            );
          })}
        </div>
        <aside className="tbb-side">
          <BoardNotes me={s.me} />
          <p className="tr-muted trh-foot">Pull requests and every push are on the full board: <a href={`${TEAM_ROOM.home}`}>Admin → Team board</a>.</p>
        </aside>
      </div>
    </div>
  );
}

/** The small notes box: a few lines for the three of us, newest first. */
function BoardNotes({ me }: { me: TeamPerson | null }) {
  const s = useTeamRoom();
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const notes = useMemo(() => s.messages.filter((m) => parseMessage(m.body).channel === BOARD_NOTES).sort((a, b) => b.id - a.id).slice(0, 8), [s.messages]);
  const now = Date.now();
  const add = async () => {
    if (!text.trim()) return;
    const r = await sendMessage(`[#${BOARD_NOTES}] ${text.trim()}`, null, "/admin/team?tab=chat&view=board");
    if (r.ok) { setText(""); setErr(null); } else setErr(r.error);
  };
  return (
    <section className="tbb-notes" aria-label="Board notes">
      <p className="tbb-lbl">Notes</p>
      <span className="tr-add">
        <input value={text} maxLength={300} placeholder="Add a note for the team…" aria-label="New board note" onChange={(e) => { setText(e.target.value); setErr(null); }} onKeyDown={(e) => { if (e.key === "Enter") add(); }} />
        <button className="tr-btn" onClick={add} disabled={!text.trim() || !me}>Add</button>
      </span>
      {err && <p className="tr-err">{err}</p>}
      {notes.length === 0 && <p className="tr-muted">A line for the other two about the board or the admin. Nothing here yet.</p>}
      {notes.map((m) => (
        <div key={m.id} className="tbb-note">
          <Av p={m.person} sm />
          <span className="tx">{parseMessage(m.body).text}<small>{m.person} · {stamp(m.created_at, now)}</small></span>
          {m.person === me && <button className="tr-x" onClick={() => deleteMessage(m.id)} aria-label="Delete this note" title="Delete">✕</button>}
        </div>
      ))}
    </section>
  );
}
