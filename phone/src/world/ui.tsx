import { ClubBadge as DrawnBadge } from "../draw/ClubBadge";
import { NationFlag } from "../draw/NationFlag";
/**
 * THE WORLD SCREENS' SHARED PIECES: header with back, tab rows, cards, the
 * club badge placeholder, round arrows. Solid colours, no blur, the game's
 * dark green and gold (ui/theme.ts). Every button is ui/Press.
 */
import { useEffect, useRef, type ComponentRef, type ReactNode } from "react";
import { View, Text, ScrollView, useWindowDimensions, type StyleProp, type ViewStyle, type TextStyle } from "react-native";
import { tint, rgba as heroRgba } from "@/lib/star/heroFigure";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { kitsOf } from "@/lib/star/kits";
import type { CareerState } from "@/lib/star/types";
import { Press } from "../ui/Press";
import { C, R } from "../ui/theme";
import { Backdrop, BottomBar, FONT, LOOK, LookButton, ScreenHeader, glassStyle, type BackdropKind, type BarTab } from "../ui/look";

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
/** A nation's drawn flag, `size` tall (the website's NationFlag; it was a grey three-letter tag). */
export function Flag({ nation, size = 18 }: { nation: string; size?: number }) {
  return <NationFlag nation={nation} width={Math.round(size * 1.5)} />;
}

// ── Layout ──────────────────────────────────────────────────────────────────

/**
 * A full screen in the website's look: a picture behind (the blurred stadium
 * by default, `backdrop`), the shop's ◂ BACK pill, the title in Anton caps
 * with its kicker over it, and (optionally) the game's bottom bar (`bar`).
 */
export function ScreenFrame({ title, kicker, onBack, right, children, scroll = true, footer, backdrop = "stadium", bar }: {
  title: string; kicker?: string; onBack?: () => void; right?: ReactNode; children: ReactNode; scroll?: boolean; footer?: ReactNode;
  backdrop?: BackdropKind; bar?: BarTab | null;
}) {
  const inset = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: "#0b1a2e", paddingTop: inset.top }}>
      <Backdrop kind={backdrop} />
      <ScreenHeader title={title} kicker={kicker} onBack={onBack} right={right} />
      {scroll ? (
        <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: (bar !== undefined ? 30 : 40 + inset.bottom), gap: 10 }}>{children}</ScrollView>
      ) : <View style={{ flex: 1 }}>{children}</View>}
      {footer ? <View style={[{ paddingBottom: bar !== undefined ? 8 : Math.max(inset.bottom, 8), paddingTop: 8 }, { backgroundImage: "linear-gradient(180deg, rgba(10,22,40,0.85), rgba(6,14,26,0.96))", borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.18)" } as ViewStyle]}>{footer}</View> : null}
      {bar !== undefined ? <BottomBar active={bar} plain /> : null}
    </View>
  );
}

/** A glass panel (the website's frosted card); `glow` lights its top and rim in a colour. */
export function Card({ children, glow, style }: { children: ReactNode; glow?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[glassStyle("glass", glow && glow.startsWith("#") ? glow : undefined), { borderRadius: 16, padding: 10, overflow: "hidden" }, style]}>
      {children}
    </View>
  );
}

