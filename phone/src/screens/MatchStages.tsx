/**
 * THE TRIAL'S STAGES AND THE TRAINING DRILLS THAT PLAY ON THE MATCH — the
 * website's stages/TrialFreeKicks.tsx, TrialTechnique.tsx, TrialShootout.tsx
 * and TrainingMinigame.tsx's StrikeDrill, on the phone's EngineFeature.
 * Same pictures (match/drills.ts), same lib/star scoring, same reps and tries.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, useWindowDimensions, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Scenario } from "@/lib/star/canvasEngine";
import { buildScenario, initDefenders } from "@/lib/star/canvasEngine";
import { mulberry32 } from "@/lib/star/season";
import { CX, PEN_SPOT_Y } from "@/lib/star/pitch";
import type { Skills } from "@/lib/star/types";
import type { TrialProgress } from "@/lib/star/trial";
import { difficultyFor } from "@/lib/star/trial";
import {
  REPS, ladderLevel, techniqueSetup, freeKickSetup, attemptSeed, shootoutKeeperFor, shootoutOurKeeperFor, dribbleSetup, dribbleQuality,
  shootoutQuality, shootoutTheirRating, trialInvisibleStats, teachSeen, markTeachSeen,
} from "@/lib/star/trialStages";
import {
  createRig, createRigScript, rigApply, rigNextSide, rigIntent, rigKicksTaken, rigPlanFor, rigKeeperRead,
  isYourKick, winningPenaltyScored, rigGoals, pickRunups, idForRunup, MISS_LINE, SHOOTOUT_KICKS, type RigState, type RigScript,
} from "@/lib/star/trialShootoutRig";
import { attachAutoKick, clearForShootout, type PenaltyTaker } from "@/lib/star/penaltyTaking";
import { generateSquad } from "@/lib/star/squadData";
import { fakeFaceFor } from "@/lib/star/fakeFaces";
import { runupName, takerPenaltyRunup, type PenaltyRunupId, type FreeKickRunupId } from "@/lib/star/runupStyles";
import { gateCrossing, gateQuality, shotQuality } from "@/lib/star/trainingDrills";
import { starsForTry } from "@/lib/star/trainingLevels";
import { levelConfig, levelSeedOf, easePowerLevel, type PowerLevel, type FreeKickLevel, type AerialLevel, type PaceLevel } from "@/lib/star/trainingLevelData";
import { FirstPersonRun, type FpDribbleResult } from "./MatchFirstPerson";
import { VisionDrill } from "./MatchVision";
import { markDrillFreeKick } from "@/lib/star/kindRules";
import type { ChanceResolved } from "../match/setup";
import { buildStrike, buildStrikeFrom, buildFreeKickScenario, DRILL_SCENE, type StrikeKind, type StrikeSetup, type StrikeLevel } from "../match/drills";
import { EngineFeature, StrikeStage, TrialBoard, TrialCaption, TrialSlots, TeachCard, type SlotState } from "./MatchFeature";
import { C } from "../ui/theme";

/** TrialFrame.tsx TrialPitchBox: the pitch in its frame (ring-2 emerald-800/80, a deep shadow). */
export const TRIAL_PITCH_BOX = (h: number): ViewStyle => ({ height: h, marginHorizontal: 12, borderRadius: 12, borderWidth: 2, borderColor: "rgba(6,95,70,0.8)", overflow: "hidden", boxShadow: "0px 18px 40px -12px rgba(2,44,34,0.6)" } as ViewStyle);

/** The pitch box: the screen's width, a little taller than 5:8 (the website's new-view canvas), leaving room for the board. */
export function usePitchHeight(): number {
  const { width, height } = useWindowDimensions();
  return Math.round(Math.min(width * 1.45, height - 260));
}
/**
 * A trial stage's pitch: down to the two caption lines, as the website's TrialPage
 * fits it (data-pitch-fit 56: the captions and the page's padding under the pitch;
 * above it the stage pips, the board and the safe area).
 */
