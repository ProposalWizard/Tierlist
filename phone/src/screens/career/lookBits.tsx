/**
 * Small pieces of the website's look that several career screens share
 * (round 2): a club's glow colour, the gold section heading, the blacked-out
 * blank, the website's Kicker over a screen.
 */
import { useEffect, useRef, type ReactNode } from "react";
import { Animated, Easing, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { kitsOf } from "@/lib/star/kits";
import { luminance } from "@/lib/star/heroFigure";
import type { CareerState } from "@/lib/star/types";
import { TEXT_SHADOW } from "../../ui/look";

/** Lift a hex colour towards white by `amt` (0-1). */
function lift(hex: string, amt: number): string {
  const n = parseInt(hex.replace("#", "").slice(0, 6), 16);
  const ch = (v: number) => Math.round(v + (255 - v) * amt).toString(16).padStart(2, "0");
  return `#${ch((n >> 16) & 255)}${ch((n >> 8) & 255)}${ch(n & 255)}`;
}
const isHex = (c: string) => /^#[0-9a-f]{6}$/i.test(c);

/** A kit colour that lights a dark card (components/star/ui/theme.ts glowOf): white kits use the trim, very dark kits are lifted. */
export function glowOf(shirt: string, trim: string): string {
  const base = isHex(shirt) && luminance(shirt) > 0.85 && isHex(trim) ? trim : shirt;
  if (!isHex(base)) return "#34d399";
  return luminance(base) < 0.12 ? lift(base, 0.35) : base;
}

/** A club's glow colour, from its home kit. */
export function clubGlow(club: string, career?: Pick<CareerState, "clubKits"> | null): string {
  const kit = kitsOf(club, career?.clubKits?.[club]).home;
  return glowOf(kit.shirt, kit.trim);
}

/** The gold heading between blocks (CareerOverview.tsx Heading). */
export function Heading({ children, right, first }: { children: ReactNode; right?: ReactNode; first?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: first ? 0 : 8, marginBottom: -2 }}>
      <Text style={[{ color: "#fcd34d", fontSize: 10.5, fontWeight: "900", letterSpacing: 2.3, textTransform: "uppercase" }, TEXT_SHADOW]}>{children}</Text>
      {typeof right === "string" || typeof right === "number" ? <Text style={{ color: "#fde68a", fontSize: 11, fontWeight: "900" }}>{right}</Text> : right}
    </View>
  );
}

/** A slot the save never recorded: blacked out, no words (house rule). */
export function Blank({ w = 22, h = 14 }: { w?: number; h?: number }) {
  return <View style={{ width: w, height: h, backgroundColor: "rgba(0,0,0,0.6)", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" }} />;
}

/**
 * The training pitch behind Training (the website's Pitch look, pitchLook.css):
 * mown green stripes and a dark edge, drawn once as plain views.
 */
export function PitchBackdrop() {
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, flexDirection: "row", backgroundColor: "#1d6b33" }}>
      {Array.from({ length: 9 }, (_, k) => <View key={k} style={{ flex: 1, backgroundColor: k % 2 ? "#226f37" : "#1b6430" }} />)}
      <View style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, backgroundImage: "radial-gradient(ellipse 90% 70% at 50% 45%, rgba(255,255,255,0.06), rgba(0,0,0,0.32) 100%)" } as ViewStyle} />
    </View>
  );
}

/** The deep navy behind Settings (the website's Screen over the glass skin's page colour). */
export function NavyBackdrop() {
  return <View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, backgroundImage: "linear-gradient(180deg, #1e3a5f 0%, #172e4d 45%, #10223b 100%)" } as ViewStyle} />;
}

/** The website's Kicker over a screen ("FULL TIME", the competition): small capitals in a colour. */
export function ScreenKicker({ children, color = "#fcd34d" }: { children: ReactNode; color?: string }) {
  return <Text style={[{ color, fontSize: 11, fontWeight: "900", letterSpacing: 3, textAlign: "center", textTransform: "uppercase" }, TEXT_SHADOW]}>{children}</Text>;
}


/**
 * The website's small movements (components/star/ui RiseIn, kit-slam, the pulses), once each:
 *   <RiseIn index={2}>…</RiseIn>     fades in and rises 14 px, 70 ms later per index
 *   <PopIn>…</PopIn>                 pops in from small with a little overshoot (a count, a stamp)
 *   <Pulse>…</Pulse>                 breathes for ever (a halo, "TAP TO CARRY ON")
 */
