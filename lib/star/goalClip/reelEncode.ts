/**
 * YOUR SEASON IN ONE VIDEO — the file. The same way encode.ts makes a goal
 * video (WebCodecs + mp4-muxer / webm-muxer, frame by frame, as fast as the
 * phone can go), but each frame is the reel's own drawing (reelRender.ts),
 * not one goal's edit. Kept in its own file so the goal videos' encoder can
 * change (moving into a worker) without touching the reel.
 *
 * Gives encode.ts's EncodedClip, so saveVideo (the share menu / a download)
 * works on it unchanged. Resolves null when this browser cannot make video.
 */
import { ArrayBufferTarget as Mp4Target, Muxer as Mp4Muxer } from "mp4-muxer";
import { ArrayBufferTarget as WebmTarget, Muxer as WebmMuxer } from "webm-muxer";
import { canMakeVideo, type EncodedClip } from "./encode";
import { prepareClipSprites } from "./render";
import { drawReelFrame, type ReelAssets } from "./reelRender";
import type { ReelPlan } from "./reel";

/** The saved reel: tall, like a phone video (Reels / TikTok / Shorts). */
export const REEL_W = 360;
export const REEL_H = 640;
export const REEL_FPS = 30;

const VIDEO = [
  { codec: "avc1.42E01F", container: "mp4" as const, mux: "avc" },
  { codec: "avc1.4D401F", container: "mp4" as const, mux: "avc" },
  { codec: "avc1.640028", container: "mp4" as const, mux: "avc" },
  { codec: "vp09.00.10.08", container: "webm" as const, mux: "V_VP9" },
  { codec: "vp8", container: "webm" as const, mux: "V_VP8" },
];
const BITRATE = 1_200_000;

async function pickVideo(w: number, h: number, fps: number) {
  for (const c of VIDEO) {
    try {
      const cfg: VideoEncoderConfig = { codec: c.codec, width: w, height: h, bitrate: BITRATE, framerate: fps };
      if (c.container === "mp4") (cfg as VideoEncoderConfig & { avc?: { format: "avc" } }).avc = { format: "avc" };
      if ((await VideoEncoder.isConfigSupported(cfg)).supported) return c;
    } catch { /* next */ }
  }
  return null;
}

async function pickAudio(container: "mp4" | "webm", sampleRate: number, channels: number) {
  const AE = (window as unknown as { AudioEncoder?: typeof AudioEncoder }).AudioEncoder;
  if (typeof AE !== "function" || typeof (window as unknown as { AudioData?: unknown }).AudioData !== "function") return null;
  const list = container === "mp4" ? [{ codec: "mp4a.40.2", mux: "aac" }, { codec: "opus", mux: "opus" }] : [{ codec: "opus", mux: "A_OPUS" }];
  for (const c of list) {
    try {
      if ((await AE.isConfigSupported({ codec: c.codec, sampleRate, numberOfChannels: channels, bitrate: 128_000 })).supported) return c;
    } catch { /* next */ }
  }
  return null;
}

/** "Season-2026-27-Arsenal.mp4". */
export function reelFileName(plan: ReelPlan, ext: string): string {
  const clean = (s: string) => s.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `Season-${clean(plan.seasonLabel)}-${clean(plan.club)}.${ext}`;
}

