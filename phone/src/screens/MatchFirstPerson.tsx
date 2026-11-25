/**
 * TAKING A MAN ON — components/star/FirstPersonDribble.tsx on the phone (the
 * trial's "Take him on" and training's Pace drill, The Gauntlet).
 *
 * The same run (lib/star/firstPersonDribble.ts: newRun, stepRun, applySteer,
 * applyBurst, the knock-on rings), the same chase camera and its lean
 * (dribbleCamera.ts poseFor, stepCameraLean, CALM_CAMERA), the same carried
 * ball (its spring and stride lead) and the same picture: the website's own
 * drawer, lib/star/firstPersonRender.ts renderFirstPerson, called every frame
 * on the phone's canvas-2D stand-in (draw/ctx2d.ts) into a Skia picture, with
 * the website's ball and stadium pictures bundled.
 *
 * Touches as the website reads them: a tap on a side touches the ball that
 * way (TAP_NUDGE), a drag steers, a quick flick bursts; the run waits for
 * "Tap to start". Not ported: the duels mode and passes to team-mates (the
 * trial and the drill use neither), the keyboard.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, PixelRatio } from "react-native";
import { Canvas, Picture, Group, Skia, createPicture, type SkImage } from "@shopify/react-native-skia";
import { useSharedValue } from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { Image as RNImage } from "react-native";
import {
  newRun, applySteer, applyBurst, stepRun, BURST_T, CALM_CAMERA, LIVELY_CAMERA, stepCameraLean,
  CARRY, carryLead, wavesBeaten, type FpRunState, type RunPhase,
} from "@/lib/star/firstPersonDribble";
import { cameraFor } from "@/lib/star/firstPersonView";
import { poseFor, closeness } from "@/lib/star/dribbleCamera";
import { renderFirstPerson, type DuelPip, type FpKits } from "@/lib/star/firstPersonRender";
import { mulberry32 } from "@/lib/star/season";
import { recordDrawing } from "../draw/useDrawing";
import { loadedFace, type FacePicture } from "../draw/offscreen";
import { setSkia } from "../match/skiaApi";
import { debugRun } from "../match/debugHook";

setSkia(Skia);

type Phase = "ready" | "run" | "result";
const DT_CAP = 0.05;
const FLICK_MIN_PX_FRAC = 0.06;
const FLICK_MIN_SPEED_FRAC = 1.6;
const DEFAULT_CHASE_EYE = 3.2, DEFAULT_CHASE_PITCH_DEG = 15, DEFAULT_CHASE_OFFSET = 4.5, DEFAULT_CAMERA_FOLLOW_RATE = 5.5;
const DEFAULT_BALL_TOUCH_REACH = 0.9, BALL_SPRING_K = 90, BALL_SPRING_C = 17;
const TAP_MAX_MOVE_FRAC = 0.035, TAP_MAX_MS = 280, TAP_NUDGE = 1.8;
const PIP_FILL: Record<DuelPip, string> = { pending: "rgba(255,255,255,0.18)", active: "#fbbf24", beaten: "#34d399", won: "#ef4444" };

/* eslint-disable @typescript-eslint/no-require-imports */
const BALL_FILE = require("../match/assets/fp/ball.webp") as number;
const BACKDROP_FILE = require("../match/assets/fp/scene-sunset.webp") as number;
/* eslint-enable @typescript-eslint/no-require-imports */
const pics: { ball?: FacePicture; backdrop?: FacePicture } = {};
async function loadPic(mod: number, url: string): Promise<FacePicture | undefined> {
  const uri = RNImage.resolveAssetSource(mod)?.uri;
  if (!uri) return undefined;
  const img: SkImage | null = Skia.Image.MakeImageFromEncoded(await Skia.Data.fromURI(uri));
  return img ? loadedFace(url, img) : undefined;
}

export interface FpDribbleResult { cleared: boolean; beaten: number; wavesBeaten?: number; totalWaves?: number }

