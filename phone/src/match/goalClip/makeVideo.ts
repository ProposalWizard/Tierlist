/**
 * "SAVE VIDEO" ON THE PHONE: a goal video made into an MP4 file —
 * lib/star/goalClip/encode.ts encodeEdit (read-only), on the phone's own
 * encoder (modules/goal-video-encoder, Android MediaCodec).
 *
 * Same as the website's file:
 *   - every frame of the edit (lib/star/goalClip/edit.ts), drawn once by the
 *     same drawer the phone plays with (match/goalClip/render.ts), at the
 *     edit's own size (640x360 wide, 360x640 tall) and 30 a second, frame 1,
 *     frame 2 … to the end, as fast as the phone can go;
 *   - H.264, Baseline first, the website's bit rate (bitrateFor), a key frame
 *     every 2 s; the sound mixed from the same plan (planAudio) and files,
 *     the website's mix (clipMix.ts), inside the file as AAC 96 kb/s, 48 kHz
 *     stereo, fed in step with the pictures;
 *   - named clipFileName (Goal-Saka-63-Arsenal-v-Chelsea-broadcast.mp4).
 * Different: a phone without the encoder (iPhone for now, Expo Go) gets null.
 */
import { Asset } from "expo-asset";
import { Skia } from "@shopify/react-native-skia";
import { editFrameCount, editDuration, clipFileName, type Edit } from "@/lib/star/goalClip/edit";
import { planAudio, MIX_RATE, MIX_CHANNELS } from "@/lib/star/goalClip/audio";
import { GoalVideoEncoder } from "../../../modules/goal-video-encoder";
import { phoneFontFor } from "../../draw/useDrawing";
import { loadSpriteSheet } from "../spriteAssets";
import { prepareClipSprites, type ClipCredit } from "./render";
import { videoFrameReader, type FrameReader } from "./videoFrames";
import { CLIP_SOUND_FILES } from "./clipSounds";
import { mixPlan, pcmFromBytes, toPcm16, type Pcm } from "./clipMix";

export interface MadeVideo { uri: string; bytes: number; name: string; seconds: number; makeMs: number; hasAudio: boolean }

/** True when this phone can make a video file at all. */
export function canMakeVideo(): boolean {
  try { return !!GoalVideoEncoder && GoalVideoEncoder.isAvailable(); } catch { return false; }
}

/** encode.ts bitrateFor: the website's bit rate for this size. */
function bitrateFor(w: number, h: number): number {
  return Math.round(Math.min(4_000_000, Math.max(900_000, w * h * 30 * 0.22)));
}

/** Each sound file decoded once a session. */
const decoded = new Map<string, Promise<Pcm | null>>();
function pcmFor(sound: string): Promise<Pcm | null> {
  let hit = decoded.get(sound);
  if (!hit) {
    hit = (async () => {
      const mod = CLIP_SOUND_FILES[sound];
      if (mod === undefined || !GoalVideoEncoder) return null;
      const a = Asset.fromModule(mod);
      await a.downloadAsync();
      return pcmFromBytes(await GoalVideoEncoder.decodeAudio(a.localUri ?? a.uri));
    })().catch(() => null);
    decoded.set(sound, hit);
  }
  return hit;
}

/** audio.ts mixAudio on the phone: the plan's files, decoded, mixed by clipMix.ts. */
async function mixFor(edit: Edit): Promise<Int16Array | null> {
  const plan = planAudio(edit);
  const names = Array.from(new Set(plan.cues.map((c) => c.sound)));
  const files = new Map<string, Pcm>();
  await Promise.all(names.map(async (n) => { const p = await pcmFor(n); if (p) files.set(n, p); }));
  const mix = mixPlan(plan, files, MIX_RATE);
  return mix ? toPcm16(mix) : null;
}

const breathe = () => new Promise<void>((r) => setTimeout(r, 0));

/**
 * Make the MP4 for `edit`. `onProgress` gets 0..1. Null when this phone has
 * no encoder. Throws on an encoder error or when `signal` is aborted.
 */
export async function makeGoalVideo(edit: Edit, opts: { credit?: ClipCredit; onProgress?: (k: number) => void; signal?: { aborted: boolean } } = {}): Promise<MadeVideo | null> {
  const enc = GoalVideoEncoder;
  if (!enc || !canMakeVideo() || edit.shots.length === 0) return null;
  const t0 = Date.now();
  await loadSpriteSheet();
  await prepareClipSprites(edit.moves);
  const { w, h, fps } = edit;
  let pcm: Int16Array | null = null;
  try { pcm = await mixFor(edit); } catch { pcm = null; } // a sound that will not mix: a silent file, as on the website
  opts.onProgress?.(0.02);
  const name = clipFileName(edit.tracks, "mp4", edit.style);
  enc.start(name, w, h, fps, bitrateFor(w, h), MIX_RATE, MIX_CHANNELS, pcm ?? new Int16Array(0));
  let frames: FrameReader | null = null;
  try {
    frames = videoFrameReader(Skia, w, h, phoneFontFor);
    const n = editFrameCount(edit);
    for (let i = 0; i < n; i++) {
      if (opts.signal?.aborted) throw new Error("cancelled");
      enc.addFrame(frames.read(edit, i / fps, opts.credit));
      opts.onProgress?.(0.02 + 0.96 * ((i + 1) / n));
      await breathe();
    }
    const out = await enc.finish();
    opts.onProgress?.(1);
    return { uri: out.uri, bytes: out.bytes, name, seconds: editDuration(edit), makeMs: Date.now() - t0, hasAudio: !!pcm };
  } catch (e) {
    try { enc.cancel(); } catch { /* gone */ }
    throw e;
  } finally {
    frames?.dispose();
  }
}
