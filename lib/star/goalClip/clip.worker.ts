/**
 * THE GOAL-VIDEO WORKER (speed pass, 22 Oct 2026). Makes a goal video away
 * from the page, so the feed never freezes while one is made. The same
 * drawing and the same encoder as the page (render.ts, encode.ts); see
 * workerShim.ts for how they run here. Started by makeVideo.ts.
 */
import "./workerShim";
import { encodeEdit } from "./encode";
import { posterMoment, editDuration, type Edit } from "./edit";
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
/**
 * THE LIVE PLAYER (Leo, 24 Oct 2026: "I don't EVER wanna wait more than a
 * few seconds … for MY GOALS OR TEAM HIGHLIGHTS"). The goal drawn straight
 * onto the post's canvas in real time, from the recording, while its file is
 * still being made (in the other worker). Same drawing as the file.
 */
export interface LiveJob {
  id: number;
  kind: "live";
  canvas: OffscreenCanvas;
  edit: Edit;
  credit?: ClipCredit;
  settings: Record<string, string>;
}
export type WorkerReply =
  | { id: number; kind: "live-first" }
  | { id: number; kind: "live-t"; t: number }
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

const lives = new Map<number, { stop: boolean }>();
async function runLive(job: LiveJob): Promise<void> {
  const me = { stop: false };
  lives.set(job.id, me);
  try {
    g.__setWorkerSettings?.(job.settings);
    await prepareClipSprites(job.edit.moves);
    const ctx = job.canvas.getContext("2d", { alpha: false }) as unknown as CanvasRenderingContext2D | null;
    if (!ctx || me.stop) return;
    const dur = editDuration(job.edit);
    const t0 = performance.now();
    let first = true, lastT = 0;
    const raf: (f: () => void) => void = typeof g.requestAnimationFrame === "function"
      ? (f) => g.requestAnimationFrame(f) : (f) => setTimeout(f, 16);
    await new Promise<void>((done) => {
      const frame = () => {
        if (me.stop) { done(); return; }
        const t = ((performance.now() - t0) / 1000) % dur;
        drawEditFrame(ctx, job.edit, t, job.credit);
        if (first) { first = false; post({ id: job.id, kind: "live-first" }); }
        if (Math.abs(t - lastT) > 0.25) { lastT = t; post({ id: job.id, kind: "live-t", t }); }
        raf(frame);
      };
      frame();
    });
  } catch (e) {
    post({ id: job.id, kind: "error", message: String((e as Error)?.message ?? e) });
  } finally {
    lives.delete(job.id);
  }
}

let chain: Promise<void> = Promise.resolve();
/** Stills jump the queue: one is a single frame, a video is hundreds. */
let posters: Promise<void> = Promise.resolve();
self.onmessage = (ev: MessageEvent<WorkerJob | PosterJob | LiveJob | { kind: "live-stop"; id: number } | { kind: "live-warm"; edit: Edit } | { kind: "ping"; moves?: Edit["moves"] }>) => {
  const kind = (ev.data as { kind?: string }).kind;
  if (kind === "ping") {
    // Load the figures now, before any video is asked for.
    void prepareClipSprites((ev.data as { moves?: Edit["moves"] }).moves ?? "new").catch(() => { /* loads with the first job */ });
    post({ id: -1, kind: "ready", ok: typeof g.VideoEncoder === "function" && typeof g.OffscreenCanvas === "function" && typeof g.document !== "undefined" });
    return;
  }
  if (kind === "live") { void runLive(ev.data as LiveJob); return; }
  if (kind === "live-warm") {
    // One frame drawn off screen: the drawings load and the kits are coloured
    // now, so a tap on this goal shows it at once.
    const job = ev.data as { edit: Edit; credit?: ClipCredit; settings: Record<string, string> };
    void (async () => {
      try {
        g.__setWorkerSettings?.(job.settings);
        await prepareClipSprites(job.edit.moves);
        const c = new OffscreenCanvas(job.edit.w, job.edit.h);
        const ctx = c.getContext("2d") as unknown as CanvasRenderingContext2D | null;
        if (ctx) drawEditFrame(ctx, job.edit, 0.5, job.credit);
      } catch { /* the tap loads them instead */ }
    })();
    return;
  }
  if (kind === "live-stop") { const l = lives.get((ev.data as { id: number }).id); if (l) l.stop = true; return; }
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
