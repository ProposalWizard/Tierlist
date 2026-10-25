/**
 * GAME MUSIC — Settings → "Game music" (Mikey, 21 Oct 2026). Off by default.
 *
 * Mikey: "apply it to the game in the scenarios that are relevant and also
 * maybe have some of it as regular music during games and the home screen
 * … they shouldn't be too overpowering to take away from the game … it
 * should be a toggle which you turn on in the settings".
 *
 * Eleven cues, each written for one moment (inspired by Blue Lock's score:
 * same speed, key and energy, every note new). They are played by real
 * orchestra recordings (VSCO 2 CE, CC0) and live in public/star/music/.
 * Made by tools/game-music/ (read its README).
 *
 * Where each plays (`sceneCue`, `matchCue`, pure, tests/star/gameMusic.mts):
 *   home screens    08 lobby; 03 winning after a win
 *   training/trial  02 working it out
 *   in a match      02 level · 10 ahead · 07 one behind · 05 two+ behind
 *                   09 level in the last 15 · 11 final boss: a knockout,
 *                   last 15, within a goal · 04 while you dribble
 *                   01 turning point once, when you score from behind
 *   full time       03 win · 06 loss · 08 draw
 *   Ballon d'Or     02 while the names are read · 03 you won · 06 not you
 *   cut scenes      nothing (they have their own music)
 *
 * Quiet on purpose: a match plays at MATCH_VOLUME, under the crowd and the
 * kicks; the match's mute button mutes it too. Loops are gapless (each file
 * carries half a second of its own loop either side, see `CUES`).
 *
 * Never throws: no window, no Web Audio, a missing file = no music.
 */
import { useSyncExternalStore } from "react";
import { audioContext } from "./audioOut";

export type CueId =
  | "01-turning-point" | "02-working-it-out" | "03-winning" | "04-dribble"
  | "05-under-the-cosh" | "06-defeat" | "07-find-a-way" | "08-lobby"
  | "09-last-attack" | "10-good-spell" | "11-final-boss";

/** pre = seconds of padding before the loop starts; len = loop length (seconds). One-shots have no loop. */
export const CUES: Record<CueId, { loop: boolean; pre: number; len: number }> = {
  "01-turning-point": { loop: false, pre: 0, len: 0 },
  "02-working-it-out": { loop: true, pre: 0.5, len: 53.333333 },
  "03-winning": { loop: true, pre: 0.5, len: 37.281542 },
  "04-dribble": { loop: true, pre: 0.5, len: 37.281542 },
  "05-under-the-cosh": { loop: true, pre: 0.5, len: 40.0 },
  "06-defeat": { loop: true, pre: 0.5, len: 34.285714 },
  "07-find-a-way": { loop: true, pre: 0.5, len: 47.407392 },
  "08-lobby": { loop: true, pre: 0.5, len: 41.739116 },
  "09-last-attack": { loop: true, pre: 0.5, len: 37.281542 },
  "10-good-spell": { loop: true, pre: 0.5, len: 32.542358 },
  "11-final-boss": { loop: true, pre: 0.5, len: 20.869546 },
};

export const MUSIC_KEY = "star-game-music";
/** Loudness of the music (0-1) on each kind of screen. A match sits lowest. */
export const MENU_VOLUME = 0.32;
export const MATCH_VOLUME = 0.17;
export const RESULT_VOLUME = 0.34;
const FADE_S = 1.6;
/**
 * A change of track: the old one fades out fast, and the new one starts only as
 * it finishes, so two tracks are never heard together for long (Mikey, 21 Oct
 * 2026: after a quick goal each way "it felt as though two songs were playing
 * at the same time"; the old 1.6 s crossfade overlapped keys a half-step apart).
 */
const SWAP_OUT_S = 0.7;
const SWAP_IN_S = 1.2;
let fadeEndAt = 0;
/** A bed stays at least this long before the score can swap it (stops flip-flopping). */
export const MIN_BED_S = 8;

// --- the switch ---------------------------------------------------------
let on: boolean | undefined;
const listeners = new Set<() => void>();
function readOn(): boolean {
  try { return typeof localStorage !== "undefined" && localStorage.getItem(MUSIC_KEY) === "on"; } catch { return false; }
}
export function gameMusicOn(): boolean { if (on === undefined) on = readOn(); return on; }
export function setGameMusicOn(v: boolean): void {
  try { localStorage.setItem(MUSIC_KEY, v ? "on" : "off"); } catch { /* in-memory still changes */ }
  on = v; listeners.forEach((f) => f()); apply();
}
export function useGameMusicOn(): boolean {
  return useSyncExternalStore((f) => { listeners.add(f); return () => { listeners.delete(f); }; }, gameMusicOn, () => false);
}
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => { if (e.key === MUSIC_KEY) { on = undefined; listeners.forEach((f) => f()); apply(); } });
}

