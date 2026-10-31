/**
 * The page side of the goal-video bench (scripts/goal-video-bench/render.mjs).
 * Bundled by esbuild and run in headless Chromium: the same drawing code the
 * feed's video worker runs (render.ts), on real recordings and made-up goals.
 */
import { trackFromStored, type GoalTrack } from "@/lib/star/goalClip/track";
import { synthTrack, type SynthGoal } from "@/lib/star/goalClip/synth";
import { makeEdit, editDuration, type ClipStyle } from "@/lib/star/goalClip/edit";
import { drawEditFrame, prepareClipSprites } from "@/lib/star/goalClip/render";

/* eslint-disable @typescript-eslint/no-explicit-any */
const w = window as any;
let canvas: HTMLCanvasElement | null = null;
let current: ReturnType<typeof makeEdit> | null = null;
let credit: { handle?: string; name?: string } | undefined;

w.benchSetup = async (job: { stored?: unknown[]; synth?: SynthGoal[]; style: ClipStyle; variant: number; opts?: any; handle?: string }) => {
  const tracks: GoalTrack[] = [];
  for (const s of job.stored ?? []) { const t = trackFromStored(s); if (t) tracks.push(t); }
  for (const g of job.synth ?? []) { const t = synthTrack(g); if (t) tracks.push(t); }
  tracks.sort((a, b) => a.meta.minute - b.meta.minute);
  await prepareClipSprites("new");
  current = (makeEdit as any)(tracks, job.style, "new", job.variant, job.opts);
  credit = job.handle ? { handle: job.handle } : undefined;
  canvas = document.createElement("canvas");
  canvas.width = current!.w; canvas.height = current!.h;
  document.body.appendChild(canvas);
  // A cold edit's beat (switch part "coldEdits"): render.mjs lays it under the video.
  const music = current!.music ? { url: current!.music.url, at: current!.music.at, offset: current!.music.offset } : undefined;
  return { w: current!.w, h: current!.h, duration: editDuration(current!), fps: current!.fps, shots: current!.shots.length, music };
};

w.benchFrame = (t: number) => {
  if (!canvas || !current) return null;
  const ctx = canvas.getContext("2d")!;
  drawEditFrame(ctx, current, t, credit);
  return canvas.toDataURL("image/jpeg", 0.88);
};
