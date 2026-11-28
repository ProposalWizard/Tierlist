"use client";
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { CareerState } from "@/lib/star/types";
import {
  ANON_SCOPE, careerFromBackup, listCareerBackups, restoreCareerBackup,
  type CareerBackup,
} from "@/lib/star/storage";
import { backupDownload, backupRows, whenWords, type BackupRow } from "@/lib/star/saveBackups";
import { PressButton, rgba } from "./ui";

/**
 * SAVES → BACKUPS (Harry, 28 Nov 2026: saves "cooked — completely different
 * on my phone and pc"). One save slot's backups, newest first, as a
 * full-screen page (a chooser's list is a full page, never a sheet: house
 * style, 18 Oct 2026). Each row: where it is kept, when, the career's
 * headline and one "what changed" line. "Restore this" asks on the screen
 * first (no browser box: it exits full screen), keeps the save there now
 * as a backup, then makes the chosen one the save. Undo is offered straight
 * after. "Download" gives the backup as a JSON file. Nothing is deleted.
 *
 * The rows are lib/star/saveBackups.ts; the restore is storage.ts
 * restoreCareerBackup.
 */

interface Props {
  accountScope: string;
  slot: number;
  /** The career on screen when `slot` is the one being played, else null
   *  (the stored save is read instead). */
  current: CareerState | null;
  /** Read the slot's stored save (storage.ts peekSlotCareer). */
  readSlot: (slot: number) => CareerState | null;
  glow?: string;
  /** Close the page. `restored`: a restore or undo happened while open. */
  onClose: (restored: CareerState | null) => void;
  /** A restore (or undo) just made `career` the save in `slot`. */
  onRestored?: (slot: number, career: CareerState) => void;
  /** For a test page: a fixed clock, so stills read the same every time. */
  now?: number;
}

type Done = { kind: "restored" | "undone"; career: CareerState; undoId: string | null; fromAt: number };

function signedIn(scope: string): boolean {
  return scope !== ANON_SCOPE && !scope.startsWith(`${ANON_SCOPE}#`);
}

function nameOf(c: CareerState | null): string {
  return c ? `${c.player.firstName} ${c.player.lastName}`.trim() : "";
}

function headlineOf(c: CareerState | null): string {
  if (!c) return "empty";
  const club = c.player.club && c.league?.length ? c.player.club : "no club yet";
  return `${nameOf(c)}, ${club}, Season ${c.season}`;
}

function download(b: CareerBackup) {
  try {
    const { filename, text } = backupDownload(b);
    const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } catch { /* a browser that will not download: nothing changes */ }
}

