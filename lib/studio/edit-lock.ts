/**
 * Lock & render + Done, the pure rules behind the Studio's editing suite (ported 22 Oct 2026).
 *
 * Harry's spec, verbatim: "when i've decided on an edit that section of the video get's blurred out to an 'in edit'
 * phase and I can't comment on it anymore and the rest continues - we can still have the done giving edits button
 * especially if it's like a full feedback in one go".
 *
 * PURE ON PURPOSE (no fs, no React): the page and the tests use the same code.
 */
import { isOpenEdit, type EditEntry, type SuiteRequest, type RenderProgress, type ReviewComment } from './schema'

/** A new edit id: `e-<base36 ms>-<4 chars>`. */
export function newEditId(now: number = Date.now(), rand: () => number = Math.random): string {
  let tail = ''
  while (tail.length < 4) tail += Math.floor(rand() * 36).toString(36)
  return `e-${now.toString(36)}-${tail.slice(0, 4)}`
}

/** Give every edit an id (old edits saved before ids existed get one on the next save). Never changes an existing id. */
export function withIds(edits: EditEntry[], make: () => string = () => newEditId()): EditEntry[] {
  const seen = new Set<string>()
  return edits.map((e) => {
    if (e.id && !seen.has(e.id)) {
      seen.add(e.id)
      return e
    }
    let id = make()
    while (seen.has(id)) id = make()
    seen.add(id)
    return { ...e, id }
  })
}

export type Range = { start: number; end: number }

/** The range an edit covers on the timeline (a point edit covers a short beat so it can be seen and locked). */
export function editRange(e: Pick<EditEntry, 'type' | 'start' | 'end'>, beat = 0.5): Range | null {
  if (e.type === 'general' || e.start === undefined) return null
  const end = e.end !== undefined && e.end > e.start ? e.end : e.start + beat
  return { start: e.start, end }
}

/** Two ranges share any time (touching ends do not count). */
export function overlaps(a: Range, b: Range): boolean {
  return a.start < b.end - 1e-6 && b.start < a.end - 1e-6
}

/** An edit is "in edit" (locked) from the moment Harry locks it until Claude applies or undoes it. */
export function isLocked(e: Pick<EditEntry, 'locked_at' | 'status'>): boolean {
  return !!e.locked_at && isOpenEdit(e)
}

export type LockedRange = Range & { n: number; id?: string }

/** Every locked edit's range: blurred on the player and the timeline, and closed to new notes and edits. */
export function lockedRanges(edits: EditEntry[]): LockedRange[] {
  const out: LockedRange[] = []
  for (const e of edits) {
    if (!isLocked(e)) continue
    const r = editRange(e)
    if (r) out.push({ ...r, n: e.n, ...(e.id ? { id: e.id } : {}) })
  }
  return out.sort((a, b) => a.start - b.start)
}

/** The locked range a new note or edit would land on (null = free). `ignoreN` skips the edit being changed. */
export function lockClash(r: Range, locked: LockedRange[], ignoreN?: number): LockedRange | null {
  return locked.find((l) => l.n !== ignoreN && overlaps(r, l)) ?? null
}

/** The locked range under the playhead, if any (the player shows "In edit" over the picture). */
export function lockedAt(t: number, locked: LockedRange[]): LockedRange | null {
  return locked.find((l) => t >= l.start - 1e-6 && t < l.end) ?? null
}

/** Can this edit be locked now? Open, has a range, not already locked, not an undo. */
export function canLock(e: EditEntry): boolean {
  return isOpenEdit(e) && e.status !== 'undo_requested' && !e.locked_at && editRange(e) !== null
}

/** The edits Done renders: every open edit that is not an undo request. */
export function doneSet(edits: EditEntry[]): EditEntry[] {
  return edits.filter((e) => isOpenEdit(e) && e.status !== 'undo_requested')
}

export type EditPhase =
  | { kind: 'queued' } // saved, collected, waiting for Lock or Done
  | { kind: 'edited' } // changed after it was sent
  | { kind: 'sent'; via: 'lock' | 'done'; at: string } // the request is saved; Claude has not reported yet
  | { kind: 'rendering'; pct: number; step: string; eta: string }
  | { kind: 'rendered'; url: string } // the render finished; Claude marks the edit applied next
  | { kind: 'failed'; step: string }
  | { kind: 'applied' }
  | { kind: 'undo_requested' }
  | { kind: 'undone' }

/** Does this request or render cover this edit? By id when both have one (the reliable path), never by guess. */
function covers(ids: string[] | undefined, e: EditEntry): boolean {
  return !!e.id && !!ids && ids.includes(e.id)
}

/**
 * Where one edit stands, for its card and the progress bar "where the edit was". Order: what Claude has written last
 * (status, then the render file), then the newest pending request that names it.
 */
export function editPhase(e: EditEntry, requests: SuiteRequest[], render: RenderProgress | null): EditPhase {
  if (e.status === 'applied') return { kind: 'applied' }
  if (e.status === 'undone') return { kind: 'undone' }
  if (e.status === 'undo_requested') return { kind: 'undo_requested' }
  if (render && covers(render.ids, e)) {
    if (render.status === 'rendering' || render.status === 'queued')
      return {
        kind: 'rendering',
        pct: render.pct,
        step: render.step,
        eta: render.eta,
      }
    if (render.status === 'done') return { kind: 'rendered', url: render.version_url }
    if (render.status === 'failed') return { kind: 'failed', step: render.step }
  }
  const req = requests.filter((r) => (r.type === 'render_one' || r.type === 'render_all') && r.status === 'pending' && covers(r.ids, e)).sort((a, b) => (a.created < b.created ? 1 : -1))[0]
  if (req)
    return {
      kind: 'sent',
      via: req.type === 'render_one' ? 'lock' : 'done',
      at: req.created,
    }
  if (e.locked_at) return { kind: 'sent', via: 'lock', at: e.locked_at }
  if (e.edited_at) return { kind: 'edited' }
  return { kind: 'queued' }
}

/** A short plain-English chip for a phase (no em dashes: apple-grade-ui ban 12). */
export function phaseLabel(p: EditPhase): string {
  switch (p.kind) {
    case 'queued':
      return 'Queued'
    case 'edited':
      return 'Edited'
    case 'sent':
      return p.via === 'lock' ? 'In edit' : 'Sent to Claude'
    case 'rendering':
      return `In edit · ${p.pct}%`
    case 'rendered':
      return 'Rendered'
    case 'failed':
      return 'Render failed'
    case 'applied':
      return 'Applied'
    case 'undo_requested':
      return 'Undo asked'
    case 'undone':
      return 'Undone'
  }
}

/** The review notes the suite shows (a note marked deleted is left out). */
export function visibleNotes(cs: ReviewComment[]): ReviewComment[] {
  return cs.filter((c) => !(c as { deleted?: unknown }).deleted)
}
