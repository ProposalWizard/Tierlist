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
 */
import { useEffect, useMemo, useState } from "react";
import { TEAM_PEOPLE, TEAM_ROOM, type TeamPerson } from "@/lib/teamRoom/config";
import { stamp } from "@/lib/teamRoom/logic";
import { parseMessage } from "@/lib/teamRoom/extras";
import { demoBoard } from "@/lib/teamRoom/demo";
import { deleteMessage, isDemoRoom, sendMessage, useTeamRoom } from "@/lib/teamRoom/store";
import type { DevBar } from "@/lib/devStatus";
import { Av } from "./bits";

/** The quiet channel the board's notes ride in (never in the channel list). */
export const BOARD_NOTES = "board";

export interface BoardPerson { person: TeamPerson; week: number | null; weekComplete: boolean; days: (number | null)[]; bars: DevBar[]; waiting: string | null; last: string | null }
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

export function BoardPanel() {
  const s = useTeamRoom();
  const board = useBoard();
  const now = Date.now();
  return (
    <div className="trw-pad trh trh-board">
      {board.problems.map((p) => <p key={p} className="trh-warn" role="status">{p}</p>)}
      <div className="trh-grid3">
        {board.people.map((c) => (
          <section key={c.person} className="trh-card" aria-label={c.person}>
            <h3><Av p={c.person} card />{c.person}
              <small>{!board.loaded ? "…" : c.week === null ? "no pushes read" : `${c.week}${c.weekComplete ? "" : "+"} push${c.week === 1 ? "" : "es"} this week`}</small></h3>
            <p className="trh-lbl">Activity · pushes a day</p>
            <PushBars days={c.days} person={c.person} />
            <p className="trh-lbl">Current work{c.last ? <span> · updated {stamp(c.last, now)}</span> : null}</p>
            <WorkBars bars={c.bars} person={c.person} waiting={c.waiting} empty={board.loaded ? `No bars from ${c.person} right now. They show after a progress update in a Claude chat.` : "Loading…"} />
          </section>
        ))}
      </div>
      <BoardNotes me={s.me} />
      <p className="tr-muted trh-foot">Pull requests and every push are on the full board: <a href={`${TEAM_ROOM.home}`}>Admin → Team board</a>.</p>
    </div>
  );
}

/** The small notes box: a few lines for the three of us, newest last. */
function BoardNotes({ me }: { me: TeamPerson | null }) {
  const s = useTeamRoom();
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const notes = useMemo(() => s.messages.filter((m) => parseMessage(m.body).channel === BOARD_NOTES).sort((a, b) => a.id - b.id).slice(-8), [s.messages]);
  const now = Date.now();
  const add = async () => {
    if (!text.trim()) return;
    const r = await sendMessage(`[#${BOARD_NOTES}] ${text.trim()}`, null, "/admin/team?tab=chat&view=board");
    if (r.ok) { setText(""); setErr(null); } else setErr(r.error);
  };
  return (
    <section className="trh-card trh-notes" aria-label="Board notes">
      <p className="trh-lbl">Notes</p>
      {notes.length === 0 && <p className="tr-muted">A line for the other two about the board or the admin. Nothing here yet.</p>}
      {notes.map((m) => (
        <div key={m.id} className="trh-note">
          <Av p={m.person} sm />
          <span className="tx">{parseMessage(m.body).text} <small>{m.person} · {stamp(m.created_at, now)}</small></span>
          {m.person === me && <button className="tr-x" onClick={() => deleteMessage(m.id)} aria-label="Delete this note" title="Delete">✕</button>}
        </div>
      ))}
      <span className="tr-add">
        <input value={text} maxLength={300} placeholder="Add a note for the team…" aria-label="New board note" onChange={(e) => { setText(e.target.value); setErr(null); }} onKeyDown={(e) => { if (e.key === "Enter") add(); }} />
        <button className="tr-btn" onClick={add} disabled={!text.trim() || !me}>Add</button>
      </span>
      {err && <p className="tr-err">{err}</p>}
    </section>
  );
}
