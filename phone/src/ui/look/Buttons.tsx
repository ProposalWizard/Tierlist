/**
 * THE WEBSITE'S BUTTONS.
 *   <LookButton label="Continue →" onPress={…} />                 green (primary)
 *   <LookButton kind="navy" label="← Back" />                     the navy Back
 *   <LookButton kind="gold" | "glass" | "dark" | "danger" />      the rest
 *   <LookButton kind="accent" accent="#60a5fa" small label="Use" /> a coloured small button (the cans)
 *   <SlantButton icon="＋" label="New game" primary />            the title menu's slanted tabs (gold, plain)
 *   <PlayButton onPress={…} />                                    the round glowing PLAY (BottomBar uses it)
 * All press with Press (shrinks on the phone's graphics thread). Nothing pulses
 * or shines at rest (the website's loops are left out on purpose: smoothness).
 */
import { useState, type ReactNode } from "react";
import { Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Press } from "../Press";
import { FONT } from "./fonts";
import { LOOK, rgba } from "./tokens";

export type ButtonKind = "primary" | "navy" | "gold" | "glass" | "dark" | "danger" | "accent";

function kindStyle(kind: ButtonKind, accent?: string): { box: ViewStyle; ink: string } {
  switch (kind) {
    case "primary": return { box: { backgroundImage: "linear-gradient(180deg, #34d399, #10b981)", boxShadow: "inset 0px 1px 0px rgba(255,255,255,0.35), 0px 6px 14px -8px rgba(16,185,129,0.8)" } as ViewStyle, ink: "#ffffff" };
    case "navy": return { box: { backgroundImage: `linear-gradient(180deg, ${LOOK.navy}, ${LOOK.navyDeep})`, boxShadow: "inset 0px 1px 0px rgba(255,255,255,0.12)" } as ViewStyle, ink: "#ffffff" };
    case "gold": return { box: { backgroundImage: "linear-gradient(180deg, #fde047, #f59e0b)", boxShadow: "inset 0px 1px 0px rgba(255,255,255,0.5)" } as ViewStyle, ink: "#111827" };
    case "glass": return { box: { backgroundColor: "rgba(255,255,255,0.16)", boxShadow: "inset 0px 0px 0px 1px rgba(255,255,255,0.3), 0px 6px 14px -10px rgba(0,0,0,0.7)" } as ViewStyle, ink: "#ffffff" };
    case "dark": return { box: { backgroundColor: "rgba(0,0,0,0.35)", boxShadow: "inset 0px 0px 0px 1px rgba(253,224,71,0.3)" } as ViewStyle, ink: "#fef08a" };
    case "danger": return { box: { backgroundImage: "linear-gradient(180deg, #ef4444, #b91c1c)", boxShadow: "inset 0px 1px 0px rgba(255,255,255,0.3)" } as ViewStyle, ink: "#ffffff" };
    case "accent": {
      const a = accent ?? LOOK.green;
      return { box: { backgroundImage: `linear-gradient(180deg, ${a}, ${a})`, boxShadow: `inset 0px 1px 0px rgba(255,255,255,0.35), 0px 4px 10px -6px ${rgba(a, 0.8)}` } as ViewStyle, ink: "#111111" };
    }
  }
}

export function LookButton({ label, onPress, kind = "primary", accent, small, disabled, style, children }: {
  label?: string; onPress?: () => void; kind?: ButtonKind; accent?: string; small?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle>; children?: ReactNode;
}) {
  // A coloured button that can't be pressed goes grey glass (the website's disabled cans), not a faded colour.
  const k = disabled && kind === "accent" ? { box: { backgroundColor: "rgba(255,255,255,0.22)" } as ViewStyle, ink: "#ffffff" } : kindStyle(kind, accent);
  return (
    <Press disabled={disabled} onPress={onPress} style={[k.box, { borderRadius: small ? 8 : 12, paddingVertical: small ? 6 : 13, paddingHorizontal: 10, alignItems: "center", justifyContent: "center" }, style]}>
      {children ?? <Text numberOfLines={1} style={{ color: k.ink, fontSize: small ? 11 : 16, fontWeight: "900" }}>{label}</Text>}
    </Press>
  );
}

/** The slanted left edge, in px (TitleScreen.tsx MenuButton: clip-path 14px). */
const SLANT = 14;

