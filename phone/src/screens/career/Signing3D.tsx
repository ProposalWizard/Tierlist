/**
 * THE SIGNING, LIVE IN 3D (the website's components/star/SigningScene3D.tsx and SigningScene3DCareer.tsx on the phone).
 *
 * You and the manager at a desk. He talks (the camera over your shoulder at him), you reply (over his at you), the
 * contract slides across, TAP TO SIGN: you pick up the pen, write your name, the SIGNED stamp lands, and you both
 * stand and shake hands while the camera pulls back. The scene is the website's own (lib/star/signing3dScene.ts, not
 * touched); ../../three/Walk3D.tsx runs it on the phone's GL view. This file is the words and buttons round it, line
 * for line: the title and Skip at the top, the typed-out words with "n/5 · tap ›", TAP TO SIGN, the SIGNED stamp,
 * WELCOME TO <CLUB> and Continue.
 *
 * Everything comes off the save (../../three/signingData.ts): your skin tone, hair, the club's kit, the shirt number,
 * the seasons and the wage, your accessories and the Star Pass aviators. Whoever plays sees themself.
 *
 * If the 3D cannot start (the phone's crash guard has it off, the GL is refused, it takes too long) the drawn signing
 * (./Signing.tsx, the website's own "Drawn" signing) takes over at once, so a signing is never lost.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, Text, View, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import type { CareerState } from "@/lib/star/types";
import { usePrefs } from "../../game/prefs";
import { Walk3D } from "../../three/Walk3D";
import { loadSigningStart, type SigningCallbacks, type SigningData, type SigningWalk } from "../../three/signingScene";
import { signingPlan } from "../../three/signingData";
import { SigningMoment, type SigningTerms as DrawnTerms } from "./Signing";

/** The drawn signing's terms (wage, seasons, bonuses), and the position the 3D contract prints (the website's transfer passes its full name). */
export type SigningTerms = DrawnTerms & { position?: string; season?: string | null };

const INK = "#f8fafc";
type Stage = "loading" | "talk" | "contract" | "signing" | "done";

export function Signing3D({ career, club, managerName, onDone, terms, number, kind = "trial" }: {
  career: CareerState; club: string; managerName: string; onDone: () => void;
  /** A move: the new contract (else your contract). */ terms?: SigningTerms;
  /** The shirt number on it (null: none yet). */ number?: number | null;
  /** The first contract after the trial, or a move to a new club later (the manager talks about your play, not a trial; no new number yet). */
  kind?: "trial" | "transfer";
}) {
  const [failed, setFailed] = useState(false);
  // Settings → Live 3D scenes is OFF by default (24 Nov 2026: the app closed after the trial's accept-offer): then this is the drawn signing
  // and nothing here touches Walk3D or the GL.
  const live = usePrefs().live3dScenes;
  // the room is built from the career once: a later change to the save (a new face arriving) does not rebuild it
  const plan = useMemo(() => (live ? signingPlan(career, club, managerName, { kind, terms, number }) : null), []); // eslint-disable-line react-hooks/exhaustive-deps
  if (failed || !plan) return <SigningMoment career={career} club={club} managerName={managerName} onDone={onDone} terms={terms} number={number} />;
  return <Signing3DView plan={plan} onDone={onDone} onFail={() => setFailed(true)} />;
}

