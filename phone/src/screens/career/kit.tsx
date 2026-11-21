import { ClubBadge as DrawnBadge } from "../../draw/ClubBadge";
import { PlayerFigure } from "../../draw/PlayerFigure";
import { useCareer } from "../../game/store";
const useCareerHere = useCareer;
/**
 * The career screens' small parts: frame, cards, rows, buttons, bars, and the
 * stand-ins for the drawings (club badge, player figure) until phone/src/draw
 * lands. Swap ClubCrest / PlayerStandIn for the real drawings in ONE place here.
 */
import type { ReactNode } from "react";
import { ScrollView, View, Text, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { kitsOf } from "@/lib/star/kits";
import { shortClub } from "@/lib/star/media/grammar";
import { Press } from "../../ui/Press";
import { C as BASE, R } from "../../ui/theme";
import { Backdrop, TopBar, BottomBar, LookButton, glassStyle, FONT, LOOK, TEXT_SHADOW, rgba, type BackdropKind, type BarTab } from "../../ui/look";
import { useNav } from "../../nav";
import { PitchBackdrop, NavyBackdrop } from "./lookBits";

/**
 * The career screens' colours, in the packed app's glass look (round 2): the
 * same names as ui/theme's C, so every screen reads them as before, but the
 * panels are see-through glass over the stadium and the gold is the website's amber.
 */
export const C = {
  ...BASE,
  bg: "#0b1a2e",
  panel: "rgba(255,255,255,0.07)",
  panel2: "rgba(255,255,255,0.10)",
  line: "rgba(255,255,255,0.12)",
  dim: "rgba(255,255,255,0.72)",
  gold: LOOK.gold as string,
};
export { R };

/**
 * A full screen in the packed app's look: the blurred stadium behind, the
 * title in Anton (with a small kicker over it), a glass Back square, and a
 * scrolling body. `top` adds the game's top bar (name, money, star, energy),
 * `bar` the bottom bar (League · Training · Home · Phone · PLAY), as the
 * website shows them on Stats, Training and the like. `bare` drops the title row.
 */
export function Frame({ title, kicker, onBack, children, scroll = true, footer, backdrop = "stadium", top, bar, bare }: {
  title: string; kicker?: string; onBack?: () => void; children: ReactNode; scroll?: boolean; footer?: ReactNode;
  backdrop?: BackdropKind | "pitch" | "navy"; top?: boolean; bar?: BarTab | true; bare?: boolean;
}) {
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {backdrop === "pitch" ? <PitchBackdrop /> : backdrop === "navy" ? <NavyBackdrop /> : <Backdrop kind={backdrop} />}
      {top ? <TopBarHere /> : null}
      <SafeAreaView edges={top ? [] : ["top"]} style={{ flex: 1 }}>
        {!bare && (
          <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingTop: top ? 8 : 6, paddingBottom: 6, minHeight: 50 }}>
            {onBack ? (
              <Press onPress={onBack} style={[glassStyle("glass"), { width: 40, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" }]}>
                <Text style={{ color: "#fff", fontSize: 24, fontWeight: "900", marginTop: -3 }}>‹</Text>
              </Press>
            ) : <View style={{ width: 40 }} />}
            <View style={{ flex: 1, alignItems: "center", paddingHorizontal: 6 }}>
              {kicker ? <Text numberOfLines={1} style={[{ color: LOOK.emerald300, fontSize: 10, fontWeight: "900", letterSpacing: 1.8, textTransform: "uppercase" }, TEXT_SHADOW]}>{kicker}</Text> : null}
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[{ color: "#fff", fontFamily: FONT.display, fontSize: 26, lineHeight: 31, letterSpacing: 0.4, textTransform: "uppercase" }, TEXT_SHADOW]}>{title}</Text>
            </View>
            <View style={{ width: 40 }} />
          </View>
        )}
        {scroll ? <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: bar ? 24 : 40, gap: 10 }}>{children}</ScrollView> : <View style={{ flex: 1 }}>{children}</View>}
        {footer ? <View style={{ paddingHorizontal: 12, paddingTop: 6, paddingBottom: bar ? 8 : 12 }}>{footer}</View> : null}
      </SafeAreaView>
      {bar ? <BottomBar active={bar === true ? null : bar} /> : null}
    </View>
  );
}

