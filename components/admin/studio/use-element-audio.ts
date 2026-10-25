'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { laneGainAt, needsStems, type GainEdit, type Lanes } from '@/lib/studio/elements'

/**
 * LIVE PREVIEW of volume changes (select-an-element editing, Harry 2026-10-20: "click on the audio track and turn down
 * the volume"). Web Audio, in the browser, nothing rendered:
 *   mix    the playing video's own sound goes through one GainNode: a change on "Audio (full mix)" is heard at once.
 *   stems  our own builds have a small file per stem (voice / music / sfx). When a change touches a stem, the video's
 *          own sound is turned to zero and the stems play in step with the picture, each through its own GainNode.
 * The gains follow the playhead every frame (a change with a range, or a fade, is heard only where it applies).
 * Nothing is routed through Web Audio until the first volume change: the video plays exactly as before until then.
 */
export type PreviewMode = 'off' | 'mix' | 'stems' | 'loading' | 'no-stems'

/**
 * ONE audio context for the page, never closed: a <video> can be given to Web Audio only once in its life, so its
 * source node and gain must outlive any re-render (React's dev double-mount included).
 */
let SHARED: AudioContext | null = null
function sharedCtx(): AudioContext | null {
  if (SHARED) return SHARED
  if (typeof window === 'undefined') return null
  const C = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!C) return null
  SHARED = new C()
  return SHARED
}
const ROUTED = new WeakMap<HTMLMediaElement, GainNode>()
// iPhone Safari only wakes audio inside a tap: any tap on the page wakes it (a saved volume change routes the video
// through Web Audio, which would otherwise stay asleep and silent until then)
if (typeof document !== 'undefined')
  document.addEventListener(
    'pointerdown',
    () => {
      if (SHARED && SHARED.state === 'suspended') void SHARED.resume().catch(() => {})
    },
    true,
  )

