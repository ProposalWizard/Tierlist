/**
 * MAKING THE VIDEO FILE — a real MP4 (or WebM) built on the phone.
 *
 * Each frame of the edit (edit.ts) is drawn once (render.ts) and handed to the
 * browser's own video encoder (WebCodecs), as fast as the phone can go — not
 * in real time, and not in a drawing loop: frame 1, frame 2, … to the end,
 * then the file. The result is an ordinary video: it plays in the feed, saves
 * to the camera roll and sends in a message like any other.
 *
 * Which file: an MP4 with H.264 when the phone can make one (every iPhone, and
 * Chrome on Android and computers), else a WebM (VP9, then VP8). A browser
 * with no encoder at all gets null, and the post keeps its still picture.
 */
import { ArrayBufferTarget as Mp4Target, Muxer as Mp4Muxer } from "mp4-muxer";
import { ArrayBufferTarget as WebmTarget, Muxer as WebmMuxer } from "webm-muxer";
import { editFrameCount, editDuration, type Edit } from "./edit";
import { drawEditFrame, prepareClipSprites, type ClipCredit } from "./render";

export interface EncodedClip {
  blob: Blob;
  mime: string;
  ext: "mp4" | "webm";
  /** Seconds. */
  duration: number;
  width: number;
  height: number;
  /** True when the sound is inside the file (it plays and saves with it). */
  hasAudio: boolean;
  /** The mixed sound, kept so a file without it can still play it alongside. */
  audio: AudioBuffer | null;
}

interface Choice {
  codec: string;
  container: "mp4" | "webm";
  muxCodec: string;
}

const CHOICES: Choice[] = [
  { codec: "avc1.42E01F", container: "mp4", muxCodec: "avc" },
  { codec: "avc1.4D401F", container: "mp4", muxCodec: "avc" },
  { codec: "avc1.640028", container: "mp4", muxCodec: "avc" },
  { codec: "vp09.00.10.08", container: "webm", muxCodec: "V_VP9" },
  { codec: "vp8", container: "webm", muxCodec: "V_VP8" },
];

/** True when this browser can make a video at all. */
export function canMakeVideo(): boolean {
  return typeof window !== "undefined" && typeof (window as unknown as { VideoEncoder?: unknown }).VideoEncoder === "function"
    && typeof (window as unknown as { VideoFrame?: unknown }).VideoFrame === "function";
}

function bitrateFor(w: number, h: number): number {
  return Math.round(Math.min(4_000_000, Math.max(900_000, w * h * 30 * 0.22)));
}

async function pickCodec(w: number, h: number, fps: number): Promise<Choice | null> {
  for (const c of CHOICES) {
    try {
      const cfg: VideoEncoderConfig = { codec: c.codec, width: w, height: h, bitrate: bitrateFor(w, h), framerate: fps };
      if (c.container === "mp4") (cfg as VideoEncoderConfig & { avc?: { format: "avc" } }).avc = { format: "avc" };
      const r = await VideoEncoder.isConfigSupported(cfg);
      if (r.supported) return c;
    } catch { /* try the next */ }
  }
  return null;
}

interface AudioChoice {
  codec: string;
  /** The muxer's name for it. */
  mux: "aac" | "opus" | "A_OPUS";
}

/** The sound codec for this container, or null (the file is then silent). */
async function pickAudio(container: "mp4" | "webm", sampleRate: number, channels: number): Promise<AudioChoice | null> {
  const AE = (window as unknown as { AudioEncoder?: typeof AudioEncoder }).AudioEncoder;
  if (typeof AE !== "function" || typeof (window as unknown as { AudioData?: unknown }).AudioData !== "function") return null;
  const list: AudioChoice[] = container === "mp4"
    ? [{ codec: "mp4a.40.2", mux: "aac" }, { codec: "opus", mux: "opus" }]
    : [{ codec: "opus", mux: "A_OPUS" }];
  for (const c of list) {
    try {
      const r = await AE.isConfigSupported({ codec: c.codec, sampleRate, numberOfChannels: channels, bitrate: 96_000 });
      if (r.supported) return c;
    } catch { /* try the next */ }
  }
  return null;
}

const supportCache = new Map<string, Promise<boolean>>();

/**
 * Can this browser make a video of this size? Asked once per size and kept.
 * A post shows its play button only when the answer is yes; otherwise it is
 * the plain picture, never a play button that cannot play.
 */
export function videoSupported(w: number, h: number, fps: number): Promise<boolean> {
  if (!canMakeVideo()) return Promise.resolve(false);
  const key = `${w}x${h}@${fps}`;
  let hit = supportCache.get(key);
  if (!hit) {
    hit = pickCodec(w, h, fps).then(c => !!c).catch(() => false);
    supportCache.set(key, hit);
  }
  return hit;
}

const nextTick = () => new Promise<void>(r => setTimeout(r, 0));

/**
 * Make the video for `edit`. `onProgress` gets 0..1. Resolves null when the
 * browser cannot make video; throws only on a real encoder error.
 */