export function FirstPersonRun({
  height, pace = 60, oppStrength = 55, rounds = 3, waveSizes, seed, onComplete, hold = false, calmCamera = false, kits,
  knockOn = false, lanes, hideHint = false,
  chaseEye = DEFAULT_CHASE_EYE, chasePitchDeg = DEFAULT_CHASE_PITCH_DEG, chaseOffset = DEFAULT_CHASE_OFFSET,
  cameraFollowRate = DEFAULT_CAMERA_FOLLOW_RATE, ballTouchReach = DEFAULT_BALL_TOUCH_REACH,
}: {
  height: number; pace?: number; oppStrength?: number; rounds?: number; waveSizes?: number[]; seed?: number;
  onComplete?: (r: FpDribbleResult) => void; hold?: boolean; calmCamera?: boolean; kits?: FpKits; knockOn?: boolean; lanes?: number[][];
  hideHint?: boolean; chaseEye?: number; chasePitchDeg?: number; chaseOffset?: number; cameraFollowRate?: number; ballTouchReach?: number;
}) {
  const [W, setW] = useState(0);
  const H = height;
  const pr = Math.min(2, PixelRatio.get() || 1);
  const empty = useMemo(() => createPicture(() => {}), []);
  const pic = useSharedValue(empty);
  const runRef = useRef<FpRunState | null>(null);
  const holdRef = useRef(hold); holdRef.current = hold;
  const kitsRef = useRef(kits); kitsRef.current = kits;
  const feelRef = useRef(calmCamera ? CALM_CAMERA : LIVELY_CAMERA); feelRef.current = calmCamera ? CALM_CAMERA : LIVELY_CAMERA;
  const camXRef = useRef(0), ballXRef = useRef(0), ballVXRef = useRef(0);
  const sideDirRef = useRef(1), sideRef = useRef(0), closeRef = useRef(0), snapCamRef = useRef(true);
  const [hud, setHud] = useState<{ cleared: number; total: number; pips: DuelPip[] }>({ cleared: 0, total: 0, pips: [] });
  const hudKeyRef = useRef("");
  const phaseRef = useRef<Phase>("ready");
  const [phase, setPhaseState] = useState<Phase>("ready");
  /** Starts the frame loop again after it has gone to sleep (see the loop below). */
  const wakeRef = useRef<() => void>(() => {});
  const setPhase = (p: Phase) => { phaseRef.current = p; setPhaseState(p); wakeRef.current(); };
  const [resultText, setResultText] = useState("");
  const onCompleteRef = useRef(onComplete); onCompleteRef.current = onComplete;
  const [, setLoaded] = useState(0);
  useEffect(() => {
    let live = true;
    void Promise.all([
      pics.ball ? pics.ball : loadPic(BALL_FILE, "/star/ball.webp").then((p) => (pics.ball = p)),
      pics.backdrop ? pics.backdrop : loadPic(BACKDROP_FILE, "/home/scene-sunset.webp").then((p) => (pics.backdrop = p)),
    ]).then(() => { if (live) { setLoaded((n) => n + 1); wakeRef.current(); } }).catch(() => {});
    return () => { live = false; };
  }, []);

  const reset = useCallback(() => {
    const rng = seed !== undefined ? mulberry32(seed) : mulberry32((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0);
    const run = newRun({ pace, oppStrength, rounds, waveSizes, rng, mates: 0, ...(knockOn ? { knockOn: true } : {}), ...(lanes ? { lanes } : {}) });
    runRef.current = run;
    debugRun(run);
    camXRef.current = run.x;
    ballXRef.current = run.x + sideDirRef.current * CARRY.restFootX;
    ballVXRef.current = 0;
    snapCamRef.current = true;
    setResultText("");
    setPhase("ready");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pace, oppStrength, rounds, seed, JSON.stringify(waveSizes), knockOn, JSON.stringify(lanes)]);
  useEffect(() => { reset(); }, [reset]);

  // The run and the picture, one frame at a time.
  useEffect(() => {
    if (!W) return;
    let raf = 0, last = 0;
    const finishRun = (final: RunPhase) => {
      const run = runRef.current;
      if (final === "clear") setResultText(`Clear! Beat everyone across all ${run?.roundSizes.length ?? 3} waves.`);
      else {
        const lost = run?.lostTo != null ? run.defenders[run.lostTo] : undefined;
        setResultText(lost ? `Beaten in wave ${lost.round + 1}` : "Ran out of time");
      }
      setPhase("result");
      const beaten = run?.defenders.filter((d) => d.phase === "beaten").length ?? 0;
      onCompleteRef.current?.({ cleared: final === "clear", beaten, wavesBeaten: run ? wavesBeaten(run) : 0, totalWaves: run?.roundSizes.length ?? 0 });
    };
    const draw = (dt: number) => {
      const run = runRef.current;
      if (!run) return;
      const feel = feelRef.current;
      const followRate = feel === CALM_CAMERA ? Math.min(cameraFollowRate, feel.followRate) : cameraFollowRate;
      camXRef.current += (run.x - camXRef.current) * (1 - Math.exp(-followRate * dt));
      let touchDir = 0;
      if (run.burst) touchDir = run.burst.dir;
      else { const diff = run.laneTarget - run.x; if (Math.abs(diff) > 0.15) touchDir = Math.sign(diff); }
      const restX = run.x + sideDirRef.current * CARRY.restFootX;
      const desiredBallX = touchDir === 0 ? restX : run.x + touchDir * ballTouchReach * (run.burst ? 1.4 : 1);
      const accel = BALL_SPRING_K * (desiredBallX - ballXRef.current) - BALL_SPRING_C * ballVXRef.current;
      ballVXRef.current += accel * dt;
      ballXRef.current += ballVXRef.current * dt;
      ballXRef.current = Math.max(run.minX - 0.5, Math.min(run.maxX + 0.5, ballXRef.current));
      let near = Infinity;
      for (const d of run.defenders) { if (d.phase === "beaten" || d.phase === "won") continue; if (d.y < run.y + 0.5) near = Math.min(near, run.y - d.y); }
      closeRef.current += (closeness(near) - closeRef.current) * (1 - Math.exp(-2.5 * dt));
      if (snapCamRef.current) closeRef.current = closeness(near);
      const pose = poseFor("C1", closeRef.current);
      const off = ballXRef.current - run.x;
      const lean = stepCameraLean({ dir: sideDirRef.current >= 0 ? 1 : -1, side: sideRef.current }, off, pose.side, feel, dt);
      sideDirRef.current = lean.dir;
      sideRef.current = snapCamRef.current ? lean.dir * pose.side * feel.sideScale : lean.side;
      snapCamRef.current = false;
      const camEye = pose.eye ?? chaseEye, camPitchDeg = pose.pitchDeg ?? chasePitchDeg, camOffset = pose.offset ?? chaseOffset, camLook = pose.look;
      const burstLead = run.burst ? Math.min(1, run.burst.t / BURST_T) : 0;
      const leadDepth = carryLead(run.stride, sideDirRef.current >= 0 ? 1 : -1, burstLead);
      const cw = Math.round(W * pr), ch = Math.round(H * pr);
      const cam = cameraFor({ x: camXRef.current + sideRef.current, y: run.y + camOffset }, cw, ch, {
        eye: camEye, pitch: (camPitchDeg * Math.PI) / 180,
        forward: camLook > 0 ? (() => { const fx = -sideRef.current, fy = -(camLook + camOffset), L = Math.hypot(fx, fy) || 1; return { x: fx / L, y: fy / L }; })() : undefined,
      });
      const pips: DuelPip[] = run.roundSizes.map((_, r) => {
        const wave = run.defenders.filter((d) => d.round === r);
        if (wave.some((d) => d.phase === "won")) return "won";
        if (wave.every((d) => d.phase === "beaten")) return "beaten";
        return r === run.activeRound ? "active" : "pending";
      });
      const cleared = run.roundSizes.filter((_, r) => run.defenders.filter((d) => d.round === r).every((d) => d.phase === "beaten")).length;
      const hudKey = `${cleared}/${run.roundSizes.length}/${pips.join(",")}`;
      if (hudKey !== hudKeyRef.current) { hudKeyRef.current = hudKey; setHud({ cleared, total: run.roundSizes.length, pips }); }
      const ownLean = Math.max(-0.35, Math.min(0.35, (ballXRef.current - restX) * 0.55));
      pic.value = recordDrawing(W, H, (ctx) => {
        const canvas = { width: cw, height: ch, getContext: () => ctx } as unknown as HTMLCanvasElement;
        renderFirstPerson(canvas, {
          cam, defenders: run.defenders, stride: run.stride, minX: run.minX, maxX: run.maxX,
          ball: { x: ballXRef.current, y: run.y - leadDepth, z: 0 },
          ballImage: pics.ball as unknown as HTMLImageElement,
          assist: false, reducedMotion: false,
          own: { x: run.x, y: run.y },
          backdrop: pics.backdrop as unknown as HTMLImageElement,
          ballBehindYou: true,
          kits: kitsRef.current,
          ownLean,
          mates: run.mates,
          knockClock: run.knockOn ? run.elapsed : undefined,
        });
      }, { pixelRatio: pr, rawPixels: true });
    };
    // Off the run (waiting to start, or the result showing) the camera and the ball settle for a
    // moment, then nothing moves: the loop sleeps instead of drawing the same picture 60 times a
    // second, and wakes on the next start, reset or loaded picture.
    let still = 0;
    const SETTLE_FRAMES = 90;
    const frame = (now: number) => {
      const dt = last ? Math.min(DT_CAP, (now - last) / 1000) : 1 / 60;
      last = now;
      const run = runRef.current;
      if (phaseRef.current === "run" && run) {
        still = 0;
        const r = stepRun(run, dt);
        if (r !== "running") finishRun(r);
      } else still++;
      draw(dt);
      raf = still > SETTLE_FRAMES ? 0 : requestAnimationFrame(frame);
    };
    wakeRef.current = () => { still = 0; if (!raf) { last = 0; raf = requestAnimationFrame(frame); } };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); raf = -1; wakeRef.current = () => {}; };
  }, [W, H, pr, pic, chaseEye, chasePitchDeg, chaseOffset, cameraFollowRate, ballTouchReach]);

  // Touches: a tap on a side touches the ball that way, a drag steers, a flick bursts.
  //
  // The touch in progress lives in ONE object on a ref and every handler reads and writes `touch.current.<field>`.
  // (Mikey, 25 Nov 2026: "tapping left/right does nothing". Gesture-handler callbacks are made into worklets by the
  // build, which gives each callback its own copy of a plain `let` it captured: `start` was set in onBegin and was
  // still null in onUpdate and onFinalize, so no tap and no drag ever steered. Seen in the web build: the finalize
  // saw start=false after the begin had set it.)
  const touch = useRef<{ anchorPx: number; anchorLane: number; start: { x: number; y: number; t: number } | null; samples: { x: number; t: number }[] }>({ anchorPx: 0, anchorLane: 0, start: null, samples: [] });
  const gesture = useMemo(() => {
    return Gesture.Pan().runOnJS(true).minDistance(0)
      .onBegin((e) => {
        if (phaseRef.current === "ready") { if (!holdRef.current) setPhase("run"); return; }
        const run = runRef.current;
        if (!run || phaseRef.current !== "run") return;
        const t = touch.current;
        t.anchorPx = e.x; t.anchorLane = run.laneTarget ?? run.x;
        t.samples = [{ x: e.x, t: Date.now() }];
        t.start = { x: e.x, y: e.y, t: Date.now() };
      })
      .onUpdate((e) => {
        const run = runRef.current, t = touch.current;
        if (!run || phaseRef.current !== "run" || !t.start) return;
        const w = Math.max(1, W);
        const perPx = (run.maxX - run.minX) / Math.max(1, w * 0.8);
        applySteer(run, t.anchorLane + (e.x - t.anchorPx) * perPx);
        const now = Date.now();
        t.samples.push({ x: e.x, t: now });
        while (t.samples.length > 1 && now - t.samples[0].t > 150) t.samples.shift();
        const oldest = t.samples[0], dtMs = now - oldest.t;
        if (dtMs > 20) {
          const vx = (e.x - oldest.x) / (dtMs / 1000);
          if (Math.abs(vx) >= FLICK_MIN_SPEED_FRAC * w && Math.abs(e.x - oldest.x) >= FLICK_MIN_PX_FRAC * w) {
            if (applyBurst(run, vx > 0 ? 1 : -1)) { t.anchorPx = e.x; t.anchorLane = run.laneTarget; t.samples = [{ x: e.x, t: now }]; }
          }
        }
      })
      .onFinalize((e) => {
        const run = runRef.current, t = touch.current, s = t.start;
        t.start = null;
        if (!run || !s || phaseRef.current !== "run") return;
        const w = Math.max(1, W);
        const moved = Math.hypot(e.x - s.x, e.y - s.y), heldMs = Date.now() - s.t;
        if (moved > TAP_MAX_MOVE_FRAC * w || heldMs > TAP_MAX_MS) return;
        applySteer(run, run.laneTarget + TAP_NUDGE * (s.x < w / 2 ? -1 : 1));
      });
  }, [W]);

  return (
    <View style={{ height: H, overflow: "hidden", borderRadius: 12, backgroundColor: "#0b1a12" }} onLayout={(e) => { const w = Math.round(e.nativeEvent.layout.width); if (w > 0 && w !== W) setW(w); }}>
      {W > 0 && (
        <GestureDetector gesture={gesture}>
          <View style={{ flex: 1 }}>
            <Canvas style={{ width: W, height: H }}><Group transform={[{ scale: 1 / pr }]}><Picture picture={pic} /></Group></Canvas>
          </View>
        </GestureDetector>
      )}
      {hud.total > 0 && (
        <View pointerEvents="none" style={{ position: "absolute", top: 8, left: 0, right: 0, alignItems: "center" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: "rgba(12,16,24,0.88)", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.92)" }}>
            <Text style={{ color: "#fff", fontWeight: "900", fontSize: 12 }}>WAVES {hud.cleared}/{hud.total}</Text>
            {hud.pips.map((p, i) => <View key={i} style={{ width: 12, height: 12, backgroundColor: PIP_FILL[p] }} />)}
          </View>
        </View>
      )}
      {phase === "ready" && !hold && (
        <Pressable onPress={() => setPhase("run")} style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.25)", alignItems: "center" }}>
          <View style={{ marginTop: H * 0.08, alignItems: "center", gap: 6, paddingHorizontal: 24 }}>
            <Text style={{ backgroundColor: "#10b981", color: "#022c22", fontWeight: "900", fontSize: 16, letterSpacing: 2, paddingHorizontal: 24, paddingVertical: 12, overflow: "hidden" }}>TAP TO START</Text>
            {!hideHint && <Text style={{ backgroundColor: "rgba(12,16,24,0.88)", color: "#fff", fontSize: 12, fontWeight: "700", textAlign: "center", paddingHorizontal: 12, paddingVertical: 6, overflow: "hidden" }}>
              {knockOn ? "One man comes for the ball (the ring). When his ring turns green, flick the other way. Too early and he goes with you." : "Tap left or right to touch the ball. Flick to burst past him."}
            </Text>}
          </View>
        </Pressable>
      )}
      {phase === "result" && (
        <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", paddingHorizontal: 16 }}>
          <Text style={{ color: "#fcd34d", fontSize: 24, fontWeight: "900", textAlign: "center" }}>{resultText}</Text>
        </View>
      )}
    </View>
  );
}
