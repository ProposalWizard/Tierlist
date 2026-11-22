/**
 * Small parts for the Ownership, Investments, Rule Book and vote screens: a
 * money box (typed with thousands commas, like the website's text+numeric
 * inputs), a pick-one list (the website's <select>), a red message line, a
 * colour row (the website's colour inputs: swatches and any colour) and the kit shirt.
 */
import { useMemo, useRef, useState, type ReactNode } from "react";
import { PanResponder, ScrollView, Text, TextInput, View, type ViewStyle } from "react-native";
import { Canvas, Group, Path } from "@shopify/react-native-skia";
import type { Kit } from "@/lib/star/kits";
import { Press } from "../../ui/Press";
import { C } from "../../world/lookKit";
import { ColourChoice } from "../../ui/ColourPicker";

/** A money/number box: shows 1,000,000 and keeps only the digits. */
export function NumBox({ value, onChange, placeholder, prefix = "★" }: { value: number | null; onChange: (n: number | null) => void; placeholder?: string; prefix?: string }) {
  return (
    <View style={{ flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: "rgba(3,7,18,0.72)", boxShadow: "inset 0px 2px 4px rgba(0,0,0,0.6), inset 0px 0px 0px 1px rgba(255,255,255,0.10)", borderRadius: 8, paddingHorizontal: 8 } as ViewStyle}>
      {prefix ? <Text style={{ color: C.gold, fontWeight: "900" }}>{prefix}</Text> : null}
      <TextInput
        value={value === null ? "" : value.toLocaleString("en-GB")}
        placeholder={placeholder}
        placeholderTextColor={C.dim}
        keyboardType="number-pad"
        selectTextOnFocus
        onChangeText={(t) => { const d = t.replace(/[^\d]/g, ""); onChange(d ? Number(d) : null); }}
        style={{ flex: 1, color: C.text, fontWeight: "400", fontSize: 14, lineHeight: 20, paddingVertical: 6, marginLeft: prefix ? 4 : 0 }}
      />
    </View>
  );
}

/** A plain text box. */
export function TextBox({ value, onChange, placeholder }: { value: string; onChange: (s: string) => void; placeholder?: string }) {
  return (
    <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={C.dim}
      style={{ flex: 1, backgroundColor: C.panel2, color: C.text, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, fontWeight: "700", fontSize: 14 }} />
  );
}