export function RiseIn({ children, index = 0, style, from = 14 }: { children: ReactNode; index?: number; style?: StyleProp<ViewStyle>; from?: number }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(a, { toValue: 1, duration: 420, delay: 60 + index * 70, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [a, index]);
  return <Animated.View style={[style, { opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [from, 0] }) }] }]}>{children}</Animated.View>;
}
export function PopIn({ children, style, delay = 0 }: { children: ReactNode; style?: StyleProp<ViewStyle>; delay?: number }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(a, { toValue: 1, duration: 320, delay, easing: Easing.out(Easing.back(2.2)), useNativeDriver: true }).start();
  }, [a, delay]);
  return <Animated.View style={[style, { opacity: a.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] }), transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }] }]}>{children}</Animated.View>;
}
export function Pulse({ children, style, min = 0.55, ms = 1300, scale = 1 }: { children?: ReactNode; style?: StyleProp<ViewStyle>; min?: number; ms?: number; scale?: number }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(a, { toValue: 1, duration: ms, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(a, { toValue: 0, duration: ms, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [a, ms]);
  return <Animated.View style={[style, { opacity: a.interpolate({ inputRange: [0, 1], outputRange: [min, 1] }), transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [1, scale] }) }] }]}>{children}</Animated.View>;
}

/**
 * Words that float up and fade, once each time `trigger` changes to a number above 0
 * (components/star/ui FloatText: "+12%", "+65", "+2 POWER"). Sits where its style puts it.
 */
export function FloatUp({ trigger, text, color = "#34d399", size = 15, style, rise = 34, ms = 1100 }: { trigger: number; text: string; color?: string; size?: number; style?: StyleProp<ViewStyle>; rise?: number; ms?: number }) {
  const a = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!trigger) return;
    a.setValue(0);
    Animated.timing(a, { toValue: 1, duration: ms, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [a, trigger, ms]);
  if (!trigger) return null;
  return (
    <Animated.View pointerEvents="none" style={[{ position: "absolute", zIndex: 5 }, style, { opacity: a.interpolate({ inputRange: [0, 0.12, 0.7, 1], outputRange: [0, 1, 1, 0] }), transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [0, -rise] }) }, { scale: a.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0.7, 1.15, 1] }) }] }]}>
      <Text numberOfLines={1} style={{ color, fontSize: size, fontWeight: "900", textShadowColor: "rgba(0,0,0,0.8)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 }}>{text}</Text>
    </Animated.View>
  );
}
/** Shakes its children side to side each time `trigger` changes to a number above 0 (kit-shake-x). */
export function ShakeX({ trigger, children, style }: { trigger: number; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!trigger) return;
    a.setValue(0);
    Animated.timing(a, { toValue: 1, duration: 420, easing: Easing.linear, useNativeDriver: true }).start();
  }, [a, trigger]);
  return <Animated.View style={[style, { transform: [{ translateX: a.interpolate({ inputRange: [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1], outputRange: [0, -7, 7, -6, 6, -3, 3, 0] }) }] }]}>{children}</Animated.View>;
}

/**
 * A burst of confetti from the middle of its parent, once (components/star/ui Burst):
 *   <Burst colors={["#fde047", "#fff"]} count={30} />
 * Bits fly out, turn and fade in about a second; nothing is left behind.
 */
export function Burst({ colors = ["#fde047", "#fbbf24", "#ffffff"], count = 24, spread = 1 }: { colors?: string[]; count?: number; spread?: number }) {
  const a = useRef(new Animated.Value(0)).current;
  const bits = useRef(Array.from({ length: count }, (_, i) => {
    const ang = (i / count) * Math.PI * 2 + ((i * 37) % 10) / 10;
    const far = (70 + ((i * 53) % 90)) * spread;
    return { dx: Math.cos(ang) * far, dy: Math.sin(ang) * far - 30, size: 5 + ((i * 7) % 5), color: colors[i % colors.length], spin: `${(i % 2 ? 1 : -1) * (180 + ((i * 41) % 360))}deg` };
  })).current;
  useEffect(() => {
    Animated.timing(a, { toValue: 1, duration: 1100, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [a]);
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: "50%", top: "50%", width: 0, height: 0 }}>
      {bits.map((b, i) => (
        <Animated.View key={i} style={{ position: "absolute", left: -b.size / 2, top: -b.size / 2, width: b.size, height: b.size * 0.6, borderRadius: 1, backgroundColor: b.color,
          opacity: a.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] }),
          transform: [{ translateX: a.interpolate({ inputRange: [0, 1], outputRange: [0, b.dx] }) }, { translateY: a.interpolate({ inputRange: [0, 1], outputRange: [0, b.dy + 60] }) }, { rotate: a.interpolate({ inputRange: [0, 1], outputRange: ["0deg", b.spin] }) }] }} />
      ))}
    </View>
  );
}
