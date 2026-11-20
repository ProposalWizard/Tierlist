/**
 * Around a training drill, as the website's New UI does it (app/star-dev/page.tsx
 * training phase + components/star/TrainingIntro.tsx + TrainingMinigame.tsx):
 *  - the first time you play a drill its "How it works" card sits ON it
 *    (DrillTutorial: three lines, the stars rule, "Got it"); after that a "?"
 *    in the bottom-right corner brings it back (DrillHelpButton);
 *  - when the drill is over, the result card (CompleteScreen: the stars pop in,
 *    "First time!" / "Second try" / "Just made it" / "Not this time", LEVEL n
 *    UNLOCKED) is held 3 s before the training page comes back.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { View, Text, Pressable, Animated, Easing, type ViewStyle } from "react-native";
import type { CareerState, Skills } from "@/lib/star/types";
import { hasSeen, markSeen } from "@/lib/star/unlocks";
import { setCareer } from "../../game/store";
import { SKILL_TITLES } from "../MatchStages";

const INTRO: Record<keyof Skills, { title: string; steps: string[] }> = {
  power: { title: "Power", steps: ["Drag back from the ball to aim and set power", "Pick where you strike the ball", "Score past the keeper"] },
  technique: { title: "Technique", steps: ["Drag back from the ball to aim and set power", "Get it between the two cones"] },
  freeKick: { title: "Free Kick", steps: ["Drag back from the ball to aim and set power", "Lift it over the wall or bend it round", "Score past the keeper"] },
  pace: { title: "Pace", steps: ["Drag or tap left and right to pick the gap", "One man comes for the ball: wait for his ring to turn green", "Then flick the other way to knock it past him"] },
  vision: { title: "Vision", steps: ["3, 2, 1, GO: a real moment from a match", "Who gets the pass? Not offside, not marked, nobody in the way", "Tap him before the bar runs out (later: kick it to him)"] },
  aerial: { title: "Aerial", steps: ["The cross comes in, then tap the ball", "Hit its left side to send it right", "Score past the keeper"] },
};

/** TrainingMinigame SKILL_LOOK. */
const SKILL_LOOK: Record<keyof Skills, { icon: string; label: string; accent: string }> = {
  pace: { icon: "⚡", label: "Pace", accent: "#22d3ee" },
  power: { icon: "💥", label: "Power", accent: "#f97316" },
  technique: { icon: "🎯", label: "Technique", accent: "#a78bfa" },
  vision: { icon: "👁️", label: "Vision", accent: "#38bdf8" },
  freeKick: { icon: "🌀", label: "Free kick", accent: "#fbbf24" },
  aerial: { icon: "🤸", label: "Aerial", accent: "#2dd4bf" },
};

