/**
 * THE MATCH'S LOOK, from the packed app (the website's own screens): the
 * pieces the match, its feed and the trial share. Plain views and pictures
 * drawn ONCE (no per-frame React work, no blur):
 *   - PitchPage: the green mown page the match sits on (pitchLook.css --sk-page)
 *   - EnergyIcon: Low / Medium / High as the split ring and bolt (EnergyModeIcon.tsx)
 *   - GoalBoard / Caption: Mikey's pop-ups (MikeyPopup.tsx), a goal as a scoreboard
 *     with the scorer and assist, any other word as a TV caption
 *   - LiveCommentary: the compact strip over the pitch (CanvasMatch commentaryBox)
 *   - StaminaBox: the corner box (CanvasMatch B14), its bar moved on the UI thread
 */
import { useMemo } from "react";
import { View, Text, type ViewStyle } from "react-native";
import { Canvas, Picture, createPicture, Skia, ClipOp, StrokeJoin, StrokeCap, PaintStyle } from "@shopify/react-native-skia";
import Animated, { useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import type { EnergyMode } from "@/lib/star/energy";
import { popupTone, type PopupTone } from "@/lib/star/mikeyPopups";
import { labelInk } from "@/lib/star/kits";
import { FONT } from "../ui/look";

// ── The page ──

/** pitchLook.css --sk-stripes: 72 px bands, a light from the top, darker edges. Drawn once. */
export function PitchPage({ children, style }: { children?: React.ReactNode; style?: ViewStyle }) {
  return (
    <View style={[{ flex: 1, backgroundColor: "#2c8a4b" }, style]}>
      <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, overflow: "hidden" }}>
        {Array.from({ length: 16 }, (_, i) => (
          <View key={i} style={{ position: "absolute", left: 0, right: 0, top: i * 144 + 72, height: 72, backgroundColor: "#257a41" }} />
        ))}
        <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0,
          backgroundImage: "radial-gradient(130% 60% at 50% -6%, rgba(255,250,220,0.16) 0%, transparent 62%), radial-gradient(140% 90% at 50% 50%, transparent 55%, rgba(0,0,0,0.18) 100%)" } as ViewStyle} />
      </View>
      {children}
    </View>
  );
}

// ── Energy mode icons (EnergyModeIcon.tsx, the New palette) ──

