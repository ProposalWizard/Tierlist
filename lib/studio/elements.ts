/**
 * SELECT-AN-ELEMENT editing (ported 22 Oct 2026; Harry, 20 Oct: "I could directly choose what element I am interested
 * i.e click on the audio track and turn down the volume etc."). CapCut / DaVinci style: every lane on the timeline is
 * tappable (the video's shots, the sound or its stems, captions, an on-screen banner); a tap selects it and the
 * INSPECTOR shows only the controls Claude can really render for that kind of element. Each change is saved as an
 * ordinary edit for Claude with a structured `element` block, so a reader that only knows `text` still sees a plain
 * sentence, and Claude gets the exact numbers.
 *
 * The lanes come from `<video key>.lanes.json` beside the video (scripts/marketing/studio-prep.py):
 *   build  = a video we built from parts: Video (shots), Voices, Music, SFX (each with its own small stem file),
 *            Captions (one clip per caption card), Banner (when a banner shows)
 *   flat   = any other cut: Video (shots by scene detection) and one "Audio (full mix)" lane
 */

export const LANE_KINDS = ['video', 'audio', 'voice', 'music', 'sfx', 'captions', 'banner'] as const
export type LaneKind = (typeof LANE_KINDS)[number]
export const AUDIO_KINDS: readonly LaneKind[] = ['audio', 'voice', 'music', 'sfx']
export const isAudioKind = (k: LaneKind) => AUDIO_KINDS.includes(k)

export type LaneClip = { id: string; start: number; end: number; label?: string; text?: string }
export type Lane = { id: string; kind: LaneKind; label: string; clips: LaneClip[]; stem?: string; rate?: number; peaks?: number[] }
export type Lanes = { v: 1; kind: 'build' | 'flat'; duration: number; source: string; note?: string; lanes: Lane[] }

const LANE_ID_REGEX = /^[a-z][a-z0-9-]{0,23}$/
const CLIP_ID_REGEX = /^[a-z0-9-]{1,16}$/
/** A stem file name: `<video key>.<lane>.mp4`, beside the video. */
export const STEM_FILE_REGEX = /^(?:media\/)?[a-z0-9][a-z0-9-]{0,119}\.(voice|music|sfx)\.mp4$/

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const num = (v: unknown, lo: number, hi: number): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi ? v : null)
const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : '')

/** The lanes JSON, checked. Anything malformed = null (the page then shows plain Video / Audio lanes). */
export function parseLanes(raw: unknown): Lanes | null {
  if (!isObj(raw) || !Array.isArray(raw.lanes)) return null
  const duration = num(raw.duration, 0.1, 36_000)
  if (duration === null) return null
  const lanes: Lane[] = []
  for (const l of raw.lanes.slice(0, 12)) {
    if (!isObj(l) || typeof l.id !== 'string' || !LANE_ID_REGEX.test(l.id) || !(LANE_KINDS as readonly unknown[]).includes(l.kind) || !Array.isArray(l.clips)) continue
    const clips: LaneClip[] = []
    for (const c of l.clips.slice(0, 600)) {
      if (!isObj(c) || typeof c.id !== 'string' || !CLIP_ID_REGEX.test(c.id)) continue
      const start = num(c.start, 0, 36_000)
      const end = num(c.end, 0, 36_000)
      if (start === null || end === null || end <= start) continue
      const label = str(c.label, 60)
      const text = str(c.text, 300)
      clips.push({ id: c.id, start, end, ...(label ? { label } : {}), ...(text ? { text } : {}) })
    }
    const lane: Lane = { id: l.id, kind: l.kind as LaneKind, label: str(l.label, 30) || l.id, clips }
    if (typeof l.stem === 'string' && STEM_FILE_REGEX.test(l.stem)) lane.stem = l.stem
    const rate = num(l.rate, 1, 100)
    if (rate !== null && Array.isArray(l.peaks) && l.peaks.length <= 100_000) {
      lane.rate = rate
      lane.peaks = l.peaks.map((p) => (typeof p === 'number' && Number.isFinite(p) ? Math.max(0, Math.min(100, p)) : 0))
    }
    lanes.push(lane)
  }
  if (!lanes.length) return null
  return { v: 1, kind: raw.kind === 'build' ? 'build' : 'flat', duration, source: str(raw.source, 200), ...(str(raw.note, 300) ? { note: str(raw.note, 300) } : {}), lanes }
}