export default function SaveBackupsView({ accountScope, slot, current, readSlot, glow = "#10b981", onClose, onRestored, now: fixedNow }: Props) {
  const [version, setVersion] = useState(0);
  const [asking, setAsking] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [onScreen, setOnScreen] = useState<CareerState | null>(current);
  const [lastRestored, setLastRestored] = useState<CareerState | null>(null);
  const now = fixedNow ?? Date.now();
  const online = signedIn(accountScope);

  const backups = useMemo(() => listCareerBackups(accountScope), [accountScope, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const slotNow = useMemo(() => onScreen ?? readSlot(slot), [onScreen, readSlot, slot, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const rows: BackupRow[] = useMemo(
    () => backupRows(backups, slot, (b) => careerFromBackup(b as CareerBackup), slotNow),
    [backups, slot, slotNow],
  );
  const byId = useMemo(() => new Map(backups.map((b) => [b.id, b])), [backups]);

  const restore = (id: string, kind: Done["kind"]) => {
    const fromAt = byId.get(id)?.at ?? now;
    const r = restoreCareerBackup(accountScope, id, slotNow, fixedNow ?? Date.now());
    setAsking(null);
    if (!r.ok) { setError(r.why); return; }
    setError(null);
    setOnScreen(r.career);
    setLastRestored(r.career);
    setDone({ kind, career: r.career, undoId: kind === "restored" ? r.kept?.id ?? null : null, fromAt });
    setVersion((v) => v + 1);
    onRestored?.(r.slot, r.career);
  };

  const askingRow = asking ? rows.find((r) => r.id === asking) : null;

  // Drawn on the page itself, not inside the Saves card: a glass card's
  // blur would otherwise pin a full-screen layer inside the card.
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      data-backups-view
      className="fixed inset-0 z-[80] flex flex-col overflow-hidden text-white"
      style={{ background: "linear-gradient(180deg, #0b1424, #070c16 60%, #05080f)" }}
    >
      <div className="flex items-center gap-2 px-4 pb-2 pt-[max(14px,env(safe-area-inset-top))]" style={{ boxShadow: "inset 0 -1px 0 rgba(255,255,255,.08)" }}>
        <div className="min-w-0 flex-1">
          <div className="text-[17px] font-black leading-tight">Save {slot} backups</div>
          <div className="text-[11px] font-semibold leading-snug text-white/85">
            {rows.length ? `${rows.length} kept, newest first` : "None kept yet"}
          </div>
        </div>
        <button
          data-backups-close
          aria-label="Close"
          onClick={() => onClose(lastRestored)}
          className="kib-press grid h-10 w-10 place-items-center rounded-xl text-[18px] font-black"
          style={{ background: "rgba(255,255,255,.08)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.16)" }}
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-8 pt-3">
        <p data-backups-where className="text-[11px] font-semibold leading-snug text-white/90">
          Backups are kept on this device only for now. Your account keeps just the latest save.
        </p>

        {done && (
          <div data-backups-done={done.kind} role="status" className="mt-3 rounded-xl p-3" style={{ background: "linear-gradient(180deg, rgba(16,185,129,.24), rgba(16,185,129,.1))", boxShadow: "inset 0 0 0 1px rgba(52,211,153,.6)" }}>
            <p className="text-[13px] font-black leading-snug">
              {done.kind === "restored" ? "Restored." : "Undone."} Save {slot} is now {headlineOf(done.career)}.
            </p>
            <p className="mt-1 text-[11px] font-semibold leading-snug text-white/90">
              {done.kind === "restored"
                ? `Your save before this is at the top of the list${online ? ". Your other devices get this one next time they open the game" : ""}.`
                : `The backup you restored is still in the list${online ? ". Your other devices get this one next time they open the game" : ""}.`}
            </p>
            {done.undoId && (
              <PressButton data-backups-undo variant="secondary" size="none" onClick={() => restore(done.undoId!, "undone")} className="mt-2 w-full rounded-lg py-2 text-[12px] font-black">
                Undo
              </PressButton>
            )}
          </div>
        )}

        {error && (
          <p role="alert" className="mt-3 rounded-xl bg-amber-500/20 p-3 text-[12px] font-black leading-snug text-amber-100" style={{ boxShadow: "inset 0 0 0 1px rgba(251,191,36,.5)" }}>
            {error}
          </p>
        )}

        {!rows.length && (
          <p className="mt-6 text-center text-[13px] font-bold leading-snug text-white/90">
            When the game stops using a copy of this save, it keeps it here.
          </p>
        )}

        <div className="mt-3 space-y-2">
          {rows.map((r, i) => {
            const b = byId.get(r.id);
            return (
              <div
                key={r.id}
                data-backup-row={i}
                className="rounded-xl p-3"
                style={{ background: "linear-gradient(180deg, rgba(255,255,255,.07), rgba(255,255,255,.025))", boxShadow: `inset 0 1px 0 rgba(255,255,255,.07), inset 0 0 0 1px ${asking === r.id ? rgba(glow, 0.8) : "rgba(255,255,255,.08)"}` }}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[12px] font-black tabular-nums">{whenWords(r.at, now)}</span>
                  <span className="shrink-0 text-[10px] font-bold text-white/80">{r.whereWords}</span>
                </div>
                <div className="mt-1 truncate text-[14px] font-black leading-tight">{r.playerName}</div>
                <div className="text-[11.5px] font-bold leading-snug">
                  {r.club ?? "No club yet"} · Season {r.season}
                  {r.age !== null ? ` · Age ${r.age}` : ""}
                  {r.stars !== null ? <> · <span className="text-yellow-200">★{r.stars}</span></> : null}
                </div>
                <div className="mt-1 text-[11px] font-semibold leading-snug text-sky-200">{r.change}</div>
                <div className="text-[10.5px] font-semibold leading-snug text-white/75">{r.why}</div>

                {asking === r.id && askingRow ? (
                  <div data-backups-confirm className="mt-2.5 rounded-lg p-2.5" style={{ background: "rgba(3,7,18,.55)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.12)" }}>
                    <p className="text-[13px] font-black leading-snug">Restore this backup?</p>
                    <ol className="mt-1.5 list-decimal space-y-1 pl-4 text-[11.5px] font-semibold leading-snug">
                      <li>{slotNow ? <>Your save now ({headlineOf(slotNow)}) is kept as a backup first.</> : <>Save {slot} is empty, so there is nothing to keep first.</>}</li>
                      <li>Then this backup ({askingRow.playerName}, Season {askingRow.season}, {whenWords(askingRow.at, now)}) becomes Save {slot}.</li>
                      <li>{online ? "It replaces the online copy, so it becomes Save " + slot + " on every device you sign in on." : "You are not signed in, so this changes this device only."}</li>
                      <li>You can undo it straight after, and nothing is deleted.</li>
                    </ol>
                    <div className="mt-2.5 grid grid-cols-2 gap-2">
                      <PressButton data-backups-cancel variant="secondary" size="none" onClick={() => setAsking(null)} className="rounded-lg py-2 text-[12px] font-black">
                        Cancel
                      </PressButton>
                      <PressButton data-backups-yes variant="primary" size="none" onClick={() => restore(r.id, "restored")} className="rounded-lg py-2 text-[12px] font-black">
                        Restore
                      </PressButton>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2.5 grid grid-cols-2 gap-2">
                    <PressButton
                      data-backups-restore={i}
                      variant="primary"
                      size="none"
                      disabled={!r.readable}
                      onClick={() => { setDone(null); setError(null); setAsking(r.id); }}
                      className="rounded-lg py-2 text-[12px] font-black"
                    >
                      Restore this
                    </PressButton>
                    <PressButton
                      data-backups-download={i}
                      variant="secondary"
                      size="none"
                      onClick={() => { if (b) download(b); }}
                      className="rounded-lg py-2 text-[12px] font-black"
                    >
                      Download
                    </PressButton>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.querySelector(".star-root") ?? document.body,
  );
}
