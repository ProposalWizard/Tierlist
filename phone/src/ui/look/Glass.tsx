/**
 * GLASS CARDS, the website's panels (glassLook.css 2, ui/ClubCard.tsx) with no blur.
 *   <Glass>…</Glass>                         the frosted blue-slate panel (Stats, League, Post-match)
 *   <Glass tone="green">…</Glass>            the new-career card (emerald-800 → 900, emerald-600 edge)
 *   <Glass tone="inset">…</Glass>            a dark well inside a card (the photo picker)
 *   <Glass glow="#d946ef">…</Glass>          a coloured top light and rim (Home's stat tiles, cans)
 * `radius`, `pad` and `style` as usual. Everything is drawn once by the phone
 * (gradients and inset shadows are plain styles): nothing redraws at rest.
 */
import type { ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { GLASS_EDGE, LOOK, rgba } from "./tokens";

export type GlassTone = "glass" | "green" | "inset" | "dark";

export function glassStyle(tone: GlassTone = "glass", glow?: string): ViewStyle {
  if (glow) {
    return {
      backgroundImage: `radial-gradient(ellipse at 50% 0%, ${rgba(glow, 0.38)} 0%, ${rgba(glow, 0)} 75%), linear-gradient(180deg, rgba(5,8,15,0.72), rgba(5,8,15,0.72))`,
      boxShadow: `inset 0px 1px 0px rgba(255,255,255,0.14), inset 0px 0px 0px 1.5px ${rgba(glow, 0.6)}, 0px 6px 14px -8px ${rgba(glow, 0.8)}`,
    } as ViewStyle;
  }
  switch (tone) {
    case "green":
      return {
        backgroundImage: "linear-gradient(180deg, #065f46, #064e3b)",
        borderWidth: 1, borderColor: "#059669",
        boxShadow: "0px 18px 30px -12px rgba(0,0,0,0.6)",
      } as ViewStyle;
    case "inset":
      return {
        backgroundImage: "linear-gradient(180deg, rgba(3,7,18,0.55), rgba(3,7,18,0.35))",
        boxShadow: "inset 0px 1px 3px rgba(0,0,0,0.55), inset 0px 0px 0px 1px rgba(110,231,183,0.22)",
      } as ViewStyle;
    case "dark":
      return { backgroundColor: "rgba(5,8,15,0.72)", boxShadow: "inset 0px 0px 0px 1px rgba(255,255,255,0.12)" } as ViewStyle;
    default:
      return {
        backgroundImage: `linear-gradient(180deg, ${LOOK.glassTop}, ${LOOK.glassBottom})`,
        boxShadow: `${GLASS_EDGE}, 0px 8px 22px -10px rgba(0,0,0,0.55)`,
      } as ViewStyle;
  }
}

export function Glass({ children, tone = "glass", glow, radius = 16, pad = 12, style }: {
  children?: ReactNode; tone?: GlassTone; glow?: string; radius?: number; pad?: number; style?: StyleProp<ViewStyle>;
}) {
  return <View style={[glassStyle(tone, glow), { borderRadius: radius, padding: pad }, style]}>{children}</View>;
}