/** No lanes file yet: one Video lane (the whole cut) and one full-mix Audio lane, so the inspector still works. */
export function defaultLanes(duration: number): Lanes {
  const d = Math.max(0.1, duration)
  return {
    v: 1,
    kind: 'flat',
    duration: d,
    source: 'none yet',
    lanes: [
      { id: 'video', kind: 'video', label: 'Video', clips: [{ id: 's1', start: 0, end: d, label: 'Whole cut' }] },
      { id: 'audio', kind: 'audio', label: 'Audio (full mix)', clips: [{ id: 'mix', start: 0, end: d, label: 'Full mix' }] },
    ],
  }
}

// ── the structured edit ─────────────────────────────────────────────────────────────────────────────────────────────

export const ELEMENT_OPS = ['volume', 'trim', 'delete', 'speed', 'zoom', 'swap', 'text', 'hide', 'style', 'banner', 'move', 'note'] as const
export type ElementOp = (typeof ELEMENT_OPS)[number]
/** Which ops each kind of element offers (only ones Claude can really render). */
export const OPS_FOR: Record<LaneKind, readonly ElementOp[]> = {
  audio: ['volume', 'note'],
  voice: ['volume', 'note'],
  music: ['volume', 'note'],
  sfx: ['volume', 'note'],
  video: ['trim', 'delete', 'speed', 'zoom', 'swap', 'note'],
  captions: ['text', 'hide', 'style', 'note'],
  banner: ['banner', 'move', 'text', 'note'],
}
export const DB_MIN = -60
export const DB_MAX = 6
export const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const
export const ZOOMS = [1, 1.1, 1.25, 1.5, 2] as const
export const FADES = [0, 0.5, 1, 2] as const
export const POSITIONS = ['top', 'middle', 'bottom'] as const
export type Position = (typeof POSITIONS)[number]

/**
 * The element block on an edit. The edit's own start / end are the range ("from" / "to"); a whole-video change is a
 * `general` edit (no range). Delete-a-shot is a `cut` edit (Claude renders it mechanically).
 *   {target: "music", lane: "music", op: "volume", db: -6, fade_in: 0.5}
 *   {target: "video", lane: "video", clip: "s3", op: "speed", speed: 1.5}
 */
export type EditElement = {
  target: LaneKind
  lane: string
  op: ElementOp
  clip?: string
  /** Shown on the card and the lane marker: "Shot 3", "Caption 4", "Music". */
  label?: string
  /** volume: gain in dB (DB_MIN..DB_MAX); mute = true means silent (minus infinity). */
  db?: number
  mute?: boolean
  fade_in?: number
  fade_out?: number
  /** trim: the shot's new in / out, seconds in the ORIGINAL cut. */
  trim_in?: number
  trim_out?: number
  speed?: number
  zoom?: number
  /** swap: what to put in instead (free text). */
  with?: string
  /** text: the new caption / banner text. */
  text?: string
  /** hide (captions): true = take it off. banner: on = true / false. */
  hidden?: boolean
  on?: boolean
  /** style (captions): a free-text note. move (banner): where it goes. */
  style?: string
  position?: Position
}

