/**
 * Dictation: the one-tap microphone on every text box in the editing suite (Harry, 2026-10-19: "Need a microphone
 * function on all of it. Otherwise, I have to be typing, which is too long.").
 *
 * Pure rules only. The browser's own speech recognition (Web Speech API, `webkitSpeechRecognition` on iPhone Safari)
 * turns speech into text; nothing is recorded or stored, only the words land in the box.
 */

/** Harry is UK English. */
export const DICTATION_LANG = 'en-GB'

/** One result from the recogniser, flattened: its best guess and whether it is final. */
export type SpokenPart = { text: string; final: boolean }

/**
 * The words heard so far, from the recogniser's result list.
 * iPhone Safari (continuous mode) sometimes repeats a phrase as a NEW result that starts with the previous one
 * ("swap the", then "swap the shot"); that is the same phrase growing, so it replaces the last part instead of
 * doubling it.
 */
export function spokenText(parts: readonly SpokenPart[]): string {
  const out: string[] = []
  for (const p of parts) {
    const t = p.text.trim()
    if (!t) continue
    const last = out[out.length - 1]
    if (last !== undefined && t.toLowerCase().startsWith(last.toLowerCase())) out[out.length - 1] = t
    else out.push(t)
  }
  return out.join(' ')
}

/** What the box shows while listening: what was there before the tap, then the words heard (one space between). */
export function joinDictation(before: string, spoken: string): string {
  const s = spoken.trim()
  if (!s) return before
  const b = before.replace(/\s+$/, '')
  return b ? `${b} ${s}` : s
}

/** Plain-words messages: the button never fails silently. */
export const DICTATION_MSG = {
  listening: 'Listening. Speak, then tap the mic to stop.',
  unsupported: "This browser can't turn speech into text. Tap the box, then the mic on your keyboard and speak.",
  blocked: 'The microphone is blocked here. Tap the box, then the mic on your keyboard and speak.',
  noSpeech: "I didn't hear anything. Tap the mic and try again.",
  noMic: 'No microphone found. Tap the box, then the mic on your keyboard and speak.',
  network: "Speech needs the internet and it dropped. Try again, or use your keyboard's mic.",
  other: "The mic stopped. Tap it to try again, or use your keyboard's mic.",
} as const

/** The plain-words message for a recogniser error code (`SpeechRecognitionErrorEvent.error`). `aborted` is ours: silent. */
export function dictationError(code: string | undefined): string | null {
  switch (code) {
    case 'aborted':
      return null
    case 'not-allowed':
    case 'service-not-allowed':
      return DICTATION_MSG.blocked
    case 'no-speech':
      return DICTATION_MSG.noSpeech
    case 'audio-capture':
      return DICTATION_MSG.noMic
    case 'network':
      return DICTATION_MSG.network
    default:
      return DICTATION_MSG.other
  }
}
