/**
 * THE TWO NIGHTS, AS THE WEBSITE DRAWS THEM WHEN IT HAS NO 3D.
 *
 *   GoldenBallNight: components/star/BallonDorNight.tsx (the New look, the
 *     website's default) with its drawn stage (StageDrawn: the wall and its
 *     gold ring, the floor, the three podiums and their beams, the host at
 *     his lectern, two rows of guests, the golden ball rising to the winner),
 *     its captions word for word, its timing (lib/star/ballonDorNight.ts), its
 *     Skip / Continue; then the result page of components/star/BallonDor.tsx
 *     (your finish, your season, the winner, the final top ten, Continue).
 *   SeasonAwardsNight: components/star/SeasonAwardsNight.tsx with its drawn
 *     room (RoomDrawn: bulbs, the screen, curtains, the stage, the lectern,
 *     the tables, the winner walking up), its captions, nominee cards, dots,
 *     tap for the next award, Skip all; timing from lib/star/awardsNight.ts.
 *     Then the season awards page (SeasonEnd.tsx SeasonAwardsScreen).
 *
 * The website plays these in 3D on a phone that can; its own drawn stage is
 * what it shows when it can't, and that is what is here. Faces: as the
 * website, each man's headshot shot from his 3D model (three/Headshot3D.tsx),
 * his drawn head in his kit (draw/PlayerHead.tsx) until it is made.
 * The still parts (wall, floor, room) are drawn once as pictures; the clock
 * runs only while the night plays and stops when it ends.
 */
import { TopSpace } from "../../ui/safe";
import { createContext, memo, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { View, Text, Image, Pressable, type LayoutChangeEvent } from "react-native";
import Animated, { FadeInDown, ZoomIn, useAnimatedStyle, useSharedValue, withTiming, withRepeat, withSequence, Easing, type SharedValue } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import type { CareerState } from "@/lib/star/types";
import { computeBallonDorShortlist, type BallonDorEntry, type BallonDorResult } from "@/lib/star/ballonDor";
import { nightPlan, beatAt, callingAt, finalistXAt, podiumHeightAt, podiumX, placeWord, PODIUM, type NightPlan, type Finalist } from "@/lib/star/ballonDorNight";
import { awardsPlan, awardAt, beatAt as awardBeatAt, skipTarget, personId, type AwardsPlan, type AwardCall } from "@/lib/star/awardsNight";
import type { AwardWinner } from "@/lib/star/seasonAwards";
import { kitsOf } from "@/lib/star/kits";
import { shortClub } from "@/lib/star/media/grammar";
import { headshotIdFor } from "@/lib/star/headshot3d/look";
import { skinToneHex } from "@/lib/star/playerIdentity";
import { seasonLabelOf } from "@/lib/star/goalClip/reel";
import { leoUpdateOn } from "@/lib/star/leoUpdate";
import { retirementCheck } from "@/lib/star/retirement";
import { Drawn } from "../../draw/useDrawing";
import { paintStageBack, paintPodiums, paintHost, paintRoomBack } from "../../draw/ceremonyPaint";
import { PlayerHead } from "../../draw/PlayerHead";
import { Headshot3D } from "../../three/Headshot3D";
import { playerOf } from "@/lib/star/potm";
import { playCheer } from "../../match/sound";
import { setMusicScene, clearMusicScene } from "../../match/music";
import { partOff } from "../../safety";
import { usePrefs } from "../../game/prefs";
import { AwardsStage3D, BallonStage3D, type NightHandle } from "./Night3D";
import * as flow from "../../game/flow";
import { ClubCrest } from "./kit";
import { Backdrop, glassStyle } from "../../ui/look";
import { SeasonAwardsScreen } from "./SeasonEnd";

const GOLD = "#fbbf24";
const AMBER200 = "#fde68a";
const AMBER300 = "#fcd34d";

// ── Small shared pieces ─────────────────────────────────────────────────────

/** lib/star/trophyArt.ts's pictures, kept in the app. */
export const TROPHY_ART: Record<string, number> = {
  "Premier League": require("../../../assets/trophies/premier-league.webp"),
  "Championship": require("../../../assets/trophies/championship.webp"),
  "League One": require("../../../assets/trophies/league-one.webp"),
  "League Two": require("../../../assets/trophies/league-two.webp"),
  "National League": require("../../../assets/trophies/national-league.webp"),
  "FA Cup": require("../../../assets/trophies/fa-cup.webp"),
  "League Cup": require("../../../assets/trophies/league-cup.webp"),
  "Champions League": require("../../../assets/trophies/champions-league.webp"),
  "Europa League": require("../../../assets/trophies/europa-league.webp"),
  "World Cup": require("../../../assets/trophies/world-cup.webp"),
  "Golden Ball": require("../../../assets/trophies/ballon-dor.webp"),
  "Ballon d'Or": require("../../../assets/trophies/ballon-dor.webp"),
  "Golden Boot": require("../../../assets/trophies/golden-boot.webp"),
  "Player of the Month": require("../../../assets/trophies/player-of-the-month.webp"),
  "Player of the Season": require("../../../assets/trophies/player-of-the-season.webp"),
};

/** components/star/TrophyImage.tsx: the trophy's picture by its height, else the emoji. */
export function TrophyImage({ name, height, fallback = "🏆" }: { name: string; height: number; fallback?: string }) {
  const src = TROPHY_ART[name];
  if (!src) return <Text style={{ fontSize: height * 0.75, lineHeight: height }}>{fallback}</Text>;
  return <Image source={src} style={{ height, width: height * 0.8 }} resizeMode="contain" />;
}

/**
 * A man's face in a ring (the website's headshot chip): his 3D headshot
 * (three/Headshot3D.tsx), his drawn head in his kit until it is made or when
 * the phone can't make it. The id is the one his Player of the Month card
 * uses (the website's HeadshotCareer: potm.ts playerOf), so he has one face.
 */
function Face({ name, club, isYou, career, size, ring }: { name: string; club: string; isYou: boolean; career: CareerState; size: number; ring: string }) {
  const kit = isYou ? kitsOf(career.player.club, career.clubKits?.[career.player.club]).home : kitsOf(club).home;
  const id = headshotIdFor(name, club, isYou, isYou ? undefined : playerOf(career, name, club)?.id);
  const skin = isYou ? skinToneHex(career.player.skinTone) : undefined;
  const still = useContext(NightStill);
  return (
    <View style={{ width: size + 6, height: size + 6, borderRadius: (size + 6) / 2, borderWidth: 3, borderColor: ring, backgroundColor: kit.shirt, overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
      <Headshot3D id={id} you={isYou} kit={{ shirt: kit.shirt, trim: kit.trim }} size={size} zoom={size >= 60 ? 1.1 : 1.4} cacheOnly={still}
        fallback={<PlayerHead id={id} shirt={kit.shirt} shorts={kit.trim} trim={kit.trim} size={size} skin={skin} />} />
    </View>
  );
}

/** ui.tsx Burst: bits of confetti thrown out from one point, falling away. */
function Burst({ colors, count, spread, round, x, y }: { colors: string[]; count: number; spread: number; round?: boolean; x: number; y: number }) {
  const p = useSharedValue(0);
  useEffect(() => { p.value = withTiming(1, { duration: 1500, easing: Easing.out(Easing.quad) }); }, [p]);
  const bits = useMemo(() => Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2 + ((i * 7919) % 100) / 100;
    const v = (60 + ((i * 104729) % 90)) * spread;
    return { vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60 * spread, c: colors[i % colors.length], s: 5 + (i % 4), spin: (i % 2 ? 1 : -1) * (200 + (i * 37) % 300) };
  }), [count, spread, colors]);
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: x, top: y }}>
      {bits.map((b, i) => <Bit key={i} p={p} b={b} round={!!round} />)}
    </View>
  );
}
function Bit({ p, b, round }: { p: SharedValue<number>; b: { vx: number; vy: number; c: string; s: number; spin: number }; round: boolean }) {
  const st = useAnimatedStyle(() => ({
    opacity: 1 - p.value * p.value,
    transform: [{ translateX: b.vx * p.value }, { translateY: b.vy * p.value + 260 * p.value * p.value }, { rotate: `${b.spin * p.value}deg` }],
  }));
  return <Animated.View style={[{ position: "absolute", width: b.s, height: round ? b.s : b.s * 0.5, borderRadius: round ? b.s / 2 : 1, backgroundColor: b.c }, st]} />;
}

