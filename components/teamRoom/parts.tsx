"use client";
/**
 * components/teamRoom/parts.tsx — the Team room's shared pieces: the name
 * picker, the to-do list and a notes thread (the chat itself is chat.tsx).
 * Used by the chat bubble (every admin page), the Team room tabs and the
 * patch notes.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { TEAM_PEOPLE, TEAM_ROOM, type TeamPerson } from "@/lib/teamRoom/config";
import { notesFor, stamp, tasksFor, tasksGivenBy, type NoteKind, type TeamTask } from "@/lib/teamRoom/logic";
import { pushedFor, type PushedJob } from "@/lib/teamRoom/jobs";
import {
  addNote, addTask, claimName, deleteNote, deleteTask, markJobsSeen, markRead, setAck, tickTask, useTeamRoom,
} from "@/lib/teamRoom/store";
import { splitQuotes } from "@/lib/teamRoom/notify";
import { noteMentionsFor, noteSeenKey } from "@/lib/teamRoom/inbox";
import { clearPatchSelection, usePatchSelection, watchSelection } from "@/lib/teamRoom/patchQuote";
import { Av, Linked } from "./bits";
import PushedJobRow from "./PushedJob";
import PushToggle from "./PushToggle";
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

/**
 * Your to-do list: yours, given to you, jobs you gave, ticked today.
 * Jobs that arrived by push (team/jobs.json) sit under "Given to me" too.
 */
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
  const pj = pushedFor(s.jobs, s.tasks, s.me, now);
  const openIds = pj.open.map((j) => j.id).join(",");
  useEffect(() => { if (visible && s.me && openIds) markJobsSeen(openIds.split(",")); }, [visible, s.me, openIds]);
  // Given to me: typed and pushed, newest first. Done today: both, latest ticked first.
  type Item = { at: string; task?: TeamTask; job?: PushedJob };
  const byTime = (key: (x: Item) => string) => (a: Item, b: Item) => (Date.parse(key(b)) || 0) - (Date.parse(key(a)) || 0);
  const given: Item[] = [...l.given.map((x) => ({ at: x.created_at, task: x })), ...pj.open.map((j) => ({ at: j.added, job: j }))].sort(byTime((x) => x.at));
  const done: Item[] = [...l.done.map((x) => ({ at: x.done_at!, task: x })), ...pj.done.map((j) => ({ at: j.done_at!, job: j }))].sort(byTime((x) => x.at));
  const item = (x: Item, who?: (t: TeamTask) => ReactNode) =>
    x.job ? <PushedJobRow key={`job-${x.job.id}`} j={x.job} now={now} /> : row(x.task!, who?.(x.task!));
  const add = async () => {
    const r = await addTask(title, owner === "me" ? s.me : owner);
    if (r.ok) setTitle(""); else setErr(r.error);
  };
  const row = (x: (typeof l.mine)[number], who?: ReactNode) => (
    <div key={x.id} className={`tr-task${x.done_at ? " done" : ""}`}>
      <button className="tr-check" data-compact role="checkbox" aria-checked={!!x.done_at} aria-label={x.done_at ? "Not done" : "Done"} onClick={() => tickTask(x.id, !x.done_at)}>
        {x.done_at && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" aria-hidden><path d="m5 12 5 5 9-10" /></svg>}
      </button>
      <span className="tx">{x.title}{who}</span>
      <button className="tr-x" onClick={() => deleteTask(x.id)} title="Delete this job" aria-label="Delete this job">✕</button>
    </div>
  );
  return (
    <div className="tr-todo">
      <PushToggle />
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
      {l.open === 0 && done.length === 0 && gave.length === 0 && pj.open.length === 0 && <p className="tr-muted">Nothing to do. Add a job, or give one to Mikey or Leo.</p>}
      {given.length > 0 && <div><p className="tr-lbl">Given to me</p>{given.map((x) => item(x, (t) => <small>from {t.made_by} · {stamp(t.created_at, now)}</small>))}</div>}
      {l.mine.length > 0 && <div><p className="tr-lbl">Mine</p>{l.mine.map((x) => row(x))}</div>}
      {gave.length > 0 && <div><p className="tr-lbl">Jobs I gave</p>{gave.map((x) => row(x, <small>for {x.owner}</small>))}</div>}
      {done.length > 0 && <div><p className="tr-lbl">Done today</p>{done.map((x) => item(x))}</div>}
    </div>
  );
}

/** Notes under an idea or a push. `owner` gets the red dot. */
/**
 * A notes thread under an idea, a push or a patch note. Patch notes (Harry,
 * 21 Oct 2026): "@" buttons (@Name rings that person's phone and lands in
 * their Inbox), and quoting lines: tap lines from the note's list, or select
 * text on the page and press "Quote my selection". A note shows its quotes
 * first. Opening the thread marks notes that @ you as seen.
 */