/** The top bar wired to the app (help, settings, the Star Pass). */
function TopBarHere() {
  const nav = useNav();
  const career = useCareerHere();
  if (!career) return null;
  return <TopBar career={career} onHelp={() => nav.go("career-help")} onSettings={() => nav.go("career-settings")} onStarPass={() => nav.go("star-pass")} />;
}

/**
 * A glass panel (the website's ClubCard). `tone`: a hex colour lights its rim
 * and top in that colour (green for good news, red for bad, gold for money);
 * any other colour is a plain rim. A `backgroundColor` in `style` (the
 * contract's paper) replaces the glass.
 */
export function Card({ children, style, tone }: { children: ReactNode; style?: StyleProp<ViewStyle>; tone?: string }) {
  const flat = StyleSheet.flatten(style) ?? {};
  const own = flat.backgroundColor !== undefined;
  const hex = tone && /^#[0-9a-f]{6}$/i.test(tone) ? tone : undefined;
  const base: ViewStyle = own ? {} : hex ? glassStyle("glass", hex) : glassStyle("glass");
  const rim: ViewStyle = !own && tone && !hex ? { borderWidth: 1, borderColor: tone } : {};
  return <View style={[base, rim, { borderRadius: 16, padding: 14 }, style]}>{children}</View>;
}

/** A card's small heading: capitals, wide spacing (the website's CardTitle). */
export function Label({ children, color = LOOK.goldSoft }: { children: ReactNode; color?: string }) {
  return <Text style={[{ color, fontSize: 11, fontWeight: "900", letterSpacing: 1.8, marginBottom: 8 }, TEXT_SHADOW]}>{typeof children === "string" ? children.toUpperCase() : children}</Text>;
}

export function Row({ k, v, sub, color }: { k: string; v: string; sub?: string; color?: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 7 }}>
      <View style={{ flex: 1, paddingRight: 8 }}>
        <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 14, fontWeight: "700" }}>{k}</Text>
        {sub ? <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: "700", marginTop: 1 }}>{sub}</Text> : null}
      </View>
      <Text style={{ color: color ?? "#fef08a", fontSize: 15, fontWeight: "900" }}>{v}</Text>
    </View>
  );
}

/** The website's buttons: primary green, plain = the navy secondary, gold, danger red. */
export function Btn({ label, onPress, kind = "primary", disabled, small }: { label: string; onPress?: () => void; kind?: "primary" | "plain" | "gold" | "danger"; disabled?: boolean; small?: boolean }) {
  const look = kind === "plain" ? "navy" : kind;
  const ink = kind === "gold" ? "#111827" : "#fff";
  return (
    <LookButton kind={look} disabled={disabled} onPress={onPress} style={{ paddingVertical: small ? 10 : 15, borderRadius: small ? 10 : 14 }}>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ color: ink, fontSize: small ? 13 : 16, fontWeight: "900", letterSpacing: small ? 0.3 : 1, textTransform: small ? "none" : "uppercase" }}>{label}</Text>
    </LookButton>
  );
}

