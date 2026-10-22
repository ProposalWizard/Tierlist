'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { rulerStep } from '@/lib/studio/suite'
import { clampZoom, followScroll, peaksFromSamples, stripFrameAt, stripTiles, waveformPath, type TimelineAssets } from '@/lib/studio/timeline'
import type { LockedRange, Range } from '@/lib/studio/edit-lock'
import { useThumbnails } from './thumbnails'
import { isAudioKind, type Lane, type Lanes } from '@/lib/studio/elements'

/**
 * The suite's timeline (rebuilt 2026-10-19 after Harry: "the actual timeline is almost invisible - if you go and look at
 * say davinci or even capcut mobile u can see a working timeline"). Top to bottom:
 *   ruler (drag here to scrub, always) · FILMSTRIP of the cut · WAVEFORM of its sound · review notes (teal) ·
 *   edits for Claude (cobalt, cuts striped and also veiled over the picture) · the range being written, highlighted
 *   across every track · "In edit" ranges hatched · a bold playhead with a handle.
 * Zoom: the parent's - / + buttons, pinch, or ctrl + wheel; zoomed in, a swipe on the tracks scrolls and the view
 * follows the playhead while playing. A tap seeks (or picks the block under the finger). Times are the ORIGINAL cut.
 * The filmstrip and waveform come from <slug>.strip.jpg + <slug>.peaks.json (made at load); without them they are
 * drawn from the video in the browser.
 *
 * ELEMENT LANES (Harry, 2026-10-20: "I could directly choose what element I am interested i.e click on the audio track
 * and turn down the volume etc."): the picture and sound rows are now the cut's own lanes (<slug>.lanes.json): Video
 * (one block per shot), then the full mix, or for our own builds Voices / Music / SFX, then Captions and Banner. A tap
 * on a block SELECTS that element (and moves the playhead there); the inspector opens. Every change saved on an element
 * shows as a labelled marker on its lane ("-6 dB", "1.5x", "Swap"); the unsaved one is dashed.
 */
export type ElementMark = { key: string; lane: string; start: number; end: number; tag: string; draft?: boolean }
/** An auto-QC flag on the QC lane (amber; dashed = "possible"; dim = accepted). lib/studio/qc.ts */
export type QcBlock = { id: string; start: number; end: number; title: string; possible: boolean; accepted: boolean }
type Row = { lane: Lane; top: number; h: number }
export type Block = Range & {
  key: string
  kind: 'note' | 'edit'
  /** Spoken label (aria). */
  label: string
  /** Its number, shown alone when the block is too narrow for text. */
  n: number
  /** Shown on the block when there is room: "1 Cut", "2 Swap this line". */
  text: string
  cut?: boolean
  dim?: boolean
}

const TAP_PX = 8
/** Functional hatching, not decoration: a cut reads as "this goes", a locked range as "closed, in edit". */
const CUT_STRIPES = 'repeating-linear-gradient(135deg, transparent 0 6px, color-mix(in oklch, var(--floor) 35%, transparent) 6px 8px)'
const CUT_VEIL = 'repeating-linear-gradient(135deg, color-mix(in oklch, var(--floor) 70%, transparent) 0 6px, color-mix(in oklch, var(--floor) 40%, transparent) 6px 12px)'
const LOCK_HATCH = 'repeating-linear-gradient(45deg, color-mix(in oklch, var(--ink) 12%, transparent) 0 6px, transparent 6px 12px)'

