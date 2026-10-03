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
import { audioContext, resumeAudio } from "./audioOut";
import { makeSoundGate, nowMs } from "./soundGate";

export type SfxName =
  | "ui-tap" | "ui-confirm" | "coin-in" | "star-tick" | "level-up" | "achievement-pop"
  | "breaking-news" | "phone-notification" | "can-open";

export const SFX_KEY = "star-sfx-on";

/** How loud each one plays (0-1). Taps sit under everything else. */
const VOLUME: Partial<Record<SfxName, number>> = { "ui-tap": 0.45, "ui-confirm": 0.6, "phone-notification": 0.7 };

let on: boolean | undefined;
const listeners = new Set<() => void>();
const cache = new Map<SfxName, HTMLAudioElement>();
/** Decoded copies for the Web Audio path (audioOut.ts): `null` = tried and failed. */
const buffers = new Map<SfxName, AudioBuffer | null | Promise<void>>();
/** How often each sound may play (soundGate.ts, v0.25 item 6). */
const gate = makeSoundGate();

/**
 * REPLACEMENT SOUNDS. An admin can upload a replacement for any sound on the
 * Sound Board (/admin/sound-board). The list of replacements is kept in
 * Supabase Storage and served by /api/star/sfx-overrides. We remember the last
 * list per device (so the very first sound of a visit already uses it) and
 * refresh it once in the background. No list, no network, a bad answer: the
 * bundled file in public/sfx plays, exactly as before.
 */
export const SFX_OVERRIDES_KEY = "star-sfx-overrides";
let overrides: Record<string, string> | undefined;
let overridesRequested = false;

function readStoredOverrides(): Record<string, string> {
  try {
    const raw = typeof localStorage === "undefined" ? null : localStorage.getItem(SFX_OVERRIDES_KEY);
    const m = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(m)) if (typeof v === "string" && /^https?:\/\//.test(v)) out[k] = v;
    return out;
  } catch {
    return {};
  }
}

/** The file a sound plays: the admin's replacement if there is one, else the bundled one. */
export function sfxUrl(name: string): string {
  if (overrides === undefined) overrides = readStoredOverrides();
  return overrides[name] ?? `/sfx/${name}.mp3`;
}

/** Ask once per page load which sounds have a replacement. Never throws. */
function refreshOverrides(): void {
  if (overridesRequested || typeof fetch === "undefined" || typeof window === "undefined") return;
  overridesRequested = true;
  fetch("/api/star/sfx-overrides")
    .then((r) => (r.ok ? r.json() : null))
    .then((j: { overrides?: Record<string, { url?: unknown }> } | null) => {
      if (!j || !j.overrides || typeof j.overrides !== "object") return;
      const next: Record<string, string> = {};
      for (const [k, v] of Object.entries(j.overrides)) {
        if (v && typeof v.url === "string" && /^https?:\/\//.test(v.url)) next[k] = v.url;
      }
      const before = overrides ?? readStoredOverrides();
      overrides = next;
      try { localStorage.setItem(SFX_OVERRIDES_KEY, JSON.stringify(next)); } catch { /* fine */ }
      // Drop any already-loaded copy whose file changed, so the next play uses the new one.
      Object.keys({ ...before, ...next }).forEach((k) => {
        if (before[k] !== next[k]) { cache.delete(k as SfxName); buffers.delete(k as SfxName); }
      });
    })
    .catch(() => { /* keep the bundled sounds */ });
}

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
    refreshOverrides();
    a = new Audio(sfxUrl(name));
    a.preload = "auto";
    cache.set(name, a);
  }
  return a;
}

/** Fetch and decode a sound for the Web Audio path. Never throws. */
function decode(name: SfxName): void {
  const c = audioContext();
  if (!c || buffers.has(name) || typeof fetch === "undefined") return;
  refreshOverrides();
  const job = fetch(sfxUrl(name))
    .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error("no file"))))
    .then((data) => new Promise<AudioBuffer>((res, rej) => {
      // The callback form: old iOS Safari has no promise-returning decodeAudioData.
      const p = c.decodeAudioData(data, res, rej);
      if (p && typeof (p as Promise<AudioBuffer>).then === "function") (p as Promise<AudioBuffer>).then(res, rej);
    }))
    .then((b) => { buffers.set(name, b); })
    .catch(() => { buffers.set(name, null); });
  buffers.set(name, job);
}

/** Fetch the files ahead of the first play, so a tap sounds on the tap. */
export function preloadSfx(names: SfxName[] = ["ui-tap", "ui-confirm", "coin-in", "star-tick", "level-up", "achievement-pop", "breaking-news", "phone-notification", "can-open"]): void {
  try {
    if (audioContext()) names.forEach(decode);
    else names.forEach(load);
  } catch { /* no audio here */ }
}

/**
 * Play one sound — at most once per its gap, and never more than a few at
 * once (soundGate.ts). Through Web Audio where there is one, so the volume
 * holds on an iPhone; an old browser without it uses an <audio> element.
 */
export function sfx(name: SfxName): void {
  try {
    if (!sfxOn() || uiVersion() !== "new") return;
    if (!gate(name, nowMs())) return;
    const vol = VOLUME[name] ?? 0.85;
    const c = audioContext();
    if (c) {
      const b = buffers.get(name);
      if (b === undefined || b instanceof Promise) { decode(name); return; }   // not ready yet: skip, never stack later
      if (b === null) return;
      const play = () => {
        const src = c.createBufferSource();
        src.buffer = b;
        const g = c.createGain();
        g.gain.value = vol;
        src.connect(g);
        g.connect(c.destination);
        src.start();
      };
      if (c.state === "running") { play(); return; }
      // Still locked (no tap yet): play only if it unlocks now, inside this
      // tap. A sound queued on a locked context would all fire together at
      // the first tap — the stacking heard on the iPhone.
      const t0 = nowMs();
      resumeAudio();
      c.resume().then(() => { if (nowMs() - t0 < 250) play(); }).catch(() => { /* still locked */ });
      return;
    }
    const base = load(name);
    if (!base) return;
    const a = base.paused || base.currentTime === 0 ? base : (base.cloneNode(true) as HTMLAudioElement);
    a.volume = vol;
    a.currentTime = 0;
    const p = a.play();
    if (p && typeof p.catch === "function") p.catch(() => { /* blocked until the first tap */ });
  } catch {
    /* never let a sound break a screen */
  }
}
