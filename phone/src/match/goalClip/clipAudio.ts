/**
 * A GOAL VIDEO'S SOUND ON THE PHONE (expo-audio).
 *
 * The website mixes lib/star/goalClip/audio.ts's plan (planAudio: which file
 * plays when, how loud, how fast) into one track with Web Audio
 * (mixAudio). The phone has no Web Audio, so it plays the SAME plan live,
 * in step with the frames it is drawing:
 *   - each cue starts when the video's clock passes its time, at its gain and
 *     speed (a slow-motion kick or net plays slower and deeper);
 *   - the crowd murmur (the website's pink noise through its 900 Hz band-pass,
 *     rendered once by tools/match-clip-audio.py) loops under it all, its
 *     loudness following the plan's bed line;
 *   - while a commentator talks the pitch dips to DUCK, as on a broadcast.
 * Files: the website's own public/sfx recordings (the default "v1" voice),
 * bundled (goalClip/clipSounds.ts). Not reproduced: the mix's limiter, the
 * commentary box's low cut and presence, Leo's other voices (off by default).
 */
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import { DUCK, type AudioPlan, type Cue } from "@/lib/star/goalClip/audio";
import { commentaryTable } from "@/lib/star/goalClip/commentaryVoice";
import { CLIP_SOUND_FILES, CROWD_BED, BED_SCALE } from "./clipSounds";

const isComm = (s: string) => s.startsWith("cl-") || s.startsWith("cc-");
const pool = new Map<string, AudioPlayer[]>();
function playerFor(sound: string, busy: Set<AudioPlayer>): AudioPlayer | null {
  const file = CLIP_SOUND_FILES[sound];
  if (file === undefined) return null;
  let list = pool.get(sound);
  if (!list) { list = []; pool.set(sound, list); }
  let p = list.find((x) => !busy.has(x));
  if (!p) {
    try { p = createAudioPlayer(file); } catch { return null; }
    list.push(p);
  }
  return p;
}
let bed: AudioPlayer | null = null;
let modeSet = false;

export class ClipSound {
  private next = 0;
  private cues: Cue[];
  private playing = new Set<AudioPlayer>();
  private talk: { from: number; to: number }[];
  private lastT = -1;
  private audible: boolean;
  constructor(private plan: AudioPlan, audible: boolean) {
    this.cues = [...plan.cues].sort((a, b) => a.at - b.at);
    const secs = commentaryTable("v1");
    this.talk = this.cues.filter((c) => isComm(c.sound)).map((c) => ({ from: c.at - 0.08, to: c.at + (secs[c.sound] ?? 1.8) }));
    this.audible = audible;
    if (!modeSet) { modeSet = true; void setAudioModeAsync({ playsInSilentMode: true }).catch(() => {}); }
  }
  /** Loads every file the plan needs, so the first kick is on time. */
  warm() { for (const c of this.cues) { const p = playerFor(c.sound, new Set()); if (p) p.volume = 0; } }
  setAudible(on: boolean) { this.audible = on; if (!on) this.stop(); }
  private duck(t: number) { return this.talk.some((w) => t >= w.from && t <= w.to) ? DUCK : 1; }
  private bedGain(t: number) {
    const b = this.plan.bed;
    if (!b.length) return 0;
    if (t <= b[0].at) return b[0].gain;
    for (let i = 1; i < b.length; i++) {
      if (t <= b[i].at) { const a = b[i - 1], z = b[i]; const k = (t - a.at) / Math.max(1e-6, z.at - a.at); return a.gain + (z.gain - a.gain) * k; }
    }
    return b[b.length - 1].gain;
  }
  /** The video is at `t` seconds: start what is due, follow the murmur. A jump back (the loop) starts over. */
  at(t: number) {
    if (t < this.lastT - 0.05) { this.stop(); this.next = 0; }
    this.lastT = t;
    if (!this.audible) return;
    const duck = this.duck(t);
    while (this.next < this.cues.length && this.cues[this.next].at <= t) {
      const c = this.cues[this.next++];
      if (t - c.at > 0.25) continue; // long past (a seek): skip it
      const p = playerFor(c.sound, this.playing);
      if (!p) continue;
      try {
        p.volume = Math.max(0, Math.min(1, c.gain * (isComm(c.sound) ? 1 : duck)));
        p.setPlaybackRate(c.rate, "low");
        void p.seekTo(0);
        p.play();
        this.playing.add(p);
        setTimeout(() => this.playing.delete(p), 4000);
      } catch { /* a sound never stops the video */ }
    }
    if (this.plan.bed.length) {
      try {
        bed ??= createAudioPlayer(CROWD_BED);
        bed.loop = true;
        bed.volume = Math.max(0, Math.min(1, this.bedGain(t) * duck * BED_SCALE));
        if (!bed.playing) bed.play();
      } catch { /* silent murmur */ }
    }
  }
  stop() {
    for (const p of this.playing) { try { p.pause(); } catch { /* gone */ } }
    this.playing.clear();
    try { bed?.pause(); } catch { /* gone */ }
  }
}
