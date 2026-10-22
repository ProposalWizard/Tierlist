/**
 * lib/studio/store.ts — where the Studio's editing suite keeps one cut's work: ONE small JSON beside the video in the
 * Marketing storage (Cloudflare R2; this computer's scratch folder in development):
 *
 *   <video key>.suite.json   {review: {concept, version, comments, qc_answers, transcript}, edits: {edits, renders},
 *                             requests: [...], render: {...} | null}
 *
 * plus files a helper script may add beside it (scripts/marketing/studio-prep.py), all optional:
 *   <video key>.qc.json      the auto-QC flags and taste notes         (lib/studio/qc.ts)
 *   <video key>.lanes.json   shots, sound or stems, captions, banner    (lib/studio/elements.ts)
 *   <video key>.peaks.json   the sound wave + filmstrip sizes           (lib/studio/timeline.ts)
 *   <video key>.strip.jpg    the filmstrip picture
 *   <video key>.<voice|music|sfx>.mp4  sound stems
 *
 * Why the storage and not the code: a note saves in under a second with no commit and no deploy; it stays private
 * (the repo is public and a note can name an unreleased feature); and it sits in the same one place as the video.
 * Claude reads and writes it with scripts/marketing/suite-notes.mjs (skill suite-inbox).
 *
 * Takes the storage as an argument (lib/marketing/mediaApi.ts Storage), so the tests run it on a fake bucket.
 */
import type { Storage } from '@/lib/marketing/mediaApi'
import { doneSet, withIds } from './edit-lock'
import { parseLanes, type Lanes } from './elements'
import { parseQc, parseQcAnswers, type Qc } from './qc'
import {
  EDIT_ID_REGEX,
  REQUEST_TYPES,
  isOpenEdit,
  latestRequest,
  parseComments,
  parseEditList,
  parseRenderProgress,
  parseRequests,
  parseReview,
  type EditEntry,
  type EditList,
  type RenderProgress,
  type RequestType,
  type Review,
  type ReviewComment,
  type SuiteRequest,
} from './schema'
import { parseTimeline, type TimelineAssets } from './timeline'

export const SUITE_SUFFIX = '.suite.json'
export const SIDE = { qc: '.qc.json', lanes: '.lanes.json', peaks: '.peaks.json', strip: '.strip.jpg' } as const
export const STEM_LANES = ['voice', 'music', 'sfx'] as const
export const suiteKey = (videoKey: string) => `${videoKey}${SUITE_SUFFIX}`

export type CutFile = { review: Review; edits: EditList; requests: SuiteRequest[]; render: RenderProgress | null }
export type CutView = CutFile & { qc: Qc | null; lanes: Lanes | null; timeline: { assets: TimelineAssets; strip: boolean } | null }
export type Result<T> = { ok: true; value: T } | { ok: false; status: number; error: string }

const empty = (title: string): CutFile => ({ review: { concept: title, version: '', comments: [] }, edits: { edits: [], renders: [] }, requests: [], render: null })

