/**
 * THE SAME DOOR, FOR A FEATURE THAT IS PART OF THE GAME (the website's
 * EngineFeature in components/star/EnginePlay.tsx): the trial's stages and
 * the training drills play real football on the ONE match driver
 * (src/match/driver.ts in feature mode), with the player's own skills.
 *
 * What makes the feature a feature is what it wraps AROUND this: its own
 * scoring from onChanceResolved, its own teaching cards, its own reps. Also
 * here: StrikeStage (the trial's strike stages, stages/TrialPenalties.tsx)
 * and TeachCard, ported from the website line for line in what they decide.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { View, Text, Pressable, type ViewStyle } from "react-native";
import { Canvas, Circle, Line, Path, Group, DashPathEffect, Skia, vec } from "@shopify/react-native-skia";
import { ROLE_KIT } from "@/lib/star/fiveASide/render";
import type { MatchKits } from "@/lib/star/kits";
import type { Outcome, Scenario } from "@/lib/star/canvasEngine";
import type { ScenePicture } from "@/lib/star/scenePicture";
import type { PenaltyReadSettings } from "@/lib/star/penaltyKeeper";
import type { PenaltyRunupId, FreeKickRunupId } from "@/lib/star/runupStyles";
import { mulberry32 } from "@/lib/star/season";
import { trialInvisibleStats, strikeQuality, teachSeen, markTeachSeen, type TeachableDrill } from "@/lib/star/trialStages";
import { MatchDriver } from "../match/driver";
import { featureSetup, type ChanceResolved, type FeatureSpec } from "../match/setup";
import { MatchPitch } from "./MatchPitch";
import type { Cam } from "../match/view";
import { C } from "../ui/theme";
import { FONT } from "../ui/look";

/** CanvasMatch's kits with no career and no fixture: the shared role colours. */
export const FEATURE_KITS: MatchKits = {
  home: { shirt: ROLE_KIT.mate, trim: ROLE_KIT.mateRim },
  away: { shirt: ROLE_KIT.opp, trim: ROLE_KIT.oppRim },
  keeper: { shirt: ROLE_KIT.gk, trim: ROLE_KIT.gkRim },
};

export interface EngineFeatureProps {
  openOn: () => Scenario;
  onChanceResolved?: (info: ChanceResolved) => void;
  skills: { power: number; technique: number; aerial?: number };
  setPieceSkill?: number;
  keeperStrength?: number;
  penaltyRead?: Partial<PenaltyReadSettings>;
  seed?: number;
  markers?: { x: number; y: number; color?: string }[];
  onBallStep?: (ball: { x: number; y: number; z: number }) => void;
  scene?: ScenePicture;
  penaltyRunup?: PenaltyRunupId;
  freeKickRunup?: FreeKickRunupId;
  holdAt?: (moment: "runup" | "contact", release: () => void) => boolean;
  /** The pitch box's height (the website: the real match's canvas, 5:8 and taller). */
  height: number;
  children?: ReactNode;
  /** The website's EngineFrame observer: every drawn frame and its camera, and `frozen` (hold). */
  onFrame?: (d: MatchDriver, cam: Cam) => void;
  frozen?: boolean;
  /** Coach the first chance (MatchPitch coachFirst). */
  coachFirst?: boolean;
}