/** A bar out of 100 that shows where it was and where it is now (green up, red down). */
export function MoveBar({ label, from, to }: { label: string; from: number; to: number }) {
  const a = Math.max(0, Math.min(100, from)), b = Math.max(0, Math.min(100, to));
  const lo = Math.min(a, b), hi = Math.max(a, b);
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 10, fontWeight: "900", letterSpacing: 1.4, marginBottom: 4 }}>{label.toUpperCase()}</Text>
      <View style={{ height: 10, borderRadius: 3, backgroundColor: "rgba(0,0,0,0.45)", borderWidth: 1, borderColor: "rgba(255,255,255,0.14)", overflow: "hidden", flexDirection: "row" }}>
        <View style={{ width: `${lo}%`, backgroundImage: "linear-gradient(180deg, #e2e8f0, #94a3b8)" } as ViewStyle} />
        <View style={{ width: `${hi - lo}%`, backgroundImage: b >= a ? "linear-gradient(180deg, #6ee7b7, #10b981)" : "linear-gradient(180deg, #fca5a5, #dc2626)" } as ViewStyle} />
      </View>
    </View>
  );
}

/** A filled bar (energy, stars): a dark track and a glossy fill. */
export function Fill({ value, color, height = 10 }: { value: number; color: string; height?: number }) {
  return (
    <View style={{ height, borderRadius: Math.min(height / 2, 4), backgroundColor: "rgba(0,0,0,0.45)", borderWidth: 1, borderColor: "rgba(255,255,255,0.14)", overflow: "hidden" }}>
      <View style={{ width: `${Math.max(0, Math.min(100, value))}%`, height: "100%", backgroundColor: color }}>
        <View style={{ position: "absolute", left: 0, right: 0, top: 0, height: "45%", backgroundColor: "rgba(255,255,255,0.25)" }} />
      </View>
    </View>
  );
}

/** Number tile (the website's StatTile): a big number over a small label, on light glass. */
export function Tile({ label, value, color = C.text, sub }: { label: string; value: string | number; color?: string; sub?: string }) {
  const lit = color !== C.text && /^#[0-9a-f]{6}$/i.test(color);
  return (
    <View style={{ flex: 1, borderRadius: 12, paddingVertical: 8, alignItems: "center",
      backgroundImage: lit ? `linear-gradient(180deg, ${rgba(color, 0.26)}, ${rgba(color, 0.08)})` : "linear-gradient(180deg, rgba(255,255,255,0.13), rgba(255,255,255,0.04))",
      boxShadow: `inset 0px 1px 0px rgba(255,255,255,0.16), inset 0px 0px 0px 1px ${lit ? rgba(color, 0.4) : "rgba(255,255,255,0.09)"}` } as ViewStyle}>
      <Text style={{ color, fontSize: 22, fontWeight: "900" }}>{value}</Text>
      <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 9, fontWeight: "900", letterSpacing: 1.6, marginTop: 1 }}>{label.toUpperCase()}</Text>
      {sub ? <Text style={{ color: "#fde68a", fontSize: 11, fontWeight: "900", marginTop: 2 }}>{sub}</Text> : null}
    </View>
  );
}

/**
 * STAND-IN for the drawing builder's ClubBadge (phone/src/draw): a round
 * crest in the club's home colours with its initials.
 */
/** The club's drawn badge, as the website draws it (draw/ClubBadge.tsx). */
export function ClubCrest({ club, size = 36 }: { club: string; size?: number }) {
  return <DrawnBadge club={club || "?"} size={size} />;
}

/** Your player in his kit, as the website draws him (draw/PlayerFigure.tsx). */
export function PlayerStandIn({ size = 120 }: { club: string; number?: number; size?: number }) {
  const career = useCareer();
  if (!career) return null;
  return <PlayerFigure career={career} width={size} height={size * 1.6} />;
}

/** A note on a stand-in screen saying plainly what is still to come. */
export function StandInNote({ children }: { children: ReactNode }) {
  return (
    <View style={{ backgroundColor: "rgba(251,191,36,0.15)", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "rgba(252,211,77,0.5)" }}>
      <Text style={{ color: C.gold, fontWeight: "800", fontSize: 13 }}>{children}</Text>
    </View>
  );
}

export const money = (n: number) => `★${Math.round(n).toLocaleString("en-GB")}`;
export const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