const PALETTE: Record<EnergyMode, { main: string; light: string; glow: string }> = {
  low: { main: "#facc15", light: "#fef9c3", glow: "rgba(250,204,21,0.6)" },
  medium: { main: "#f97316", light: "#fed7aa", glow: "rgba(249,115,22,0.58)" },
  high: { main: "#ef4444", light: "#fca5a5", glow: "rgba(239,68,68,0.6)" },
};
const SPARKS: Record<EnergyMode, number[]> = { low: [180, 0], medium: [205, 155, 335, 25], high: [212, 180, 148, 328, 0, 32] };
const OUTLINE = "#0b0f14";
const BOLT = "M60 5 L83 5 L64 38 L79 38 L34 96 L45 56 L27 56 Z";
const BOLT_LIT = "M60 5 L83 5 L64 38 L52 50 L45 56 L27 56 Z";
/** Grey it down (the website's grayscale(.45) brightness(.8) for the modes not in play). */
function dim(hex: string, on: boolean): string {
  if (on) return hex;
  const n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const y = 0.3 * r + 0.59 * g + 0.11 * b;
  const m = (v: number) => Math.round((v + (y - v) * 0.45) * 0.8);
  return `rgb(${m(r)},${m(g)},${m(b)})`;
}
const iconPics = new Map<string, ReturnType<typeof createPicture>>();
function energyIconPicture(mode: EnergyMode, on: boolean, size: number) {
  const key = `${mode}|${on}|${size}`;
  let pic = iconPics.get(key);
  if (pic) return pic;
  const c = PALETTE[mode];
  const main = dim(c.main, on), light = dim(c.light, on);
  pic = createPicture((cv) => {
    cv.scale(size / 100, size / 100);
    const bolt = Skia.Path.MakeFromSVGString(BOLT)!;
    const paint = (color: string, stroke = 0) => {
      const p = Skia.Paint(); p.setAntiAlias(true); p.setColor(Skia.Color(color));
      if (stroke) { p.setStyle(PaintStyle.Stroke); p.setStrokeWidth(stroke); p.setStrokeJoin(StrokeJoin.Round); }
      return p;
    };
    // The split ring, cut where the bolt passes through it.
    cv.save();
    const cut = Skia.Path.Stroke(bolt, { width: 13, join: StrokeJoin.Round });
    if (cut) cv.clipPath(cut, ClipOp.Difference, true);
    cv.clipPath(bolt, ClipOp.Difference, true);
    cv.drawCircle(50, 50, 40, paint(OUTLINE, 17));
    const ring = paint(main, 10);
    ring.setShader(Skia.Shader.MakeLinearGradient({ x: 0, y: 0 }, { x: 100, y: 100 }, [Skia.Color(light), Skia.Color(main)], [0, 0.55], 0));
    cv.drawCircle(50, 50, 40, ring);
    cv.restore();
    // The dark centre.
    const disc = paint("#0f172a");
    disc.setShader(Skia.Shader.MakeRadialGradient({ x: 40, y: 35 }, 70, [Skia.Color(on ? "#334155" : "#2b3440"), Skia.Color("#0f172a")], [0, 1], 0));
    cv.drawCircle(50, 50, 31, disc);
    cv.drawCircle(50, 50, 31, paint(OUTLINE, 3));
    // The sparks: 2, 4 or 6.
    for (const deg of SPARKS[mode]) {
      const a = (deg * Math.PI) / 180, r = 26;
      const cx = 50 + Math.cos(a) * r, cy = 50 + Math.sin(a) * r;
      const px = -Math.sin(a) * 4.6, py = Math.cos(a) * 4.6;
      const b = Skia.PathBuilder.Make();
      b.moveTo(50 + Math.cos(a) * (r - 9), 50 + Math.sin(a) * (r - 9)); b.lineTo(cx + px, cy + py); b.lineTo(cx - px, cy - py); b.close();
      const sp = b.build();
      cv.drawPath(sp, paint(light));
      cv.drawPath(sp, paint(OUTLINE, 2));
    }
    // The bolt: dark edge, colour, a lit facet.
    cv.drawPath(bolt, paint(OUTLINE, 5));
    cv.drawPath(bolt, paint(main));
    const lit = paint(light); lit.setAlphaf(0.85);
    cv.drawPath(Skia.Path.MakeFromSVGString(BOLT_LIT)!, lit);
    cv.drawPath(bolt, paint(OUTLINE, 2.5));
  }, { width: size, height: size });
  iconPics.set(key, pic);
  return pic;
}
export function EnergyIcon({ mode, active, size = 46 }: { mode: EnergyMode; active: boolean; size?: number }) {
  const pic = useMemo(() => energyIconPicture(mode, active, size), [mode, active, size]);
  return (
    <View style={{ width: size, height: size, opacity: active ? 1 : 0.75, borderRadius: size / 2, boxShadow: active ? `0px 0px 10px ${PALETTE[mode].glow}` : undefined } as ViewStyle}>
      <Canvas style={{ width: size, height: size }}><Picture picture={pic} /></Canvas>
    </View>
  );
}

// ── Mikey's pop-ups (MikeyPopup.tsx), still: no roll, no shine ──

