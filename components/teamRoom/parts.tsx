"use client";
/**
 * components/teamRoom/parts.tsx — the Team room's shared pieces: the name
 * picker, the chat thread, the to-do list and a notes thread. Used by the
 * chat bubble (every admin page) and by the Team room tabs.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ADMIN_PAGES } from "@/lib/adminRegistry";
import { TEAM_PEOPLE, TEAM_ROOM, type TeamPerson } from "@/lib/teamRoom/config";
import { notesFor, pageLabel, stamp, tasksFor, tasksGivenBy, type NoteKind, type TeamMessage } from "@/lib/teamRoom/logic";
import {
  addNote, addTask, claimName, deleteMessage, deleteNote, deleteTask, markRead, sendMessage, setPinned, tickTask, useTeamRoom,
} from "@/lib/teamRoom/store";

const PAGE_NAMES: Record<string, string> = Object.fromEntries([
  ...ADMIN_PAGES.map((p) => [p.url.split("?")[0], p.name]),
  ["/admin/team", "Team board"], ["/admin/star", "Admin home"], ["/admin/videos", "Videos"],
]);

export function Av({ p, sm }: { p: TeamPerson; sm?: boolean }) {
  return <span className={`tr-av ${p}${sm ? " sm" : ""}`} title={p}>{p[0]}</span>;
}

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

const LINK = /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g;
function Linked({ text }: { text: string }) {
  const parts = text.split(LINK);
  return <>{parts.map((x, i) => (i % 2 ? <a key={i} href={x} target="_blank" rel="noreferrer">{x}</a> : x))}</>;
}

const dayOf = (iso: string) => new Date(iso).toDateString();
const dayLabel = (iso: string, now: number) => {
  const d = new Date(iso);
  if (d.toDateString() === new Date(now).toDateString()) return "Today";
  if (d.toDateString() === new Date(now - 86400_000).toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" });
};

/** The chat: messages, then the box to type in. `visible` marks it read. */
export function ChatThread({ visible = true, autoFocus }: { visible?: boolean; autoFocus?: boolean }) {
  const s = useTeamRoom();
  const list = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => Date.now());
  const [zoom, setZoom] = useState<string | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(id); }, []);
  useLayoutEffect(() => { const el = list.current; if (el) el.scrollTop = el.scrollHeight; }, [s.messages.length, visible]);
  useEffect(() => { if (visible && s.me) markRead("chat"); }, [visible, s.me, s.messages.length]);

  return (
    <div className="tr-chat">
      <div className="tr-msgs" ref={list} aria-live="polite">
        {s.messages.length === 0 && <p className="tr-muted" style={{ textAlign: "center", marginTop: 30 }}>No messages yet. Say hello.</p>}
        {s.messages.map((m, i) => (
          <MessageRow key={m.id} m={m} me={s.me} now={now} day={i === 0 || dayOf(m.created_at) !== dayOf(s.messages[i - 1].created_at)}
            open={openId === m.id} onOpen={() => setOpenId(openId === m.id ? null : m.id)} onZoom={setZoom} />
        ))}
      </div>
      <Composer autoFocus={autoFocus} />
      {zoom && <div className="tr-zoom" onClick={() => setZoom(null)} role="dialog" aria-label="Picture"><img src={zoom} alt="" /></div>}
    </div>
  );
}

function MessageRow({ m, me, now, day, open, onOpen, onZoom }: { m: TeamMessage; me: TeamPerson | null; now: number; day: boolean; open: boolean; onOpen: () => void; onZoom: (u: string) => void }) {
  const mine = m.person === me;
  const where = pageLabel(m.page, PAGE_NAMES);
  return (
    <>
      {day && <span className="tr-day">{dayLabel(m.created_at, now)}</span>}
      <div className={`tr-msg${mine ? " me" : ""}`}>
        {!mine && <Av p={m.person} />}
        <div className="tr-bub" data-open={open} onClick={onOpen}>
          <small>
            {!mine && <b>{m.person}</b>}<span>{stamp(m.created_at, now)}</span>
            {where && m.page && <a className="tr-where" href={m.page} onClick={(e) => e.stopPropagation()} title={`Sent from ${m.page}`}>· {where}</a>}
            {m.pinned && <span className="tr-pinmark" title="Pinned">📌</span>}
          </small>
          {m.body && <p><Linked text={m.body} /></p>}
          {m.image_url && <img src={m.image_url} alt="Picture sent in the chat" loading="lazy" onClick={(e) => { e.stopPropagation(); onZoom(m.image_url!); }} />}
          <span className="tr-acts">
            <button onClick={(e) => { e.stopPropagation(); setPinned(m.id, !m.pinned); }} title={m.pinned ? "Unpin" : "Pin it for the team"}>{m.pinned ? "Unpin" : "📌 Pin"}</button>
            {mine && <button onClick={(e) => { e.stopPropagation(); deleteMessage(m.id); }} title="Delete your message">Delete</button>}
          </span>
        </div>
      </div>
    </>
  );
}