/**
 * The night's clock (seconds), ticking about 30 times a second while it plays
 * and stopping once it is over. `jump` moves it (a skip). `frozen` holds it.
 */
function useNightClock(end: number, run = true, hz = 30) {
  const startRef = useRef<number | null>(null);
  const frozen = useRef<number | null>(null);
  const [t, setT] = useState(0);
  // Not started (the 3D stage is still loading): second 0. `run` starts it, the drawn night at once.
  const now = useCallback(() => (frozen.current ?? (startRef.current === null ? 0 : (Date.now() - startRef.current) / 1000)), []);
  useEffect(() => {
    if (!run) return;
    if (startRef.current === null) startRef.current = Date.now();
    let raf = 0, last = -1;
    const f = () => {
      const s = now();
      if (s - last >= 1 / hz) { last = s; setT(s); }
      raf = s < end + 2 ? requestAnimationFrame(f) : 0;
    };
    raf = requestAnimationFrame(f);
    return () => cancelAnimationFrame(raf);
  }, [end, now, run, hz]);
  const jump = useCallback((to: number) => {
    if (frozen.current !== null) frozen.current = to;
    else if (startRef.current !== null) startRef.current -= (to - now()) * 1000;
    setT(to);
  }, [now]);
  /** Hold the night at second `to` (the web build's stills: window.__kibNight.seek). */
  const freeze = useCallback((to: number) => { frozen.current = to; setT(to); }, []);
  const isFrozen = useCallback(() => frozen.current !== null, []);
  return { t, now, jump, freeze, isFrozen };
}

/** In the 3D night the nominee cards show only headshots already made (a new one would shoot on a second GL while the room plays). */
const NightStill = createContext(false);

/** The website's `window.__bdorNight` / `__awardsNight`: hold the night at second t, for stills. */
function useSeekHook(plan: unknown, mode: string, freeze: (t: number) => void, handle: { current: NightHandle | null }) {
  useEffect(() => {
    const w = globalThis as unknown as { __kibNight?: unknown };
    w.__kibNight = { plan, mode, seek(at: number) { freeze(at); handle.current?.debugSeek(at); } };
    return () => { delete w.__kibNight; };
  }, [plan, mode, freeze, handle]);
}

/** The words while the 3D room loads (the website's "The doors open"). */
function LoadingLine({ small, text }: { small: string; text: string }) {
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 16, right: 16, bottom: 84, alignItems: "center" }}>
      <Lower small={small}>{text}</Lower>
    </View>
  );
}

function Lower({ small, children, size = 30 }: { small: string; children: ReactNode; size?: number }) {
  return (
    <View style={{ alignItems: "center" }}>
      <Text style={{ color: AMBER200, fontSize: 12, fontWeight: "900", letterSpacing: 2.4, textTransform: "uppercase", textShadowColor: "#000", textShadowRadius: 3, textShadowOffset: { width: 0, height: 1 }, textAlign: "center" }}>{small}</Text>
      <Text style={{ color: "#fff", fontSize: size, fontWeight: "900", textTransform: "uppercase", textAlign: "center", textShadowColor: "rgba(0,0,0,0.9)", textShadowRadius: 8, textShadowOffset: { width: 0, height: 2 } }}>{children}</Text>
    </View>
  );
}

function useSize() {
  const [size, setSize] = useState<{ W: number; H: number } | null>(null);
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((s) => (s && Math.abs(s.W - width) < 1 && Math.abs(s.H - height) < 1 ? s : { W: width, H: height }));
  }, []);
  return { size, onLayout };
}

/** The dark band behind the title at the top (the website's gradient to clear). */
function TopShade({ W, h, alpha }: { W: number; h: number; alpha: number }) {
  const draw = useCallback((g: CanvasRenderingContext2D) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, `rgba(0,0,0,${alpha})`);
    gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, W, h);
  }, [W, h, alpha]);
  return <View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0 }}><Drawn width={W} height={h} draw={draw} /></View>;
}