export function useElementAudio({
  video,
  lanes,
  edits,
  dur,
  stemUrl,
}: {
  video: HTMLVideoElement | null
  lanes: Lanes | null
  /** Saved edits plus the inspector's unsaved change (so the slider previews before Save). */
  edits: GainEdit[]
  dur: number
  stemUrl: (lane: string) => string
}): { mode: PreviewMode; gains: Record<string, number>; prime: () => void } {
  const ctxRef = useRef<AudioContext | null>(null)
  const mixGain = useRef<GainNode | null>(null)
  const stemGains = useRef(new Map<string, GainNode>())
  const buffers = useRef(new Map<string, AudioBuffer>())
  const playingSrc = useRef<AudioBufferSourceNode[]>([])
  const [stemState, setStemState] = useState<'none' | 'loading' | 'ready' | 'failed'>('none')
  const [gains, setGains] = useState<Record<string, number>>({})
  const editsRef = useRef(edits)
  editsRef.current = edits

  const active = edits.some((e) => e.element?.op === 'volume' && e.status !== 'applied' && e.status !== 'undone')
  const wantStems = needsStems(edits, lanes)
  const stemLanes = (lanes?.lanes ?? []).filter((l) => l.stem)
  const useStems = wantStems && stemState === 'ready'

  /** Make (or wake) the audio context. Called from a tap / slider move, so the browser allows sound. */
  const prime = useCallback(() => {
    const ctx = sharedCtx()
    if (!ctx) return
    ctxRef.current = ctx
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {})
  }, [])

  // route the video's own sound through the mix gain (once per <video> element; a render switch makes a new one)
  useEffect(() => {
    if (!active || !video) return
    prime()
    const ctx = ctxRef.current
    if (!ctx) return
    let g = ROUTED.get(video)
    if (!g) {
      try {
        const node = ctx.createMediaElementSource(video)
        g = ctx.createGain()
        node.connect(g)
        g.connect(ctx.destination)
        ROUTED.set(video, g)
      } catch {
        return /* the browser refused: the video keeps its own sound, unpreviewed */
      }
    }
    mixGain.current = g
  }, [active, video, prime])

  // load + decode the stems the first time a stem change needs them (once per page: the ref guards against re-runs)
  const loadStarted = useRef(false)
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])
  useEffect(() => {
    if (!wantStems || loadStarted.current || !stemLanes.length) return
    prime()
    const ctx = ctxRef.current
    if (!ctx) return
    loadStarted.current = true
    setStemState('loading')
    void Promise.all(
      stemLanes.map(async (l) => {
        const r = await fetch(stemUrl(l.id), { credentials: 'same-origin' })
        if (!r.ok) throw new Error('no stem')
        const audio = await ctx.decodeAudioData(await r.arrayBuffer())
        buffers.current.set(l.id, audio)
        const g = ctx.createGain()
        g.connect(ctx.destination)
        stemGains.current.set(l.id, g)
      }),
    ).then(
      () => alive.current && setStemState('ready'),
      () => alive.current && setStemState('failed'),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantStems, prime])

  // stems play in step with the picture: (re)start on play / seek / speed change, stop on pause
  const stopStems = () => {
    for (const s of playingSrc.current) {
      try {
        s.stop()
      } catch {
        /* never started */
      }
    }
    playingSrc.current = []
  }
  useEffect(() => {
    if (!video || !useStems) {
      stopStems()
      return
    }
    const ctx = ctxRef.current!
    const start = () => {
      stopStems()
      if (video.paused) return
      for (const [id, buf] of Array.from(buffers.current.entries())) {
        const s = ctx.createBufferSource()
        s.buffer = buf
        s.playbackRate.value = video.playbackRate || 1
        s.connect(stemGains.current.get(id)!)
        const at = Math.min(buf.duration, Math.max(0, video.currentTime))
        s.start(0, at)
        playingSrc.current.push(s)
      }
    }
    start()
    const evs = ['play', 'playing', 'seeked', 'ratechange'] as const
    evs.forEach((e) => video.addEventListener(e, start))
    video.addEventListener('pause', stopStems)
    return () => {
      evs.forEach((e) => video.removeEventListener(e, start))
      video.removeEventListener('pause', stopStems)
      stopStems()
    }
  }, [video, useStems])

  // the gains follow the playhead (every frame while playing, and on every change while paused)
  useEffect(() => {
    if (!active || !video) return
    let raf = 0
    const set = () => {
      const t = video.currentTime || 0
      const out: Record<string, number> = {}
      const mix = useStems ? 0 : laneGainAt(editsRef.current, 'audio', t, dur)
      if (mixGain.current) mixGain.current.gain.value = mix
      out.audio = mix
      for (const l of stemLanes) {
        const g = laneGainAt(editsRef.current, l.id, t, dur)
        const node = stemGains.current.get(l.id)
        if (node) node.gain.value = useStems ? g : 0
        out[l.id] = g
      }
      setGains((p) => (Object.keys(out).every((k) => Math.abs((p[k] ?? -1) - out[k]) < 1e-4) ? p : out))
    }
    const loop = () => {
      set()
      if (!video.paused) raf = requestAnimationFrame(loop)
    }
    set()
    const onPlay = () => {
      prime()
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(loop)
    }
    video.addEventListener('play', onPlay)
    video.addEventListener('seeked', set)
    if (!video.paused) raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      video.removeEventListener('play', onPlay)
      video.removeEventListener('seeked', set)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, video, useStems, dur, edits])

  // no change left: give the video its own sound back at full level
  useEffect(() => {
    if (active) return
    if (mixGain.current) mixGain.current.gain.value = 1
    stopStems()
  }, [active])

  useEffect(
    () => () => {
      stopStems()
      if (mixGain.current) mixGain.current.gain.value = 1
    },
    [],
  )

  const mode: PreviewMode = !active ? 'off' : wantStems ? (stemState === 'ready' ? 'stems' : stemState === 'failed' || !stemLanes.length ? 'no-stems' : 'loading') : 'mix'
  return { mode, gains, prime }
}