/** Pick one from a list: shows the choice; tap to open the list under it. */
export function Choose<T extends string>({ value, options, onChange, label }: { value: T; options: readonly (readonly [T, string])[]; onChange: (v: T) => void; label?: (v: T) => string }) {
  const [open, setOpen] = useState(false);
  const shown = options.find(([k]) => k === value)?.[1] ?? (label ? label(value) : value) ?? "—";
  return (
    <View style={{ flex: 1 }}>
      <Press onPress={() => setOpen(!open)} style={{ backgroundColor: C.panel2, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 9, flexDirection: "row", alignItems: "center" }}>
        <Text numberOfLines={1} style={{ flex: 1, color: C.text, fontWeight: "800", fontSize: 13 }}>{shown || "—"}</Text>
        <Text style={{ color: C.dim, fontWeight: "900" }}>{open ? "˄" : "˅"}</Text>
      </Press>
      {open && (
        <ScrollView nestedScrollEnabled style={{ maxHeight: 240, backgroundColor: "#0b1626", borderRadius: 10, marginTop: 4, borderWidth: 1, borderColor: C.line }}>
          {options.map(([k, l]) => (
            <Press key={k} onPress={() => { onChange(k); setOpen(false); }} style={{ paddingHorizontal: 10, paddingVertical: 9, backgroundColor: k === value ? C.panel2 : "transparent" }}>
              <Text style={{ color: k === value ? C.gold : C.text, fontWeight: "700", fontSize: 13 }}>{l}</Text>
            </Press>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

/** A red line saying why something did not go through. */
export function Problem({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <View style={{ backgroundColor: "rgba(127,29,29,0.6)", borderColor: "rgba(239,68,68,0.6)", borderWidth: 1, borderRadius: 10, padding: 9 }}>
      <Text style={{ color: "#fecaca", fontWeight: "800", textAlign: "center", fontSize: 12 }}>{text}</Text>
    </View>
  );
}

/**
 * A small button: the website's kit-btn (ui/Screen.tsx SCREEN_CSS): a three-stop gradient in its colour,
 * a light line on top, a coloured glow under it. Full width: 10 px words on a 15 px line, 6 px above and
 * below (27 tall); beside a box (`flex={false}`): 12 px words, 12 px at the sides (28 tall).
 * One you can't use yet keeps its colour at 40% (the website's disabled:opacity-40): blue stays blue, amber stays amber.
 */
const KIT_BTN: Record<string, { bg: string; sh: string; ink: string }> = {
  green: { bg: "linear-gradient(180deg, #4ade80, #10b981 55%, #047857)", sh: "inset 0px 1px 0px rgba(255,255,255,0.45), inset 0px -2px 0px rgba(0,0,0,0.18), 0px 6px 14px -6px rgba(16,185,129,0.75)", ink: "#fff" },
  blue: { bg: "linear-gradient(180deg, #7cb4ff, #3b82f6 55%, #1d4ed8)", sh: "inset 0px 1px 0px rgba(255,255,255,0.45), inset 0px -2px 0px rgba(0,0,0,0.18), 0px 6px 14px -6px rgba(59,130,246,0.75)", ink: "#fff" },
  red: { bg: "linear-gradient(180deg, #f87171, #dc2626 55%, #991b1b)", sh: "inset 0px 1px 0px rgba(255,255,255,0.4), 0px 6px 14px -6px rgba(220,38,38,0.7)", ink: "#fff" },
  gold: { bg: "linear-gradient(180deg, #fde68a, #fbbf24 55%, #d97706)", sh: "inset 0px 1px 0px rgba(255,255,255,0.6), 0px 6px 14px -6px rgba(245,158,11,0.7)", ink: "#111827" },
  amber: { bg: "linear-gradient(180deg, #fbbf24, #d97706 55%, #92400e)", sh: "inset 0px 1px 0px rgba(255,255,255,0.45), 0px 6px 14px -6px rgba(217,119,6,0.7)", ink: "#fff" },
  purple: { bg: "linear-gradient(180deg, #c4b5fd, #8b5cf6 55%, #6d28d9)", sh: "inset 0px 1px 0px rgba(255,255,255,0.45), 0px 6px 14px -6px rgba(139,92,246,0.7)", ink: "#fff" },
  plain: { bg: "linear-gradient(180deg, rgba(255,255,255,0.16), rgba(255,255,255,0.05))", sh: "inset 0px 1px 0px rgba(255,255,255,0.2), inset 0px 0px 0px 1px rgba(255,255,255,0.12), 0px 6px 14px -10px rgba(0,0,0,0.9)", ink: "#fff" },
};
export function SmallBtn({ label, onPress, tone = "plain", disabled, flex = true }: { label: string; onPress: () => void; tone?: "green" | "red" | "blue" | "gold" | "amber" | "plain" | "purple"; disabled?: boolean; flex?: boolean }) {
  const k = KIT_BTN[tone];
  const fs = flex ? 10 : 12;
  return (
    <Press disabled={disabled} onPress={onPress} style={{ flex: flex ? 1 : undefined, backgroundImage: k.bg, boxShadow: k.sh, borderRadius: 8, paddingVertical: 6, paddingHorizontal: flex ? 6 : 12, alignItems: "center", justifyContent: "center", opacity: disabled ? 0.4 : 1 } as ViewStyle}>
      <Text numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.8} style={{ color: k.ink, fontWeight: "900", fontSize: fs, lineHeight: flex ? 15 : 16, textAlign: "center" }}>{label}</Text>
    </Press>
  );
}

/** The website's kit-tabs (the Rule Book's bodies, the boardroom's tabs): a dark track, 10 px caps 1.2 px apart, the chosen one on a light pane with a green line under it. */
export function KitTabs<T extends string>({ value, onChange, tabs }: { value: T; onChange: (t: T) => void; tabs: readonly (readonly [T, string])[] }) {
  return (
    <View style={{ flexDirection: "row", gap: 2, padding: 3, borderRadius: 14.4, backgroundColor: "rgba(10,22,40,0.6)", boxShadow: "inset 0px 0px 0px 1px rgba(255,255,255,0.16)" } as ViewStyle}>
      {tabs.map(([k, label]) => {
        const on = k === value;
        return (
          <Press key={k} onPress={() => onChange(k)} style={[{ flex: 1, minWidth: 0, borderRadius: 11.2, paddingVertical: 6.4, paddingHorizontal: 4, alignItems: "center", justifyContent: "center" },
            on && ({ backgroundColor: "rgba(255,255,255,0.2)", boxShadow: "inset 0px 0px 0px 1px rgba(255,255,255,0.34), inset 0px -2px 0px rgb(34,227,107)" } as ViewStyle)]}>
            <Text numberOfLines={1} style={{ color: "rgba(255,255,255,0.72)", fontSize: 10, lineHeight: 15, fontWeight: "900", letterSpacing: 1.2, textTransform: "uppercase" }}>{label}</Text>
          </Press>
        );
      })}
    </View>
  );
}

/** The website's red range slider (how much of your stake to sell): tap or drag along the track, 1 to 100. */
export function RangeSlider({ value, min = 1, max = 100, onChange, color = "#ef4444" }: { value: number; min?: number; max?: number; onChange: (v: number) => void; color?: string }) {
  const [w, setW] = useState(1);
  const cb = useRef(onChange);
  cb.current = onChange;
  const ww = useRef(1);
  ww.current = w;
  const pan = useMemo(() => {
    const at = (x: number) => cb.current(Math.round(min + Math.max(0, Math.min(1, (x - 8) / Math.max(1, ww.current - 16))) * (max - min)));
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => at(e.nativeEvent.locationX),
      onPanResponderMove: (e) => at(e.nativeEvent.locationX),
    });
  }, [min, max]).panHandlers;
  const k = Math.max(0, Math.min(1, (value - min) / (max - min)));
  return (
    <View accessibilityLabel="How much of your stake to sell" onLayout={(e) => setW(e.nativeEvent.layout.width || 1)} {...pan} style={{ height: 16, justifyContent: "center" }}>
      <View pointerEvents="none" style={{ height: 8, borderRadius: 4, backgroundColor: "#efefef", borderWidth: 1, borderColor: "#b2b2b2", overflow: "hidden" }}>
        <View style={{ width: 8 + k * (w - 16), height: "100%", backgroundColor: color }} />
      </View>
      <View pointerEvents="none" style={{ position: "absolute", left: k * (w - 16), width: 16, height: 16, borderRadius: 8, backgroundColor: color }} />
    </View>
  );
}

export function Line({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>{children}</View>;
}
/** The small print under a control: 9 px. */
export function Small({ children, color = C.dim }: { children: ReactNode; color?: string }) {
  return <Text style={{ color, fontSize: 9, lineHeight: 13.5, fontWeight: "600" }}>{children}</Text>;
}
/** A card's heading: 10 px caps, 1 px apart. */
export function Head({ children, color = C.gold }: { children: ReactNode; color?: string }) {
  return <Text style={{ color, fontSize: 10, lineHeight: 15, fontWeight: "900", letterSpacing: 1, marginBottom: 6 }}>{typeof children === "string" ? children.toUpperCase() : children}</Text>;
}

/** The kit shirt the website draws (Investments.tsx KitSwatch), same shape. */
const SLEEVE_L = "M8 6 L1 15 L7 20 L11 13 Z", SLEEVE_R = "M32 6 L39 15 L33 20 L29 13 Z";
const BODY = "M11 7 Q20 12 29 7 L32 35 Q20 38.5 8 35 Z", COLLAR = "M15.5 5.5 Q20 9.5 24.5 5.5 L22.5 3 Q20 5.5 17.5 3 Z";
export function KitSwatch({ kit, size = 44 }: { kit: Kit; size?: number }) {
  return (
    <Canvas style={{ width: size, height: size }}>
      <Group transform={[{ scale: size / 40 }]}>
        <Path path={SLEEVE_L} color={kit.trim} />
        <Path path={SLEEVE_R} color={kit.trim} />
        <Path path={BODY} color={kit.shirt} />
        <Path path={BODY} color="rgba(0,0,0,0.35)" style="stroke" strokeWidth={0.6} />
        <Path path={COLLAR} color={kit.trim} />
      </Group>
    </Canvas>
  );
}

/** The quick colours offered for a kit (any other through "＋ Any"). */
export const KIT_COLOURS = [
  "#ffffff", "#111827", "#dc2626", "#b91c1c", "#7f1d1d", "#f97316", "#facc15", "#eab308",
  "#16a34a", "#065f46", "#0ea5e9", "#1d4ed8", "#1e3a8a", "#6cabdd", "#7c3aed", "#6b0f2b",
  "#ec4899", "#9ca3af", "#a16207", "#0f766e",
];
/** The kit colours: the swatches, and "＋ Any" for any colour (ui/ColourPicker.tsx), as the website's colour input. */
export function ColourRow({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return <ColourChoice value={value} onChange={onChange} swatches={KIT_COLOURS} />;
}

export const pctText = (p: number) => `${p.toFixed(p < 1 ? 3 : 1)}%`;
