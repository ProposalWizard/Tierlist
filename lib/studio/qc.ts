/**
 * The AUTO-QC LANE and TASTE NOTES (ported 22 Oct 2026; Harry, 20 Oct: "the auto QC track, the taste, and things that
 * just propose changes").
 *
 * scripts/marketing/studio-qc.py writes <video key>.qc.json next to the video in the Marketing storage:
 *   flags  what the machine measured (a shot under 1 s, a clipped word, a held shot, a whoosh, a gap in the voice,
 *          loudness): an amber block on the QC lane, the reason, ONE proposed change and the exact edit "Accept as
 *          edit" saves. "possible" = not sure.
 *   taste  up to 3 proposed changes from our own past notes and the Knowitball client rules (FACT-KIB / RUL-KIB notes),
 *          each naming where it comes from: "Accept as review note" / "Accept as edit for Claude" / "Dismiss".
 * Answers live in the cut's suite file (`review.qc_answers`, PUT /api/admin/marketing/studio/qc). An accepted item is
 * also an ordinary edit (with `qc: {id, kind}`) or note, so Claude gets it by the usual route.
 */
import { parseElement, type EditElement } from './elements'
import type { EditEntry, ReviewComment } from './schema'

export const QC_CHECKS = ['short', 'clipped', 'held', 'whoosh', 'silence', 'loudness'] as const
export type QcCheck = (typeof QC_CHECKS)[number]
/** The short name on a flag's chip. */
export const QC_LABEL: Record<QcCheck, string> = {
  short: 'Short shot',
  clipped: 'Word cut off',
  held: 'Held too long',
  whoosh: 'Whoosh',
  silence: 'Gap in the voice',
  loudness: 'Loudness',
}

export type QcEdit = { type: 'cut' | 'at' | 'general'; start?: number; end?: number; text: string; element?: EditElement }
export type QcRef = { n: number; title: string; ref: string }
export type QcFlag = {
  id: string
  check: QcCheck
  start: number
  end: number
  title: string
  reason: string
  proposal: string
  confidence: 'likely' | 'possible'
  /** The standing lesson that speaks to it (e.g. a quick-cut run may be a deliberate sequence). */
  lesson?: QcRef
  edit: QcEdit
}
export type TasteSource = { kind: 'lesson' | 'note' | 'rule'; label: string; ref: string }
export type TasteNote = {
  id: string
  title: string
  /** The proposed change, one line. */
  note: string
  /** Why: where it comes from, in plain words. */
  why: string
  source: TasteSource
  lesson?: QcRef
  start: number
  end: number
  /** What "Accept as edit for Claude" saves. */
  edit: QcEdit
  /** What "Accept as review note" saves. */
  comment: { start: number; end: number; tag: 'fix' | 'keep' | 'check'; note: string }
}
export type QcCheckRow = { id: QcCheck; label: string; ran: boolean; flags: number; how: string; rule: string }
export type Qc = { v: number; kind: 'build' | 'flat'; checks: QcCheckRow[]; flags: QcFlag[]; taste: TasteNote[] }

export type QcState = 'accepted' | 'dismissed'
export type QcAnswer = { state: QcState; at: string; as?: 'edit' | 'note' }
export type QcKind = 'qc' | 'taste'
/** The id of a flag (`short-124`, `short-124-2`) or a taste note (`taste-banner-fade`). */
export const QC_ID_REGEX = /^(?:(?:short|clipped|held|whoosh|silence|loudness)-\d{1,6}(?:-\d{1,2})?|taste-[a-z0-9-]{1,60})$/

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const num = (v: unknown, lo = 0, hi = 36_000): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi ? v : null)
const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : '')

function parseRef(raw: unknown): QcRef | undefined {
  if (!isObj(raw) || num(raw.n, 1, 999) === null) return undefined
  return { n: Math.round(raw.n as number), title: str(raw.title, 160), ref: str(raw.ref, 200) }
}

export function parseQcEdit(raw: unknown): QcEdit | null {
  if (!isObj(raw) || !(raw.type === 'cut' || raw.type === 'at' || raw.type === 'general')) return null
  const text = str(raw.text, 2000)
  if (!text) return null
  const e: QcEdit = { type: raw.type, text }
  if (raw.type !== 'general') {
    const start = num(raw.start)
    const end = num(raw.end)
    if (start === null || end === null || end <= start) return null
    e.start = start
    e.end = end
  }
  const el = parseElement(raw.element)
  if (el) e.element = el
  return e
}