export function parseElement(raw: unknown): EditElement | undefined {
  if (!isObj(raw)) return undefined
  const target = raw.target
  const op = raw.op
  if (!(LANE_KINDS as readonly unknown[]).includes(target) || !(ELEMENT_OPS as readonly unknown[]).includes(op)) return undefined
  const lane = typeof raw.lane === 'string' && LANE_ID_REGEX.test(raw.lane) ? raw.lane : (target as string)
  const el: EditElement = { target: target as LaneKind, lane, op: op as ElementOp }
  if (typeof raw.clip === 'string' && CLIP_ID_REGEX.test(raw.clip)) el.clip = raw.clip
  const label = str(raw.label, 60)
  if (label) el.label = label
  const db = num(raw.db, DB_MIN, DB_MAX)
  if (db !== null) el.db = Math.round(db * 10) / 10
  if (raw.mute === true) el.mute = true
  for (const k of ['fade_in', 'fade_out'] as const) {
    const f = num(raw[k], 0, 30)
    if (f !== null && f > 0) el[k] = Math.round(f * 100) / 100
  }
  for (const k of ['trim_in', 'trim_out'] as const) {
    const f = num(raw[k], 0, 36_000)
    if (f !== null) el[k] = Math.round(f * 100) / 100
  }
  const speed = num(raw.speed, 0.1, 8)
  if (speed !== null) el.speed = Math.round(speed * 100) / 100
  const zoom = num(raw.zoom, 1, 4)
  if (zoom !== null) el.zoom = Math.round(zoom * 100) / 100
  const w = str(raw.with, 400)
  if (w) el.with = w
  const text = str(raw.text, 400)
  if (text) el.text = text
  if (typeof raw.hidden === 'boolean') el.hidden = raw.hidden
  if (typeof raw.on === 'boolean') el.on = raw.on
  const style = str(raw.style, 400)
  if (style) el.style = style
  if ((POSITIONS as readonly unknown[]).includes(raw.position)) el.position = raw.position as Position
  return el
}

const fmtT = (t: number) => {
  const s = Math.max(0, t)
  const m = Math.floor(s / 60)
  return `${m}:${(s - m * 60).toFixed(1).padStart(4, '0')}`
}
export const fmtDb = (db: number | undefined, mute?: boolean) => (mute ? 'muted' : `${db !== undefined && db > 0 ? '+' : ''}${db ?? 0} dB`)

/** The short change, for the lane marker: "-6 dB", "1.5x", "Trim", "Swap". */
export function elementTag(el: EditElement): string {
  switch (el.op) {
    case 'volume':
      return [el.mute ? 'Mute' : el.db ? fmtDb(el.db) : '', el.fade_in ? `Fade in ${el.fade_in}s` : '', el.fade_out ? `Fade out ${el.fade_out}s` : ''].filter(Boolean).join(' · ') || '0 dB'
    case 'trim':
      return 'Trim'
    case 'delete':
      return 'Delete'
    case 'speed':
      return `${el.speed ?? 1}x`
    case 'zoom':
      return `Zoom ${el.zoom ?? 1}x`
    case 'swap':
      return 'Swap'
    case 'text':
      return 'New text'
    case 'hide':
      return el.hidden === false ? 'Show' : 'Hidden'
    case 'style':
      return 'Style'
    case 'banner':
      return el.on === false ? 'Banner off' : 'Banner on'
    case 'move':
      return `Move ${el.position ?? ''}`.trim()
    case 'note':
      return 'Note'
  }
}

/**
 * The plain sentence saved in the edit's `text` (what the old readers and the cards show), e.g.
 * "Music: -6 dB, fade in 0.5 s (0:03.0 to 0:08.0)". `note` is anything Harry typed in the note box.
 */
