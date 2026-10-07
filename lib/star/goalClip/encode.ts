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

const nextTick = () => new Promise<void>(r => setTimeout(r, 0));

/**
 * Make the video for `edit`. `onProgress` gets 0..1. Resolves null when the
 * browser cannot make video; throws only on a real encoder error.
 */
export async function encodeEdit(
  edit: Edit,
  opts: { credit?: ClipCredit; onProgress?: (k: number) => void; signal?: AbortSignal } = {},
): Promise<EncodedClip | null> {
  if (!canMakeVideo() || edit.shots.length === 0) return null;
  await prepareClipSprites();
  const { w, h, fps } = edit;
  const choice = await pickCodec(w, h, fps);
  if (!choice) return null;

  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return null;

  const mp4 = choice.container === "mp4"
    ? new Mp4Muxer({ target: new Mp4Target(), video: { codec: "avc", width: w, height: h, frameRate: fps }, fastStart: "in-memory", firstTimestampBehavior: "offset" })
    : null;
  const webm = choice.container === "webm"
    ? new WebmMuxer({ target: new WebmTarget(), video: { codec: choice.muxCodec, width: w, height: h, frameRate: fps }, firstTimestampBehavior: "offset" })
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

  const n = editFrameCount(edit);
  const frameUs = 1e6 / fps;
  try {
    for (let i = 0; i < n; i++) {
      if (opts.signal?.aborted) throw new DOMException("aborted", "AbortError");
      if (failure) throw failure;
      drawEditFrame(ctx, edit, i / fps, opts.credit);
      const frame = new VideoFrame(canvas, { timestamp: Math.round(i * frameUs), duration: Math.round(frameUs) });
      encoder.encode(frame, { keyFrame: i % (fps * 2) === 0 });
      frame.close();
      // Let the encoder catch up, and the page breathe.
      while (encoder.encodeQueueSize > 4) await new Promise<void>(r => setTimeout(r, 4));
      if (i % 3 === 2) { opts.onProgress?.(i / n); await nextTick(); }
    }
    await encoder.flush();
    if (failure) throw failure;
  } finally {
    if (encoder.state !== "closed") encoder.close();
  }
  let buffer: ArrayBuffer;
  if (mp4) { mp4.finalize(); buffer = (mp4.target as Mp4Target).buffer; }
  else { webm!.finalize(); buffer = (webm!.target as WebmTarget).buffer; }
  opts.onProgress?.(1);
  const mime = choice.container === "mp4" ? "video/mp4" : "video/webm";
  return { blob: new Blob([buffer], { type: mime }), mime, ext: choice.container, duration: editDuration(edit), width: w, height: h };
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
