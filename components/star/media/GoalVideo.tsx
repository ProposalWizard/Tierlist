"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { GoalTrack } from "@/lib/star/goalClip/track";
import { getClips } from "@/lib/star/goalClip/store";
import { makeEdit, editDuration, posterMoment, clipFileName, type ClipStyle } from "@/lib/star/goalClip/edit";
import { drawEditFrame, type ClipCredit } from "@/lib/star/goalClip/render";
import { encodeEdit, saveVideo, canMakeVideo, type EncodedClip } from "@/lib/star/goalClip/encode";
import { loadSprites } from "@/lib/star/sprites";

/**
 * A REAL GOAL VIDEO IN A POST (Leo, 7 Oct 2026: "it makes it look like theres
 * videos but you cant play them").
 *
 * Shows a still of the goal from this post's camera with a play button; one
 * tap makes the video on the phone (lib/star/goalClip/encode.ts — a few
 * seconds, with a progress ring) and plays it, looping, like a feed does.
 * Save puts the file in the phone's share menu (Save Video on an iPhone) or
 * downloads it.
 *
 * It is drawn from the goal's recording, so every play — and every save — is
 * the same goal, frame for frame. A post whose recording is not on this
 * device shows `fallback` instead: a picture, never a fake play button.
 */

/** Videos made this session, so scrolling back does not make one twice. */
const made = new Map<string, EncodedClip>();

