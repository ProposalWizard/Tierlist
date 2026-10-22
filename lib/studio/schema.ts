/**
 * lib/studio/schema.ts — the Studio's editing suite: the shapes of one cut's
 * notes and edits (ported 22 Oct 2026 from the editing suite in Harry's other
 * app, with every client part and every outside service taken out).
 *
 * PURE ON PURPOSE: the page and the API routes check with the same code.
 * One cut = one video in the Marketing storage (Cloudflare R2). Everything the
 * suite saves for that cut lives in ONE small JSON beside the video:
 *   videos/<card>/<file>.mp4.suite.json  {review, edits, requests, render}
 * (lib/studio/store.ts reads and writes it).
 *
 *   review.comments  REVIEW notes (fix / keep / check): what is wrong or right
 *                    at a moment, for whoever is cutting the video.
 *   edits.edits      EDIT notes for Claude (cut / at / general). Claude makes
 *                    the change, then marks the edit applied.
 */
import { parseElement, type EditElement } from './elements'
import { QC_ID_REGEX, parseQcAnswers, type QcAnswer, type QcKind } from './qc'

export const REVIEW_TAGS = ['fix', 'keep', 'check'] as const
export type ReviewTag = (typeof REVIEW_TAGS)[number]

/**
 * cut     = a range to remove
 * at      = a change pinned to a moment (start, optional end)
 * general = a change for the whole video (no time)
 */
export const EDIT_TYPES = ['cut', 'at', 'general'] as const
export type EditType = (typeof EDIT_TYPES)[number]

export const MAX_COMMENTS = 500
export const MAX_EDITS = 500
export const MAX_NOTE = 2000
/** Ten hours. A timestamp past this is a typo, not a real cut. */
export const MAX_SECONDS = 36_000

export type ReviewComment = {
  n: number
  start: number
  end: number
  tag: ReviewTag
  note: string
  /** Who wrote it (first name), when known. */
  author?: string
}

/** Render progress: Claude writes it while it makes a new version (node scripts/marketing/suite-notes.mjs render). */
export const RENDER_STATUSES = ['queued', 'rendering', 'done', 'failed'] as const
export type RenderStatus = (typeof RENDER_STATUSES)[number]
export type RenderProgress = { status: RenderStatus; pct: number; step: string; eta: string; version_url: string; at: string; ids: string[] }

export function parseRenderProgress(raw: unknown): RenderProgress | null {
  if (!isObj(raw) || !(RENDER_STATUSES as readonly unknown[]).includes(raw.status)) return null
  const pct = typeof raw.pct === 'number' && Number.isFinite(raw.pct) ? Math.min(100, Math.max(0, Math.round(raw.pct))) : raw.status === 'done' ? 100 : 0
  const url = typeof raw.version_url === 'string' && /^(https:\/\/|\/)/.test(raw.version_url) ? raw.version_url.slice(0, 500) : ''
  const ids = Array.isArray(raw.ids) ? raw.ids.filter((x): x is string => typeof x === 'string').slice(0, 200).map((x) => x.slice(0, 80)) : []
  return { status: raw.status as RenderStatus, pct, step: typeof raw.step === 'string' ? oneLine(raw.step, 120) : '', eta: typeof raw.eta === 'string' ? oneLine(raw.eta, 40) : '', version_url: url, at: typeof raw.at === 'string' ? raw.at.slice(0, 40) : '', ids }
}

/** One spoken line: its time, its text, and each word's time ([start, end, word]). */
export type TranscriptLine = { start: number; end: number; text: string; words: [number, number, string][] }
export type Transcript = { model: string; segments: TranscriptLine[] }

