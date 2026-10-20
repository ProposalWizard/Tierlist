"use client";
/**
 * components/teamRoom/parts.tsx — the Team room's shared pieces: the name
 * picker, the to-do list and a notes thread (the chat itself is chat.tsx).
 * Used by the chat bubble (every admin page), the Team room tabs and the
 * patch notes.
 */
import { useEffect, useState, type ReactNode } from "react";
import { TEAM_PEOPLE, TEAM_ROOM, type TeamPerson } from "@/lib/teamRoom/config";
import { notesFor, stamp, tasksFor, tasksGivenBy, type NoteKind } from "@/lib/teamRoom/logic";
import {
  addNote, addTask, claimName, deleteNote, deleteTask, markRead, tickTask, useTeamRoom,
} from "@/lib/teamRoom/store";
import { Av, Linked } from "./bits";
import { ChatThread, WaitingOnMe } from "./chat";

export { Av, ChatThread, WaitingOnMe };

/** Loading / not switched on / pick your name — then the children. */
export function RoomGate({ children }: { children: ReactNode }) {
  const s = useTeamRoom();
  if (s.status === "idle" || s.status === "loading") return <p className="tr-muted" style={{ padding: 16 }}>Loading the team room…</p>;
  if (s.status === "signedOut") return <p className="tr-muted" style={{ padding: 16 }}>Sign in to use the team room.</p>;
  if (s.status === "missing") return (
    <div className="tr-notice" style={{ margin: 12 }}>
      <b>The team room isn&apos;t switched on yet</b>
      <span>Run <code>{TEAM_ROOM.sqlFile}</code> once in the Supabase SQL Editor, then reload.</span>
    </div>
  );
  if (s.status === "error") return <p className="tr-err" style={{ padding: 16 }}>Could not load the team room: {s.error}</p>;
  if (!s.me) return <WhoAreYou taken={s.taken} />;
  return <>{children}</>;
}

function WhoAreYou({ taken }: { taken: TeamPerson[] }) {
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="tr-who">
      <h3>Which one are you?</h3>
      <p className="tr-muted">Asked once. Every phone and computer you sign in on will know.</p>
      <div className="tr-who-row">
        {TEAM_PEOPLE.map((p) => (
          <button key={p} disabled={busy || taken.includes(p)} title={taken.includes(p) ? `${p} is taken by another account` : `I'm ${p}`}
            onClick={async () => { setBusy(true); const r = await claimName(p); setBusy(false); if (!r.ok) setErr(r.error); }}>
            <Av p={p} />{p}
          </button>
        ))}
      </div>
      {err && <p className="tr-err">{err}</p>}
    </div>
  );
}

