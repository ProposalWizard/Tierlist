/**
 * WHAT WAITS ON HOME (the website's components/star/UnlockChain.tsx,
 * EnergyBackToast.tsx, ManagerChat.tsx, ManagerMoments.tsx and page.tsx's
 * "In the dugout" banner), in the website's own words, sizes and colours:
 *
 *   LockedScreen      a swipe page that is not open yet ("Stats is locked · Score your first goal")
 *   LockIcon          the website's drawn padlock (never the emoji: Samsung draws its own)
 *   UnlockPop         "Unlocked · League · The table, results and fixtures · See all achievements"
 *   EnergyBackToast   "⚡ +12 energy (rest days)", 3.2 s, between the league row and your player
 *   ManagerChat       a short word from the manager, one line a tap (penalty / free-kick taker)
 *   DugoutBanner      "In the dugout": the new manager's news, with its ✕
 *   CaptainMoment     "The armband": the manager's words when he makes you captain
 *   NeedsChip         "🏆 End of Season ›" and "🗣️ Boss wants a word ›"
 *   DutyRow           "ON DUTY · JUNE 2027 ›" in the nation's colours, while away with your country
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Easing, Modal, Text, View, PanResponder, type ViewStyle } from "react-native";
import type { CareerState } from "@/lib/star/types";
import { FEATURE_INFO, lockHint, type Feature } from "@/lib/star/unlocks";
import { captainLine } from "@/lib/star/managerMoments";
import { nationKits } from "@/lib/star/international";
import type { DutyView } from "@/lib/star/intl/career";
import type { Need } from "@/lib/star/needsYou";
import { useCareer } from "../../game/store";
import { Press } from "../../ui/Press";
import { LookButton, TEXT_SHADOW, rgba } from "../../ui/look";
import { NationFlag } from "../../draw/NationFlag";
import { Frame } from "./kit";
import { LockIcon } from "../../ui/LockIcon";

export { LockIcon };

/** A page that is not open yet (UnlockChain.tsx LockedPage), with Home one swipe or tap away. */
export function LockedScreen({ feature, onBack }: { feature: Feature; onBack: () => void }) {
  const career = useCareer();
  const title = FEATURE_INFO[feature]?.name ?? "This";
  // Stats is the page left of Home, the Shop the page right of it: Home is the other way.
  const homeRight = feature === "stats";
  const back = useRef(onBack);
  back.current = onBack;
  const swipe = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 24 && Math.abs(g.dx) > Math.abs(g.dy) * 1.6,
    onPanResponderRelease: (_e, g) => { if ((homeRight && g.dx < -60) || (!homeRight && g.dx > 60)) back.current(); },
  })).current;
  if (!career) return null;
  return (
    <Frame title={title} top bar bare scroll={false}>
      <View style={{ flex: 1 }} {...swipe.panHandlers}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 24 }}>
          <View style={{ width: 64, height: 64, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.07)", borderWidth: 1, borderColor: "rgba(255,255,255,0.15)" }}>
            <LockIcon size={30} />
          </View>
          <Text style={[{ color: "#fff", fontSize: 18, fontWeight: "900", textAlign: "center" }, TEXT_SHADOW]}>{title} is locked</Text>
          <Text style={[{ color: "#fcd34d", fontSize: 13, fontWeight: "700", textAlign: "center" }, TEXT_SHADOW]}>{lockHint(career, feature)}</Text>
        </View>
        <View style={{ height: 34, paddingLeft: 12, paddingRight: homeRight ? 90 : 12, flexDirection: "row", alignItems: "center", justifyContent: homeRight ? "flex-end" : "flex-start" }}>
          <Press onPress={onBack} style={{ height: 24, flexDirection: homeRight ? "row-reverse" : "row", alignItems: "center", gap: 4, paddingHorizontal: 6, borderRadius: 2, backgroundColor: "rgba(8,20,38,0.34)" }}>
            <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 10 }}>{homeRight ? "▶" : "◀"}</Text>
            <Text style={{ fontSize: 12 }}>🏠</Text>
            <Text style={{ color: "#fff", fontSize: 10.5, fontWeight: "700", letterSpacing: 0.6 }}>HOME</Text>
          </Press>
        </View>
      </View>
    </Frame>
  );
}