function Signing3DView({ plan, onDone, onFail }: { plan: ReturnType<typeof signingPlan>; onDone: () => void; onFail: () => void }) {
  const { lines, title, club, managerName } = plan;
  const insets = useSafeAreaInsets();
  const prefs = usePrefs();
  const [stage, setStageState] = useState<Stage>("loading");
  const stageRef = useRef<Stage>("loading");
  const setStage = (s: Stage) => { stageRef.current = s; setStageState(s); };
  const [line, setLine] = useState(0);
  const lineRef = useRef(0);
  const [typed, setTyped] = useState(0);
  const typedRef = useRef(0);
  const [stamp, setStamp] = useState(false);
  const ctrl = useRef<SigningWalk | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const current = lines[line];

  // The words type out (no voice): about 70 letters a second, in steps (a render a step).
  useEffect(() => {
    if (stage !== "talk" || !current) return;
    typedRef.current = 0; setTyped(0);
    const id = setInterval(() => {
      typedRef.current = Math.min(current.text.length, typedRef.current + 3);
      setTyped(typedRef.current);
      if (typedRef.current >= current.text.length) clearInterval(id);
    }, 45);
    return () => clearInterval(id);
  }, [line, stage, current]);

  const advance = () => {
    if (stageRef.current !== "talk") return;
    const cur = lines[lineRef.current];
    if (!cur) return;
    if (typedRef.current < cur.text.length) { typedRef.current = cur.text.length; setTyped(cur.text.length); return; }
    if (lineRef.current + 1 < lines.length) {
      lineRef.current += 1;
      setLine(lineRef.current);
      ctrl.current?.setShot(lines[lineRef.current].shot);
    } else {
      setStage("contract");
      ctrl.current?.setShot("contract");
    }
  };
  const sign = () => {
    if (stageRef.current !== "contract") return;
    setStage("signing");
    ctrl.current?.sign();
  };
  /** A tap on the picture: the next line while he talks; while you sign, straight to the end. */
  const tapScene = () => {
    if (stageRef.current === "talk") advance();
    else if (stageRef.current === "signing") { ctrl.current?.skip(); setStage("done"); }
  };

  const speaker = current?.who === "boss" ? managerName.toUpperCase() + " · MANAGER" : "YOU";
  const accent = current?.who === "boss" ? "#fbbf24" : "#60a5fa";
  const bottom = Math.max(22, insets.bottom + 8);

  const callbacks = (): SigningCallbacks => ({
    onEvent: (e) => {
      if (e === "stamp") { setStamp(true); timers.current.push(setTimeout(() => setStamp(false), 1500)); }
      if (e === "done") setStage("done");
    },
  });
  const stampScale = useSharedValue(2.2);
  useEffect(() => { if (stamp) { stampScale.value = 2.2; stampScale.value = withSpring(1, { damping: 9, stiffness: 160 }); } }, [stamp, stampScale]);
  const stampStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, 1.6 - 0.6 * stampScale.value), transform: [{ rotate: "-8deg" }, { scale: stampScale.value }] }));

  return (
    <View style={{ flex: 1, backgroundColor: "#120c08" }}>
      <Walk3D<SigningData, SigningCallbacks, SigningWalk>
        name="The signing" cover="#120c08" load={loadSigningStart} data={plan.data} callbacks={callbacks}
        onBack={onDone} onFail={onFail} hideStick showSpeed={prefs.show3dSpeed}
        onTap={() => tapScene()}
        onController={(c) => {
          ctrl.current = c;
          // (the web build's look checks reach the scene the way the website's test page does)
          if (Platform.OS === "web") (globalThis as unknown as { __sign3d?: SigningWalk | null }).__sign3d = c;
          if (c) { c.setShot(lines[0]?.shot ?? "talk"); if (stageRef.current === "loading") setStage("talk"); }
        }}
        loading={{ title: "Walking into the office…" }}>
        {/* Top bar: title, Skip. A soft shade so the words read over any shot. */}
        <View pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, top: 0, paddingTop: Math.max(10, insets.top), paddingHorizontal: 12, paddingBottom: 26, backgroundImage: "linear-gradient(180deg, rgba(0,0,0,0.6), rgba(0,0,0,0))", flexDirection: "row", alignItems: "center", gap: 8 } as ViewStyle}>
          <Text pointerEvents="none" numberOfLines={1} style={{ flex: 1, minWidth: 0, color: "#fbbf24", fontSize: 13, fontWeight: "900", letterSpacing: 1.4, textTransform: "uppercase", textShadowColor: "#000", textShadowRadius: 3, textShadowOffset: { width: 0, height: 1 } }}>{title}</Text>
          {stage !== "done" && (
            <Pressable onPress={onDone} hitSlop={8} style={{ minHeight: 36, paddingHorizontal: 12, borderRadius: 999, justifyContent: "center", backgroundColor: "rgba(0,0,0,0.45)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)" }}>
              <Text style={{ color: INK, fontSize: 12, fontWeight: "900", letterSpacing: 1, textTransform: "uppercase" }}>Skip</Text>
            </Pressable>
          )}
        </View>

        {/* The words. */}
        {stage === "talk" && current && (
          <Pressable onPress={advance} style={{ position: "absolute", left: 12, right: 12, bottom, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 22, backgroundColor: "rgba(5,7,12,0.84)", borderLeftWidth: 3, borderLeftColor: accent, borderRadius: 4 }}>
            <Text style={{ color: accent, fontSize: 11, fontWeight: "900", letterSpacing: 1 }}>{speaker}</Text>
            <Text style={{ color: INK, fontSize: 18, fontWeight: "700", lineHeight: 23, marginTop: 4, minHeight: 46 }}>{current.text.slice(0, typed)}</Text>
            <Text style={{ position: "absolute", right: 12, bottom: 6, color: "#94a3b8", fontSize: 11 }}>{line + 1}/{lines.length} · tap ›</Text>
          </Pressable>
        )}

        {stage === "contract" && (
          <View style={{ position: "absolute", left: 12, right: 12, bottom }}>
            <Pressable onPress={sign} style={{ paddingVertical: 16, borderRadius: 12, alignItems: "center", backgroundImage: "linear-gradient(180deg,#fde047,#f59e0b)", boxShadow: "0px 6px 22px rgba(245,158,11,0.45)" } as ViewStyle}>
              <Text style={{ color: "#1a1206", fontSize: 18, fontWeight: "900", letterSpacing: 1.5 }}>TAP TO SIGN</Text>
            </Pressable>
          </View>
        )}

        {stamp && (
          <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: "15%", alignItems: "center" }}>
            <Animated.View style={[{ paddingHorizontal: 18, paddingVertical: 8, borderWidth: 3, borderColor: "#fde047", backgroundColor: "rgba(0,0,0,0.45)" }, stampStyle]}>
              <Text style={{ color: "#fde047", fontSize: 32, fontWeight: "900", letterSpacing: 3 }}>SIGNED</Text>
            </Animated.View>
          </View>
        )}

        {stage === "done" && (
          <View style={{ position: "absolute", left: 12, right: 12, bottom }}>
            <View style={{ alignItems: "center", marginBottom: 10 }}>
              <Text style={{ color: "#fbbf24", fontSize: 15, fontWeight: "900", letterSpacing: 2, textShadowColor: "#000", textShadowRadius: 6, textShadowOffset: { width: 0, height: 2 } }}>WELCOME TO</Text>
              <Text style={{ color: INK, fontSize: 26, fontWeight: "900", textTransform: "uppercase", textShadowColor: "#000", textShadowRadius: 6, textShadowOffset: { width: 0, height: 2 } }}>{club}</Text>
            </View>
            <Pressable onPress={onDone} style={{ paddingVertical: 15, borderRadius: 12, alignItems: "center", backgroundColor: INK }}>
              <Text style={{ color: "#07090f", fontSize: 16, fontWeight: "900" }}>Continue</Text>
            </Pressable>
          </View>
        )}
      </Walk3D>
    </View>
  );
}