/** Make the reel's video file. `onProgress` gets 0..1. */
export async function encodeReel(
  plan: ReelPlan, assets: ReelAssets,
  opts: { audio?: AudioBuffer | null; onProgress?: (k: number) => void; signal?: AbortSignal } = {},
): Promise<EncodedClip | null> {
  if (!canMakeVideo()) return null;
  await prepareClipSprites(assets.moves).catch(() => undefined);
  const w = REEL_W, h = REEL_H, fps = REEL_FPS;
  const v = await pickVideo(w, h, fps);
  if (!v) return null;
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return null;

  const audio = opts.audio ?? null;
  const a = audio ? await pickAudio(v.container, audio.sampleRate, audio.numberOfChannels) : null;
  const aCfg = audio && a ? { sampleRate: audio.sampleRate, numberOfChannels: audio.numberOfChannels } : null;
  const mp4 = v.container === "mp4"
    ? new Mp4Muxer({
      target: new Mp4Target(),
      video: { codec: "avc", width: w, height: h, frameRate: fps },
      ...(aCfg ? { audio: { codec: a!.mux as "aac" | "opus", ...aCfg } } : {}),
      fastStart: "in-memory",
      firstTimestampBehavior: "offset",
    })
    : null;
  const webm = v.container === "webm"
    ? new WebmMuxer({
      target: new WebmTarget(),
      video: { codec: v.mux, width: w, height: h, frameRate: fps },
      ...(aCfg ? { audio: { codec: "A_OPUS", ...aCfg } } : {}),
      firstTimestampBehavior: "offset",
    })
    : null;
  let failure: unknown = null;
  const enc = new VideoEncoder({
    output: (chunk, meta) => { if (mp4) mp4.addVideoChunk(chunk, meta); else webm?.addVideoChunk(chunk, meta); },
    error: (e) => { failure = e; },
  });
  const cfg: VideoEncoderConfig = { codec: v.codec, width: w, height: h, bitrate: BITRATE, framerate: fps, latencyMode: "quality" };
  if (v.container === "mp4") (cfg as VideoEncoderConfig & { avc?: { format: "avc" } }).avc = { format: "avc" };
  enc.configure(cfg);

  let aEnc: AudioEncoder | null = null;
  let aDone = 0;
  if (audio && a && aCfg) {
    try {
      aEnc = new AudioEncoder({
        output: (chunk, meta) => { if (mp4) mp4.addAudioChunk(chunk, meta); else webm?.addAudioChunk(chunk, meta); },
        error: (e) => { failure = e; },
      });
      aEnc.configure({ codec: a.codec, ...aCfg, bitrate: 128_000 });
    } catch (e) { failure = e; }
  }
  const feedAudio = (untilSec: number) => {
    if (!aEnc || !audio) return;
    const end = Math.min(audio.length, Math.ceil(untilSec * audio.sampleRate));
    while (aDone < end) {
      const k = Math.min(4800, audio.length - aDone);
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

  const n = Math.max(1, Math.round(plan.duration * fps));
  const frameUs = 1e6 / fps;
  try {
    for (let i = 0; i < n; i++) {
      if (opts.signal?.aborted) throw new DOMException("aborted", "AbortError");
      if (failure) throw failure;
      feedAudio((i + 1) / fps);
      drawReelFrame(ctx, w, h, plan, i / fps, assets);
      const frame = new VideoFrame(canvas, { timestamp: Math.round(i * frameUs), duration: Math.round(frameUs) });
      enc.encode(frame, { keyFrame: i % (fps * 2) === 0 });
      frame.close();
      while (enc.encodeQueueSize > 4) await new Promise<void>((r) => setTimeout(r, 4));
      if (i % 4 === 3) { opts.onProgress?.(i / n); await new Promise<void>((r) => setTimeout(r, 0)); }
    }
    feedAudio(Infinity);
    await enc.flush();
    if (aEnc) await aEnc.flush();
    if (failure) throw failure;
  } finally {
    if (enc.state !== "closed") enc.close();
    if (aEnc && aEnc.state !== "closed") aEnc.close();
  }
  let buffer: ArrayBuffer;
  if (mp4) { mp4.finalize(); buffer = (mp4.target as Mp4Target).buffer; }
  else { webm!.finalize(); buffer = (webm!.target as WebmTarget).buffer; }
  opts.onProgress?.(1);
  const mime = v.container === "mp4" ? "video/mp4" : "video/webm";
  return { blob: new Blob([buffer], { type: mime }), mime, ext: v.container, duration: plan.duration, width: w, height: h, hasAudio: !!aEnc, audio };
}