/** Waveform drawn from the video in the browser, only when the peaks file is missing. */
function usePeaksFallback(src: string, enabled: boolean): number[] | null {
  const [peaks, setPeaks] = useState<number[] | null>(null)
  useEffect(() => {
    if (!enabled) return
    let gone = false
    void (async () => {
      try {
        const buf = await (await fetch(src, { credentials: 'same-origin' })).arrayBuffer()
        const Ctx = window.OfflineAudioContext || (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext
        const audio = await new Ctx(1, 8000, 8000).decodeAudioData(buf)
        if (!gone) setPeaks(peaksFromSamples(audio.getChannelData(0), audio.sampleRate))
      } catch {
        /* no sound track, or a codec this browser cannot decode: the lane stays flat */
      }
    })()
    return () => {
      gone = true
    }
  }, [src, enabled])
  return peaks
}

export function ScrubTimeline({
  dur,
  t,
  playing,
  zoom,
  setZoom,
  blocks,
  locked,
  draft,
  selected,
  assets,
  stripUrl,
  videoSrc,
  onSeek,
  onPick,
  onScrub,
  lanes,
  selectedEl,
  onPickElement,
  marks = [],
  qc = [],
  selectedQc = null,
}: {
  dur: number
  t: number
  playing: boolean
  zoom: number
  setZoom: (z: number) => void
  blocks: Block[]
  locked: (LockedRange & { pct: number | null })[]
  /** The range the open composer will save (highlighted across the tracks). */
  draft: (Range & { kind: 'note' | 'edit' }) | null
  selected: string | null
  assets: TimelineAssets | null
  /** The sprite's URL, or null to draw frames from the video. */
  stripUrl: string | null
  videoSrc: string
  onSeek: (t: number) => void
  onPick: (key: string) => void
  onScrub?: (on: boolean) => void
  /** The cut's element lanes (defaultLanes when none were made). */
  lanes: Lanes
  selectedEl: { lane: string; clip: string | null } | null
  onPickElement: (lane: string, clip: string | null) => void
  marks?: ElementMark[]
  /** The auto-QC lane (Harry, 2026-10-20: "the auto QC track"): a tap picks a flag (onPick("qc:<id>")). */
  qc?: QcBlock[]
  selectedQc?: string | null
}) {
  const scroller = useRef<HTMLDivElement | null>(null)
  const content = useRef<HTMLDivElement | null>(null)
  const [viewW, setViewW] = useState(360)
  const [wide, setWide] = useState(false)
  useLayoutEffect(() => {
    const el = scroller.current
    if (!el) return
    const ro = new ResizeObserver(() => setViewW(el.clientWidth || 360))
    ro.observe(el)
    const mq = window.matchMedia('(min-width: 1024px)')
    const onMq = () => setWide(mq.matches)
    onMq()
    mq.addEventListener('change', onMq)
    return () => {
      ro.disconnect()
      mq.removeEventListener('change', onMq)
    }
  }, [])
  // ── the rows, top to bottom (px): ruler, the element lanes, notes, edits ──
  const H = wide
    ? { R: 22, g: 4, video: 64, audio: 40, stem: 26, captions: 24, banner: 18, lane: 26, qc: 20 }
    : { R: 18, g: 2, video: 40, audio: 24, stem: 16, captions: 16, banner: 12, lane: 20, qc: 14 }
  const rows: Row[] = []
  let y = H.R + H.g
  for (const lane of lanes.lanes) {
    const h = lane.kind === 'video' ? H.video : lane.kind === 'audio' ? H.audio : isAudioKind(lane.kind) ? H.stem : lane.kind === 'captions' ? H.captions : H.banner
    rows.push({ lane, top: y, h })
    y += h + H.g
  }
  const elBottom = y - H.g
  const yNote = y + 1
  const yEdit = yNote + H.lane + H.g
  // the QC lane sits last, under the edits (only when the cut has QC flags)
  const yQc = yEdit + H.lane + H.g
  const totalH = qc.length ? yQc + H.qc + 4 : yEdit + H.lane + 4
  const filmH = H.video
  const W = viewW * zoom
  const pps = W / Math.max(0.1, dur)
  const X = (s: number) => Math.max(0, Math.min(dur, s)) * pps
  const pct = (s: number) => `${(Math.max(0, Math.min(dur, s)) / dur) * 100}%`
  const wid = (a: number, b: number, min: number) => `max(${min}px, ${(Math.max(0, b - a) / dur) * 100}%)`

  // ── zoom keeps the playhead where it was on screen ──
  const prevZoom = useRef(zoom)
  useLayoutEffect(() => {
    const el = scroller.current
    if (!el || prevZoom.current === zoom) return
    const oldX = (t / dur) * viewW * prevZoom.current - el.scrollLeft
    el.scrollLeft = Math.max(0, X(t) - oldX)
    prevZoom.current = zoom
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom])
  // ── the view follows the playhead while playing zoomed in ──
  useEffect(() => {
    const el = scroller.current
    if (!el || zoom <= 1 || !playing) return
    const to = followScroll(X(t), el.scrollLeft, el.clientWidth)
    if (to !== null) el.scrollLeft = to
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, playing, zoom])

  // ── pinch and ctrl + wheel to zoom (non-passive, so the page itself never zooms) ──
  const zoomRef = useRef(zoom)
  zoomRef.current = zoom
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    let pinch: { d0: number; z0: number } | null = null
    const dist = (e: TouchEvent) => Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY)
    const ts = (e: TouchEvent) => {
      if (e.touches.length === 2) pinch = { d0: Math.max(1, dist(e)), z0: zoomRef.current }
    }
    const tm = (e: TouchEvent) => {
      if (!pinch || e.touches.length !== 2) return
      e.preventDefault()
      setZoom(clampZoom((pinch.z0 * dist(e)) / pinch.d0))
    }
    const te = (e: TouchEvent) => {
      if (e.touches.length < 2) pinch = null
    }
    const wh = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      setZoom(clampZoom(zoomRef.current * (e.deltaY < 0 ? 1.2 : 1 / 1.2)))
    }
    el.addEventListener('touchstart', ts, { passive: true })
    el.addEventListener('touchmove', tm, { passive: false })
    el.addEventListener('touchend', te)
    el.addEventListener('wheel', wh, { passive: false })
    return () => {
      el.removeEventListener('touchstart', ts)
      el.removeEventListener('touchmove', tm)
      el.removeEventListener('touchend', te)
      el.removeEventListener('wheel', wh)
    }
  }, [setZoom])

  // ── scrub / tap ──
  const down = useRef<{ x: number; key: string | null; el: string | null; moved: boolean; scrub: boolean; id: number } | null>(null)
  const timeAt = (clientX: number) => {
    const r = content.current?.getBoundingClientRect()
    if (!r || r.width <= 0) return 0
    return Math.max(0, Math.min(dur, ((clientX - r.left) / r.width) * dur))
  }

  // ── the picture ──
  const tileW = Math.max(12, (filmH * 9) / 16)
  const tiles = useMemo(() => stripTiles(W, dur, tileW), [W, dur, tileW])
  const fallbackCount = 24
  const thumbs = useThumbnails(videoSrc, dur, fallbackCount, !stripUrl && dur > 1)
  const fallbackPeaks = usePeaksFallback(videoSrc, !assets && dur > 1)
  const peaks = assets?.peaks ?? fallbackPeaks
  const wave = useMemo(() => (peaks ? waveformPath(peaks) : null), [peaks])
  const stemWaves = useMemo(() => {
    const o: Record<string, { d: string; n: number } | null> = {}
    for (const l of lanes.lanes) if (l.peaks && l.peaks.length && l.kind !== 'audio') o[l.id] = waveformPath(l.peaks, 800)
    return o
  }, [lanes])
  // the waveform's x box: peaks cover rate * duration of the file, which can differ a hair from the player's duration
  const waveW = assets ? Math.min(100, ((assets.peaks.length / assets.rate) / dur) * 100) : 100

  const step = rulerStep(pps, 56)
  const ticks: number[] = []
  for (let s = step; s < dur - step * 0.3; s += step) ticks.push(s)
  const lane = (kind: 'note' | 'edit') => blocks.filter((b) => b.kind === kind)
  const cuts = blocks.filter((b) => b.cut && !b.dim)

  return (
    <div className="select-none" data-tour="timeline">
      <div
        ref={scroller}
        className="relative overflow-x-auto overflow-y-hidden rounded-md border border-outline bg-surface-raised [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ touchAction: zoom > 1 ? 'pan-x' : 'none' }}
        data-tl-scroller
        onPointerDown={(e) => {
          if (e.button !== 0) return
          const target = e.target as HTMLElement
          const key = target.closest<HTMLElement>('[data-block]')?.dataset.block ?? null
          const el = key ? null : (target.closest<HTMLElement>('[data-el]')?.dataset.el ?? null)
          const scrub = e.pointerType === 'mouse' || zoom <= 1 || !!target.closest('[data-scrub]')
          down.current = { x: e.clientX, key, el, moved: false, scrub, id: e.pointerId }
          if (scrub) {
            ;(e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId)
            onScrub?.(true)
            if (!key) onSeek(timeAt(e.clientX))
          }
        }}
        onPointerMove={(e) => {
          const d = down.current
          if (!d || d.id !== e.pointerId) return
          if (!d.moved && Math.abs(e.clientX - d.x) < TAP_PX) return
          d.moved = true
          if (d.scrub) onSeek(timeAt(e.clientX))
        }}
        onPointerUp={(e) => {
          const d = down.current
          down.current = null
          if (!d) return
          if (d.scrub) onScrub?.(false)
          if (d.moved) return
          if (d.key) onPick(d.key)
          else {
            onSeek(timeAt(e.clientX))
            if (d.el) {
              const [ln, clip] = d.el.split('|')
              onPickElement(ln, clip || null)
            }
          }
        }}
        onPointerCancel={() => {
          if (down.current?.scrub) onScrub?.(false)
          down.current = null
        }}
      >
        <div
          ref={content}
          role="slider"
          tabIndex={0}
          aria-label="Timeline: tap or drag to move the playhead"
          aria-valuemin={0}
          aria-valuemax={Math.round(dur * 10) / 10}
          aria-valuenow={Math.round(t * 10) / 10}
          aria-valuetext={`${t.toFixed(1)} seconds`}
          className="relative cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-accent"
          style={{ width: zoom > 1 ? `${W}px` : '100%', height: totalH }}
        >
          {/* ruler: always scrubs, even zoomed in */}
          <div data-scrub className="absolute inset-x-0 top-0 border-b border-outline" style={{ height: H.R, touchAction: 'none' }}>
            {ticks.map((s) => (
              <span key={s} className="absolute top-0 h-full border-l border-outline pl-1 font-mono text-micro leading-[18px] text-ink-muted lg:leading-[22px]" style={{ left: pct(s) }}>
                {s >= 60 ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}` : `${s < 1 || s % 1 ? s.toFixed(1) : Math.round(s)}s`}
              </span>
            ))}
          </div>

          {/* the element lanes: tap a block to select it (the inspector opens) */}
          {rows.map(({ lane: ln, top, h }) => (
            <div key={ln.id} className="absolute inset-x-0 overflow-hidden bg-floor" style={{ top, height: h }} data-track={ln.kind === 'video' ? 'film' : ln.kind === 'audio' ? 'wave' : ln.kind} data-lane-el={ln.id}>
              {ln.kind === 'video' &&
                (stripUrl && assets
                  ? tiles.map((tl, i) => (
                      <span
                        key={i}
                        aria-hidden
                        className="absolute top-0 h-full border-r border-floor"
                        style={{
                          left: tl.x,
                          width: tl.w,
                          backgroundImage: `url(${stripUrl})`,
                          backgroundSize: `${assets.strip.frames * tileW}px 100%`,
                          backgroundPosition: `${-stripFrameAt(assets.strip, tl.t) * tileW}px 0`,
                          backgroundRepeat: 'no-repeat',
                        }}
                      />
                    ))
                  : tiles.map((tl, i) => {
                      const src = thumbs[Math.min(fallbackCount - 1, Math.floor((tl.t / dur) * fallbackCount))]
                      return (
                        <span
                          key={i}
                          aria-hidden
                          className="absolute top-0 h-full border-r border-floor bg-surface"
                          style={{ left: tl.x, width: tl.w, ...(src ? { backgroundImage: `url(${src})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}) }}
                        />
                      )
                    }))}
              {ln.kind === 'audio' && wave && wave.d && (
                <svg aria-hidden className="absolute inset-y-0 left-0 h-full text-ink-secondary" style={{ width: `${waveW}%` }} viewBox={`0 0 ${wave.n} 100`} preserveAspectRatio="none">
                  <path d={wave.d} fill="currentColor" />
                </svg>
              )}
              {ln.kind !== 'video' && ln.kind !== 'audio' && stemWaves[ln.id] && (
                <svg
                  aria-hidden
                  className="pointer-events-none absolute inset-y-0 left-0 h-full text-ink-muted"
                  style={{ width: `${Math.min(100, ((ln.peaks!.length / (ln.rate || 10)) / dur) * 100)}%` }}
                  viewBox={`0 0 ${stemWaves[ln.id]!.n} 100`}
                  preserveAspectRatio="none"
                >
                  <path d={stemWaves[ln.id]!.d} fill="currentColor" />
                </svg>
              )}
              {ln.clips.map((c, i) => {
                const on = selectedEl?.lane === ln.id && (selectedEl.clip === c.id || (selectedEl.clip === null && ln.clips.length <= 1))
                const room = (c.end - c.start) * pps
                const solid = ln.kind === 'captions' || ln.kind === 'banner' || (isAudioKind(ln.kind) && ln.kind !== 'audio')
                return (
                  <button
                    key={c.id}
                    type="button"
                    data-el={`${ln.id}|${c.id}`}
                    aria-pressed={on}
                    aria-label={`${ln.label}${ln.clips.length > 1 ? ` ${i + 1}` : ''}, ${c.start.toFixed(1)} to ${c.end.toFixed(1)} seconds${c.text ? `: ${c.text}` : ''}. Tap to change it.`}
                    className={`absolute top-0 h-full overflow-hidden whitespace-nowrap text-left text-micro font-semibold leading-none ${
                      solid ? 'rounded-sm border border-floor bg-surface-raised/80 px-1 text-ink-secondary' : 'border-l border-floor/80'
                    } ${on ? 'z-[5] ring-2 ring-inset ring-toclaude' : ''}`}
                    style={{ left: pct(c.start), width: wid(c.start, c.end, 3) }}
                  >
                    {solid && room >= 34 && (
                      <span className={`pointer-events-none relative block truncate ${isAudioKind(ln.kind) ? 'lg:hidden' : ''}`} style={{ lineHeight: `${h - 2}px` }}>
                        {ln.kind === 'captions' ? c.text : isAudioKind(ln.kind) ? (i === 0 ? ln.label : '') : c.label}
                      </span>
                    )}
                  </button>
                )
              })}
              {/* changes saved on this element: a labelled marker ("-6 dB", "1.5x", "Swap"); the unsaved one dashed */}
              {marks
                .filter((m) => m.lane === ln.id)
                .map((m) => (
                  <span
                    key={m.key}
                    className={`pointer-events-none absolute top-0 z-[6] h-full overflow-hidden rounded-sm border-2 border-toclaude bg-toclaude/25 ${m.draft ? 'border-dashed' : ''}`}
                    style={{ left: pct(m.start), width: wid(m.start, m.end, 8) }}
                    data-el-mark={m.lane}
                    title={m.tag}
                    data-draft={m.draft ? '1' : undefined}
                  >
                    {(m.end - m.start) * pps >= 30 && (
                      <span className="absolute left-0 top-0 rounded-br-sm bg-toclaude px-1 text-micro font-semibold text-floor" style={{ lineHeight: `${Math.min(16, h - 4)}px` }}>
                        {m.tag}
                      </span>
                    )}
                  </span>
                ))}
              <span className="pointer-events-none absolute left-0.5 top-0.5 z-[7] rounded-sm bg-floor/75 px-1 text-micro font-semibold leading-[14px] text-ink-secondary max-lg:hidden">{ln.label}</span>
              {ln.kind === 'audio' && <span className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-outline" />}
            </div>
          ))}

          {/* cuts veil the picture and the sound: "this goes" */}
          {cuts.map((b) => (
            <span
              key={`veil-${b.key}`}
              className="pointer-events-none absolute z-[8] border-x-2 border-toclaude"
              style={{ top: H.R + H.g, height: elBottom - H.R - H.g, left: pct(b.start), width: wid(b.start, b.end, 4), backgroundImage: CUT_VEIL }}
            />
          ))}

          {/* review notes (teal), then edits for Claude (cobalt) */}
          {(['note', 'edit'] as const).map((kind) => (
            <div key={kind} className="absolute inset-x-0" style={{ top: kind === 'note' ? yNote : yEdit, height: H.lane }} data-lane={kind}>
              <span className={`pointer-events-none absolute left-0 top-0 h-full w-1 rounded-r-sm ${kind === 'note' ? 'bg-tonote' : 'bg-toclaude'}`} />
              {lane(kind).map((b) => (
                <button
                  key={b.key}
                  type="button"
                  data-block={b.key}
                  aria-label={b.label}
                  aria-pressed={selected === b.key}
                  className={`absolute top-0 flex h-full min-w-[18px] items-center justify-center overflow-hidden whitespace-nowrap rounded-sm px-1 text-left text-micro font-semibold leading-none text-floor transition-shadow duration-fast lg:px-1.5 ${
                    kind === 'note' ? 'bg-tonote' : 'bg-toclaude'
                  } ${selected === b.key ? 'z-10 ring-2 ring-ink' : ''} ${b.dim ? 'opacity-40' : ''}`}
                  style={{ left: pct(b.start), width: wid(b.start, b.end, 18), ...(b.cut ? { backgroundImage: CUT_STRIPES } : {}) }}
                >
                  <span className="min-w-0 overflow-hidden text-ellipsis [text-shadow:0_0_2px_var(--floor)]">{(b.end - b.start) * pps >= 44 ? b.text : b.n}</span>
                </button>
              ))}
            </div>
          ))}
          {/* the auto-QC lane: amber flags, dashed when only "possible", dim once accepted (dismissed ones are gone) */}
          {qc.length > 0 && (
            <div className="absolute inset-x-0" style={{ top: yQc, height: H.qc }} data-lane="qc">
              <span className="pointer-events-none absolute left-0 top-0 h-full w-1 rounded-r-sm bg-mid" />
              {qc.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  data-block={`qc:${f.id}`}
                  data-qc={f.id}
                  aria-label={`Auto-QC at ${f.start.toFixed(1)} s: ${f.title}${f.possible ? ' (possible)' : ''}`}
                  aria-pressed={selectedQc === f.id}
                  className={`absolute top-0 flex h-full min-w-[10px] items-center overflow-hidden whitespace-nowrap rounded-sm px-1 text-micro font-semibold leading-none ${
                    f.possible ? 'border border-dashed border-mid bg-mid/35 text-ink' : 'bg-mid text-floor'
                  } ${f.accepted ? 'opacity-40' : ''} ${selectedQc === f.id ? 'z-10 ring-2 ring-ink' : ''}`}
                  style={{ left: pct(f.start), width: wid(f.start, f.end, 10) }}
                >
                  {(f.end - f.start) * pps >= 54 && <span className="min-w-0 overflow-hidden text-ellipsis">{f.title}</span>}
                </button>
              ))}
              <span className="pointer-events-none absolute right-0.5 top-0 z-[7] rounded-sm bg-floor/75 px-1 text-micro font-semibold text-ink-secondary max-lg:hidden" style={{ lineHeight: `${H.qc}px` }}>
                QC
              </span>
            </div>
          )}

          {/* the range being written: one obvious block across every track */}
          {draft && (
            <div
              className={`pointer-events-none absolute bottom-0 z-10 rounded-sm border-2 ${draft.kind === 'note' ? 'border-tonote bg-tonote/25' : 'border-toclaude bg-toclaude/25'}`}
              style={{ top: H.R, left: pct(draft.start), width: wid(draft.start, draft.end, 6) }}
              data-draft
            >
              <span className={`absolute left-0 top-0 rounded-br-sm px-1 text-micro font-semibold leading-4 text-floor ${draft.kind === 'note' ? 'bg-tonote' : 'bg-toclaude'}`}>New</span>
            </div>
          )}

          {/* In edit: greyed, hatched, labelled, with progress */}
          {locked.map((l) => (
            <div
              key={`lock-${l.n}`}
              className="pointer-events-none absolute bottom-0 z-20 overflow-hidden rounded-sm border border-ink-faint"
              style={{ top: H.R, left: pct(l.start), width: wid(l.start, l.end, 16), backgroundImage: LOCK_HATCH, backgroundColor: 'color-mix(in oklch, var(--floor) 72%, transparent)' }}
              data-locked={l.n}
            >
              <span className="absolute inset-x-1 top-1 truncate text-micro font-semibold text-ink">In edit</span>
              <span className="absolute inset-x-0 bottom-0 h-1 bg-floor">
                <span className="block h-full bg-good transition-[width] duration-slow" style={{ width: `${l.pct ?? 6}%` }} />
              </span>
            </div>
          ))}

          {/* the playhead: a bold line and a handle you can grab in the ruler */}
          <div className="pointer-events-none absolute bottom-0 top-0 z-30 w-0" style={{ left: pct(t) }} data-playhead>
            <span className="absolute -left-[1.5px] bottom-0 top-0 w-[3px] bg-ink shadow-[0_0_0_1px_var(--floor)]" />
            <span className="absolute -left-[7px] top-0 w-[14px] rounded-[3px] border-2 border-floor bg-ink" style={{ height: H.R }} />
          </div>
        </div>
      </div>
    </div>
  )
}
