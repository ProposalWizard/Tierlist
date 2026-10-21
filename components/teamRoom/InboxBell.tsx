"use client";
/**
 * components/teamRoom/InboxBell.tsx — the Inbox: a bell, top right of every
 * framed admin page, with the number of patch notes you still have to read
 * (Harry, 21 Oct 2026: "we should also have notifications in an inbox for
 * everyone on patch notes they haven't read yet (not backlogged starting from
 * yesterday's)").
 *
 * Tap the bell: the list, newest first (from TEAM_ROOM.inboxFrom only; older
 * notes never appear). Tap a note: it opens on the Patch notes tab of the
 * Team area and counts as read: the same "Read and understood" receipt as
 * the button on the note (team_acks; on this device only until
 * team_room_v2.sql runs, and the list says so). "✓" marks one read without
 * opening it; "Mark all read" clears the list.
 *
 * It also asks the site, once per new version, to buzz the team's phones
 * about new patch notes (lib/teamRoom/push.ts ringNewPatches; who and when:
 * lib/teamRoom/inbox.ts).
 *
 * Notes under a patch note that @ you are in the Inbox too, above the notes
 * ("Mentions"); tapping one opens that version with its notes showing.
 *
 * Shown only to Harry, Mikey and Leo once they have picked their name in the
 * Team room (status ready + me). Testers and signed-out visitors see nothing.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { BUILT_IN_PATCH_NOTES } from "@/lib/patchNotesData";
import { TEAM_ROOM } from "@/lib/teamRoom/config";
import { patchAuthor, type PatchMeta } from "@/lib/teamRoom/extras";
import { bellCount, inboxFor, noteMentionsFor, noteSeenKey, shortPatchTitle } from "@/lib/teamRoom/inbox";
import { splitQuotes } from "@/lib/teamRoom/notify";
import { requestNotes } from "@/lib/teamRoom/patchQuote";
import { setAck, useTeamRoom } from "@/lib/teamRoom/store";
import { ringNewPatches } from "@/lib/teamRoom/push";
import { useAdminLook } from "@/lib/adminLook";
import { Av } from "./bits";
import "./teamRoom.css";

const META: PatchMeta[] = BUILT_IN_PATCH_NOTES.map((n) => ({ version: n.version, title: n.title, publishedAt: n.publishedAt }));
/** The event the Team board listens for, so a note opens in place there (no reload). */
export const OPEN_PATCH_EVENT = "kib-open-patch";

const day = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};

