/**
 * THE RELATIONSHIP GAMES PLAYED ON THE MATCH — components/star/relgames/
 * BossPenalties.tsx, BossExtraSession.tsx and WoodworkChallenge.tsx on the
 * phone's EngineFeature (the one match driver, as the website's
 * EngineFeature): the real ball, drag, strike screen, flight and keeper.
 * Each builds its kick's picture with Training's own buildStrike
 * (match/drills.ts), frames the goal close (FRAME_TOP_FOR_GOAL, scene
 * ownFrame), watches the ball and scores with the lib's own rules
 * (bossPenalties.ts, bossSession.ts, relationships.ts gameReward /
 * touchingFrame). Same kicks, same seeds, same lines, same points.
 * Not drawn: the manager's and the team-mates' photos (the phone has no
 * picture faces yet); their names are.
 */
import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { View, Text, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { CareerState } from "@/lib/star/types";
import type { Scenario } from "@/lib/star/canvasEngine";
import { mulberry32 } from "@/lib/star/season";
import { CX, PEN_SPOT_Y, PITCH_W, POST_L, GOAL_W, GOAL_H } from "@/lib/star/pitch";
import { FRAME_TOP_FOR_GOAL } from "@/lib/star/goalFrame";
import { careerPenaltyRunup } from "@/lib/star/runupStyles";
import { BOSS_KICKS, SPOTS, askLine, bossGain, pickSpots, spotCentre, spotOf, SPOT_LABEL, type Spot } from "@/lib/star/bossPenalties";
import { SESSION_REPS, SESSION_FIRST_LEVEL, sessionGain, sessionHits } from "@/lib/star/bossSession";
import { powerDrillForLevel } from "@/lib/star/trainingDrills";
import { gameReward, touchingFrame } from "@/lib/star/relationships";
import type { ChanceResolved } from "../match/setup";
import { buildStrike, DRILL_SCENE } from "../match/drills";
import { EngineFeature } from "./MatchFeature";
import { usePitchHeight } from "./MatchStages";
import { C } from "../ui/theme";

export interface GameResult { won: boolean; gain: number; cost?: number; line?: string }
const toneOf = (v: number) => (v >= 70 ? "#10b981" : v >= 40 ? "#eab308" : "#ef4444");

/** relgames/Shell.tsx GameShell: Back, the game's name, the bar it moves, the game. Not scrollable (the pitch takes the drags). */
function GameShell({ title, who, current, tone, onBack, children }: { title: string; who: string; current: number; tone: string; onBack?: () => void; children: ReactNode }) {
  return (
    <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: "#0b1220", paddingHorizontal: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8 }}>
        {onBack ? <Pressable onPress={onBack} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: "rgba(255,255,255,0.1)" }}><Text style={{ color: "#fff", fontWeight: "900" }}>‹</Text></Pressable> : null}
        <Text style={{ flex: 1, textAlign: "right", color: tone, fontSize: 18, fontWeight: "900", textTransform: "uppercase" }}>{title}</Text>
      </View>
      <View style={{ marginBottom: 8 }}>
        <Text style={{ color: "#fff", fontSize: 11, fontWeight: "900", letterSpacing: 2, marginBottom: 3 }}>{who.toUpperCase()}</Text>
        <View style={{ height: 18, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden", justifyContent: "center" }}>
          <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${Math.max(0, Math.min(100, current))}%`, backgroundColor: toneOf(current) }} />
          <Text style={{ color: "#fff", fontWeight: "900", fontSize: 11, paddingLeft: 6 }}>{Math.round(current)}</Text>
        </View>
      </View>
      {children}
    </SafeAreaView>
  );
}
/** relgames/Shell.tsx ResultPanel. */
function ResultPanel({ result, who, current, onContinue }: { result: GameResult; who: string; current: number; onContinue: () => void }) {
  const after = Math.max(0, Math.min(100, current + result.gain));
  const sign = result.gain > 0 ? `+${result.gain}` : `${result.gain}`;
  return (
    <View style={{ marginTop: 12, padding: 16, borderRadius: 4, borderWidth: 2, alignItems: "center", backgroundColor: result.won ? "rgba(6,78,59,0.8)" : "rgba(69,10,10,0.8)", borderColor: result.won ? "#34d399" : "#ef4444" }}>
      <Text style={{ color: "#fff", fontSize: 20, fontWeight: "900", textTransform: "uppercase" }}>{result.won ? "Nice one" : "Not this time"}</Text>
      {result.line ? <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700", marginTop: 4, textAlign: "center" }}>{result.line}</Text> : null}
      <Text style={{ color: "#fff", fontSize: 15, fontWeight: "900", marginTop: 8, textAlign: "center" }}>
        {result.gain === 0 ? `${who} stays at ${Math.round(current)}.${result.won ? " The higher it is, the harder it moves." : ""}` : `${who} ${sign}: ${Math.round(current)} → ${Math.round(after)}`}
      </Text>
      <Pressable onPress={onContinue} style={{ alignSelf: "stretch", marginTop: 12, paddingVertical: 12, borderRadius: 4, backgroundColor: C.green, alignItems: "center" }}>
        <Text style={{ color: "#05261a", fontSize: 14, fontWeight: "900", textTransform: "uppercase" }}>Continue →</Text>
      </Pressable>
    </View>
  );
}
function Flash({ text, size = 26 }: { text: string | null; size?: number }) {
  if (!text) return null;
  return <Text pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: "33%", textAlign: "center", color: "#fff", fontSize: size, fontWeight: "900", textTransform: "uppercase", textShadowColor: "#000", textShadowRadius: 6 }}>{text}</Text>;
}

/** The close camera on the goal both games use: the match's own frame is far too tall for one shot. */
function goalCam(sc: Scenario, cxOf: (ball: { x: number; y: number }) => number, h: number) {
  const w = h * (5 / 8);
  const cx = Math.max(w / 2, Math.min(PITCH_W - w / 2, cxOf(sc.ball)));
  sc.viewport = { x1: cx - w / 2, x2: cx + w / 2, y1: FRAME_TOP_FOR_GOAL, y2: FRAME_TOP_FOR_GOAL + h };
}

// ── The manager's target penalties (BossPenalties.tsx) ──
export function BossPenalties({ career, onFinish, onCancel }: { career: CareerState; onFinish: (r: GameResult) => void; onCancel: () => void }) {
  const current = career.relationships.boss;
  const boss = career.manager?.name ?? "The manager";
  const seed = career.season * 7307 + career.week * 131;
  const pitchH = Math.round(usePitchHeight() * 0.72);
  const { spots, lines } = useMemo(() => {
    const rng = mulberry32(seed + (Date.now() % 100000));
    const s = pickSpots(rng);
    return { spots: s, lines: s.map((sp, i) => askLine(sp, i, rng)) };
  }, [seed]);
  const [kick, setKick] = useState(0);
  const [hits, setHits] = useState(0);
  const [last, setLast] = useState<{ x: number; z: number; hit: boolean } | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [result, setResult] = useState<GameResult | null>(null);
  const crossRef = useRef<{ x: number; z: number } | null>(null);
  const target = spots[Math.min(kick, BOSS_KICKS - 1)];
  const openOn = useCallback((): Scenario => {
    const setup = buildStrike("power", 1, kick, mulberry32(seed + kick * 977), { trainingLevel: 1, power: career.skills.power });
    const sc = setup.scenario;
    sc.ball = { x: CX, y: PEN_SPOT_Y };
    sc.player = { x: CX, y: PEN_SPOT_Y + 1.2 };
    sc.defenders = [];
    goalCam(sc, () => CX, 22);
    crossRef.current = null;
    return sc;
  }, [seed, kick, career.skills.power]);
  const onBallStep = useCallback((b: { x: number; y: number; z: number }) => {
    if (!crossRef.current && b.y <= 0) crossRef.current = { x: b.x, z: b.z };
  }, []);
  const onChanceResolved = useCallback((info: ChanceResolved) => {
    const at = crossRef.current ?? (info.ball && info.ball.y <= 0.5 ? { x: info.ball.x, z: info.ball.z } : null);
    const hit = !!at && spotOf(at.x, at.z) === target;
    const total = hits + (hit ? 1 : 0);
    setHits(total);
    setLast(at ? { ...at, hit } : null);
    setFlash(hit ? "BANG ON!" : at && spotOf(at.x, at.z) ? "WRONG SPOT" : "MISSED THE GOAL");
    setTimeout(() => setFlash(null), 1000);
    const next = kick + 1;
    if (next >= BOSS_KICKS) {
      setTimeout(() => setResult({
        won: total > 0, gain: bossGain(total),
        line: total === BOSS_KICKS ? "Every one. He's impressed." : total > 0 ? `${total} of ${BOSS_KICKS} where he asked.` : "None where he asked. He walks off.",
      }), 1100);
    } else setTimeout(() => { setKick(next); setLast(null); }, 1100);
  }, [hits, kick, target]);
  return (
    <GameShell title="The manager's penalties" who="Boss" current={current} tone="#60a5fa" onBack={kick === 0 && !result ? onCancel : undefined}>
      <View style={{ backgroundColor: "#334155", borderRadius: 6, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 8 }}>
        <Text style={{ color: "#bfdbfe", fontSize: 11, fontWeight: "900", textTransform: "uppercase" }}>{boss}</Text>
        <Text style={{ color: "#fff", fontSize: 15, fontWeight: "900" }}>{result ? "That'll do." : lines[kick]}</Text>
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
        <Text style={{ color: "#fff", fontSize: 13, fontWeight: "900", textTransform: "uppercase" }}>Kick {Math.min(kick + 1, BOSS_KICKS)} / {BOSS_KICKS}</Text>
        <Text>{Array.from({ length: BOSS_KICKS }, (_, i) => <Text key={i} style={{ color: i < hits ? "#6ee7b7" : "rgba(255,255,255,0.3)", fontSize: 14 }}>◎</Text>)}</Text>
      </View>
      <TargetBoard target={result ? null : target} last={last} />
      <View style={{ marginTop: 8 }}>
        {!result && <EngineFeature key={kick} height={pitchH} openOn={openOn} onChanceResolved={onChanceResolved} onBallStep={onBallStep}
          skills={{ power: career.skills.power, technique: career.skills.technique }} keeperStrength={0} seed={seed + kick}
          penaltyRunup={careerPenaltyRunup(career)} scene={{ ...DRILL_SCENE.power, keeper: false, ownFrame: true }} />}
        <Flash text={flash} />
      </View>
      {result && <ResultPanel result={result} who="Boss" current={current} onContinue={() => onFinish(result)} />}
    </GameShell>
  );
}
/** The goal front-on (7.32 m × 2.44 m), a target on each of the six spots, a dot where your shot went. */
function TargetBoard({ target, last }: { target: Spot | null; last: { x: number; z: number; hit: boolean } | null }) {
  const W = 300, H = Math.round(W * (GOAL_H / GOAL_W)) + 8, pad = 6;
  const sx = (x: number) => pad + ((x - POST_L) / GOAL_W) * (W - pad * 2);
  const sy = (z: number) => H - 4 - (z / GOAL_H) * (H - 8);
  const r = (H - 8) / 4.6;
  const ring = (cx: number, cy: number, rr: number, color: string, key: string) => <View key={key} style={{ position: "absolute", left: cx - rr, top: cy - rr, width: rr * 2, height: rr * 2, borderRadius: rr, backgroundColor: color }} />;
  return (
    <View style={{ alignSelf: "center", width: W }}>
      <View style={{ width: W, height: H }}>
        <View style={{ position: "absolute", left: pad, top: 4, width: W - pad * 2, height: H - 8, backgroundColor: "rgba(255,255,255,0.06)" }} />
        {SPOTS.map((s) => {
          const c = spotCentre(s), on = s === target, X = sx(c.x), Y = sy(c.z);
          return (
            <View key={s} style={{ position: "absolute", left: 0, top: 0, width: W, height: H, opacity: on ? 1 : 0.28 }} pointerEvents="none">
              {ring(X, Y, r, "#ffffff", "a")}{ring(X, Y, r * 0.78, "#1d4ed8", "b")}{ring(X, Y, r * 0.56, "#dc2626", "c")}{ring(X, Y, r * 0.32, "#facc15", "d")}
              {on && <View style={{ position: "absolute", left: X - r - 3, top: Y - r - 3, width: (r + 3) * 2, height: (r + 3) * 2, borderRadius: r + 3, borderWidth: 2.5, borderColor: "#facc15" }} />}
            </View>
          );
        })}
        <View style={{ position: "absolute", left: pad - 2, top: 2, width: W - pad * 2 + 4, height: H - 2, borderLeftWidth: 4, borderRightWidth: 4, borderTopWidth: 4, borderColor: "#fff" }} />
        {last && <View style={{ position: "absolute", left: Math.max(2, Math.min(W - 2, sx(last.x))) - 6, top: Math.max(2, Math.min(H - 2, sy(last.z))) - 6, width: 12, height: 12, borderRadius: 6, backgroundColor: last.hit ? "#34d399" : "#f87171", borderWidth: 1.5, borderColor: "#000" }} />}
      </View>
      {target && <Text style={{ marginTop: 4, textAlign: "center", color: "#fcd34d", fontSize: 12, fontWeight: "900", letterSpacing: 1, textTransform: "uppercase" }}>Aim: {SPOT_LABEL[target]}</Text>}
    </View>
  );
}

// ── Extra session (BossExtraSession.tsx) ──
export function BossExtraSession({ career, onFinish, onCancel }: { career: CareerState; onFinish: (r: GameResult) => void; onCancel: () => void }) {
  const current = career.relationships.boss;
  const boss = career.manager?.name ?? "The manager";
  const seed = career.season * 5113 + career.week * 173;
  const power = career.skills.power;
  const pitchH = usePitchHeight();
  const [rep, setRep] = useState(0);
  const [goals, setGoals] = useState(0);
  const [flash, setFlash] = useState<string | null>(null);
  const [result, setResult] = useState<GameResult | null>(null);
  const level = SESSION_FIRST_LEVEL + rep;
  const byLevel = useMemo(() => ({ trainingLevel: level, power }), [level, power]);
  const drill = powerDrillForLevel(level, rep, power);
  const openOn = useCallback((): Scenario => {
    const setup = buildStrike("power", 1, rep, mulberry32(seed + rep * 911), byLevel);
    goalCam(setup.scenario, (ball) => (ball.x + CX) / 2, Math.max(22, setup.scenario.ball.y + 10));
    return setup.scenario;
  }, [rep, seed, byLevel]);
  const onChanceResolved = useCallback((info: ChanceResolved) => {
    const o = info.teammateShot ? "saved" : info.outcome;
    const scored = o === "goal" || o === "rebound";
    const total = goals + (scored ? 1 : 0);
    setGoals(total);
    setFlash(scored ? "GOAL!" : o === "saved" || o === "tipped" || o === "caught" ? "SAVED" : o === "blocked" || o === "tackled" ? "BLOCKED" : o === "post" ? "OFF THE POST" : o === "over" ? "OVER" : "WIDE");
    setTimeout(() => setFlash(null), 1000);
    const next = rep + 1;
    if (next >= SESSION_REPS) {
      const hits = sessionHits(total);
      setTimeout(() => setResult({
        won: hits > 0, gain: sessionGain(total),
        line: total === SESSION_REPS ? "Every one in. He nods and writes something down." : total > 0 ? `${total} of ${SESSION_REPS} in.` : "Not one in. He walks off before you finish.",
      }), 1100);
    } else setTimeout(() => setRep(next), 1100);
  }, [goals, rep]);
  return (
    <GameShell title="Extra session" who="Boss" current={current} tone="#60a5fa" onBack={rep === 0 && !result ? onCancel : undefined}>
      <Text style={{ color: "#fcd34d", fontSize: 15, fontWeight: "900", textTransform: "uppercase" }}>The manager is watching</Text>
      <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700", marginBottom: 6 }}>{boss} · score as many as you can</Text>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
        <Text style={{ color: "#fff", fontSize: 13, fontWeight: "900", textTransform: "uppercase" }}>Shot {Math.min(rep + 1, SESSION_REPS)} / {SESSION_REPS}</Text>
        <Text>{Array.from({ length: SESSION_REPS }, (_, i) => <Text key={i} style={{ opacity: i < goals ? 1 : 0.3 }}>⚽</Text>)}</Text>
      </View>
      <View>
        {!result && <EngineFeature key={rep} height={pitchH} openOn={openOn} onChanceResolved={onChanceResolved}
          skills={{ power: career.skills.power, technique: career.skills.technique }} keeperStrength={drill.keeperStrength} seed={seed + rep}
          scene={drill.keeper ? { ...DRILL_SCENE.power, ownFrame: true } : { ...DRILL_SCENE.power, keeper: false, ownFrame: true }} />}
        <Flash text={flash} />
      </View>
      {result && <ResultPanel result={result} who="Boss" current={current} onContinue={() => onFinish(result)} />}
    </GameShell>
  );
}

// ── Woodwork challenge (WoodworkChallenge.tsx) ──
const SHOTS = 5;
export function WoodworkChallenge({ career, onFinish, onCancel }: { career: CareerState; onFinish: (r: GameResult) => void; onCancel: () => void }) {
  const current = career.relationships.team;
  const pitchH = usePitchHeight();
  const mates = useMemo(() => {
    const rng = mulberry32(career.season * 991 + career.week * 37);
    const pool = (career.squad ?? []).filter((p) => p.position !== "GK");
    const pick = [pool[Math.floor(rng() * pool.length)], pool[Math.floor(rng() * pool.length)]].filter(Boolean);
    return pick.slice(0, 2).map((p, i) => {
      const chance = 0.16 + Math.min(99, p.overall ?? 60) / 600;
      let hits = 0;
      for (let s = 0; s < SHOTS; s++) if (rng() < chance) hits++;
      return { id: p.id ?? String(i), name: p.name.split(" ").slice(-1)[0], hits };
    });
  }, [career.season, career.week, career.squad]);
  const best = Math.max(1, ...mates.map((m) => m.hits));
  const [shot, setShot] = useState(0);
  const [hits, setHits] = useState(0);
  const [flash, setFlash] = useState<string | null>(null);
  const [result, setResult] = useState<GameResult | null>(null);
  const hitRef = useRef(false);
  const openOn = useCallback((): Scenario => {
    const setup = buildStrike("power", 1, shot, mulberry32(career.season * 131 + career.week * 17 + shot), { trainingLevel: 1, power: career.skills.power });
    goalCam(setup.scenario, (ball) => (ball.x + CX) / 2, Math.max(22, setup.scenario.ball.y + 10));
    hitRef.current = false;
    return setup.scenario;
  }, [shot, career.season, career.week, career.skills.power]);
  const onBallStep = useCallback((b: { x: number; y: number; z: number }) => {
    if (!hitRef.current && touchingFrame(b)) hitRef.current = true;
  }, []);
  const onChanceResolved = useCallback(() => {
    const hit = hitRef.current;
    const total = hits + (hit ? 1 : 0);
    setHits(total);
    setFlash(hit ? "OFF THE WOODWORK!" : "MISSED THE FRAME");
    setTimeout(() => setFlash(null), 900);
    const next = shot + 1;
    if (next >= SHOTS) {
      const won = total >= best;
      setTimeout(() => setResult({ won, gain: gameReward(won, current, Math.random(), "team"), line: `You hit the frame ${total} of ${SHOTS}. Best of the lads: ${best}.` }), 900);
    } else setTimeout(() => setShot(next), 900);
  }, [hits, shot, best, current]);
  const score = (name: string, sc: string, sub: string, icon: string) => (
    <View key={name} style={{ flex: 1, alignItems: "center", backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 4, paddingVertical: 6 }}>
      <Text style={{ fontSize: 18 }}>{icon}</Text>
      <Text numberOfLines={1} style={{ color: "#fff", fontSize: 11, fontWeight: "900", textTransform: "uppercase" }}>{name}</Text>
      <Text style={{ color: "#fff", fontSize: 20, fontWeight: "900" }}>{sc}</Text>
      <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>{sub}</Text>
    </View>
  );
  return (
    <GameShell title="Woodwork challenge" who="Team" current={current} tone="#34d399" onBack={shot === 0 && !result ? onCancel : undefined}>
      <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700", marginBottom: 6 }}>Hit the post or the bar. Five shots each. Beat the lads.</Text>
      <View style={{ flexDirection: "row", gap: 4, marginBottom: 8 }}>
        {score("You", `${hits}`, `shot ${Math.min(shot + 1, SHOTS)}/${SHOTS}`, "⭐")}
        {mates.map((m) => score(m.name, `${m.hits}`, "5 shots", "👤"))}
      </View>
      <View>
        {!result && <EngineFeature key={shot} height={pitchH} openOn={openOn} onChanceResolved={onChanceResolved} onBallStep={onBallStep}
          skills={{ power: career.skills.power, technique: career.skills.technique }} keeperStrength={0}
          seed={career.season * 131 + career.week * 17 + shot} scene={{ ...DRILL_SCENE.power, keeper: false, ownFrame: true }} />}
        <Flash text={flash} size={24} />
      </View>
      {result && <ResultPanel result={result} who="Team" current={current} onContinue={() => onFinish(result)} />}
    </GameShell>
  );
}