async function readJson(store: Storage, key: string): Promise<unknown> {
  const raw = await store.getText(key)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/** The cut's file, checked. A missing or broken file = an empty cut titled `title`. */
export async function readCut(store: Storage, videoKey: string, title = ''): Promise<CutFile> {
  const raw = (await readJson(store, suiteKey(videoKey))) as Record<string, unknown> | null
  if (!raw || typeof raw !== 'object') return empty(title)
  const r = parseReview(raw.review ?? {})
  const e = parseEditList(raw.edits ?? null)
  const review = r.ok ? r.value : empty(title).review
  if (!review.concept) review.concept = title
  return { review, edits: e.ok ? e.value : { edits: [], renders: [] }, requests: parseRequests(raw.requests), render: parseRenderProgress(raw.render) }
}

/** Everything the page needs: the file plus the optional helper files. */
export async function readCutView(store: Storage, videoKey: string, title = ''): Promise<CutView> {
  const [cut, qc, lanes, peaks] = await Promise.all([
    readCut(store, videoKey, title),
    readJson(store, videoKey + SIDE.qc),
    readJson(store, videoKey + SIDE.lanes),
    readJson(store, videoKey + SIDE.peaks),
  ])
  const assets = parseTimeline(peaks)
  const strip = assets ? !!(await store.head(videoKey + SIDE.strip)) : false
  return { ...cut, qc: parseQc(qc), lanes: parseLanes(lanes), timeline: assets ? { assets, strip } : null }
}

async function writeCut(store: Storage, videoKey: string, cut: CutFile): Promise<void> {
  await store.putText(suiteKey(videoKey), JSON.stringify({ v: 1, ...cut }, null, 1) + '\n')
}

/** PUT review notes: the page sends the whole list. New notes get the author's first name. */
export async function saveComments(store: Storage, videoKey: string, raw: unknown, who: string): Promise<Result<ReviewComment[]>> {
  const p = parseComments(raw)
  if (!p.ok) return { ok: false, status: 400, error: p.error }
  const cut = await readCut(store, videoKey)
  const before = new Map(cut.review.comments.map((c) => [c.n, c]))
  cut.review.comments = p.value.map((c) => ({ ...c, ...(c.author ? {} : before.get(c.n)?.author ? { author: before.get(c.n)!.author } : { author: who }) }))
  await writeCut(store, videoKey, cut)
  return { ok: true, value: cut.review.comments }
}

/** PUT edits: the page sends the whole list; every edit gets an id. */
export async function saveEditList(store: Storage, videoKey: string, raw: unknown): Promise<Result<EditEntry[]>> {
  const p = parseEditList({ edits: raw })
  if (!p.ok) return { ok: false, status: 400, error: p.error }
  const cut = await readCut(store, videoKey)
  cut.edits.edits = withIds(p.value.edits)
  await writeCut(store, videoKey, cut)
  return { ok: true, value: cut.edits.edits }
}

/** PUT qc: one answer to an auto-QC flag or taste note ("open" takes the answer back). */
export async function saveQcAnswer(store: Storage, videoKey: string, body: unknown, now: string): Promise<Result<true>> {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
  const id = typeof b.id === 'string' ? b.id : ''
  const cut = await readCut(store, videoKey)
  const answers = { ...(cut.review.qc_answers ?? {}) }
  if (b.state === 'open') delete answers[id]
  else {
    const one = parseQcAnswers({ [id]: { state: b.state, at: now, as: b.as } })
    if (!one[id]) return { ok: false, status: 400, error: 'Not an answer the suite understands.' }
    answers[id] = one[id]
  }
  cut.review.qc_answers = answers
  await writeCut(store, videoKey, cut)
  return { ok: true, value: true }
}

/**
 * POST requests (a press that needs Claude). The edits come from the FILE, never the page: render_one needs exactly
 * one id of an open edit with a range (its range is copied in); render_all covers every open edit that is not an undo.
 * A pending request for the same edits is returned, not doubled.
 */
export async function addRequest(store: Storage, videoKey: string, body: unknown, now: string): Promise<Result<SuiteRequest>> {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
  if (!(REQUEST_TYPES as readonly unknown[]).includes(b.type)) return { ok: false, status: 400, error: 'Unknown request type.' }
  const type = b.type as RequestType
  const ids = Array.isArray(b.ids) ? b.ids.filter((x): x is string => typeof x === 'string' && EDIT_ID_REGEX.test(x)).slice(0, 500) : undefined
  const cut = await readCut(store, videoKey)
  const edits = cut.edits.edits
  let request: SuiteRequest
  if (type === 'apply_edits') {
    const last = latestRequest(cut.requests, 'apply_edits')
    if (last && last.status === 'pending') return { ok: true, value: last }
    request = { id: `a-${Date.parse(now).toString(36)}`, type, count: edits.filter(isOpenEdit).length, created: now, status: 'pending' }
  } else {
    const open = doneSet(edits)
    let picked: EditEntry[]
    if (type === 'render_one') {
      const id = ids?.length === 1 ? ids[0] : null
      const e = id ? open.find((x) => x.id === id) : undefined
      if (!e) return { ok: false, status: 400, error: 'Lock & render needs one saved, open edit.' }
      if (e.type === 'general' || e.start === undefined) return { ok: false, status: 400, error: 'Only an edit with a time range can be locked.' }
      picked = [e]
    } else {
      picked = open
      if (!picked.length) return { ok: false, status: 400, error: 'There are no open edits to render.' }
    }
    const pickedIds = picked.map((e) => e.id).filter((x): x is string => !!x)
    const sig = (l: string[]) => [...l].sort().join(',')
    const same = cut.requests.find((r) => r.type === type && r.status === 'pending' && sig(r.ids ?? []) === sig(pickedIds))
    if (same) return { ok: true, value: same }
    const one = type === 'render_one' ? picked[0] : null
    request = {
      id: `${type === 'render_one' ? 'l' : 'd'}-${Date.parse(now).toString(36)}`,
      type,
      count: picked.length,
      created: now,
      status: 'pending',
      ids: pickedIds,
      ...(one ? { start: one.start, end: one.end ?? one.start } : {}),
    }
  }
  cut.requests = [...cut.requests, request].slice(-200)
  await writeCut(store, videoKey, cut)
  return { ok: true, value: request }
}
