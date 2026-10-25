"use client";
/**
 * components/teamRoom/roomWelcome.tsx — the note shown once, before the room
 * (lib/teamRoom/welcome.ts). Full screen on a phone, over the room on a
 * computer; "Got it" opens the room. After an edit with "Show again" it
 * opens once more, marked UPDATED. It stays pinned at the top of #general
 * (Open reads it again). Harry writes it in You → Welcome note: one box for
 * everyone, a short box per person; {name} fills in each name. Only he sees
 * the editor and who has read it.
 */
import { useEffect, useState } from "react";
import { TEAM_PEOPLE, TEAM_ROOM, type TeamPerson } from "@/lib/teamRoom/config";
import { fillName, hasNote, welcomeDue, welcomeReceipts, welcomeUpdated, WELCOME_EDITOR, type WelcomeRow } from "@/lib/teamRoom/welcome";
import { readWelcome, saveWelcome, useTeamRoom } from "@/lib/teamRoom/store";
import { Av } from "./bits";

const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit" });

/** The note itself (the overlay and "Open" from the pin both draw this). */
function Note({ w, me, updated, onDone, doneWord }: { w: WelcomeRow; me: TeamPerson; updated: boolean; onDone: () => void; doneWord: string }) {
  const [first, ...rest] = fillName(w.body, me).split("\n");
  const line = w.lines[me];
  return (
    <div className="trr-note" role="dialog" aria-modal="true" aria-label={`A note from ${WELCOME_EDITOR}`}>
      <p className="from"><Av p={WELCOME_EDITOR} sm /> A note from {WELCOME_EDITOR}{updated && <span className="upd">UPDATED {day(w.updated_at)}</span>}</p>
      {first && <h2>{first}</h2>}
      {rest.join("\n").trim() && <div className="body">{rest.join("\n").trim().split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}</div>}
      {line && <div className="mine"><small>For you, {me}</small><p>{fillName(line, me)}</p></div>}
      <button className="tr-btn go" onClick={onDone} autoFocus>{doneWord}</button>
    </div>
  );
}

/** Shown once before the room (and once more after an edit marked "Show again"). */
export function WelcomeGate() {
  const s = useTeamRoom();
  const [busy, setBusy] = useState(false);
  if (!s.me || !welcomeDue(s.welcome, s.welcomeReads, s.me)) return null;
  const w = s.welcome!;
  return (
    <div className="trr-note-wrap">
      <Note w={w} me={s.me} updated={welcomeUpdated(w, s.welcomeReads, s.me)} doneWord={busy ? "…" : "Got it"}
        onDone={async () => { setBusy(true); await readWelcome(w.version); setBusy(false); }} />
    </div>
  );
}

/** Pinned at the top of #general once read: "📌 Welcome note from Harry · updated 25 Oct · Open". */
export function WelcomePin() {
  const s = useTeamRoom();
  const [open, setOpen] = useState(false);
  if (!s.me || !hasNote(s.welcome)) return null;
  const w = s.welcome;
  return (
    <>
      <button className="trr-pinbar" onClick={() => setOpen(true)}>
        <span aria-hidden>📌</span><span className="tx">Welcome note from {WELCOME_EDITOR}{w.version > 1 ? ` · updated ${day(w.updated_at)}` : ""}</span><span className="go">Open</span>
      </button>
      {open && <div className="trr-note-wrap" onClick={() => setOpen(false)}><div onClick={(e) => e.stopPropagation()}><Note w={w} me={s.me} updated={false} doneWord="Close" onDone={() => setOpen(false)} /></div></div>}
    </>
  );
}

/** You → Welcome note: only Harry sees this. One box for everyone, one per person, Show again, who has read it. */
export function WelcomeEditor() {
  const s = useTeamRoom();
  const w = s.welcome;
  const [body, setBody] = useState(w?.body ?? "");
  const [lines, setLines] = useState<Partial<Record<TeamPerson, string>>>(w?.lines ?? {});
  const [again, setAgain] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { setBody(w?.body ?? ""); setLines(w?.lines ?? {}); }, [w?.version, w?.updated_at]); // eslint-disable-line react-hooks/exhaustive-deps
  if (s.me !== WELCOME_EDITOR) return null;
  const others = TEAM_PEOPLE.filter((p) => p !== WELCOME_EDITOR);
  return (
    <div className="trr-status trr-weditor">
      <p className="tr-lbl">Welcome note <small className="only">Only {WELCOME_EDITOR} sees this</small></p>
      {s.v4 !== "on" ? <p className="tr-muted">Needs <code>{TEAM_ROOM.sqlFileV4}</code> run once in the Supabase SQL Editor first.</p> : (<>
        <label className="trr-field"><small>Everyone · the first line is the heading; {"{name}"} becomes each name</small>
          <textarea rows={5} value={body} maxLength={3000} onChange={(e) => setBody(e.target.value)} placeholder={"Welcome to the Team room, {name}\n\nWhat the room is for, in a line or two."} />
        </label>
        {others.map((p) => (
          <label key={p} className="trr-field"><small>{p} · a short line just for them</small>
            <input value={lines[p] ?? ""} maxLength={400} onChange={(e) => setLines({ ...lines, [p]: e.target.value })} />
          </label>
        ))}
        <label className="trr-check"><input type="checkbox" checked={again} onChange={(e) => setAgain(e.target.checked)} /> Show again to everyone (it opens once more, marked UPDATED)</label>
        <div className="trr-row-btns">
          <button className="tr-btn" onClick={async () => { const r = await saveWelcome(body, lines, again || !w); setMsg(r.ok ? (again || !w ? "Saved. Each of them sees it next time they open the room." : "Saved without showing it again.") : r.error); if (r.ok) setAgain(false); }}>Save</button>
        </div>
        {msg && <small className="tr-muted" role="status">{msg}</small>}
        {w && hasNote(w) && (<>
          <p className="tr-lbl" style={{ marginTop: 8 }}>Who has read it</p>
          {welcomeReceipts(w, s.welcomeReads).map((r) => (
            <span key={r.person} className="trr-rcpt"><Av p={r.person} sm /> <b>{r.person}</b> {r.at ? <span className="ok">✓ Got it · {when(r.at)}</span> : <span>{r.older ? "Read the old one, not this one yet" : "Not opened yet"}</span>}</span>
          ))}
        </>)}
      </>)}
    </div>
  );
}