// ═══ THE GOLDEN BALL NIGHT ══════════════════════════════════════════════════

export function GoldenBallNight({ career, go }: { career: CareerState; go: (s: flow.Step) => void }) {
  const result = useMemo(() => computeBallonDorShortlist(career), [career]);
  const [stage, setStage] = useState<"ceremony" | "result">("ceremony");
  // Game music (BallonDorNight.tsx): suspense while the names are read, then win or loss (the ceremony says when the winner is named).
  const youWon = result.playerNominated && result.playerRank === 1;
  const ceremonyShown = stage === "ceremony" && result.entries.length >= 3;
  useEffect(() => { setMusicScene("bdor", { kind: "ballon-dor", won: ceremonyShown ? null : youWon }, 10); }, [ceremonyShown, youWon]);
  useEffect(() => () => clearMusicScene("bdor"), []);
  if (stage === "result" || result.entries.length < 3) return <GoldenBallResult career={career} result={result} go={go} />;
  return <GoldenBallCeremony career={career} result={result} onDone={() => setStage("result")} />;
}

/** Stage metres across → % of the screen (BallonDorNight.tsx xPct). */
const xPct = (x: number) => 50 + x * 14;

function GoldenBallCeremony({ career, result, onDone }: { career: CareerState; result: BallonDorResult; onDone: () => void }) {
  const yourRank = result.playerNominated ? result.playerRank : 0;
  const plan = useMemo(() => nightPlan(result.entries, yourRank, (career.player.startYear ?? 0) * 31 + career.season), [result, yourRank, career.player.startYear, career.season]);
  // The website's New night: the 3D stage when the phone can, the drawn stage (same beats) when it can't or the 3D takes too long.
  const [mode, setMode] = useState<"3d" | "drawn">(() => (partOff("3d") ? "drawn" : "3d"));
  const [ready3d, setReady3d] = useState(false);
  const ready = mode === "drawn" || ready3d;
  const { t, now, freeze, isFrozen } = useNightClock(plan.end + 1.5, ready, mode === "3d" ? 10 : 30);
  const prefs = usePrefs();
  const handle = useRef<NightHandle | null>(null);
  useSeekHook(plan, mode, freeze, handle);
  const { size, onLayout } = useSize();
  const finished = useRef(false);
  const finish = useCallback(() => { if (!finished.current) { finished.current = true; onDone(); } }, [onDone]);
  useEffect(() => { if (ready && !isFrozen() && t >= plan.end + 1.5) finish(); }, [ready, t, plan.end, finish, isFrozen]);
  const revealed = t >= plan.revealAt;
  useEffect(() => { if (revealed && !isFrozen()) playCheer(); }, [revealed, isFrozen]);
  // Game music (off unless Settings has it on): suspense while the names are read, then win or loss (lib/star/gameMusic.ts, as the website).
  const youWon = result.playerNominated && result.playerRank === 1;
  useEffect(() => {
    setMusicScene("bdor", { kind: "ballon-dor", won: revealed ? youWon : null }, 10);
  }, [revealed, youWon]);
  return (
    <NightStill.Provider value={mode === "3d"}>
    <View style={{ flex: 1, backgroundColor: "#070912" }} onLayout={onLayout}>
      {mode === "3d" && <BallonStage3D career={career} plan={plan} clock={now} handle={handle} showSpeed={prefs.show3dSpeed} onReady={() => setReady3d(true)} onFail={() => setMode("drawn")} />}
      {mode === "3d" && !ready && <LoadingLine small="The doors open" text="Taking your seats…" />}
      {mode === "drawn" && size && <StageDrawn career={career} plan={plan} t={t} W={size.W} H={size.H} />}
      {size && <TopShade W={size.W} h={120} alpha={0.6} />}
      {size && <NightCaptions career={career} plan={plan} t={t} H={size.H} loading={!ready} />}
      {revealed && size && (
        <>
          <Burst colors={["#fde047", "#fbbf24", "#ffffff", "#f59e0b", "#fef3c7"]} count={44} spread={2.3} x={size.W / 2} y={size.H * 0.34} />
          <Burst colors={["#fde047", "#fbbf24", "#ffffff"]} count={28} spread={1.5} round x={size.W / 2} y={size.H * 0.26} />
        </>
      )}
      <SafeAreaView edges={["bottom"]} pointerEvents="box-none" style={{ position: "absolute", right: 16, bottom: 18 }}>
        <Pressable onPress={finish} style={{ backgroundColor: "#fbbf24", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 2 }}>
          <Text style={{ color: "#030712", fontWeight: "900", fontSize: 13, textTransform: "uppercase" }}>{t >= plan.end ? "Continue ›" : "Skip ›"}</Text>
        </Pressable>
      </SafeAreaView>
    </View>
    </NightStill.Provider>
  );
}

