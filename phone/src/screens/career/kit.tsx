/**
 * The career screens' small parts: frame, cards, rows, buttons, bars, and the
 * stand-ins for the drawings (club badge, player figure) until phone/src/draw
 * lands. Swap ClubCrest / PlayerStandIn for the real drawings in ONE place here.
 */
import type { ReactNode } from "react";
import { ScrollView, View, Text, type StyleProp, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { kitsOf } from "@/lib/star/kits";
import { shortClub } from "@/lib/star/media/grammar";
import { Press } from "../../ui/Press";
import { C, R } from "../../ui/theme";

export { C, R };

/** A full screen: title bar (with an optional back arrow) and a scrolling body. */
export function Frame({ title, kicker, onBack, children, scroll = true, footer }: {
  title: string; kicker?: string; onBack?: () => void; children: ReactNode; scroll?: boolean; footer?: ReactNode;
}) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, minHeight: 52 }}>
        {onBack ? (
          <Press onPress={onBack} style={{ width: 44, height: 36, justifyContent: "center" }}>
            <Text style={{ color: C.text, fontSize: 26, fontWeight: "900" }}>‹</Text>
          </Press>
        ) : <View style={{ width: 44 }} />}
        <View style={{ flex: 1, alignItems: "center" }}>
          {kicker ? <Text style={{ color: C.green, fontSize: 11, fontWeight: "800", letterSpacing: 2 }}>{kicker.toUpperCase()}</Text> : null}
          <Text numberOfLines={1} style={{ color: C.text, fontSize: 20, fontWeight: "900" }}>{title}</Text>
        </View>
        <View style={{ width: 44 }} />
      </View>
      {scroll ? <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 40, gap: 12 }}>{children}</ScrollView> : <View style={{ flex: 1 }}>{children}</View>}
      {footer ? <View style={{ padding: 14, paddingTop: 6 }}>{footer}</View> : null}
    </SafeAreaView>
  );
}

export function Card({ children, style, tone }: { children: ReactNode; style?: StyleProp<ViewStyle>; tone?: string }) {
  return <View style={[{ backgroundColor: C.panel, borderRadius: R.card, padding: 16, borderWidth: 1, borderColor: tone ?? C.line }, style]}>{children}</View>;
}

export function Label({ children, color = C.gold }: { children: ReactNode; color?: string }) {
  return <Text style={{ color, fontSize: 12, fontWeight: "800", letterSpacing: 2, marginBottom: 8 }}>{typeof children === "string" ? children.toUpperCase() : children}</Text>;
}

export function Row({ k, v, sub, color }: { k: string; v: string; sub?: string; color?: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 7 }}>
      <View style={{ flex: 1, paddingRight: 8 }}>
        <Text style={{ color: C.dim, fontSize: 15 }}>{k}</Text>
        {sub ? <Text style={{ color: C.dim, fontSize: 11, marginTop: 1 }}>{sub}</Text> : null}
      </View>
      <Text style={{ color: color ?? C.text, fontSize: 15, fontWeight: "800" }}>{v}</Text>
    </View>
  );
}

export function Btn({ label, onPress, kind = "primary", disabled, small }: { label: string; onPress?: () => void; kind?: "primary" | "plain" | "gold" | "danger"; disabled?: boolean; small?: boolean }) {
  const bg = kind === "primary" ? C.green : kind === "gold" ? C.gold : kind === "danger" ? "#7f1d1d" : C.panel2;
  const fg = kind === "primary" || kind === "gold" ? "#05261a" : C.text;
  return (
    <Press disabled={disabled} onPress={onPress} style={{ backgroundColor: bg, borderRadius: R.card, paddingVertical: small ? 10 : 16, paddingHorizontal: 14, alignItems: "center", borderWidth: kind === "plain" ? 1 : 0, borderColor: C.line }}>
      <Text style={{ color: fg, fontSize: small ? 14 : 18, fontWeight: "900" }}>{label}</Text>
    </Press>
  );
}

