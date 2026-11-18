import { ClubBadge as DrawnBadge } from "../draw/ClubBadge";
/**
 * THE WORLD SCREENS' SHARED PIECES: header with back, tab rows, cards, the
 * club badge placeholder, round arrows. Solid colours, no blur, the game's
 * dark green and gold (ui/theme.ts). Every button is ui/Press.
 */
import { type ReactNode } from "react";
import { View, Text, ScrollView, type StyleProp, type ViewStyle, type TextStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { kitsOf } from "@/lib/star/kits";
import type { CareerState } from "@/lib/star/types";
import { Press } from "../ui/Press";
import { C, R } from "../ui/theme";

// ── Colours ─────────────────────────────────────────────────────────────────

function lum(hex: string): number {
  const n = parseInt(hex.replace("#", "").slice(0, 6).padEnd(6, "0"), 16);
  const ch = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * ch((n >> 16) & 255) + 0.7152 * ch((n >> 8) & 255) + 0.0722 * ch(n & 255);
}
function lighten(hex: string, f: number): string {
  const n = parseInt(hex.replace("#", "").slice(0, 6).padEnd(6, "0"), 16);
  const m = (v: number) => Math.round(v + (255 - v) * f);
  return `rgb(${m((n >> 16) & 255)},${m((n >> 8) & 255)},${m(n & 255)})`;
}
/** A colour with transparency, from "#rrggbb". */
export function rgba(hex: string, a: number): string {
  if (!hex.startsWith("#")) return hex;
  const n = parseInt(hex.slice(1, 7).padEnd(6, "0"), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
/** The colour a club lights things with (the website's glowOf: shirt, or trim on a white shirt). */
export function clubGlow(club: string, career?: Pick<CareerState, "clubKits"> | null): string {
  const kit = kitsOf(club, career?.clubKits?.[club]).home;
  const base = lum(kit.shirt) > 0.85 ? kit.trim : kit.shirt;
  return lum(base) < 0.12 ? lighten(base, 0.35) : base;
}

// ── Club badge (placeholder until phone/src/draw/ClubBadge lands) ───────────

/**
 * THE ONE PLACE a club crest is drawn on the world screens. A round badge in
 * the club's shirt and trim with its initials. When the DRAWING area's
 * ClubBadge exists, swap the body of this function for it.
 */
export function ClubBadge({ club, size = 20 }: { club: string; size?: number; career?: Pick<CareerState, "clubKits"> | null }) {
  return <DrawnBadge club={club} size={size} />;
}

/** A nation's flag stand-in: the nation's initials on a dark chip. */
export function Flag({ nation, size = 18 }: { nation: string; size?: number }) {
  return (
    <View style={{ width: size * 1.4, height: size, borderRadius: 3, backgroundColor: C.panel2, borderWidth: 1, borderColor: C.line, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: C.text, fontSize: size * 0.45, fontWeight: "900" }}>{nation.slice(0, 3).toUpperCase()}</Text>
    </View>
  );
}

// ── Layout ──────────────────────────────────────────────────────────────────

/** A full screen with a title, a back arrow and (optionally) something on the right. */
export function ScreenFrame({ title, kicker, onBack, right, children, scroll = true, footer }: {
  title: string; kicker?: string; onBack?: () => void; right?: ReactNode; children: ReactNode; scroll?: boolean; footer?: ReactNode;
}) {
  const inset = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: inset.top }}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, gap: 10 }}>
        {onBack ? (
          <Press onPress={onBack} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.panel2, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: C.gold, fontSize: 22, fontWeight: "900", marginTop: -2 }}>‹</Text>
          </Press>
        ) : null}
        <View style={{ flex: 1 }}>
          {kicker ? <Text style={{ color: C.green, fontSize: 11, fontWeight: "800", letterSpacing: 2 }}>{kicker.toUpperCase()}</Text> : null}
          <Text numberOfLines={1} style={{ color: C.text, fontSize: 22, fontWeight: "900" }}>{title}</Text>
        </View>
        {right}
      </View>
      {scroll ? (
        <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 40 + inset.bottom, gap: 10 }}>{children}</ScrollView>
      ) : <View style={{ flex: 1 }}>{children}</View>}
      {footer ? <View style={{ paddingBottom: Math.max(inset.bottom, 8), backgroundColor: "#0f1a16", borderTopWidth: 1, borderTopColor: C.line }}>{footer}</View> : null}
    </View>
  );
}

export function Card({ children, glow, style }: { children: ReactNode; glow?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ backgroundColor: C.panel, borderRadius: R.card - 4, borderWidth: 1, borderColor: glow ? rgba(glow, 0.55) : C.line, padding: 8, overflow: "hidden" }, style]}>
      {children}
    </View>
  );
}

