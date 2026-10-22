"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CareerState } from "@/lib/star/types";
import { seasonGoals } from "@/lib/star/goalLog";
import { getClips } from "@/lib/star/goalClip/store";
import type { GoalTrack } from "@/lib/star/goalClip/track";
import { planReelFor, type ClipTiming, type ReelPlan } from "@/lib/star/goalClip/reel";
import { paintReelOn, type ReelAssets } from "@/lib/star/goalClip/reelRender";
import { mixReelAudio, timingOf } from "@/lib/star/goalClip/reelAudio";
import { encodeReel, reelFileName } from "@/lib/star/goalClip/reelEncode";
import { canMakeVideo, saveVideo, type EncodedClip } from "@/lib/star/goalClip/encode";
import { prepareClipSprites } from "@/lib/star/goalClip/render";
import { useClipSound, setClipSoundOn } from "@/lib/star/goalClip/sound";
import { audioContext } from "@/lib/star/audioOut";
import { holdMusic } from "@/lib/star/gameMusic";
import { useAnimationsLook } from "@/lib/star/animLook";
import { displayName } from "@/lib/star/playerIdentity";
import { drawnBadgeUrl } from "./ClubBadge";
import { pitchFont } from "./ui/pitchFont";

/**
 * YOUR SEASON IN ONE VIDEO (Leo, 22 Oct 2026: "make it GREAT, something
 * players will love"). Shown at the end of every season, before the awards.
 *
 * A reel that plays by itself: a title card in the club's colours, every goal
 * of the season in order (about 3 s each, from the recording on this phone),
 * the goal of the season again in slow motion, and an end card with the
 * season's numbers and trophies, over the crowd and a music bed from the
 * game's own tracks. A goal with no recording here is a drawn card instead,
 * so the reel always plays, recordings or not, goals or not.
 *
 * Skip is always on screen. Save video makes the file on the phone (a
 * progress count while it does) and opens the share menu (Save Video on an
 * iPhone) or downloads it. Sound follows the goal videos' speaker setting.
 *
 * Plan: lib/star/goalClip/reel.ts · drawing: reelRender.ts · sound:
 * reelAudio.ts · file: reelEncode.ts. The caller marks the season's reel as
 * done in onDone (this screen never touches the save).
 */

/** The size the reel is drawn at on screen (the saved file is 360×640). */
const VIEW_W = 540;
const VIEW_H = 960;
/** Never wait longer than this for the recordings before starting. */
const LOAD_CAP_MS = 2500;

type SaveState =
  | { kind: "idle" }
  | { kind: "making"; k: number }
  | { kind: "ready" }
  | { kind: "done"; how: "shared" | "downloaded" }
  | { kind: "failed"; why: string };