function NightCaptions({ career, plan, t, H, loading = false }: { career: CareerState; plan: NightPlan; t: number; H: number; loading?: boolean }) {
  const beat = beatAt(plan, t);
  const winner = plan.finalists[0];
  const calling = callingAt(plan, t);
  const youWon = plan.yourRank === 1;
  let line: ReactNode = null;
  if (beat === "host" || beat === "room") line = <Lower small="Your host tonight">A legend of the game</Lower>;
  else if (beat === "walk") line = calling ? <Lower small={`From ${shortClub(calling.entry.club)}…`}>{calling.entry.name}!</Lower> : <Lower small="Please welcome">The final three</Lower>;
  else if (beat === "call") line = <Lower small="The host opens the envelope">And the winner is…</Lower>;
  else if (beat === "pause") line = <PauseDots />;
  else {
    line = (
      <Animated.View entering={ZoomIn.duration(800)} style={{ alignItems: "center" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <ClubCrest club={winner.entry.club} size={18} />
          <Text style={{ color: AMBER200, fontSize: 12, fontWeight: "900", letterSpacing: 2, textTransform: "uppercase" }}>{shortClub(winner.entry.club)}</Text>
        </View>
        <Text style={{ color: GOLD, fontSize: beat === "yours" ? 30 : 42, fontWeight: "900", textTransform: "uppercase", textAlign: "center", textShadowColor: "rgba(251,191,36,0.6)", textShadowRadius: 22 }}>{youWon ? "You!" : winner.entry.name}</Text>
        <Text style={{ color: "#fff", fontSize: 13, fontWeight: "900", textTransform: "uppercase", marginTop: 4 }}>{youWon ? `${winner.entry.name} wins the Golden Ball` : "wins the Golden Ball"}</Text>
      </Animated.View>
    );
  }
  const yours = beat === "yours" || (beat === "done" && plan.yourRank !== 1);
  return (
    <>
      <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, alignItems: "center" }}>
        <TopSpace min={44} />
        <Text style={{ color: AMBER200, fontSize: 11, fontWeight: "900", letterSpacing: 3.3, textTransform: "uppercase" }}>Season {career.season}</Text>
        <Text style={{ color: "#fff", fontSize: 30, fontWeight: "900", textTransform: "uppercase", textShadowColor: "rgba(0,0,0,0.8)", textShadowRadius: 6 }}>Golden Ball</Text>
      </View>
      <View pointerEvents="none" style={{ position: "absolute", left: 16, right: 16, bottom: Math.max(76, H * 0.02 + 76), alignItems: "center", gap: 12 }}>
        {!loading && <Animated.View key={`${beat}-${calling?.rank ?? 0}`} entering={FadeInDown.duration(450)}>{line}</Animated.View>}
        {yours && (
          <Animated.View entering={FadeInDown.duration(450)} style={{ backgroundColor: "rgba(0,0,0,0.65)", borderRadius: 2, borderWidth: 1, borderColor: "rgba(251,191,36,0.5)", paddingHorizontal: 12, paddingVertical: 6 }}>
            <Text style={{ color: "#fff", fontSize: 15, fontWeight: "900", textTransform: "uppercase" }}>
              {plan.yourRank > 0 ? <>You finished <Text style={{ color: GOLD }}>{placeWord(plan.yourRank)}</Text></> : "You were not on the list this year"}
            </Text>
          </Animated.View>
        )}
      </View>
    </>
  );
}

function PauseDots() {
  const o = useSharedValue(0.35);
  useEffect(() => { o.value = withRepeat(withSequence(withTiming(1, { duration: 450 }), withTiming(0.35, { duration: 450 })), 3); }, [o]);
  const st = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.Text style={[{ color: AMBER200, fontSize: 44, fontWeight: "900" }, st]}>…</Animated.Text>;
}

/** The wall, its light strips, the gold ring and the floor: drawn once (again only when the ring glows). */
const StageBack = memo(function StageBack({ W, H, glow }: { W: number; H: number; glow: boolean }) {
  const draw = useCallback((g: CanvasRenderingContext2D) => {
    paintStageBack(g, W, H, glow);
  }, [W, H, glow]);
  return <View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0 }}><Drawn width={W} height={H} draw={draw} /></View>;
});

/** The light beams over the podiums and the podiums themselves (drawn again only while they change). */
function Podiums({ W, H, items }: { W: number; H: number; items: { left: number; px: number; beam: number; win: boolean }[] }) {
  const key = items.map((i) => `${i.left}|${Math.round(i.px)}|${i.beam}|${i.win}`).join(",");
  const draw = useCallback((g: CanvasRenderingContext2D) => {
    paintPodiums(g, W, H, items);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [W, H, key]);
  return <View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0 }}><Drawn width={W} height={H} draw={draw} /></View>;
}

/** The host: a man in a dinner suit with a microphone — nobody real (BallonDorNight.tsx HostFigure, its SVG drawn here). */
function HostFigure({ width, arm }: { width: number; arm: number }) {
  const k = width / 64;
  const draw = useCallback((g: CanvasRenderingContext2D) => {
    paintHost(g, k, arm);
  }, [k, arm]);
  return <Drawn width={width} height={120 * k} draw={draw} />;
}

/** Two rows of guests along the bottom; up and cheering at the reveal. */
const Audience = memo(function Audience({ H, cheer }: { H: number; cheer: boolean }) {
  const bob = useSharedValue(0);
  useEffect(() => {
    // The website's guests sway on a loop; here they bounce for the cheer only, then stay still.
    if (cheer) bob.value = withRepeat(withSequence(withTiming(-5, { duration: 160 }), withTiming(0, { duration: 160 })), 10);
  }, [cheer, bob]);
  const st = useAnimatedStyle(() => ({ transform: [{ translateY: bob.value }] }));
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: H * 0.13, overflow: "hidden", zIndex: 7 }}>
      {Array.from({ length: 34 }, (_, i) => {
        const row = i % 2;
        const x = ((i * 37) % 100) + (row ? 1.5 : 0);
        const gown = (i * 7) % 9 === 0;
        const s = 0.85 + ((i * 13) % 7) / 20;
        return (
          <Animated.View key={i} style={[{ position: "absolute", left: `${x}%`, bottom: row ? 2 : -10, opacity: row ? 0.75 : 1, alignItems: "center" }, i % 3 === 0 ? st : null]}>
            <View style={{ width: 13 * s, height: 13 * s, borderRadius: 7 * s, backgroundColor: "#1d1712" }} />
            <View style={{ width: 30 * s, height: 26 * s, marginTop: -2, borderTopLeftRadius: 14, borderTopRightRadius: 14, borderBottomLeftRadius: 3, borderBottomRightRadius: 3, backgroundColor: gown ? "#3b0d16" : "#0b0d14" }} />
          </Animated.View>
        );
      })}
    </View>
  );
});