/** The dark sheet every pop-up sits on (UnlockChain.tsx Sheet). */
export function Sheet({ children, onClose }: { children: ReactNode; onClose?: () => void }) {
  return (
    <Modal transparent visible animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Press onPress={onClose} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.8)", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <Press onPress={() => {}} style={{ width: "100%", maxWidth: 340, borderRadius: 24, padding: 16, alignItems: "stretch", backgroundImage: "linear-gradient(180deg, #1f2937, #0b1220)", boxShadow: "inset 0px 0px 0px 1px rgba(255,255,255,0.12), 0px 20px 50px -10px rgba(0,0,0,0.9)" } as ViewStyle}>
          {children}
        </Press>
      </Press>
    </Modal>
  );
}

/** The big icon that spins in with a ring opening round it (UnlockChain.tsx BigStar). */
export function BigStar({ icon }: { icon: string }) {
  const a = useRef(new Animated.Value(0)).current;
  const ring = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(a, { toValue: 1, duration: 700, easing: Easing.out(Easing.back(2.2)), useNativeDriver: true }).start();
    Animated.timing(ring, { toValue: 1, duration: 1100, delay: 200, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [a, ring]);
  return (
    <View style={{ alignSelf: "center", marginTop: 12, width: 96, height: 96, alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={{ position: "absolute", left: 0, top: 0, width: 96, height: 96, borderRadius: 48, borderWidth: 4, borderColor: "rgba(252,211,77,0.7)",
        opacity: ring.interpolate({ inputRange: [0, 1], outputRange: [0.9, 0] }), transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.9] }) }] }} />
      <Animated.Text style={{ fontSize: 60, lineHeight: 72, opacity: a.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] }),
        textShadowColor: "rgba(251,191,36,0.85)", textShadowRadius: 16, textShadowOffset: { width: 0, height: 0 },
        transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }) }, { rotate: a.interpolate({ inputRange: [0, 1], outputRange: ["-90deg", "0deg"] }) }] }}>{icon}</Animated.Text>
    </View>
  );
}

/** Something new is open (UnlockChain.tsx UnlockPop). */
export function UnlockPop({ features, onSeeAll, onClose }: { features: Feature[]; onSeeAll: () => void; onClose: () => void }) {
  const names = features.map((f) => FEATURE_INFO[f].name);
  const title = names.length <= 1 ? names[0] ?? "" : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  return (
    <Sheet onClose={onClose}>
      <Text style={{ color: "#fcd34d", fontSize: 11, fontWeight: "900", letterSpacing: 2.4, textAlign: "center" }}>UNLOCKED</Text>
      <BigStar icon={FEATURE_INFO[features[0]]?.icon ?? "🔓"} />
      <Text style={{ color: "#fff", fontSize: 22, fontWeight: "900", lineHeight: 27, textAlign: "center", marginTop: 8 }}>{title}</Text>
      <View style={{ marginTop: 8, gap: 6 }}>
        {features.map((f) => (
          <View key={f} style={{ flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "rgba(16,185,129,0.15)", borderWidth: 1, borderColor: "rgba(52,211,153,0.4)" }}>
            <Text style={{ fontSize: 20 }}>{FEATURE_INFO[f].icon}</Text>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: "#fff", fontSize: 13, fontWeight: "900" }}>{FEATURE_INFO[f].name}</Text>
              <Text style={{ color: "#d1fae5", fontSize: 11.5, fontWeight: "700" }}>{FEATURE_INFO[f].line}</Text>
            </View>
          </View>
        ))}
      </View>
      <LookButton onPress={onSeeAll} style={{ marginTop: 12, borderRadius: 16, paddingVertical: 10 }}>
        <Text style={{ color: "#fff", fontSize: 14, fontWeight: "900" }}>See all achievements</Text>
      </LookButton>
      <Press onPress={onClose} style={{ marginTop: 8, paddingVertical: 4, alignItems: "center" }}>
        <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, fontWeight: "900", letterSpacing: 1.2 }}>CLOSE</Text>
      </Press>
    </Sheet>
  );
}