/** Your to-do list: yours, given to you, jobs you gave, ticked today. */
export function TodoList({ visible = true }: { visible?: boolean }) {
  const s = useTeamRoom();
  const [now, setNow] = useState(() => Date.now());
  const [title, setTitle] = useState("");
  const [owner, setOwner] = useState<TeamPerson | "me">("me");
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(id); }, []);
  useEffect(() => { if (visible && s.me) markRead("tasks"); }, [visible, s.me, s.tasks.length]);
  const l = tasksFor(s.tasks, s.me, now);
  const gave = tasksGivenBy(s.tasks, s.me);
  const add = async () => {
    const r = await addTask(title, owner === "me" ? s.me : owner);
    if (r.ok) setTitle(""); else setErr(r.error);
  };
  const row = (x: (typeof l.mine)[number], who?: ReactNode) => (
    <div key={x.id} className={`tr-task${x.done_at ? " done" : ""}`}>
      <button className="tr-check" role="checkbox" aria-checked={!!x.done_at} aria-label={x.done_at ? "Not done" : "Done"} onClick={() => tickTask(x.id, !x.done_at)}>
        {x.done_at && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" aria-hidden><path d="m5 12 5 5 9-10" /></svg>}
      </button>
      <span className="tx">{x.title}{who}</span>
      <button className="tr-x" onClick={() => deleteTask(x.id)} title="Delete this job" aria-label="Delete this job">✕</button>
    </div>
  );
  return (
    <div className="tr-todo">
      <div className="tr-add">
        <input id="tr-task-new" value={title} placeholder="Add a job…" aria-label="New job" maxLength={200}
          onChange={(e) => { setTitle(e.target.value); setErr(null); }} onKeyDown={(e) => { if (e.key === "Enter") add(); }} />
        <select id="tr-task-for" value={owner} onChange={(e) => setOwner(e.target.value as TeamPerson | "me")} aria-label="Who the job is for">
          <option value="me">for me</option>
          {TEAM_PEOPLE.filter((p) => p !== s.me).map((p) => <option key={p} value={p}>for {p}</option>)}
        </select>
        <button className="tr-btn" onClick={add} disabled={!title.trim()}>Add</button>
      </div>
      {err && <p className="tr-err">{err}</p>}
      {l.open === 0 && l.done.length === 0 && gave.length === 0 && <p className="tr-muted">Nothing to do. Add a job, or give one to Mikey or Leo.</p>}
      {l.given.length > 0 && <div><p className="tr-lbl">Given to me</p>{l.given.map((x) => row(x, <small>from {x.made_by} · {stamp(x.created_at, now)}</small>))}</div>}
      {l.mine.length > 0 && <div><p className="tr-lbl">Mine</p>{l.mine.map((x) => row(x))}</div>}
      {gave.length > 0 && <div><p className="tr-lbl">Jobs I gave</p>{gave.map((x) => row(x, <small>for {x.owner}</small>))}</div>}
      {l.done.length > 0 && <div><p className="tr-lbl">Done today</p>{l.done.map((x) => row(x))}</div>}
    </div>
  );
}

/** Notes under an idea or a push. `owner` gets the red dot. */
export function NotesThread({ kind, id, owner }: { kind: NoteKind; id: string | number; owner: TeamPerson | null }) {
  const s = useTeamRoom();
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const now = Date.now();
  const notes = notesFor(s.notes, kind, id);
  useEffect(() => { if (s.me && owner === s.me) markRead(kind === "idea" ? "notes" : kind === "push" ? "pushNotes" : "patchNotes"); }, [s.me, owner, kind, notes.length]);
  if (s.status !== "ready" || !s.me) return <RoomGate>{null}</RoomGate>;
  const add = async () => { const r = await addNote(kind, id, owner, text); if (r.ok) setText(""); else setErr(r.error); };
  return (
    <div className="tr-notes">
      <p className="tr-lbl">Notes · {notes.length}</p>
      {notes.length === 0 && <p className="tr-muted">No notes yet.</p>}
      {notes.map((n) => (
        <div key={n.id} className="tr-note">
          <Av p={n.person} sm />
          <div className="t"><small><b>{n.person}</b>{stamp(n.created_at, now)}{n.id < 0 && <em className="tr-local">saved on this device only</em>}</small><p><Linked text={n.body} me={s.me} /></p></div>
          {n.person === s.me && <button className="tr-x" onClick={() => deleteNote(n.id)} title="Delete your note" aria-label="Delete your note">✕</button>}
        </div>
      ))}
      <div className="tr-add">
        <input id={`tr-note-${kind}-${id}`} value={text} placeholder="Add a note…" aria-label="Add a note" maxLength={1000}
          onChange={(e) => { setText(e.target.value); setErr(null); }} onKeyDown={(e) => { if (e.key === "Enter") add(); }} />
        <button className="tr-btn" onClick={add} disabled={!text.trim()}>Add</button>
      </div>
      {err && <p className="tr-err">{err}</p>}
      {kind === "patch" && s.v2 === "off" && (
        <p className="tr-muted">New notes here are saved on this device only until <code>{TEAM_ROOM.sqlFileV2}</code> runs.</p>
      )}
    </div>
  );
}

export function NoteCount({ kind, id }: { kind: NoteKind; id: string | number }) {
  const s = useTeamRoom();
  const n = notesFor(s.notes, kind, id).length;
  if (!n) return null;
  return <span className="tr-ncount" title={`${n} note${n === 1 ? "" : "s"}`}>💬 {n}</span>;
}