function StageDrawn({ career, plan, t, W, H }: { career: CareerState; plan: NightPlan; t: number; W: number; H: number }) {
  const revealed = t >= plan.revealAt;
  const winner = plan.finalists[0];
  const beat = beatAt(plan, t);
  const hostTalking = beat === "host" || beat === "call" || (plan.kind === "full" && beat === "walk");
  const waving = revealed && t < plan.revealAt + 2.2;
  const lift = Math.max(0, Math.min(1, (t - plan.revealAt - 0.2) / 1.6));
  const e = lift * lift * (3 - 2 * lift);
  const ballX = xPct(PODIUM.hostX - 1.05) + (xPct(podiumX(winner.slot)) - xPct(PODIUM.hostX - 1.05)) * e;
  const overHead = 30 + podiumHeightAt(plan, 1, t) * 90 + 112;
  const ballUp = overHead * e + Math.sin(e * Math.PI) * 60;
  const floorB = H * 0.34;
  const podiums = plan.finalists.map((f) => {
    const at = finalistXAt(f, t);
    const win = revealed && f.rank === 1;
    return { left: xPct(podiumX(f.slot)), px: 30 + podiumHeightAt(plan, f.rank, t) * 90, beam: at.on ? (revealed ? (win ? 0.34 : 0.08) : 0.16) : 0, win };
  });
  const hostW = 64;
  return (
    <View style={{ position: "absolute", left: 0, top: 0, width: W, height: H }}>
      <StageBack W={W} H={H} glow={revealed} />
      <Podiums W={W} H={H} items={podiums} />
      {plan.finalists.map((f, i) => (
        <View key={f.rank}>
          {revealed && <Animated.Text entering={FadeInDown.duration(450)} style={{ position: "absolute", left: (podiums[i].left / 100) * W - 42, width: 84, bottom: floorB + podiums[i].px - 32, textAlign: "center", color: AMBER300, fontSize: 20, fontWeight: "900" }}>{f.rank}</Animated.Text>}
          <DrawnFinalist career={career} plan={plan} f={f} t={t} W={W} floorB={floorB} />
        </View>
      ))}
      <View pointerEvents="none" style={{ position: "absolute", bottom: floorB, left: (Math.min(90, xPct(PODIUM.hostX)) / 100) * W - hostW / 2, width: hostW }}>
        <HostFigure width={hostW} arm={waving ? -120 : hostTalking ? -35 : -10} />
      </View>
      <Audience H={H} cheer={revealed} />
      <View pointerEvents="none" style={{ position: "absolute", left: (ballX / 100) * W - 30, width: 60, alignItems: "center", bottom: floorB + ballUp, zIndex: 6 }}>
        {e > 0 && <View style={{ position: "absolute", width: 40 + 30 * e, height: 40 + 30 * e, borderRadius: 40, backgroundColor: `rgba(253,224,71,${0.12 + 0.2 * e})`, top: -8 * e }} />}
        <TrophyImage name="Golden Ball" height={34 + 16 * e} fallback="🏅" />
      </View>
    </View>
  );
}

function DrawnFinalist({ career, plan, f, t, W, floorB }: { career: CareerState; plan: NightPlan; f: Finalist; t: number; W: number; floorB: number }) {
  const at = finalistXAt(f, t);
  if (!at.seen) return null;
  const revealed = t >= plan.revealAt;
  const h = podiumHeightAt(plan, f.rank, t);
  const podiumPx = 30 + h * 90;
  const k = Math.max(0, Math.min(1, (t - (f.walkTo - 0.45)) / 0.45));
  const standPx = at.on ? podiumPx : podiumPx * k * k;
  const kit = f.entry.isPlayer ? kitsOf(career.player.club, career.clubKits?.[career.player.club]).home : kitsOf(f.entry.club, career.clubKits?.[f.entry.club]).home;
  const win = revealed && f.rank === 1;
  const club = f.entry.isPlayer ? career.player.club : f.entry.club;
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: (xPct(at.x) / 100) * W - 38, width: 76, bottom: floorB + standPx, alignItems: "center", zIndex: at.walking ? 5 : 3 }}>
      <Animated.View key={win ? "win" : "on"} entering={win ? ZoomIn.duration(800) : undefined} style={{ alignItems: "center" }}>
        <Face name={f.entry.name} club={f.entry.club} isYou={f.entry.isPlayer} career={career} size={48} ring={win ? GOLD : kit.trim} />
        <View style={{ marginTop: -4, width: 46, height: 34, backgroundColor: kit.shirt, borderTopWidth: 4, borderTopColor: kit.trim, borderTopLeftRadius: 10, borderTopRightRadius: 10, borderBottomLeftRadius: 2, borderBottomRightRadius: 2 }}>
          <View style={{ position: "absolute", right: 7, top: 3 }}><ClubCrest club={club} size={12} /></View>
          {win && (
            <>
              <View style={{ position: "absolute", left: -7, top: -30, width: 8, height: 30, borderRadius: 4, backgroundColor: kit.shirt, borderWidth: 2, borderColor: kit.trim, transform: [{ rotate: "-14deg" }] }} />
              <View style={{ position: "absolute", right: -7, top: -30, width: 8, height: 30, borderRadius: 4, backgroundColor: kit.shirt, borderWidth: 2, borderColor: kit.trim, transform: [{ rotate: "14deg" }] }} />
            </>
          )}
        </View>
      </Animated.View>
      <Text numberOfLines={1} style={{ marginTop: 2, fontSize: 11, fontWeight: "900", textTransform: "uppercase", color: f.entry.isPlayer ? GOLD : "#fff", textShadowColor: "#000", textShadowRadius: 2 }}>
        {f.entry.isPlayer ? "You" : f.entry.name.split(" ").slice(-1)[0]}
      </Text>
    </View>
  );
}

// ── The result page (components/star/BallonDor.tsx, its last page) ──

const keyStat = (e: BallonDorEntry) => `${e.goals}G ${e.assists}A`;