export function EngineFeature(p: EngineFeatureProps) {
  // The props are read again at every chance (the website re-renders CanvasMatch with them).
  const live = useRef(p);
  live.current = p;
  const make = useCallback((hw: number) => {
    const P = live.current;
    const spec: FeatureSpec = {
      openOn: () => live.current.openOn(),
      onChanceResolved: (i) => live.current.onChanceResolved?.(i),
      onBallStep: (b) => live.current.onBallStep?.(b),
      markers: () => live.current.markers,
      scene: P.scene,
      keeperStrength: () => live.current.keeperStrength ?? 62,
      penaltyRead: () => live.current.penaltyRead,
      setPieceSkill: P.setPieceSkill,
      aerial: P.skills.aerial,
      holdAt: P.holdAt ? (m, r) => live.current.holdAt?.(m, r) ?? false : undefined,
    };
    return new MatchDriver(featureSetup(spec, { skills: { power: P.skills.power, technique: P.skills.technique }, seed: P.seed, penaltyRunup: P.penaltyRunup, freeKickRunup: P.freeKickRunup }), { hw });
  }, []);
  return (
    <View style={{ height: p.height, marginHorizontal: 12, borderRadius: 12, borderWidth: 2, borderColor: "rgba(6,95,70,0.8)", overflow: "hidden", backgroundColor: "#22920b", boxShadow: "0px 18px 40px -12px rgba(2,44,34,0.6)" } as ViewStyle}>
      <MatchPitch make={make} kits={FEATURE_KITS} height={p.height} banners={p.scene?.banners !== false} onFrame={p.onFrame} frozen={p.frozen} coachFirst={p.coachFirst} />
      {p.children}
    </View>
  );
}

// ── The trial's look (stages/TrialFrame.tsx): the board over the pitch, the slots, the caption ──

export type SlotState = "scored" | "close" | "missed";
/** TrialFrame.tsx TrialSlot: ✓ green, ✗ red, ~ amber, or an empty ring still to come (★ in yours). */
export function TrialSlots({ states, total, youAt }: { states: SlotState[]; total: number; youAt?: number }) {
  const FILL: Record<SlotState, { bg: string; ink: string; mark: string; glow: string }> = {
    scored: { bg: "#10b981", ink: "#fff", mark: "✓", glow: "0px 0px 8px rgba(16,185,129,0.7)" },
    close: { bg: "#fbbf24", ink: "#030712", mark: "~", glow: "0px 0px 8px rgba(251,191,36,0.6)" },
    missed: { bg: "#f43f5e", ink: "#fff", mark: "✗", glow: "0px 0px 8px rgba(244,63,94,0.6)" },
  };
  return (
    <View style={{ flexDirection: "row", gap: 4, marginTop: 2 }}>
      {Array.from({ length: total }, (_, i) => {
        const st = states[i];
        const you = youAt !== undefined && i === youAt;
        if (!st) {
          return (
            <View key={i} style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: you ? "#7dd3fc" : "rgba(255,255,255,0.45)", backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" }}>
              {you ? <Text style={{ color: "#bae6fd", fontSize: 10, fontWeight: "900" }}>★</Text> : null}
            </View>
          );
        }
        const f = FILL[st];
        return (
          <View key={i} style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: f.bg, alignItems: "center", justifyContent: "center", boxShadow: f.glow } as ViewStyle}>
            <Text style={{ color: f.ink, fontSize: 12, fontWeight: "900" }}>{f.mark}</Text>
          </View>
        );
      })}
    </View>
  );
}
/** TrialFrame.tsx TrialBoard: the stage's scoreboard strip right above the pitch. */
export function TrialBoard({ title, left, centreLabel, centreValue, right, footer }: { title: string; left?: ReactNode; centreLabel: string; centreValue: ReactNode; right?: ReactNode; footer?: ReactNode }) {
  return (
    <View style={{ marginHorizontal: 12, marginBottom: 6, borderRadius: 12, paddingHorizontal: 12, paddingTop: 4, paddingBottom: 6,
      backgroundImage: "linear-gradient(180deg, rgba(8,14,28,0.9), rgba(8,14,28,0.78))",
      boxShadow: "0px 6px 16px -6px rgba(0,0,0,0.8), inset 0px 1px 0px rgba(255,255,255,0.12)" } as ViewStyle}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ color: "#7dd3fc", fontSize: 11, fontWeight: "900", letterSpacing: 0.3, textTransform: "uppercase" }}>{title}</Text>
          {left}
        </View>
        <View style={{ alignItems: "center" }}>
          <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 9, fontWeight: "900", letterSpacing: 1.8, textTransform: "uppercase" }}>{centreLabel}</Text>
          {typeof centreValue === "string"
            ? <Text style={{ color: "#fff", fontFamily: FONT.display, fontSize: 26, lineHeight: 30 }}>{centreValue}</Text>
            : centreValue}
        </View>
        <View style={{ flex: 1, minWidth: 0, alignItems: "flex-end" }}>{right}</View>
      </View>
      <Text style={{ marginTop: 3, minHeight: 14, textAlign: "center", color: "rgba(255,255,255,0.75)", fontSize: 10.5, fontWeight: "900", letterSpacing: 0.3, textTransform: "uppercase" }}>{footer ?? ""}</Text>
    </View>
  );
}
/** TrialFrame.tsx TrialCaption: what just happened, then what to do. */
export function TrialCaption({ line, prompt }: { line?: string; prompt?: string }) {
  return (
    <View style={{ paddingHorizontal: 12, paddingTop: 6, alignItems: "center" }}>
      <Text style={{ minHeight: 16, color: "rgba(255,255,255,0.75)", fontSize: 12, fontWeight: "700", textAlign: "center" }}>{line ?? ""}</Text>
      <Text style={{ minHeight: 16, color: "#fff", fontSize: 13, fontWeight: "900", textAlign: "center" }}>{prompt ?? ""}</Text>
    </View>
  );
}

