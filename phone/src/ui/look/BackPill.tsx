/**
 * THE BACK PILL (the shop's "◂ BACK", Shop.tsx / ShowroomShop.tsx top-left):
 * a near-black rounded pill with a light rim, a yellow arrow and BACK in caps.
 *   <BackPill onPress={…} />            "BACK"
 *   <BackPill onPress={…} label="Home" />
 *   <CloseSquare onPress={…} />         the glass ✕ square (TransferHub's lists)
 *   <PageTitle>Sponsors</PageTitle>     a page heading: Anton caps
 *   <ScreenHeader title kicker onBack right />  the glass skin's header: glass ◂ BACK, the
 *                                       title on a small dark plaque in the middle, a chip right
 *                                       (ui/Screen.tsx ScreenHeader + glassLook.css [data-sk-header])
 * Plain views; nothing moves at rest.
 */
import type { ReactNode } from "react";
import { Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Press } from "../Press";
import { FONT } from "./fonts";

export function BackPill({ onPress, label = "Back", tone = "dark", style }: { onPress: () => void; label?: string; tone?: "dark" | "glass"; style?: StyleProp<ViewStyle>; }) {
  return (
    <Press onPress={onPress} style={[{
      flexDirection: "row", alignItems: "center", gap: 6, height: 38, paddingLeft: 12, paddingRight: 16, borderRadius: 999,
      borderWidth: 1, boxShadow: "0px 4px 10px -4px rgba(0,0,0,0.7)",
    } as ViewStyle, tone === "glass"
      ? ({ backgroundImage: "linear-gradient(180deg, rgba(255,255,255,0.24), rgba(255,255,255,0.1))", borderColor: "rgba(255,255,255,0.32)" } as ViewStyle)
      : { backgroundColor: "rgba(6,8,12,0.82)", borderColor: "rgba(255,255,255,0.28)" }, style]}>
      <Text style={{ color: "#facc15", fontSize: 11, marginTop: -1 }}>◀</Text>
      <Text style={{ color: "#fff", fontSize: 14, fontWeight: "900", letterSpacing: 0.6, textTransform: "uppercase" }}>{label}</Text>
    </Press>
  );
}

export function CloseSquare({ onPress, size = 40 }: { onPress: () => void; size?: number }) {
  return (
    <Press onPress={onPress} style={{ width: size, height: size, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.12)", borderWidth: 1, borderColor: "rgba(255,255,255,0.3)" }}>
      <Text style={{ color: "#fff", fontSize: 20, fontWeight: "900" }}>✕</Text>
    </Press>
  );
}

/** A page heading in the website's look: Anton caps, white, with a soft shadow. */
export function PageTitle({ children, size = 26, color = "#fff" }: { children: string; size?: number; color?: string }) {
  return <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ color, fontFamily: FONT.display, fontSize: size, lineHeight: Math.round(size * 1.2), letterSpacing: 0.6, textTransform: "uppercase", textShadowColor: "rgba(0,0,0,0.6)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 }}>{children}</Text>;
}

/** The glass skin's screen header: ◂ BACK (glass), the kicker and title on a dark plaque in the middle, `right` on the right. */
export function ScreenHeader({ title, kicker, kickerColor = "#fcd34d", onBack, right }: { title: string; kicker?: string; kickerColor?: string; onBack?: () => void; right?: ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingTop: 10, paddingBottom: 8, minHeight: 58 }}>
      <View style={{ flex: 1, alignItems: "flex-start" }}>{onBack ? <BackPill tone="glass" onPress={onBack} /> : null}</View>
      <View style={{ maxWidth: "52%", alignItems: "center", paddingHorizontal: 12, paddingTop: 2, paddingBottom: 3, borderRadius: 10, backgroundColor: "rgba(10,22,40,0.66)", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" }}>
        {kicker ? <Text numberOfLines={1} style={{ color: kickerColor, fontSize: 9, fontWeight: "900", letterSpacing: 2.2, textTransform: "uppercase", textShadowColor: "rgba(0,0,0,0.8)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 }}>{kicker}</Text> : null}
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ color: "#e2e8f0", fontFamily: FONT.display, fontSize: 21, lineHeight: 26, letterSpacing: 0.4, textTransform: "uppercase", textShadowColor: "rgba(0,0,0,0.75)", textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 0 }}>{title}</Text>
      </View>
      <View style={{ flex: 1, alignItems: "flex-end" }}>{right}</View>
    </View>
  );
}
