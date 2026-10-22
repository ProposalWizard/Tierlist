/**
 * THE GOAL-VIDEO WORKER (speed pass, 22 Oct 2026). Makes a goal video away
 * from the page, so the feed never freezes while one is made. The same
 * drawing and the same encoder as the page (render.ts, encode.ts); see
 * workerShim.ts for how they run here. Started by makeVideo.ts.
 */
import "./workerShim";
import { encodeEdit } from "./encode";
import { posterMoment, type Edit } from "./edit";
import { drawEditFrame, prepareClipSprites, type ClipCredit } from "./render";

export interface WorkerJob {
  id: number;
  edit: Edit;
  credit?: ClipCredit;
  settings: Record<string, string>;
  /** The mixed sound, as plain channels (an AudioBuffer cannot be sent). */
  audio: { sampleRate: number; channels: Float32Array[] } | null;
}
export interface PosterJob {
  id: number;
  kind: "poster";
  edit: Edit;
  credit?: ClipCredit;
  settings: Record<string, string>;
}
export type WorkerReply =
  | { id: number; kind: "poster"; bitmap: ImageBitmap }
  | { id: number; kind: "ready"; ok: boolean }
  | { id: number; kind: "progress"; k: number }
  | { id: number; kind: "done"; blob: Blob; mime: string; ext: "mp4" | "webm"; duration: number; width: number; height: number; hasAudio: boolean }
  | { id: number; kind: "none" }
  | { id: number; kind: "error"; message: string };

/* eslint-disable @typescript-eslint/no-explicit-any */
const g = self as any;
const post = (m: WorkerReply) => (self as unknown as Worker).postMessage(m);

/** Looks like an AudioBuffer to encode.ts (it only reads these). */
function asBuffer(a: NonNullable<WorkerJob["audio"]>): AudioBuffer {
  const length = a.channels[0]?.length ?? 0;
  return {
    sampleRate: a.sampleRate, numberOfChannels: a.channels.length, length,
    duration: length / a.sampleRate,
    getChannelData: (ch: number) => a.channels[ch],
  } as unknown as AudioBuffer;
}

let chain: Promise<void> = Promise.resolve();
/** Stills jump the queue: one is a single frame, a video is hundreds. */
let posters: Promise<void> = Promise.resolve();
self.onmessage = (ev: MessageEvent<WorkerJob | PosterJob | { kind: "ping"; moves?: Edit["moves"] }>) => {
  const kind = (ev.data as { kind?: string }).kind;
  if (kind === "ping") {
    // Load the figures now, before any video is asked for.
    void prepareClipSprites((ev.data as { moves?: Edit["moves"] }).moves ?? "new").catch(() => { /* loads with the first job */ });
    post({ id: -1, kind: "ready", ok: typeof g.VideoEncoder === "function" && typeof g.OffscreenCanvas === "function" && typeof g.document !== "undefined" });
    return;
  }
  if (kind === "poster") {
    const job = ev.data as PosterJob;
    posters = posters.then(async () => {
      try {
        g.__setWorkerSettings?.(job.settings);
        await prepareClipSprites(job.edit.moves);
        const c = new OffscreenCanvas(job.edit.w, job.edit.h);
        const ctx = c.getContext("2d");
        if (!ctx) throw new Error("no 2d");
        drawEditFrame(ctx as unknown as CanvasRenderingContext2D, job.edit, 0, job.credit, posterMoment(job.edit));
        const bitmap = c.transferToImageBitmap();
        (self as unknown as Worker).postMessage({ id: job.id, kind: "poster", bitmap } satisfies WorkerReply, [bitmap]);
      } catch (e) {
        post({ id: job.id, kind: "error", message: String((e as Error)?.message ?? e) });
      }
    });
    return;
  }
  const job = ev.data as WorkerJob;
  // A video waits for any still asked for before it.
  chain = Promise.all([chain, posters]).then(async () => {
    try {
      g.__setWorkerSettings?.(job.settings);
      let last = 0;
      const out = await encodeEdit(job.edit, {
        credit: job.credit,
        audio: job.audio ? asBuffer(job.audio) : null,
        onProgress: k => { if (k - last >= 0.04 || k >= 1) { last = k; post({ id: job.id, kind: "progress", k }); } },
      });
      if (!out) { post({ id: job.id, kind: "none" }); return; }
      post({ id: job.id, kind: "done", blob: out.blob, mime: out.mime, ext: out.ext, duration: out.duration, width: out.width, height: out.height, hasAudio: out.hasAudio });
    } catch (e) {
      post({ id: job.id, kind: "error", message: String((e as Error)?.message ?? e) });
    }
  });
};
