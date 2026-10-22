'use client'

import { useEffect, useMemo, useState } from 'react'
import { Film, Music2, Scissors, Subtitles, Tag, Trash2, Volume2, VolumeX, X } from './icons'
import { tc } from '@/lib/studio/schema'
import {
  DB_MAX,
  DB_MIN,
  FADES,
  POSITIONS,
  SPEEDS,
  ZOOMS,
  elementName,
  elementSummary,
  fmtDb,
  isAudioKind,
  type EditElement,
  type Lane,
  type LaneClip,
  type Position,
} from '@/lib/studio/elements'
import type { PreviewMode } from './use-element-audio'
import { WithMic } from './mic-button'

/**
 * The INSPECTOR for a selected element (Harry, 2026-10-20: "I could directly choose what element I am interested i.e
 * click on the audio track and turn down the volume etc."). Only controls Claude can really render:
 *   sound (full mix / voices / music / SFX): volume in dB (-inf to +6) with mute, fade in / out, whole video or a range
 *   a shot: trim in / out (to the playhead), delete, speed, punch-in zoom, swap (free text)
 *   a caption: new text, hide, a style note
 *   the banner: on / off, move, new text
 *   and a note box (with the mic) for anything else.
 * Save makes one edit for Claude per change, each with its `element` block (lib/studio/elements.ts).
 * Phone: it sits under the sticky player like the composer (the video stays at 38% or more). Desktop: the side panel.
 */
export type NewChange = { type: 'at' | 'general' | 'cut'; start?: number; end?: number; element: EditElement; text: string }

const ICON = { video: Film, audio: Volume2, voice: Volume2, music: Music2, sfx: Volume2, captions: Subtitles, banner: Tag } as const
const r2 = (s: number) => Math.round(s * 100) / 100