/** "+N energy (rest days)", once on Home after a match (EnergyBackToast.tsx): 3.2 s, a tap closes it sooner. */
export function EnergyBackToast({ amount, onDone }: { amount: number; onDone: () => void }) {
  const done = useRef(onDone);
  done.current = onDone;
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(a, { toValue: 1, duration: 260, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    const t = setTimeout(() => done.current(), 3200);
    return () => clearTimeout(t);
  }, [a]);
  return (
    <Animated.View pointerEvents="box-none" style={{ position: "absolute", left: 16, right: 16, top: 6, alignItems: "center", zIndex: 6, opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }}>
      <Press onPress={onDone} style={{ height: 32, borderRadius: 4, paddingHorizontal: 12, justifyContent: "center", backgroundImage: "linear-gradient(180deg, #bef264, #22c55e)", boxShadow: "0px 8px 20px -6px rgba(34,197,94,0.7), inset 0px 1px 0px rgba(255,255,255,0.5)" } as ViewStyle}>
        <Text numberOfLines={1} style={{ color: "#030712", fontSize: 13, fontWeight: "900" }}>⚡ +{amount} energy (rest days)</Text>
      </Press>
    </Animated.View>
  );
}

/** A short word from the manager: a few lines, one tap each, then OK (ManagerChat.tsx). */
export function ManagerChat({ name, lines, onDone }: { name: string; lines: string[]; onDone: () => void }) {
  const [i, setI] = useState(0);
  const last = i >= lines.length - 1;
  return (
    <Modal transparent visible animationType="fade" statusBarTranslucent>
      <Press onPress={() => (last ? onDone() : setI(i + 1))} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.65)", alignItems: "center", justifyContent: "flex-end", padding: 16, paddingBottom: 96 }}>
        <View style={{ width: "100%", maxWidth: 340 }}>
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
            <View style={{ width: 56, height: 56, borderRadius: 6, alignItems: "center", justifyContent: "center", backgroundImage: "linear-gradient(180deg, #4b5563, #1f2937)", borderWidth: 2, borderColor: "rgba(255,255,255,0.3)" } as ViewStyle}>
              <Text style={{ fontSize: 30 }}>🧑‍💼</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, backgroundImage: "linear-gradient(180deg, #1f2937, #0b1220)", boxShadow: "inset 0px 0px 0px 2px rgba(255,255,255,0.22), 0px 12px 30px -8px rgba(0,0,0,0.9)" } as ViewStyle}>
              <Text numberOfLines={1} style={{ color: "#fcd34d", fontSize: 10, fontWeight: "900", letterSpacing: 2 }}>{name.toUpperCase()}</Text>
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "900", lineHeight: 21, marginTop: 2 }}>{lines[i]}</Text>
            </View>
          </View>
          <View style={{ marginTop: 8, alignItems: "flex-end" }}>
            {last
              ? <LookButton onPress={onDone} style={{ borderRadius: 4, paddingHorizontal: 20, paddingVertical: 8 }}><Text style={{ color: "#fff", fontSize: 13, fontWeight: "900" }}>OK</Text></LookButton>
              : <Text style={{ color: "#fcd34d", fontSize: 12, fontWeight: "900", letterSpacing: 1.2 }}>▸</Text>}
          </View>
        </View>
      </Press>
    </Modal>
  );
}