export function Title({ children, color = C.gold, style }: { children: ReactNode; color?: string; style?: StyleProp<TextStyle> }) {
  return <Text style={[{ color, fontSize: 11, fontWeight: "900", letterSpacing: 1.6, textTransform: "uppercase", marginBottom: 6 }, style]}>{children}</Text>;
}

export function Empty({ text }: { text: string }) {
  return (
    <View style={{ backgroundColor: C.panel, borderRadius: 14, padding: 16 }}>
      <Text style={{ color: C.text, fontWeight: "700", textAlign: "center", fontSize: 13 }}>{text}</Text>
    </View>
  );
}

/** One row of tabs (the website's SegTabs). Wraps onto two lines rather than scrolling. */
export function Seg<T extends string>({ value, onChange, tabs }: { value: T; onChange: (t: T) => void; tabs: readonly (readonly [T, string])[] }) {
  return (
    <View style={{ flexDirection: "row", backgroundColor: C.panel, borderRadius: R.pill, padding: 3 }}>
      {tabs.map(([k, label]) => (
        <Press key={k} onPress={() => onChange(k)} style={{ flex: 1, paddingVertical: 8, borderRadius: R.pill, alignItems: "center", backgroundColor: value === k ? C.panel2 : "transparent" }}>
          <Text numberOfLines={1} style={{ color: value === k ? C.gold : C.dim, fontWeight: "900", fontSize: 12 }}>{label}</Text>
        </Press>
      ))}
    </View>
  );
}

/** Chips that wrap (no sideways scrolling). */
export function Chips<T extends string>({ value, onChange, items }: { value: T; onChange: (t: T) => void; items: readonly (readonly [T, string])[] }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
      {items.map(([k, label]) => (
        <Press key={k} onPress={() => onChange(k)} style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: R.pill, backgroundColor: value === k ? C.gold : "rgba(255,255,255,0.1)" }}>
          <Text style={{ color: value === k ? "#111" : C.text, fontWeight: "900", fontSize: 12 }}>{label}</Text>
        </Press>
      ))}
    </View>
  );
}

/** ‹ Round 8 ›: back through played rounds, on to future ones. */
export function RoundNav({ label, sub, onPrev, onNext }: { label: string; sub?: string; onPrev?: () => void; onNext?: () => void }) {
  const btn = (txt: string, on?: () => void) => (
    <Press disabled={!on} onPress={on} style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: C.panel2, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: C.text, fontSize: 22, fontWeight: "900", marginTop: -2 }}>{txt}</Text>
    </Press>
  );
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      {btn("‹", onPrev)}
      <View style={{ flex: 1, alignItems: "center" }}>
        <Text style={{ color: C.text, fontWeight: "900", fontSize: 15 }}>{label}</Text>
        {sub ? <Text style={{ color: C.dim, fontWeight: "700", fontSize: 11 }}>{sub}</Text> : null}
      </View>
      {btn("›", onNext)}
    </View>
  );
}

/** Your club's row: lit in your club's colour. */
export function youRow(glow: string): ViewStyle {
  return { backgroundColor: rgba(glow.startsWith("#") ? glow : C.green, 0.28), borderWidth: 1, borderColor: rgba(glow.startsWith("#") ? glow : C.green, 0.8) };
}

/** A big button: gold (primary), green, red or plain. */
export function Btn({ label, onPress, tone = "gold", disabled, style }: { label: string; onPress: () => void; tone?: "gold" | "green" | "red" | "plain"; disabled?: boolean; style?: StyleProp<ViewStyle> }) {
  const bg = tone === "gold" ? C.gold : tone === "green" ? C.green : tone === "red" ? "#7f1d1d" : C.panel2;
  const ink = tone === "gold" || tone === "green" ? "#111" : C.text;
  return (
    <Press disabled={disabled} onPress={onPress} style={[{ backgroundColor: bg, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 12, alignItems: "center", justifyContent: "center" }, style]}>
      <Text style={{ color: ink, fontWeight: "900", fontSize: 14, textAlign: "center" }}>{label}</Text>
    </Press>
  );
}

/** A filled bar out of 100. */
export function Meter({ value, color = C.green, height = 8 }: { value: number; color?: string; height?: number }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
      <View style={{ width: `${v}%`, height: "100%", backgroundColor: color }} />
    </View>
  );
}

/** A short line of note text that sits at the top of a screen for a few seconds. */
export function Note({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <View style={{ backgroundColor: "#111", borderColor: C.gold, borderWidth: 1, borderRadius: 12, padding: 10, marginBottom: 6 }}>
      <Text style={{ color: C.text, fontWeight: "800", textAlign: "center" }}>{text}</Text>
    </View>
  );
}