export async function encodeEdit(
  edit: Edit,
  opts: { credit?: ClipCredit; onProgress?: (k: number) => void; signal?: AbortSignal; audio?: AudioBuffer | null } = {},
): Promise<EncodedClip | null> {
  if (!canMakeVideo() || edit.shots.length === 0) return null;
  await prepareClipSprites(edit.moves);
  const { w, h, fps } = edit;
  const choice = await pickCodec(w, h, fps);
  if (!choice) return null;

  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return null;

  const audio = opts.audio ?? null;
  const aChoice = audio ? await pickAudio(choice.container, audio.sampleRate, audio.numberOfChannels) : null;
  const aCfg = audio && aChoice ? { sampleRate: audio.sampleRate, numberOfChannels: audio.numberOfChannels } : null;

  const mp4 = choice.container === "mp4"
    ? new Mp4Muxer({
      target: new Mp4Target(),
      video: { codec: "avc", width: w, height: h, frameRate: fps },
      ...(aCfg ? { audio: { codec: aChoice!.mux as "aac" | "opus", ...aCfg } } : {}),
      fastStart: "in-memory",
      firstTimestampBehavior: "offset",
    })
    : null;
  const webm = choice.container === "webm"
    ? new WebmMuxer({
      target: new WebmTarget(),
      video: { codec: choice.muxCodec, width: w, height: h, frameRate: fps },
      ...(aCfg ? { audio: { codec: "A_OPUS", ...aCfg } } : {}),
      firstTimestampBehavior: "offset",
    })
    : null;
  let failure: unknown = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => {
      if (mp4) mp4.addVideoChunk(chunk, meta);
      else webm?.addVideoChunk(chunk, meta);
    },
    error: (e) => { failure = e; },
  });
  const cfg: VideoEncoderConfig = { codec: choice.codec, width: w, height: h, bitrate: bitrateFor(w, h), framerate: fps, latencyMode: "quality" };
  if (choice.container === "mp4") (cfg as VideoEncoderConfig & { avc?: { format: "avc" } }).avc = { format: "avc" };
  encoder.configure(cfg);

  // The sound, fed in step with the pictures (the muxers interleave them).
  let aEnc: AudioEncoder | null = null;
  let aDone = 0;
  const A_BLOCK = 4800;
  if (audio && aChoice && aCfg) {
    try {
      aEnc = new AudioEncoder({
        output: (chunk, meta) => {
          if (mp4) mp4.addAudioChunk(chunk, meta);
          else webm?.addAudioChunk(chunk, meta);
        },
        error: (e) => { failure = e; },
      });
      aEnc.configure({ codec: aChoice.codec, ...aCfg, bitrate: 96_000 });
    } catch (e) { failure = e; }
  }
  const feedAudio = (untilSec: number) => {
    if (!aEnc || !audio) return;
    const end = Math.min(audio.length, Math.ceil(untilSec * audio.sampleRate));
    while (aDone < end) {
      const k = Math.min(A_BLOCK, audio.length - aDone);
      const data = new Float32Array(k * audio.numberOfChannels);
      for (let ch = 0; ch < audio.numberOfChannels; ch++) data.set(audio.getChannelData(ch).subarray(aDone, aDone + k), ch * k);
      const ad = new AudioData({
        format: "f32-planar", sampleRate: audio.sampleRate, numberOfFrames: k,
        numberOfChannels: audio.numberOfChannels, timestamp: Math.round((aDone / audio.sampleRate) * 1e6), data,
      });
      aEnc.encode(ad);
      ad.close();
      aDone += k;
    }
  };

  const n = editFrameCount(edit);
  const frameUs = 1e6 / fps;
  try {
    for (let i = 0; i < n; i++) {
      if (opts.signal?.aborted) throw new DOMException("aborted", "AbortError");
      if (failure) throw failure;
      feedAudio((i + 1) / fps);
      drawEditFrame(ctx, edit, i / fps, opts.credit);
      const frame = new VideoFrame(canvas, { timestamp: Math.round(i * frameUs), duration: Math.round(frameUs) });
      encoder.encode(frame, { keyFrame: i % (fps * 2) === 0 });
      frame.close();
      // Let the encoder catch up, and the page breathe.
      while (encoder.encodeQueueSize > 4) await new Promise<void>(r => setTimeout(r, 4));
      if (i % 3 === 2) { opts.onProgress?.(i / n); await nextTick(); }
    }
    feedAudio(Infinity);
    await encoder.flush();
    if (aEnc) await aEnc.flush();
    if (failure) throw failure;
  } finally {
    if (encoder.state !== "closed") encoder.close();
    if (aEnc && aEnc.state !== "closed") aEnc.close();
  }
  let buffer: ArrayBuffer;
  if (mp4) { mp4.finalize(); buffer = (mp4.target as Mp4Target).buffer; }
  else { webm!.finalize(); buffer = (webm!.target as WebmTarget).buffer; }
  opts.onProgress?.(1);
  const mime = choice.container === "mp4" ? "video/mp4" : "video/webm";
  return { blob: new Blob([buffer], { type: mime }), mime, ext: choice.container, duration: editDuration(edit), width: w, height: h, hasAudio: !!aEnc, audio };
}

/**
 * Save a finished video: the phone's share menu when it can take a file (on
 * an iPhone that is where "Save Video" lives), else a download. Must be
 * called straight from a tap.
 */
export async function saveVideo(clip: EncodedClip, name: string, text?: string): Promise<"shared" | "downloaded" | "cancelled"> {
  const file = new File([clip.blob], name, { type: clip.mime });
  const nav = typeof navigator !== "undefined" ? navigator : null;
  if (nav && typeof nav.canShare === "function" && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], ...(text ? { text } : {}) });
      return "shared";
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return "cancelled";
      // Fall through to a download.
    }
  }
  const url = URL.createObjectURL(clip.blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return "downloaded";
}