export default function InboxBell({ className }: { className?: string }) {
  const s = useTeamRoom();
  const look = useAdminLook();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const [top, setTop] = useState(56);
  useEffect(() => setMounted(true), []);

  const ready = s.status === "ready" && !!s.me;
  const list = useMemo(() => (ready ? inboxFor(META, s.me, s.acks) : []), [ready, s.me, s.acks]);
  const mentions = useMemo(() => (ready ? noteMentionsFor(s.notes, s.me, s.acks) : []), [ready, s.notes, s.me, s.acks]);

  // New patch notes in this deploy: ask the site to buzz the team (once per version per browser).
  useEffect(() => { if (ready) ringNewPatches(META[0]?.version); }, [ready]);

  useEffect(() => {
    if (!open) return;
    const r = btn.current?.getBoundingClientRect();
    if (r) setTop(Math.round(r.bottom + 8));
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open]);

  if (!ready) return null;
  const n = list.length + mentions.length;

  const markRead = async (v: string) => {
    setErr(null);
    const r = await setAck("patch", v, true);
    if (!r.ok) setErr(r.error);
    return r.ok;
  };
  const openNote = async (v: string, mention?: number) => {
    setOpen(false);
    if (mention) { void setAck("patch", noteSeenKey(mention), true); requestNotes(v); } else void markRead(v);
    const ev = new CustomEvent(OPEN_PATCH_EVENT, { detail: v, cancelable: true });
    window.dispatchEvent(ev);
    if (!ev.defaultPrevented) router.push(`${TEAM_ROOM.home}?tab=notes&v=${encodeURIComponent(v)}`);
  };
  const markAll = async () => {
    for (const m of mentions) if (!(await markRead(noteSeenKey(m.id)))) return;
    for (const p of list) if (!(await markRead(p.version))) break;
  };

  return (
    <>
      <button ref={btn} type="button" className={`tr-bell${className ? ` ${className}` : ""}`} data-on={n > 0 || undefined}
        onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="dialog"
        aria-label={n ? `Inbox: ${n} to read` : "Inbox: nothing to read"}
        title={n ? `${list.length} patch note${list.length === 1 ? "" : "s"} to read${mentions.length ? `, ${mentions.length} mention${mentions.length === 1 ? "" : "s"}` : ""}` : "Inbox: all read"}>
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {n > 0 && <span className="tr-bell-n">{bellCount(n)}</span>}
      </button>
      {open && mounted && createPortal(
        <div className="tr-vars tr" data-look={look}>
          <div className="tr-scrim tr-inbox-scrim" onClick={() => setOpen(false)} />
          <div className="tr-inbox" role="dialog" aria-label="Inbox" style={{ top }}>
            <div className="tr-inbox-h">
              <b>Inbox</b>
              <span className="tr-muted">{n ? [list.length ? `${list.length} patch note${list.length === 1 ? "" : "s"} to read` : "", mentions.length ? `${mentions.length} mention${mentions.length === 1 ? "" : "s"}` : ""].filter(Boolean).join(" · ") : "All read"}</span>
              {n > 1 && <button className="tr-btn ghost sm" onClick={markAll}>Mark all read</button>}
              <button className="tr-x" onClick={() => setOpen(false)} aria-label="Close">✕</button>
            </div>
            {n === 0 ? (
              <p className="tr-inbox-empty">You are up to date. New patch notes land here, and on your phone if notifications are on.</p>
            ) : (<>
              {mentions.length > 0 && (
                <ul className="tr-inbox-l" aria-label="Notes that mention you">
                  {mentions.map((m) => {
                    const { quotes, text } = splitQuotes(m.body);
                    return (
                      <li key={`n${m.id}`}>
                        <button className="tr-inbox-i" onClick={() => openNote(m.target_id, m.id)} title="Open the note (counts as seen)">
                          <Av p={m.person} sm />
                          <span className="t"><b>@ {m.person} on v{m.target_id}</b><small>{quotes[0] ? `“${quotes[0]}” · ` : ""}{text.slice(0, 90)}</small></span>
                        </button>
                        <button className="tr-inbox-ok" onClick={() => markRead(noteSeenKey(m.id))} aria-label="Mark this mention seen" title="Mark seen without opening">✓</button>
                      </li>
                    );
                  })}
                </ul>
              )}
              {list.length > 0 && <ul className="tr-inbox-l">
                {list.map((p) => {
                  const who = patchAuthor(p.title);
                  return (
                    <li key={p.version}>
                      <button className="tr-inbox-i" onClick={() => openNote(p.version)} title="Open it (counts as read)">
                        {who ? <Av p={who} sm /> : <span className="tr-av sm">?</span>}
                        <span className="t"><b>{shortPatchTitle(p.title)}</b><small>v{p.version} · {who ?? "Team"} · {day(p.publishedAt)}</small></span>
                      </button>
                      <button className="tr-inbox-ok" onClick={() => markRead(p.version)} aria-label={`Mark v${p.version} read`} title="Mark read without opening">✓</button>
                    </li>
                  );
                })}
              </ul>}
            </>)}
            {s.v2 === "off" && <p className="tr-muted tr-inbox-foot">Read marks are kept on this device only until <code>{TEAM_ROOM.sqlFileV2}</code> runs.</p>}
            {err && <p className="tr-err tr-inbox-foot">{err}</p>}
            <p className="tr-muted tr-inbox-foot">Patch notes from {day(TEAM_ROOM.inboxFrom)} on. Opening one marks it &ldquo;Read and understood&rdquo;.</p>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
