/**
 * The career kit's Frame / Card / Label / Btn (screens/career/kit.tsx), same
 * props, in the packed app's look, for the world screens that were built on
 * it (Store, Owner, Investments, Rule Book, votes): the blurred stadium
 * behind, the ◂ BACK pill and an Anton title, glass cards, 3D buttons.
 * The career screens keep their own kit (another builder restyles those).
 */
import type { ReactNode } from "react";
import { ScrollView, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C as BASE } from "../ui/theme";
import { Backdrop, Kicker, LOOK, LookButton, ScreenHeader, glassStyle, rgba } from "../ui/look";

/** The theme's colours with the panels in the look's navy glass instead of dark green. */
export const C = { ...BASE, bg: "#0b1a2e", panel: "rgba(10,22,40,0.66)", panel2: "rgba(255,255,255,0.12)", line: "rgba(255,255,255,0.16)" };
export { ClubCrest, Fill, Row, Tile, money, ordinal } from "../screens/career/kit";

/** A full screen: the stadium behind, ◂ BACK and the title (Anton) on top, a scrolling body. */
export function Frame({ title, kicker, onBack, children, scroll = true, footer, right }: {
  title: string; kicker?: string; onBack?: () => void; children: ReactNode; scroll?: boolean; footer?: ReactNode; right?: ReactNode;
}) {
  const inset = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: "#0b1a2e", paddingTop: inset.top }}>
      <Backdrop kind="stadium" />
      <ScreenHeader title={title} kicker={kicker} onBack={onBack} right={right} />
      {scroll ? <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 40 + inset.bottom, gap: 10 }}>{children}</ScrollView> : <View style={{ flex: 1 }}>{children}</View>}
      {footer ? <View style={{ padding: 12, paddingTop: 6, paddingBottom: Math.max(12, inset.bottom) }}>{footer}</View> : null}
    </View>
  );
}

/** A glass card; `tone` (a colour) lights its rim and top in that colour. */
export function Card({ children, style, tone }: { children: ReactNode; style?: StyleProp<ViewStyle>; tone?: string }) {
  const glow = tone && tone.startsWith("#") ? tone : tone ? toHex(tone) : undefined;
  return <View style={[glassStyle("glass", glow), { borderRadius: 16, padding: 14 }, style]}>{children}</View>;
}

export function Label({ children, color = LOOK.emerald300 }: { children: ReactNode; color?: string }) {
  return <Kicker size={11} color={color === C.gold ? LOOK.goldSoft : color} style={{ marginBottom: 8 }}>{children}</Kicker>;
}

/** The career kit's buttons in the look: green, gold, red, or glass. */
export function Btn({ label, onPress, kind = "primary", disabled, small }: { label: string; onPress?: () => void; kind?: "primary" | "plain" | "gold" | "danger"; disabled?: boolean; small?: boolean }) {
  const k = kind === "plain" ? "glass" : kind;
  return (
    <LookButton kind={k} disabled={disabled} onPress={onPress} style={{ borderRadius: 14, paddingVertical: small ? 10 : 15, opacity: disabled ? 0.5 : 1 }}>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ color: k === "gold" ? "#111827" : "#fff", fontSize: small ? 14 : 17, fontWeight: "900" }}>{label}</Text>
    </LookButton>
  );
}

/** "rgba(r,g,b,a)" → "#rrggbb" (a tone given as rgba lights the card in that colour). */
function toHex(c: string): string | undefined {
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c);
  if (!m) return undefined;
  return "#" + [m[1], m[2], m[3]].map((x) => Number(x).toString(16).padStart(2, "0")).join("");
}

export { rgba };