// --- what should play (pure) ----------------------------------------------
export interface MatchMusicState {
  us: number; them: number;
  /** The match clock and the match's full length (90 unless the Rule Book says otherwise). */
  minute: number; duration: number;
  /** A tie that must be won tonight: a final, a single-leg knockout, a second leg. */
  knockout: boolean;
  dribbling: boolean;
}
export type MusicScene =
  | { kind: "none" }
  | { kind: "menu"; lastWon: boolean }
  | { kind: "practice" }
  | { kind: "match"; state: MatchMusicState }
  | { kind: "full-time"; us: number; them: number }
  /** won: null while the names are still being read out. */
  | { kind: "ballon-dor"; won: boolean | null };

/** The last 15 minutes of a 90 (scaled for other lengths). */
export function isLate(m: Pick<MatchMusicState, "minute" | "duration">): boolean {
  return m.minute >= m.duration * (75 / 90);
}

export function matchCue(m: MatchMusicState): CueId {
  const d = m.us - m.them;
  if (m.dribbling) return "04-dribble";
  if (m.knockout && isLate(m) && Math.abs(d) <= 1) return "11-final-boss";
  if (d <= -2) return "05-under-the-cosh";
  if (d === -1) return "07-find-a-way";
  if (d === 0) return isLate(m) ? "09-last-attack" : "02-working-it-out";
  return "10-good-spell";
}

export function sceneCue(s: MusicScene): CueId | null {
  switch (s.kind) {
    case "none": return null;
    case "menu": return s.lastWon ? "03-winning" : "08-lobby";
    case "practice": return "02-working-it-out";
    case "match": return matchCue(s.state);
    case "full-time": return s.us > s.them ? "03-winning" : s.us < s.them ? "06-defeat" : "08-lobby";
    case "ballon-dor": return s.won === null ? "02-working-it-out" : s.won ? "03-winning" : "06-defeat";
  }
}

export function sceneVolume(s: MusicScene): number {
  return s.kind === "match" || s.kind === "practice" ? MATCH_VOLUME : s.kind === "menu" ? MENU_VOLUME : RESULT_VOLUME;
}

/** True when a goal of yours should play the turning-point cue: you were behind before it. */
export function isTurningPoint(usBefore: number, themBefore: number, usAfter: number): boolean {
  return usAfter > usBefore && usBefore < themBefore;
}

/**
 * Should the bed change now? Not more often than MIN_BED_S, except into or out
 * of the dribble (that follows the run at once) and the final boss (it lands
 * the moment it is due).
 */
export function shouldSwap(current: CueId | null, next: CueId | null, secondsOnCurrent: number): boolean {
  if (current === next) return false;
  if (!current || !next) return true;
  if (current === "04-dribble" || next === "04-dribble" || next === "11-final-boss") return true;
  return secondsOnCurrent >= MIN_BED_S;
}

// --- the player (browser only) ---------------------------------------------
const holds = new Set<string>();
const scenes = new Map<string, { scene: MusicScene; at: number; priority: number }>();
let muted = false;
let master: GainNode | null = null;
let playing: { id: CueId; src: AudioBufferSourceNode; gain: GainNode; since: number } | null = null;
let sting: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
const buffers = new Map<CueId, AudioBuffer | null | Promise<AudioBuffer | null>>();
let pending: ReturnType<typeof setTimeout> | null = null;

export function cueUrl(id: CueId): string { return `/star/music/${id}.mp3`; }

function load(id: CueId): Promise<AudioBuffer | null> {
  const b = buffers.get(id);
  if (b instanceof Promise) return b;
  if (b !== undefined) return Promise.resolve(b);
  const ctx = audioContext();
  if (!ctx || typeof fetch === "undefined") return Promise.resolve(null);
  const p = fetch(cueUrl(id))
    .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
    .then((a) => ctx.decodeAudioData(a))
    .then((buf) => { buffers.set(id, buf); return buf; })
    .catch(() => { buffers.set(id, null); return null; });
  buffers.set(id, p);
  return p;
}

function out(ctx: AudioContext): GainNode {
  if (!master) { master = ctx.createGain(); master.connect(ctx.destination); }
  return master;
}

/** The scene that wins: the highest priority, then the newest. */
function currentScene(): MusicScene {
  let best: { scene: MusicScene; at: number; priority: number } | null = null;
  for (const v of Array.from(scenes.values())) if (!best || v.priority > best.priority || (v.priority === best.priority && v.at > best.at)) best = v;
  return best?.scene ?? { kind: "none" };
}

function fadeOut(g: GainNode, src: AudioBufferSourceNode, ctx: AudioContext, secs = SWAP_OUT_S): void {
  const t = ctx.currentTime;
  try {
    g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t);
    g.gain.linearRampToValueAtTime(0, t + secs); src.stop(t + secs + 0.05);
  } catch { /* already stopped */ }
}

