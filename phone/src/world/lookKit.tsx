/**
 * The career kit's Frame / Card / Label / Btn (screens/career/kit.tsx), same
 * props, in the packed app's look, for the world screens that were built on
 * it (Store, Owner, Investments, Rule Book, votes): the blurred stadium
 * behind, the ◂ BACK pill and an Anton title, glass cards, 3D buttons.
 * The career screens keep their own kit (another builder restyles those).
 */
import type { ReactNode } from "react";
import { ScrollView, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C as BASE } from "../ui/theme";
import { Backdrop, LookButton, ScreenHeader, rgba } from "../ui/look";

/** The theme's colours with the panels in the look's navy glass instead of dark green. */
export const C = { ...BASE, bg: "#0b1a2e", panel: "rgba(10,22,40,0.66)", panel2: "rgba(255,255,255,0.12)", line: "rgba(255,255,255,0.16)" };
export { ClubCrest, Fill, Row, Tile, money, ordinal } from "../screens/career/kit";

/** A full screen: the stadium behind, ◂ BACK and the title (Anton) on top, a scrolling body. */
export function Frame({ title, kicker, onBack, children, scroll = true, footer, right }: {
  title: string; kicker?: string; onBack?: () => void; children: ReactNode; scroll?: boolean; footer?: ReactNode; right?: ReactNode;
}) {
  const inset = useSafeAreaInsets();
  // The website's <Screen>: ONE narrow column (max-w-sm = 384 px, 12 px inside it), centred: on a 412 px
  // phone the cards are 360 wide with 26 px either side; the header sits in the same column.
  return (
    <View style={{ flex: 1, backgroundColor: "#0b1a2e", paddingTop: inset.top }}>
      <Backdrop kind="stadium" />
      <View style={COLUMN}><ScreenHeader title={title} kicker={kicker} onBack={onBack} right={right} /></View>
      {scroll ? <ScrollView contentContainerStyle={[COLUMN, { paddingHorizontal: 12, paddingTop: 4, paddingBottom: 40 + inset.bottom, gap: 10 }]}>{children}</ScrollView> : <View style={[COLUMN, { flex: 1 }]}>{children}</View>}
      {footer ? <View style={[COLUMN, { padding: 12, paddingTop: 6, paddingBottom: Math.max(12, inset.bottom) }]}>{footer}</View> : null}
    </View>
  );
}
const COLUMN = { width: "100%", maxWidth: 384, alignSelf: "center" } as const;

/**
 * The website's kit-card in the glass skin: plain navy glass with a white hairline (measured on the
 * packed app: linear-gradient rgba(14,30,52,.58) → rgba(10,22,40,.66), a white 20% ring), 12 px inside.
 * The club or section colour does NOT ring it (`tone` is kept so callers read the same as the website's
 * --kit-glow, but nothing is drawn from it).
 */
export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle>; tone?: string }) {
  return <View style={[KIT_CARD, { borderRadius: 16, padding: 12 }, style]}>{children}</View>;
}
export const KIT_CARD = {
  backgroundImage: "linear-gradient(180deg, rgba(14,30,52,0.58), rgba(10,22,40,0.66))",
  boxShadow: "inset 0px 1px 0px rgba(255,255,255,0.22), inset 0px 0px 0px 1px rgba(255,255,255,0.2), 0px 8px 22px -10px rgba(0,0,0,0.55)",
} as ViewStyle;
/** The website's kit-row: a faint glass strip inside a card (chips, level pills). */
export const KIT_ROW = {
  backgroundImage: "linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.025))",
  boxShadow: "inset 0px 1px 0px rgba(255,255,255,0.06), inset 0px 0px 0px 1px rgba(255,255,255,0.05)",
} as ViewStyle;

/** The website's SectionLabel: 10 px caps, 2 px apart, white 60%. */
export function Label({ children, color = "rgba(255,255,255,0.6)", style }: { children: ReactNode; color?: string; style?: StyleProp<TextStyle> }) {
  return <Text style={[{ color, fontSize: 10, lineHeight: 15, fontWeight: "900", letterSpacing: 2, textTransform: "uppercase" }, style]}>{children}</Text>;
}

/**
 * The website's PressButton (green, gold, red, or glass): caps, 13 px on a 19.5 px line with 10 px above
 * and below (40 tall, corners 12); `small` is its "sm" size (11 px, 6 px above and below, corners 8).
 */
export function Btn({ label, onPress, kind = "primary", disabled, small }: { label: string; onPress?: () => void; kind?: "primary" | "plain" | "gold" | "danger"; disabled?: boolean; small?: boolean }) {
  const k = kind === "plain" ? "glass" : kind;
  const fs = small ? 11 : 13;
  return (
    <LookButton kind={k} disabled={disabled} onPress={onPress} style={{ borderRadius: small ? 8 : 12, paddingVertical: small ? 6 : 10, paddingHorizontal: small ? 12 : 16, opacity: disabled ? 0.45 : 1 }}>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ color: k === "gold" ? "#111827" : "#fff", fontSize: fs, lineHeight: fs * 1.5, fontWeight: "900", letterSpacing: fs * 0.025, textTransform: "uppercase" }}>{label}</Text>
    </LookButton>
  );
}

export { rgba };
