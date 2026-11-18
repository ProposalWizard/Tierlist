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
import { View, Text, Pressable } from "react-native";
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
import { C } from "../ui/theme";

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
    <View style={{ height: p.height, overflow: "hidden", borderRadius: 12 }}>
      <MatchPitch make={make} kits={FEATURE_KITS} height={p.height} banners={p.scene?.banners !== false} />
      {p.children}
    </View>
  );
}

// ── The trial's look (stages/TrialFrame.tsx): the board over the pitch, the slots, the caption ──

export type SlotState = "scored" | "close" | "missed";
export function TrialSlots({ states, total }: { states: SlotState[]; total: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 4 }}>
      {Array.from({ length: total }, (_, i) => {
        const s = states[i];
        return <View key={i} style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: !s ? "transparent" : s === "scored" ? "#10b981" : s === "close" ? "#f59e0b" : "#dc2626", borderWidth: s ? 0 : 1.5, borderColor: "rgba(255,255,255,0.35)" }} />;
      })}
    </View>
  );
}
export function TrialBoard({ title, left, centreLabel, centreValue, right, footer }: { title: string; left?: ReactNode; centreLabel: string; centreValue: ReactNode; right?: ReactNode; footer?: ReactNode }) {
  return (
    <View style={{ marginHorizontal: 12, marginBottom: 8, borderRadius: 12, backgroundColor: "rgba(8,14,28,0.9)", padding: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: "#7dd3fc", fontSize: 11, fontWeight: "900", textTransform: "uppercase" }}>{title}</Text>
          <View style={{ marginTop: 3 }}>{left}</View>
        </View>
        <View style={{ alignItems: "center", paddingHorizontal: 8 }}>
          <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 9, fontWeight: "900", letterSpacing: 1.5, textTransform: "uppercase" }}>{centreLabel}</Text>
          <Text style={{ color: "#fff", fontSize: 20, fontWeight: "900" }}>{centreValue}</Text>
        </View>
        <View style={{ flex: 1, alignItems: "flex-end" }}>{right}</View>
      </View>
      {footer ? <Text style={{ marginTop: 5, textAlign: "center", color: "rgba(255,255,255,0.75)", fontSize: 11, fontWeight: "700" }}>{footer}</Text> : null}
    </View>
  );
}
export function TrialCaption({ line, prompt }: { line?: string; prompt?: string }) {
  return (
    <View style={{ minHeight: 44, paddingHorizontal: 16, paddingTop: 8, alignItems: "center" }}>
      {line ? <Text style={{ color: "#fff", fontSize: 16, fontWeight: "900" }}>{line}</Text> : null}
      {prompt ? <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 13, fontWeight: "700", textAlign: "center" }}>{prompt}</Text> : null}
    </View>
  );
}

/** stages/TrialPenalties.tsx TeachCard (the full-screen form: a tap anywhere closes it). */
export function TeachCard({ headline, lines, short, compact = false, place = "middle", onDismiss }: {
  headline: string; lines: string[]; short?: string; compact?: boolean; place?: "middle" | "top" | "bottom"; onDismiss: () => void;
}) {
  void compact; void short;
  return (
    <Pressable onPress={onDismiss} style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.25)", paddingHorizontal: 16, justifyContent: place === "top" ? "flex-start" : place === "bottom" ? "flex-end" : "center", paddingTop: place === "top" ? "30%" : 0, paddingBottom: place === "bottom" ? "22%" : 0 }}>
      <View style={{ borderRadius: 12, borderWidth: 2, borderColor: "rgba(251,191,36,0.7)", backgroundColor: "rgba(255,255,255,0.88)", paddingHorizontal: 12, paddingVertical: 9 }}>
        <View style={{ alignSelf: "flex-start", backgroundColor: "#fbbf24", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
          <Text style={{ fontSize: 9, fontWeight: "900", letterSpacing: 1.5, color: "#000" }}>HOW TO PLAY</Text>
        </View>
        <Text style={{ marginTop: 6, fontSize: 13, fontWeight: "900", color: "#111827" }}>{headline}</Text>
        {lines.map((l) => <Text key={l} style={{ marginTop: 2, fontSize: 11.5, fontWeight: "700", color: "#374151" }}>{l}</Text>)}
      </View>
      <Text style={{ marginTop: 8, textAlign: "center", fontSize: 10, fontWeight: "700", letterSpacing: 2, color: "rgba(255,255,255,0.5)" }}>TAP ANYWHERE TO CONTINUE</Text>
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
  pauseTeach?: Partial<Record<"runup" | "contact", { drill: TeachableDrill; headline: string; lines: string[]; place?: "middle" | "top" | "bottom" }>>;
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
        {pauseCard && <TeachCard headline={pauseCard.headline} lines={pauseCard.lines} place={pauseCard.place} onDismiss={closePause} />}
        {showTeach && teach && <TeachCard headline={teach.headline} lines={teach.lines} short={teach.short} place={teach.place} compact={forceCompactTeach} onDismiss={dismissTeach} />}
      </EngineFeature>
      <TrialCaption line={resultText} prompt={resultText || showTeach ? "" : hint} />
    </View>
  );
}

export const featureText = { colour: C.text };
