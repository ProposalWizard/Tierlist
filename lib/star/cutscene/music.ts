/**
 * THE MUSIC BED under a cut scene (Settings → Look → "Cut-scene camera: New").
 *
 * Harry, 9 Oct 2026: "… music". One short looping bed per kind of scene:
 *   signing   warm, hopeful           (signed, arrival)
 *   trophy    triumphant              (a trophy, a goal, an award, promotion, a record)
 *   walkout   building tension        (walk-out, debut, rivalry)
 *   press     low tension             (press room, bad news, injury, the mentor)
 *   farewell  emotional               (retired)
 * Files: public/sfx/cut-music-<bed>.mp3 (tools/cutscene-music/make_beds.py),
 * each on the Sound Board, so `sfxUrl` plays an admin's replacement if there
 * is one. It fades in, fades out with the scene, and drops under anyone
 * speaking. Silent when Settings → Sound effects is off.
 *
 * `musicBedFor` and `musicGain` are pure (tests/star/cutscene.mts);
 * `createCutsceneMusic` is the small browser player a host drives from t.
 */
import type { CutsceneScript, EventKind } from "./types";

export type MusicBed = "signing" | "trophy" | "walkout" | "press" | "farewell";

const BY_KIND: Partial<Record<EventKind, MusicBed>> = {
  signed: "signing", arrival: "signing",
  "won-trophy": "trophy", scored: "trophy", award: "trophy", promoted: "trophy", "record-broken": "trophy",
  walkout: "walkout", debut: "walkout", rivalry: "walkout",
  "press-conference": "press", dropped: "press", sacked: "press", "transfer-request": "press", injured: "press", "mentor-advice": "press", relegated: "press",
  retired: "farewell",
};

/** The bed for a script: by its event, else by where it is. */
export function musicBedFor(s: CutsceneScript): MusicBed {
  const k = s.source?.event?.kind;
  if (k && BY_KIND[k]) {
    // a sad event in the office or on the pitch: the farewell bed's feeling fits better
    if (s.source?.event?.emotion === "sadness" && (k === "injured" || k === "dropped")) return "farewell";
    return BY_KIND[k]!;
  }
  switch (s.set.location) {
    case "office": return "signing";
    case "tunnel": return "walkout";
    case "press-room": return "press";
    default: return "trophy";
  }
}

export const musicCue = (bed: MusicBed) => `cut-music-${bed}`;

/** Loudness of the bed on its own, and under talk. */
export const MUSIC_LEVEL = 0.55;
export const MUSIC_DUCKED = 0.18;
const FADE_IN = 1.2, FADE_OUT = 1.6, DUCK_RAMP = 0.3;

/** Stretches where someone speaks (speak tracks, recorded lines, spoken captions). */
export function talkWindows(s: CutsceneScript): [number, number][] {
  const out: [number, number][] = [];
  for (const t of s.tracks) {
    if (t.type === "speak") out.push([t.at, t.at + t.dur]);
    else if (t.type === "caption" && (t.speaker || t.style === "subtitle")) out.push([t.at, t.at + t.dur]);
  }
  return out.sort((a, b) => a[0] - b[0]);
}

/** The bed's volume at t (0..1): fade in, fade out, and ducked under talk. */
export function musicGain(s: CutsceneScript, t: number, talk = talkWindows(s)): number {
  if (t < 0 || t > s.duration) return 0;
  const fin = Math.min(1, t / FADE_IN);
  const fout = Math.min(1, Math.max(0, (s.duration - t) / FADE_OUT));
  // 1 = speaking now; ramps in and out over DUCK_RAMP
  let duck = 0;
  for (const [a, b] of talk) {
    if (t < a - DUCK_RAMP || t > b + DUCK_RAMP) continue;
    const k = t < a ? 1 - (a - t) / DUCK_RAMP : t > b ? 1 - (t - b) / DUCK_RAMP : 1;
    duck = Math.max(duck, k);
  }
  const level = MUSIC_LEVEL + (MUSIC_DUCKED - MUSIC_LEVEL) * duck;
  const e = (x: number) => x * x * (3 - 2 * x);
  return level * e(fin) * e(fout);
}

export interface CutsceneMusic {
  /** Call every frame (or overlay tick) with the scene time and whether it is playing. */
  update(t: number, playing: boolean): void;
  dispose(): void;
}

/**
 * The player: one looping <audio> per scene, its position kept to the scene
 * time (a seek jumps it), its volume from musicGain. `on()` is read each
 * update (Settings → Sound effects, or the page's own mute).
 */
export function createCutsceneMusic(s: CutsceneScript, url: string, on: () => boolean): CutsceneMusic {
  if (typeof Audio === "undefined") return { update() {}, dispose() {} };
  const au = new Audio(url);
  au.loop = true;
  au.preload = "auto";
  au.volume = 0;
  const talk = talkWindows(s);
  let lastT = -1;
  return {
    update(t, playing) {
      const want = playing && on();
      if (!want) { if (!au.paused) au.pause(); lastT = t; return; }
      const dur = Number.isFinite(au.duration) && au.duration > 0 ? au.duration : 0;
      const target = dur ? t % dur : t;
      // a seek or a replay (or drift past a quarter second): put the music where the scene is
      if (lastT < 0 || Math.abs(t - lastT) > 0.5 || (dur && Math.abs(au.currentTime - target) > 0.25 && Math.abs(au.currentTime - target) < dur - 0.25)) {
        try { au.currentTime = target; } catch { /* not loaded yet */ }
      }
      au.volume = Math.max(0, Math.min(1, musicGain(s, t, talk)));
      if (au.paused) void au.play().catch(() => { /* the browser wants a tap first */ });
      lastT = t;
    },
    dispose() { au.pause(); au.removeAttribute("src"); au.load(); },
  };
}