function GoldenBallResult({ career, result, go }: { career: CareerState; result: BallonDorResult; go: (s: flow.Step) => void }) {
  const { entries, playerRank, playerNominated } = result;
  const winner = entries[0];
  const playerWon = playerRank === 1;
  const playerEntry = entries.find((e) => e.isPlayer);
  const card = { ...glassStyle("glass"), borderRadius: 16, padding: 16 } as const;
  const small = { color: "rgba(255,255,255,0.7)", fontSize: 10, fontWeight: "900", letterSpacing: 2, textTransform: "uppercase" } as const;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0b1a2e" }}>
      <Backdrop kind="stadium" />
      <Animated.ScrollView contentContainerStyle={{ padding: 12, paddingTop: 24, gap: 16, paddingBottom: 40 }}>
        <Animated.View entering={FadeInDown.duration(400)} style={[card, { padding: 24, alignItems: "center" }, playerWon ? { borderWidth: 1, borderColor: "rgba(251,191,36,0.6)" } : null]}>
          {playerWon ? (
            <>
              <TrophyImage name="Golden Ball" height={96} fallback="🏅" />
              <Text style={{ marginTop: 8, color: AMBER300, fontSize: 20, fontWeight: "900" }}>Golden Ball Winner</Text>
              <Text style={{ marginTop: 8, color: "rgba(255,255,255,0.8)", fontSize: 12 }}>History will remember this season.</Text>
            </>
          ) : playerNominated ? (
            <>
              <Text style={small}>Your Finish</Text>
              <Text style={{ marginTop: 4, color: "#fff", fontSize: 48, fontWeight: "900" }}>{playerRank === 2 ? "🥈" : playerRank === 3 ? "🥉" : `#${playerRank}`}</Text>
              <Text style={{ marginTop: 8, color: "rgba(255,255,255,0.8)", fontSize: 12, textAlign: "center" }}>
                {playerRank === 2 ? "Runner-up. One of the greatest seasons in the world."
                  : playerRank === 3 ? "On the podium. A season to remember."
                    : playerRank <= 5 ? "Top five in the world." : "Top ten in the world. Elite company."}
              </Text>
            </>
          ) : (
            <>
              <Text style={{ fontSize: 30 }}>💪</Text>
              <Text style={{ marginTop: 8, color: "#fff", fontSize: 16, fontWeight: "900" }}>Not Nominated</Text>
              <Text style={{ marginTop: 8, color: "rgba(255,255,255,0.8)", fontSize: 12 }}>Trophies, goals and a big season next time.</Text>
            </>
          )}
          {playerWon && <Burst colors={["#fde047", "#fbbf24", "#ffffff", "#f59e0b"]} count={26} spread={1.4} x={150} y={60} />}
        </Animated.View>

        {playerEntry && (
          <Animated.View entering={FadeInDown.duration(400).delay(120)} style={card}>
            <Text style={[small, { marginBottom: 12 }]}>Your Season</Text>
            <View style={{ flexDirection: "row" }}>
              {([["Goals", String(playerEntry.goals), false], ["Assists", String(playerEntry.assists), false], ["Rating", playerEntry.rating.toFixed(1), true]] as const).map(([l, v, accent]) => (
                <View key={l} style={{ flex: 1, alignItems: "center" }}>
                  <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 9, fontWeight: "700", marginBottom: 4 }}>{l}</Text>
                  <Text style={{ color: accent ? GOLD : "#fff", fontSize: 18, fontWeight: "900" }}>{v}</Text>
                </View>
              ))}
            </View>
            {((playerEntry.intlGoals ?? 0) > 0 || (playerEntry.intlAssists ?? 0) > 0) && (
              <Text style={{ marginTop: 8, textAlign: "center", color: "#fff", fontSize: 11, fontWeight: "700" }}>
                Includes {playerEntry.intlGoals ?? 0} goals and {playerEntry.intlAssists ?? 0} assists for your country
              </Text>
            )}
            {playerEntry.trophies.length > 0 && (
              <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.1)", flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {playerEntry.trophies.map((tr, i) => (
                  <Text key={`${tr}-${i}`} style={{ backgroundColor: "rgba(251,191,36,0.1)", color: AMBER300, fontSize: 10, fontWeight: "700", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99, overflow: "hidden" }}>🏆 {tr}</Text>
                ))}
              </View>
            )}
          </Animated.View>
        )}

        {!playerWon && winner && (
          <Animated.View entering={FadeInDown.duration(400).delay(200)} style={card}>
            <Text style={[small, { marginBottom: 8 }]}>Winner</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Face name={winner.name} club={winner.club} isYou={winner.isPlayer} career={career} size={36} ring="rgba(251,191,36,0.4)" />
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ color: "#fff", fontSize: 14, fontWeight: "900" }}>{winner.name}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                  <ClubCrest club={winner.club} size={13} />
                  <Text numberOfLines={1} style={{ color: "rgba(255,255,255,0.7)", fontSize: 12 }}>{shortClub(winner.club)}</Text>
                </View>
              </View>
              <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 12 }}>{keyStat(winner)}</Text>
            </View>
          </Animated.View>
        )}

        <Animated.View entering={FadeInDown.duration(400).delay(280)} style={card}>
          <Text style={[small, { marginBottom: 10 }]}>Final Top 10</Text>
          <View style={{ gap: 6 }}>
            {entries.map((e) => (
              <View key={e.rank} style={{ flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, backgroundColor: e.isPlayer ? "rgba(251,191,36,0.1)" : "transparent" }}>
                <Text style={{ width: 20, textAlign: "center", fontSize: 11, fontWeight: "900", color: e.rank <= 3 ? GOLD : "rgba(255,255,255,0.7)" }}>{e.rank}</Text>
                <Face name={e.name} club={e.club} isYou={e.isPlayer} career={career} size={22} ring="rgba(255,255,255,0.15)" />
                <Text numberOfLines={1} style={{ flex: 1, fontSize: 12, fontWeight: "700", color: e.isPlayer ? AMBER300 : "#fff" }}>{e.name}</Text>
                <Text style={{ fontSize: 10, color: "rgba(255,255,255,0.7)" }}>{keyStat(e)}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        <Pressable onPress={() => go(flow.ballonDorContinue(playerWon))} style={{ backgroundColor: GOLD, borderRadius: 12, paddingVertical: 16, alignItems: "center" }}>
          <Text style={{ color: "#030712", fontSize: 14, fontWeight: "900" }}>{retirementCheck(career).mustRetire ? "Continue →" : "Continue to Next Season →"}</Text>
        </Pressable>
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

// ═══ THE SEASON AWARDS NIGHT ════════════════════════════════════════════════

export function SeasonAwardsNight({ career, go }: { career: CareerState; go: (s: flow.Step) => void }) {
  const stats = career.lastSeasonAwardStats;
  const plan = useMemo(() => (stats ? awardsPlan(stats, (career.player.startYear ?? 0) * 37 + (stats.season ?? career.season)) : null), [stats, career.player.startYear, career.season]);
  const [stage, setStage] = useState<"night" | "result">("night");
  // Game music (SeasonAwardsNight.tsx): suspense while the awards are read, then a win if any of them was yours.
  const night = stage === "night" && !!plan && plan.awards.length > 0;
  const won = (plan?.yourWins ?? 0) > 0;
  useEffect(() => { setMusicScene("awards-night", { kind: "ballon-dor", won: night ? null : won }, 10); }, [night, won]);
  useEffect(() => () => clearMusicScene("awards-night"), []);
  // page.tsx: the awards night is Leo's update only (leoUpdateOn("awardsNight")); off, the awards page as before.
  if (!leoUpdateOn("awardsNight") || stage !== "night" || !plan || plan.awards.length === 0) return <SeasonAwardsScreen career={career} go={go} />;
  return <AwardsCeremony career={career} plan={plan} onDone={() => setStage("result")} />;
}

function AwardsCeremony({ career, plan, onDone }: { career: CareerState; plan: AwardsPlan; onDone: () => void }) {
  // The 3D room when the phone can (the website's), the drawn room (same beats) when it can't or the 3D takes too long.
  const [mode, setMode] = useState<"3d" | "drawn">(() => (partOff("3d") ? "drawn" : "3d"));
  const [ready3d, setReady3d] = useState(false);
  const ready = mode === "drawn" || ready3d;
  const { t, now, jump, freeze, isFrozen } = useNightClock(plan.end + 1.0, ready, mode === "3d" ? 10 : 30);
  const prefs = usePrefs();
  const handle = useRef<NightHandle | null>(null);
  useSeekHook(plan, mode, freeze, handle);
  const { size, onLayout } = useSize();
  const finished = useRef(false);
  const finish = useCallback(() => { if (!finished.current) { finished.current = true; onDone(); } }, [onDone]);
  useEffect(() => { if (ready && !isFrozen() && t >= plan.end + 1.0) finish(); }, [ready, t, plan.end, finish, isFrozen]);
  const skip = () => {
    if (!ready) return;
    const n = now();
    const to = skipTarget(plan, n);
    if (to >= plan.end) { finish(); return; }
    jump(to);
  };
  const a = awardAt(plan, t);
  const revealed = !!a && t >= a.revealAt;
  const revealKey = revealed ? a!.key : "";
  useEffect(() => { if (revealKey && !isFrozen()) playCheer(); }, [revealKey, isFrozen]);
  const ownKit = kitsOf(career.player.club, career.clubKits?.[career.player.club]).home;
  const youWonThis = revealed && a!.winner.isYou;
  const last = !a || a === plan.awards[plan.awards.length - 1];
  return (
    <NightStill.Provider value={mode === "3d"}>
    <Pressable style={{ flex: 1, backgroundColor: "#120a07" }} onPress={skip} onLayout={onLayout}>
      {mode === "3d" && <AwardsStage3D career={career} plan={plan} clock={now} handle={handle} showSpeed={prefs.show3dSpeed} onReady={() => setReady3d(true)} onFail={() => setMode("drawn")} />}
      {mode === "3d" && !ready && <LoadingLine small="The doors open" text="Finding your table…" />}
      {mode === "drawn" && size && <RoomDrawn career={career} plan={plan} t={t} W={size.W} H={size.H} />}
      {size && <TopShade W={size.W} h={130} alpha={0.65} />}
      {size && <AwardCaptions career={career} plan={plan} t={t} loading={!ready} />}
      {youWonThis && size && <Burst key={a!.key} colors={["#fde047", "#fbbf24", "#ffffff", ownKit.shirt, ownKit.trim]} count={36} spread={2} x={size.W / 2} y={size.H * 0.38} />}
      <SafeAreaView edges={["bottom"]} pointerEvents="box-none" style={{ position: "absolute", left: 16, right: 16, bottom: 18, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Pressable onPress={finish} style={{ backgroundColor: "rgba(0,0,0,0.55)", borderWidth: 1, borderColor: "rgba(255,255,255,0.3)", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 2 }}>
          <Text style={{ color: "#fff", fontWeight: "900", fontSize: 12, textTransform: "uppercase" }}>Skip all</Text>
        </Pressable>
        <Pressable onPress={skip} style={{ backgroundColor: "#fbbf24", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 2 }}>
          <Text style={{ color: "#030712", fontWeight: "900", fontSize: 13, textTransform: "uppercase" }}>{t >= plan.end ? "Continue ›" : last ? "Skip ›" : "Next award ›"}</Text>
        </Pressable>
      </SafeAreaView>
    </Pressable>
    </NightStill.Provider>
  );
}

function AwardCaptions({ career, plan, t, loading = false }: { career: CareerState; plan: AwardsPlan; t: number; loading?: boolean }) {
  const a = awardAt(plan, t);
  const beat = awardBeatAt(plan, t);
  const idx = a ? plan.awards.indexOf(a) : -1;
  const label = seasonLabelOf(career.player.startYear ?? 0, plan.season);
  let line: ReactNode;
  if (!a || beat === "intro") line = <Lower small={label} size={28}>The Season Awards</Lower>;
  else if (beat === "call") line = <View style={{ alignItems: "center" }}><TrophyImage name={a.label} height={44} fallback={a.icon} /><Lower small="The next award" size={28}>{a.label}</Lower></View>;
  else if (beat === "nominees") line = <Nominees career={career} award={a} />;
  else if (beat === "envelope") line = <Lower small={a.label} size={28}>And the winner is…</Lower>;
  else line = <WinnerLine career={career} award={a} />;
  return (
    <>
      <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, alignItems: "center" }}>
        <TopSpace min={44} />
        <Text style={{ color: AMBER200, fontSize: 11, fontWeight: "900", letterSpacing: 3.3 }}>{label}</Text>
        <Text style={{ color: "#fff", fontSize: 26, fontWeight: "900", textTransform: "uppercase", textShadowColor: "rgba(0,0,0,0.8)", textShadowRadius: 6 }}>Season Awards</Text>
        <View style={{ flexDirection: "row", gap: 6, marginTop: 8 }}>
          {plan.awards.map((x, i) => (
            <View key={x.key} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: i < idx || (i === idx && t >= x.revealAt) ? GOLD : "rgba(255,255,255,0.25)", borderWidth: i === idx ? 1.5 : 0, borderColor: "rgba(251,191,36,0.6)" }} />
          ))}
        </View>
      </View>
      <View pointerEvents="none" style={{ position: "absolute", left: 12, right: 12, bottom: 84, alignItems: "center" }}>
        {!loading && <Animated.View key={`${beat}-${a?.key ?? ""}`} entering={FadeInDown.duration(400)} style={{ width: "100%" }}>{line}</Animated.View>}
      </View>
    </>
  );
}

function Nominees({ career, award }: { career: CareerState; award: AwardCall }) {
  return (
    <View style={{ alignItems: "center" }}>
      <Text style={{ marginBottom: 8, color: AMBER200, fontSize: 12, fontWeight: "900", letterSpacing: 2.4, textTransform: "uppercase", textShadowColor: "#000", textShadowRadius: 3 }}>{award.label} · the nominees</Text>
      <View style={{ flexDirection: "row", justifyContent: "center", gap: 8, width: "100%" }}>
        {award.nominees.map((n, i) => (
          <Animated.View key={personId(n)} entering={FadeInDown.duration(400).delay(i * 350)}
            style={{ width: "31%", maxWidth: 120, alignItems: "center", paddingHorizontal: 4, paddingVertical: 8, backgroundColor: "rgba(10,6,4,0.78)", borderRadius: 4, borderWidth: 1, borderColor: n.isYou ? "rgba(251,191,36,0.7)" : "rgba(255,255,255,0.15)" }}>
            <Face name={n.name} club={n.club} isYou={n.isYou} career={career} size={52} ring={n.isYou ? GOLD : kitsOf(n.club).home.trim} />
            <Text numberOfLines={1} style={{ marginTop: 6, fontSize: 12, fontWeight: "900", color: n.isYou ? GOLD : "#fff" }}>{n.isYou ? "You" : n.name}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, maxWidth: "100%" }}>
              <ClubCrest club={n.club} size={12} />
              <Text numberOfLines={1} style={{ fontSize: 10, fontWeight: "700", color: "rgba(255,255,255,0.8)", flexShrink: 1 }}>{shortClub(n.club)}</Text>
            </View>
            <Text style={{ fontSize: 11, fontWeight: "900", color: AMBER300 }}>{n.value} <Text style={{ fontSize: 9, color: "rgba(255,255,255,0.7)" }}>{award.unit.toUpperCase()}</Text></Text>
          </Animated.View>
        ))}
      </View>
    </View>
  );
}