export type TeachGesture = "drag" | "tap" | "flick" | "strike" | "run";
/**
 * TrialPenalties.tsx TeachGlyph, one per gesture the trial asks for (a drag arrow on the
 * stage you tap is a wrong instruction): drag = pull back from the ball; tap = a ring round
 * a man and a finger; strike = the big ball, its countdown ring, a tap on its side; run = you
 * jogging in to the ball; flick = a quick swipe past.
 */
function DragGlyph({ gesture = "drag" }: { gesture?: TeachGesture }) {
  const head = useMemo(() => { const b = Skia.PathBuilder.Make(); b.moveTo(46, 5); b.lineTo(51, 14); b.lineTo(41, 14); b.close(); return b.build(); }, []);
  const finger = useMemo(() => { const b = Skia.PathBuilder.Make(); b.moveTo(44, 38); b.lineTo(52, 30); b.lineTo(58, 42); b.close(); return b.build(); }, []);
  const flickHead = useMemo(() => { const b = Skia.PathBuilder.Make(); b.moveTo(56, 16); b.lineTo(48, 12); b.lineTo(50, 22); b.close(); return b.build(); }, []);
  if (gesture === "tap") return (
    <Canvas style={{ width: 32, height: 24 }}>
      <Group transform={[{ scale: 0.5 }]}>
        <Circle cx={30} cy={24} r={13} color="#fbbf24" style="stroke" strokeWidth={2}><DashPathEffect intervals={[4, 3]} /></Circle>
        <Circle cx={30} cy={24} r={6.5} color="#f8fafc" />
        <Circle cx={30} cy={24} r={6.5} color="#0f172a" style="stroke" strokeWidth={1.5} />
        <Path path={finger} color="#f97316" />
      </Group>
    </Canvas>
  );
  if (gesture === "strike") return (
    <Canvas style={{ width: 32, height: 24 }}>
      <Group transform={[{ scale: 0.5 }]}>
        <Circle cx={30} cy={24} r={17} color="#fbbf24" style="stroke" strokeWidth={3}><DashPathEffect intervals={[80, 30]} /></Circle>
        <Circle cx={30} cy={24} r={12} color="#f8fafc" />
        <Circle cx={30} cy={24} r={12} color="#0f172a" style="stroke" strokeWidth={1.5} />
        <Circle cx={38} cy={26} r={3.2} color="#f97316" />
      </Group>
    </Canvas>
  );
  if (gesture === "run") return (
    <Canvas style={{ width: 32, height: 24 }}>
      <Group transform={[{ scale: 0.5 }]}>
        <Line p1={vec(8, 40)} p2={vec(40, 30)} color="#fbbf24" style="stroke" strokeWidth={2.5} strokeCap="round"><DashPathEffect intervals={[4, 3]} /></Line>
        <Circle cx={10} cy={40} r={5} color="#0ea5e9" />
        <Circle cx={10} cy={40} r={5} color="#0f172a" style="stroke" strokeWidth={1.5} />
        <Circle cx={48} cy={28} r={6} color="#f8fafc" />
        <Circle cx={48} cy={28} r={6} color="#0f172a" style="stroke" strokeWidth={1.5} />
      </Group>
    </Canvas>
  );
  if (gesture === "flick") return (
    <Canvas style={{ width: 32, height: 24 }}>
      <Group transform={[{ scale: 0.5 }]}>
        <Circle cx={18} cy={30} r={6} color="#f8fafc" />
        <Circle cx={18} cy={30} r={6} color="#0f172a" style="stroke" strokeWidth={1.5} />
        <Line p1={vec(26, 30)} p2={vec(52, 18)} color="#fbbf24" style="stroke" strokeWidth={2.5} strokeCap="round"><DashPathEffect intervals={[5, 3]} /></Line>
        <Path path={flickHead} color="#f97316" />
      </Group>
    </Canvas>
  );
  return (
    <Canvas style={{ width: 32, height: 24 }}>
      <Group transform={[{ scale: 0.5 }]}>
        <Line p1={vec(46, 30)} p2={vec(12, 42)} color="#fbbf24" style="stroke" strokeWidth={2.5} strokeCap="round"><DashPathEffect intervals={[4, 3]} /></Line>
        <Circle cx={12} cy={42} r={4.5} color="#fbbf24" style="stroke" strokeWidth={2} />
        <Line p1={vec(46, 30)} p2={vec(46, 10)} color="#f97316" style="stroke" strokeWidth={3} strokeCap="round" />
        <Path path={head} color="#f97316" />
        <Circle cx={46} cy={30} r={6} color="#f8fafc" />
        <Circle cx={46} cy={30} r={6} color="#0f172a" style="stroke" strokeWidth={1.5} />
      </Group>
    </Canvas>
  );
}