export function useTrialPitchHeight(): number {
  const { width, height } = useWindowDimensions();
  const { top, bottom } = useSafeAreaInsets();
  return Math.round(Math.max(width * 1.2, Math.min(width * 1.9, height - top - bottom - 118 - 60)));
}

// ── Free kicks (stages/TrialFreeKicks.tsx) ──
export function TrialFreeKicksStage({ trial, onDone, skills, freeKickRunup }: { trial: TrialProgress; onDone: (q: number) => void; skills: { power: number; technique: number }; freeKickRunup?: FreeKickRunupId }) {
  const h = useTrialPitchHeight();
  const build = useCallback((rep: number, rng: () => number) => buildFreeKickScenario(trial, rep, rng), [trial]);
  return (
    <StrikeStage height={h} reps={REPS.freeKicks} build={build} skills={skills} seed={(trial.seed ^ 0x5f5e) >>> 0} drill="freeKicks"
      freeKickRunup={freeKickRunup} keeperStrengthFor={(rep) => freeKickSetup(trial, rep).keeperStrength}
      title="Free kicks" hint="Bend it round the wall or lift it over — sides of the ball curl it, the bottom lifts it."
      teach={{ headline: "There is no way through the wall.", place: "bottom", short: "Round the wall, or over it.", lines: ["Drag back from the ball to aim. Pull further for more power.", "Then let go."] }}
      pauseTeach={{
        runup: { drill: "freeKickRunup", headline: "You run up to take free kicks.", lines: ["As you hit the ball, you get a timed strike."] },
        contact: { drill: "freeKickStrike", place: "top", headline: "Tap the ball before the ring runs out.", lines: ["Tap its side to bend it round the wall.", "Tap low on it to lift it over the wall.", "Run out of time and you scuff it."] },
      }}
      subtitle={(rep) => { const s = freeKickSetup(trial, rep); return `${Math.round(s.distance)} m out · ${Math.max(1, Math.round(s.wall))} in the wall`; }}
      forceCompactTeach onDone={onDone} />
  );
}

// ── Take him on (TrialSequence.tsx's dribbling stage: FirstPersonDribble, embedded, calm camera) ──
export function TrialDribbleStage({ trial, onDone, pace }: { trial: TrialProgress; onDone: (q: number) => void; pace: number }) {
  const h = useTrialPitchHeight();
  const dribble = useMemo(() => dribbleSetup(trial), [trial]);
  const [teachDone, setTeachDone] = useState(false);
  useEffect(() => { if (teachSeen("dribbling")) setTeachDone(true); }, []);
  const dismiss = useCallback(() => { markTeachSeen("dribbling"); setTeachDone(true); }, []);
  const onDoneRef = useRef(onDone); onDoneRef.current = onDone;
  const onComplete = useCallback((res: FpDribbleResult) => onDoneRef.current(dribbleQuality(res, dribble)), [dribble]);
  return (
    <View>
      <TrialBoard title="You" centreLabel="Take him on" centreValue={`${dribble.waveSizes.length} waves`} footer={`${dribble.waveSizes.reduce((a, b) => a + b, 0)} men to get past`} />
      <View style={TRIAL_PITCH_BOX(h)}>
        {/* Blue like you are in every other trial stage; the calm camera (CALM_CAMERA). */}
        <FirstPersonRun height={h} calmCamera kits={{ you: { shirt: "#2563eb", shorts: "#f8fafc" } }} seed={attemptSeed(trial)} pace={pace}
          oppStrength={dribble.oppStrength} waveSizes={dribble.waveSizes} hideHint hold={!teachDone} onComplete={onComplete} />
        {!teachDone && (
          <TeachCard headline="Get past them." lines={["Tap the left or right of the screen to touch the ball that way.", "Flick to burst past him — time it as he commits, not before."]} onDismiss={dismiss} />
        )}
      </View>
      <TrialCaption prompt={teachDone ? "Tap left or right to touch the ball. Flick to burst past him." : ""} />
    </View>
  );
}