export function elementSummary(el: EditElement, range: { start: number; end: number } | null, note = ''): string {
  const who = el.label || el.lane
  const where = range ? ` (${fmtT(range.start)} to ${fmtT(range.end)})` : ' (whole video)'
  let what = ''
  switch (el.op) {
    case 'volume':
      what = [el.mute ? 'mute' : fmtDb(el.db), el.fade_in ? `fade in ${el.fade_in} s` : '', el.fade_out ? `fade out ${el.fade_out} s` : ''].filter(Boolean).join(', ')
      break
    case 'trim':
      what = `trim to ${fmtT(el.trim_in ?? range?.start ?? 0)} to ${fmtT(el.trim_out ?? range?.end ?? 0)}`
      break
    case 'delete':
      what = 'delete this shot'
      break
    case 'speed':
      what = `play at ${el.speed ?? 1}x speed`
      break
    case 'zoom':
      what = `punch in to ${el.zoom ?? 1}x`
      break
    case 'swap':
      what = `swap for: ${el.with ?? ''}`
      break
    case 'text':
      what = `change the text to "${el.text ?? ''}"`
      break
    case 'hide':
      what = el.hidden === false ? 'show it' : 'hide it'
      break
    case 'style':
      what = `style: ${el.style ?? ''}`
      break
    case 'banner':
      what = el.on === false ? 'banner off' : 'banner on'
      break
    case 'move':
      what = `move it to the ${el.position ?? 'bottom'}`
      break
    case 'note':
      what = note || 'see note'
      break
  }
  const tail = note && el.op !== 'note' ? `. ${note}` : ''
  return `${who}: ${what}${where}${tail}`.slice(0, 2000)
}

// ── live preview: the gain each lane plays at ─────────────────────────────────────────────────────────────────────────

export const dbToGain = (db: number) => Math.pow(10, db / 20)

/** An edit as far as the preview cares: open (not applied / undone) volume changes. */
export type GainEdit = { type: 'cut' | 'at' | 'general'; start?: number; end?: number; status?: string; element?: EditElement }

/**
 * The gain one lane plays at, time t: every open volume change on that lane (or on the whole mix, "audio") whose range
 * holds t, multiplied. A fade in ramps up from silence over its first `fade_in` s, a fade out down to silence over its
 * last `fade_out` s. `dur` is the cut's length (a whole-video change spans 0..dur).
 */
export function laneGainAt(edits: GainEdit[], laneId: string, t: number, dur: number): number {
  let g = 1
  for (const e of edits) {
    const el = e.element
    if (!el || el.op !== 'volume' || e.status === 'applied' || e.status === 'undone') continue
    if (el.lane !== laneId) continue
    const a = e.type === 'general' || e.start === undefined ? 0 : e.start
    const b = e.type === 'general' || e.end === undefined ? dur : e.end
    if (t < a - 1e-6 || t > b + 1e-6) continue
    let k = el.mute ? 0 : dbToGain(el.db ?? 0)
    if (el.fade_in && el.fade_in > 0) k *= Math.max(0, Math.min(1, (t - a) / el.fade_in))
    if (el.fade_out && el.fade_out > 0) k *= Math.max(0, Math.min(1, (b - t) / el.fade_out))
    g *= k
  }
  return g
}

/** Does any open edit change the volume of a stem lane (so the page must play the stems, not the video's own mix)? */
export function needsStems(edits: GainEdit[], lanes: Lanes | null): boolean {
  if (!lanes) return false
  const stems = new Set(lanes.lanes.filter((l) => l.stem).map((l) => l.id))
  return edits.some((e) => e.element?.op === 'volume' && stems.has(e.element.lane) && e.status !== 'applied' && e.status !== 'undone')
}

/** The clip under time t on a lane (the one a tap there selects). */
export function clipAt(lane: Lane, t: number): LaneClip | null {
  return lane.clips.find((c) => t >= c.start - 1e-6 && t < c.end) ?? (lane.clips.length && t >= lane.clips[lane.clips.length - 1].end - 1e-6 ? lane.clips[lane.clips.length - 1] : null)
}

/** The element's name in the inspector: "Shot 3", "Caption 4", "Music". */
export function elementName(lane: Lane, clip: LaneClip | null): string {
  if (!clip || lane.clips.length <= 1) return lane.label
  const i = lane.clips.indexOf(clip) + 1
  if (lane.kind === 'video') return `Shot ${i}`
  if (lane.kind === 'captions') return clip.label === 'Header' ? 'Header' : `Caption ${i}`
  if (lane.kind === 'voice') return `${lane.label} ${i}`
  if (lane.kind === 'sfx') return `SFX ${i}`
  if (lane.kind === 'banner') return `Banner ${i}`
  return `${lane.label} ${i}`
}
