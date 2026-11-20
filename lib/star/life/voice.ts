/**
 * THE STORY'S VOICES — Den (Peter) and the gaffer (Paul) speaking their lines
 * in the kit man arc. The clips are public/star/life/voice/hundred-balls/
 * (manifest.json: {id, speaker, voice, text, file, seconds}), made by the
 * voices builder; this file only plays them.
 *
 *  - A clip plays when its words are on screen: each clip's id names its beat
 *    and node ("b1-the-offer.n1.say0.q0", "b2-the-gaffer.end.objective.0.q0",
 *    "b1-the-offer.play.caller2"), and it plays only if its own text is in what
 *    is shown, so an {if} line that was not shown stays silent, and a clip that
 *    holds only the sentence after a score plays when that sentence is there.
 *  - The game's sound setting (sfx.ts) is respected; a new line stops the last
 *    clip; nothing waits on audio; a missing file is silent text.
 *  - The manifest is fetched the first time a story screen speaks (no preload).
 */
import { sfxOn } from "../sfx";

interface Clip { id: string; speaker: string; text: string; file: string; seconds: number }

const BASE = "/star/life/voice/hundred-balls/";
let manifest: Clip[] | null = null;
let loading: Promise<Clip[]> | null = null;
let current: HTMLAudioElement | null = null;
let seq = 0;

function load(): Promise<Clip[]> {
  if (manifest) return Promise.resolve(manifest);
  if (!loading) {
    loading = fetch(`${BASE}manifest.json`)
      .then((r) => (r.ok ? r.json() : []))
      .then((j: unknown) => (manifest = Array.isArray(j) ? (j as Clip[]).filter((c) => c && typeof c.id === "string" && typeof c.file === "string") : []))
      .catch(() => (manifest = []));
  }
  return loading;
}

const norm = (s: string) => s.toLowerCase().replace(/[“”"]/g, "").replace(/[^a-z0-9' ]+/g, " ").replace(/\s+/g, " ").trim();

/** Stop whatever is playing (the line changed, the screen closed). */
export function stopVoice(): void {
  seq++;
  if (current) { try { current.pause(); } catch { /* fine */ } current = null; }
}

/**
 * Speak the clips of `prefix` (a beat and a node, "b1-the-offer.n1."; or several) whose
 * words are in `shown`, in the order they appear there. Returns at once.
 */
export function speak(prefix: string | string[], shown: string): void {
  stopVoice();
  if (typeof window === "undefined" || typeof Audio === "undefined" || !sfxOn()) return;
  const mine = ++seq;
  const prefixes = Array.isArray(prefix) ? prefix : [prefix];
  // Whole words only: "Hm." must not play inside "them".
  const text = ` ${norm(shown)} `;
  const at = (c: Clip) => text.indexOf(` ${norm(c.text)} `);
  load().then((all) => {
    if (mine !== seq) return;
    const list = all
      .filter((c) => prefixes.some((p) => c.id.startsWith(p)) && c.text && at(c) >= 0)
      .sort((a, b) => at(a) - at(b));
    const next = (i: number) => {
      if (mine !== seq || i >= list.length || !sfxOn()) return;
      const a = new Audio(`${BASE}${list[i].file.replace(/^.*\//, "")}`);
      current = a;
      a.onended = () => next(i + 1);
      a.onerror = () => next(i + 1);
      a.play().catch(() => next(i + 1));
    };
    next(0);
  }).catch(() => { /* silent text */ });
}

/** The beat's prefix in the clip ids: its id in the arc book. */
export const voicePrefix = (beat: string, node: string) => `${beat}.${node}.`;