// ── Through the gate (stages/TrialTechnique.tsx) ──
const repRng = (seed: number, rep: number) => mulberry32((seed ^ ((rep + 1) * 0x9e3779b1)) >>> 0);
export function TrialTechniqueStage({ trial, onDone, skills }: { trial: TrialProgress; onDone: (q: number) => void; skills: { power: number; technique: number } }) {
  const h = useTrialPitchHeight();
  const seed = (trial.seed ^ 0x7e4c) >>> 0;
  const level = ladderLevel(difficultyFor(trial, "technique"));
  const setupRef = useRef<StrikeSetup | null>(null);
  const prevRef = useRef<{ x: number; y: number; z: number } | null>(null);
  const crossedRef = useRef<{ x: number; z: number } | null>(null);
  const build = useCallback((rep: number, rng: () => number): Scenario => {
    const setup = buildStrike("technique", level, rep, rng);
    setup.scenario.viewport = { ...setup.viewport };
    const b = setup.scenario.ball;
    setup.scenario.player = { x: b.x + 1.2, y: b.y + 1.8 };
    setupRef.current = setup;
    prevRef.current = null;
    crossedRef.current = null;
    return setup.scenario;
  }, [level]);
  const markersFor = useCallback((rep: number) => {
    const g = buildStrike("technique", level, rep, repRng(seed, rep)).gate;
    return g ? [{ x: g.left.x, y: g.left.y }, { x: g.right.x, y: g.right.y }] : [];
  }, [level, seed]);
  const onBallStep = useCallback((b: { x: number; y: number; z: number }) => {
    const setup = setupRef.current;
    if (!setup?.gate || crossedRef.current) return;
    const prev = prevRef.current;
    if (prev) { const c = gateCrossing(prev, b, setup.gate.centre.y); if (c) crossedRef.current = c; }
    prevRef.current = { ...b };
  }, []);
  const judge = useCallback(() => {
    const setup = setupRef.current;
    if (!setup?.gate || !setup.gateCfg) return { quality: 0, text: "Missed the gate." };
    const q = gateQuality(crossedRef.current, setup.gateCfg, setup.gate.centre.x);
    return { quality: q, text: q >= 0.9 ? "Threaded it!" : q >= 0.45 ? "Through." : q > 0 ? "Clipped it." : "Missed the gate." };
  }, []);
  return (
    <StrikeStage height={h} reps={REPS.technique} build={build} skills={skills} seed={seed} drill="technique"
      scene={{ ...DRILL_SCENE.technique, you: false, box: false }} markersFor={markersFor} onBallStep={onBallStep} judge={judge}
      title="Through the gate" hint="Strike the side of the ball to bend it through the cones."
      teach={{ headline: "Put it through the cones.", short: "Through the cones.", lines: ["Drag back to aim and set power, then pick your spot on the ball.", "The gate moves off your line — strike the side of the ball to bend it in."] }}
      subtitle={(rep) => { const cfg = techniqueSetup(trial, rep); return `${Math.round(cfg.gateDistance)} m out · ${cfg.gateWidth.toFixed(1)} m gap`; }}
      forceCompactTeach onDone={onDone} />
  );
}

