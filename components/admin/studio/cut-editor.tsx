'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Check, ChevronLeft, ChevronRight, Copy, Lock, Pause, Pencil, Play, Plus, Scissors, Trash2, Undo2, X, ZoomIn, ZoomOut } from './icons'
import {
  latestRequest,
  markEdited,
  parseRenderProgress,
  tc,
  type EditEntry,
  type EditList,
  type EditType,
  type SuiteRequest,
  type RenderProgress,
  type RequestType,
  type Review,
  type ReviewComment,
  type ReviewTag,
} from '@/lib/studio/schema'
import { FPS, MODE_LABEL, nextN } from '@/lib/studio/suite'
import { playLink } from '@/lib/marketing/uploadClient'
import { canLock, doneSet, editPhase, editRange, isLocked, lockClash, lockedAt, lockedRanges, phaseLabel, visibleNotes, withIds, type EditPhase, type Range } from '@/lib/studio/edit-lock'
import { ScrubTimeline, type Block } from './scrub-timeline'
import { clampZoom, ZOOM_MAX, ZOOM_MIN, type TimelineAssets } from '@/lib/studio/timeline'
import { WithMic } from './mic-button'
import { clipAt, defaultLanes, elementTag, type Lanes } from '@/lib/studio/elements'
import { ElementInspector, type NewChange } from './element-inspector'
import { useElementAudio } from './use-element-audio'
import type { ElementMark, QcBlock } from './scrub-timeline'
import { QcInspector, TasteNotes } from './qc-panel'
import { qcEditEntry, qcLaneSpan, qcState, qcView, tasteComment, type Qc, type QcAnswer, type QcState, type TasteNote } from '@/lib/studio/qc'

/**
 * The Studio's editing suite (ported 22 Oct 2026 from the editing suite in Harry's other app, rebuilt there
 * mobile-first on 19 Oct; Knowitball is the only client here). Harry: "fully build out the editing suite on web and
 * phone ... with a 'done' button that fully merges and automatically starts all edits too".
 *
 *  Phone (390 px, one hand): video on top, the thumb-scrub timeline, a big Add button at the playhead, the list as cards.
 *  Desktop: video + timeline on the left, the same panel on the right.
 *
 *  For Claude   = edits (cobalt). Lock & render one (render_one), or Done: render all.
 *  Review notes = notes (teal): fix / keep / check at a moment.
 *
 * Everything saves to ONE small file beside the video in the Marketing storage (<video key>.suite.json, lib/studio/
 * store.ts). The site cannot wake Claude: every press is saved as a request and the page says so. Progress comes from
 * the same file (Claude writes it while rendering), polled while anything is waiting.
 */

type Tab = 'claude' | 'review'
type Sibling = { slug: string; label: string; href: string }
type Status = { kind: 'idle' | 'saving' | 'saved' | 'error'; text?: string }
type Toast = { id: number; text: string; undo?: () => void }
type Draft = {
  kind: 'edit' | 'note'
  /** Editing an existing entry (its n), else a new one. */
  n: number | null
  type: EditType
  tag: ReviewTag
  text: string
  start: number
  end: number
}

const TAG_LABEL: Record<ReviewTag, string> = {
  fix: 'Fix',
  keep: 'Keep',
  check: 'Check',
}
const TYPE_LABEL: Record<EditType, string> = {
  at: 'Change',
  cut: 'Cut out',
  general: 'Whole video',
}
const SENT_LINE = 'Saved for Claude. The next Claude chat that checks the suite picks it up.'
const JSON_H = { 'Content-Type': 'application/json' }
const round2 = (s: number) => Math.round(s * 100) / 100