function WinnerLine({ career, award }: { career: CareerState; award: AwardCall }) {
  const w: AwardWinner = award.winner;
  return (
    <Animated.View entering={ZoomIn.duration(700)} style={{ alignItems: "center" }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <ClubCrest club={w.isYou ? career.player.club : w.club} size={18} />
        <Text style={{ color: AMBER200, fontSize: 12, fontWeight: "900", letterSpacing: 2, textTransform: "uppercase" }}>{shortClub(w.club)}</Text>
      </View>
      <Text style={{ color: GOLD, fontSize: 36, fontWeight: "900", textTransform: "uppercase", textAlign: "center", textShadowColor: "rgba(251,191,36,0.6)", textShadowRadius: 22 }}>{w.isYou ? "You!" : w.name}</Text>
      <Text style={{ marginTop: 4, color: "#fff", fontSize: 13, fontWeight: "900", textTransform: "uppercase", textAlign: "center", textShadowColor: "#000", textShadowRadius: 3 }}>
        {w.isYou ? `${w.name} · ` : ""}{award.label} · {w.value} {award.unit}
      </Text>
    </Animated.View>
  );
}

/** The room: bulbs, curtains, the stage, the lectern and the tables, drawn once. */
const RoomBack = memo(function RoomBack({ W, H }: { W: number; H: number }) {
  const draw = useCallback((g: CanvasRenderingContext2D) => {
    paintRoomBack(g, W, H);
  }, [W, H]);
  return <View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0 }}><Drawn width={W} height={H} draw={draw} /></View>;
});

