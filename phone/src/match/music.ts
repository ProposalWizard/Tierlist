/**
 * GAME MUSIC ON THE PHONE (Settings → Game music, off by default, as on the
 * website). lib/star/gameMusic.ts decides WHAT plays (matchCue / sceneCue /
 * sceneVolume / shouldSwap, the same pure rules); this plays it with
 * expo-audio instead of Web Audio:
 *   - one bed at a time; a change fades the old one out fast (0.7 s) and the
 *     new one in once it has gone (1.2 s; the first 1.6 s);
 *   - a bed stays at least MIN_BED_S before the score swaps it (the dribble
 *     and the final boss swap at once);
 *   - the turning-point cue plays once over the bed, which dips under it;
 *   - the match's sound switch mutes it (the website's mute button does).
 * The tracks are the website's own files, bundled by scripts/data-pack.js
 * (src/data/generated/packedMusic.js). No tracks there: no music, no error.
 * Whole-file loops: the files' half-second lead-in is heard on each loop.
 */
import { createAudioPlayer, type AudioPlayer } from "expo-audio";
import { sceneCue, sceneVolume, shouldSwap, MATCH_VOLUME, MIN_BED_S, type CueId, type MusicScene } from "@/lib/star/gameMusic";
import { getPrefs } from "../game/prefs";

const SWAP_OUT_S = 0.7, SWAP_IN_S = 1.2, FADE_S = 1.6;

let files: Record<string, number> | null | undefined;
function fileOf(id: CueId): number | null {
  if (files === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      files = require("../data/generated/packedMusic") as Record<string, number>;
    } catch { files = null; }
  }
  return files?.[id] ?? null;
}

const players = new Map<CueId, AudioPlayer>();
function playerOf(id: CueId, loop: boolean): AudioPlayer | null {
  let p = players.get(id);
  if (p) return p;
  const f = fileOf(id);
  if (f === null) return null;
  try { p = createAudioPlayer(f); p.loop = loop; } catch { return null; }
  players.set(id, p);
  return p;
}

/** A volume ramp on one player, stepped every 50 ms; `done` when it lands. */
const ramps = new Map<AudioPlayer, ReturnType<typeof setInterval>>();
function ramp(p: AudioPlayer, to: number, secs: number, done?: () => void) {
  const old = ramps.get(p);
  if (old) clearInterval(old);
  const from = p.volume, t0 = Date.now();
  const id = setInterval(() => {
    const u = secs > 0 ? Math.min(1, (Date.now() - t0) / (secs * 1000)) : 1;
    try { p.volume = Math.max(0, Math.min(1, from + (to - from) * u)); } catch { /* gone */ }
    if (u >= 1) { clearInterval(id); ramps.delete(p); done?.(); }
  }, 50);
  ramps.set(p, id);
}

const scenes = new Map<string, { scene: MusicScene; at: number; priority: number }>();
let playing: { id: CueId; p: AudioPlayer; since: number } | null = null;
let fadeEndAt = 0, pending: ReturnType<typeof setTimeout> | null = null, dipped = false;

function currentScene(): MusicScene {
  let best: { scene: MusicScene; at: number; priority: number } | null = null;
  for (const v of scenes.values()) if (!best || v.priority > best.priority || (v.priority === best.priority && v.at > best.at)) best = v;
  return best?.scene ?? { kind: "none" };
}
const on = () => getPrefs().gameMusic;
const muted = () => !getPrefs().sound;

function apply() {
  const scene = currentScene();
  const want = on() ? sceneCue(scene) : null;
  const vol = muted() ? 0 : sceneVolume(scene);
  const now = Date.now() / 1000;
  const since = playing ? now - playing.since : 0;
  if (playing && playing.id === want) { if (!dipped) ramp(playing.p, vol, 0.6); return; }
  if (!shouldSwap(playing?.id ?? null, want, since)) {
    if (pending) clearTimeout(pending);
    pending = setTimeout(() => { pending = null; apply(); }, Math.max(200, (MIN_BED_S - since) * 1000));
    return;
  }
  if (playing) {
    const old = playing.p;
    ramp(old, 0, SWAP_OUT_S, () => { try { old.pause(); } catch { /* gone */ } });
    fadeEndAt = now + SWAP_OUT_S;
    playing = null;
  }
  if (!want) return;
  const p = playerOf(want, true);
  if (!p) return;
  const swap = fadeEndAt > now;
  const start = () => {
    if (sceneCue(currentScene()) !== want || !on() || playing) return;
    try { p.volume = 0; void p.seekTo(0.5); p.play(); } catch { return; }
    playing = { id: want, p, since: Date.now() / 1000 };
    ramp(p, muted() ? 0 : sceneVolume(currentScene()), swap ? SWAP_IN_S : FADE_S);
  };
  if (swap) setTimeout(start, Math.max(0, (fadeEndAt - now - 0.1) * 1000)); else start();
}

/** Say what a screen is showing (gameMusic.ts setMusicScene); the match is priority 10. */
export function setMusicScene(key: string, scene: MusicScene, priority = 0) {
  const prev = scenes.get(key);
  if (prev && prev.priority === priority && JSON.stringify(prev.scene) === JSON.stringify(scene)) return;
  scenes.set(key, { scene, priority, at: Date.now() });
  apply();
}
export function clearMusicScene(key: string) { if (scenes.delete(key)) apply(); }
/** The sound switch or the music switch changed: follow it now. */
export function refreshMusic() { apply(); }

/** The turning-point cue, once, over the bed (the bed dips under it). */
export function playTurningPoint() {
  if (!on() || muted()) return;
  const s = playerOf("01-turning-point", false);
  if (!s) return;
  try { s.volume = 0; void s.seekTo(0); s.play(); } catch { return; }
  ramp(s, MATCH_VOLUME * 1.25, 0.8);
  const len = s.duration > 0 ? s.duration : 8;
  const bed = playing?.p;
  if (bed) { dipped = true; ramp(bed, 0.02, 1); }
  setTimeout(() => ramp(s, 0, 2), Math.max(0, (len - 2) * 1000));
  setTimeout(() => { dipped = false; if (playing) ramp(playing.p, muted() ? 0 : sceneVolume(currentScene()), 3); }, Math.max(0, (len - 3) * 1000));
}