/**
 * The title menu's tab: flat right edge, slanted left edge, Anton-style caps.
 * The slant is a second, skewed piece of the same gradient under the left end
 * (React Native has no clip-path).
 */
export function SlantButton({ icon, label, hint, badge, primary, gold, onPress, disabled }: {
  icon: string; label: string; hint?: ReactNode; badge?: ReactNode; primary?: boolean; gold?: boolean; onPress: () => void; disabled?: boolean;
}) {
  // The website: plain tabs are 42 tall; the big one is at least 54 with 6 px above and
  // below, so it grows with its hint lines (Continue with club + season is 64).
  const [h, setH] = useState(primary ? 54 : 42);
  const bg = primary ? "linear-gradient(180deg, #34d399, #059669)"
    : gold ? "linear-gradient(180deg, rgba(120,80,10,0.94), rgba(70,44,4,0.97))"
    : "linear-gradient(180deg, rgba(10,50,28,0.92), rgba(5,32,17,0.96))";
  const tan = SLANT / h;
  return (
    <Press disabled={disabled} onPress={onPress} onLayout={(e) => { const v = Math.round(e.nativeEvent.layout.height); if (v > 0 && v !== h) setH(v); }}
      style={[{ flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 20, paddingRight: 8 }, primary ? { minHeight: 54, paddingVertical: 6 } : { height: 42 }]}>
      {/* the slanted end, then the body */}
      <View pointerEvents="none" style={{ position: "absolute", top: 0, bottom: 0, left: SLANT / 2, width: SLANT * 2, backgroundImage: bg, transform: [{ skewX: `${-Math.atan(tan)}rad` }] } as ViewStyle} />
      <View pointerEvents="none" style={{ position: "absolute", top: 0, bottom: 0, left: SLANT, right: 0, backgroundImage: bg, boxShadow: "inset 0px 1px 0px rgba(255,255,255,0.35), inset -1px 0px 0px rgba(255,255,255,0.2)" } as ViewStyle} />
      <Text style={{ color: "rgba(255,255,255,0.9)", fontSize: 17, lineHeight: 20, width: 17, textAlign: "center", includeFontPadding: false }}>{icon}</Text>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ color: "#fff", fontFamily: FONT.display, fontSize: primary ? 22 : 18, lineHeight: primary ? 26 : 22, letterSpacing: primary ? 0.55 : 0.45, textTransform: "uppercase", includeFontPadding: false, textShadowColor: "rgba(0,0,0,0.35)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 1 }}>{label}</Text>
        {hint ? <View style={{ marginTop: 2 }}>{typeof hint === "string" ? <Text numberOfLines={1} style={{ color: "rgba(255,255,255,0.8)", fontSize: 12, lineHeight: 13, fontWeight: "900", letterSpacing: -0.3, textTransform: "uppercase" }}>{hint}</Text> : hint}</View> : null}
      </View>
      {badge}
    </Press>
  );
}

/** The round PLAY that rises out of the bottom bar, glowing green (glassLook 6, MainBar PlayBtn). */
export function PlayButton({ onPress, locked, size = 66 }: { onPress: () => void; locked?: boolean; size?: number }) {
  return (
    <Press onPress={onPress} style={{
      width: size, height: size, borderRadius: size / 2, alignItems: "center", justifyContent: "center",
      ...(locked
        ? { backgroundColor: "#374151", borderWidth: 3, borderColor: "#1f2937" }
        : {
          backgroundImage: "radial-gradient(circle at 50% 35%, #5cff9a, #14c45a 60%, #0c8f3f)",
          borderWidth: 1, borderColor: "rgba(200,255,220,0.9)",
          boxShadow: "0px 0px 26px 6px rgba(34,227,107,0.6)",
        }),
    } as ViewStyle}>
      {locked ? <Text style={{ fontSize: 18 }}>🔒</Text> : <Text style={{ color: "#fff", fontSize: 22, marginLeft: 3, marginBottom: -2, textShadowColor: "rgba(0,60,25,0.6)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 }}>▶</Text>}
      <Text style={{ color: locked ? "#d1d5db" : "#fff", fontSize: 11, fontWeight: "900", letterSpacing: 1.2, textShadowColor: "rgba(0,60,25,0.6)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 }}>PLAY</Text>
    </Press>
  );
}