export interface BoardTeam { name: string; shirt: string; trim: string }
function TeamBlock({ t, right }: { t: BoardTeam; right?: boolean }) {
  return (
    <View style={{ flex: 1, minWidth: 0, height: 34, backgroundColor: "#0d1526", flexDirection: right ? "row-reverse" : "row", alignItems: "center", overflow: "hidden" }}>
      <View style={{ width: 7, alignSelf: "stretch", backgroundColor: t.shirt, boxShadow: `inset ${right ? 2 : -2}px 0px 0px ${t.trim}` } as ViewStyle} />
      <Text numberOfLines={1} style={{ flex: 1, paddingHorizontal: 8, fontFamily: FONT.display, fontSize: 15, letterSpacing: 0.6, color: "#f8fafc", textAlign: right ? "right" : "left", textTransform: "uppercase" }}>{t.name}</Text>
    </View>
  );
}
export function GoalBoard({ home, away, score, scorer, assist, theirs }: {
  home: BoardTeam; away: BoardTeam; score: [number, number]; scorer?: string; assist?: string; theirs?: boolean;
}) {
  const digit = { fontFamily: FONT.display, fontSize: 22, lineHeight: 34, height: 34, width: 26, textAlign: "center" as const, color: "#0b1020" };
  const lines = [scorer ? { k: "GOAL", v: scorer } : null, assist ? { k: "ASSIST", v: assist } : null].filter((x): x is { k: string; v: string } => !!x);
  return (
    <View style={{ width: "92%", maxWidth: 420, alignSelf: "center", boxShadow: "0px 6px 14px rgba(0,0,0,0.6)" } as ViewStyle}>
      <View style={{ alignItems: "center" }}>
        <View style={{ paddingHorizontal: 14, paddingVertical: 1, backgroundImage: "linear-gradient(90deg, #ffd23a, #ffb000)" } as ViewStyle}>
          <Text style={{ fontFamily: FONT.display, fontSize: 12, letterSpacing: 3.6, color: "#0b1020" }}>{theirs ? "THEIR GOAL" : "GOAL"}</Text>
        </View>
      </View>
      <View style={{ flexDirection: "row", alignItems: "stretch", borderTopWidth: 2, borderColor: "#ffc21a", overflow: "hidden" }}>
        <TeamBlock t={home} />
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 3, backgroundImage: "linear-gradient(180deg, #ffffff, #dfe5ee)" } as ViewStyle}>
          <Text style={digit}>{score[0]}</Text>
          <Text style={{ fontFamily: FONT.display, fontSize: 18, color: "#0b1020", width: 10, textAlign: "center" }}>–</Text>
          <Text style={digit}>{score[1]}</Text>
        </View>
        <TeamBlock t={away} right />
      </View>
      {lines.length > 0 && (
        <View style={{ marginHorizontal: "6%", flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 12, paddingHorizontal: 12, paddingVertical: 4, backgroundColor: "rgba(8,13,26,0.92)", borderBottomWidth: 2, borderColor: "#ffc21a" }}>
          {lines.map((l) => (
            <View key={l.k} style={{ flexDirection: "row", alignItems: "center", gap: 6, minWidth: 0, flexShrink: 1 }}>
              <Text style={{ fontFamily: FONT.display, fontSize: 10, letterSpacing: 1.4, color: "#ffc21a" }}>{l.k}</Text>
              <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: FONT.display, fontSize: 14, letterSpacing: 0.4, color: "#fff", textTransform: "uppercase" }}>{l.v}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const TONE: Record<PopupTone, { tab: string; edge: string; mark: string }> = {
  good: { tab: "linear-gradient(180deg, #34f5c5, #0ea5a3)", edge: "#22d3c5", mark: "→" },
  bad: { tab: "linear-gradient(180deg, #ff6b6b, #d1142f)", edge: "#ff4d5e", mark: "✕" },
  save: { tab: "linear-gradient(180deg, #ffcf4a, #f08a00)", edge: "#ffb020", mark: "✋" },
  ref: { tab: "linear-gradient(180deg, #fff06a, #e6c200)", edge: "#ffe14a", mark: "!" },
  plain: { tab: "linear-gradient(180deg, #cbd5e1, #64748b)", edge: "#94a3b8", mark: "!" },
  goal: { tab: "linear-gradient(180deg, #ffe066, #ff9d00)", edge: "#ffc21a", mark: "⚽" },
};
/** A TV caption: a coloured tab with its mark, then the word on a dark strip with a coloured underline. */
export function Caption({ text }: { text: string }) {
  const c = TONE[popupTone(text)];
  return (
    <View style={{ flexDirection: "row", alignSelf: "center", boxShadow: "0px 5px 12px rgba(0,0,0,0.6)" } as ViewStyle}>
      <View style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center", backgroundImage: c.tab } as ViewStyle}>
        <Text style={{ fontSize: 18, fontWeight: "900", color: "#0b1020" }}>{c.mark}</Text>
      </View>
      <View style={{ height: 40, justifyContent: "center", paddingLeft: 12, paddingRight: 18, backgroundImage: "linear-gradient(180deg, rgba(14,22,40,0.96), rgba(6,10,20,0.96))", boxShadow: `inset 0px -3px 0px ${c.edge}` } as ViewStyle}>
        <Text style={{ fontFamily: FONT.display, fontSize: 24, letterSpacing: 1.9, color: "#fff", textTransform: "uppercase" }}>{text}</Text>
      </View>
    </View>
  );
}

// ── The commentary on the pitch (CanvasMatch commentaryBox, overlay form) ──

export function LiveCommentary({ lines }: { lines: string[] }) {
  return (
    <View style={{ borderRadius: 8, backgroundColor: "rgba(3,7,18,0.6)", paddingHorizontal: 10, paddingVertical: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 }}>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#ef4444" }} />
        <Text style={{ fontSize: 8, fontWeight: "900", letterSpacing: 1.8, color: "rgba(255,255,255,0.7)" }}>LIVE COMMENTARY</Text>
      </View>
      {lines.length === 0 && <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", fontStyle: "italic" }}>Kick-off…</Text>}
      {lines.map((l, i) => {
        const last = i === lines.length - 1;
        return (
          <Text key={i} style={{ fontSize: 11, lineHeight: 15, paddingLeft: 8, borderLeftWidth: 2, borderColor: last ? "rgba(16,185,129,0.8)" : "transparent", color: last ? "#fff" : "rgba(255,255,255,0.7)", fontWeight: last ? "700" : "400" }}>{l}</Text>
        );
      })}
    </View>
  );
}

// ── The stamina box (CanvasMatch B14: 124 px, black/60, STAMINA, the bar) ──

export function StaminaBox({ fill, cap, label }: { fill: SharedValue<number>; cap: number; label?: string }) {
  const bar = useAnimatedStyle(() => {
    const v = Math.max(0, Math.min(1, fill.value));
    return { width: `${v * 100}%`, backgroundColor: v < 0.25 ? "#ef4444" : v < 0.5 ? "#fbbf24" : "#34d399" };
  });
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 8, bottom: 8, width: 124, borderRadius: 6, backgroundColor: "rgba(0,0,0,0.6)", paddingHorizontal: 6, paddingVertical: 4 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ fontSize: 9, fontWeight: "900", letterSpacing: 0.9, color: "#fff" }}>STAMINA</Text>
        {label ? <Text style={{ fontSize: 9, fontWeight: "900", letterSpacing: 0.9, color: label === "SPRINT" ? "#fcd34d" : "rgba(255,255,255,0.8)" }}>{label}</Text> : null}
      </View>
      <View style={{ marginTop: 4, height: 8, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.15)", overflow: "hidden" }}>
        <View style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: `${(1 - cap) * 100}%`, backgroundColor: "rgba(0,0,0,0.55)" }} />
        <Animated.View style={[{ position: "absolute", left: 0, top: 0, bottom: 0 }, bar]} />
      </View>
    </View>
  );
}