export function CutEditor({
  slug,
  videoKey,
  backHref,
  review,
  initialEdits,
  initialRequests,
  initialRender,
  timeline,
  lanes: lanesIn,
  qc = null,
  siblings,
  title,
  sub,
}: {
  /** A short id for this cut (remembered tab). */
  slug: string
  /** The video's key in the Marketing storage. */
  videoKey: string
  /** Where the back arrow goes: the list of cuts. */
  backHref: string
  review: Review
  initialEdits: EditList
  initialRequests: SuiteRequest[]
  initialRender: RenderProgress | null
  /** The filmstrip sprite + waveform made at load (null = drawn from the video in the browser). */
  timeline?: { assets: TimelineAssets; strip: boolean } | null
  /** The cut's element lanes (shots, sound or stems, captions, banner), made at load; null = plain Video / Audio. */
  lanes?: Lanes | null
  /** The auto-QC flags + taste notes made at load (scripts/review_qc.py); null = none yet. */
  qc?: Qc | null
  siblings: Sibling[]
  /** "v02 · Goalie Mode" */
  title: string
  /** "the file name · 0:44" */
  sub: string
}) {
  const api = useCallback((p = '') => `/api/admin/marketing/studio${p}?key=${encodeURIComponent(videoKey)}`, [videoKey])

  // ── data ──────────────────────────────────────────────────────────────────
  const [edits, setEdits] = useState<EditEntry[]>(initialEdits.edits)
  const [notes, setNotes] = useState<ReviewComment[]>(() => visibleNotes(review.comments))
  const [requests, setRequests] = useState<SuiteRequest[]>(initialRequests)
  const [render, setRender] = useState<RenderProgress | null>(initialRender)
  const renders = initialEdits.renders
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [warning, setWarning] = useState<string | null>(null)
  const [toast, setToast] = useState<Toast | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showToast = useCallback((text: string, undo?: () => void) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ id: Date.now(), text, undo })
    toastTimer.current = setTimeout(() => setToast(null), undo ? 7000 : 3500)
  }, [])

  // ── tab (remembered per cut, guarded storage) ─────────────────────────────
  const [tab, setTabRaw] = useState<Tab>('claude')
  const tabKey = `kib-studio-tab:${slug}`
  useEffect(() => {
    try {
      const v = sessionStorage.getItem(tabKey)
      if (v === 'claude' || v === 'review') setTabRaw(v)
    } catch {
      /* no storage */
    }
  }, [tabKey])
  const setTab = (v: Tab) => {
    setTabRaw(v)
    try {
      sessionStorage.setItem(tabKey, v)
    } catch {
      /* not remembered */
    }
  }

  // ── player ────────────────────────────────────────────────────────────────
  const vRef = useRef<HTMLVideoElement | null>(null)
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null)
  const [t, setT] = useState(0)
  const [dur, setDur] = useState(() => Math.max(1, lanesIn?.duration ?? timeline?.assets.duration ?? 0, ...review.comments.map((c) => c.end), ...initialEdits.edits.map((e) => e.end ?? 0)))
  const [playing, setPlaying] = useState(false)
  const [videoError, setVideoError] = useState(false)
  const [renderN, setRenderN] = useState<number | null>(null)
  const [zoom, setZoom] = useState(1)
  const playerRef = useRef<HTMLElement | null>(null)
  const original = playLink(videoKey)
  const src = renderN === null ? original : playLink(renders[renderN]?.key ?? videoKey)
  const onOriginal = renderN === null

  const seek = useCallback((s: number) => {
    const v = vRef.current
    const to = Math.max(0, Math.min(s, v?.duration || s))
    if (v) v.currentTime = to
    setT(to)
  }, [])
  const togglePlay = useCallback(() => {
    const v = vRef.current
    if (!v) return
    if (v.paused) void v.play().catch(() => setVideoError(true))
    else v.pause()
  }, [])
  // The video can load its metadata before React hydrates (the event is then missed): read it once mounted.
  useEffect(() => {
    const v = vRef.current
    if (v && v.readyState >= 1 && Number.isFinite(v.duration) && v.duration > 0) setDur(v.duration)
  }, [src])
  // A smooth playhead while playing (timeupdate fires only ~4 times a second).
  useEffect(() => {
    if (!playing) return
    let raf = 0
    const tick = () => {
      if (vRef.current) setT(vRef.current.currentTime)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing])

  // ── lock state ────────────────────────────────────────────────────────────
  const phases = useMemo(() => new Map(edits.map((e) => [e.n, editPhase(e, requests, render)])), [edits, requests, render])
  const locked = useMemo(() => lockedRanges(edits), [edits])
  const lockedWithPct = locked.map((l) => {
    const p = phases.get(l.n)
    return {
      ...l,
      pct: p?.kind === 'rendering' ? p.pct : p?.kind === 'rendered' ? 100 : null,
    }
  })
  const lockHere = onOriginal ? lockedAt(t, locked) : null
  const lockHerePhase = lockHere ? phases.get(lockHere.n) : undefined

  // ── saving ────────────────────────────────────────────────────────────────
  // Every save goes through ONE queue, in order: a save and a Lock pressed a second apart can never race.
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  function send(url: string, method: 'PUT' | 'POST', body: unknown): Promise<Record<string, unknown> | null> {
    const run = queue.current.then(() => sendNow(url, method, body))
    queue.current = run.catch(() => null)
    return run
  }
  async function sendNow(url: string, method: 'PUT' | 'POST', body: unknown): Promise<Record<string, unknown> | null> {
    setStatus({ kind: 'saving' })
    try {
      const res = await fetch(url, {
        method,
        headers: JSON_H,
        body: JSON.stringify(body),
      })
      const d = (await res.json().catch(() => ({}))) as Record<string, unknown> & { error?: string; warnings?: string[] }
      if (!res.ok) {
        setStatus({
          kind: 'error',
          text: d.error || `Not saved (${res.status}).`,
        })
        return null
      }
      setWarning(d.warnings && d.warnings.length ? d.warnings.join(' ') : null)
      setStatus({ kind: 'saved' })
      return d
    } catch {
      setStatus({
        kind: 'error',
        text: 'Not saved: no connection. Try again.',
      })
      return null
    }
  }
  async function saveEdits(next: EditEntry[], toastText?: string, undoTo?: EditEntry[]): Promise<EditEntry[] | null> {
    const prev = edits
    const withId = withIds(next)
    setEdits(withId)
    const d = await send(api('/edits'), 'PUT', { edits: withId })
    if (!d) {
      setEdits(prev)
      return null
    }
    const saved = Array.isArray(d.edits) ? (d.edits as EditEntry[]) : withId
    setEdits(saved)
    if (toastText) showToast(toastText, undoTo ? () => void saveEdits(undoTo, 'Undone') : undefined)
    return saved
  }
  async function saveNotes(next: ReviewComment[], toastText?: string, undoTo?: ReviewComment[]): Promise<boolean> {
    const prev = notes
    setNotes(next)
    const d = await send(api(), 'PUT', { comments: next })
    if (!d) {
      setNotes(prev)
      return false
    }
    if (Array.isArray(d.comments)) setNotes(visibleNotes(d.comments as ReviewComment[]))
    if (toastText) showToast(toastText, undoTo ? () => void saveNotes(undoTo, 'Undone') : undefined)
    return true
  }
  async function request(type: RequestType, ids?: string[]): Promise<SuiteRequest | null> {
    const d = await send(api('/requests'), 'POST', { type, ...(ids ? { ids } : {}) })
    const req = d?.request as SuiteRequest | undefined
    if (!req) return null
    setRequests((p) => (p.some((q) => q.id === req.id) ? p : [...p, req]))
    return req
  }

  // ── polling while Claude has something waiting ────────────────────────────
  const waiting =
    Array.from(phases.values()).some((p) => p.kind === 'sent' || p.kind === 'rendering' || p.kind === 'rendered' || p.kind === 'undo_requested') ||
    (!!render && (render.status === 'queued' || render.status === 'rendering'))
  useEffect(() => {
    if (!waiting) return
    let gone = false
    let n = 0
    const tick = async () => {
      n++
      try {
        const r = await fetch(api('/render'), { cache: 'no-store' })
        const d = (await r.json().catch(() => ({}))) as { render?: unknown }
        if (!gone && r.ok) setRender(parseRenderProgress(d.render))
        if (n % 3 === 0) {
          // Claude marks edits applied in the edit list; pick that up too.
          const g = await fetch(api(), { cache: 'no-store' })
          const gd = (await g.json().catch(() => ({}))) as { edits?: EditList }
          if (!gone && g.ok && gd.edits && Array.isArray(gd.edits.edits)) setEdits(gd.edits.edits)
        }
      } catch {
        /* next tick */
      }
    }
    const id = setInterval(tick, 5000)
    return () => {
      gone = true
      clearInterval(id)
    }
  }, [waiting, api])

  // ── the composer ──────────────────────────────────────────────────────────
  const [draft, setDraft] = useState<Draft | null>(null)
  const textRef = useRef<HTMLTextAreaElement | null>(null)
  /** Phone: bring the composer up right under the sticky player (the video keeps its size; the page scrolls). */
  const revealComposer = () =>
    setTimeout(() => {
      if (window.innerWidth >= 1024) return
      const el = document.querySelector<HTMLElement>('[data-composer], [data-inspector], [data-qc-inspector]')
      const pl = playerRef.current
      if (!el || !pl) return
      const box = el.closest('main') ?? document.scrollingElement
      // where the player's bottom will be once it sticks (at the top of the scroller), not where it is now: before the
      // page has scrolled past the header it has not stuck yet, and the old sum lifted the box only that far
      const top = box && box !== document.scrollingElement ? Math.max(0, box.getBoundingClientRect().top) : 0
      box?.scrollBy({ top: el.getBoundingClientRect().top - (top + pl.getBoundingClientRect().height) - 8 })
    }, 260)
  const openNew = (kind: 'edit' | 'note') => {
    setElSel(null)
    setElDraft(null)
    setQcSel(null)
    const start = round2(t)
    setDraft({
      kind,
      n: null,
      type: 'at',
      tag: 'fix',
      text: '',
      start,
      end: round2(Math.min(dur, start + 2)),
    })
    setTimeout(() => textRef.current?.focus({ preventScroll: true }), 30)
    revealComposer()
  }
  const openEditEntry = (e: EditEntry) => {
    const r = editRange(e)
    setTab('claude')
    setDraft({
      kind: 'edit',
      n: e.n,
      type: e.type,
      tag: 'fix',
      text: e.text,
      start: e.start ?? round2(t),
      end: e.end ?? r?.end ?? round2(t + 2),
    })
    if (e.start !== undefined) seek(e.start)
    setTimeout(() => textRef.current?.focus({ preventScroll: true }), 30)
    revealComposer()
  }
  const openNoteEntry = (c: ReviewComment) => {
    setTab('review')
    setDraft({
      kind: 'note',
      n: c.n,
      type: 'at',
      tag: c.tag,
      text: c.note,
      start: c.start,
      end: c.end,
    })
    seek(c.start)
    setTimeout(() => textRef.current?.focus({ preventScroll: true }), 30)
    revealComposer()
  }
  const draftRange: Range | null =
    draft && !(draft.kind === 'edit' && draft.type === 'general')
      ? {
          start: Math.min(draft.start, draft.end),
          end: Math.max(draft.start, draft.end, Math.min(draft.start, draft.end) + 0.1),
        }
      : null
  const draftClash = draftRange ? lockClash(draftRange, locked, draft?.kind === 'edit' ? (draft.n ?? undefined) : undefined) : null
  const draftEmpty = !draft || (draft.text.trim() === '' && !(draft.kind === 'edit' && draft.type === 'cut'))
  async function saveDraft() {
    if (!draft || draftEmpty || draftClash) return
    const r = draftRange
    if (draft.kind === 'note') {
      const entry: ReviewComment = {
        n: draft.n ?? nextN(notes),
        start: r!.start,
        end: r!.end,
        tag: draft.tag,
        note: draft.text.trim(),
      }
      const next = draft.n === null ? [...notes, entry] : notes.map((c) => (c.n === draft.n ? { ...c, ...entry } : c))
      if (await saveNotes(next, draft.n === null ? `Note #${entry.n} saved` : `Note #${entry.n} changed`, notes)) setDraft(null)
      return
    }
    const base: EditEntry =
      draft.type === 'general'
        ? {
            n: draft.n ?? nextN(edits),
            type: 'general',
            text: draft.text.trim(),
          }
        : {
            n: draft.n ?? nextN(edits),
            type: draft.type,
            start: r!.start,
            end: r!.end,
            text: draft.text.trim(),
          }
    let next: EditEntry[]
    if (draft.n === null) next = [...edits, { ...base, created: new Date().toISOString() }]
    else
      next = edits.map((e) => {
        if (e.n !== draft.n) return e
        // A changed edit goes to Claude again, marked edited (its old status is dropped).
        const { start: _s, end: _e, ...rest } = e
        ;(void _s, void _e)
        return markEdited({
          ...rest,
          ...base,
          ...(e.id ? { id: e.id } : {}),
          ...(e.created ? { created: e.created } : {}),
        })
      })
    if (await saveEdits(next, draft.n === null ? `Edit #${base.n} saved for Claude` : `Edit #${base.n} changed`, edits)) setDraft(null)
  }

  // ── actions on cards ──────────────────────────────────────────────────────
  async function deleteEdit(e: EditEntry) {
    await saveEdits(
      edits.filter((x) => x.n !== e.n),
      e.type === 'cut' ? `Cut #${e.n} removed` : `Edit #${e.n} deleted`,
      edits,
    )
  }
  async function deleteNote(c: ReviewComment) {
    await saveNotes(
      notes.filter((x) => x.n !== c.n),
      `Note #${c.n} deleted`,
      notes,
    )
  }
  const [lockAsk, setLockAsk] = useState<number | null>(null)
  async function lockEdit(e: EditEntry) {
    setLockAsk(null)
    if (!canLock(e)) return
    const r = editRange(e)!
    const clash = lockClash(r, locked, e.n)
    if (clash) return showToast(`Overlaps #${clash.n}, which is already in edit.`)
    const before = edits
    const saved = await saveEdits(edits.map((x) => (x.n === e.n ? { ...x, locked_at: new Date().toISOString() } : x)))
    const id = saved?.find((x) => x.n === e.n)?.id
    if (!saved || !id) return
    const req = await request('render_one', [id])
    if (!req) {
      // Not sent: take the lock back off so nothing looks in edit that Claude was never asked to do.
      await saveEdits(before)
      return showToast('Lock not sent. Try again.')
    }
    showToast(`#${e.n} is in edit. ${SENT_LINE}`)
  }
  async function undoApplied(e: EditEntry) {
    const saved = await saveEdits(
      edits.map((x) =>
        x.n === e.n
          ? {
              ...x,
              status: 'undo_requested' as const,
              undo_at: new Date().toISOString(),
            }
          : x,
      ),
    )
    if (saved) {
      await request('apply_edits')
      showToast(`Undo of #${e.n} sent. Claude picks it up at the next check.`)
    }
  }
  const toRender = doneSet(edits)
  // Edits Done has not asked for yet (a Lock or an earlier Done already covers the rest).
  const notSent = toRender.filter((e) => {
    const k = phases.get(e.n)?.kind
    return k === 'queued' || k === 'edited' || k === 'failed'
  })
  const [doneAsk, setDoneAsk] = useState(false)
  async function done() {
    setDoneAsk(false)
    // Every edit needs its id on disk before the request names it.
    let list = edits
    if (toRender.some((e) => !e.id)) {
      const saved = await saveEdits(edits)
      if (!saved) return
      list = saved
    }
    if (!doneSet(list).length) return
    const req = await request('render_all')
    if (req) showToast(`${req.count} ${req.count === 1 ? 'edit' : 'edits'} sent. Claude renders them at the next check.`)
  }
  const [copied, setCopied] = useState(false)
  /** "Copy notes": every review note as plain lines (m:ss.s to m:ss.s [Fix] note), for a chat or a message. */
  async function copyNotes() {
    const lines = [...notes].sort((a, b) => a.start - b.start || a.n - b.n).map((c) => `${tc(c.start)}${c.end - c.start >= 0.2 ? ` to ${tc(c.end)}` : ''} [${TAG_LABEL[c.tag]}] ${c.note}`)
    try {
      await navigator.clipboard.writeText([`${title} · review notes`, ...lines].join('\n'))
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      showToast('Copying is blocked in this browser.')
    }
  }

  // ── selection (tap a block on the timeline) ───────────────────────────────
  const [selected, setSelected] = useState<string | null>(null)
  const pick = (key: string) => {
    setElSel(null)
    setElDraft(null)
    setQcSel(null)
    setSelected(key)
    const [kind, n] = key.split(':')
    if (kind === 'qc') return pickQc(n)
    if (kind === 'note') {
      const c = notes.find((x) => x.n === Number(n))
      if (c) seek(c.start)
      setTab('review')
    } else {
      const e = edits.find((x) => x.n === Number(n))
      if (e?.start !== undefined) seek(e.start)
      setTab('claude')
    }
    setTimeout(() => document.getElementById(`card-${key.replace(':', '-')}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 60)
  }

  // ── select an element (Harry, 2026-10-20: "click on the audio track and turn down the volume etc.") ─────────
  const lanes = useMemo(() => lanesIn ?? defaultLanes(dur), [lanesIn, dur])
  const [elSel, setElSel] = useState<{ lane: string; clip: string | null } | null>(null)
  const [elDraft, setElDraft] = useState<NewChange | null>(null)
  const selLane = elSel ? (lanes.lanes.find((l) => l.id === elSel.lane) ?? null) : null
  const selClip = selLane && elSel ? (selLane.clips.find((c) => c.id === elSel.clip) ?? (selLane.clips.length === 1 ? selLane.clips[0] : null)) : null
  const pickElement = (laneId: string, clipId: string | null) => {
    const ln = lanes.lanes.find((l) => l.id === laneId)
    if (!ln) return
    setSelected(null)
    setDraft(null)
    setQcSel(null)
    setTab('claude')
    setElSel({ lane: laneId, clip: clipId ?? clipAt(ln, t)?.id ?? null })
    revealComposer()
  }
  const closeInspector = useCallback(() => {
    setElSel(null)
    setElDraft(null)
  }, [])
  const gainEdits = useMemo(
    () => [...edits, ...(elDraft ? [{ type: elDraft.type, start: elDraft.start, end: elDraft.end, element: elDraft.element }] : [])],
    [edits, elDraft],
  )
  const preview = useElementAudio({ video: videoEl, lanes, edits: gainEdits, dur, stemUrl: (l) => api(`/stem/${l}`) })
  const markList: ElementMark[] = [
    ...edits.flatMap((e) =>
      e.element && e.status !== 'undone'
        ? [{ key: `m-${e.n}`, lane: e.element.lane, start: e.start ?? 0, end: e.end ?? dur, tag: elementTag(e.element) }]
        : [],
    ),
    ...(elDraft ? [{ key: 'm-draft', lane: elDraft.element.lane, start: elDraft.start ?? 0, end: elDraft.end ?? dur, tag: elementTag(elDraft.element), draft: true }] : []),
  ]
  // several changes on the same element and range: one marker naming them all ("1.5x · Swap")
  const marks: ElementMark[] = []
  for (const m of markList) {
    const same = marks.find((x) => x.lane === m.lane && x.start === m.start && x.end === m.end && !!x.draft === !!m.draft)
    if (same) same.tag += ` · ${m.tag}`
    else marks.push({ ...m })
  }
  async function saveElementChanges(changes: NewChange[]) {
    let n = nextN(edits)
    const created = new Date().toISOString()
    const add: EditEntry[] = changes.map((c) => ({
      n: n++,
      type: c.type,
      ...(c.type !== 'general' ? { start: c.start, end: c.end } : {}),
      text: c.text,
      created,
      element: c.element,
    }))
    const saved = await saveEdits([...edits, ...add], add.length === 1 ? `Edit #${add[0].n} saved for Claude` : `${add.length} edits saved for Claude`, edits)
    if (saved) closeInspector()
  }

  // ── the auto-QC track + taste notes (Harry, 2026-10-20: "the auto QC track, the taste, and things that just propose
  //    changes"). A tap on an amber flag opens its proposal; Accept saves the proposal as an ordinary edit for Claude
  //    (same flow as tapping a track); Dismiss hides it. Answers go to <slug>.json `qc_answers` (PUT /qc). ──────────
  const [qcAnswers, setQcAnswers] = useState<Record<string, QcAnswer>>(review.qc_answers ?? {})
  const [qcSel, setQcSel] = useState<string | null>(null)
  const qcV = useMemo(() => qcView(qc, qcAnswers, edits), [qc, qcAnswers, edits])
  const qcFlag = qcSel ? (qc?.flags.find((f) => f.id === qcSel) ?? null) : null
  const qcBlocks: QcBlock[] = qcV.flags.map((f) => ({ id: f.id, ...qcLaneSpan(f, dur), title: f.title, possible: f.confidence === 'possible', accepted: f.state === 'accepted' }))
  const pickQc = (id: string) => {
    const f = qc?.flags.find((x) => x.id === id)
    if (!f) return
    setElSel(null)
    setElDraft(null)
    setDraft(null)
    setSelected(null)
    setTab('claude')
    setQcSel(id)
    seek(f.start)
    revealComposer()
  }
  async function answerQc(id: string, state: QcState | 'open', as?: 'edit' | 'note'): Promise<boolean> {
    const prev = qcAnswers
    const next = { ...qcAnswers }
    if (state === 'open') delete next[id]
    else next[id] = { state, at: new Date().toISOString(), ...(as ? { as } : {}) }
    setQcAnswers(next)
    const d = await send(api('/qc'), 'PUT', { id, state, ...(as ? { as } : {}) })
    if (!d) setQcAnswers(prev)
    return !!d
  }
  async function acceptQcEdit(item: { id: string; edit: Qc['flags'][number]['edit'] }, kind: 'qc' | 'taste') {
    const before = edits
    const entry = qcEditEntry(item, kind, nextN(edits), new Date().toISOString())
    const saved = await saveEdits([...edits, entry])
    if (!saved) return
    await answerQc(item.id, 'accepted', 'edit')
    setQcSel(null)
    showToast(`Edit #${entry.n} saved for Claude`, () => {
      void saveEdits(before)
      void answerQc(item.id, 'open')
    })
  }
  async function acceptTasteNote(t: TasteNote) {
    const before = notes
    const c = tasteComment(t, nextN(notes))
    if (!(await saveNotes([...notes, c]))) return
    await answerQc(t.id, 'accepted', 'note')
    showToast(`Note #${c.n} saved`, () => {
      void saveNotes(before)
      void answerQc(t.id, 'open')
    })
  }
  async function dismissQc(id: string) {
    if (!(await answerQc(id, 'dismissed'))) return
    if (qcSel === id) setQcSel(null)
    showToast('Dismissed', () => void answerQc(id, 'open'))
  }

  // ── keyboard (desktop) ────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const el = ev.target as HTMLElement | null
      if (el && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT' || el.isContentEditable)) {
        if (ev.key === 'Escape') {
          setDraft(null)
          closeInspector()
          setQcSel(null)
        }
        return
      }
      if (ev.metaKey || ev.ctrlKey || ev.altKey) return
      const v = vRef.current
      if (ev.key === ' ') {
        ev.preventDefault()
        togglePlay()
      } else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') {
        ev.preventDefault()
        const d = (ev.shiftKey ? 1 : 1 / FPS) * (ev.key === 'ArrowLeft' ? -1 : 1)
        v?.pause()
        seek((v?.currentTime ?? t) + d)
      } else if (ev.key === 'e' || ev.key === 'E') {
        ev.preventDefault()
        setTab('claude')
        openNew('edit')
      } else if (ev.key === 'n' || ev.key === 'N') {
        ev.preventDefault()
        setTab('review')
        openNew('note')
      } else if (ev.key === 'Escape') {
        setDraft(null)
        closeInspector()
        setQcSel(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // ── timeline blocks ───────────────────────────────────────────────────────
  const blocks: Block[] = [
    ...notes.map((c) => ({
      key: `note:${c.n}`,
      kind: 'note' as const,
      start: c.start,
      end: Math.max(c.end, c.start + 0.3),
      label: `Note ${c.n} at ${tc(c.start)}: ${c.note}`,
      n: c.n,
      text: `${c.n} ${c.note}`,
    })),
    ...edits.flatMap((e) => {
      const r = editRange(e)
      if (!r) return []
      const p = phases.get(e.n)
      return [
        {
          key: `edit:${e.n}`,
          kind: 'edit' as const,
          ...r,
          cut: e.type === 'cut',
          dim: p?.kind === 'undone' || p?.kind === 'applied',
          label: `Edit ${e.n} at ${tc(r.start)}: ${e.text || TYPE_LABEL[e.type]}`,
          n: e.n,
          text: `${e.n} ${e.type === 'cut' ? 'Cut' : e.text || TYPE_LABEL[e.type]}`,
        },
      ]
    }),
  ]

  const editsSorted = [...edits].sort((a, b) => (a.start ?? 1e9) - (b.start ?? 1e9) || a.n - b.n)
  const notesSorted = [...notes].sort((a, b) => a.start - b.start || a.n - b.n)
  const renderRunning = !!render && (render.status === 'queued' || render.status === 'rendering')
  const renderCoversShown = !!render && edits.some((e) => !!e.id && render.ids.includes(e.id))
  const lastDone = latestRequest(requests, 'render_all')
  const doneWaiting = lastDone?.status === 'pending' && !renderRunning
  const composing = !!draft || !!elSel || !!qcFlag

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="studio-skin min-h-full bg-floor text-ink" data-cut-editor={slug}>
      {/* header */}
      <header className="flex items-center gap-2 border-b border-outline px-4 py-2 lg:px-6">
        <Link href={backHref} className="-ml-2 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-ink-muted hover:bg-surface hover:text-ink" aria-label="All cuts">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-label font-bold text-ink sm:text-heading" title={review.version}>
            {title}
          </h1>
          <p className="truncate text-caption text-ink-muted">{sub}</p>
        </div>
        <span className="text-caption max-sm:hidden" aria-live="polite">
          {status.kind === 'saving' && <span className="text-ink-muted">Saving</span>}
          {status.kind === 'saved' && <span className="text-ink-muted">Saved</span>}
          {status.kind === 'error' && <span className="text-bad">{status.text}</span>}
        </span>
      </header>
      {status.kind === 'error' && <p className="px-4 pt-2 text-caption text-bad sm:hidden">{status.text}</p>}
      {warning && (
        <p className="mx-4 mt-2 flex items-start gap-2 rounded-md border border-outline bg-surface px-3 py-2 text-caption text-mid" role="status">
          <span className="flex-1">{warning}</span>
          <button type="button" onClick={() => setWarning(null)} aria-label="Close" className="text-ink-muted">
            <X className="h-4 w-4" />
          </button>
        </p>
      )}

      {siblings.length > 1 && (
        <nav aria-label="Other cuts of this concept" className="flex gap-2 overflow-x-auto px-4 py-2 lg:px-6">
          {siblings.map((s) => (
            <Link
              key={s.slug}
              href={s.href}
              aria-current={s.slug === slug ? 'page' : undefined}
              className={`shrink-0 rounded-full px-3 py-1.5 text-caption font-semibold ${s.slug === slug ? 'bg-accent text-accent-ink' : 'bg-surface text-ink-secondary hover:text-ink'}`}
            >
              {s.label}
            </Link>
          ))}
        </nav>
      )}

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start lg:gap-x-6 lg:gap-y-3 lg:px-6 lg:pb-6">
        {/* ── player: sticky on the phone so the video stays the hero while you scroll the list (Harry, 2026-10-19: "the
             video is taking up like 15% of the screen"). Phone: about half the screen, never under ~38% with the
             composer open. Desktop: the section dissolves into the grid (video + transport left, panel right, the
             timeline full width under both, DaVinci-style). ── */}
        <section ref={playerRef} aria-label="Player" className="sticky top-0 z-30 border-b border-outline bg-floor px-4 pb-2 pt-2 lg:contents" data-player>
          <div
            className={`relative mx-auto flex items-center justify-center overflow-hidden rounded-lg bg-floor ${composing ? 'h-[38dvh]' : 'h-[48dvh]'} transition-[height] duration-base lg:col-start-1 lg:row-start-1 ${qcBlocks.length && onOriginal ? 'lg:h-[max(340px,calc(100dvh-468px))]' : 'lg:h-[max(340px,calc(100dvh-440px))]'} lg:w-full lg:rounded-xl lg:border lg:border-outline lg:bg-surface`}
            data-stage
          >
            {videoError ? (
              <p className="px-6 text-center text-caption text-ink-muted">This video could not play here. The play link may have run out (reload the page), or this browser cannot play the file.</p>
            ) : (
              <video
                ref={(el) => {
                  vRef.current = el
                  setVideoEl((p) => (p === el ? p : el))
                }}
                key={src}
                src={src}
                playsInline
                preload="metadata"
                className="h-full w-auto max-w-full rounded-lg transition-[filter] duration-base"
                style={lockHere ? { filter: 'blur(14px) grayscale(0.7) brightness(0.7)' } : undefined}
                onClick={togglePlay}
                onLoadedMetadata={(e) => setDur(Math.max(0.5, e.currentTarget.duration || dur))}
                onTimeUpdate={(e) => !playing && setT(e.currentTarget.currentTime)}
                onPlay={() => setPlaying(true)}
                onPause={(e) => {
                  setPlaying(false)
                  setT(e.currentTarget.currentTime)
                }}
                onError={() => setVideoError(true)}
              />
            )}
            {lockHere && (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1 text-label font-semibold text-ink shadow-raised">
                  <Lock className="h-4 w-4" aria-hidden /> In edit · #{lockHere.n}
                </span>
                <span className="text-caption text-ink">
                  {lockHerePhase?.kind === 'rendering' ? `${lockHerePhase.pct}% · ${lockHerePhase.step || 'rendering'}` : 'Waiting for Claude. The rest plays on.'}
                </span>
                {lockHerePhase?.kind === 'rendering' && <Bar pct={lockHerePhase.pct} className="w-40" />}
              </div>
            )}
            {!onOriginal && <span className="absolute left-2 top-2 rounded-full bg-surface px-2 py-0.5 text-micro font-semibold text-ink">Render {renderN! + 1}</span>}
          </div>

          {/* transport: play, time, frame / second steps, zoom, all in one row */}
          <div className="mt-2 lg:col-start-1 lg:row-start-2 lg:mt-0">
            <div className="flex items-center gap-1">
              <button type="button" onClick={togglePlay} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-floor" aria-label={playing ? 'Pause' : 'Play'} data-play>
                {playing ? <Pause className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5" />}
              </button>
              <span className="ml-1 whitespace-nowrap font-mono text-label tabular-nums text-ink" data-tc>
                {tc(t)}
                <span className="text-caption text-ink-faint max-sm:hidden"> / {tc(dur)}</span>
              </span>
              <span className="ml-auto flex items-center gap-1">
                <Nudge label="Back 1 second" onClick={() => seek(t - 1)} text="1s" dir={-1} />
                <Nudge label="Back 1 frame" onClick={() => seek(t - 1 / FPS)} text="1f" dir={-1} />
                <Nudge label="On 1 frame" onClick={() => seek(t + 1 / FPS)} text="1f" dir={1} />
                <Nudge label="On 1 second" onClick={() => seek(t + 1)} text="1s" dir={1} />
                <span className="mx-0.5 h-6 w-px bg-outline" aria-hidden />
                <ZoomBtn label="Zoom out" disabled={zoom <= ZOOM_MIN} onClick={() => setZoom(clampZoom(zoom / 1.6))}>
                  <ZoomOut className="h-4 w-4" aria-hidden />
                </ZoomBtn>
                <ZoomBtn label="Zoom in" disabled={zoom >= ZOOM_MAX} onClick={() => setZoom(clampZoom(zoom * 1.6))}>
                  <ZoomIn className="h-4 w-4" aria-hidden />
                </ZoomBtn>
              </span>
            </div>
            {renders.length > 0 && (
              <div className="mt-2 flex items-center gap-2 overflow-x-auto" role="radiogroup" aria-label="Which version plays">
                {[null, ...renders.map((_, i) => i)].map((i) => (
                  <button
                    key={String(i)}
                    type="button"
                    role="radio"
                    aria-checked={renderN === i}
                    onClick={() => setRenderN(i)}
                    className={`shrink-0 rounded-full px-3 py-1 text-caption font-semibold ${renderN === i ? 'bg-ink text-floor' : 'bg-surface-raised text-ink-secondary'}`}
                  >
                    {i === null ? 'Original' : `Render ${i + 1}`}
                  </button>
                ))}
                {!onOriginal && <span className="text-micro text-ink-muted">Times are in the original. Switch back to add.</span>}
              </div>
            )}
          </div>

          <div className="mt-2 lg:col-span-2 lg:row-start-3 lg:mt-0">
            <ScrubTimeline
              dur={dur}
              t={t}
              playing={playing}
              zoom={zoom}
              setZoom={setZoom}
              blocks={onOriginal ? blocks : []}
              locked={onOriginal ? lockedWithPct : []}
              draft={draftRange && draft ? { ...draftRange, kind: draft.kind } : null}
              selected={selected}
              assets={timeline?.assets ?? null}
              stripUrl={timeline?.strip ? api('/strip') : null}
              videoSrc={original}
              onSeek={(s) => {
                vRef.current?.pause()
                seek(s)
              }}
              onPick={pick}
              lanes={lanes}
              selectedEl={onOriginal ? elSel : null}
              onPickElement={(l, c) => onOriginal && pickElement(l, c)}
              marks={onOriginal ? marks : []}
              qc={onOriginal ? qcBlocks : []}
              selectedQc={qcSel}
            />
            <p className="mt-1 text-micro text-ink-muted max-lg:hidden">
              <span className="text-tonote">Teal</span> review notes · <span className="text-toclaude">Blue</span> edits for Claude · <span className="text-mid">Amber</span> auto-QC (dashed = possible) · tap a shot, sound, caption or banner to change it · striped = cut out · drag the ruler to scrub · ctrl + scroll to zoom
            </p>
          </div>
        </section>

        {/* ── the script under the timeline (folded away on the phone while writing, so the composer sits right under it) ── */}
        <div className={`lg:col-span-2 lg:row-start-4 ${composing ? 'max-lg:hidden' : ''}`}>
          <ScriptLine review={review} t={t} onSeek={seek} />
        </div>

        {/* ── the panel ── */}
        {/* phone: with a QC flag open, room under it so the page can lift the flag right up under the sticky player */}
        <aside aria-label="Edits and notes" className={`px-4 pt-3 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:h-0 lg:min-h-full lg:overflow-y-auto lg:rounded-xl lg:border lg:border-outline lg:bg-surface lg:px-4 lg:pb-4 ${qcFlag ? 'pb-[45dvh]' : 'pb-8'}`}>
          <div role="tablist" aria-label="Who it is for" className="grid grid-cols-2 gap-1 rounded-lg bg-surface-raised p-1">
            {(
              [
                ['claude', MODE_LABEL.edit, edits.length, 'toclaude'],
                ['review', MODE_LABEL.review, notes.length, 'tonote'],
              ] as const
            ).map(([k, label, count, tone]) => (
              <button
                key={k}
                role="tab"
                type="button"
                aria-selected={tab === k}
                onClick={() => {
                  setTab(k)
                  setDraft(null)
                }}
                className={`flex h-11 items-center justify-center gap-2 rounded-md text-label font-semibold transition duration-fast ${
                  tab === k ? (tone === 'toclaude' ? 'bg-toclaude text-floor' : 'bg-tonote text-floor') : 'text-ink-secondary hover:text-ink'
                }`}
              >
                {label}
                <span className={`rounded-full px-1.5 text-micro ${tab === k ? 'text-floor' : 'bg-surface text-ink-muted'}`}>{count}</span>
              </button>
            ))}
          </div>

          {/* taste notes: up to 3 proposals from our past notes and the Knowitball client rules (gone once answered) */}
          {!draft && !elSel && !qcFlag && (
            <TasteNotes
              notes={qcV.taste}
              saving={status.kind === 'saving'}
              onSeek={seek}
              onNote={(n) => void acceptTasteNote(n)}
              onEdit={(n) => void acceptQcEdit(n, 'taste')}
              onDismiss={(n) => void dismissQc(n.id)}
            />
          )}

          {/* an auto-QC flag: what was found and the one proposed change (replaces Add while open) */}
          {qcFlag && (
            <QcInspector
              flag={qcFlag}
              state={qcState(qcFlag.id, qcAnswers, edits)}
              check={qc?.checks.find((c) => c.id === qcFlag.check)}
              saving={status.kind === 'saving'}
              onAccept={() => void acceptQcEdit(qcFlag, 'qc')}
              onDismiss={() => void dismissQc(qcFlag.id)}
              onClose={() => setQcSel(null)}
            />
          )}

          {/* the inspector for the selected element (replaces Add while open) */}
          {elSel && selLane && (
            <ElementInspector
              lane={selLane}
              clip={selClip}
              t={t}
              dur={dur}
              previewMode={preview.mode}
              previewGain={selLane.kind === 'video' || selLane.kind === 'captions' || selLane.kind === 'banner' ? null : (preview.gains[selLane.id] ?? null)}
              saving={status.kind === 'saving'}
              onDraft={setElDraft}
              onSave={(c) => void saveElementChanges(c)}
              onDeleteShot={(c) => void saveElementChanges([c])}
              onClose={closeInspector}
              onPrime={preview.prime}
            />
          )}

          {/* Add at the playhead */}
          {!draft && !elSel && !qcFlag && (
            <button
              type="button"
              disabled={!onOriginal || !!lockHere}
              onClick={() => openNew(tab === 'claude' ? 'edit' : 'note')}
              className={`mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-lg text-label font-semibold shadow-rest transition duration-fast disabled:opacity-50 ${tab === 'claude' ? 'bg-toclaude text-floor' : 'bg-tonote text-floor'}`}
            >
              <Plus className="h-5 w-5" aria-hidden />
              {lockHere ? `${tc(t)} is in edit. Move the playhead.` : tab === 'claude' ? `Add an edit at ${tc(t)}` : `Add a note at ${tc(t)}`}
            </button>
          )}

          {draft && (
            <Composer
              draft={draft}
              setDraft={setDraft}
              t={t}
              dur={dur}
              clash={draftClash ? draftClash.n : null}
              empty={draftEmpty}
              saving={status.kind === 'saving'}
              onSave={saveDraft}
              textRef={textRef}
            />
          )}

          {/* the footer: Done (Claude) or Copy notes (review) */}
          {!draft && !elSel && !qcFlag && (
            <div className="mt-2">
              {tab === 'claude' ? (
                doneAsk ? (
                  <div className="flex items-center gap-2">
                    <p className="flex-1 text-caption text-ink">Render all {toRender.length} edits in one pass?</p>
                    <button type="button" onClick={() => void done()} className="h-11 rounded-md bg-ink px-4 text-label font-semibold text-floor">
                      Render all
                    </button>
                    <button type="button" onClick={() => setDoneAsk(false)} className="h-11 rounded-md px-3 text-label text-ink-secondary">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={!notSent.length || status.kind === 'saving'}
                    onClick={() => setDoneAsk(true)}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-ink text-label font-semibold text-floor shadow-raised transition duration-fast disabled:bg-surface-raised disabled:text-ink-muted"
                    data-done
                  >
                    <Check className="h-5 w-5" aria-hidden />
                    {notSent.length ? `Done: render all ${toRender.length} ${toRender.length === 1 ? 'edit' : 'edits'}` : toRender.length ? 'All edits sent to Claude' : 'Done: no edits yet'}
                  </button>
                )
              ) : (
                <button
                  type="button"
                  disabled={!notes.length}
                  onClick={() => void copyNotes()}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-outline text-label font-semibold text-ink disabled:opacity-40"
                >
                  <Copy className="h-4 w-4" aria-hidden /> {copied ? 'Copied' : `Copy notes${notes.length ? ` (${notes.length})` : ''}`}
                </button>
              )}
            </div>
          )}
          {/* render progress that is not tied to an edit on this page (e.g. a render Claude started from a chat) */}
          {tab === 'claude' && render && !renderCoversShown && (render.status !== 'done' || render.version_url) && <RenderCard render={render} />}
          {tab === 'claude' && doneWaiting && (
            <p className="mt-3 rounded-lg border border-outline bg-surface-raised px-3 py-2 text-caption text-ink-secondary" data-done-sent>
              <Check className="mr-1 inline h-4 w-4 text-good" aria-hidden />
              Done pressed for {lastDone!.count} {lastDone!.count === 1 ? 'edit' : 'edits'}. {SENT_LINE}
            </p>
          )}

          {/* the list */}
          <ul className="mt-3 space-y-2">
            {tab === 'claude' &&
              (editsSorted.length ? (
                editsSorted.map((e) => (
                  <EditCard
                    key={e.n}
                    e={e}
                    phase={phases.get(e.n)!}
                    selected={selected === `edit:${e.n}`}
                    onSeek={() => e.start !== undefined && seek(e.start)}
                    onEdit={() => openEditEntry(e)}
                    onDelete={() => void deleteEdit(e)}
                    lockAsk={lockAsk === e.n}
                    onLockAsk={() => setLockAsk(e.n)}
                    onLockCancel={() => setLockAsk(null)}
                    onLock={() => void lockEdit(e)}
                    onUndo={() => void undoApplied(e)}
                  />
                ))
              ) : (
                <Empty text="No edits yet. Scrub to a moment and add one. Claude collects them; Lock one to render it now, or press Done when you have them all." />
              ))}
            {tab === 'review' &&
              (notesSorted.length ? (
                notesSorted.map((c) => (
                  <NoteCard key={c.n} c={c} selected={selected === `note:${c.n}`} onSeek={() => seek(c.start)} onEdit={() => openNoteEntry(c)} onDelete={() => void deleteNote(c)} />
                ))
              ) : (
                <Empty text="No review notes yet. Pause where something is wrong (or right) and add one." />
              ))}
          </ul>
        </aside>
      </div>

      {/* toast with Undo */}
      {toast && (
        <div
          role="status"
          className="fixed inset-x-4 bottom-[calc(140px+env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-md items-center gap-3 rounded-lg border border-outline bg-surface px-4 py-3 shadow-raised md:bottom-24"
        >
          <p className="flex-1 text-caption text-ink">{toast.text}</p>
          {toast.undo && (
            <button
              type="button"
              onClick={() => {
                const u = toast.undo
                setToast(null)
                u?.()
              }}
              className="inline-flex h-9 items-center gap-1 rounded-md bg-surface-raised px-3 text-caption font-semibold text-ink"
            >
              <Undo2 className="h-4 w-4" aria-hidden /> Undo
            </button>
          )}
          <button type="button" onClick={() => setToast(null)} aria-label="Close" className="text-ink-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  )
}

// ── pieces ──────────────────────────────────────────────────────────────────

function Nudge({ label, onClick, text, dir }: { label: string; onClick: () => void; text: string; dir: -1 | 1 }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="inline-flex h-9 min-w-[34px] items-center justify-center rounded-md bg-surface-raised px-0.5 font-mono text-micro text-ink-secondary hover:text-ink sm:h-10 sm:min-w-[44px] sm:gap-0.5 sm:px-2"
    >
      {dir < 0 && <ChevronLeft className="h-4 w-4" aria-hidden />}
      {text}
      {dir > 0 && <ChevronRight className="h-4 w-4" aria-hidden />}
    </button>
  )
}

function ZoomBtn({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      data-zoom={label === 'Zoom in' ? 'in' : 'out'}
      className="inline-flex h-9 w-[34px] items-center justify-center rounded-md bg-surface-raised text-ink-secondary hover:text-ink disabled:opacity-40 sm:h-10 sm:w-10"
    >
      {children}
    </button>
  )
}

function Bar({ pct, className = '' }: { pct: number; className?: string }) {
  return (
    <span className={`block h-2 overflow-hidden rounded-full bg-surface-raised ${className}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
      <span className="block h-full rounded-full bg-good transition-[width] duration-slow" style={{ width: `${Math.max(3, pct)}%` }} />
    </span>
  )
}

function Empty({ text }: { text: string }) {
  return <li className="rounded-lg border border-dashed border-outline px-4 py-6 text-center text-caption text-ink-muted">{text}</li>
}

function Composer({
  draft,
  setDraft,
  t,
  dur,
  clash,
  empty,
  saving,
  onSave,
  textRef,
}: {
  draft: Draft
  setDraft: (d: Draft | null) => void
  t: number
  dur: number
  clash: number | null
  empty: boolean
  saving: boolean
  onSave: () => void
  textRef: React.MutableRefObject<HTMLTextAreaElement | null>
}) {
  const isEdit = draft.kind === 'edit'
  const ranged = !(isEdit && draft.type === 'general')
  const set = (p: Partial<Draft>) => setDraft({ ...draft, ...p })
  const now = Math.round(Math.min(dur, t) * 100) / 100
  const placeholder = !isEdit
    ? 'What is wrong (or right) here?'
    : draft.type === 'cut'
      ? 'Why it goes (optional)'
      : draft.type === 'general'
        ? 'A change for the whole video'
        : 'What should Claude change here?'
  return (
    <div
      className={`mt-3 rounded-lg border-2 bg-surface p-3 max-lg:[&_button]:scroll-mb-[76px] max-lg:[&_button]:scroll-mt-[calc(38dvh+230px)] max-lg:[&_textarea]:scroll-mb-[76px] max-lg:[&_textarea]:scroll-mt-[calc(38dvh+230px)] ${isEdit ? 'border-toclaude' : 'border-tonote'}`}
      data-composer={draft.kind}
    >
      <div className="flex items-center justify-between">
        <p className="text-label font-semibold text-ink">{draft.n === null ? (isEdit ? 'New edit for Claude' : 'New review note') : `Change #${draft.n}`}</p>
        <button type="button" onClick={() => setDraft(null)} className="inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-muted hover:text-ink" aria-label="Cancel">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1" role="radiogroup" aria-label={isEdit ? 'Kind of edit' : 'Tag'}>
        {isEdit
          ? (['at', 'cut', 'general'] as const).map((k) => (
              <Chip key={k} on={draft.type === k} onClick={() => set({ type: k })}>
                {k === 'cut' && <Scissors className="h-3.5 w-3.5" aria-hidden />}
                {TYPE_LABEL[k]}
              </Chip>
            ))
          : (['fix', 'keep', 'check'] as const).map((k) => (
              <Chip key={k} on={draft.tag === k} onClick={() => set({ tag: k })}>
                {TAG_LABEL[k]}
              </Chip>
            ))}
      </div>
      {ranged && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {(['start', 'end'] as const).map((k) => (
            <div key={k} className="flex items-center justify-between rounded-md bg-surface-raised px-3 py-1.5">
              <span>
                <span className="block text-micro text-ink-muted">{k === 'start' ? 'From' : 'To'}</span>
                <span className="font-mono text-label tabular-nums text-ink">{tc(draft[k])}</span>
              </span>
              <button
                type="button"
                onClick={() => set(k === 'start' ? { start: now, end: Math.max(draft.end, now) } : { end: now, start: Math.min(draft.start, now) })}
                className="h-9 rounded-md bg-surface px-2 text-caption font-semibold text-ink"
                title={`Set to the playhead (${tc(now)})`}
              >
                Set to {tc(now)}
              </button>
            </div>
          ))}
          <p className="col-span-2 text-micro text-ink-muted max-sm:hidden">Scrub the timeline, then tap Set. The highlighted block on the timeline shows the range.</p>
        </div>
      )}
      <WithMic value={draft.text} onChange={(text) => set({ text })} className="mt-3">
      <textarea
        ref={textRef}
        value={draft.text}
        onChange={(e) => set({ text: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && !('ontouchstart' in window)) {
            e.preventDefault()
            onSave()
          }
        }}
        rows={3}
        placeholder={placeholder}
        className="block min-h-[72px] w-full resize-y sm:min-h-[96px] rounded-md border border-outline bg-floor py-2 pl-3 pr-14 text-body text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
      />
      </WithMic>
      {clash !== null && <p className="mt-2 text-caption text-bad">That range overlaps #{clash}, which is in edit. Pick a time outside the grey part.</p>}
      {/* Save stays on screen while the composer is: it sticks to the bottom edge as the page scrolls */}
      <div className="sticky bottom-0 z-10 -mx-3 -mb-3 mt-1 rounded-b-lg bg-surface px-3 pt-1 pb-[max(12px,env(safe-area-inset-bottom))]">
        <button
          type="button"
          disabled={empty || clash !== null || saving}
          onClick={onSave}
          data-save
          className={`flex h-11 w-full items-center justify-center rounded-md text-label font-semibold text-floor disabled:opacity-40 ${isEdit ? 'bg-toclaude' : 'bg-tonote'}`}
        >
          {draft.n === null ? (isEdit ? 'Save for Claude' : 'Save note') : 'Save change'}
        </button>
      </div>
    </div>
  )
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onClick}
      className={`inline-flex h-9 items-center gap-1 rounded-full px-3 text-caption font-semibold ${on ? 'bg-ink text-floor' : 'bg-surface-raised text-ink-secondary hover:text-ink'}`}
    >
      {children}
    </button>
  )
}

function phaseTone(p: EditPhase): string {
  if (p.kind === 'applied' || p.kind === 'rendered') return 'bg-good/15 text-good'
  if (p.kind === 'failed') return 'bg-bad/15 text-bad'
  if (p.kind === 'sent' || p.kind === 'rendering') return 'bg-mid/15 text-mid'
  if (p.kind === 'undone') return 'bg-surface-raised text-ink-faint'
  return 'bg-surface-raised text-ink-secondary'
}

function EditCard({
  e,
  phase,
  selected,
  onSeek,
  onEdit,
  onDelete,
  lockAsk,
  onLockAsk,
  onLockCancel,
  onLock,
  onUndo,
}: {
  e: EditEntry
  phase: EditPhase
  selected: boolean
  onSeek: () => void
  onEdit: () => void
  onDelete: () => void
  lockAsk: boolean
  onLockAsk: () => void
  onLockCancel: () => void
  onLock: () => void
  onUndo: () => void
}) {
  const r = editRange(e)
  const inEdit = isLocked(e) || phase.kind === 'rendering' || phase.kind === 'sent' || phase.kind === 'rendered'
  const busy = phase.kind === 'rendering' || phase.kind === 'sent'
  const open = phase.kind === 'queued' || phase.kind === 'edited' || phase.kind === 'failed'
  return (
    <li
      id={`card-edit-${e.n}`}
      className={`rounded-lg border bg-surface p-3 transition-shadow duration-fast ${selected ? 'border-toclaude ring-1 ring-toclaude' : 'border-outline'} ${phase.kind === 'undone' ? 'opacity-60' : ''}`}
      data-edit-card={e.n}
      data-element={e.element ? `${e.element.lane}:${e.element.op}` : undefined}
      data-phase={phase.kind}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-mono text-caption font-semibold text-ink-muted">#{e.n}</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-toclaude/15 px-2 py-0.5 text-micro font-semibold text-toclaude">
          {e.type === 'cut' && <Scissors className="h-3 w-3" aria-hidden />}
          {e.element ? `${e.element.label || e.element.lane} · ${elementTag(e.element)}` : TYPE_LABEL[e.type]}
        </span>
        {r && (
          <button type="button" onClick={onSeek} className="whitespace-nowrap font-mono text-caption tabular-nums text-ink underline decoration-outline underline-offset-2">
            {e.type === 'at' && e.end === undefined ? tc(r.start) : `${tc(r.start)} to ${tc(r.end)}`}
          </button>
        )}
        <span className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-micro font-semibold ${phaseTone(phase)}`}>{phaseLabel(phase)}</span>
      </div>

      {/* while it is being worked on, the progress bar takes the place of the edit (Harry, 2026-10-19) */}
      {busy ? (
        <div className="mt-3 space-y-1.5" data-progress>
          <Bar pct={phase.kind === 'rendering' ? phase.pct : 4} />
          <p className="text-caption text-ink-secondary">
            {phase.kind === 'rendering' ? [phase.step || 'Rendering', phase.eta && `about ${phase.eta.replace(/^about\s+/i, '')} left`].filter(Boolean).join(' · ') : SENT_LINE}
          </p>
          {e.text && <p className="truncate text-micro text-ink-faint">{e.text}</p>}
        </div>
      ) : (
        <p className={`mt-2 whitespace-pre-wrap text-label text-ink ${phase.kind === 'undone' ? 'line-through' : ''} ${!e.text ? 'text-ink-muted' : ''}`}>
          {e.text || (e.type === 'cut' ? 'Take this bit out.' : '')}
        </p>
      )}
      {phase.kind === 'rendered' && (
        <p className="mt-2 text-caption text-good">
          Rendered.{' '}
          {phase.url && (
            <a href={phase.url} target="_blank" rel="noopener noreferrer" className="underline">
              Open the new version
            </a>
          )}
        </p>
      )}
      {phase.kind === 'failed' && <p className="mt-2 text-caption text-bad">The render failed{phase.step ? `: ${phase.step}` : ''}. Lock it again or press Done.</p>}

      {lockAsk ? (
        <div className="mt-3 rounded-md bg-surface-raised p-2">
          <p className="text-caption text-ink">Lock #{e.n} and render it now? That part goes grey and you can&apos;t add notes on it until it&apos;s back.</p>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={onLock} className="inline-flex h-10 items-center gap-1.5 rounded-md bg-toclaude px-3 text-caption font-semibold text-floor">
              <Lock className="h-4 w-4" aria-hidden /> Lock &amp; render
            </button>
            <button type="button" onClick={onLockCancel} className="h-10 rounded-md px-3 text-caption text-ink-secondary">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        !inEdit && (
          <div className="mt-3 flex flex-wrap gap-2">
            {open && canLock(e) && (
              <button type="button" onClick={onLockAsk} className="inline-flex h-10 items-center gap-1.5 rounded-md bg-toclaude/15 px-3 text-caption font-semibold text-toclaude">
                <Lock className="h-4 w-4" aria-hidden /> Lock &amp; render
              </button>
            )}
            {open && !e.element && (
              <button type="button" onClick={onEdit} className="inline-flex h-10 items-center gap-1.5 rounded-md bg-surface-raised px-3 text-caption font-semibold text-ink">
                <Pencil className="h-4 w-4" aria-hidden /> Edit
              </button>
            )}
            {open && (
              <button type="button" onClick={onDelete} className="inline-flex h-10 items-center gap-1.5 rounded-md bg-surface-raised px-3 text-caption font-semibold text-ink-secondary hover:text-bad">
                <Trash2 className="h-4 w-4" aria-hidden /> {e.type === 'cut' ? 'Remove cut' : 'Delete'}
              </button>
            )}
            {phase.kind === 'applied' && (
              <button type="button" onClick={onUndo} className="inline-flex h-10 items-center gap-1.5 rounded-md bg-surface-raised px-3 text-caption font-semibold text-ink">
                <Undo2 className="h-4 w-4" aria-hidden /> Undo this edit
              </button>
            )}
          </div>
        )
      )}
    </li>
  )
}

function NoteCard({ c, selected, onSeek, onEdit, onDelete }: { c: ReviewComment; selected: boolean; onSeek: () => void; onEdit: () => void; onDelete: () => void }) {
  return (
    <li id={`card-note-${c.n}`} className={`rounded-lg border bg-surface p-3 ${selected ? 'border-tonote ring-1 ring-tonote' : 'border-outline'}`} data-note-card={c.n}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-mono text-caption font-semibold text-ink-muted">#{c.n}</span>
        <span className={`rounded-full px-2 py-0.5 text-micro font-semibold ${c.tag === 'fix' ? 'bg-tonote/15 text-tonote' : 'bg-surface-raised text-ink-secondary'}`}>{TAG_LABEL[c.tag]}</span>
        <button type="button" onClick={onSeek} className="whitespace-nowrap font-mono text-caption tabular-nums text-ink underline decoration-outline underline-offset-2">
          {c.end - c.start >= 0.2 ? `${tc(c.start)} to ${tc(c.end)}` : tc(c.start)}
        </button>
        {c.author && <span className="ml-auto text-micro text-ink-muted">{c.author}</span>}
      </div>
      <p className="mt-2 whitespace-pre-wrap text-label text-ink">{c.note}</p>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={onEdit} className="inline-flex h-10 items-center gap-1.5 rounded-md bg-surface-raised px-3 text-caption font-semibold text-ink">
          <Pencil className="h-4 w-4" aria-hidden /> Edit
        </button>
        <button type="button" onClick={onDelete} className="inline-flex h-10 items-center gap-1.5 rounded-md bg-surface-raised px-3 text-caption font-semibold text-ink-secondary hover:text-bad">
          <Trash2 className="h-4 w-4" aria-hidden /> Delete
        </button>
      </div>
    </li>
  )
}

function RenderCard({ render }: { render: RenderProgress }) {
  const running = render.status === 'queued' || render.status === 'rendering'
  return (
    <div className="mt-3 rounded-lg border border-outline bg-surface p-3" data-render-card={render.status}>
      <div className="flex items-center gap-2">
        <p className="text-label font-semibold text-ink">{running ? 'Render in progress' : render.status === 'done' ? 'Render done' : 'Render failed'}</p>
        <span
          className={`ml-auto rounded-full px-2 py-0.5 text-micro font-semibold ${render.status === 'failed' ? 'bg-bad/15 text-bad' : render.status === 'done' ? 'bg-good/15 text-good' : 'bg-mid/15 text-mid'}`}
        >
          {render.pct}%
        </span>
      </div>
      <Bar pct={render.pct} className="mt-2" />
      <p className="mt-1.5 text-caption text-ink-secondary">{[render.step, render.eta && running && `${render.eta.replace(/^about\s+/i, 'about ')} left`].filter(Boolean).join(' · ')}</p>
      {render.version_url && (
        <a href={render.version_url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-caption font-semibold text-accent underline">
          Open the new version
        </a>
      )}
    </div>
  )
}

/** The words as said, under the timeline: the current word lights up and stays in view; tap a word to jump. */
function ScriptLine({ review, t, onSeek }: { review: Review; t: number; onSeek: (s: number) => void }) {
  const box = useRef<HTMLDivElement | null>(null)
  const words = useMemo(() => (review.transcript?.segments ?? []).flatMap((s) => (s.words.length ? s.words : [[s.start, s.end, s.text] as [number, number, string]])), [review.transcript])
  const cur = words.findIndex(([a, b]) => t >= a && t < b + 0.05)
  useEffect(() => {
    if (cur < 0) return
    const el = box.current?.querySelector<HTMLElement>(`[data-w="${cur}"]`)
    const b = box.current
    if (el && b)
      b.scrollTo({
        left: el.offsetLeft - b.clientWidth / 2 + el.clientWidth / 2,
        behavior: 'smooth',
      })
  }, [cur])
  if (!words.length) return null
  return (
    <div className="border-b border-outline px-4 py-2 lg:mt-3 lg:rounded-xl lg:border lg:bg-surface lg:px-4">
      <div className="flex items-center gap-2">
        <span className="shrink-0 text-micro font-semibold text-ink-muted">What&apos;s said</span>
      </div>
      {words.length > 0 && (
        <div ref={box} className="mt-1 flex gap-1 overflow-x-auto whitespace-nowrap pb-1 [scrollbar-width:none]">
          {words.map(([a, , w], i) => {
            return (
              <button
                key={i}
                type="button"
                data-w={i}
                onClick={() => onSeek(a)}
                className={`shrink-0 rounded px-1 py-0.5 text-label ${i === cur ? 'bg-ink text-floor' : 'text-ink-secondary hover:text-ink'}`}
              >
                {w.trim()}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
