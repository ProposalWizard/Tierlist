'use client'

import { useState } from 'react'
import { Check, ChevronDown, Lightbulb, ScanSearch, X } from './icons'
import { tc } from '@/lib/studio/schema'
import { QC_LABEL, type QcCheckRow, type QcFlag, type QcState, type TasteNote } from '@/lib/studio/qc'

/**
 * The AUTO-QC inspector and the TASTE NOTES (Harry, 2026-10-20: "the auto QC track, the taste, and things that just
 * propose changes"). Rules and shapes: lib/studio/qc.ts (made by scripts/marketing/studio-prep.py).
 *   QcInspector  opens when an amber block on the QC lane is tapped: what was found, why, the ONE proposed change,
 *                "Accept as edit" (an ordinary edit for Claude, same flow as tapping a track) or "Dismiss".
 *   TasteNotes   up to 3 proposals from our own past notes and the Knowitball client rules, each naming its source:
 *                "Accept as review note" / "Accept as edit for Claude" / "Dismiss". Gone once answered.
 */
export function QcInspector({
  flag,
  state,
  check,
  saving,
  onAccept,
  onDismiss,
  onClose,
}: {
  flag: QcFlag
  state: QcState | null
  check?: QcCheckRow
  saving: boolean
  onAccept: () => void
  onDismiss: () => void
  onClose: () => void
}) {
  return (
    <div
      className="mt-3 rounded-lg border-2 border-mid bg-surface p-3 max-lg:[&_button]:scroll-mb-[76px] max-lg:[&_button]:scroll-mt-[calc(38dvh+230px)]"
      data-qc-inspector={flag.id}
      aria-label={`Auto-QC: ${flag.title}`}
    >
      <div className="flex items-start gap-2">
        <ScanSearch className="mt-0.5 h-5 w-5 shrink-0 text-mid" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-1.5 text-micro font-semibold text-ink-muted">
            <span>Auto-QC · {QC_LABEL[flag.check]}</span>
            {flag.confidence === 'possible' && <span className="rounded-full border border-dashed border-mid px-1.5 text-mid">Possible</span>}
            <span className="tabular-nums">
              {tc(flag.start)} to {tc(flag.end)}
            </span>
          </p>
          <p className="mt-0.5 text-label font-semibold text-ink" data-qc-title>
            {flag.title}
          </p>
        </div>
        <button type="button" onClick={onClose} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-ink-muted hover:text-ink" aria-label="Close the QC flag">
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-1.5 text-caption text-ink-secondary" data-qc-reason>
        {flag.reason}
      </p>
      <div className="mt-1.5 rounded-md bg-surface-raised px-3 py-1.5">
        <p className="text-micro font-semibold text-ink-muted">Proposed change</p>
        <p className="mt-0.5 text-caption font-semibold text-ink" data-qc-proposal>
          {flag.proposal}
        </p>
      </div>
      {flag.lesson && (
        <p className="mt-2 text-micro text-ink-muted" data-qc-lesson>
          Rule {flag.lesson.n}: {flag.lesson.title}.
        </p>
      )}
      {check?.how && (
        <details className="mt-2 text-micro text-ink-muted">
          <summary className="cursor-pointer select-none">How it checks</summary>
          <p className="mt-1">{check.how}</p>
          {check.rule && <p className="mt-1 font-mono">{check.rule}</p>}
        </details>
      )}
      {state === 'accepted' ? (
        <p className="mt-3 flex items-center gap-1.5 text-caption font-semibold text-ink" data-qc-accepted>
          <Check className="h-4 w-4 text-good" aria-hidden /> Accepted: it is an edit for Claude now.
        </p>
      ) : (
        <div className="sticky bottom-0 z-10 -mx-3 -mb-3 mt-3 grid grid-cols-[1fr_auto] gap-2 rounded-b-lg bg-surface px-3 pt-1 pb-[max(12px,env(safe-area-inset-bottom))]">
          <button
            type="button"
            disabled={saving}
            onClick={onAccept}
            className="flex h-11 items-center justify-center gap-1.5 rounded-md bg-toclaude text-label font-semibold text-floor disabled:opacity-40"
            data-qc-accept
          >
            <Check className="h-4 w-4" aria-hidden /> Accept as edit
          </button>
          <button type="button" disabled={saving} onClick={onDismiss} className="h-11 rounded-md border border-outline px-4 text-label font-semibold text-ink-secondary hover:text-ink disabled:opacity-40" data-qc-dismiss>
            Dismiss
          </button>
        </div>
      )}
    </div>
  )
}

export function TasteNotes({
  notes,
  saving,
  onSeek,
  onNote,
  onEdit,
  onDismiss,
}: {
  notes: TasteNote[]
  saving: boolean
  onSeek: (t: number) => void
  onNote: (t: TasteNote) => void
  onEdit: (t: TasteNote) => void
  onDismiss: (t: TasteNote) => void
}) {
  const [open, setOpen] = useState(true)
  if (!notes.length) return null
  return (
    <section className="mt-3 rounded-lg border border-outline bg-surface-raised" aria-label="Taste notes" data-taste-notes>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center gap-2 px-3 py-2 text-left">
        <Lightbulb className="h-4 w-4 shrink-0 text-mid" aria-hidden />
        <span className="whitespace-nowrap text-label font-semibold text-ink">Taste notes</span>
        <span className="rounded-full bg-surface px-1.5 text-micro text-ink-muted">{notes.length}</span>
        <span className="ml-auto min-w-0 truncate text-micro text-ink-muted max-sm:hidden">From our past notes and the Knowitball rules</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-ink-muted transition-transform duration-fast max-sm:ml-auto ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {open && (
        <ul className="space-y-2 border-t border-outline p-2">
          {notes.map((t) => (
            <li key={t.id} className="rounded-md bg-surface p-3" data-taste-note={t.id}>
              <div className="flex items-start gap-2">
                <button type="button" onClick={() => onSeek(t.start)} className="shrink-0 rounded-sm font-mono text-micro tabular-nums text-ink-muted hover:text-ink" aria-label={`Go to ${tc(t.start)}`}>
                  {tc(t.start)}
                </button>
                <div className="min-w-0 flex-1">
                  <p className="text-caption font-semibold text-ink">{t.note}</p>
                  <p className="mt-0.5 text-micro text-ink-muted">{t.why}</p>
                  <p className="mt-0.5 text-micro font-semibold text-ink-secondary" data-taste-source>
                    From {t.source.label}
                  </p>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="text-micro text-ink-muted">Accept as</span>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => onNote(t)}
                  aria-label="Accept as review note"
                  className="inline-flex h-9 items-center rounded-full bg-tonote px-3 text-caption font-semibold text-floor disabled:opacity-40"
                  data-taste-note-btn
                >
                  Review note
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => onEdit(t)}
                  aria-label="Accept as edit for Claude"
                  className="inline-flex h-9 items-center rounded-full bg-toclaude px-3 text-caption font-semibold text-floor disabled:opacity-40"
                  data-taste-edit-btn
                >
                  Edit for Claude
                </button>
                <button type="button" disabled={saving} onClick={() => onDismiss(t)} className="ml-auto h-9 rounded-md px-2 text-caption font-semibold text-ink-muted hover:text-ink disabled:opacity-40" data-taste-dismiss>
                  Dismiss
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