/** "In the dugout": the club has a new manager (page.tsx:5621-5645). It stays until its ✕. */
export function DugoutBanner({ text, onDismiss }: { text: string; onDismiss: () => void }) {
  return (
    <View style={{ position: "absolute", left: 12, right: 12, top: 6, zIndex: 5, borderRadius: 12, borderWidth: 1, borderColor: "rgba(239,68,68,0.5)", backgroundColor: "rgba(69,10,10,0.92)", padding: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <Text style={{ color: "#fecaca", fontSize: 10, fontWeight: "900", letterSpacing: 2 }}>IN THE DUGOUT</Text>
        <Press onPress={onDismiss} style={{ padding: 6, margin: -6 }}><Text style={{ color: "rgba(254,202,202,0.7)", fontSize: 14, lineHeight: 14 }}>✕</Text></Press>
      </View>
      <Text style={{ color: "#fff", fontSize: 12, marginTop: 4, lineHeight: 16 }}>{text}</Text>
    </View>
  );
}

/** Made captain: full screen, once (ManagerMoments.tsx CaptainInOffice, the plain card: the phone has no 3D office). */
export function CaptainMoment({ career, onDone }: { career: CareerState; onDone: () => void }) {
  return (
    <Modal visible animationType="fade" statusBarTranslucent onRequestClose={onDone}>
      <View style={{ flex: 1, backgroundColor: "#0b1220", justifyContent: "center", paddingHorizontal: 12, paddingBottom: 24, paddingTop: 12 }}>
        <View style={{ width: "100%", maxWidth: 384, alignSelf: "center" }}>
          <Text style={{ color: "#93c5fd", fontSize: 18, fontWeight: "900", letterSpacing: 0.5, textAlign: "right", marginBottom: 8 }}>THE ARMBAND</Text>
          <View style={{ backgroundColor: "#334155", borderRadius: 4, paddingHorizontal: 12, paddingVertical: 8 }}>
            <Text style={{ color: "#fff", fontSize: 11, fontWeight: "900", letterSpacing: 0.6 }}>{(career.manager?.name ?? "The manager").toUpperCase()}</Text>
            <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700", lineHeight: 21 }}>{captainLine(career)}</Text>
          </View>
          <LookButton onPress={onDone} style={{ marginTop: 12, borderRadius: 4, paddingVertical: 12 }}>
            <Text style={{ color: "#fff", fontSize: 14, fontWeight: "900" }}>CONTINUE →</Text>
          </LookButton>
        </View>
      </View>
    </Modal>
  );
}

/** The one chip on Home (HomeHub NeedsChip): amber, with the website's chevron. */
export function NeedsChip({ need, onPress }: { need: Pick<Need, "label" | "icon">; onPress: () => void }) {
  return (
    <Press onPress={onPress} style={{ flexDirection: "row", alignItems: "center", gap: 6, height: 30, borderRadius: 4, paddingLeft: 6, paddingRight: 10, backgroundColor: "#fbbf24", boxShadow: "inset 0px 1px 0px rgba(255,255,255,0.5), 0px 4px 12px -4px rgba(0,0,0,0.8)" } as ViewStyle}>
      <Text style={{ fontSize: 14 }}>{need.icon}</Text>
      <Text numberOfLines={1} style={{ color: "#030712", fontSize: 12, fontWeight: "900", flexShrink: 1 }}>{need.label}</Text>
      <Chevron color="rgba(3,7,18,0.7)" size={10} />
    </Press>
  );
}
/** The website's drawn "›" (ui Chev): two strokes, not a letter. */
export function Chevron({ color, size = 10 }: { color: string; size?: number }) {
  const w = size * 0.5;
  return (
    <View style={{ width: w + 2, height: size, alignItems: "center", justifyContent: "center" }}>
      <View style={{ width: w, height: w, borderTopWidth: 2, borderRightWidth: 2, borderColor: color, transform: [{ rotate: "45deg" }], marginLeft: -w * 0.4 }} />
    </View>
  );
}

/** Away with your country (IntlKit.tsx NationDropdown): the league row becomes "ON DUTY · JUNE 2027 ›". */
export function DutyRow({ duty, onOpen }: { duty: DutyView; onOpen?: () => void }) {
  let glow = "#38bdf8";
  try { glow = nationKits(duty.nation).home.shirt; } catch { /* the default */ }
  if (!/^#[0-9a-f]{6}$/i.test(glow)) glow = "#38bdf8";
  return (
    <Press onPress={onOpen} style={{ marginTop: 4, height: 24, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, backgroundImage: `linear-gradient(90deg, ${rgba(glow, 0.45)}, rgba(0,0,0,0.2))` } as ViewStyle}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
        <NationFlag nation={duty.nation} width={16} />
        <Text numberOfLines={1} style={[{ flex: 1, color: "#fff", fontSize: 11, fontWeight: "900", letterSpacing: 1.3 }, TEXT_SHADOW]}>ON DUTY · {duty.period.label.toUpperCase()}</Text>
      </View>
      <Text style={[{ color: "#fff", fontSize: 12, fontWeight: "900" }, TEXT_SHADOW]}>›</Text>
    </Press>
  );
}