function apply(): void {
  if (typeof window === "undefined") return;
  const ctx = audioContext();
  if (!ctx) return;
  const scene = currentScene();
  const want = gameMusicOn() && holds.size === 0 ? sceneCue(scene) : null;
  const vol = muted ? 0 : sceneVolume(scene);
  const since = playing ? ctx.currentTime - playing.since : 0;
  if (playing && playing.id === want) {
    const t = ctx.currentTime;
    playing.gain.gain.cancelScheduledValues(t); playing.gain.gain.setValueAtTime(playing.gain.gain.value, t);
    playing.gain.gain.linearRampToValueAtTime(vol, t + 0.6);
    return;
  }
  if (!shouldSwap(playing?.id ?? null, want, since)) {
    // try again when the bed has had its time
    if (pending) clearTimeout(pending);
    pending = setTimeout(() => { pending = null; apply(); }, Math.max(200, (MIN_BED_S - since) * 1000));
    return;
  }
  if (playing) { fadeOut(playing.gain, playing.src, ctx); fadeEndAt = ctx.currentTime + SWAP_OUT_S; playing = null; }
  if (!want) return;
  const id = want;
  void load(id).then((buf) => {
    if (!buf || !gameMusicOn() || holds.size > 0 || sceneCue(currentScene()) !== id || playing) return;
    const meta = CUES[id];
    const src = ctx.createBufferSource(); src.buffer = buf;
    if (meta.loop) { src.loop = true; src.loopStart = meta.pre; src.loopEnd = meta.pre + meta.len; }
    const g = ctx.createGain(); g.gain.value = 0;
    src.connect(g); g.connect(out(ctx));
    // a first track fades in gently; a replacement waits for the old one to go
    const swap = fadeEndAt > ctx.currentTime;
    const t = Math.max(ctx.currentTime, fadeEndAt - 0.1);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(muted ? 0 : sceneVolume(currentScene()), t + (swap ? SWAP_IN_S : FADE_S));
    try { src.start(t, meta.loop ? meta.pre : 0); } catch { return; }
    playing = { id, src, gain: g, since: t };
  });
}

/**
 * Say what a screen is showing. `key` names the caller (the page, the match,
 * the Ballon d'Or night). A screen inside another passes a higher `priority`
 * (the page is 0; the match and the night are 10), so its scene wins while it
 * is up; `clearMusicScene(key)` hands back when it closes.
 */
export function setMusicScene(key: string, scene: MusicScene, priority = 0): void {
  const prev = scenes.get(key);
  const same = prev && prev.priority === priority && JSON.stringify(prev.scene) === JSON.stringify(scene);
  if (same) return;
  scenes.set(key, { scene, priority, at: typeof performance !== "undefined" ? performance.now() : Date.now() });
  apply();
}
export function clearMusicScene(key: string): void { if (scenes.delete(key)) apply(); }

/** Silence the music while something with its own sound plays (a cut scene, a goal video). */
export function holdMusic(key: string, hold: boolean): void {
  const had = holds.has(key);
  if (hold) holds.add(key); else holds.delete(key);
  if (had !== hold) apply();
}

/** The match's mute button mutes the music too. */
export function setMusicMuted(m: boolean): void { if (muted !== m) { muted = m; apply(); } }

/** The turning-point cue, once, over the bed (the bed dips under it). */
export function playTurningPoint(): void {
  if (typeof window === "undefined" || !gameMusicOn() || holds.size > 0 || muted) return;
  const ctx = audioContext();
  if (!ctx) return;
  void load("01-turning-point").then((buf) => {
    if (!buf || !gameMusicOn()) return;
    if (sting) fadeOut(sting.gain, sting.src, ctx);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const g = ctx.createGain(); g.gain.value = 0; src.connect(g); g.connect(out(ctx));
    const t = ctx.currentTime; const len = buf.duration;
    g.gain.linearRampToValueAtTime(MATCH_VOLUME * 1.25, t + 0.8);
    g.gain.setValueAtTime(MATCH_VOLUME * 1.25, t + len - 2);
    g.gain.linearRampToValueAtTime(0, t + len);
    if (playing) {
      const pg = playing.gain.gain;
      pg.cancelScheduledValues(t); pg.setValueAtTime(pg.value, t);
      pg.linearRampToValueAtTime(0.02, t + 1); pg.setValueAtTime(0.02, t + len - 3);
      pg.linearRampToValueAtTime(muted ? 0 : sceneVolume(currentScene()), t + len);
    }
    try { src.start(t); } catch { return; }
    sting = { src, gain: g };
  });
}

/** Warm the files a screen is about to need, so a change of score swaps without a gap. */
export function preloadMusic(ids: CueId[]): void { if (gameMusicOn()) ids.forEach((id) => { void load(id); }); }

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    const ctx = audioContext();
    if (!ctx || !master) return;
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t); master.gain.setValueAtTime(master.gain.value, t);
    master.gain.linearRampToValueAtTime(document.hidden ? 0 : 1, t + 0.3);
  });
}
