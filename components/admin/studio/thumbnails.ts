'use client'
/**
 * The filmstrip, drawn in the browser from the same video (the fallback when no strip file was made).
 * One hidden <video>, one seek after another, cached per cut for the session. The play link is a
 * redirect into storage; `crossOrigin` keeps the canvas readable (the bucket's sharing rule allows GET).
 */
import { useEffect, useState } from 'react'
import { thumbTimes } from '@/lib/studio/suite'

const THUMB_CACHE = new Map<string, (string | null)[]>()

function seekTo(v: HTMLVideoElement, s: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const done = () => {
      clear()
      resolve()
    }
    const fail = () => {
      clear()
      reject(new Error('seek failed'))
    }
    const timer = setTimeout(fail, 6000)
    const clear = () => {
      clearTimeout(timer)
      v.removeEventListener('seeked', done)
      v.removeEventListener('error', fail)
    }
    v.addEventListener('seeked', done)
    v.addEventListener('error', fail)
    v.currentTime = s
  })
}

export function useThumbnails(src: string, dur: number, count: number, enabled: boolean): (string | null)[] {
  const key = `${src}|${count}|${Math.round(dur * 10)}`
  const [thumbs, setThumbs] = useState<(string | null)[]>(() => THUMB_CACHE.get(key) ?? [])
  useEffect(() => {
    if (!enabled || !(dur > 1)) return
    const hit = THUMB_CACHE.get(key)
    if (hit) {
      setThumbs(hit)
      return
    }
    let cancelled = false
    const v = document.createElement('video')
    v.muted = true
    v.preload = 'auto'
    v.playsInline = true
    v.crossOrigin = 'anonymous'
    v.src = src
    const canvas = document.createElement('canvas')
    canvas.width = 90
    canvas.height = 160
    const ctx = canvas.getContext('2d')
    const out: (string | null)[] = Array(count).fill(null)
    void (async () => {
      try {
        await new Promise<void>((resolve, reject) => {
          if (v.readyState >= 2) return resolve()
          v.addEventListener('loadeddata', () => resolve(), { once: true })
          v.addEventListener('error', () => reject(new Error('load failed')), { once: true })
        })
        const times = thumbTimes(dur, count)
        for (let i = 0; i < times.length; i++) {
          if (cancelled || !ctx) return
          await seekTo(v, times[i])
          ctx.drawImage(v, 0, 0, canvas.width, canvas.height)
          out[i] = canvas.toDataURL('image/jpeg', 0.6)
          if (i % 4 === 3 || i === times.length - 1) setThumbs([...out])
        }
        THUMB_CACHE.set(key, [...out])
      } catch {
        // Frames could not be drawn (no file, or a codec this browser cannot decode): plain tiles stay.
      }
    })()
    return () => {
      cancelled = true
      v.removeAttribute('src')
      v.load()
    }
  }, [key, src, dur, count, enabled])
  return thumbs
}
