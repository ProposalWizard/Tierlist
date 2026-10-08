/**
 * GOAL VIDEO SOUND ON/OFF — the speaker button on every goal video.
 *
 * One setting for every video, kept on this device. It starts the way
 * Settings → Sound effects is set (someone who switched the game's sounds off
 * does not get a roar out of nowhere), then the button decides.
 */
import { useSyncExternalStore } from "react";
import { sfxOn } from "../sfx";

export const CLIP_SOUND_KEY = "star-clip-sound";

let on: boolean | undefined;
const listeners = new Set<() => void>();

function read(): boolean {
  try {
    const v = typeof localStorage === "undefined" ? null : localStorage.getItem(CLIP_SOUND_KEY);
    if (v === "on") return true;
    if (v === "off") return false;
  } catch { /* no storage */ }
  try { return sfxOn(); } catch { return true; }
}

export function clipSoundOn(): boolean {
  if (on === undefined) on = read();
  return on;
}

export function setClipSoundOn(v: boolean): void {
  on = v;
  try { localStorage.setItem(CLIP_SOUND_KEY, v ? "on" : "off"); } catch { /* in memory only */ }
  listeners.forEach(f => f());
}

function subscribe(f: () => void): () => void {
  listeners.add(f);
  return () => { listeners.delete(f); };
}

export function useClipSound(): boolean {
  return useSyncExternalStore(subscribe, clipSoundOn, () => false);
}