const rgba = (hex: string, a: number) => {
  const h = hex.replace("#", "");
  return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${a})`;
};

/** The how-it-works block: the skill's name, its steps, the stars rule (TrainingIntro HowItWorks). */
function HowItWorks({ skill }: { skill: keyof Skills }) {
  const it = INTRO[skill];
  return (
    <>
      <Text style={{ marginTop: 4, color: "#fff", fontSize: 24, fontWeight: "900" }}>{it.title}</Text>
      <View style={{ marginTop: 12, gap: 6 }}>
        {it.steps.map((s, i) => (
          <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: "#34d399", alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: "#022c22", fontSize: 12, fontWeight: "900" }}>{i + 1}</Text>
            </View>
            <Text style={{ flex: 1, color: "#fff", fontSize: 14, fontWeight: "700" }}>{s}</Text>
          </View>
        ))}
      </View>
      <View style={{ marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 8, backgroundColor: "rgba(17,24,39,0.7)", paddingHorizontal: 12, paddingVertical: 8 }}>
        <Text style={{ color: "#fff", fontSize: 12, fontWeight: "900" }}>3 tries</Text>
        <Text style={{ color: "#fcd34d", fontSize: 12, fontWeight: "900" }}>1st ★★★</Text>
        <Text style={{ color: "#fcd34d", fontSize: 12, fontWeight: "900" }}>2nd ★★</Text>
        <Text style={{ color: "#fcd34d", fontSize: 12, fontWeight: "900" }}>3rd ★</Text>
      </View>
    </>
  );
}

/** DrillTutorial: the card on the drill, the pitch dimmed behind it; a tap outside closes it too. */
function DrillTutorial({ skill, onClose }: { skill: keyof Skills; onClose: () => void }) {
  return (
    <Pressable onPress={onClose} accessibilityLabel="How this drill works" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, zIndex: 97, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end", alignItems: "center", paddingHorizontal: 12, paddingBottom: 16 }}>
      <Pressable onPress={() => {}} style={{ width: "100%", maxWidth: 384, borderRadius: 16, padding: 16, backgroundImage: "linear-gradient(180deg,#1f2937,#0b1220)", boxShadow: "inset 0px 0px 0px 2px #fde047, 0px 16px 40px -10px rgba(0,0,0,0.95)" } as ViewStyle}>
        <Text style={{ color: "#fcd34d", fontSize: 11, fontWeight: "900", letterSpacing: 1.6 }}>HOW IT WORKS</Text>
        <HowItWorks skill={skill} />
        <Pressable onPress={onClose} style={{ marginTop: 12, borderRadius: 12, backgroundColor: "#10b981", paddingVertical: 12, alignItems: "center" }}>
          <Text style={{ color: "#022c22", fontSize: 16, fontWeight: "900" }}>Got it</Text>
        </Pressable>
      </Pressable>
    </Pressable>
  );
}

/** DrillHelpButton: the "?" that is always on a drill after its first time. */
function DrillHelpButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityLabel="How this drill works" style={{ position: "absolute", right: 12, bottom: 12, zIndex: 60, width: 40, height: 40, borderRadius: 3, backgroundColor: "#374151", alignItems: "center", justifyContent: "center", boxShadow: "inset 0px 0px 0px 1px rgba(255,255,255,0.2), 0px 4px 10px rgba(0,0,0,0.6)" } as ViewStyle}>
      <Text style={{ color: "#fcd34d", fontSize: 18, fontWeight: "900" }}>?</Text>
    </Pressable>
  );
}

/** One star of the result card, popping in (kib-pop: 0 → 1.18 → 1 over 420 ms, each 220 ms after the last). */
function PopStar({ on, i }: { on: boolean; i: number }) {
  const s = useRef(new Animated.Value(on ? 0.3 : 1)).current;
  const o = useRef(new Animated.Value(on ? 0 : 1)).current;
  useEffect(() => {
    if (!on) return;
    Animated.sequence([
      Animated.delay(i * 220),
      Animated.parallel([
        Animated.timing(o, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(s, { toValue: 1.18, duration: 250, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.timing(s, { toValue: 1, duration: 170, useNativeDriver: true }),
        ]),
      ]),
    ]).start();
  }, [on, i, s, o]);
  return (
    <Animated.Text style={{ fontSize: 60, lineHeight: 64, opacity: o, transform: [{ scale: s }],
      color: on ? "#fcd34d" : "rgba(255,255,255,0.14)",
      ...(on ? { textShadowColor: "rgba(251,191,36,0.9)", textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 18 } : {}) }}>★</Animated.Text>
  );
}

/** CompleteScreen: the drill's result card, held 3 s (Mikey: the old one was "way too quick"). */
function CompleteScreen({ skill, level, stars }: { skill: keyof Skills; level: number; stars: number }) {
  const look = SKILL_LOOK[skill];
  const verdict = stars === 3 ? "First time!" : stars === 2 ? "Second try" : stars === 1 ? "Just made it" : "Not this time";
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 12,
      backgroundImage: "radial-gradient(80% 50% at 50% 30%, rgba(47,111,78,0.4), rgba(0,0,0,0) 70%), linear-gradient(180deg, #0b1220, #05070d)" } as ViewStyle}>
      <View style={{ width: "100%", maxWidth: 384, borderRadius: 16, padding: 24, alignItems: "center", overflow: "hidden",
        backgroundImage: `radial-gradient(120% 90% at 50% 0%, ${rgba(look.accent, 0.3)}, rgba(0,0,0,0) 60%), linear-gradient(180deg, rgba(31,41,55,0.95), rgba(10,14,24,0.98))`,
        boxShadow: `inset 0px 1px 0px rgba(255,255,255,0.14), inset 0px 0px 0px 1px ${rgba(look.accent, 0.4)}, 0px 0px 40px -8px rgba(47,111,78,0.7)` } as ViewStyle}>
        <Text style={{ color: look.accent, fontSize: 11, fontWeight: "900", letterSpacing: 2, textAlign: "center" }}>
          {look.icon} {look.label.toUpperCase()} · {SKILL_TITLES[skill].toUpperCase()} · LEVEL {level}
        </Text>
        <View style={{ marginTop: 16, flexDirection: "row", gap: 8 }}>
          {[0, 1, 2].map((i) => <PopStar key={i} i={i} on={i < stars} />)}
        </View>
        <Text style={{ marginTop: 16, color: "#fff", fontSize: 24, fontWeight: "900", fontStyle: "italic" }}>{verdict}</Text>
        <View style={[{ marginTop: 8, borderRadius: 99, paddingHorizontal: 12, paddingVertical: 4 },
          (stars > 0 ? { backgroundColor: "#fbbf24", boxShadow: "0px 0px 16px rgba(251,191,36,0.6)" } : { backgroundColor: "rgba(255,255,255,0.15)" }) as ViewStyle]}>
          <Text style={{ color: stars > 0 ? "#030712" : "#fff", fontSize: 12, fontWeight: "900" }}>
            {stars > 0 ? (level < 30 ? `LEVEL ${level + 1} UNLOCKED` : "TOP LEVEL DONE") : "Try it again next time"}
          </Text>
        </View>
      </View>
    </View>
  );
}

/**
 * A drill with the website's tutorial, "?" and result card around it.
 * `children(onFinish, run)`: the drill itself; `run` changes when Vision's
 * clock must start again after the tutorial (page.tsx setDrillRun).
 */
export function DrillShell({ career, skill, level, onDone, children }: {
  career: CareerState; skill: keyof Skills; level: number;
  onDone: (stars: number) => void;
  children: (onFinish: (stars: number) => void, run: number) => ReactNode;
}) {
  const first = career.unlocks ? !hasSeen(career, `drill-${skill}`) : level === 1;
  const [autoDone, setAutoDone] = useState(false);
  const [help, setHelp] = useState(false);
  const [run, setRun] = useState(0);
  const [result, setResult] = useState<number | null>(null);
  const showAuto = first && !autoDone;
  const close = useCallback(() => {
    if (showAuto) {
      setAutoDone(true);
      if (career.unlocks) setCareer((c) => markSeen(c, `drill-${skill}`));
      if (skill === "vision") setRun((r) => r + 1);
    }
    setHelp(false);
  }, [showAuto, career.unlocks, skill]);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  useEffect(() => {
    if (result === null) return;
    const t = setTimeout(() => doneRef.current(result), 3000);
    return () => clearTimeout(t);
  }, [result]);
  if (result !== null) return <CompleteScreen skill={skill} level={level} stars={result} />;
  return (
    <View style={{ flex: 1 }}>
      {children(setResult, run)}
      {showAuto || help ? <DrillTutorial skill={skill} onClose={close} /> : <DrillHelpButton onPress={() => setHelp(true)} />}
    </View>
  );
}