/** Lenient: bad lines are dropped, never fatal (the file is written by a script). */
export function parseTranscript(raw: unknown): Transcript | undefined {
  if (!isObj(raw) || !Array.isArray(raw.segments)) return undefined
  const segments: TranscriptLine[] = []
  for (const g of raw.segments.slice(0, 2000)) {
    if (!isObj(g)) continue
    const s = time(g.start)
    const e = time(g.end)
    if (s === null || e === null || typeof g.text !== 'string') continue
    const words: [number, number, string][] = []
    if (Array.isArray(g.words))
      for (const w of g.words) {
        if (!Array.isArray(w) || w.length < 3) continue
        const ws = time(w[0])
        const we = time(w[1])
        if (ws !== null && we !== null && typeof w[2] === 'string') words.push([ws, we, oneLine(w[2], 60)])
      }
    segments.push({ start: s, end: e, text: oneLine(g.text, 600), words })
  }
  return segments.length ? { model: typeof raw.model === 'string' ? oneLine(raw.model, 60) : '', segments } : undefined
}

export type Review = {
  /** What is said, for the line of words under the timeline (scripts/marketing/studio-prep.py, when it can transcribe). */
  transcript?: Transcript
  /** The video's title on the page: "v02 · Goalie Mode". */
  concept: string
  /** "v3 · 0:44", or the file name. */
  version: string
  label?: string
  /** Answers to the auto-QC flags and taste notes, by id. */
  qc_answers?: Record<string, QcAnswer>
  comments: ReviewComment[]
}

export type EditEntry = {
  n: number
  type: EditType
  /** Seconds. Absent on a `general` entry. */
  start?: number
  end?: number
  text: string
  /** ISO time the entry was first saved. */
  created?: string
  /** sent = Claude has been told; applied = Claude made the change (Claude sets it). */
  status?: EditStatus
  sent_at?: string
  applied_at?: string
  /** When the edit's text or times were changed after saving: it goes to Claude again, marked edited. */
  edited_at?: string
  /** "Undo this edit" on an applied edit (status undo_requested; Claude sets undone). */
  undo_at?: string
  /** A stable id (`e-<base36 time>-<4 chars>`), so a render request can name exactly which edits it covers. */
  id?: string
  /** Lock & render: nothing new may overlap a locked edit's range until Claude applies it. */
  locked_at?: string
  /** A change picked on a lane (a shot, the sound, a caption): rules in lib/studio/elements.ts. */
  element?: EditElement
  /** Accepted from the auto-QC lane or a taste note (lib/studio/qc.ts). */
  qc?: { id: string; kind: QcKind }
}
export const EDIT_ID_REGEX = /^e-[a-z0-9]{4,16}-[a-z0-9]{2,8}$/
export const EDIT_STATUSES = ['sent', 'applied', 'undo_requested', 'undone'] as const
export type EditStatus = (typeof EDIT_STATUSES)[number]
/** Still waiting on Claude: not yet applied, or an undo Claude has not done yet. */
export function isOpenEdit(e: Pick<EditEntry, 'status'>): boolean {
  return e.status !== 'applied' && e.status !== 'undone'
}
/** An edit changed after saving: drop its Claude status so it goes to Claude again, marked edited. */
export function markEdited<T extends EditEntry>(e: T, at: string = new Date().toISOString()): T {
  const { status: _s, sent_at: _st, applied_at: _ap, undo_at: _u, ...rest } = e
  void _s, void _st, void _ap, void _u
  return { ...(rest as T), edited_at: at }
}

/** A new version Claude made from the edits: another video key in the storage. */
export type EditRender = { key: string; created: string; cuts: number; duration?: number }
export type EditList = { edits: EditEntry[]; renders: EditRender[] }

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string }

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function oneLine(s: string, max: number): string {
  // Keep line breaks inside a note, drop other control characters.
  // eslint-disable-next-line no-control-regex
  return s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, max)
}

function time(v: unknown): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > MAX_SECONDS) return null
  return Math.round(v * 100) / 100
}

/** One range; end before start is swapped rather than refused (a drag can go either way). */
function range(start: unknown, end: unknown): { start: number; end: number } | null {
  const s = time(start)
  const e = time(end ?? start)
  if (s === null || e === null) return null
  return s <= e ? { start: s, end: e } : { start: e, end: s }
}

