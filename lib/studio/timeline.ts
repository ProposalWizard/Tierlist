/**
 * The editing suite's timeline: pure rules (Harry, 2026-10-19: "the actual timeline is almost invisible - if you go and
 * look at say davinci or even capcut mobile u can see a working timeline").
 *
 * Each cut can have a filmstrip sprite and a waveform made once by `scripts/marketing/studio-prep.py`, beside the video
 * in the Marketing storage: <video key>.strip.jpg + <video key>.peaks.json. Missing = drawn from the video in the browser.
 */

export type TimelineAssets = {
  duration: number
  /** One frame every `every` seconds, `frames` of them, each w x h, side by side in one row. */
  strip: { every: number; frames: number; w: number; h: number }
  /** Loudness 0..100, `rate` values a second. */
  rate: number
  peaks: number[]
}

const num = (x: unknown, lo: number, hi: number): number | null => (typeof x === 'number' && Number.isFinite(x) && x >= lo && x <= hi ? x : null)

/** The peaks JSON, checked. Anything malformed = null (the page then draws from the video). */
export function parseTimeline(raw: unknown): TimelineAssets | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const s = (r.strip ?? {}) as Record<string, unknown>
  const duration = num(r.duration, 0.1, 36_000)
  const every = num(s.every, 0.05, 3600)
  const frames = num(s.frames, 1, 2000)
  const w = num(s.w, 1, 1000)
  const h = num(s.h, 1, 1000)
  const rate = num(r.rate, 1, 1000)
  if (duration === null || every === null || frames === null || w === null || h === null || rate === null) return null
  if (!Array.isArray(r.peaks) || r.peaks.length > 200_000) return null
  const peaks = r.peaks.map((p) => (typeof p === 'number' && Number.isFinite(p) ? Math.max(0, Math.min(100, p)) : 0))
  return { duration, strip: { every, frames: Math.round(frames), w, h }, rate, peaks }
}

export const ZOOM_MIN = 1
export const ZOOM_MAX = 12
export const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z * 100) / 100))

/** Which sprite frame shows at time t. */
export function stripFrameAt(strip: { every: number; frames: number }, t: number): number {
  return Math.max(0, Math.min(strip.frames - 1, Math.floor(t / strip.every)))
}

/**
 * The filmstrip tiles across a track `width` px wide for a cut `dur` s long, each tile `tileW` px: the time each tile
 * shows (its middle). The last tile is cut short by the track's end.
 */
export function stripTiles(width: number, dur: number, tileW: number): { x: number; w: number; t: number }[] {
  if (!(width > 0) || !(dur > 0) || !(tileW > 0)) return []
  const out: { x: number; w: number; t: number }[] = []
  for (let x = 0; x < width - 0.5 && out.length < 4000; x += tileW) {
    const w = Math.min(tileW, width - x)
    out.push({ x, w, t: ((x + w / 2) / width) * dur })
  }
  return out
}

/**
 * The waveform as ONE closed SVG path in a 0..n by 0..100 box (stretched to the track with preserveAspectRatio=none),
 * mirrored round the middle. A floor of 2 keeps silence visible as a thin line.
 */
export function waveformPath(peaks: number[], maxPoints = 1600): { d: string; n: number } {
  if (!peaks.length) return { d: '', n: 1 }
  const step = Math.max(1, Math.ceil(peaks.length / maxPoints))
  const v: number[] = []
  for (let i = 0; i < peaks.length; i += step) {
    let m = 0
    for (let j = i; j < Math.min(peaks.length, i + step); j++) m = Math.max(m, peaks[j])
    v.push(Math.max(2, m) / 2)
  }
  const n = v.length
  const top = v.map((h, i) => `${i === 0 ? 'M' : 'L'}${i} ${(50 - h).toFixed(1)}`).join('')
  const bot = v
    .map((h, i) => [i, h] as const)
    .reverse()
    .map(([i, h]) => `L${i + 1} ${(50 + h).toFixed(1)}`)
    .join('')
  return { d: `${top}L${n} ${(50 - v[n - 1]).toFixed(1)}${bot}L0 ${(50 + v[0]).toFixed(1)}Z`, n }
}

/** While playing zoomed in: the scroll that keeps the playhead in view (null = leave it). */
export function followScroll(px: number, scrollLeft: number, viewW: number): number | null {
  if (px < scrollLeft + 16 || px > scrollLeft + viewW - 48) return Math.max(0, px - viewW * 0.25)
  return null
}

/** Peaks drawn from decoded audio in the browser (the fallback when the peaks file is missing). */
export function peaksFromSamples(samples: ArrayLike<number>, sampleRate: number, rate = 20): number[] {
  const step = Math.max(1, Math.floor(sampleRate / rate))
  const b: number[] = []
  for (let i = 0; i < samples.length; i += step) {
    let m = 0
    const end = Math.min(samples.length, i + step)
    for (let j = i; j < end; j++) {
      const a = Math.abs(samples[j])
      if (a > m) m = a
    }
    b.push(m)
  }
  const sorted = [...b].sort((x, y) => x - y)
  const top = sorted[Math.max(0, Math.floor(sorted.length * 0.99) - 1)] || 1
  return b.map((x) => Math.min(100, Math.round((100 * x) / top)))
}
