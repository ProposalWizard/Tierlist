/**
 * WORDS IN THE WEBSITE'S LOOK.
 *   <Display size={28}>Who are you?</Display>         Anton (headings, names, big numbers)
 *   <Kicker>Next match</Kicker>                         small caps, wide spacing, emerald
 *   <SectionHeading>Your photo</SectionHeading>         a card's small heading
 *   <Pill label="Age" value={18} />                     the top bar's chips
 *   <Tag>Road to the Golden Ball</Tag>                  a rounded outlined tag
 */
import type { ReactNode } from "react";
import { Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import { FONT } from "./fonts";
import { LOOK, TEXT_SHADOW } from "./tokens";

/** Anton. `upper` puts it in capitals. */
export function Display({ children, size = 24, color = LOOK.ink, upper = false, shadow = true, style, numberOfLines }: {
  children: ReactNode; size?: number; color?: string; upper?: boolean; shadow?: boolean; style?: StyleProp<TextStyle>; numberOfLines?: number;
}) {
  return (
    <Text numberOfLines={numberOfLines} style={[{ fontFamily: FONT.display, fontSize: size, lineHeight: Math.round(size * 1.18), color, letterSpacing: 0.2 }, upper && { textTransform: "uppercase" }, shadow && TEXT_SHADOW, style]}>
      {children}
    </Text>
  );
}

/** Small capitals with wide spacing: "NEXT MATCH", "FIRST NAME", "OR PICK A FACE". */
export function Kicker({ children, color = LOOK.emerald300, size = 10, style, center }: {
  children: ReactNode; color?: string; size?: number; style?: StyleProp<TextStyle>; center?: boolean;
}) {
  return (
    <Text style={[{ color, fontSize: size, fontWeight: "900", letterSpacing: size * 0.16, textTransform: "uppercase" }, center && { textAlign: "center" }, TEXT_SHADOW, style]}>
      {children}
    </Text>
  );
}

/** A card's heading row: the kicker on the left, an optional note on the right. */
export function SectionHeading({ children, right, style }: { children: ReactNode; right?: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }, style]}>
      <Kicker size={10}>{children}</Kicker>
      {typeof right === "string" ? <Text style={{ color: LOOK.ink, fontSize: 10, fontWeight: "700" }}>{right}</Text> : right}
    </View>
  );
}

/** A small glass chip with a label and a value (AGE 18, ★ 0). */
export function Pill({ label, value, icon, style }: { label?: string; value: ReactNode; icon?: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 7, height: 24, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.16)", borderWidth: 1, borderColor: "rgba(255,255,255,0.26)" }, style]}>
      {icon}
      {label ? <Text style={{ color: LOOK.inkSoft, fontSize: 9, fontWeight: "900", letterSpacing: 1.1 }}>{label.toUpperCase()}</Text> : null}
      <Text style={{ color: LOOK.ink, fontSize: 13, fontWeight: "900" }}>{value}</Text>
    </View>
  );
}

/** A rounded outlined tag: the new-career pages' "ROAD TO THE GOLDEN BALL". */
export function Tag({ children, color = LOOK.emerald300 }: { children: ReactNode; color?: string }) {
  return (
    <View style={{ alignSelf: "center", paddingHorizontal: 12, paddingVertical: 3, borderRadius: 999, backgroundColor: "rgba(16,185,129,0.2)", borderWidth: 1, borderColor: "rgba(52,211,153,0.4)" }}>
      <Text style={{ color, fontSize: 10, fontWeight: "800", letterSpacing: 1.6 }}>{typeof children === "string" ? children.toUpperCase() : children}</Text>
    </View>
  );
}