// ── The shootout (stages/TrialShootout.tsx) ──
const US = "Trialists";
const THEM = "Academy";
const FINAL_HOLD_MS = 1500;
const MATE_KICKS = SHOOTOUT_KICKS - 1;
function takersFor(trial: TrialProgress, seed: number): { them: PenaltyTaker[]; mates: PenaltyTaker[] } {
  const rating = shootoutTheirRating(trial);
  const runups = pickRunups(seed, SHOOTOUT_KICKS + MATE_KICKS);
  const rng = mulberry32((trial.seed ^ 0x7a1e) >>> 0);
  const side = (squadSeed: number, n: number, base: string, runupFrom: number): PenaltyTaker[] =>
    generateSquad(squadSeed).filter((p) => p.position !== "GK").slice(0, n).map((p, i) => ({
      id: idForRunup(`${base}-${i}`, runups[runupFrom + i]), name: p.name, shortName: p.shortName,
      face: p.imageUrl ?? fakeFaceFor(`${base}-${i}`),
      rating: Math.max(30, Math.min(95, Math.round(rating + (rng() - 0.5) * 10))),
    }));
  return { them: side((trial.seed ^ 0x51ee) >>> 0, SHOOTOUT_KICKS, "academy", 0), mates: side((trial.seed ^ 0x3a7e) >>> 0, MATE_KICKS, "trialist", SHOOTOUT_KICKS) };
}
export function TrialShootoutStage({ trial, onDone, skills, penaltyRunup }: { trial: TrialProgress; onDone: (q: number, finalPenScored: boolean) => void; skills: { power: number; technique: number }; penaltyRunup?: PenaltyRunupId }) {
  const h = useTrialPitchHeight();
  const seed = attemptSeed(trial);
  const { them: takers, mates } = useMemo(() => takersFor(trial, seed), [trial, seed]);
  const script = useMemo<RigScript>(() => createRigScript(seed), [seed]);
  const [rig, setRig] = useState<RigState>(createRig);
  const rigRef = useRef(rig); rigRef.current = rig;
  const yourKicksRef = useRef<boolean[]>([]);
  const doneRef = useRef(false);
  const [line, setLine] = useState("");
  const [struckOnce, setStruckOnce] = useState(false);
  const [teachDone, setTeachDone] = useState(false);
  useEffect(() => { if (teachSeen("shootout")) setTeachDone(true); }, []);
  const dismissTeach = useCallback(() => { markTeachSeen("shootout"); setTeachDone(true); }, []);
  const side = rigNextSide(rig.kicks);
  const ourKickNo = rigKicksTaken(rig.kicks, "you");
  const theirKickNo = rigKicksTaken(rig.kicks, "them");
  const theirKeeper = shootoutKeeperFor(trial, ourKickNo);
  const ourKeeper = shootoutOurKeeperFor(theirKickNo);
  const yours = isYourKick(rig);
  const intent = rig.over || yours ? false : rigIntent(rig, script);
  const scriptRef = useRef(script); scriptRef.current = script;
  const takersRef = useRef({ takers, mates }); takersRef.current = { takers, mates };
  const takerNow = (st: RigState): PenaltyTaker | null => {
    if (st.over || isYourKick(st)) return null;
    const s = rigNextSide(st.kicks);
    const list = s === "them" ? takersRef.current.takers : takersRef.current.mates;
    return list[Math.min(rigKicksTaken(st.kicks, s), list.length - 1)];
  };
  const openOn = useCallback((): Scenario => {
    const st = rigRef.current;
    const s = rigNextSide(st.kicks);
    const n = st.kicks.length;
    const rng = mulberry32((seed * 7919 + n * 2654435761) >>> 0);
    const ourNo = rigKicksTaken(st.kicks, "you");
    if (st.over || (s === "you" && isYourKick(st))) {
      const k = shootoutKeeperFor(trial, ourNo);
      const sc = buildScenario("penalty", rng, k.keeperStrength, 60, 55);
      initDefenders(sc, rng);
      sc.ball = { x: CX, y: PEN_SPOT_Y };
      clearForShootout(sc);
      return sc;
    }
    const taker = takerNow(st)!;
    const sc0 = s === "them"
      ? buildScenario("penalty", rng, shootoutOurKeeperFor(rigKicksTaken(st.kicks, "them")).keeperStrength, 60, 55)
      : buildScenario("penalty", rng, shootoutKeeperFor(trial, ourNo).keeperStrength, 60, 55);
    initDefenders(sc0, rng);
    sc0.ball = { x: CX, y: PEN_SPOT_Y };
    clearForShootout(sc0);
    const scr = scriptRef.current;
    const goes = rigIntent(st, scr);
    attachAutoKick(sc0, {
      side: s === "them" ? "them" : "us", taker,
      plan: rigPlanFor(goes, scr.sides[n] ?? 1, taker.rating, scr.misses[n] ?? "wide"),
      keeper: s === "them"
        ? { strength: shootoutOurKeeperFor(rigKicksTaken(st.kicks, "them")).keeperStrength, name: "Trialist keeper", shortName: "Your keeper" }
        : { strength: shootoutKeeperFor(trial, ourNo).keeperStrength, name: "Academy keeper", shortName: "Their keeper" },
      context: "shootout",
    });
    return sc0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed, trial]);
  const onDoneRef = useRef(onDone); onDoneRef.current = onDone;
  const onChanceResolved = useCallback((info: ChanceResolved) => {
    if (doneRef.current || rigRef.current.over) return;
    setStruckOnce(true);
    const st = rigRef.current;
    const n = st.kicks.length;
    const scored = (info.outcome === "goal" || info.outcome === "rebound") && !info.teammateShot;
    if (isYourKick(st)) {
      yourKicksRef.current = [...yourKicksRef.current, scored];
      setLine(scored ? "Scored!" : info.outcome === "saved" || info.outcome === "tipped" || info.outcome === "caught" ? "Saved." : info.outcome === "post" ? "Off the post!" : "Missed.");
    } else {
      const who = takerNow(st);
      const miss = scriptRef.current.misses[n] ?? "wide";
      const how = info.outcome === "saved" || info.outcome === "caught" || info.outcome === "tipped" ? "Saved!" : MISS_LINE[miss];
      if (rigNextSide(st.kicks) === "them") setLine(scored ? "They score." : `${who?.shortName ?? "Their man"}: ${how}`);
      else setLine(scored ? `${who?.shortName ?? "He"} scores!` : `${who?.shortName ?? "He"}: ${how}`);
    }
    const next = rigApply(st, scored);
    rigRef.current = next;
    setRig(next);
    if (next.over) {
      doneRef.current = true;
      setTimeout(() => onDoneRef.current(shootoutQuality(yourKicksRef.current), winningPenaltyScored(next)), FINAL_HOLD_MS);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const taker = takerNow(rig);
  const upNext = rig.over ? null : yours ? "You" : side === "them" ? THEM : (taker?.shortName ?? US);
  const showTeach = !struckOnce && rig.kicks.length === 0 && !teachDone;
  const trialStats = useMemo(() => trialInvisibleStats(), []);
  const stepsUp = taker ? `${taker.shortName} steps up — ${runupName(takerPenaltyRunup(taker.id))}.` : "";
  const states = (s: "you" | "them"): SlotState[] => rig.kicks.filter((k) => k.side === s).map((k) => (k.scored ? "scored" : "missed"));
  const you = rigGoals(rig.kicks, "you"), them = rigGoals(rig.kicks, "them");
  return (
    <View>
      <TrialBoard title={US} left={<TrialSlots states={states("you")} total={SHOOTOUT_KICKS} />} centreLabel="Pens" centreValue={`${you}–${them}`}
        right={<View style={{ alignItems: "flex-end" }}><Text style={{ color: "#fda4af", fontSize: 11, fontWeight: "900" }}>{THEM.toUpperCase()}</Text><TrialSlots states={states("them")} total={SHOOTOUT_KICKS} /></View>}
        footer={rig.over ? (rig.winner === "you" ? `${US} win ${you}–${them} on penalties` : `Level at ${you}–${them}`) : upNext ? `Next: ${upNext}` : undefined} />
      {showTeach ? (
        <View style={{ height: h, borderRadius: 12, backgroundColor: "rgba(6,95,70,0.6)" }}>
          <TeachCard headline="Three kicks each. Yours is the last one." lines={["Two team-mates take our first two kicks. Every taker has his own run-up.", "Your kick wins it: drag back from the ball, let go, then tap the ball before the ring runs out."]} onDismiss={dismissTeach} />
        </View>
      ) : (
        <EngineFeature height={h} openOn={openOn} onChanceResolved={onChanceResolved} skills={skills} setPieceSkill={trialStats.setPieceSkill}
          keeperStrength={theirKeeper.keeperStrength}
          penaltyRead={yours ? theirKeeper.read : side === "them" ? rigKeeperRead(intent, ourKeeper.read) : rigKeeperRead(intent, theirKeeper.read)}
          seed={seed} scene={{ teammates: false }} penaltyRunup={penaltyRunup} />
      )}
      <TrialCaption line={line} prompt={rig.over ? "" : yours ? "The winning penalty — it's all on you." : stepsUp} />
    </View>
  );
}

// ── A training drill that strikes (TrainingMinigame.tsx StrikeDrill + useTries) ──
export const TRIES = 3;
export const SKILL_TITLES: Record<keyof Skills, string> = { pace: "The Gauntlet", power: "Long Range", technique: "Through the Gate", vision: "Pick the Pass", freeKick: "Over the Wall", aerial: "Head & Volley" };
function useTries(onFinish: (stars: number) => void) {
  const [results, setResults] = useState<boolean[]>([]);
  const finishedRef = useRef(false);
  const attempt = useCallback((ok: boolean) => { setResults((prev) => (prev.length >= TRIES || prev.includes(true) ? prev : [...prev, ok])); }, []);
  useEffect(() => {
    if (finishedRef.current) return;
    const hit = results.indexOf(true);
    if (hit < 0 && results.length < TRIES) return;
    finishedRef.current = true;
    const stars = hit < 0 ? 0 : starsForTry(hit);
    const t = setTimeout(() => onFinish(stars), 850);
    return () => clearTimeout(t);
  }, [results, onFinish]);
  const done = results.includes(true) || results.length >= TRIES;
  return { results, attempt, done };
}
/** TrainingMinigame's Shell header: the three tries, the drill's name, the level and the stars still to play for. */
function DrillHeader({ kind, trainingLevel, results }: { kind: keyof Skills; trainingLevel: number; results: boolean[] }) {
  const onTry = Math.max(0, TRIES - results.length);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, marginBottom: 8 }}>
      <View style={{ flexDirection: "row", gap: 6 }}>
        {Array.from({ length: TRIES }, (_, i) => {
          const r = results[i];
          return (
            <View key={i} style={{ width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: r === true ? "#34d399" : r === false ? "#ef4444" : "transparent", borderWidth: r === undefined ? 2 : 0, borderColor: i === results.length ? C.gold : "rgba(255,255,255,0.25)" }}>
              <Text style={{ color: r === true ? "#052e1b" : "#fff", fontWeight: "900" }}>{r === true ? "✓" : r === false ? "✗" : i + 1}</Text>
            </View>
          );
        })}
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={{ color: C.gold, fontSize: 10, fontWeight: "900", letterSpacing: 1.5 }}>{SKILL_TITLES[kind].toUpperCase()}</Text>
        <Text style={{ color: "#fff", fontSize: 16, fontWeight: "900" }}>LEVEL {trainingLevel} <Text style={{ color: "#fcd34d" }}>{"★".repeat(onTry)}</Text><Text style={{ color: "rgba(255,255,255,0.25)" }}>{"★".repeat(TRIES - onTry)}</Text></Text>
      </View>
    </View>
  );
}

