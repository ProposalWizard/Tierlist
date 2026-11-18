/**
 * THE MATCH ON THE PHONE (step 2, first slice): one chance at a time, played by
 * the shared rules (src/match/chance.ts → lib/star/canvasEngine.ts) and drawn
 * with the phone's own graphics (Skia). Drag back from anywhere to aim and set
 * the power, then let go: the website's drag-to-power sum.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Canvas, Rect, Circle, Path, Skia, Line, vec, Group } from "@shopify/react-native-skia";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import type { ScenarioKind } from "@/lib/star/canvasEngine";
import { PITCH_W, POST_L, POST_R, GOAL_H, SIX_L, SIX_R, SIX_DEPTH, BOX_L, BOX_R, BOX_DEPTH, PEN_SPOT_Y, ARC_R, CX } from "@/lib/star/pitch";
import { newChance, kick, step, powerFromPull, DT, type Chance, type Skills } from "../match/chance";
import { Press } from "../ui/Press";
import { C, R } from "../ui/theme";

const KINDS: ScenarioKind[] = ["one_on_one", "through_ball", "cutback", "long_range", "tight_angle", "byline_cross"];
const WORDS: Record<string, string> = { goal: "GOAL!", rebound: "GOAL!", saved: "Saved", caught: "Caught", delivered: "Played in", wide: "Wide", over: "Over the bar", post: "Off the post", blocked: "Blocked" };

export function Match({ skills, onDone }: { skills: Skills; onDone: () => void }) {
  const { width } = useWindowDimensions();
  const [h, setH] = useState(0);
  const [n, setN] = useState(0);
  const [score, setScore] = useState({ goals: 0, shots: 0 });
  const [, setTick] = useState(0);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const ch = useRef<Chance>(newChance(KINDS[0], 1001, skills));
  const raf = useRef(0);

  // the view: the goal near the top, the ball in sight, full width of the phone
  const view = useMemo(() => {
    const sc = ch.current.sc;
    const left = Math.min(sc.ball.x, POST_L) - 9, right = Math.max(sc.ball.x, POST_R) + 9;
    let w = Math.max(30, right - left); let x0 = (left + right) / 2 - w / 2;
    x0 = Math.max(-2, Math.min(PITCH_W + 2 - w, x0));
    return { x0, y0: -4, s: width / w };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n, width]);
  const px = (x: number) => (x - view.x0) * view.s;
  const py = (y: number) => (y - view.y0) * view.s;

  const run = useCallback(() => {
    let last = 0, acc = 0;
    const loop = (t: number) => {
      if (!last) last = t;
      acc += Math.min(0.1, (t - last) / 1000); last = t;
      let out = ch.current.outcome;
      while (acc >= DT && !out) { out = step(ch.current); acc -= DT; }
      setTick((k) => k + 1);
      if (out) {
        const scored = out === "goal" || out === "rebound";
        if (scored) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        setScore((s) => ({ goals: s.goals + (scored ? 1 : 0), shots: s.shots + 1 }));
        return;
      }
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
  }, []);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const next = () => {
    const k = n + 1;
    ch.current = newChance(KINDS[k % KINDS.length], 1001 + k * 7919, skills);
    setN(k); setDrag(null);
  };

  const pan = Gesture.Pan().runOnJS(true)
    .onUpdate((e) => { if (!ch.current.ball) setDrag({ x: e.translationX, y: e.translationY }); })
    .onEnd((e) => {
      if (ch.current.ball) return;
      const pull = Math.hypot(e.translationX, e.translationY);
      setDrag(null);
      if (pull < 12) return;
      const power = powerFromPull(pull, width, skills.power);
      // aim: the opposite way to the drag, in pitch metres
      kick(ch.current, { x: -e.translationX / view.s, y: -e.translationY / view.s }, power, { cx: 0, cy: 0 }, skills);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      run();
    });

  const sc = ch.current.sc, ball = ch.current.ball;
  const bx = ball ? ball.pos.x : sc.ball.x, by = ball ? ball.pos.y : sc.ball.y, bz = ball ? ball.z : 0;
  const lines = useMemo(() => {
    const p = Skia.PathBuilder.Make();
    p.moveTo(px(-5), py(0)); p.lineTo(px(PITCH_W + 5), py(0));
    p.addRect(Skia.XYWHRect(px(BOX_L), py(0), (BOX_R - BOX_L) * view.s, BOX_DEPTH * view.s));
    p.addRect(Skia.XYWHRect(px(SIX_L), py(0), (SIX_R - SIX_L) * view.s, SIX_DEPTH * view.s));
    const r = ARC_R * view.s, c = { x: px(CX), y: py(PEN_SPOT_Y) };
    const a = (Math.acos((BOX_DEPTH - PEN_SPOT_Y) / ARC_R) * 180) / Math.PI;
    p.addArc(Skia.XYWHRect(c.x - r, c.y - r, 2 * r, 2 * r), 90 - a, 2 * a);
    return p.build();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);
  const out = ch.current.outcome;
  const pr = 0.55 * view.s; // a player's drawn radius

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10 }}>
        <Press onPress={onDone} style={{ backgroundColor: C.panel2, borderRadius: R.pill, paddingHorizontal: 14, paddingVertical: 7 }}>
          <Text style={{ color: C.text, fontWeight: "800" }}>‹ Back</Text>
        </Press>
        <Text style={{ color: C.text, fontWeight: "900", fontSize: 18 }}>{score.goals} goals · {score.shots} shots</Text>
      </View>
      <GestureDetector gesture={pan}>
        <View style={{ flex: 1 }} onLayout={(e) => setH(e.nativeEvent.layout.height)}>
          {h > 0 && (
            <Canvas style={{ width, height: h }}>
              <Rect x={0} y={0} width={width} height={h} color="#3f9142" />
              {Array.from({ length: Math.ceil(h / (6 * view.s)) + 1 }, (_, i) => (
                <Rect key={i} x={0} y={py(i * 12)} width={width} height={6 * view.s} color="#459a48" />
              ))}
              <Path path={lines} style="stroke" strokeWidth={2} color="rgba(255,255,255,0.9)" />
              <Rect x={px(POST_L)} y={py(-1.2)} width={(POST_R - POST_L) * view.s} height={1.2 * view.s} color="rgba(255,255,255,0.35)" />
              <Line p1={vec(px(POST_L), py(0))} p2={vec(px(POST_R), py(0))} strokeWidth={4} color="#ffffff" />
              {sc.defenders.map((d, i) => <Circle key={"d" + i} cx={px(d.x)} cy={py(d.y)} r={pr} color="#7fb3e6" />)}
              {(sc.runner ? [sc.runner, ...sc.secondaryRunners] : sc.secondaryRunners).map((r, i) => (
                <Circle key={"r" + i} cx={px(r.pos.x)} cy={py(r.pos.y)} r={pr} color="#1e2f6b" />
              ))}
              <Circle cx={px(sc.keeper.x + (sc.keeper.dive || 0))} cy={py(sc.keeper.y)} r={pr} color="#f2c230" />
              <Group>
                <Circle cx={px(sc.player.x)} cy={py(sc.player.y)} r={pr} color="#1e2f6b" />
                <Circle cx={px(sc.player.x)} cy={py(sc.player.y)} r={pr + 3} color={C.gold} style="stroke" strokeWidth={2} />
              </Group>
              <Circle cx={px(bx) + bz * view.s * 0.5} cy={py(by) + bz * view.s * 0.5} r={0.3 * view.s} color="rgba(0,0,0,0.3)" />
              <Circle cx={px(bx)} cy={py(by) - bz * view.s * 0.6} r={(0.3 + bz * 0.05) * view.s} color="#ffffff" />
              {drag && (
                <Line p1={vec(px(sc.ball.x), py(sc.ball.y))} p2={vec(px(sc.ball.x) - drag.x, py(sc.ball.y) - drag.y)} strokeWidth={6} color="#f97316" />
              )}
            </Canvas>
          )}
          {!ball && !drag && (
            <View pointerEvents="none" style={{ position: "absolute", bottom: 30, left: 20, right: 20, backgroundColor: "rgba(10,16,14,0.92)", borderRadius: 14, padding: 14, borderWidth: 2, borderColor: C.gold }}>
              <Text style={{ color: C.text, fontWeight: "800", textAlign: "center", fontSize: 16 }}>Drag back to aim and set your power, then let go</Text>
            </View>
          )}
          {out && (
            <View style={{ position: "absolute", top: "35%", left: 0, right: 0, alignItems: "center" }}>
              <Text style={{ color: out === "goal" || out === "rebound" ? C.gold : C.text, fontSize: 44, fontWeight: "900" }}>{WORDS[out] ?? out}</Text>
              <Press onPress={next} style={{ marginTop: 16, backgroundColor: C.green, borderRadius: R.card, paddingVertical: 14, paddingHorizontal: 30 }}>
                <Text style={{ color: "#05261a", fontWeight: "900", fontSize: 18 }}>NEXT CHANCE</Text>
              </Press>
            </View>
          )}
        </View>
      </GestureDetector>
    </SafeAreaView>
  );
}
void GOAL_H;