/** Number any entry without a usable `n`, keeping existing numbers stable. */
function renumber<T extends { n: number }>(items: (Omit<T, 'n'> & { n: number | null })[]): T[] {
  const used = new Set<number>()
  for (const it of items) if (it.n !== null) used.add(it.n)
  let next = Math.max(0, ...Array.from(used)) + 1
  const seen = new Set<number>()
  return items.map((it) => {
    let n = it.n
    if (n === null || seen.has(n)) n = next++
    seen.add(n)
    return { ...it, n } as unknown as T
  })
}

export function parseComments(raw: unknown): Parsed<ReviewComment[]> {
  if (!Array.isArray(raw)) return { ok: false, error: 'comments must be a list.' }
  if (raw.length > MAX_COMMENTS) return { ok: false, error: `Too many notes (max ${MAX_COMMENTS}).` }
  const out: (Omit<ReviewComment, 'n'> & { n: number | null })[] = []
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i]
    if (!isObj(c)) return { ok: false, error: `Note ${i + 1} is not an object.` }
    const r = range(c.start, c.end)
    if (!r) return { ok: false, error: `Note ${i + 1} needs a start and end in seconds.` }
    const tag = typeof c.tag === 'string' && (REVIEW_TAGS as readonly string[]).includes(c.tag) ? (c.tag as ReviewTag) : null
    if (!tag) return { ok: false, error: `Note ${i + 1} tag must be fix, keep or check.` }
    const note = typeof c.note === 'string' ? oneLine(c.note, MAX_NOTE) : ''
    if (!note) return { ok: false, error: `Note ${i + 1} has no text.` }
    const n = typeof c.n === 'number' && Number.isInteger(c.n) && c.n > 0 && c.n < 100_000 ? c.n : null
    out.push({ n, ...r, tag, note, ...(typeof c.author === 'string' && c.author.trim() ? { author: oneLine(c.author, 40) } : {}) })
  }
  return { ok: true, value: renumber<ReviewComment>(out) }
}

export function parseReview(raw: unknown): Parsed<Review> {
  if (!isObj(raw)) return { ok: false, error: 'A review must be a JSON object.' }
  const comments = parseComments(raw.comments ?? [])
  if (!comments.ok) return comments
  const review: Review = {
    concept: typeof raw.concept === 'string' ? oneLine(raw.concept, 200) : '',
    version: typeof raw.version === 'string' ? oneLine(raw.version, 200) : '',
    comments: comments.value,
  }
  if (typeof raw.label === 'string' && raw.label.trim()) review.label = oneLine(raw.label, 40)
  const qa = parseQcAnswers(raw.qc_answers)
  if (Object.keys(qa).length) review.qc_answers = qa
  const tr = parseTranscript(raw.transcript)
  if (tr) review.transcript = tr
  return { ok: true, value: review }
}

/** The Claude-status fields an edit may carry (kept through every save). */
function editMeta(e: Record<string, unknown>): Pick<EditEntry, 'status' | 'sent_at' | 'applied_at' | 'edited_at' | 'undo_at' | 'id' | 'locked_at' | 'element' | 'qc'> {
  const o: Pick<EditEntry, 'status' | 'sent_at' | 'applied_at' | 'edited_at' | 'undo_at' | 'id' | 'locked_at' | 'element' | 'qc'> = {}
  const el = parseElement(e.element)
  if (el) o.element = el
  const q = e.qc
  if (isObj(q) && typeof q.id === 'string' && QC_ID_REGEX.test(q.id) && (q.kind === 'qc' || q.kind === 'taste')) o.qc = { id: q.id, kind: q.kind }
  if (typeof e.id === 'string' && EDIT_ID_REGEX.test(e.id)) o.id = e.id
  if (typeof e.locked_at === 'string') o.locked_at = e.locked_at.slice(0, 40)
  if ((EDIT_STATUSES as readonly unknown[]).includes(e.status)) o.status = e.status as EditStatus
  if (typeof e.sent_at === 'string') o.sent_at = e.sent_at.slice(0, 40)
  if (typeof e.applied_at === 'string') o.applied_at = e.applied_at.slice(0, 40)
  if (typeof e.edited_at === 'string') o.edited_at = e.edited_at.slice(0, 40)
  if (typeof e.undo_at === 'string') o.undo_at = e.undo_at.slice(0, 40)
  return o
}