/** A kit colour's row in the feed: the shirt at 90%, ink picked for it (MatchCommentary Line). */
export function kitRow(shirt: string): { backgroundColor: string; color: string } {
  return { backgroundColor: `${shirt}E6`, color: labelInk(shirt) };
}

// ── Small line icons for the plate (CanvasMatch's speaker; a gear), drawn once ──

const LINE_ICONS: Record<"sound" | "muted" | "gear", string[]> = {
  sound: ["M11 5 6 9H3v6h3l5 4V5Z", "M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"],
  muted: ["M11 5 6 9H3v6h3l5 4V5Z", "m17 9 6 6M23 9l-6 6"],
  gear: [
    "M12 8.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7Z",
    "M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7",
    "M12 5.2a6.8 6.8 0 1 0 0 13.6a6.8 6.8 0 1 0 0-13.6Z",
  ],
};
const lineIconPics = new Map<string, ReturnType<typeof createPicture>>();
export function LineIcon({ kind, size = 14, color = "rgba(255,255,255,0.8)" }: { kind: keyof typeof LINE_ICONS; size?: number; color?: string }) {
  const key = `${kind}|${size}|${color}`;
  let pic = lineIconPics.get(key);
  if (!pic) {
    pic = createPicture((cv) => {
      cv.scale(size / 24, size / 24);
      const p = Skia.Paint(); p.setAntiAlias(true); p.setColor(Skia.Color(color));
      p.setStyle(PaintStyle.Stroke); p.setStrokeWidth(2.4); p.setStrokeJoin(StrokeJoin.Round); p.setStrokeCap(StrokeCap.Round);
      for (const d of LINE_ICONS[kind]) { const path = Skia.Path.MakeFromSVGString(d); if (path) cv.drawPath(path, p); }
    }, { width: size, height: size });
    lineIconPics.set(key, pic);
  }
  return <Canvas style={{ width: size, height: size }}><Picture picture={pic} /></Canvas>;
}