function Composer({ autoFocus }: { autoFocus?: boolean }) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const send = async () => {
    if (busy || (!text.trim() && !file)) return;
    setBusy(true); setErr(null);
    const r = await sendMessage(text, file, typeof window === "undefined" ? null : window.location.pathname + window.location.search);
    setBusy(false);
    if (r.ok) { setText(""); setFile(null); } else setErr(r.error);
  };
  return (
    <div>
      {file && preview && (
        <div className="tr-attach"><img src={preview} alt="" /><span>Picture ready to send</span><button className="tr-x" onClick={() => setFile(null)} aria-label="Remove the picture">✕</button></div>
      )}
      <div className="tr-compose">
        <button className="tr-iconbtn" onClick={() => fileRef.current?.click()} title="Add a picture" aria-label="Add a picture">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="10" r="1.8" /><path d="m21 16-5-5-8 8" /></svg>
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { setFile(e.target.files?.[0] ?? null); e.target.value = ""; }} />
        <textarea id="tr-compose" rows={1} value={text} autoFocus={autoFocus} placeholder="Message the team…" aria-label="Message the team"
          onChange={(e) => { setText(e.target.value); e.target.style.height = "auto"; e.target.style.height = `${Math.min(120, e.target.scrollHeight)}px`; }}
          onPaste={(e) => { const f = Array.from(e.clipboardData.files).find((x) => x.type.startsWith("image/")); if (f) { e.preventDefault(); setFile(f); } }}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }} />
        <button className="tr-send" onClick={send} disabled={busy || (!text.trim() && !file)}>{busy ? "…" : "Send"}</button>
      </div>
      {err && <p className="tr-err" style={{ padding: "0 12px 8px" }}>{err}</p>}
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
  useEffect(() => { if (s.me && owner === s.me) markRead(kind === "idea" ? "notes" : "pushNotes"); }, [s.me, owner, kind, notes.length]);
  if (s.status !== "ready" || !s.me) return <RoomGate>{null}</RoomGate>;
  const add = async () => { const r = await addNote(kind, id, owner, text); if (r.ok) setText(""); else setErr(r.error); };
  return (
    <div className="tr-notes">
      <p className="tr-lbl">Notes · {notes.length}</p>
      {notes.length === 0 && <p className="tr-muted">No notes yet.</p>}
      {notes.map((n) => (
        <div key={n.id} className="tr-note">
          <Av p={n.person} sm />
          <div className="t"><small><b>{n.person}</b>{stamp(n.created_at, now)}</small><p><Linked text={n.body} /></p></div>
          {n.person === s.me && <button className="tr-x" onClick={() => deleteNote(n.id)} title="Delete your note" aria-label="Delete your note">✕</button>}
        </div>
      ))}
      <div className="tr-add">
        <input id={`tr-note-${kind}-${id}`} value={text} placeholder="Add a note…" aria-label="Add a note" maxLength={1000}
          onChange={(e) => { setText(e.target.value); setErr(null); }} onKeyDown={(e) => { if (e.key === "Enter") add(); }} />
        <button className="tr-btn" onClick={add} disabled={!text.trim()}>Add</button>
      </div>
      {err && <p className="tr-err">{err}</p>}
    </div>
  );
}

export function NoteCount({ kind, id }: { kind: NoteKind; id: string | number }) {
  const s = useTeamRoom();
  const n = notesFor(s.notes, kind, id).length;
  if (!n) return null;
  return <span className="tr-ncount" title={`${n} note${n === 1 ? "" : "s"}`}>💬 {n}</span>;
}