export function Title({ children, color = LOOK.emerald300, style }: { children: ReactNode; color?: string; style?: StyleProp<TextStyle> }) {
  return <Text style={[{ color, fontSize: 10.5, fontWeight: "900", letterSpacing: 1.8, textTransform: "uppercase", marginBottom: 6, textShadowColor: "rgba(0,0,0,0.6)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 }, style]}>{children}</Text>;
}

export function Empty({ text }: { text: string }) {
  // the website's Empty: rounded-xl, bg-black/30 (the glass skin's blue-slate), 12 px bold white
  return (
    <View style={{ borderRadius: 12, paddingHorizontal: 12, paddingVertical: 16, backgroundColor: "rgba(8,20,38,0.26)", marginBottom: 8 }}>
      <Text style={{ color: C.text, fontWeight: "700", textAlign: "center", fontSize: 12, lineHeight: 18 }}>{text}</Text>
    </View>
  );
}

/**
 * One row of tabs, the website's SegTabs (screenKit.tsx): a dark sunk track 37 px tall, 11 px
 * capitals (10 px under 380 wide), the chosen one white on a light pane with an emerald line
 * that pokes 3 px under it; the rest white at 55%.
 */
export function Seg<T extends string>({ value, onChange, tabs }: { value: T; onChange: (t: T) => void; tabs: readonly (readonly [T, string])[] }) {
  const { width } = useWindowDimensions();
  const fs = width >= 380 ? 11 : 10;
  return (
    <View style={{ flexDirection: "row", padding: 4, borderRadius: 12, backgroundColor: "rgba(8,20,38,0.26)", boxShadow: "inset 0px 1px 3px rgba(0,0,0,0.5)" } as ViewStyle}>
      {tabs.map(([k, label]) => {
        const on = value === k;
        return (
          <Press key={k} onPress={() => onChange(k)} style={[{ flex: 1, minWidth: 0, paddingVertical: 6, borderRadius: 8, alignItems: "center", justifyContent: "center" },
            on && ({ backgroundColor: "rgba(255,255,255,0.15)", boxShadow: "inset 0px 1px 0px rgba(255,255,255,0.16), 0px 2px 6px rgba(0,0,0,0.35)" } as ViewStyle)]}>
            <Text numberOfLines={1} style={{ color: on ? "#fff" : "rgba(255,255,255,0.55)", fontWeight: "900", fontSize: fs, lineHeight: fs * 1.5, letterSpacing: fs * 0.05, textTransform: "uppercase" }}>{label}</Text>
            {on ? <View pointerEvents="none" style={{ position: "absolute", left: 12, right: 12, bottom: -3, height: 3, borderRadius: 2, backgroundColor: "#34d399", boxShadow: "0px 0px 8px rgba(52,211,153,0.8)" } as ViewStyle} /> : null}
          </Press>
        );
      })}
    </View>
  );
}

/**
 * Chips in ONE row that scrolls sideways (the website's round chips): glass pills, the
 * chosen one gold. The row starts scrolled to the chosen chip (a cup's latest round).
 */
export function Chips<T extends string>({ value, onChange, items }: { value: T; onChange: (t: T) => void; items: readonly (readonly [T, string])[] }) {
  const ref = useRef<ComponentRef<typeof ScrollView>>(null);
  const xs = useRef<Record<string, number>>({});
  const first = useRef(true);
  const toChosen = () => { const x = xs.current[value]; if (x !== undefined) ref.current?.scrollTo({ x: Math.max(0, x - 40), animated: !first.current }); first.current = false; };
  useEffect(() => { toChosen(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [value]);
  return (
    <ScrollView ref={ref} horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginHorizontal: -12 }} contentContainerStyle={{ flexDirection: "row", gap: 6, paddingHorizontal: 12 }}>
      {items.map(([k, label]) => {
        const on = value === k;
        return (
          <Press key={k} onPress={() => onChange(k)} onLayout={(e) => { xs.current[k] = e.nativeEvent.layout.x; if (k === value && first.current) requestAnimationFrame(toChosen); }} style={[{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: R.pill }, on
            ? ({ backgroundImage: "linear-gradient(180deg, #fde047, #f59e0b)", boxShadow: "inset 0px 1px 0px rgba(255,255,255,0.5)" } as ViewStyle)
            : ({ backgroundColor: "rgba(10,22,40,0.6)", boxShadow: "inset 0px 0px 0px 1px rgba(255,255,255,0.22)" } as ViewStyle)]}>
            <Text numberOfLines={1} style={{ color: on ? "#111" : C.text, fontWeight: "900", fontSize: 12, lineHeight: 16 }}>{label}</Text>
          </Press>
        );
      })}
    </ScrollView>
  );
}

/** ‹ Round 8 ›: back through played rounds, on to future ones (the website's RoundNav: 36 px squares, Anton arrows). */
export function RoundNav({ label, sub, onPrev, onNext }: { label: string; sub?: string; onPrev?: () => void; onNext?: () => void }) {
  const btn = (txt: string, on?: () => void) => (
    <Press disabled={!on} onPress={on} style={{ width: 36, height: 36, borderRadius: 6, backgroundColor: "rgba(8,20,38,0.32)", alignItems: "center", justifyContent: "center", opacity: on ? 1 : 0.25 }}>
      <Text style={{ color: C.text, fontSize: 18, lineHeight: 27, fontFamily: FONT.display }}>{txt}</Text>
    </Press>
  );
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      {btn("‹", onPrev)}
      <View style={{ flex: 1, minWidth: 0, alignItems: "center" }}>
        <Text numberOfLines={1} style={{ color: C.text, fontWeight: "900", fontSize: 14, lineHeight: 21 }}>{label}</Text>
        {sub ? <Text numberOfLines={1} style={{ color: "rgba(255,255,255,0.7)", fontWeight: "700", fontSize: 10, lineHeight: 15 }}>{sub}</Text> : null}
      </View>
      {btn("›", onNext)}
    </View>
  );
}

/** Your club's row, the website's youRowStyle (screenKit.tsx): the club colour lifted toward white, a bright rim, a glow. */
export function youRow(glow: string): ViewStyle {
  const g = glow.startsWith("#") || glow.startsWith("rgb") ? glow : C.green;
  const lit = tint(g, 0.22);
  return {
    backgroundImage: `linear-gradient(90deg, ${heroRgba(lit, 0.85)}, ${heroRgba(g, 0.5)} 55%, ${heroRgba(g, 0.3)})`,
    boxShadow: `inset 0px 0px 0px 1.5px ${heroRgba(tint(g, 0.5), 0.95)}, inset 0px 1px 0px rgba(255,255,255,0.25), 0px 0px 18px -2px ${heroRgba(lit, 0.9)}`,
  } as ViewStyle;
}

/** A big button in the website's 3D look: gold, green (primary), red or glass. */
export function Btn({ label, onPress, tone = "gold", disabled, style }: { label: string; onPress: () => void; tone?: "gold" | "green" | "red" | "plain"; disabled?: boolean; style?: StyleProp<ViewStyle> }) {
  const kind = tone === "gold" ? "gold" : tone === "green" ? "primary" : tone === "red" ? "danger" : "glass";
  return (
    <LookButton kind={kind} disabled={disabled} onPress={onPress} style={[{ borderRadius: 14, paddingVertical: 13, paddingHorizontal: 12, opacity: disabled ? 0.55 : 1 }, style]}>
      <Text numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.75} style={{ color: kind === "gold" ? "#111827" : "#fff", fontWeight: "900", fontSize: 14, textAlign: "center" }}>{label}</Text>
    </LookButton>
  );
}

/** A filled bar out of 100. */
export function Meter({ value, color = C.green, height = 8 }: { value: number; color?: string; height?: number }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: "rgba(255,255,255,0.16)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", overflow: "hidden" }}>
      <View style={{ width: `${v}%`, height: "100%", borderRadius: height / 2, backgroundColor: color, boxShadow: "inset 0px 1px 0px rgba(255,255,255,0.4)" } as ViewStyle} />
    </View>
  );
}

/** A short line of note text that sits at the top of a screen for a few seconds. */
export function Note({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <View style={{ backgroundColor: "rgba(3,7,18,0.92)", borderColor: "rgba(252,211,77,0.5)", borderWidth: 1, borderRadius: 12, padding: 10, marginBottom: 6 }}>
      <Text style={{ color: C.text, fontWeight: "800", textAlign: "center" }}>{text}</Text>
    </View>
  );
}
