/**
 * CROSSBAR CHALLENGE, IN 3D (the website's components/star/Training3D.tsx `CrossbarChallenge` on the phone).
 *
 * You and one real team-mate, five shots each from the edge of the box at an empty goal. Only the crossbar scores (a post
 * scores nothing). Level or better wins. The rules are the website's (lib/star/training3d/crossbar.ts).
 *
 * ONE ENGINE (the one-engine rule): YOUR shot is the real match, the phone's EngineFeature (the one match driver): its ball,
 * drag, strike screen and flight. You aim on the engine's own pitch; as the ball is struck the 3D pitch fades in over it and
 * draws the engine's ball, step by step (`onBallStep`), from behind you. The engine keeps running underneath and decides the
 * result. HIS shot is a cut-scene: rolled from his rating when the challenge starts and shown along a scripted path.
 * The 3D pitch is the website's own scene (lib/star/training3d/scene.ts) through ../../three/Walk3D.tsx, as a layer that never
 * takes a touch. If the 3D cannot start the game still plays on the engine's pitch alone (the website says the same).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform, Text, View } from "react-native";
import type { CareerState } from "@/lib/star/types";
import type { Scenario } from "@/lib/star/canvasEngine";
import { mulberry32 } from "@/lib/star/season";
import { PITCH_W } from "@/lib/star/pitch";
import { FRAME_TOP_FOR_GOAL } from "@/lib/star/goalFrame";
import { CROSSBAR_SHOTS, CROSSBAR_SPOT, touchingBar, touchingPost, crossbarReward, crossbarWinner, type MateShot } from "@/lib/star/training3d/crossbar";
import { KICK_DELAY_S } from "@/lib/star/training3d/scene";
import { buildStrike, DRILL_SCENE } from "../../match/drills";
import type { ChanceResolved } from "../../match/setup";
import { EngineFeature } from "../MatchFeature";
import { usePitchHeight } from "../MatchStages";
import { GameShell, ResultPanel, type GameResult } from "../MatchRelGames";
import { Walk3D } from "../../three/Walk3D";
import { loadTrainingStart, type TrainingWalk } from "../../three/trainingScene";
import { crossbarMate, crossbarSceneData, trainingSeed } from "../../three/trainingData";

export interface Training3DResult extends GameResult { you: number; him: number; mate: string }
type Step = "you-aim" | "you-flight" | "you-after" | "mate" | "mate-after" | "done";
const TONE = "#38bdf8";

export function CrossbarChallenge({ career, showSpeed, onExit, onFinish }: {
  career: CareerState;
  showSpeed?: boolean;
  onExit: () => void;
  onFinish: (result: Training3DResult) => void;
}) {
  const team = career.relationships.team;
  const seed = trainingSeed(career);
  const pitchH = usePitchHeight();

  // His name, face and five shots: fixed when the challenge starts.
  const mate = useMemo(() => crossbarMate(career, seed), [seed, career.squad]); // eslint-disable-line react-hooks/exhaustive-deps
  const sceneData = useMemo(() => crossbarSceneData(career, mate), []); // eslint-disable-line react-hooks/exhaustive-deps

  const [round, setRound] = useState(0);
  const [step, setStep] = useState<Step>("you-aim");
  const [yourScore, setYourScore] = useState(0);
  const [hisScore, setHisScore] = useState(0);
  const [marks, setMarks] = useState<{ you: boolean[]; him: boolean[] }>({ you: [], him: [] });
  const [flash, setFlash] = useState<{ text: string; good: boolean } | null>(null);
  const [result, setResult] = useState<Training3DResult | null>(null);
  const [three, setThree] = useState<"loading" | "ready" | "off">("loading");

  const ctrl = useRef<TrainingWalk | null>(null);
  const stepRef = useRef<Step>("you-aim");
  stepRef.current = step;
  const barRef = useRef(false);
  const postRef = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = (f: () => void, ms: number) => { timers.current.push(setTimeout(f, ms)); };
  useEffect(() => () => { timers.current.forEach((t) => clearTimeout(t)); }, []);
  /** On the 3D scene's own clock when it's there (a slow phone then keeps the celebration behind the ball); the wall's when the 3D is off. */
  const sceneLater = (f: () => void, ms: number) => { const c = ctrl.current; if (c) c.after(ms / 1000, f); else later(f, ms); };

  // While you aim, the engine's own pitch is on screen and the 3D rests.
  useEffect(() => { ctrl.current?.setActive(step !== "you-aim" && step !== "done"); }, [step]);

  const showFlash = (text: string, good: boolean, ms = 1300) => { setFlash({ text, good }); later(() => setFlash(null), ms); };

  const finish = useCallback((you: number, him: number) => {
    const r = crossbarReward(you, him, team, Math.random());
    const w = crossbarWinner(you, him);
    const line = w === "level" ? `Level at ${you}-${him} with ${mate.name}. Honours even.` : w === "you" ? `You beat ${mate.name} ${you}-${him}.` : `${mate.name} beat you ${him}-${you}.`;
    setResult({ ...r, line, you, him, mate: mate.name });
    setStep("done");
  }, [team, mate.name]);

  // ── His turn (the cut-scene) ──
  const hisTurn = useCallback((r: number, you: number, him: number) => {
    setStep("mate");
    const shot: MateShot = mate.shots[r];
    const c = ctrl.current;
    const after = () => {
      const total = him + (shot.hit ? 1 : 0);
      setHisScore(total);
      setMarks((m) => ({ ...m, him: [...m.him, shot.hit] }));
      setStep("mate-after");
      if (shot.hit) { c?.play("mate", "celebrate"); showFlash(`${mate.name.toUpperCase()} HITS THE BAR!`, false); }
      else c?.play("mate", "frustrated");
      if (!shot.hit) showFlash(shot.miss === "post" ? "Off the post — doesn't count" : shot.miss === "under" ? "Under it — into the net" : shot.miss === "over" ? "Over the bar" : "Wide", true);
      sceneLater(() => {
        c?.play("mate", "watch");
        if (r + 1 >= CROSSBAR_SHOTS) finish(you, total);
        else { c?.resetBall(); c?.setShooter("you"); c?.setCamera("behind"); setRound(r + 1); setStep("you-aim"); }
      }, 2100);
    };
    if (!c) { later(after, 600); return; }
    c.setShooter("mate");
    c.play("you", "watch");
    c.playMateShot(shot, after);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mate, finish]);

  // ── Your turn (the real engine) ──
  const openOn = useCallback((): Scenario => {
    const setup = buildStrike("power", 1, round, mulberry32(seed + round * 17), { trainingLevel: 1, power: career.skills.power });
    const sc = setup.scenario;
    sc.ball = { x: CROSSBAR_SPOT.x, y: CROSSBAR_SPOT.y };
    sc.player = { x: CROSSBAR_SPOT.x, y: CROSSBAR_SPOT.y + 0.8 };
    sc.defenders = [];
    // the woodwork challenge's close camera on the goal
    const h = Math.max(22, sc.ball.y + 10);
    const w = h * (5 / 8);
    const cx = Math.max(w / 2, Math.min(PITCH_W - w / 2, sc.ball.x));
    sc.viewport = { x1: cx - w / 2, x2: cx + w / 2, y1: FRAME_TOP_FOR_GOAL, y2: FRAME_TOP_FOR_GOAL + h };
    barRef.current = false;
    postRef.current = false;
    return sc;
  }, [round, seed, career.skills.power]);

  const onBallStep = useCallback((b: { x: number; y: number; z: number }) => {
    if (stepRef.current === "you-aim") {
      // struck: the 3D pitch takes over the picture
      stepRef.current = "you-flight";
      setStep("you-flight");
      ctrl.current?.resetBall();
      ctrl.current?.play("you", "kick");
      // the 3D kick has a run-up: cut to the goal just after his foot meets the ball
      sceneLater(() => ctrl.current?.setCamera("goal"), ((ctrl.current?.kickDelayS ?? KICK_DELAY_S) + 0.2) * 1000);
    }
    ctrl.current?.feedEngineBall(b);
    if (!barRef.current && touchingBar(b)) barRef.current = true;
    if (!postRef.current && touchingPost(b)) postRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onChanceResolved = useCallback((_info: ChanceResolved) => {
    if (stepRef.current === "you-after") return;
    const hit = barRef.current;
    const total = yourScore + (hit ? 1 : 0);
    stepRef.current = "you-after";
    setStep("you-after");
    // the 3D ball runs behind the engine's (the run-up): say it as it gets there
    const lag = (ctrl.current?.kickDelayS ?? KICK_DELAY_S) * 1000;
    sceneLater(() => {
      setYourScore(total);
      setMarks((m) => ({ ...m, you: [...m.you, hit] }));
      if (hit) { ctrl.current?.play("you", "celebrate"); showFlash("CROSSBAR!", true); }
      else { ctrl.current?.play("you", "frustrated"); showFlash(postRef.current ? "Off the post — doesn't count" : "Missed the bar", false); }
    }, lag + 250);
    sceneLater(() => { ctrl.current?.play("you", "watch"); hisTurn(round, total, hisScore); }, lag + 2700);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yourScore, hisScore, round, hisTurn]);

  // the look check's hook (the web build only): the live 3D pitch, and a way to end the challenge as if it were played
  if (Platform.OS === "web") (globalThis as unknown as Record<string, unknown>).__crossbar3d = { ctrlRef: ctrl, step, round, three, finishNow: () => finish(3, 2) };
  const show3d = three === "ready" && step !== "you-aim" && step !== "done";
  const engineOn = step === "you-aim" || step === "you-flight" || step === "you-after";

  return (
    <GameShell title="Crossbar challenge" who="Team" current={team} tone={TONE} onBack={onExit}>
      <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700", marginBottom: 6 }}>Hit the crossbar. Five shots each. A post doesn&apos;t count.</Text>
      <View style={{ flexDirection: "row", gap: 4, marginBottom: 6 }}>
        <Strip name="You" score={yourScore} marks={marks.you} active={engineOn && !result} />
        <Strip name={mate.name} score={hisScore} marks={marks.him} active={(step === "mate" || step === "mate-after") && !result} />
      </View>
      <Text style={{ color: "#bae6fd", textAlign: "center", fontSize: 12, fontWeight: "900", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 4 }}>
        {result ? "Full time" : `Round ${Math.min(round + 1, CROSSBAR_SHOTS)} of ${CROSSBAR_SHOTS} · ${engineOn ? "your shot" : `${mate.name}'s shot`}`}
      </Text>
      <View style={{ height: pitchH }}>
        {engineOn && !result ? (
          <EngineFeature
            key={round}
            height={pitchH}
            openOn={openOn}
            onChanceResolved={onChanceResolved}
            onBallStep={onBallStep}
            skills={{ power: career.skills.power, technique: career.skills.technique }}
            keeperStrength={0}
            seed={seed + round}
            scene={{ ...DRILL_SCENE.power, keeper: false, ownFrame: true }}
          />
        ) : null}
        {/* The 3D pitch: over the engine's from the strike on; never takes a touch. */}
        <View pointerEvents="none" style={{ position: "absolute", left: 12, right: 12, top: 0, bottom: 0, borderRadius: 12, overflow: "hidden", opacity: show3d ? 1 : 0 }}>
          <Walk3D
            inert
            load={loadTrainingStart}
            data={sceneData}
            callbacks={() => ({})}
            name="the training pitch"
            showSpeed={showSpeed}
            onBack={onExit}
            onController={(c) => { ctrl.current = c; if (c) { c.setShooter("you"); c.setActive(stepRef.current !== "you-aim" && stepRef.current !== "done"); setThree("ready"); } }}
            onFail={(why) => { console.warn("3D training pitch off:", why); setThree("off"); }}
          />
        </View>
        {three === "loading" && step !== "you-aim" && (
          <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 13, fontWeight: "700" }}>Loading the training pitch…</Text>
          </View>
        )}
        {flash ? (
          <Text pointerEvents="none" style={{ position: "absolute", left: 8, right: 8, top: "22%", textAlign: "center", fontSize: 24, fontWeight: "900", textTransform: "uppercase", lineHeight: 28,
            color: flash.good ? "#fde047" : "#fff", textShadowColor: "#000", textShadowRadius: 8, textShadowOffset: { width: 0, height: 2 } }}>{flash.text}</Text>
        ) : null}
      </View>
      {three === "off" && <Text style={{ marginTop: 4, textAlign: "center", color: "#fde68a", fontSize: 12, fontWeight: "700" }}>This phone can&apos;t show the 3D pitch — the game still plays.</Text>}
      {result && <ResultPanel result={result} who="Team" current={team} onContinue={() => onFinish(result)} />}
    </GameShell>
  );
}

function Strip({ name, score, marks, active }: { name: string; score: number; marks: boolean[]; active: boolean }) {
  return (
    <View style={{ flex: 1, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 4, backgroundColor: active ? "rgba(14,165,233,0.25)" : "rgba(255,255,255,0.1)", borderWidth: active ? 1 : 0, borderColor: "#7dd3fc" }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text style={{ fontSize: 18 }}>{name === "You" ? "⭐" : "👤"}</Text>
        <Text numberOfLines={1} style={{ flex: 1, color: "#fff", fontSize: 12, fontWeight: "900", textTransform: "uppercase" }}>{name}</Text>
        <Text style={{ color: "#fff", fontSize: 22, fontWeight: "900" }}>{score}</Text>
      </View>
      <View style={{ flexDirection: "row", justifyContent: "center", gap: 4, marginTop: 4 }}>
        {Array.from({ length: CROSSBAR_SHOTS }, (_, i) => {
          const m = marks[i];
          return <View key={i} style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: m === undefined ? "rgba(255,255,255,0.18)" : m ? "#fde047" : "#ef4444" }} />;
        })}
      </View>
    </View>
  );
}