/** The qc.json, checked. Anything malformed is dropped item by item; no usable file = null (no QC lane). */
export function parseQc(raw: unknown): Qc | null {
  if (!isObj(raw)) return null
  const flags: QcFlag[] = []
  for (const f of Array.isArray(raw.flags) ? raw.flags.slice(0, 200) : []) {
    if (!isObj(f) || typeof f.id !== 'string' || !QC_ID_REGEX.test(f.id) || !(QC_CHECKS as readonly unknown[]).includes(f.check)) continue
    const start = num(f.start)
    const end = num(f.end)
    const edit = parseQcEdit(f.edit)
    if (start === null || end === null || end < start || !edit) continue
    const flag: QcFlag = {
      id: f.id,
      check: f.check as QcCheck,
      start,
      end: Math.max(end, start + 0.1),
      title: str(f.title, 120),
      reason: str(f.reason, 600),
      proposal: str(f.proposal, 400),
      confidence: f.confidence === 'possible' ? 'possible' : 'likely',
      edit,
    }
    const l = parseRef(f.lesson)
    if (l) flag.lesson = l
    flags.push(flag)
  }
  const taste: TasteNote[] = []
  for (const t of Array.isArray(raw.taste) ? raw.taste.slice(0, 3) : []) {
    if (!isObj(t) || typeof t.id !== 'string' || !QC_ID_REGEX.test(t.id) || !t.id.startsWith('taste-')) continue
    const start = num(t.start)
    const end = num(t.end)
    const edit = parseQcEdit(t.edit)
    const c = isObj(t.comment) ? t.comment : null
    const cs = c ? num(c.start) : null
    const ce = c ? num(c.end) : null
    const s = isObj(t.source) ? t.source : {}
    const kind = s.kind === 'lesson' || s.kind === 'note' || s.kind === 'rule' ? s.kind : 'rule'
    if (start === null || end === null || !edit || !c || cs === null || ce === null || !str(c.note, 1000)) continue
    const note: TasteNote = {
      id: t.id,
      title: str(t.title, 120),
      note: str(t.note, 600),
      why: str(t.why, 600),
      source: { kind, label: str(s.label, 120), ref: str(s.ref, 200) },
      start,
      end: Math.max(end, start + 0.1),
      edit,
      comment: { start: cs, end: Math.max(ce, cs + 0.1), tag: c.tag === 'keep' || c.tag === 'check' ? c.tag : 'fix', note: str(c.note, 1000) },
    }
    const l = parseRef(t.lesson)
    if (l) note.lesson = l
    taste.push(note)
  }
  const checks: QcCheckRow[] = []
  for (const c of Array.isArray(raw.checks) ? raw.checks.slice(0, 20) : []) {
    if (!isObj(c) || !(QC_CHECKS as readonly unknown[]).includes(c.id)) continue
    checks.push({ id: c.id as QcCheck, label: str(c.label, 60), ran: c.ran === true, flags: num(c.flags, 0, 999) ?? 0, how: str(c.how, 400), rule: str(c.rule, 200) })
  }
  if (!flags.length && !taste.length && !checks.length) return null
  return { v: num(raw.v, 0, 99) ?? 1, kind: raw.kind === 'build' ? 'build' : 'flat', checks, flags, taste }
}

/** The answers, by id (the suite file's `review.qc_answers`). */
export function parseQcAnswers(raw: unknown): Record<string, QcAnswer> {
  const out: Record<string, QcAnswer> = {}
  if (!isObj(raw)) return out
  for (const [id, a] of Object.entries(raw).slice(0, 400)) {
    if (!QC_ID_REGEX.test(id) || !isObj(a) || (a.state !== 'accepted' && a.state !== 'dismissed')) continue
    out[id] = { state: a.state, at: str(a.at, 40), ...(a.as === 'edit' || a.as === 'note' ? { as: a.as } : {}) }
  }
  return out
}

/** Where an item stands: answered on the page, or accepted because an edit already carries its id. */
export function qcState(id: string, answers: Record<string, QcAnswer>, edits: Pick<EditEntry, 'qc' | 'status'>[]): QcState | null {
  const a = answers[id]
  if (a) return a.state
  return edits.some((e) => e.qc?.id === id && e.status !== 'undone') ? 'accepted' : null
}

/** The flags still waiting for an answer, and the ones answered (drawn dim on the lane, or left off when dismissed). */
export function qcView(qc: Qc | null, answers: Record<string, QcAnswer>, edits: Pick<EditEntry, 'qc' | 'status'>[]) {
  const flags = (qc?.flags ?? []).map((f) => ({ ...f, state: qcState(f.id, answers, edits) }))
  const taste = (qc?.taste ?? []).filter((t) => qcState(t.id, answers, edits) === null)
  return { flags: flags.filter((f) => f.state !== 'dismissed'), open: flags.filter((f) => f.state === null).length, taste }
}

/**
 * Where a flag sits ON THE LANE. A flag is a point of attention, so a long one (the whole-cut loudness, a banner
 * over the opening) is drawn as a short block at its start (2 s or 6 % of the cut, never past its end): drawn full
 * length it would cover the short flags inside it. The inspector still shows the real range.
 */
export function qcLaneSpan(f: { start: number; end: number }, dur: number): { start: number; end: number } {
  const d = Math.max(0.1, dur)
  if (f.end - f.start < Math.max(6, d * 0.15)) return { start: f.start, end: f.end }
  return { start: f.start, end: Math.min(f.end, f.start + Math.max(2, d * 0.06)) }
}

/** The edit "Accept as edit" saves: the proposal's own edit, numbered, tagged with where it came from. */
export function qcEditEntry(item: { id: string; edit: QcEdit }, kind: QcKind, n: number, created: string): EditEntry {
  const e = item.edit
  return {
    n,
    type: e.type,
    ...(e.type !== 'general' ? { start: e.start, end: e.end } : {}),
    text: e.text,
    created,
    ...(e.element ? { element: e.element } : {}),
    qc: { id: item.id, kind },
  }
}

/** The review note "Accept as review note" saves. */
export function tasteComment(t: TasteNote, n: number): ReviewComment {
  return { n, start: t.comment.start, end: t.comment.end, tag: t.comment.tag, note: t.comment.note }
}