export function parseEditEntries(raw: unknown, now: string = new Date().toISOString()): Parsed<EditEntry[]> {
  if (!Array.isArray(raw)) return { ok: false, error: 'edits must be a list.' }
  if (raw.length > MAX_EDITS) return { ok: false, error: `Too many edits (max ${MAX_EDITS}).` }
  const out: (Omit<EditEntry, 'n'> & { n: number | null })[] = []
  for (let i = 0; i < raw.length; i++) {
    const e = raw[i]
    if (!isObj(e)) return { ok: false, error: `Edit ${i + 1} is not an object.` }
    const rawType = e.type === 'note' ? 'at' : e.type
    const type = typeof rawType === 'string' && (EDIT_TYPES as readonly string[]).includes(rawType) ? (rawType as EditType) : null
    if (!type) return { ok: false, error: `Edit ${i + 1} type must be cut, at or general.` }
    const text = typeof e.text === 'string' ? oneLine(e.text, MAX_NOTE) : ''
    const n = typeof e.n === 'number' && Number.isInteger(e.n) && e.n > 0 && e.n < 100_000 ? e.n : null
    const created = typeof e.created === 'string' && e.created ? e.created.slice(0, 40) : now
    if (type === 'general') {
      if (!text) return { ok: false, error: `Change ${i + 1} has no text.` }
      out.push({ n, type, text, created, ...editMeta(e) })
      continue
    }
    const r = range(e.start, e.end)
    if (!r) return { ok: false, error: `Edit ${i + 1} needs a start time in seconds.` }
    if (type === 'cut' && r.end - r.start < 0.05) return { ok: false, error: `Cut ${i + 1} is empty: set an out point after the in point.` }
    if (type === 'at' && !text) return { ok: false, error: `Change ${i + 1} has no text.` }
    out.push({ n, type, ...r, text, created, ...editMeta(e) })
  }
  return { ok: true, value: renumber<EditEntry>(out) }
}

/** An R2 video key a render may point at (lib/marketing/r2.ts VIDEO_KEY_RE, kept loose here: checked again on play). */
const RENDER_KEY_RE = /^videos\/[A-Za-z0-9][A-Za-z0-9._-]{0,79}\/[A-Za-z0-9._-]{1,140}$/

export function parseEditList(raw: unknown): Parsed<EditList> {
  if (raw === undefined || raw === null) return { ok: true, value: { edits: [], renders: [] } }
  if (!isObj(raw)) return { ok: false, error: 'An edit list must be a JSON object.' }
  const edits = parseEditEntries(raw.edits ?? [])
  if (!edits.ok) return edits
  const renders: EditRender[] = []
  if (Array.isArray(raw.renders)) {
    for (const r of raw.renders) {
      if (!isObj(r) || typeof r.key !== 'string' || !RENDER_KEY_RE.test(r.key) || r.key.includes('..')) continue
      renders.push({
        key: r.key,
        created: typeof r.created === 'string' ? r.created.slice(0, 40) : '',
        cuts: typeof r.cuts === 'number' && Number.isFinite(r.cuts) ? r.cuts : 0,
        ...(typeof r.duration === 'number' && Number.isFinite(r.duration) ? { duration: r.duration } : {}),
      })
    }
  }
  return { ok: true, value: { edits: edits.value, renders } }
}

// ── display helpers ───────────────────────────────────────────────────────────