/** stages/TrialPenalties.tsx TeachCard (the full-screen form: a tap anywhere closes it). */
export function TeachCard({ headline, lines, short, compact = false, place = "middle", gesture = "drag", onDismiss }: {
  headline: string; lines: string[]; short?: string; compact?: boolean; place?: "middle" | "top" | "bottom"; gesture?: TeachGesture; onDismiss: () => void;
}) {
  void compact; void short;
  return (
    <Pressable onPress={onDismiss} style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.25)", paddingHorizontal: 16, alignItems: "center", justifyContent: place === "top" ? "flex-start" : place === "bottom" ? "flex-end" : "center", paddingTop: place === "top" ? "30%" : 0, paddingBottom: place === "bottom" ? "22%" : 0 }}>
      <View style={{ width: "100%", maxWidth: 320 }}>
        <View style={{ borderRadius: 12, borderWidth: 2, borderColor: "rgba(251,191,36,0.7)", backgroundColor: "rgba(255,255,255,0.75)", paddingHorizontal: 12, paddingVertical: 8, boxShadow: "0px 10px 18px rgba(0,0,0,0.25)" } as ViewStyle}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <DragGlyph gesture={gesture} />
            <View style={{ backgroundColor: "#fbbf24", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
              <Text style={{ fontSize: 9, fontWeight: "900", letterSpacing: 1.6, color: "#000" }}>HOW TO PLAY</Text>
            </View>
          </View>
          <Text style={{ marginTop: 6, fontSize: 12, fontWeight: "900", color: "#111827", lineHeight: 15 }}>{headline}</Text>
          {lines.map((l) => <Text key={l} style={{ marginTop: 2, fontSize: 10.5, fontWeight: "700", color: "#374151", lineHeight: 14 }}>{l}</Text>)}
        </View>
        <Text style={{ marginTop: 8, textAlign: "center", fontSize: 10, fontWeight: "700", letterSpacing: 2, color: "rgba(255,255,255,0.45)" }}>TAP ANYWHERE TO CONTINUE</Text>
      </View>
    </Pressable>
  );
}

/** stages/TrialPenalties.tsx OUTCOME_LINE. */
export const OUTCOME_LINE: Partial<Record<Outcome, string>> = {
  goal: "Scored!", rebound: "In off the rebound!", saved: "Saved.", tipped: "Tipped away.", caught: "Caught.",
  wide: "Wide.", over: "Over the bar.", post: "Off the post!", short: "Not enough on it.", blocked: "Into the wall.",
  tackled: "Charged down.", offside: "Flag up.", delivered: "Cleared.",
};
const LAST_RESULT_HOLD_MS = 1400;

export interface StrikeStageProps {
  reps: number;
  build: (rep: number, rng: () => number) => Scenario;
  skills: { power: number; technique: number };
  seed: number;
  title: string;
  hint: string;
  subtitle?: (rep: number) => string;
  teach?: { headline: string; lines: string[]; short?: string; place?: "middle" | "top" | "bottom" };
  drill: TeachableDrill;
  keeperStrengthFor?: (rep: number) => number;
  penaltyRead?: Partial<PenaltyReadSettings>;
  penaltyReadFor?: (rep: number) => Partial<PenaltyReadSettings>;
  onDone: (quality: number) => void;
  forceCompactTeach?: boolean;
  penaltyRunup?: PenaltyRunupId;
  freeKickRunup?: FreeKickRunupId;
  scene?: ScenePicture;
  markersFor?: (rep: number) => { x: number; y: number; color?: string }[];
  onBallStep?: (ball: { x: number; y: number; z: number }) => void;
  judge?: (info: ChanceResolved) => { quality: number; text: string };
  pauseTeach?: Partial<Record<"runup" | "contact", { drill: TeachableDrill; headline: string; lines: string[]; place?: "middle" | "top" | "bottom"; gesture?: TeachGesture }>>;
  height: number;
}

/** stages/TrialPenalties.tsx StrikeStage: reps of one strike, scored the website's way. */
export function StrikeStage({
  reps, build, skills, seed, title, hint, subtitle, teach, drill, keeperStrengthFor,
  penaltyRead, penaltyReadFor, onDone, forceCompactTeach = false, penaltyRunup, freeKickRunup,
  scene, markersFor, onBallStep, judge, pauseTeach, height,
}: StrikeStageProps) {
  const [paused, setPaused] = useState<{ moment: "runup" | "contact"; release: () => void } | null>(null);
  const pauseTeachRef = useRef(pauseTeach);
  pauseTeachRef.current = pauseTeach;
  const holdAt = useCallback((moment: "runup" | "contact", release: () => void) => {
    const t = pauseTeachRef.current?.[moment];
    if (!t || teachSeen(t.drill)) return false;
    setPaused({ moment, release });
    return true;
  }, []);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const closePause = useCallback(() => {
    const pp = pausedRef.current;
    if (!pp) return;
    pausedRef.current = null;
    const t = pauseTeachRef.current?.[pp.moment];
    if (t) markTeachSeen(t.drill);
    setPaused(null);
    pp.release();
  }, []);
  const pauseCard = paused ? pauseTeach?.[paused.moment] : undefined;
  const [rep, setRep] = useState(0);
  const repRef = useRef(0);
  const [scores, setScores] = useState<number[]>([]);
  const scoresRef = useRef<number[]>([]);
  const doneRef = useRef(false);
  const [resultText, setResultText] = useState("");
  const [struckOnce, setStruckOnce] = useState(false);
  const [teachDone, setTeachDone] = useState(false);
  useEffect(() => { if (teachSeen(drill)) setTeachDone(true); }, [drill]);
  const dismissTeach = useCallback(() => { markTeachSeen(drill); setTeachDone(true); }, [drill]);
  const buildRef = useRef(build);
  buildRef.current = build;
  const openOn = useCallback(() => {
    const r = repRef.current;
    return buildRef.current(r, mulberry32((seed ^ ((r + 1) * 0x9e3779b1)) >>> 0));
  }, [seed]);
  const pointsRef = useRef<number[]>([]);
  const judgeRef = useRef(judge);
  judgeRef.current = judge;
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const onChanceResolved = useCallback((info: ChanceResolved) => {
    if (doneRef.current) return;
    setStruckOnce(true);
    const judged = judgeRef.current?.(info);
    if (judged) {
      scoresRef.current = [...scoresRef.current, judged.quality];
      pointsRef.current = [...pointsRef.current, judged.quality];
      setScores(scoresRef.current);
      setResultText(judged.text);
      const nextRep = repRef.current + 1;
      if (nextRep >= reps) {
        doneRef.current = true;
        const quality = pointsRef.current.reduce((a, b) => a + b, 0) / pointsRef.current.length;
        setTimeout(() => onDoneRef.current(quality), LAST_RESULT_HOLD_MS);
      } else { repRef.current = nextRep; setRep(nextRep); }
      return;
    }
    const reached = info.outcome === "goal" || info.outcome === "rebound" || info.outcome === "wide" || info.outcome === "over" || info.outcome === "post";
    const crossX = reached && info.ball ? info.ball.x : null;
    const yours = !info.teammateShot;
    const q = yours ? strikeQuality(info.outcome, crossX) : strikeQuality("saved", null);
    scoresRef.current = [...scoresRef.current, q];
    const pts = !yours ? 0 : info.outcome === "goal" || info.outcome === "rebound" ? 1 : info.outcome === "saved" || info.outcome === "tipped" ? 0.5 : 0;
    pointsRef.current = [...pointsRef.current, pts];
    setScores(scoresRef.current);
    setResultText(!yours ? "A team-mate gets on the end of it." : (OUTCOME_LINE[info.outcome] ?? "Away."));
    const next = repRef.current + 1;
    if (next >= reps) {
      doneRef.current = true;
      const goals = scoresRef.current.filter((x) => x >= 0.55).length;
      const quality = drill === "penalties" ? goals / scoresRef.current.length : pointsRef.current.reduce((a, b) => a + b, 0) / pointsRef.current.length;
      setTimeout(() => onDoneRef.current(quality), LAST_RESULT_HOLD_MS);
    } else { repRef.current = next; setRep(next); }
  }, [reps, drill]);
  const trial = useMemo(() => trialInvisibleStats(), []);
  const showTeach = !struckOnce && rep === 0 && !!teach && !teachDone;
  const goodAt = drill === "technique" ? 0.45 : 0.55;
  const slotStates: SlotState[] = scores.map((q) => (q >= goodAt ? "scored" : q >= 0.3 ? "close" : "missed"));
  const good = scores.filter((q) => q >= goodAt).length;
  return (
    <View>
      <TrialBoard title="You" left={<TrialSlots states={slotStates} total={reps} />} centreLabel={title} centreValue={`${good}/${reps}`}
        right={reps > 1 ? <View style={{ alignItems: "flex-end" }}><Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 9, fontWeight: "900", letterSpacing: 1.5 }}>ATTEMPT</Text><Text style={{ color: "#fff", fontSize: 15, fontWeight: "900" }}>{Math.min(rep + 1, reps)}/{reps}</Text></View> : undefined}
        footer={subtitle?.(rep)} />
      <EngineFeature
        height={height}
        openOn={openOn}
        onChanceResolved={onChanceResolved}
        skills={skills}
        setPieceSkill={trial.setPieceSkill}
        keeperStrength={keeperStrengthFor?.(rep) ?? 62}
        penaltyRead={penaltyReadFor ? penaltyReadFor(rep) : penaltyRead}
        seed={seed}
        scene={scene ?? { teammates: false }}
        markers={markersFor?.(rep)}
        onBallStep={onBallStep}
        penaltyRunup={penaltyRunup}
        freeKickRunup={freeKickRunup}
        holdAt={pauseTeach ? holdAt : undefined}
      >
        {pauseCard && <TeachCard headline={pauseCard.headline} lines={pauseCard.lines} place={pauseCard.place} gesture={pauseCard.gesture} onDismiss={closePause} />}
        {showTeach && teach && <TeachCard headline={teach.headline} lines={teach.lines} short={teach.short} place={teach.place} compact={forceCompactTeach} onDismiss={dismissTeach} />}
      </EngineFeature>
      <TrialCaption line={resultText} prompt={resultText || showTeach ? "" : hint} />
    </View>
  );
}

export const featureText = { colour: C.text };
