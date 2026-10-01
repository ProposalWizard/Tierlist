/**
 * SOUND EFFECTS — the one place the New UI plays a sound outside the match.
 *
 *   import { sfx } from "@/lib/star/sfx";
 *   sfx("coin-in");
 *
 * The files are the ElevenLabs takes in public/sfx/ (manifest.json, made by
 * scripts/sfx/generate.py, auditioned at /sfx-dev). Settings → Sound effects
 * turns them off, saved per device like the UI choice (uiLook.ts); on by
 * default. New UI only: in the Old UI (components/star/legacy, the frozen
 * backup) every call is silent, so a shared screen can call this freely.
 *
 * Never throws — a browser that blocks audio until the first tap, a missing
 * file or no `Audio` at all (the server, a test) just means no sound.
 */
import { useSyncExternalStore } from "react";
import { uiVersion } from "./uiLook";

export type SfxName =
  | "ui-tap" | "ui-confirm" | "coin-in" | "star-tick" | "level-up" | "achievement-pop"
  | "breaking-news" | "phone-notification" | "can-open";

export const SFX_KEY = "star-sfx-on";

/** How loud each one plays (0-1). Taps sit under everything else. */
const VOLUME: Partial<Record<SfxName, number>> = { "ui-tap": 0.45, "ui-confirm": 0.6, "phone-notification": 0.7 };

let on: boolean | undefined;
const listeners = new Set<() => void>();
const cache = new Map<SfxName, HTMLAudioElement>();

function readOn(): boolean {
  try {
    if (typeof localStorage === "undefined") return true;
    return localStorage.getItem(SFX_KEY) !== "off";
  } catch {
    return true;
  }
}

export function sfxOn(): boolean {
  if (on === undefined) on = readOn();
  return on;
}

export function setSfxOn(v: boolean): void {
  try { localStorage.setItem(SFX_KEY, v ? "on" : "off"); } catch { /* in-memory still changes */ }
  on = v;
  listeners.forEach((f) => f());
}

function subscribe(f: () => void): () => void {
  listeners.add(f);
  return () => { listeners.delete(f); };
}

/** The setting, re-rendering when it flips (Settings' toggle). */
export function useSfxOn(): boolean {
  return useSyncExternalStore(subscribe, sfxOn, () => true);
}

function load(name: SfxName): HTMLAudioElement | null {
  if (typeof Audio === "undefined") return null;
  let a = cache.get(name);
  if (!a) {
    a = new Audio(`/sfx/${name}.mp3`);
    a.preload = "auto";
    cache.set(name, a);
  }
  return a;
}

/** Fetch the files ahead of the first play, so a tap sounds on the tap. */
export function preloadSfx(names: SfxName[] = ["ui-tap", "ui-confirm", "coin-in", "star-tick", "level-up", "achievement-pop", "breaking-news", "phone-notification", "can-open"]): void {
  try { names.forEach(load); } catch { /* no audio here */ }
}

/** Play one sound. Overlapping plays of the same sound each get their own copy. */
export function sfx(name: SfxName): void {
  try {
    if (!sfxOn() || uiVersion() !== "new") return;
    const base = load(name);
    if (!base) return;
    const a = base.paused || base.currentTime === 0 ? base : (base.cloneNode(true) as HTMLAudioElement);
    a.volume = VOLUME[name] ?? 0.85;
    a.currentTime = 0;
    const p = a.play();
    if (p && typeof p.catch === "function") p.catch(() => { /* blocked until the first tap */ });
  } catch {
    /* never let a sound break a screen */
  }
}