function mmss(s: number): string {
  const t = Math.max(0, Math.round(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
}

export interface GoalVideoProps {
  clipIds: string[];
  style: ClipStyle;
  credit?: ClipCredit;
  /** Read out and used as the share text. */
  title: string;
  /** A small label on the still ("GOAL", "HIGHLIGHTS"). */
  badge?: string;
  /** Drawn when this device has none of the recordings. */
  fallback: React.ReactNode;
  /** Start making (and playing) the video as soon as it is on screen. */
  autoStart?: boolean;
}

type Status = "idle" | "making" | "ready" | "unsupported" | "failed";

export default function GoalVideo({ clipIds, style, credit, title, badge, fallback, autoStart = false }: GoalVideoProps) {
  const [tracks, setTracks] = useState<GoalTrack[] | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState(0);
  const [url, setUrl] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const saveAsked = useRef(false);
  const key = `${style}|${clipIds.join(",")}|${credit?.handle ?? ""}`;

  useEffect(() => {
    let live = true;
    getClips(clipIds).then(t => { if (live) setTracks(t); }).catch(() => { if (live) setTracks([]); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clipIds.join(",")]);

  const edit = useMemo(() => (tracks && tracks.length ? makeEdit(tracks, style) : null), [tracks, style]);

  // A video made earlier this session is ready straight away.
  useEffect(() => {
    const hit = made.get(key);
    if (!hit) return;
    const u = URL.createObjectURL(hit.blob);
    setUrl(u);
    setStatus("ready");
    return () => URL.revokeObjectURL(u);
  }, [key]);

  // The still: one frame, drawn once the figures have loaded.
  useEffect(() => {
    if (!edit || status === "ready") return;
    let live = true;
    loadSprites().finally(() => {
      const c = canvasRef.current;
      if (!live || !c) return;
      const ctx = c.getContext("2d");
      if (ctx) drawEditFrame(ctx, edit, 0, credit, posterMoment(edit));
    });
    return () => { live = false; };
  }, [edit, status, credit]);

  const start = async () => {
    if (!edit || status === "making" || status === "ready") return;
    if (!canMakeVideo()) { setStatus("unsupported"); return; }
    setStatus("making");
    setProgress(0);
    try {
      const out = await encodeEdit(edit, { credit, onProgress: setProgress });
      if (!out) { setStatus("unsupported"); return; }
      made.set(key, out);
      setUrl(URL.createObjectURL(out.blob));
      setStatus("ready");
      // Saving needs a fresh tap once the file exists (a phone's share menu
      // only opens straight from a tap).
      if (saveAsked.current) { saveAsked.current = false; setNote("Ready — tap Save video."); }
    } catch {
      setStatus("failed");
    }
  };

  useEffect(() => {
    if (autoStart && edit && status === "idle") void start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, edit]);

  useEffect(() => {
    if (status === "ready") videoRef.current?.play().catch(() => { /* a muted video normally plays; if not, the tap does */ });
  }, [status, url]);

  if (tracks === null) {
    return <div className="aspect-video w-full animate-pulse rounded-xl border border-white/10 bg-white/5" />;
  }
  if (!edit) return <>{fallback}</>;

  const tall = style === "fan";
  const dur = editDuration(edit);
  const save = async () => {
    const clip = made.get(key);
    if (!clip) { saveAsked.current = true; setNote("Making the video first…"); void start(); return; }
    const r = await saveVideo(clip, clipFileName(edit.tracks[0], clip.ext), title);
    setNote(r === "shared" ? "Sent to your share menu." : r === "downloaded" ? "Saved to your downloads." : null);
  };

  return (
    <div className={tall ? "w-[64%] max-w-[260px]" : "w-full"} data-goal-video data-clip-style={style}>
      <div
        className="relative overflow-hidden rounded-xl border border-white/15 bg-black"
        style={{ aspectRatio: `${edit.w} / ${edit.h}` }}
      >
        {status === "ready" && url ? (
          <video
            ref={videoRef}
            src={url}
            className="block h-full w-full"
            playsInline
            muted
            loop
            autoPlay
            onClick={() => { const v = videoRef.current; if (v) { if (v.paused) void v.play(); else v.pause(); } }}
            data-goal-video-playing
          />
        ) : (
          <>
            <canvas ref={canvasRef} width={edit.w} height={edit.h} className="block h-full w-full" />
            {badge && (
              <div className="absolute left-2 top-2 rounded bg-red-600 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-white">
                {badge}
              </div>
            )}
            <button
              onClick={start}
              disabled={status === "making"}
              className="absolute inset-0 grid place-items-center"
              aria-label={status === "making" ? "Making the video" : "Play the goal"}
              data-goal-video-play
            >
              {status === "making" ? (
                <div className="grid place-items-center rounded-full bg-black/55 p-2">
                  <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden>
                    <circle cx="22" cy="22" r="18" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="4" />
                    <circle
                      cx="22" cy="22" r="18" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round"
                      strokeDasharray={`${Math.max(2, progress * 113)} 113`} transform="rotate(-90 22 22)"
                    />
                  </svg>
                  <div className="mt-0.5 text-[10px] font-black uppercase tracking-wider text-white">{Math.round(progress * 100)}%</div>
                </div>
              ) : (
                <div className="grid h-12 w-12 place-items-center rounded-full bg-black/45 ring-2 ring-white/80 backdrop-blur-sm">
                  <div className="ml-1 h-0 w-0 border-y-[9px] border-l-[14px] border-y-transparent border-l-white" />
                </div>
              )}
            </button>
          </>
        )}
        <div className="pointer-events-none absolute bottom-1.5 right-2 rounded bg-black/60 px-1 text-[10px] font-bold tabular-nums text-white">
          {mmss(dur)}
        </div>
      </div>
      <div className="mt-1.5 flex items-center gap-3 text-[12px] font-bold text-white/80">
        <button onClick={save} className="flex items-center gap-1 hover:text-white" data-goal-video-save>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" />
          </svg>
          Save video
        </button>
        {status === "unsupported" && <span className="text-amber-200">This browser can&apos;t make videos.</span>}
        {status === "failed" && <span className="text-amber-200">The video could not be made.</span>}
        {note && status !== "unsupported" && status !== "failed" && <span className="text-emerald-300">{note}</span>}
      </div>
    </div>
  );
}
