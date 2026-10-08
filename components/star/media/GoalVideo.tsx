"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { GoalTrack } from "@/lib/star/goalClip/track";
import { getClips } from "@/lib/star/goalClip/store";
import { makeEdit, editDuration, posterMoment, clipFileName, type ClipStyle } from "@/lib/star/goalClip/edit";
import { drawEditFrame, prepareClipSprites, type ClipCredit } from "@/lib/star/goalClip/render";
import { encodeEdit, saveVideo, videoSupported, type EncodedClip } from "@/lib/star/goalClip/encode";
import { useAnimationsLook } from "@/lib/star/animLook";
import { synthTrack, type SynthGoal } from "@/lib/star/goalClip/synth";
import { planAudio, mixAudio } from "@/lib/star/goalClip/audio";
import { useClipSound, setClipSoundOn } from "@/lib/star/goalClip/sound";
import { audioContext } from "@/lib/star/audioOut";

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
 * Sound (Leo, 8 Oct 2026): crowd, kick, net and a commentator line, mixed on
 * the phone (lib/star/goalClip/audio.ts) and put inside the file when the
 * browser can, so a saved video has it too. A browser that can make the
 * pictures but not the sound plays the same mix alongside the video. The
 * speaker button mutes every goal video and is remembered on this device.
 *
 * It is drawn from the goal's recording, so every play — and every save — is
 * the same goal, frame for frame. A post whose recording is not on this
 * device shows `fallback` instead: a picture, never a fake play button.
 */

/** Videos made this session, with their playable link, so scrolling back (or
 *  a second post of the same goals) never makes one twice. */
const made = new Map<string, { clip: EncodedClip; url: string }>();
/** Videos being made right now: a second post of the same goals waits for it. */
const making = new Map<string, Promise<EncodedClip | null>>();
/**
 * Videos are made in the background, ONE AT A TIME, as soon as a post comes
 * near the screen (Leo, 8 Oct 2026: "ideally you shouldnt even have to
 * download it to play it in social media, it should just naturally do that
 * and quickly"). By the time you scroll to it, it is usually made and plays
 * by itself, like a real feed. One at a time so a long feed never makes ten
 * at once and slows the phone.
 */
// Your own match's videos go first, always (Leo, 8 Oct 2026: "I never want to
// have to wait for my highlights to load because the highlights of some
// random games are being loaded first"). A priority job jumps every waiting
// ordinary one; ordinary jobs only start when no priority job is waiting.
// Priority 2 = the match highlights and your goals; 1 = other posts of your
// match (recorded goals); 0 = everything else.
type QueuedJob = { run: () => Promise<unknown>; priority: number };
const waiting: QueuedJob[] = [];
let busy = false;
function pump(): void {
  if (busy || !waiting.length) return;
  let i = 0;
  for (let k = 1; k < waiting.length; k++) if (waiting[k].priority > waiting[i].priority) i = k;
  const next = waiting.splice(i, 1)[0];
  busy = true;
  next.run().finally(() => { busy = false; pump(); });
}
function inTurn<T>(job: () => Promise<T>, priority = 0): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    waiting.push({ priority, run: () => job().then(resolve, reject) });
    pump();
  });
}

/** Every goal video on screen. One plays at a time, like a feed. */
const onScreen = new Set<HTMLVideoElement>();

function keep(key: string, clip: EncodedClip): { clip: EncodedClip; url: string } {
  const hit = made.get(key);
  if (hit) return hit;
  const entry = { clip, url: URL.createObjectURL(clip.blob) };
  made.set(key, entry);
  return entry;
}

/**
 * Plays a mix next to a video whose file has no sound, kept in step with it
 * (it restarts from the video's time on play, a seek or the loop). Only one
 * runs at a time, like the videos.
 */
let side: { video: HTMLVideoElement; src: AudioBufferSourceNode; gain: GainNode; startedAt: number; offset: number } | null = null;

function stopSide(video?: HTMLVideoElement): void {
  if (!side || (video && side.video !== video)) return;
  try { side.src.stop(); } catch { /* already stopped */ }
  side = null;
}

