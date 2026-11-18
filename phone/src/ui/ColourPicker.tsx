/**
 * ANY COLOUR, ON A PHONE (the website's <input type="color">).
 *
 * <ColourChoice value onChange swatches disabled? />: the quick swatches in a
 * row, then a "＋" chip that opens two bars under them: the HUE (the
 * rainbow) and the SHADE (dark, the colour itself, light). Drag or tap either;
 * the colour is set as you move. A colour from anywhere else (a save, a club's
 * real kit) shows first in the row, ringed.
 *
 * The bars are drawn once as pictures (draw/useDrawing.tsx); only the two
 * small markers move.
 */
import { useCallback, useMemo, useState } from "react";
import { View, Text, ScrollView, type GestureResponderEvent } from "react-native";
import { Drawn } from "../draw/useDrawing";
import { parseColor } from "../draw/css";
import { Press } from "./Press";
import { C } from "./theme";

const hex2 = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, "0");
/** A colour from its hue (0..360) and shade (0 black, 0.5 the full colour, 1 white). */
export function hueShadeToHex(h: number, l: number): string {
  const s = 1;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t: number) => {
    t = ((t % 1) + 1) % 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const hh = h / 360;
  return `#${hex2(f(hh + 1 / 3))}${hex2(f(hh))}${hex2(f(hh - 1 / 3))}`;
}
/** The nearest hue and shade for a colour (to start the bars where it is). */
export function hexToHueShade(c: string): { h: number; l: number } {
  const rgba = parseColor(c) ?? [1, 0, 0, 1];
  const [r, g, b] = rgba;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  return { h, l };
}

const BAR_H = 28;

function Bar({ width, paint, at, onPick }: { width: number; paint: (g: CanvasRenderingContext2D) => void; at: number; onPick: (k: number) => void }) {
  const pick = (e: GestureResponderEvent) => onPick(Math.max(0, Math.min(1, e.nativeEvent.locationX / width)));
  return (
    <View style={{ width, height: BAR_H, borderRadius: 8, overflow: "hidden" }}
      onStartShouldSetResponder={() => true} onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={pick} onResponderMove={pick}>
      <View pointerEvents="none"><Drawn width={width} height={BAR_H} draw={paint} /></View>
      <View pointerEvents="none" style={{ position: "absolute", top: 0, bottom: 0, left: at * width - 3, width: 6, borderRadius: 3, borderWidth: 2, borderColor: "#fff", backgroundColor: "rgba(0,0,0,0.25)" }} />
    </View>
  );
}

/** The hue and shade bars for one colour. */
export function HueShadePicker({ value, onChange, width = 260 }: { value: string; onChange: (c: string) => void; width?: number }) {
  const start = useMemo(() => hexToHueShade(value), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [h, setH] = useState(start.h);
  const [l, setL] = useState(start.l);
  const hueBar = useCallback((g: CanvasRenderingContext2D) => {
    const gr = g.createLinearGradient(0, 0, width, 0);
    for (let i = 0; i <= 6; i++) gr.addColorStop(i / 6, hueShadeToHex(i * 60, 0.5));
    g.fillStyle = gr; g.fillRect(0, 0, width, BAR_H);
  }, [width]);
  const shadeBar = useCallback((g: CanvasRenderingContext2D) => {
    const gr = g.createLinearGradient(0, 0, width, 0);
    gr.addColorStop(0, "#000000"); gr.addColorStop(0.5, hueShadeToHex(h, 0.5)); gr.addColorStop(1, "#ffffff");
    g.fillStyle = gr; g.fillRect(0, 0, width, BAR_H);
  }, [width, h]);
  return (
    <View style={{ gap: 8, paddingVertical: 4 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: value, borderWidth: 2, borderColor: "rgba(255,255,255,0.6)" }} />
        <Text style={{ color: C.dim, fontSize: 12, fontWeight: "800" }}>{value.toUpperCase()}</Text>
      </View>
      <Text style={{ color: C.dim, fontSize: 10, fontWeight: "900", letterSpacing: 1.5 }}>COLOUR</Text>
      <Bar width={width} paint={hueBar} at={h / 360} onPick={(k) => { const nh = k * 360; setH(nh); onChange(hueShadeToHex(nh, l)); }} />
      <Text style={{ color: C.dim, fontSize: 10, fontWeight: "900", letterSpacing: 1.5 }}>SHADE</Text>
      <Bar width={width} paint={shadeBar} at={l} onPick={(k) => { setL(k); onChange(hueShadeToHex(h, k)); }} />
    </View>
  );
}

/** Swatches, then "＋" for any colour (the bars open underneath). */
export function ColourChoice({ value, onChange, swatches, disabled }: { value: string; onChange: (c: string) => void; swatches: string[]; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [w, setW] = useState(0);
  const list = swatches.includes(value.toLowerCase()) ? swatches : [value, ...swatches];
  return (
    <View style={{ opacity: disabled ? 0.4 : 1 }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 4 }}>
        {list.map((c) => {
          const on = c.toLowerCase() === value.toLowerCase();
          return <Press key={c} disabled={disabled} onPress={() => onChange(c)} style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: c, borderWidth: on ? 3 : 1, borderColor: on ? C.gold : "rgba(255,255,255,0.3)" }}>{null}</Press>;
        })}
        <Press disabled={disabled} onPress={() => setOpen((o) => !o)}
          style={{ height: 26, paddingHorizontal: 10, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: open ? C.gold : "rgba(255,255,255,0.12)" }}>
          <Text style={{ color: open ? "#111" : C.text, fontWeight: "900", fontSize: 12 }}>{open ? "Done" : "＋ Any"}</Text>
        </Press>
      </ScrollView>
      {open && !disabled && w > 0 && <HueShadePicker value={value} onChange={onChange} width={Math.min(w, 340)} />}
    </View>
  );
}