export default function SeasonReel({ career, onDone }: { career: CareerState; onDone: () => void }) {
  const moves = useAnimationsLook();
  const soundOn = useClipSound();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tracks, setTracks] = useState<Map<string, GoalTrack> | null>(null);
  const [fontReady, setFontReady] = useState(false);
  const [badge, setBadge] = useState<HTMLImageElement | null>(null);
  const [ended, setEnded] = useState(false);
  const [paused, setPaused] = useState(false);
  const [save, setSave] = useState<SaveState>({ kind: "idle" });
  const progressRef = useRef<HTMLDivElement>(null);
  const [seekTick, setSeekTick] = useState(0);

  const player = displayName(career.player);
  const club = career.thisSeasonClub ?? career.player.club;
  const goalIds = useMemo(
    () => seasonGoals(career).map((g) => g.clipId).filter((x): x is string => !!x),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [career.season, (career.goalLog ?? []).length],
  );

  // The game's own music stops while the reel has its own.
  useEffect(() => {
    holdMusic("season-reel", true);
    return () => holdMusic("season-reel", false);
  }, []);

  // The recordings on this phone (never wait for ever).
  useEffect(() => {
    let live = true;
    const cap = setTimeout(() => { if (live) setTracks((t) => t ?? new Map()); }, LOAD_CAP_MS);
    getClips(goalIds)
      .then((list) => { if (live) setTracks(new Map(list.map((t) => [t.meta.id, t]))); })
      .catch(() => { if (live) setTracks(new Map()); });
    return () => { live = false; clearTimeout(cap); };
  }, [goalIds]);

  // The tall display face and the badge.
  useEffect(() => {
    let live = true;
    const fam = pitchFont.style.fontFamily;
    const fonts = typeof document !== "undefined" ? (document as Document & { fonts?: FontFaceSet }).fonts : undefined;
    const done = () => { if (live) setFontReady(true); };
    if (fonts?.load) {
      Promise.race([fonts.load(`40px ${fam}`), new Promise((r) => setTimeout(r, 1500))]).then(done, done);
    } else done();
    const img = new Image();
    img.onload = () => { if (live) setBadge(img); };
    img.src = drawnBadgeUrl(club);
    return () => { live = false; };
  }, [club]);

  const timings = useMemo(() => {
    const out: Record<string, ClipTiming> = {};
    tracks?.forEach((t, id) => { out[id] = timingOf(t); });
    return out;
  }, [tracks]);

  const plan: ReelPlan | null = useMemo(
    () => (tracks ? planReelFor(career, timings, player) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tracks, timings, player, career.season],
  );

  const assets: ReelAssets = useMemo(() => ({
    tracks: tracks ?? new Map(),
    moves,
    display: pitchFont.style.fontFamily,
    badge,
  }), [tracks, moves, badge]);

  // The soundtrack, mixed in the background (the reel starts without waiting).
  const audioJob = useRef<Promise<AudioBuffer | null> | null>(null);
  const [audioBuf, setAudioBuf] = useState<AudioBuffer | null>(null);
  useEffect(() => {
    if (!plan || !tracks) return;
    let live = true;
    const job = mixReelAudio(plan, tracks, timings).catch(() => null);
    audioJob.current = job;
    job.then((b) => { if (live) setAudioBuf(b); });
    return () => { live = false; };
  }, [plan, tracks, timings]);

  // ── The clock ────────────────────────────────────────────────────────────
  const clock = useRef({ base: 0, startedAt: 0, running: false });
  const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
  const timeNow = useCallback(() => {
    const c = clock.current;
    return c.running ? c.base + (now() - c.startedAt) / 1000 : c.base;
  }, []);

  // The sound plays alongside, kept in step with the clock.
  const voice = useRef<{ src: AudioBufferSourceNode; at: number; ctxAt: number } | null>(null);
  const stopVoice = () => {
    try { voice.current?.src.stop(); } catch { /* already stopped */ }
    voice.current = null;
  };
  const syncVoice = useCallback(() => {
    const c = audioContext();
    const t = timeNow();
    const want = !!audioBuf && soundOn && clock.current.running && !!plan && t < plan.duration;
    if (!want || !c || !audioBuf) { stopVoice(); return; }
    if (c.state !== "running") { c.resume().catch(() => { /* needs a tap */ }); stopVoice(); return; }
    const v = voice.current;
    if (v) {
      const pos = v.at + (c.currentTime - v.ctxAt);
      if (Math.abs(pos - t) < 0.2) return;
    }
    stopVoice();
    const src = c.createBufferSource();
    src.buffer = audioBuf;
    src.connect(c.destination);
    try { src.start(0, Math.max(0, t)); } catch { return; }
    voice.current = { src, at: t, ctxAt: c.currentTime };
  }, [audioBuf, soundOn, plan, timeNow]);
  useEffect(() => () => stopVoice(), []);

  const start = useCallback((from = clock.current.base) => {
    clock.current = { base: from, startedAt: now(), running: true };
    setPaused(false);
    setEnded(false);
  }, []);
  const pause = useCallback(() => {
    clock.current = { base: timeNow(), startedAt: 0, running: false };
    setPaused(true);
    stopVoice();
  }, [timeNow]);

  // Start once the plan exists and the figures have had a moment to load
  // (the title card gives them its 3.6 s too).
  const [spritesOk, setSpritesOk] = useState(false);
  useEffect(() => {
    let live = true;
    Promise.race([prepareClipSprites(moves), new Promise((r) => setTimeout(r, 1200))])
      .catch(() => undefined)
      .finally(() => { if (live) setSpritesOk(true); });
    return () => { live = false; };
  }, [moves]);
  const begun = useRef(false);
  useEffect(() => {
    if (plan && fontReady && spritesOk && !begun.current) { begun.current = true; start(0); }
  }, [plan, fontReady, spritesOk, start]);

  // Draw every frame while it plays (and once more whenever anything changes).
  useEffect(() => {
    if (!plan) return;
    let raf = 0;
    const draw = () => {
      let t = timeNow();
      if (t >= plan.duration && clock.current.running) {
        t = plan.duration - 0.7; // hold the end card, before its fade
        clock.current = { base: t, startedAt: 0, running: false };
        setEnded(true);
        stopVoice();
      }
      paintReelOn(canvasRef.current, VIEW_W, VIEW_H, plan, Math.min(t, plan.duration - 0.001), assets);
      if (progressRef.current) progressRef.current.style.width = `${plan.duration > 0 ? Math.min(100, (t / plan.duration) * 100) : 0}%`;
      syncVoice();
      if (clock.current.running) raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [plan, assets, paused, ended, seekTick, syncVoice, timeNow]);

  // Away from the tab: pause.
  useEffect(() => {
    const onVis = () => { if (document.hidden && clock.current.running) pause(); };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [pause]);

  // For the test page and stills: jump to a moment.
  useEffect(() => {
    if (!plan) return;
    const w = window as unknown as { __seasonReel?: unknown };
    w.__seasonReel = {
      duration: plan.duration,
      segs: plan.segs.map((s) => ({ kind: s.kind, at: s.at, dur: s.dur, video: "shots" in s ? s.shots.length > 0 : false })),
      seek: (t: number, hold = true) => { clock.current = { base: t, startedAt: now(), running: !hold }; setPaused(hold); setEnded(false); setSeekTick((k) => k + 1); },
      audioReady: () => !!audioBuf,
    };
    return () => { delete w.__seasonReel; };
  }, [plan, audioBuf]);

  const tapVideo = () => {
    audioContext()?.resume().catch(() => { /* still blocked */ });
    if (ended) { start(0); return; }
    if (clock.current.running) pause(); else start();
  };

  const toggleSound = () => {
    const next = !soundOn;
    setClipSoundOn(next);
    if (next) audioContext()?.resume().catch(() => { /* still blocked */ });
  };

  // ── Save ─────────────────────────────────────────────────────────────────
  const made = useRef<EncodedClip | null>(null);
  const share = async () => {
    const clip = made.current;
    if (!clip || !plan) return;
    try {
      const r = await saveVideo(clip, reelFileName(plan, clip.ext), `My ${plan.seasonLabel} season`);
      if (r === "cancelled") setSave({ kind: "ready" });
      else setSave({ kind: "done", how: r });
    } catch {
      setSave({ kind: "failed", why: "It could not be saved." });
    }
  };
  const onSave = async () => {
    if (!plan) return;
    if (made.current) { void share(); return; }
    if (save.kind === "making") return;
    if (!canMakeVideo()) { setSave({ kind: "failed", why: "This browser can't make videos." }); return; }
    pause();
    setSave({ kind: "making", k: 0 });
    try {
      const audio = audioBuf ?? (audioJob.current ? await audioJob.current : null);
      const clip = await encodeReel(plan, { ...assets }, { audio, onProgress: (k) => setSave({ kind: "making", k }) });
      if (!clip) { setSave({ kind: "failed", why: "This browser can't make videos." }); return; }
      made.current = clip;
      // Straight to the share menu if the phone still counts this as the tap;
      // otherwise one more tap (a phone only opens it from a tap).
      const ua = (navigator as Navigator & { userActivation?: { isActive: boolean } }).userActivation;
      if (ua?.isActive) void share();
      else setSave({ kind: "ready" });
    } catch {
      setSave({ kind: "failed", why: "The video could not be made." });
    }
  };

  const saveLabel = save.kind === "making" ? `Making video ${Math.round(save.k * 100)}%`
    : save.kind === "ready" ? "Save now"
    : save.kind === "done" ? (save.how === "shared" ? "Sent ✓" : "Saved ✓")
    : "Save video";

  return (
    <div
      className={`${pitchFont.className} fixed inset-0 z-50 flex flex-col bg-[#05070d] text-white`}
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
      data-season-reel
      data-reel-ended={ended ? "1" : "0"}
      data-reel-sound={audioBuf ? "ready" : "mixing"}
    >
      <div className="relative flex min-h-0 flex-1 items-center justify-center">
        <div className="relative h-full max-h-full" style={{ aspectRatio: `${VIEW_W} / ${VIEW_H}`, maxWidth: "100%" }}>
          <canvas
            ref={canvasRef}
            width={VIEW_W}
            height={VIEW_H}
            onClick={tapVideo}
            className="block h-full w-full cursor-pointer bg-[#0b1020]"
            aria-label={paused ? "Play" : "Pause"}
          />
          {paused && !ended && plan && (
            <button onClick={tapVideo} className="absolute inset-0 grid place-items-center" aria-label="Play" data-reel-resume>
              <span className="grid h-16 w-16 place-items-center rounded-full bg-black/55 ring-2 ring-white/80">
                <span className="ml-1 h-0 w-0 border-y-[11px] border-l-[17px] border-y-transparent border-l-white" />
              </span>
            </button>
          )}
          {/* Sound and Skip, top right; Skip is always on screen. */}
          <div className="absolute right-3 top-3 flex items-center gap-2">
          <button
            onClick={toggleSound}
            className="grid h-9 w-9 place-items-center rounded-full bg-black/60 text-white ring-1 ring-white/30 backdrop-blur-sm active:scale-95"
            aria-label={soundOn ? "Mute" : "Sound on"}
            data-reel-sound-toggle={soundOn ? "on" : "off"}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" />
              {soundOn ? <><path d="M16 9a4 4 0 0 1 0 6" /><path d="M18.5 6.5a7.5 7.5 0 0 1 0 11" /></> : <><path d="m16.5 9.5 5 5" /><path d="m21.5 9.5-5 5" /></>}
            </svg>
          </button>
          <button
            onClick={onDone}
            className="rounded-full bg-black/60 px-4 py-2 text-[13px] font-black uppercase tracking-wider text-white ring-1 ring-white/30 backdrop-blur-sm active:scale-95"
            data-reel-skip
          >
            {ended ? "Continue" : "Skip"}
          </button>
          </div>
          {/* How far through. */}
          <div className="absolute inset-x-0 bottom-0 h-[3px] bg-white/20">
            <div ref={progressRef} className="h-full bg-white" style={{ width: "0%" }} />
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 px-4 py-3">
        <button
          onClick={() => void onSave()}
          disabled={!plan || save.kind === "making"}
          className="relative h-11 flex-1 overflow-hidden rounded-full bg-white/10 text-[14px] font-black uppercase tracking-wide text-white ring-1 ring-white/20 active:scale-[0.98] disabled:opacity-90"
          data-reel-save={save.kind}
        >
          {save.kind === "making" && (
            <span className="absolute inset-y-0 left-0 bg-white/25" style={{ width: `${Math.round(save.k * 100)}%` }} />
          )}
          <span className="relative inline-flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" />
            </svg>
            {saveLabel}
          </span>
        </button>
        <button
          onClick={onDone}
          className="h-11 flex-1 rounded-full bg-emerald-500 text-[14px] font-black uppercase tracking-wide text-emerald-950 active:scale-[0.98]"
          data-reel-continue
        >
          Continue
        </button>
      </div>
      {save.kind === "failed" && (
        <div className="shrink-0 px-4 pb-2 text-center text-[12px] font-bold text-amber-200" data-reel-save-note>{save.why}</div>
      )}
    </div>
  );
}
