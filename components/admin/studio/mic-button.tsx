'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Mic, Square } from './icons'
import { DICTATION_LANG, DICTATION_MSG, dictationError, joinDictation, spokenText, type SpokenPart } from '@/lib/studio/dictation'

/**
 * The one-tap microphone on every text box in the suite (Harry, 2026-10-19: "Need a microphone function on all of it").
 * Tap to start, tap to stop. The words appear in the box as he talks, after what was already there, and he can edit
 * them after. Where the browser has no speech recognition, or the mic is blocked, the line under the box says so in
 * plain words (use the keyboard's mic).
 */

type Rec = {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null
  onerror: ((e: { error?: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

/** Only one box listens at a time: starting another stops this one. */
let stopActive: (() => void) | null = null

export function useDictation(value: string, onChange: (v: string) => void) {
  const [listening, setListening] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const rec = useRef<Rec | null>(null)
  const before = useRef('')
  const change = useRef(onChange)
  change.current = onChange

  function stop() {
    rec.current?.stop()
  }
  function start() {
    const W = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec }
    const SR = W.SpeechRecognition || W.webkitSpeechRecognition
    if (!SR) {
      setMsg(DICTATION_MSG.unsupported)
      return
    }
    stopActive?.()
    const r = new SR()
    r.lang = DICTATION_LANG
    r.interimResults = true
    r.continuous = true
    before.current = value
    r.onresult = (e) => {
      const parts: SpokenPart[] = []
      for (let i = 0; i < e.results.length; i++) parts.push({ text: e.results[i][0].transcript, final: e.results[i].isFinal })
      change.current(joinDictation(before.current, spokenText(parts)))
    }
    r.onerror = (e) => setMsg(dictationError(e.error))
    r.onend = () => {
      if (rec.current === r) rec.current = null
      if (stopActive === stop) stopActive = null
      setListening(false)
    }
    rec.current = r
    stopActive = stop
    setMsg(null)
    setListening(true)
    try {
      r.start()
    } catch {
      rec.current = null
      setListening(false)
      setMsg(DICTATION_MSG.other)
    }
  }
  useEffect(
    () => () => {
      rec.current?.abort()
    },
    [],
  )
  /** Typing while listening: drop the mic at once (abort, so no late result overwrites the typed words). */
  const abort = () => rec.current?.abort()
  return { listening, msg, toggle: () => (listening ? stop() : start()), stop, abort }
}

/** A 44 px round mic button. `listening` turns it red with a stop square. */
export function MicButton({ listening, onClick, className = '' }: { listening: boolean; onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={listening}
      aria-label={listening ? 'Stop dictating' : 'Dictate: tap and speak'}
      title={listening ? 'Stop dictating' : 'Tap and speak'}
      data-mic={listening ? 'on' : 'off'}
      className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors ${
        listening ? 'bg-bad text-floor motion-safe:animate-pulse' : 'bg-surface-raised text-ink-secondary hover:text-ink'
      } ${className}`}
    >
      {listening ? <Square className="h-4 w-4 fill-current" aria-hidden /> : <Mic className="h-5 w-5" aria-hidden />}
    </button>
  )
}

/**
 * Wrap a text box with the mic: the button sits inside the box's bottom-right corner (give the box `pr-14`), and a
 * line under it says "Listening" or explains why the mic cannot run. Typing while listening stops the mic, so the
 * typed words are never overwritten.
 */
export function WithMic({
  value,
  onChange,
  children,
  className = '',
  inline = false,
}: {
  value: string
  onChange: (v: string) => void
  children: ReactNode
  className?: string
  /** A one-line bar (the classic CapCut chat bar): the button sits beside the box instead of inside it. */
  inline?: boolean
}) {
  const d = useDictation(value, onChange)
  return (
    <div className={className} data-micw="">
      <div
        className={inline ? 'flex items-center gap-1' : 'relative'}
        onKeyDownCapture={(e) => {
          if (d.listening && e.key.length === 1) d.abort()
        }}
      >
        {children}
        <MicButton listening={d.listening} onClick={d.toggle} className={inline ? '' : 'absolute bottom-1.5 right-1.5'} />
      </div>
      {(d.listening || d.msg) && (
        <p role="status" data-mic-msg="" className={`mt-1 text-caption ${d.listening ? 'font-semibold text-bad' : 'text-ink-secondary'}`}>
          {d.listening ? DICTATION_MSG.listening : d.msg}
        </p>
      )}
    </div>
  )
}
