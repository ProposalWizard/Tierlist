/**
 * WHICH FILE A CUT SCENE'S SOUND CUE PLAYS. The beats (beats.ts) ask for cues by name; until
 * 20 Nov 2026 only the recorded voice line played and the rest were dropped
 * (docs/research/people-cutscenes-review-2026-11-20.md §7). Each cue now names a sound in
 * public/sfx (the Sound Board can replace any of them; sfx.ts sfxUrl):
 *   pen-scratch, camera-shutters  made for the cut scenes (scripts/sfx/cutscene_cues.py)
 *   kick, net, crowd-roar, crowd-murmur, applause, fans-chant, crowd-gasp  the match's own sounds
 * A voice line plays its recording (voiceLines.ts). A cue with no sound returns null.
 */
import { VOICE_LINES } from "./voiceLines";

export const CUTSCENE_SOUNDS: Record<string, string> = {
  "pen-scratch": "cut-pen-scratch",
  "camera-shutters": "cut-camera-shutters",
  kick: "kick-hard",
  net: "goal-net",
  "crowd-roar": "crowd-cheer-stadium",
  "crowd-murmur": "match-crowd",
  // three more the generator asks for (story beats): the nearest of the match's sounds
  applause: "crowd-cheer-small",
  "fans-chant": "match-crowd",
  "crowd-gasp": "crowd-groan",
};

/** The sound name (public/sfx/<name>.mp3) a cue plays, or null. */
export function cutsceneSoundFor(cue: string): string | null {
  if (VOICE_LINES[cue]) return `cut-${cue}`;
  return CUTSCENE_SOUNDS[cue] ?? null;
}