function RoomDrawn({ career, plan, t, W, H }: { career: CareerState; plan: AwardsPlan; t: number; W: number; H: number }) {
  const a = awardAt(plan, t);
  const beat = awardBeatAt(plan, t);
  const up = a && (beat === "walk" || beat === "moment");
  const k = a ? Math.max(0, Math.min(1, (t - a.walkFrom) / (a.walkTo - a.walkFrom))) : 0;
  const e = k * k * (3 - 2 * k);
  const screenTitle = !a ? "The Season Awards" : beat === "call" || beat === "nominees" || beat === "envelope" ? a.label : a.winner.name;
  const kit = a ? (a.winner.isYou ? kitsOf(career.player.club, career.clubKits?.[career.player.club]).home : kitsOf(a.winner.club).home) : null;
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, width: W, height: H }}>
      <RoomBack W={W} H={H} />
      <View style={{ position: "absolute", left: W * 0.13, top: H * 0.2, width: W * 0.74, height: H * 0.17, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 }}>
        <Text style={{ color: AMBER300, fontSize: 10, fontWeight: "900", letterSpacing: 2.5 }}>{seasonLabelOf(career.player.startYear ?? 0, plan.season)}</Text>
        <Text numberOfLines={2} style={{ color: "#fff", fontSize: 20, fontWeight: "900", textTransform: "uppercase", textAlign: "center" }}>{screenTitle}</Text>
      </View>
      {up && kit && (
        <View style={{ position: "absolute", left: W * 0.42 - 40, width: 80, top: H * ((62 - 24 * e) / 100), alignItems: "center", zIndex: 3, opacity: Math.min(1, k * 4) }}>
          <Text style={{ fontSize: 30, opacity: beat === "moment" ? 1 : 0 }}>🏆</Text>
          <Face name={a!.winner.name} club={a!.winner.club} isYou={a!.winner.isYou} career={career} size={58} ring={a!.winner.isYou ? GOLD : kit.trim} />
          <View style={{ marginTop: -4, width: 54, height: 38, backgroundColor: kit.shirt, borderTopWidth: 4, borderTopColor: kit.trim, borderTopLeftRadius: 12, borderTopRightRadius: 12, borderBottomLeftRadius: 2, borderBottomRightRadius: 2 }} />
        </View>
      )}
    </View>
  );
}