export function ElementInspector({
  lane,
  clip,
  t,
  dur,
  previewMode,
  previewGain,
  saving,
  onDraft,
  onSave,
  onDeleteShot,
  onClose,
  onPrime,
}: {
  lane: Lane
  clip: LaneClip | null
  t: number
  dur: number
  previewMode: PreviewMode
  /** The gain the selected sound lane is playing at, at the playhead (live preview). */
  previewGain: number | null
  saving: boolean
  /** The unsaved volume change, so the page can preview it before Save (null = none). */
  onDraft: (c: NewChange | null) => void
  onSave: (changes: NewChange[]) => void
  onDeleteShot: (c: NewChange) => void
  onClose: () => void
  /** Wake the audio (called inside the tap, so the browser allows sound). */
  onPrime: () => void
}) {
  const name = elementName(lane, clip)
  const multi = lane.clips.length > 1
  const clipRange = clip && multi ? { start: clip.start, end: clip.end } : null
  const audio = isAudioKind(lane.kind)
  const Icon = ICON[lane.kind]
  const now = r2(Math.min(dur, t))

  // ── the range (sound): whole video, or a range (the clip's own by default) ──
  const [whole, setWhole] = useState(!clipRange)
  const [from, setFrom] = useState(clipRange?.start ?? now)
  const [to, setTo] = useState(clipRange?.end ?? r2(Math.min(dur, now + 3)))
  // ── sound ──
  const [db, setDb] = useState(0)
  const [mute, setMute] = useState(false)
  const [fadeIn, setFadeIn] = useState(0)
  const [fadeOut, setFadeOut] = useState(0)
  // ── a shot ──
  const [trimIn, setTrimIn] = useState<number | null>(null)
  const [trimOut, setTrimOut] = useState<number | null>(null)
  const [speed, setSpeed] = useState(1)
  const [zoom, setZoom] = useState(1)
  const [swap, setSwap] = useState('')
  // ── captions / banner ──
  const [text, setText] = useState('')
  const [hidden, setHidden] = useState(false)
  const [style, setStyle] = useState('')
  const [bannerOff, setBannerOff] = useState(false)
  const [position, setPosition] = useState<Position | null>(null)
  const [note, setNote] = useState('')

  // a new element: start clean
  const key = `${lane.id}:${clip?.id ?? ''}`
  useEffect(() => {
    setWhole(!(clip && multi))
    setFrom(clip && multi ? clip.start : now)
    setTo(clip && multi ? clip.end : r2(Math.min(dur, now + 3)))
    setDb(0), setMute(false), setFadeIn(0), setFadeOut(0)
    setTrimIn(null), setTrimOut(null), setSpeed(1), setZoom(1), setSwap('')
    setText(''), setHidden(false), setStyle(''), setBannerOff(false), setPosition(null), setNote('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const base = { target: lane.kind, lane: lane.id, ...(clip && multi ? { clip: clip.id } : {}), label: name }
  const span = clip ? { start: clip.start, end: clip.end } : { start: 0, end: dur }
  const range = audio ? (whole ? null : { start: Math.min(from, to), end: Math.max(from, to, Math.min(from, to) + 0.1) }) : clip && multi ? span : null
  const mk = (el: EditElement, n = ''): NewChange =>
    range ? { type: 'at', start: range.start, end: range.end, element: el, text: elementSummary(el, range, n) } : { type: 'general', element: el, text: elementSummary(el, null, n) }

  const volumeChange: NewChange | null = audio && (mute || db !== 0 || fadeIn > 0 || fadeOut > 0) ? mk({ ...base, op: 'volume', ...(mute ? { mute: true } : { db }), ...(fadeIn ? { fade_in: fadeIn } : {}), ...(fadeOut ? { fade_out: fadeOut } : {}) }) : null
  const draftKey = volumeChange ? JSON.stringify(volumeChange) : ''
  useEffect(() => {
    onDraft(volumeChange)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey])
  useEffect(() => () => onDraft(null), [onDraft])

  const changes = useMemo(() => {
    const out: NewChange[] = []
    if (volumeChange) out.push(volumeChange)
    if (lane.kind === 'video') {
      if (trimIn !== null || trimOut !== null) out.push(mk({ ...base, op: 'trim', trim_in: trimIn ?? span.start, trim_out: trimOut ?? span.end }))
      if (speed !== 1) out.push(mk({ ...base, op: 'speed', speed }))
      if (zoom !== 1) out.push(mk({ ...base, op: 'zoom', zoom }))
      if (swap.trim()) out.push(mk({ ...base, op: 'swap', with: swap.trim() }))
    }
    if (lane.kind === 'captions') {
      if (text.trim() && text.trim() !== (clip?.text ?? '')) out.push(mk({ ...base, op: 'text', text: text.trim() }))
      if (hidden) out.push(mk({ ...base, op: 'hide', hidden: true }))
      if (style.trim()) out.push(mk({ ...base, op: 'style', style: style.trim() }))
    }
    if (lane.kind === 'banner') {
      if (bannerOff) out.push(mk({ ...base, op: 'banner', on: false }))
      if (position) out.push(mk({ ...base, op: 'move', position }))
      if (text.trim()) out.push(mk({ ...base, op: 'text', text: text.trim() }))
    }
    if (note.trim()) {
      if (out.length) out[out.length - 1] = { ...out[out.length - 1], text: elementSummary(out[out.length - 1].element, range, note.trim()) }
      else out.push(mk({ ...base, op: 'note' }, note.trim()))
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey, trimIn, trimOut, speed, zoom, swap, text, hidden, style, bannerOff, position, note, lane.id, clip?.id, whole, from, to])

  const previewLine = !audio
    ? 'Shown as a marker on the lane. Claude makes it on render.'
    : previewMode === 'mix' || previewMode === 'stems'
      ? `Playing it now${previewGain !== null ? ` · ${previewGain === 0 ? 'silent' : `${(20 * Math.log10(previewGain)).toFixed(1)} dB`} at the playhead` : ''}. Press play to hear it.`
      : previewMode === 'loading'
        ? 'Loading this sound on its own…'
        : previewMode === 'no-stems'
          ? 'This browser cannot play the sounds apart: you hear it on render.'
          : 'Move the slider and press play: you hear it at once.'

  return (
    <div
      className="mt-3 rounded-lg border-2 border-toclaude bg-surface p-3 max-lg:[&_button]:scroll-mb-[76px] max-lg:[&_button]:scroll-mt-[calc(38dvh+230px)] max-lg:[&_textarea]:scroll-mb-[76px]"
      data-inspector={lane.id}
      data-preview-mode={previewMode}
      data-preview-gain={previewGain === null ? '' : previewGain.toFixed(4)}
      aria-label={`Inspector: ${name}`}
    >
      <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-outline lg:hidden" aria-hidden />
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5 shrink-0 text-toclaude" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="truncate text-label font-semibold text-ink" data-inspector-name>
            {name}
          </p>
          <p className="truncate text-micro text-ink-muted">
            {lane.label}
            {clip && multi ? ` · ${tc(clip.start)} to ${tc(clip.end)}` : ' · the whole cut'}
            {clip?.text && lane.kind === 'captions' ? ` · "${clip.text}"` : ''}
          </p>
        </div>
        <button type="button" onClick={onClose} className="inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-muted hover:text-ink" aria-label="Close the inspector">
          <X className="h-4 w-4" />
        </button>
      </div>

      {audio && (
        <div className="mt-3 space-y-3" data-insp-audio>
          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="insp-db" className="text-caption font-semibold text-ink">
                Volume
              </label>
              <span className="font-mono text-label tabular-nums text-ink" data-insp-db>
                {mute || db <= DB_MIN ? '-∞ dB' : fmtDb(db)}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <button
                type="button"
                aria-pressed={mute}
                onClick={() => {
                  onPrime()
                  setMute(!mute)
                }}
                className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${mute ? 'bg-bad text-floor' : 'bg-surface-raised text-ink'}`}
                aria-label={mute ? 'Unmute' : 'Mute'}
                data-insp-mute
              >
                {mute ? <VolumeX className="h-5 w-5" aria-hidden /> : <Volume2 className="h-5 w-5" aria-hidden />}
              </button>
              <input
                id="insp-db"
                type="range"
                min={DB_MIN}
                max={DB_MAX}
                step={1}
                value={mute ? DB_MIN : db}
                onPointerDown={onPrime}
                onChange={(e) => {
                  onPrime()
                  const v = Number(e.target.value)
                  setMute(v <= DB_MIN)
                  setDb(v <= DB_MIN ? 0 : v)
                }}
                className="h-10 flex-1 accent-toclaude"
                aria-valuetext={mute ? 'muted' : fmtDb(db)}
                data-insp-slider
              />
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              {[-12, -6, -3, 0, 3].map((v) => (
                <Chip
                  key={v}
                  on={!mute && db === v}
                  onClick={() => {
                    onPrime()
                    setMute(false)
                    setDb(v)
                  }}
                >
                  {v > 0 ? `+${v}` : v} dB
                </Chip>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ['Fade in', fadeIn, setFadeIn],
                ['Fade out', fadeOut, setFadeOut],
              ] as const
            ).map(([label, val, set]) => (
              <div key={label}>
                <p className="text-micro text-ink-muted">{label}</p>
                <div className="mt-1 flex flex-wrap gap-1" role="radiogroup" aria-label={label}>
                  {FADES.map((f) => (
                    <Chip
                      key={f}
                      on={val === f}
                      onClick={() => {
                        onPrime()
                        set(f)
                      }}
                    >
                      {f ? `${f}s` : 'None'}
                    </Chip>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div>
            <div className="flex gap-1" role="radiogroup" aria-label="Where">
              <Chip on={whole} onClick={() => setWhole(true)}>
                Whole video
              </Chip>
              <Chip
                on={!whole}
                onClick={() => {
                  setWhole(false)
                }}
              >
                This range
              </Chip>
            </div>
            {!whole && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                {(
                  [
                    ['From', from, setFrom],
                    ['To', to, setTo],
                  ] as const
                ).map(([label, val, set]) => (
                  <div key={label} className="flex items-center justify-between rounded-md bg-surface-raised px-3 py-1.5">
                    <span>
                      <span className="block text-micro text-ink-muted">{label}</span>
                      <span className="font-mono text-label tabular-nums text-ink">{tc(val)}</span>
                    </span>
                    <button type="button" onClick={() => set(now)} className="h-9 rounded-md bg-surface px-2 text-caption font-semibold text-ink">
                      Set to {tc(now)}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {lane.kind === 'video' && (
        <div className="mt-3 space-y-3" data-insp-video>
          <div>
            <p className="text-caption font-semibold text-ink">Trim</p>
            <div className="mt-1 grid grid-cols-2 gap-2">
              {(
                [
                  ['In', trimIn ?? span.start, () => setTrimIn(Math.max(span.start, Math.min(now, trimOut ?? span.end)))],
                  ['Out', trimOut ?? span.end, () => setTrimOut(Math.min(span.end, Math.max(now, trimIn ?? span.start)))],
                ] as const
              ).map(([label, val, set]) => (
                <div key={label} className="flex items-center justify-between rounded-md bg-surface-raised px-3 py-1.5">
                  <span>
                    <span className="block text-micro text-ink-muted">{label}</span>
                    <span className="font-mono text-label tabular-nums text-ink">{tc(val)}</span>
                  </span>
                  <button type="button" onClick={set} className="h-9 rounded-md bg-surface px-2 text-caption font-semibold text-ink" data-insp-trim={label.toLowerCase()}>
                    To {tc(now)}
                  </button>
                </div>
              ))}
            </div>
          </div>
          <Row label="Speed">
            {SPEEDS.map((s) => (
              <Chip key={s} on={speed === s} onClick={() => setSpeed(s)}>
                {s}x
              </Chip>
            ))}
          </Row>
          <Row label="Punch in">
            {ZOOMS.map((z) => (
              <Chip key={z} on={zoom === z} onClick={() => setZoom(z)}>
                {z === 1 ? 'None' : `${z}x`}
              </Chip>
            ))}
          </Row>
          <div>
            <label htmlFor="insp-swap" className="text-caption font-semibold text-ink">
              Swap the shot with
            </label>
            <input
              id="insp-swap"
              value={swap}
              onChange={(e) => setSwap(e.target.value)}
              placeholder="e.g. the box on the kitchen table"
              className="mt-1 block h-11 w-full rounded-md border border-outline bg-floor px-3 text-body text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
            />
          </div>
          {clip && multi && (
            <button
              type="button"
              onClick={() => onDeleteShot({ type: 'cut', start: clip.start, end: clip.end, element: { ...base, op: 'delete' }, text: elementSummary({ ...base, op: 'delete' }, span) })}
              className="inline-flex h-10 items-center gap-1.5 rounded-md bg-surface-raised px-3 text-caption font-semibold text-ink-secondary hover:text-bad"
              data-insp-delete
            >
              <Trash2 className="h-4 w-4" aria-hidden /> <Scissors className="h-4 w-4" aria-hidden /> Delete this shot
            </button>
          )}
        </div>
      )}

      {(lane.kind === 'captions' || lane.kind === 'banner') && (
        <div className="mt-3 space-y-3" data-insp-text>
          {lane.kind === 'banner' && (
            <>
              <Row label="Banner">
                <Chip on={!bannerOff} onClick={() => setBannerOff(false)}>
                  On
                </Chip>
                <Chip on={bannerOff} onClick={() => setBannerOff(true)}>
                  Off
                </Chip>
              </Row>
              <Row label="Move to">
                {POSITIONS.map((p) => (
                  <Chip key={p} on={position === p} onClick={() => setPosition(position === p ? null : p)}>
                    {p[0].toUpperCase() + p.slice(1)}
                  </Chip>
                ))}
              </Row>
            </>
          )}
          <div>
            <label htmlFor="insp-text" className="text-caption font-semibold text-ink">
              {lane.kind === 'captions' ? 'Caption text' : 'Banner text'}
            </label>
            <input
              id="insp-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={clip?.text || (lane.kind === 'banner' ? 'New banner words' : 'New caption words')}
              className="mt-1 block h-11 w-full rounded-md border border-outline bg-floor px-3 text-body text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
            />
          </div>
          {lane.kind === 'captions' && (
            <>
              <Row label="Show">
                <Chip on={!hidden} onClick={() => setHidden(false)}>
                  Shown
                </Chip>
                <Chip on={hidden} onClick={() => setHidden(true)}>
                  Hide it
                </Chip>
              </Row>
              <div>
                <label htmlFor="insp-style" className="text-caption font-semibold text-ink">
                  Style note
                </label>
                <input
                  id="insp-style"
                  value={style}
                  onChange={(e) => setStyle(e.target.value)}
                  placeholder="e.g. smaller, keyword in yellow"
                  className="mt-1 block h-11 w-full rounded-md border border-outline bg-floor px-3 text-body text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
                />
              </div>
            </>
          )}
        </div>
      )}

      <WithMic value={note} onChange={setNote} className="mt-3">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Anything else about this? (optional)"
          aria-label="Note for Claude about this element"
          className="block min-h-[64px] w-full resize-y rounded-md border border-outline bg-floor py-2 pl-3 pr-14 text-body text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none"
          data-insp-note
        />
      </WithMic>
      <p className="mt-2 text-micro text-ink-muted" data-insp-preview>
        {previewLine}
      </p>
      <div className="sticky bottom-0 z-10 -mx-3 -mb-3 mt-1 rounded-b-lg bg-surface px-3 pt-1 pb-[max(12px,env(safe-area-inset-bottom))]">
        <button
          type="button"
          disabled={!changes.length || saving}
          onClick={() => onSave(changes)}
          data-insp-save
          className="flex h-11 w-full items-center justify-center rounded-md bg-toclaude text-label font-semibold text-floor disabled:opacity-40"
        >
          {changes.length ? `Save for Claude${changes.length > 1 ? ` (${changes.length} changes)` : ''}` : 'Change something to save'}
        </button>
      </div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-caption font-semibold text-ink">{label}</p>
      <div className="mt-1 flex flex-wrap gap-1" role="radiogroup" aria-label={label}>
        {children}
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
