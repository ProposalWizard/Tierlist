/**
 * ONE AUDIO OUTPUT FOR THE WHOLE GAME (v0.25 item 6).
 *
 * Why this exists — the iPhone:
 *   - Safari on iOS ignores `HTMLAudioElement.volume` (it is read-only there,
 *     always full). The UI sounds set quiet taps at 0.45, which an iPhone
 *     played at 1.0: "it sounds different on iPhone". A Web Audio gain node is
 *     honoured on iOS, so the UI sounds now play through one.
 *   - iOS allows only a few AudioContexts per page. The match's synthesised
 *     sounds and the UI sounds now share this one.
 *   - `navigator.audioSession.type = "ambient"` (Safari 17+) makes the game's
 *     sounds follow the ring/silent switch and mix with the player's own
 *     music instead of stopping it, like a game should. Ignored elsewhere.
 *
 * Never throws; no window (the server, a test) means no context.
 */
let ctx: AudioContext | null = null;
let sessionSet = false;

function setAmbientSession(): void {
  if (sessionSet || typeof navigator === "undefined") return;
  sessionSet = true;
  try {
    const s = (navigator as unknown as { audioSession?: { type?: string } }).audioSession;
    if (s && typeof s === "object") s.type = "ambient";
  } catch { /* not supported */ }
}

/** The shared context, made on first use (suspended until a tap; see resumeAudio). */
export function audioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    setAmbientSession();
    try { ctx = new AC(); } catch { return null; }
    // iOS unlocks audio only inside a touch: unlock on the first one, then stop listening.
    const unlock = () => {
      if (!ctx || ctx.state === "running") {
        window.removeEventListener("pointerdown", unlock, true);
        window.removeEventListener("touchend", unlock, true);
        return;
      }
      ctx.resume().catch(() => { /* try again next tap */ });
    };
    try {
      window.addEventListener("pointerdown", unlock, true);
      window.addEventListener("touchend", unlock, true);
    } catch { /* no events here */ }
  }
  return ctx;
}

/** Call from a tap: browsers keep audio off until a gesture has happened. */
export function resumeAudio(): void {
  const c = audioContext();
  if (c && c.state === "suspended") c.resume().catch(() => { /* still blocked */ });
}