/** `m:ss`. */
export function mss(t: number): string {
  const s = Math.max(0, Math.floor(t + 1e-6))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** `m:ss.s`, the timeline timecode. */
export function tc(t: number): string {
  const s = Math.max(0, t)
  const m = Math.floor(s / 60)
  return `${m}:${(s - m * 60).toFixed(1).padStart(4, '0')}`
}

/** Parse `m:ss.s`, `ss.s` or `h:mm:ss` into seconds; null if it is not a time. */
export function parseTimecode(s: string): number | null {
  const t = s.trim()
  if (!/^\d+(:\d{1,2}){0,2}(\.\d+)?$/.test(t)) return null
  const parts = t.split(':').map(Number)
  const v = parts.reduce((acc, p) => acc * 60 + p, 0)
  return Number.isFinite(v) && v <= MAX_SECONDS ? v : null
}

/** The parts of the video that SURVIVE the cuts, merged and sorted ("Play with cuts removed"). */
export function keepSegments(cuts: { start?: number; end?: number }[], duration: number): { start: number; end: number }[] {
  const merged: { start: number; end: number }[] = []
  const ranges = cuts.filter((c): c is { start: number; end: number } => typeof c.start === 'number' && typeof c.end === 'number')
  for (const c of ranges.sort((a, b) => a.start - b.start)) {
    const s = Math.max(0, c.start)
    const e = Math.min(duration, c.end)
    if (e <= s) continue
    const last = merged[merged.length - 1]
    if (last && s <= last.end) last.end = Math.max(last.end, e)
    else merged.push({ start: s, end: e })
  }
  const keep: { start: number; end: number }[] = []
  let at = 0
  for (const m of merged) {
    if (m.start > at) keep.push({ start: at, end: m.start })
    at = m.end
  }
  if (at < duration) keep.push({ start: at, end: duration })
  return keep.filter((k) => k.end - k.start > 0.01)
}

// ── Requests: the presses that need Claude ────────────────────────────────────
/**
 * The site cannot wake a Claude chat, so a press is saved in the cut's file and
 * Claude picks it up (skill suite-inbox, `node scripts/marketing/suite-notes.mjs inbox`).
 *   apply_edits = For Claude saved something (collect only; nothing renders yet).
 *   render_all  = "Done: render all": make every open edit in one pass. `ids` = those edits.
 *   render_one  = "Lock & render": just this one edit now (`ids` = [its id], `start` / `end` = its range).
 */
export const REQUEST_STATUSES = ['pending', 'done', 'failed'] as const
export type RequestStatus = (typeof REQUEST_STATUSES)[number]
export const REQUEST_TYPES = ['apply_edits', 'render_all', 'render_one'] as const
export type RequestType = (typeof REQUEST_TYPES)[number]
export type SuiteRequest = {
  id: string
  type: RequestType
  count: number
  created: string
  status: RequestStatus
  done_at?: string
  reason?: string
  ids?: string[]
  start?: number
  end?: number
}

/** Lenient read: bad entries are dropped, never fatal (the file is also written by Claude). */
export function parseRequests(raw: unknown): SuiteRequest[] {
  const list = Array.isArray(raw) ? raw : isObj(raw) && Array.isArray(raw.requests) ? raw.requests : []
  const out: SuiteRequest[] = []
  for (const r of list) {
    if (!isObj(r) || !(REQUEST_TYPES as readonly unknown[]).includes(r.type) || typeof r.id !== 'string') continue
    const status = (REQUEST_STATUSES as readonly string[]).includes(r.status as string) ? (r.status as RequestStatus) : 'pending'
    const q: SuiteRequest = {
      id: r.id.slice(0, 64),
      type: r.type as RequestType,
      count: typeof r.count === 'number' && Number.isFinite(r.count) ? Math.max(0, Math.round(r.count)) : 0,
      created: typeof r.created === 'string' ? r.created.slice(0, 40) : '',
      status,
    }
    if (typeof r.done_at === 'string') q.done_at = r.done_at.slice(0, 40)
    if (typeof r.reason === 'string') q.reason = oneLine(r.reason, 300)
    if (Array.isArray(r.ids)) q.ids = r.ids.filter((x): x is string => typeof x === 'string' && EDIT_ID_REGEX.test(x)).slice(0, MAX_EDITS)
    const t0 = time(r.start)
    const t1 = time(r.end)
    if (t0 !== null) q.start = t0
    if (t1 !== null) q.end = t1
    out.push(q)
  }
  return out
}

/** The newest request of a type, by `created`. */
export function latestRequest(list: SuiteRequest[], type: RequestType): SuiteRequest | null {
  return list.filter((r) => r.type === type).reduce<SuiteRequest | null>((a, b) => (!a || b.created > a.created ? b : a), null)
}