/** A bar out of 100 that shows where it was and where it is now (green up, red down). */
export function MoveBar({ label, from, to }: { label: string; from: number; to: number }) {
  const a = Math.max(0, Math.min(100, from)), b = Math.max(0, Math.min(100, to));
  const lo = Math.min(a, b), hi = Math.max(a, b);
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ color: C.dim, fontSize: 11, fontWeight: "800", letterSpacing: 1, marginBottom: 4 }}>{label.toUpperCase()}</Text>
      <View style={{ height: 10, borderRadius: 5, backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden", flexDirection: "row" }}>
        <View style={{ width: `${lo}%`, backgroundColor: "#cbd5e1" }} />
        <View style={{ width: `${hi - lo}%`, backgroundColor: b >= a ? C.green : C.red }} />
      </View>
    </View>
  );
}

/** A plain filled bar (energy, stars). */
export function Fill({ value, color, height = 10 }: { value: number; color: string; height?: number }) {
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
      <View style={{ width: `${Math.max(0, Math.min(100, value))}%`, height: "100%", backgroundColor: color }} />
    </View>
  );
}

/** Number tile: a big number over a small label. */
export function Tile({ label, value, color = C.text, sub }: { label: string; value: string | number; color?: string; sub?: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: C.panel2, borderRadius: 12, paddingVertical: 10, alignItems: "center" }}>
      <Text style={{ color, fontSize: 22, fontWeight: "900" }}>{value}</Text>
      <Text style={{ color: C.dim, fontSize: 10, fontWeight: "800", letterSpacing: 1, marginTop: 2 }}>{label.toUpperCase()}</Text>
      {sub ? <Text style={{ color: C.gold, fontSize: 11, fontWeight: "800", marginTop: 2 }}>{sub}</Text> : null}
    </View>
  );
}

/**
 * STAND-IN for the drawing builder's ClubBadge (phone/src/draw): a round
 * crest in the club's home colours with its initials.
 */
export function ClubCrest({ club, size = 36 }: { club: string; size?: number }) {
  const kit = club ? kitsOf(club).home : { shirt: "#1f2937", trim: "#9ca3af" };
  const initials = shortClub(club || "?").split(/\s+/).map((w) => w[0]).join("").slice(0, 3).toUpperCase();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: kit.shirt, borderWidth: Math.max(2, size / 14), borderColor: kit.trim, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: kit.trim, fontWeight: "900", fontSize: size * 0.32 }}>{initials}</Text>
    </View>
  );
}

/** STAND-IN for the drawing builder's PlayerFigure: a shirt with your number. */
export function PlayerStandIn({ club, number, size = 120 }: { club: string; number?: number; size?: number }) {
  const kit = club ? kitsOf(club).home : { shirt: "#14532d", trim: "#ffffff" };
  return (
    <View style={{ width: size, height: size * 1.05, alignItems: "center", justifyContent: "flex-end" }}>
      <View style={{ width: size * 0.36, height: size * 0.36, borderRadius: size * 0.18, backgroundColor: "#c68863", marginBottom: 4 }} />
      <View style={{ width: size * 0.78, height: size * 0.56, borderTopLeftRadius: size * 0.2, borderTopRightRadius: size * 0.2, backgroundColor: kit.shirt, borderWidth: 3, borderColor: kit.trim, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: kit.trim, fontWeight: "900", fontSize: size * 0.24 }}>{number ?? ""}</Text>
      </View>
    </View>
  );
}

/** A note on a stand-in screen saying plainly what is still to come. */
export function StandInNote({ children }: { children: ReactNode }) {
  return (
    <View style={{ backgroundColor: "rgba(245,197,66,0.12)", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "rgba(245,197,66,0.4)" }}>
      <Text style={{ color: C.gold, fontWeight: "800", fontSize: 13 }}>{children}</Text>
    </View>
  );
}

export const money = (n: number) => `★${Math.round(n).toLocaleString("en-GB")}`;
export const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
