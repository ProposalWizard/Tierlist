/**
 * Small parts for the Ownership, Investments, Rule Book and vote screens: a
 * money box (typed with thousands commas, like the website's text+numeric
 * inputs), a pick-one list (the website's <select>), a red message line, a
 * colour row (the website's colour inputs: swatches and any colour) and the kit shirt.
 */
import { useState, type ReactNode } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import { Canvas, Group, Path } from "@shopify/react-native-skia";
import type { Kit } from "@/lib/star/kits";
import { Press } from "../../ui/Press";
import { C } from "../../world/lookKit";
import { ColourChoice } from "../../ui/ColourPicker";

/** A money/number box: shows 1,000,000 and keeps only the digits. */
export function NumBox({ value, onChange, placeholder, prefix = "★" }: { value: number | null; onChange: (n: number | null) => void; placeholder?: string; prefix?: string }) {
  return (
    <View style={{ flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: C.panel2, borderRadius: 10, paddingHorizontal: 10 }}>
      {prefix ? <Text style={{ color: C.gold, fontWeight: "900" }}>{prefix}</Text> : null}
      <TextInput
        value={value === null ? "" : value.toLocaleString("en-GB")}
        placeholder={placeholder}
        placeholderTextColor={C.dim}
        keyboardType="number-pad"
        selectTextOnFocus
        onChangeText={(t) => { const d = t.replace(/[^\d]/g, ""); onChange(d ? Number(d) : null); }}
        style={{ flex: 1, color: C.text, fontWeight: "800", fontSize: 15, paddingVertical: 8, marginLeft: prefix ? 4 : 0 }}
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

/** A small button (the website's kit-btn pills). */
export function SmallBtn({ label, onPress, tone = "plain", disabled, flex = true }: { label: string; onPress: () => void; tone?: "green" | "red" | "blue" | "gold" | "plain" | "purple"; disabled?: boolean; flex?: boolean }) {
  const bg = { green: "#10b981", red: "#b91c1c", blue: "#2563eb", gold: C.gold, plain: C.panel2, purple: "#7c3aed" }[tone];
  const ink = tone === "green" || tone === "gold" ? "#05261a" : "#fff";
  return (
    <Press disabled={disabled} onPress={onPress} style={{ flex: flex ? 1 : undefined, backgroundColor: bg, opacity: disabled ? 0.4 : 1, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 10, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: ink, fontWeight: "900", fontSize: 12, textAlign: "center" }}>{label}</Text>
    </Press>
  );
}

export function Line({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>{children}</View>;
}
export function Small({ children, color = C.dim }: { children: ReactNode; color?: string }) {
  return <Text style={{ color, fontSize: 11, fontWeight: "700" }}>{children}</Text>;
}
export function Head({ children, color = C.gold }: { children: ReactNode; color?: string }) {
  return <Text style={{ color, fontSize: 11, fontWeight: "900", letterSpacing: 1.5, marginBottom: 6 }}>{typeof children === "string" ? children.toUpperCase() : children}</Text>;
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
