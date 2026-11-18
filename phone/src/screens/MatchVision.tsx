/**
 * FINDING THE PASS — two screens, as the website has them:
 *
 * 1. THE TRIAL'S "FIND THE PASS" (components/star/stages/TrialVision.tsx):
 *    its own picture, not the match. The same layout (layoutVision below, its
 *    sums ported word for word: the grid, the markers, the gap the right man
 *    must win by), the same camera (fiveASide cameraContaining over MUST_SEE),
 *    the same drawing (lib/star/fiveASide/render.ts drawPitch, drawGoal,
 *    drawFigure, drawBall, called through the phone's canvas stand-in), the
 *    same clock, verdicts and scoring (trialStages visionSetup, visionQuality,
 *    weightedQuality), the teaching card, the 3·2·1.
 *
 * 2. TRAINING'S VISION, "Pick the Pass" (TrainingMinigame.tsx VisionDrillView):
 *    a REAL picture per try (lib/star/visionRound.ts: a real tracked pass or a
 *    drawn chance) played on the match (the phone's EngineFeature). Tap levels:
 *    tap the man before the bar runs out (tapPick on the camera the match drew
 *    with). Kick levels: start the pull inside the window, let go inside the
 *    let-go time; the engine plays the pass and judgeKick reads it. The right
 *    man ringed green, a wrong pick red. Three tries, stars as the website.
 *
 * Not drawn: the men's photo faces (the phone has no picture faces yet).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { Canvas, Picture, Group, Skia, createPicture } from "@shopify/react-native-skia";
import { useSharedValue } from "react-native-reanimated";
import { mulberry32 } from "@/lib/star/season";
import { CX, NET_DEPTH } from "@/lib/star/pitch";
import type { Scenario, Viewport } from "@/lib/star/canvasEngine";
import { REPS, visionSetup, visionQuality, visionFreeSeconds, weightedQuality, attemptSeed, markTeachSeen, type VisionSetup } from "@/lib/star/trialStages";
import type { TrialProgress } from "@/lib/star/trial";
import { ELEVEN_A_SIDE_ATTACK } from "@/lib/star/fiveASide/rules";
import { cameraContaining, projectionFor, drawPitch, drawGoal, drawFigure, drawBall, ROLE_KIT, MATCH_SCALE, sameSizeScale } from "@/lib/star/fiveASide/render";
import { DEFAULT_FACE_STYLE } from "@/lib/star/faceStyle";
import { DEFAULT_FAKE_FACE_STYLE } from "@/lib/star/fakeFaceStyle";
import type { Skills } from "@/lib/star/types";
import { levelConfig, levelSeedOf, type VisionLevel } from "@/lib/star/trainingLevelData";
import {
  loadVisionMoments, visionMomentsReady, visionLevelPicturesAsync, visionAsk, visionScenario,
  judgeKick, judgeTap, tapPick, camToBox, aimedMan, type VisionPicture, type VisionVerdict,
} from "@/lib/star/visionRound";
import { REAL_CREDIT } from "@/lib/star/realMoments/types";
import { recordDrawing } from "../draw/useDrawing";
import { setSkia } from "../match/skiaApi";
import type { MatchDriver } from "../match/driver";
import type { Cam } from "../match/view";
import type { ChanceResolved } from "../match/setup";
import { EngineFeature, TrialBoard, TrialCaption, TrialSlots, TeachCard, type SlotState } from "./MatchFeature";
import { C } from "../ui/theme";

setSkia(Skia);

// ── 1. The trial's Find the pass (stages/TrialVision.tsx) ──
const VISION_YOU_Y = 36;
const VISION_YOU = { x: CX, y: VISION_YOU_Y };
const MUST_SEE = { x1: 16.5, x2: 51.5, y1: -NET_DEPTH - 1, y2: VISION_YOU_Y + 1.6 };
const AREA = { x1: 20, x2: 48, y1: 4.5, y2: 30 };
const MARKER_BOX = { x1: 18.5, x2: 49.5, y1: 1.5, y2: 33.5 };
const BASE_SPACE = 2.4;
const MIN_SPACE = 1.1;
const REQUIRED_GAP_FRACTION = 0.6;
const LAYOUT_ATTEMPTS = 24;
interface VisionMan { x: number; y: number; marker: { x: number; y: number }; space: number }
interface VisionLayout { you: { x: number; y: number }; men: VisionMan[]; gap: number }
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
function oneLayout(setup: VisionSetup, rng: () => number): VisionLayout {
  const n = Math.max(2, Math.round(setup.options));
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  const cw = (AREA.x2 - AREA.x1) / cols;
  const ch = (AREA.y2 - AREA.y1) / rows;
  const pos: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const c = i % cols, r = Math.floor(i / cols);
    pos.push({ x: AREA.x1 + cw * (c + 0.5) + (rng() - 0.5) * cw * 0.5, y: AREA.y1 + ch * (r + 0.5) + (rng() - 0.5) * ch * 0.5 });
  }
  const best = BASE_SPACE + setup.margin;
  const markers: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const want = i === setup.correct ? best : Math.max(MIN_SPACE, best - setup.margin * (0.85 + rng() * 0.3));
    const a0 = rng() * Math.PI * 2;
    let placed: { x: number; y: number } | null = null;
    for (let k = 0; k < 8 && !placed; k++) {
      const a = a0 + (k * Math.PI) / 4;
      const m = { x: pos[i].x + Math.cos(a) * want, y: pos[i].y + Math.sin(a) * want };
      if (m.x >= MARKER_BOX.x1 && m.x <= MARKER_BOX.x2 && m.y >= MARKER_BOX.y1 && m.y <= MARKER_BOX.y2) placed = m;
    }
    markers.push(placed ?? { x: Math.min(MARKER_BOX.x2, Math.max(MARKER_BOX.x1, pos[i].x + want)), y: Math.min(MARKER_BOX.y2, Math.max(MARKER_BOX.y1, pos[i].y)) });
  }
  const men: VisionMan[] = pos.map((p, i) => ({ x: p.x, y: p.y, marker: markers[i], space: Math.min(...markers.map((m) => dist(p, m))) }));
  const others = men.filter((_, i) => i !== setup.correct).map((m) => m.space);
  const gap = men[setup.correct].space - Math.max(...others);
  return { you: { ...VISION_YOU }, men, gap };
}
export function layoutVision(setup: VisionSetup, seed: number, rep: number): VisionLayout {
  const need = setup.margin * REQUIRED_GAP_FRACTION;
  let bestLayout: VisionLayout | null = null;
  for (let a = 0; a < LAYOUT_ATTEMPTS; a++) {
    const rng = mulberry32((seed ^ ((rep + 1) * 0x27d4eb2d) ^ ((a + 1) * 0x165667b1)) >>> 0);
    const l = oneLayout(setup, rng);
    if (l.gap >= need) return l;
    if (!bestLayout || l.gap > bestLayout.gap) bestLayout = l;
  }
  return bestLayout!;
}

type Phase = "ready" | "live" | "reveal";
const KIT = { shirt: ROLE_KIT.you, shorts: ROLE_KIT.youRim, trim: ROLE_KIT.youRim };
const OPP = { shirt: ROLE_KIT.opp, shorts: ROLE_KIT.oppRim, trim: ROLE_KIT.oppRim };
const TEACH_COUNT_FROM = 3, TEACH_COUNT_MS = 600;

export function TrialVisionStage({ trial, onDone, maxHeight }: { trial: TrialProgress; onDone: (quality: number) => void; maxHeight: number }) {
  const [W, setW] = useState(0);
  const H = W ? Math.round(Math.min(W * (5 / 4), maxHeight)) : 0;
  const empty = useMemo(() => createPicture(() => {}), []);
  const pic = useSharedValue(empty);
  const camRef = useRef<Viewport | null>(null);
  const startedRef = useRef(0);
  const phaseRef = useRef<Phase>("ready");
  const scoresRef = useRef<number[]>([]);
  const pickedRef = useRef<number | null>(null);
  const doneRef = useRef(false);
  const [rep, setRep] = useState(0);
  const [phase, setPhaseState] = useState<Phase>("ready");
  const [verdict, setVerdict] = useState("");
  const [count, setCount] = useState<number | null>(null);
  const [go, setGo] = useState(false);
  const setPhase = (p: Phase) => { phaseRef.current = p; setPhaseState(p); };
  const startFromTeach = useCallback(() => { markTeachSeen("vision"); setGo(true); }, []);
  const setup = useMemo(() => visionSetup(trial, rep), [trial, rep]);
  const seed = useMemo(() => attemptSeed(trial), [trial]);
  const layout = useMemo(() => layoutVision(setup, seed, rep), [setup, seed, rep]);
  const setupRef = useRef(setup); setupRef.current = setup;
  const layoutRef = useRef(layout); layoutRef.current = layout;
  const onDoneRef = useRef(onDone); onDoneRef.current = onDone;
  const repRef = useRef(rep); repRef.current = rep;

  const settle = useCallback((picked: number | null, tookSeconds: number) => {
    const s = setupRef.current;
    const q = visionQuality(picked, s, tookSeconds);
    scoresRef.current = [...scoresRef.current, q];
    pickedRef.current = picked;
    const free = visionFreeSeconds(s.window);
    setVerdict(picked === null ? "Head never came up." : picked !== s.correct ? "He was covered." : tookSeconds <= free ? "Seen it early!" : tookSeconds < free + (s.window - free) * 0.5 ? "Right man — a beat late." : "Right man, eventually.");
    setPhase("reveal");
    setTimeout(() => {
      if (repRef.current + 1 >= REPS.vision) {
        if (doneRef.current) return;
        doneRef.current = true;
        onDoneRef.current(weightedQuality(scoresRef.current));
      } else setRep((r) => r + 1);
    }, 1200);
  }, []);

  useEffect(() => {
    pickedRef.current = null;
    setVerdict("");
    setPhase("ready");
    const timers: ReturnType<typeof setTimeout>[] = [];
    if (rep === 0 && !go) { setCount(null); return; }
    if (rep === 0) {
      setCount(TEACH_COUNT_FROM);
      for (let n = TEACH_COUNT_FROM - 1; n >= 1; n--) timers.push(setTimeout(() => setCount(n), (TEACH_COUNT_FROM - n) * TEACH_COUNT_MS));
      timers.push(setTimeout(() => { setCount(null); startedRef.current = Date.now(); setPhase("live"); }, TEACH_COUNT_FROM * TEACH_COUNT_MS));
    } else {
      setCount(null);
      timers.push(setTimeout(() => { startedRef.current = Date.now(); setPhase("live"); }, 650));
    }
    return () => { for (const t of timers) clearTimeout(t); };
  }, [rep, go]);

  // The picture and the clock, every frame (the website's rAF draw).
  useEffect(() => {
    if (!W || !H) return;
    let raf = 0;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      const s = setupRef.current;
      if (phaseRef.current === "live" && (Date.now() - startedRef.current) / 1000 >= s.window) settle(null, s.window);
      pic.value = recordDrawing(W, H, (ctx) => {
        const camera = cameraContaining(MUST_SEE, W, H);
        camRef.current = camera;
        const rules = ELEVEN_A_SIDE_ATTACK;
        const p = projectionFor(rules, W, H, camera);
        const { px, py, unit } = p;
        drawPitch(ctx, rules, p);
        drawGoal(ctx, rules, p, 0, NET_DEPTH);
        const l = layoutRef.current, st = setupRef.current;
        const reveal = phaseRef.current === "reveal";
        const FIG = sameSizeScale(unit, W);
        const ring = (x: number, y: number, colour: string) => {
          const r = Math.max(6, unit * 1.05 * (FIG / MATCH_SCALE));
          ctx.strokeStyle = colour;
          ctx.lineWidth = Math.max(2, r * 0.16);
          ctx.beginPath();
          ctx.ellipse(px(x), py(y) + r * 0.26, r * 0.62, r * 0.26, 0, 0, Math.PI * 2);
          ctx.stroke();
        };
        l.men.forEach((m) => drawFigure(ctx, p, m.marker, { ...OPP }, DEFAULT_FACE_STYLE, DEFAULT_FAKE_FACE_STYLE, { scale: FIG }));
        l.men.forEach((m, i) => {
          const colour = reveal ? (i === st.correct ? "#34d399" : i === pickedRef.current ? "#f43f5e" : null) : null;
          if (colour) ring(m.x, m.y, colour);
          drawFigure(ctx, p, m, { ...KIT }, DEFAULT_FACE_STYLE, DEFAULT_FAKE_FACE_STYLE, { scale: FIG });
        });
        ring(l.you.x, l.you.y, "#fbbf24");
        drawBall(ctx, p, { x: l.you.x + 0.9, y: l.you.y + 0.7 }, 0, FIG);
        if (phaseRef.current === "live") {
          const left = Math.max(0, 1 - (Date.now() - startedRef.current) / 1000 / setupRef.current.window);
          ctx.fillStyle = "rgba(0,0,0,0.45)";
          ctx.fillRect(0, 0, W, H * 0.018);
          ctx.fillStyle = left > 0.4 ? "#34d399" : left > 0.18 ? "#fbbf24" : "#f43f5e";
          ctx.fillRect(0, 0, W * left, H * 0.018);
        }
      }, { pixelRatio: 2 });
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [W, H, pic, settle]);

  const tap = (x0: number, y0: number) => {
    if (phaseRef.current !== "live" || !W || !H) return;
    const vp = camRef.current;
    if (!vp) return;
    const x = vp.x1 + (x0 / W) * (vp.x2 - vp.x1);
    const y = vp.y1 + (y0 / H) * (vp.y2 - vp.y1);
    let bestI = -1, bestD = 3.4;
    layoutRef.current.men.forEach((m, i) => { const d = Math.hypot(m.x - x, m.y - y); if (d < bestD) { bestD = d; bestI = i; } });
    if (bestI < 0) return;
    settle(bestI, (Date.now() - startedRef.current) / 1000);
  };

  const slotStates: SlotState[] = scoresRef.current.map((q) => (q >= 0.65 ? "scored" : q >= 0.2 ? "close" : "missed"));
  const found = scoresRef.current.filter((q) => q >= 0.65).length;
  return (
    <View>
      <TrialBoard title="You" left={<TrialSlots states={slotStates} total={REPS.vision} />} centreLabel="Find the pass" centreValue={`${found}/${REPS.vision}`}
        right={REPS.vision > 1 ? <View style={{ alignItems: "flex-end" }}><Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 9, fontWeight: "900", letterSpacing: 2 }}>GO</Text><Text style={{ color: "#fff", fontSize: 15, fontWeight: "900" }}>{Math.min(rep + 1, REPS.vision)}/{REPS.vision}</Text></View> : undefined}
        footer={`${setup.options} options · ${setup.window.toFixed(1)}s`} />
      <View onLayout={(e) => { const w = Math.round(e.nativeEvent.layout.width); if (w > 0 && w !== W) setW(w); }} style={{ marginHorizontal: 12, height: H || 300, borderRadius: 12, overflow: "hidden" }}>
        {W > 0 && H > 0 && (
          <Pressable onPressIn={(e) => tap(e.nativeEvent.locationX, e.nativeEvent.locationY)} style={{ width: W, height: H }}>
            <Canvas style={{ width: W, height: H }}><Group transform={[{ scale: 0.5 }]}><Picture picture={pic} /></Group></Canvas>
          </Pressable>
        )}
        {phase === "ready" && rep === 0 && !go && (
          <TeachCard headline="Tap the team-mate in the most space." short="Tap the man in most space."
            lines={["You are green. The red shirts are marking.", "The clock starts on zero and does not wait — never picking scores nothing."]} onDismiss={startFromTeach} />
        )}
        {phase === "ready" && !(rep === 0 && !go) && (
          <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center" }}>
            {rep === 0 && count !== null
              ? <Text style={{ color: "#6ee7b7", fontSize: 72, fontWeight: "900" }}>{count}</Text>
              : <View style={{ alignItems: "center" }}><Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 13, fontWeight: "900", letterSpacing: 2 }}>HEADS UP</Text><Text style={{ color: "#fff", fontSize: 24, fontWeight: "900" }}>Who&apos;s free?</Text></View>}
          </View>
        )}
      </View>
      <TrialCaption prompt={phase === "reveal" ? verdict : phase === "ready" && rep === 0 && !go ? "" : "Tap the team-mate in the most space."} />
    </View>
  );
}

// ── 2. Training's Vision: Pick the Pass (TrainingMinigame.tsx VisionDrillView) ──
const TRIES = 3;
type VPhase = "count" | "play" | "result";
const VISION_SCENE = { banners: false };
const camOf = (c: Cam) => ({ viewport: c.vp, facing: c.facing, tilt: c.tilt, W: c.W, H: c.H });

export function VisionDrill({ trainingLevel, skills, height, attempt, results }: { trainingLevel: number; skills: Skills; height: number; attempt: (ok: boolean) => void; results: boolean[] }) {
  const done = results.includes(true) || results.length >= TRIES;
  const cfg: VisionLevel = levelConfig("vision", trainingLevel);
  const cfgKey = JSON.stringify(cfg);
  const seed = levelSeedOf("vision", trainingLevel, cfg);
  const [ready, setReady] = useState(visionMomentsReady());
  useEffect(() => {
    if (ready) return;
    let live = true;
    void loadVisionMoments().then(() => { if (live) setReady(true); });
    return () => { live = false; };
  }, [ready]);
  const [pics, setPics] = useState<VisionPicture[]>([]);
  const [built, setBuilt] = useState(false);
  useEffect(() => {
    if (!ready) return;
    let live = true;
    setBuilt(false);
    const levelOf = (n: number) => {
      if (n === trainingLevel) return { ask: visionAsk(cfg), seed };
      const c = levelConfig("vision", n);
      return { ask: visionAsk(c), seed: levelSeedOf("vision", n, c) };
    };
    void visionLevelPicturesAsync(trainingLevel, levelOf, TRIES).then((p) => { if (live) { setPics(p); setBuilt(true); } });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, cfgKey, seed, trainingLevel]);
  const [tryIdx, setTryIdx] = useState(0);
  const pic: VisionPicture | undefined = pics[Math.min(tryIdx, pics.length - 1)];
  const [phase, setPhase] = useState<VPhase>("count");
  const [count, setCount] = useState(3);
  const [verdict, setVerdict] = useState<VisionVerdict | null>(null);
  const [left, setLeft] = useState(1);
  const [hold, setHold] = useState(false);
  const [rings, setRings] = useState<{ x: number; y: number; good: boolean }[]>([]);
  const phaseRef = useRef<VPhase>("count"); phaseRef.current = phase;
  const goAtRef = useRef(0);
  const pullAtRef = useRef<number | null>(null);
  const letGoAtRef = useRef<number | null>(null);
  const aimedRef = useRef<number | null>(null);
  const strikeOffRef = useRef<boolean[] | null>(null);
  const scRef = useRef<Scenario | null>(null);
  const frameRef = useRef<{ d: MatchDriver; cam: Cam } | null>(null);
  const picRef = useRef(pic); picRef.current = pic;

  useEffect(() => {
    setPhase("count"); setCount(3); setVerdict(null); setLeft(1); setHold(false); setRings([]);
    pullAtRef.current = null; letGoAtRef.current = null; aimedRef.current = null; strikeOffRef.current = null; scRef.current = null;
  }, [tryIdx, cfgKey]);
  useEffect(() => {
    if (phase !== "count" || !pic) return;
    const t = setTimeout(() => { if (count > 1) setCount(count - 1); else { goAtRef.current = Date.now(); setPhase("play"); } }, 650);
    return () => clearTimeout(t);
  }, [phase, count, pic]);

  const ringMen = useCallback((picked: number | null) => {
    const p = picRef.current, f = frameRef.current;
    if (!p || !f) return;
    const sc = f.d.sc;
    // The figure the match drew as run{i} (CanvasMatch's sids: the runner, then the others).
    const runners = [...(sc.runner ? [sc.runner] : []), ...sc.secondaryRunners];
    const at = (i: number) => { const r = runners[i]; return camToBox(camOf(f.cam), r ? r.pos : p.options[i]); };
    const out = [{ ...at(p.best), good: true }];
    if (picked !== null && picked !== p.best) out.push({ ...at(picked), good: false });
    setRings(out);
  }, []);
  const finish = useCallback((v: VisionVerdict, picked: number | null) => {
    if (phaseRef.current === "result") return;
    phaseRef.current = "result";
    setPhase("result"); setVerdict(v); ringMen(picked); attempt(v.ok);
  }, [attempt, ringMen]);
  useEffect(() => {
    if (phase !== "result" || !verdict) return;
    const freeze = setTimeout(() => setHold(true), cfg.kick ? 1300 : 0);
    const next = setTimeout(() => { if (!verdict.ok && tryIdx < TRIES - 1) setTryIdx(tryIdx + 1); }, 2300);
    return () => { clearTimeout(freeze); clearTimeout(next); };
  }, [phase, verdict, tryIdx, cfg.kick]);
  // The clock: tap levels until the tap; kick levels until the pull starts, then the let-go time.
  useEffect(() => {
    if (phase !== "play") return;
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (phaseRef.current !== "play") return;
      const now = Date.now(), p = picRef.current;
      if (!p) return;
      if (!cfg.kick || pullAtRef.current === null) {
        const spent = (now - goAtRef.current) / 1000;
        setLeft(Math.max(0, 1 - spent / cfg.window));
        if (spent > cfg.window) finish(judgeTap(p, null), null);
      } else if (letGoAtRef.current === null) {
        const held = (now - pullAtRef.current) / 1000;
        setLeft(Math.max(0, 1 - held / cfg.letGo));
        if (held > cfg.letGo) finish(judgeTap(p, null), null);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, cfg.kick, cfg.window, cfg.letGo, finish]);
  // The match's frames: where everyone is drawn, and (kick levels) when your pull starts and is let go.
  const onFrame = useCallback((d: MatchDriver, cam: Cam) => {
    frameRef.current = { d, cam };
    if (!cfg.kick || phaseRef.current !== "play") return;
    if (pullAtRef.current === null && (d.drag || d.phase !== "aim")) pullAtRef.current = Date.now();
    if (d.drag && d.phase === "aim" && picRef.current) aimedRef.current = aimedMan(picRef.current, { x: d.sc.ball.x - d.drag.x, y: d.sc.ball.y - d.drag.y });
    if (letGoAtRef.current === null && d.phase !== "aim") letGoAtRef.current = Date.now();
  }, [cfg.kick]);
  const openOn = useCallback((): Scenario => {
    const p = picRef.current!;
    const sc = visionScenario(p, (seed + tryIdx * 7919) >>> 0);
    scRef.current = sc;
    return sc;
  }, [seed, tryIdx]);
  const onBallStep = useCallback(() => {
    const p = picRef.current, sc = scRef.current;
    if (!p || !sc || phaseRef.current !== "play") return;
    if (!strikeOffRef.current) strikeOffRef.current = sc.secondaryRunners.map((r) => !!r.offside);
    const v = judgeKick(p, sc, null, aimedRef.current, strikeOffRef.current);
    if (v) finish(v, sc.receivedBy ? sc.secondaryRunners.indexOf(sc.receivedBy) : aimedRef.current);
  }, [finish]);
  const onChanceResolved = useCallback((info: ChanceResolved) => {
    const p = picRef.current, sc = scRef.current;
    if (!p || !sc) return;
    if (phaseRef.current === "result") { setHold(true); return; }
    const v = judgeKick(p, sc, info.outcome, aimedRef.current, strikeOffRef.current ?? undefined);
    if (v) finish(v, sc.receivedBy ? sc.secondaryRunners.indexOf(sc.receivedBy) : aimedRef.current);
  }, [finish]);
  const tap = (X: number, Y: number) => {
    const p = picRef.current, f = frameRef.current;
    if (!p || !f || phaseRef.current !== "play" || cfg.kick) return;
    const i = tapPick(camOf(f.cam), p.options, X, Y);
    if (i >= 0) finish(judgeTap(p, i), i);
  };
  const real = pic?.source === "real";
  const instruction = verdict ? verdict.line : cfg.kick
    ? `Play the pass: drag back from the ball to aim at him, then strike it. Start inside ${cfg.window.toFixed(1)}s.`
    : "Tap the team-mate you'd pass to. Not offside, not marked, nobody in the way.";
  return (
    <View>
      <Text style={{ color: C.text, fontSize: 12, fontWeight: "700", textAlign: "center", paddingHorizontal: 12, marginBottom: 6 }}>{instruction}</Text>
      <View style={{ height, borderRadius: 12, overflow: "hidden" }}>
        {!pic ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><Text style={{ color: "rgba(255,255,255,0.7)", fontWeight: "900" }}>{built ? "No pictures for this level." : "Loading real moments…"}</Text></View>
        ) : !done || phase === "result" ? (
          <EngineFeature key={`${tryIdx}-${pic.id}`} height={height} openOn={openOn} onBallStep={onBallStep} onChanceResolved={onChanceResolved}
            skills={{ power: skills.power, technique: skills.technique }} seed={(seed + tryIdx) >>> 0} scene={VISION_SCENE} onFrame={onFrame} frozen={hold} />
        ) : null}
        {phase === "play" && (
          <View pointerEvents="none" style={{ position: "absolute", left: 8, right: 8, top: 8, height: 6, borderRadius: 3, backgroundColor: "rgba(0,0,0,0.45)", overflow: "hidden" }}>
            <View style={{ width: `${left * 100}%`, height: 6, borderRadius: 3, backgroundColor: left > 0.4 ? "#34d399" : "#f87171" }} />
          </View>
        )}
        {pic && ((phase === "play" && !cfg.kick) || phase === "result") && (
          <Pressable onPressIn={(e) => tap(e.nativeEvent.locationX, e.nativeEvent.locationY)} style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }} />
        )}
        {phase === "result" && rings.map((g, i) => (
          <View key={i} pointerEvents="none" style={{ position: "absolute", left: g.x - 23, top: g.y - 10, width: 46, height: 20, borderRadius: 23, borderWidth: 3, borderColor: g.good ? "#34d399" : "#ef4444" }}>
            <View style={{ position: "absolute", left: 13, top: -36, width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: g.good ? "#10b981" : "#ef4444" }}>
              <Text style={{ color: "#fff", fontSize: 12, fontWeight: "900" }}>{g.good ? "✓" : "✗"}</Text>
            </View>
          </View>
        ))}
        {pic && phase === "count" && (
          <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "#030712", alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: "#fff", fontSize: 72, fontWeight: "900" }}>{count}</Text>
            <Text style={{ color: "#6ee7b7", fontSize: 16, fontWeight: "900", marginTop: 8 }}>{cfg.kick ? "Who gets the pass? Kick it to him" : "Who gets the pass?"}</Text>
          </View>
        )}
        {verdict && (
          <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ backgroundColor: verdict.ok ? "rgba(16,185,129,0.85)" : "rgba(220,38,38,0.85)", color: "#fff", fontSize: 28, fontWeight: "900", fontStyle: "italic", paddingHorizontal: 20, paddingVertical: 8, borderRadius: 16, overflow: "hidden" }}>{verdict.word}</Text>
          </View>
        )}
      </View>
      {real && pic && (
        <Text style={{ marginTop: 4, paddingHorizontal: 8, textAlign: "center", color: "rgba(255,255,255,0.55)", fontSize: 9.5 }}>
          {phase === "result" && pic.match ? `${pic.match}, ${pic.minute}'. ` : "A real moment. "}{REAL_CREDIT[(pic.src ?? "dfl") as keyof typeof REAL_CREDIT] ?? ""}
        </Text>
      )}
    </View>
  );
}
