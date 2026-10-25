"use client";
/**
 * components/teamRoom/roomBugs.tsx — #bugs: players' bug reports as Bug bot
 * cards (plan U4, A2; Harry, 25 Oct 2026: "the bug bot in this picture works
 * really cool, I like that for ours").
 *
 * A report arrives by itself (a database trigger on the feedback table,
 * team_room_v4.sql) as a card: 🐞 Bug report #N, labelled fields (Title, Page,
 * From, What they said) and two wide buttons: Hand to… (outlined: pick
 * Harry, Mikey or Leo; it also makes a #todo task for them) and ✓ Mark fixed
 * (filled green; greys the card, "Fixed by Leo"). The 🐞 Open reports tab
 * lists the ones still open.
 */
import { useMemo, useState } from "react";
import { TEAM_PEOPLE, TEAM_ROOM, type TeamPerson } from "@/lib/teamRoom/config";
import { stamp } from "@/lib/teamRoom/logic";
import { bugCounts, bugReports, handTaskTitle, isOpen, type BugReport } from "@/lib/teamRoom/bugs";
import { addTask, markBug, useTeamRoom } from "@/lib/teamRoom/store";
import { nameOfPage } from "./bits";
import { Av } from "./bits";

/** The card for one report, drawn inside the Bug bot's post (and in the Open reports list). */
export function BugCard({ report }: { report: BugReport }) {
  const s = useTeamRoom();
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const r = report;
  const fixed = !!r.mark?.fixed_at;
  const run = async (f: () => Promise<{ ok: boolean; error?: string }>, ok?: string) => {
    setBusy(true); const res = await f(); setBusy(false);
    setNote(res.ok ? ok ?? null : res.error ?? "Not saved.");
  };
  const hand = (p: TeamPerson) => run(async () => {
    setPicking(false);
    const m = await markBug(r.postId, { handTo: p });
    if (!m.ok) return m;
    const t = await addTask(handTaskTitle(r), p);
    return t.ok ? { ok: true } : t;
  }, `Handed to ${p}: it is in their #todo.`);
  const words = r.body.trim() && r.body.trim() !== r.title.trim() ? r.body.trim() : null;
  return (
    <div className={`trr-bug${fixed ? " fixed" : ""}`}>
      <p className="h"><span aria-hidden>🐞</span> Bug report #{r.number}{fixed && <span className="tag ok">Fixed</span>}{!fixed && r.mark?.handed_to && <span className="tag">With {r.mark.handed_to}</span>}</p>
      <dl>
        <dt>Title</dt><dd>{r.title}</dd>
        {r.page && (<><dt>Page</dt><dd><a href={r.page} target="_blank" rel="noreferrer">{nameOfPage(r.page.split("?")[0])}</a> <small>{r.page}</small></dd></>)}
        <dt>From</dt><dd>{r.signedIn ? "A signed-in player" : "A player (not signed in)"} · {stamp(r.at, Date.now())}</dd>
        {words && (<><dt>What they said</dt><dd className="words">{words}</dd></>)}
      </dl>
      {fixed ? (
        <p className="done">✓ Fixed by {r.mark!.fixed_by} · {stamp(r.mark!.fixed_at!, Date.now())}
          <button className="tr-x" disabled={busy} onClick={() => run(() => markBug(r.postId, { fixed: false }))}>Undo</button></p>
      ) : (
        <div className="btns">
          <button className="tr-btn ghost hand" disabled={busy || s.v4 !== "on"} aria-expanded={picking} onClick={() => setPicking(!picking)}>🤝 Hand to…</button>
          <button className="tr-btn fix" disabled={busy || s.v4 !== "on"} onClick={() => run(() => markBug(r.postId, { fixed: true }))}>✓ Mark fixed</button>
        </div>
      )}
      {picking && (
        <div className="pick" role="group" aria-label="Hand it to">
          {TEAM_PEOPLE.map((p) => (
            <button key={p} aria-pressed={r.mark?.handed_to === p} onClick={() => hand(p)}><Av p={p} sm />{p}{p === s.me ? " (me)" : ""}</button>
          ))}
          <small>Picking a person makes a #todo task for them. Bots join this list once they exist.</small>
        </div>
      )}
      {note && <small className="note" role="status">{note}</small>}
    </div>
  );
}

/** #bugs → 🐞 Open reports: the reports nobody has marked fixed, newest first. */
export function BugList({ onOpen }: { onOpen?: (key: string) => void }) {
  void onOpen;
  const s = useTeamRoom();
  const list = useMemo(() => bugReports(s.botRows, s.bugMarks), [s.botRows, s.bugMarks]);
  const n = bugCounts(list, s.me);
  if (s.v4 !== "on" || s.v3 !== "on") {
    return (
      <p className="tr-muted trr-setup" role="note">
        Needs setup: players&apos; bug reports post here by themselves once <code>{TEAM_ROOM.sqlFileV4}</code> runs in the Supabase SQL Editor.
      </p>
    );
  }
  const open = list.filter(isOpen);
  return (
    <div className="trr-buglist">
      <p className="trr-bugbar">Open {n.open} · With me {n.mine} · Fixed {n.fixed}</p>
      {open.length === 0 ? <p className="tr-muted">No open bug reports. 🎉</p> : open.map((r) => <BugCard key={r.postId} report={r} />)}
    </div>
  );
}

/** The report behind a Bug bot post (null until its row and marks are loaded). */
export function useBugReport(postId: number | undefined): BugReport | null {
  const s = useTeamRoom();
  return useMemo(() => (postId ? bugReports(s.botRows.filter((r) => r.id === postId), s.bugMarks)[0] ?? null : null), [postId, s.botRows, s.bugMarks]);
}