/**
 * PACE — The Gauntlet (TrainingMinigame.tsx GauntletDrill): the run a real
 * match serves (screens/MatchFirstPerson.tsx), the level's row setting how many
 * men, how quick, how quick you run, in waves of up to waveMax, knock-on rings
 * and hand-placed lanes. Passed: you got to the line with the ball.
 */
export function DrillPace({ trainingLevel, onFinish }: { trainingLevel: number; onFinish: (stars: number) => void }) {
  const h = usePitchHeight();
  const { results, attempt, done } = useTries(onFinish);
  const [flash, setFlash] = useState<{ text: string; good: boolean } | null>(null);
  const [runKey, setRunKey] = useState(0);
  const cfg = levelConfig("pace", trainingLevel) as PaceLevel;
  const waveSizes = useMemo(() => {
    const out: number[] = [];
    const max = Math.max(1, cfg.waveMax);
    for (let left = cfg.chasers; left > 0; left -= max) out.push(Math.min(max, left));
    return out;
  }, [cfg.chasers, cfg.waveMax]);
  const total = waveSizes.reduce((a, b) => a + b, 0);
  const onComplete = useCallback((res: FpDribbleResult) => {
    setFlash({ text: res.cleared ? (res.beaten >= total ? "GONE!" : "THROUGH") : "TACKLED", good: res.cleared });
    attempt(res.cleared);
    setTimeout(() => { setFlash(null); setRunKey((k) => k + 1); }, 1000);
  }, [attempt, total]);
  return (
    <View>
      <DrillHeader kind="pace" trainingLevel={trainingLevel} results={results} />
      <Text style={{ color: C.text, fontSize: 12, fontWeight: "700", textAlign: "center", paddingHorizontal: 12, marginBottom: 6 }}>One man comes for the ball. Pick the gap, wait for his shoulder, and flick the other way as his ring turns green.</Text>
      <View style={{ height: h }}>
        {!done && (
          <FirstPersonRun key={runKey} height={h} seed={levelSeedOf("pace", trainingLevel, cfg)} pace={cfg.runPace} oppStrength={cfg.oppStrength}
            waveSizes={waveSizes} chaseEye={5} chasePitchDeg={5} chaseOffset={4} cameraFollowRate={10} knockOn lanes={cfg.lanes} onComplete={onComplete} />
        )}
        {flash && (
          <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ backgroundColor: flash.good ? "rgba(16,185,129,0.85)" : "rgba(220,38,38,0.85)", color: "#fff", fontSize: 30, fontWeight: "900", fontStyle: "italic", paddingHorizontal: 20, paddingVertical: 8, borderRadius: 16, overflow: "hidden" }}>{flash.text}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

/** VISION — Pick the Pass (TrainingMinigame.tsx VisionDrillView), on the match (screens/MatchVision.tsx VisionDrill). */
export function DrillVision({ trainingLevel, skills, onFinish }: { trainingLevel: number; skills: Skills; onFinish: (stars: number) => void }) {
  const h = Math.round(usePitchHeight() * 0.94);
  const { results, attempt } = useTries(onFinish);
  return (
    <View>
      <DrillHeader kind="vision" trainingLevel={trainingLevel} results={results} />
      <VisionDrill trainingLevel={trainingLevel} skills={skills} height={h} attempt={attempt} results={results} />
    </View>
  );
}

export function DrillStrike({ kind, trainingLevel, skills, onFinish }: { kind: StrikeKind; trainingLevel: number; skills: Skills; onFinish: (stars: number) => void }) {
  const h = usePitchHeight();
  const { results, attempt, done } = useTries(onFinish);
  const powerNow = skills.power;
  const row = useMemo((): StrikeLevel => {
    const rowAt = (n: number): StrikeLevel => levelConfig(kind, n) as StrikeLevel;
    if (kind !== "power") return rowAt(trainingLevel);
    return easePowerLevel(trainingLevel, powerNow, (n) => rowAt(n) as PowerLevel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, trainingLevel]);
  const seed = levelSeedOf(kind, trainingLevel, row);
  const setupRef = useRef<StrikeSetup | null>(null);
  const prevRef = useRef<{ x: number; y: number; z: number } | null>(null);
  const crossedRef = useRef<{ x: number; z: number } | null>(null);
  const [flash, setFlash] = useState<{ text: string; good: boolean } | null>(null);
  const keeperStrength = kind === "technique" ? 40 : (row as PowerLevel | FreeKickLevel | AerialLevel).keeperStrength;
  const openOn = useCallback((): Scenario => {
    const setup = buildStrikeFrom(kind, row, mulberry32(seed));
    setup.scenario.viewport = { ...setup.viewport };
    setupRef.current = setup;
    prevRef.current = null;
    crossedRef.current = null;
    return kind === "freeKick" ? markDrillFreeKick(setup.scenario) : setup.scenario;
  }, [kind, row, seed]);
  const view = useMemo(() => {
    const setup = buildStrikeFrom(kind, row, mulberry32(seed));
    return { brief: setup.brief, openGoal: !!setup.openGoal, markers: setup.gate ? [{ x: setup.gate.left.x, y: setup.gate.left.y }, { x: setup.gate.right.x, y: setup.gate.right.y }] : [] };
  }, [kind, row, seed]);
  const onBallStep = useCallback((b: { x: number; y: number; z: number }) => {
    const setup = setupRef.current;
    if (!setup?.gate || crossedRef.current) return;
    const prev = prevRef.current;
    if (prev) { const c = gateCrossing(prev, b, setup.gate.centre.y); if (c) crossedRef.current = c; }
    prevRef.current = { ...b };
  }, []);
  const onChanceResolved = useCallback((info: ChanceResolved) => {
    const setup = setupRef.current;
    if (!setup) return;
    let q: number, text: string;
    if (setup.gate && setup.gateCfg) {
      q = gateQuality(crossedRef.current, setup.gateCfg, setup.gate.centre.x);
      text = q >= 0.9 ? "THREADED!" : q >= 0.45 ? "THROUGH" : q > 0 ? "CLIPPED IT" : "MISSED THE GATE";
    } else {
      const o = info.teammateShot ? "saved" : info.outcome;
      const reached = o === "goal" || o === "rebound" || o === "wide" || o === "over" || o === "post";
      q = shotQuality(o, reached && info.ball ? info.ball.x : null);
      text = o === "goal" || o === "rebound" ? (q < setup.pass ? "TOO CENTRAL" : q > 0.85 ? "TOP CORNER!" : "GOAL!")
        : o === "saved" || o === "tipped" ? "SAVED" : o === "caught" ? "CAUGHT" : o === "post" ? "OFF THE POST"
        : o === "blocked" || o === "tackled" ? "BLOCKED" : o === "over" ? "OVER" : "WIDE";
    }
    const ok = q >= setup.pass;
    setFlash({ text, good: ok });
    setTimeout(() => setFlash(null), 1000);
    attempt(ok);
  }, [attempt]);
  const kickSkills = useMemo(() => ({ power: skills.power, technique: skills.technique, aerial: skills.aerial }), [skills.power, skills.technique, skills.aerial]);
  return (
    <View>
      <DrillHeader kind={kind} trainingLevel={trainingLevel} results={results} />
      {!done ? (
        <EngineFeature height={h} openOn={openOn} onChanceResolved={onChanceResolved} onBallStep={onBallStep} markers={view.markers}
          skills={kickSkills} setPieceSkill={skills.freeKick} keeperStrength={keeperStrength} seed={seed}
          scene={view.openGoal ? { ...DRILL_SCENE.power, keeper: false } : DRILL_SCENE[kind]}>
          {view.brief ? <Text pointerEvents="none" style={{ position: "absolute", left: 8, bottom: 8, backgroundColor: "rgba(0,0,0,0.55)", color: "#fde68a", fontSize: 11, fontWeight: "900", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, overflow: "hidden" }}>{view.brief.toUpperCase()}</Text> : null}
          {flash && (
            <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ backgroundColor: flash.good ? "rgba(16,185,129,0.85)" : "rgba(220,38,38,0.85)", color: "#fff", fontSize: 30, fontWeight: "900", fontStyle: "italic", paddingHorizontal: 20, paddingVertical: 8, borderRadius: 16, overflow: "hidden" }}>{flash.text}</Text>
            </View>
          )}
        </EngineFeature>
      ) : <View style={{ height: h }} />}
    </View>
  );
}