function syncSide(video: HTMLVideoElement, buffer: AudioBuffer, audible: boolean): void {
  const c = audioContext();
  if (!c) return;
  if (video.paused) { stopSide(video); return; }
  const want = video.currentTime % Math.max(0.001, buffer.duration);
  if (side && side.video === video) {
    side.gain.gain.value = audible ? 1 : 0;
    const at = side.offset + (c.currentTime - side.startedAt);
    if (Math.abs(at - want) < 0.25) return;
  }
  stopSide();
  if (c.state === "suspended") c.resume().catch(() => { /* needs a tap */ });
  const src = c.createBufferSource();
  src.buffer = buffer;
  const gain = c.createGain();
  gain.gain.value = audible ? 1 : 0;
  src.connect(gain); gain.connect(c.destination);
  src.start(0, want);
  side = { video, src, gain, startedAt: c.currentTime, offset: want };
}

function mmss(s: number): string {
  const t = Math.max(0, Math.round(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
}

export interface GoalVideoProps {
  clipIds: string[];
  /** Goals from a match you did not play: made on the phone (goalClip/synth.ts). */
  synth?: SynthGoal[];
  style: ClipStyle;
  /** Which of the poster's cuts (edit.ts makeEdit). */
  variant?: number;
  credit?: ClipCredit;
  /** Read out and used as the share text. */
  title: string;
  /** A small label on the still ("GOAL", "HIGHLIGHTS"). */
  badge?: string;
  /** Drawn when this device has none of the recordings. */
  fallback: React.ReactNode;
  /** Start making (and playing) the video as soon as it is on screen. */
  autoStart?: boolean;
  /** Your own match: made at once, ahead of any other match's videos. */
  /** 2 = highlights / your goals, 1 = your match, 0 = the rest. */
  priority?: number;
}

type Status = "idle" | "making" | "ready" | "unsupported" | "failed";

export default function GoalVideo({ clipIds, synth, style, variant = 0, credit, title, badge, fallback, autoStart = false, priority = 0 }: GoalVideoProps) {
  const [tracks, setTracks] = useState<GoalTrack[] | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState(0);
  const [url, setUrl] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const saveAsked = useRef(false);
  const soundOn = useClipSound();
  // The browser refused to start this video with sound (no tap yet): it plays
  // muted, and the speaker shows muted until it is tapped.
  const [blocked, setBlocked] = useState(false);
  const audible = soundOn && !blocked;
  // Near the screen (start making it) and on it (play it).
  const wrapRef = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [onView, setOnView] = useState(false);
  // Tapped: show how far it has got, and play it the moment it is made.
  const [wanted, setWanted] = useState(false);
  // The men's moves follow Settings → Look → Animations, like the match.
  const moves = useAnimationsLook();
  const synthKey = (synth ?? []).map(g => g.seed).join(",");
  const key = `${style}|${variant}|${moves}|${clipIds.join(",")}|${synthKey}|${credit?.handle ?? ""}`;

  useEffect(() => {
    let live = true;
    const madeTracks = (synth ?? []).map(synthTrack).filter((t): t is GoalTrack => !!t);
    if (!clipIds.length) {
      setTracks(madeTracks);
      return () => { live = false; };
    }
    // Recorded goals and made ones together, in the order they were scored.
    const merge = (rec: GoalTrack[]) => [...rec, ...madeTracks].sort((a, b) => a.meta.minute - b.meta.minute);
    getClips(clipIds).then(t => { if (live) setTracks(merge(t)); }).catch(() => { if (live) setTracks(merge([])); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clipIds.join(","), synthKey]);

  const edit = useMemo(() => (tracks && tracks.length ? makeEdit(tracks, style, moves, variant) : null), [tracks, style, moves, variant]);

  // Can this browser make the video at all? If not, the post is its plain
  // picture (`fallback`): no play button that cannot play.
  const [canPlay, setCanPlay] = useState<boolean | null>(null);
  useEffect(() => {
    if (!edit) return;
    let live = true;
    videoSupported(edit.w, edit.h, edit.fps).then(ok => { if (live) setCanPlay(ok); });
    return () => { live = false; };
  }, [edit]);

  // A video made earlier this session is ready straight away. Its link lives
  // as long as the cache does (the session), so it is never revoked here.
  useEffect(() => {
    const hit = made.get(key);
    if (!hit) return;
    setUrl(hit.url);
    setStatus("ready");
  }, [key]);

  // The still: one frame, drawn once the figures have loaded.
  useEffect(() => {
    if (!edit || status === "ready") return;
    let live = true;
    prepareClipSprites(edit.moves).finally(() => {
      const c = canvasRef.current;
      if (!live || !c) return;
      const ctx = c.getContext("2d");
      if (ctx) drawEditFrame(ctx, edit, 0, credit, posterMoment(edit));
    });
    return () => { live = false; };
  }, [edit, status, credit]);

  const start = async (quiet = false) => {
    if (!quiet) setWanted(true);
    if (!edit || status === "making" || status === "ready") return;
    if (canPlay === false) { setStatus("unsupported"); return; }
    // Made already for another post of the same goals: no second wait.
    const hit = made.get(key);
    if (hit) { setUrl(hit.url); setStatus("ready"); return; }
    setStatus("making");
    setProgress(0);
    try {
      let job = making.get(key);
      if (!job) {
        const e = edit;
        const make = () => mixAudio(planAudio(e))
          .catch(() => null)
          .then(audio => encodeEdit(e, { credit, onProgress: setProgress, audio }));
        // A tap skips the queue; a post merely near the screen waits its turn.
        job = quiet ? inTurn(make, priority) : make();
        making.set(key, job);
        job.then(() => making.delete(key), () => making.delete(key));
      }
      const out = await job;
      if (!out) { setStatus("unsupported"); return; }
      setUrl(keep(key, out).url);
      setStatus("ready");
      // Saving needs a fresh tap once the file exists (a phone's share menu
      // only opens straight from a tap).
      if (saveAsked.current) { saveAsked.current = false; setNote("Ready — tap Save video."); }
    } catch {
      setStatus("failed");
    }
  };

  useEffect(() => {
    if (autoStart && edit && canPlay && status === "idle") void start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, edit, canPlay]);

  // Watch where the post is: within a screen or so → make it; mostly on
  // screen → play it; off screen → pause it.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof IntersectionObserver === "undefined") { setNear(true); setOnView(true); return; }
    const nearObs = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) setNear(true); }, { rootMargin: "700px 0px" });
    const viewObs = new IntersectionObserver(es => { for (const e of es) setOnView(e.intersectionRatio >= 0.55); }, { threshold: [0, 0.55, 1] });
    nearObs.observe(el);
    viewObs.observe(el);
    return () => { nearObs.disconnect(); viewObs.disconnect(); };
  }, [edit, canPlay]);

  useEffect(() => {
    // Your own match's videos start straight away, near the screen or not.
    if ((near || priority > 0) && edit && canPlay && status === "idle") void start(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [near, priority, edit, canPlay, status]);

  const clip = made.get(key)?.clip ?? null;

  useEffect(() => {
    const v = videoRef.current;
    if (status !== "ready" || !v) return;
    // Plays while it is on screen (or was tapped); pauses when scrolled away.
    if (!(onView || wanted || autoStart)) { if (!v.paused) v.pause(); return; }
    v.muted = !(clip?.hasAudio && soundOn && !blocked);
    v.play().catch(() => {
      // Sound before a tap is not allowed here: play muted, show it muted.
      if (!v.muted) { setBlocked(true); v.muted = true; v.play().catch(() => { /* the tap does */ }); }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, url, onView, wanted]);

  // The speaker: the file's own sound, or the mix played alongside it.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || status !== "ready" || !clip) return;
    if (clip.hasAudio) { v.muted = !audible; return; }
    if (!clip.audio) return;
    const buf = clip.audio;
    const tick = () => syncSide(v, buf, audible);
    tick();
    const evs = ["play", "pause", "seeked", "timeupdate", "ended"] as const;
    evs.forEach(n => v.addEventListener(n, tick));
    return () => { evs.forEach(n => v.removeEventListener(n, tick)); stopSide(v); };
  }, [status, clip, audible]);

  const toggleSound = () => {
    const v = videoRef.current;
    if (blocked) {
      // The tap itself unlocks sound: turn it on, whatever the setting said.
      setBlocked(false);
      setClipSoundOn(true);
      if (v && clip?.hasAudio) { v.muted = false; void v.play().catch(() => { /* still blocked */ }); }
      audioContext()?.resume().catch(() => { /* still blocked */ });
      return;
    }
    const next = !soundOn;
    setClipSoundOn(next);
    if (next) audioContext()?.resume().catch(() => { /* still blocked */ });
    if (v && clip?.hasAudio) v.muted = !next;
  };

  // Known to the feed while it is on screen, so starting this one pauses the rest.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    onScreen.add(v);
    return () => { onScreen.delete(v); };
  }, [status, url]);

  if (tracks === null) {
    return <div className="aspect-video w-full animate-pulse rounded-xl border border-white/10 bg-white/5" />;
  }
  if (!edit || canPlay === false) return <>{fallback}</>;

  const tall = style === "fan" || style === "tiktok";
  const dur = editDuration(edit);
  const save = async () => {
    const hit = made.get(key);
    if (!hit) { saveAsked.current = true; setNote("Making the video first…"); void start(); return; }
    const r = await saveVideo(hit.clip, clipFileName(edit.tracks, hit.clip.ext, edit.style), title);
    setNote(r === "shared" ? "Sent to your share menu." : r === "downloaded" ? "Saved to your downloads." : null);
  };

  return (
    <div ref={wrapRef} className={tall ? "w-[64%] max-w-[260px]" : "w-full"} data-goal-video data-clip-style={style} data-goal-video-status={status}>
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
            onClick={() => { const v = videoRef.current; if (v) { if (v.paused) void v.play(); else v.pause(); } }}
            onPlay={(ev) => { const me = ev.currentTarget; onScreen.forEach(v => { if (v !== me && !v.paused) v.pause(); }); }}
            onPause={(ev) => stopSide(ev.currentTarget)}
            data-goal-video-playing
          />
        ) : (
          <>
            <canvas ref={canvasRef} width={edit.w} height={edit.h} className="block h-full w-full" />
            {badge && (
              <div className="absolute right-2 top-2 rounded bg-red-600 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-white">
                {badge}
              </div>
            )}
            <button
              onClick={() => void start()}
              disabled={status === "making" && wanted}
              className="absolute inset-0 grid place-items-center"
              aria-label={status === "making" ? "Making the video" : "Play the goal"}
              data-goal-video-play
            >
              {status === "making" && wanted ? (
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
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] font-bold text-white/80">
        {status === "ready" && clip && (clip.hasAudio || clip.audio) && (
          <button
            onClick={toggleSound}
            className="grid h-7 w-7 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
            aria-label={audible ? "Mute" : "Sound on"}
            data-goal-video-sound={audible ? "on" : "off"}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" />
              {audible ? (
                <><path d="M16 9a4 4 0 0 1 0 6" /><path d="M18.5 6.5a7.5 7.5 0 0 1 0 11" /></>
              ) : (
                <><path d="m16.5 9.5 5 5" /><path d="m21.5 9.5-5 5" /></>
              )}
            </svg>
          </button>
        )}
        <button onClick={save} className="flex items-center gap-1 whitespace-nowrap hover:text-white" data-goal-video-save>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" />
          </svg>
          Save video
        </button>
        {status === "unsupported" && <span className="text-amber-200">This browser can&apos;t make videos.</span>}
        {status === "failed" && <span className="text-amber-200">The video could not be made.</span>}
        {note && status !== "unsupported" && status !== "failed" && <span className="text-emerald-300">{note}</span>}
        <span className="ml-auto tabular-nums text-white/60">{mmss(dur)}</span>
      </div>
    </div>
  );
}