export function NotesThread({ kind, id, owner, lines }: { kind: NoteKind; id: string | number; owner: TeamPerson | null; lines?: string[] }) {
  const s = useTeamRoom();
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [quotes, setQuotes] = useState<string[]>([]);
  const [picking, setPicking] = useState(false);
  const selected = usePatchSelection();
  const box = useRef<HTMLTextAreaElement>(null);
  const now = Date.now();
  const notes = notesFor(s.notes, kind, id);
  const isPatch = kind === "patch";
  useEffect(() => { if (s.me && owner === s.me) markRead(kind === "idea" ? "notes" : kind === "push" ? "pushNotes" : "patchNotes"); }, [s.me, owner, kind, notes.length]);
  // Seen: notes here that @ you leave your Inbox.
  useEffect(() => {
    if (!isPatch || !s.me) return;
    for (const n of noteMentionsFor(notes, s.me, s.acks, "1970-01-01")) void setAck("patch", noteSeenKey(n.id), true);
  }, [isPatch, s.me, s.acks, notes]);
  // Text selected on this page (the Text view) can be quoted too.
  useEffect(() => (isPatch ? watchSelection(document, (n) => !!(n && (n as Element).parentElement?.closest?.(".tr-notes"))) : undefined), [isPatch]);
  if (s.status !== "ready" || !s.me) return <RoomGate>{null}</RoomGate>;
  const me = s.me;
  const add = async () => {
    const said = text.trim();
    if (!said && quotes.length === 0) return;
    const body = [...quotes.map((q) => `> ${q}`), said || "(see the lines above)"].join("\n");
    const r = await addNote(kind, id, owner, body);
    if (r.ok) { setText(""); setQuotes([]); setPicking(false); clearPatchSelection(); } else setErr(r.error);
  };
  const toggle = (q: string) => setQuotes((l) => (l.includes(q) ? l.filter((x) => x !== q) : [...l, q].slice(0, 6)));
  const at = (who: string) => {
    const tag = `@${who} `;
    setText((t) => (t.includes(`@${who}`) ? t : `${t}${t && !t.endsWith(" ") ? " " : ""}${tag}`));
    requestAnimationFrame(() => box.current?.focus());
  };
  return (
    <div className="tr-notes">
      <p className="tr-lbl">Notes · {notes.length}</p>
      {notes.length === 0 && <p className="tr-muted">No notes yet.</p>}
      {notes.map((n) => {
        const { quotes: q, text: t } = splitQuotes(n.body);
        return (
          <div key={n.id} className="tr-note">
            <Av p={n.person} sm />
            <div className="t">
              <small><b>{n.person}</b>{stamp(n.created_at, now)}{n.id < 0 && <em className="tr-local">saved on this device only</em>}</small>
              {q.map((x, i) => <blockquote key={i} className="tr-nq">{x}</blockquote>)}
              {t && <p><Linked text={t} me={me} /></p>}
            </div>
            {n.person === me && <button className="tr-x" onClick={() => deleteNote(n.id)} title="Delete your note" aria-label="Delete your note">✕</button>}
          </div>
        );
      })}
      {quotes.length > 0 && (
        <div className="tr-nqs" aria-label="Lines this note is about">
          {quotes.map((q) => (
            <span key={q} className="tr-nqchip"><span>“{q}”</span><button className="tr-x" onClick={() => toggle(q)} aria-label="Take this line out">✕</button></span>
          ))}
        </div>
      )}
      {isPatch && (
        <div className="tr-ntools">
          {lines && lines.length > 0 && (
            <button className={`tr-chipbtn${picking ? " on" : ""}`} onClick={() => setPicking(!picking)} aria-expanded={picking}>❝ Pick lines</button>
          )}
          {selected && !quotes.includes(selected) && (
            <button className="tr-chipbtn" onClick={() => { toggle(selected); clearPatchSelection(); }} title={`Quote: “${selected}”`}>❝ Quote my selection</button>
          )}
          {[...TEAM_PEOPLE.filter((p) => p !== me), "all"].map((p) => (
            <button key={p} className="tr-chipbtn" onClick={() => at(p)} title={p === "all" ? "Tell the other two (their phones buzz)" : `Tell ${p} (their phone buzzes)`}>@{p}</button>
          ))}
        </div>
      )}
      {picking && lines && (
        <ul className="tr-nlines" aria-label="Tap the lines this note is about">
          {lines.map((l) => (
            <li key={l}><button aria-pressed={quotes.includes(l)} onClick={() => toggle(l)}><span className="ck" aria-hidden>{quotes.includes(l) ? "✓" : ""}</span>{l}</button></li>
          ))}
        </ul>
      )}
      <div className="tr-add">
        <textarea ref={box} id={`tr-note-${kind}-${id}`} rows={1} value={text} placeholder={isPatch ? "Add a note… @ to tell someone" : "Add a note…"} aria-label="Add a note" maxLength={1000}
          onChange={(e) => { setText(e.target.value); setErr(null); }} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); add(); } }} />
        <button className="tr-btn" onClick={add} disabled={!text.trim() && quotes.length === 0}>Add</button>
      </div>
      {err && <p className="tr-err">{err}</p>}
      {kind === "patch" && s.v2 === "off" && (
        <p className="tr-muted">New notes here are saved on this device only until <code>{TEAM_ROOM.sqlFileV2}</code> runs, and an @ in them can&apos;t buzz anyone yet.</p>
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
