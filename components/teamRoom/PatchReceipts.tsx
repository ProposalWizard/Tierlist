"use client";
/**
 * components/teamRoom/PatchReceipts.tsx — who has read each patch note
 * (Harry, 20 Oct 2026: "read receipts and notes so we know when everyone has
 * read and understood patch notes").
 *
 * On /admin/patch-notes (and the Patch notes tab of the Team board): the
 * H / M / L faces, a "Read and understood" button for you, and a notes thread
 * under the version. A patch note's own author counts as having read it.
 * Notes can @ someone (their phone buzzes, it lands in their Inbox) and quote
 * lines of the note (Harry, 21 Oct 2026).
 * Saved in team_acks / team_notes (this device only until team_room_v2.sql).
 */
import { useState } from "react";
import { TEAM_PEOPLE, TEAM_ROOM } from "@/lib/teamRoom/config";
import { notesFor } from "@/lib/teamRoom/logic";
import { patchAuthor, patchReaders, type PatchMeta } from "@/lib/teamRoom/extras";
import { setAck, useTeamRoom } from "@/lib/teamRoom/store";
import { Av } from "./bits";
import { takeNotesRequest } from "@/lib/teamRoom/patchQuote";
import { NotesThread } from "./parts";
import "./teamRoom.css";

/** The bar above a version: faces, your button, and the notes. */
export function PatchReadBar({ note, lines }: { note: PatchMeta; lines?: string[] }) {
  const s = useTeamRoom();
  // The Inbox opens a version with its notes showing (a note that @'s you).
  const [open, setOpen] = useState(() => takeNotesRequest(note.version));
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (s.status === "idle" || s.status === "loading") return null;
  if (s.status !== "ready") return null; // signed out / not switched on: the archive reads as before
  const readers = patchReaders(note, s.acks);
  const author = patchAuthor(note.title);
  const me = s.me;
  const iRead = !!me && readers.includes(me);
  const notes = notesFor(s.notes, "patch", note.version).length;
  const toggle = async () => {
    if (!me || me === author) return;
    setBusy(true); setErr(null);
    const r = await setAck("patch", note.version, !iRead);
    setBusy(false);
    if (!r.ok) setErr(r.error);
  };
  return (
    <section className="tr-vars tr tr-patchbar" aria-label={`Who has read v${note.version}`}>
      <div className="row">
        <span className="tr-lbl" style={{ margin: 0 }}>Read by</span>
        <span className="faces">
          {TEAM_PEOPLE.map((p) => (
            <span key={p} className={`face${readers.includes(p) ? " on" : ""}`} title={p === author ? `${p} wrote it` : readers.includes(p) ? `${p} has read and understood it` : `${p} hasn't yet`}>
              <Av p={p} off={!readers.includes(p)} />
              <small>{p === author ? "wrote it" : readers.includes(p) ? "✓ read" : "not yet"}</small>
            </span>
          ))}
        </span>
        {me && me !== author && (
          <button className={`tr-btn${iRead ? " ghost" : ""}`} onClick={toggle} disabled={busy} title={iRead ? "Take back your Read and understood" : "Say you have read and understood this version"}>
            {busy ? "…" : iRead ? "✓ Read and understood" : "Read and understood"}
          </button>
        )}
        <button className="tr-btn ghost" onClick={() => setOpen(!open)} aria-expanded={open}>💬 Notes{notes ? ` · ${notes}` : ""}</button>
      </div>
      {s.v2 === "off" && <p className="tr-muted">Ticks and notes here are saved on this device only until <code>{TEAM_ROOM.sqlFileV2}</code> runs.</p>}
      {err && <p className="tr-err">{err}</p>}
      {open && <div className="notes"><NotesThread kind="patch" id={note.version} owner={author} lines={lines} /></div>}
    </section>
  );
}

/** Small faces for the version list: who has read it. */
export function PatchRailFaces({ note }: { note: PatchMeta }) {
  const s = useTeamRoom();
  if (s.status !== "ready") return null;
  const readers = patchReaders(note, s.acks);
  return (
    <span className="tr-vars tr tr-railfaces" aria-label={`Read by ${readers.join(", ") || "nobody yet"}`}>
      {TEAM_PEOPLE.map((p) => <Av key={p} p={p} xs off={!readers.includes(p)} title={readers.includes(p) ? `${p} has read it` : `${p} hasn't yet`} />)}
    </span>
  );
}

/** A red dot on a version you still have to read (the phone's version pills). */
export function PatchUnreadDot({ note }: { note: PatchMeta }) {
  const s = useTeamRoom();
  if (s.status !== "ready" || !s.me) return null;
  const start = Date.parse(TEAM_ROOM.patchReceiptsFrom) || 0;
  const unread = (Date.parse(note.publishedAt) || 0) >= start && !patchReaders(note, s.acks).includes(s.me);
  return unread ? <span className="tr-vars tr-unreaddot" title="You haven't read this one yet" aria-label="Not read yet" /> : null;
}
