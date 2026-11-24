/**
 * THE LIVE MATCH RADAR (the website's components/star/MatchRadar.tsx `LiveRadar`, Settings → Match radar: New).
 *
 * While the commentary runs between your chances, a small pitch at the top of it shows the unseen match live: the area the ball
 * is in lit in the colours of the side that has it, a trail of the last minutes, the ball gliding from area to area, a flash for
 * a shot, a corner, a goal and your own chance, and the momentum a minute at a time with each side's share of the ball. It draws
 * what the unseen match knows and nothing it does not: the minutes come from the driver's `radarTrace` (hiddenMatch.ts writes
 * one per minute; read only, no random number), the clock is the match's own. There is no loop of its own: it moves when the
 * clock moves (one picture per simulated minute, an Animated glide for the ball).
 *
 * Off by default, as on the website (the row is "Match radar (testing)", default Old). The website draws it in SVG; here the
 * pitch and the momentum bars are Skia pictures (the app has no SVG), the ball and the flash words are plain views.
 */
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Text, View, type LayoutChangeEvent } from "react-native";
import { Canvas, Picture, Skia, PaintStyle, createPicture } from "@shopify/react-native-skia";
import { attackLabel, hadBall } from "@/lib/star/matchRadar";
import type { Zone, Lane, RadarTick, Side } from "@/lib/star/hiddenMatch";
import { CLUB_SHORT_NAMES } from "@/lib/star/clubs";
import { kitLabelOnDark, type MatchKits } from "@/lib/star/kits";
import type { MatchDriver } from "../match/driver";

// Pitch geometry in real metres, left (your goal) to right (theirs) — the website's numbers.
const PITCH_L = 105, PITCH_W = 68;
const LW = 300, LH = 150, LP = 4;
const lx = (m: number) => LP + (m / PITCH_L) * (LW - LP * 2);
const ly = (m: number) => LP + (m / PITCH_W) * (LH - LP * 2);
const ZONE_X: Record<Zone, [number, number]> = { own_box: [0, 16.5], defensive: [16.5, 35], middle: [35, 70], attacking: [70, 88.5], box: [88.5, 105] };
const LANE_Y: Record<Lane, [number, number]> = { left: [0, 21], centre: [21, 47], right: [47, 68] };

/** A club's name short enough for the live radar's corner labels (CanvasMatch radarShort). */
export const radarShort = (club: string) => {
  const n = CLUB_SHORT_NAMES[club] ?? club.replace(/\s+(FC|AFC)$/i, "");
  return n.length > 12 ? n.slice(0, 11) + "…" : n;
};

/** Seeded wobble inside an area, so the dot isn't pinned to one spot (the website's jitter, unsigned). */
function jitter(minute: number, salt: number): number {
  let h = (minute * 2654435761 + salt * 40503) >>> 0;
  h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995) >>> 0;
  h = (h ^ (h >>> 15)) >>> 0;
  return (h % 1000) / 1000 - 0.5;
}
export function liveBallAt(t: Pick<RadarTick, "zone" | "lane" | "minute">): { x: number; y: number } {
  const [x0, x1] = ZONE_X[t.zone], [y0, y1] = LANE_Y[t.lane];
  return { x: lx((x0 + x1) / 2 + jitter(t.minute, 1) * (x1 - x0) * 0.5), y: ly((y0 + y1) / 2 + jitter(t.minute, 2) * (y1 - y0) * 0.5) };
}
/** The minute to draw: the newest one the clock has reached. */
export function liveTickAt(trace: ReadonlyMap<number, RadarTick>, minute: number): RadarTick | null {
  for (let m = Math.floor(minute); m >= 0; m--) { const t = trace.get(m); if (t) return t; }
  return null;
}

const paint = (color: string, style: "fill" | "stroke" = "fill", w = 1, opacity = 1) => {
  const p = Skia.Paint(); p.setAntiAlias(true); p.setColor(Skia.Color(color)); p.setAlphaf(opacity);
  p.setStyle(style === "fill" ? PaintStyle.Fill : PaintStyle.Stroke); p.setStrokeWidth(w);
  return p;
};

/** The pitch of the radar (300 x 150 units), drawn once per minute. */
function pitchPicture(t: RadarTick | null, ticks: RadarTick[], col: string, k: number, flashGoal: string | null) {
  return createPicture((c) => {
    c.scale(k, k);
    c.drawRect(Skia.XYWHRect(0, 0, LW, LH), paint("#155e2f"));
    for (let i = 0; i < 10; i++) c.drawRect(Skia.XYWHRect(LP + (i * (LW - LP * 2)) / 10, LP, (LW - LP * 2) / 10, LH - LP * 2), paint(i % 2 === 0 ? "#1f7a3c" : "#1b6f36"));
    if (t) {
      const [z0, z1] = ZONE_X[t.zone], [l0, l1] = LANE_Y[t.lane];
      c.drawRect(Skia.XYWHRect(lx(z0), ly(l0), lx(z1) - lx(z0), ly(l1) - ly(l0)), paint(col, "fill", 1, 0.24));
    }
    // markings (LiveMarkings)
    const L = paint("#ffffff", "stroke", 1, 0.5);
    const box = (x0: number, x1: number, y0: number, y1: number) => c.drawRect(Skia.XYWHRect(lx(Math.min(x0, x1)), ly(y0), Math.abs(lx(x1) - lx(x0)), ly(y1) - ly(y0)), L);
    c.drawRect(Skia.XYWHRect(lx(0), ly(0), lx(PITCH_L) - lx(0), ly(PITCH_W) - ly(0)), paint("#ffffff", "stroke", 1.2, 0.5));
    c.drawLine(lx(52.5), ly(0), lx(52.5), ly(PITCH_W), L);
    c.drawOval(Skia.XYWHRect(lx(52.5) - (lx(9.15) - lx(0)), ly(34) - (ly(9.15) - ly(0)), 2 * (lx(9.15) - lx(0)), 2 * (ly(9.15) - ly(0))), L);
    box(0, 16.5, 13.85, 54.15); box(105, 88.5, 13.85, 54.15); box(0, 5.5, 24.85, 43.15); box(105, 99.5, 24.85, 43.15);
    const post = paint("#ffffff", "fill", 1, 0.85);
    c.drawRect(Skia.XYWHRect(lx(0) - 3, ly(30.34), 3, ly(37.66) - ly(30.34)), post);
    c.drawRect(Skia.XYWHRect(lx(105), ly(30.34), 3, ly(37.66) - ly(30.34)), post);
    if (flashGoal) c.drawRect(Skia.XYWHRect(0, 0, LW, LH), paint(flashGoal, "fill", 1, 0.35));
    // the last five minutes' trail
    ticks.slice(-6, -1).map(liveBallAt).forEach((p, i) => c.drawCircle(p.x, p.y, 1.8 + i * 0.3, paint(col, "fill", 1, 0.15 + i * 0.08)));
  }, { width: LW * k, height: LH * k });
}

/** The momentum, a bar a minute: up in your colour, down in theirs; a dot for each goal. */
function momentumPicture(ticks: RadarTick[], us: string, them: string, fullTime: number, w: number, h: number) {
  const sx = w / LW, sy = h / 22;
  const bw = (LW - 8) / fullTime;
  return createPicture((c) => {
    c.scale(sx, sy);
    c.drawLine(4, 11, LW - 4, 11, paint("#ffffff", "stroke", 1, 0.15));
    c.drawLine(4 + 45 * bw, 1, 4 + 45 * bw, 21, paint("#ffffff", "stroke", 1, 0.15));
    for (const k of ticks) {
      const hh = Math.max(0.8, Math.min(10, Math.abs(k.momentum) * 30));
      c.drawRect(Skia.XYWHRect(4 + (Math.min(fullTime, k.minute) - 1) * bw, k.momentum >= 0 ? 11 - hh : 11, Math.max(0.8, bw - 0.6), hh), paint(k.momentum >= 0 ? us : them));
    }
    for (const k of ticks) if (k.goal) c.drawCircle(4 + (Math.min(fullTime, k.minute) - 0.5) * bw, k.goal === "user" ? 2.5 : 19.5, 2.2, paint("#ffffff"));
  }, { width: w, height: h });
}

export interface LiveRadarProps {
  trace: ReadonlyMap<number, RadarTick>;
  /** The match clock (what the commentary has reached). */
  minute: number;
  us: { short: string; colour: string };
  them: { short: string; colour: string };
  /** How long a minute of the clock lasts now, for the ball's glide. */
  stepMs: number;
  fullTime?: number;
  onHeight?: (h: number) => void;
}

export const LiveRadar = memo(function LiveRadar({ trace, minute, us, them, stepMs, fullTime = 90, onHeight }: LiveRadarProps) {
  const [w, setW] = useState(0);
  const [sw, setSw] = useState(0);
  const m = Math.floor(minute);
  const t = liveTickAt(trace, minute);
  const ticks: RadarTick[] = [];
  for (let i = 1; i <= m; i++) { const k = trace.get(i); if (k) ticks.push(k); }
  const ours = ticks.filter((k) => hadBall(k) === "user").length;
  const poss = ticks.length ? Math.round((ours / ticks.length) * 100) : 50;
  const side = (s: Side) => (s === "user" ? us : them);
  const col = t ? side(t.possession).colour : "#e5e7eb";
  const now = t && t.minute === m ? t : null;
  const flash = now?.goal ? "goal" : now?.yours ? "yours" : now?.shot ? "shot" : now?.corner ? "corner" : null;
  const flashSide = now ? (now.goal ?? now.shot ?? now.corner ?? "user") : "user";
  const k = w > 0 ? w / LW : 0;
  // one picture a minute (the clock moving), not one a frame
  const pic = useMemo(() => (k > 0 ? pitchPicture(t, ticks, col, k, flash === "goal" ? side(flashSide).colour : null) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [k, t?.minute, t?.zone, t?.lane, t?.possession, col, flash, flashSide, m]);
  const mom = useMemo(() => (sw > 0 ? momentumPicture(ticks, us.colour, them.colour, fullTime, sw, 20) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sw, m, us.colour, them.colour, fullTime]);

  // the ball glides to its spot; the flash words fade (RN Animated, native driver: nothing runs on the JS thread between minutes)
  const at = t ? liveBallAt(t) : { x: lx(52.5), y: ly(34) };
  const glide = Math.round(Math.max(120, stepMs * 0.8));
  const bx = useRef(new Animated.Value(at.x)).current, by = useRef(new Animated.Value(at.y)).current;
  useEffect(() => {
    const e = Easing.inOut(Easing.ease);
    Animated.parallel([
      Animated.timing(bx, { toValue: at.x, duration: glide, easing: e, useNativeDriver: true }),
      Animated.timing(by, { toValue: at.y, duration: glide, easing: e, useNativeDriver: true }),
    ]).start();
  }, [at.x, at.y, glide, bx, by]);
  const fade = useRef(new Animated.Value(0)).current;
  const flashKey = flash ? `${m}${flash}` : "";
  useEffect(() => {
    if (!flashKey) { fade.setValue(0); return; }
    fade.setValue(0);
    Animated.sequence([Animated.timing(fade, { toValue: 1, duration: 240, useNativeDriver: true }), Animated.delay(1000), Animated.timing(fade, { toValue: 0, duration: 360, useNativeDriver: true })]).start();
  }, [flashKey, fade]);
  const label = flash === "goal" ? "GOAL!" : flash === "yours" ? "YOUR CHANCE" : flash === "shot" ? "SHOT" : flash === "corner" ? "CORNER" : "";
  const labelCol = flash === "yours" ? "#fde047" : flash ? side(flashSide).colour : "#fff";
  const ring = flash === "shot" || flash === "goal" ? { x: (flashSide === "user" ? lx(PITCH_L) : lx(0)), y: ly(34), c: flash === "goal" ? "#fff" : side(flashSide).colour } : null;
  const dot = 11 * (k || 1);

  return (
    <View style={{ paddingHorizontal: 6, paddingTop: 6, paddingBottom: 4, backgroundColor: "#0a0f1a", borderBottomWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}
      onLayout={(e: LayoutChangeEvent) => onHeight?.(e.nativeEvent.layout.height)}>
      <View style={{ width: "100%", aspectRatio: LW / LH, borderRadius: 10, overflow: "hidden" }} onLayout={(e) => { const nw = e.nativeEvent.layout.width; if (Math.abs(nw - w) > 0.5) setW(nw); }}>
        {pic && <Canvas style={{ width: w, height: w / 2 }}><Picture picture={pic} /></Canvas>}
        {k > 0 && ring && (
          <Animated.View pointerEvents="none" style={{ position: "absolute", left: ring.x * k - 14 * k, top: ring.y * k - 14 * k, width: 28 * k, height: 28 * k, borderRadius: 14 * k, borderWidth: 2.4, borderColor: ring.c, opacity: fade }} />
        )}
        {k > 0 && (
          <Animated.View pointerEvents="none" style={{ position: "absolute", left: -dot / 2, top: -dot / 2, width: dot, height: dot, borderRadius: dot / 2, backgroundColor: col, alignItems: "center", justifyContent: "center",
            borderWidth: 1.5 * k, borderColor: "#0b1220", transform: [{ translateX: Animated.multiply(bx, k) }, { translateY: Animated.multiply(by, k) }] }}>
            <View style={{ width: dot * 0.42, height: dot * 0.42, borderRadius: dot * 0.21, backgroundColor: "#fff" }} />
            {flash === "yours" && <Animated.View style={{ position: "absolute", width: dot * 2.2, height: dot * 2.2, borderRadius: dot * 1.1, borderWidth: 2.4, borderColor: "#fde047", opacity: fade }} />}
          </Animated.View>
        )}
        {flash && (
          <Animated.View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: flash === "goal" ? "38%" : 10, alignItems: "center", opacity: fade }}>
            <Text numberOfLines={1} style={{ color: labelCol, fontSize: flash === "goal" ? 26 : 13, fontWeight: "900", letterSpacing: 1, textShadowColor: "#0b1220", textShadowRadius: 4, textShadowOffset: { width: 0, height: 0 } }}>{label}</Text>
          </Animated.View>
        )}
        <Text numberOfLines={1} style={{ position: "absolute", left: (LP + 4) * (k || 1), bottom: (LP + 2) * (k || 1), color: "rgba(255,255,255,0.7)", fontSize: 9, fontWeight: "800" }}>{attackLabel(us.short, "user")}</Text>
        <Text numberOfLines={1} style={{ position: "absolute", right: (LP + 4) * (k || 1), bottom: (LP + 2) * (k || 1), color: "rgba(255,255,255,0.7)", fontSize: 9, fontWeight: "800" }}>{attackLabel(them.short, "opponent")}</Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
        <Text style={{ width: 30, color: us.colour, fontSize: 10, fontWeight: "900", fontVariant: ["tabular-nums"] }}>{poss}%</Text>
        <View style={{ flex: 1, height: 20 }} onLayout={(e) => { const nw = e.nativeEvent.layout.width; if (Math.abs(nw - sw) > 0.5) setSw(nw); }}>
          {mom && <Canvas style={{ width: sw, height: 20 }}><Picture picture={mom} /></Canvas>}
        </View>
        <Text style={{ width: 30, textAlign: "right", color: them.colour, fontSize: 10, fontWeight: "900", fontVariant: ["tabular-nums"] }}>{100 - poss}%</Text>
      </View>
    </View>
  );
});

/** The radar over the commentary, fed by the match: the driver's trace, the clock, both clubs' kit colours. */
export function MatchRadarFeed({ d, kits, onHeight }: { d: MatchDriver; kits: MatchKits; onHeight?: (h: number) => void }) {
  const home = d.setup.fixture.home !== false;
  const ours = home ? kits.home : kits.away, theirs = home ? kits.away : kits.home;
  const us = useMemo(() => ({ short: radarShort(d.setup.career.player.club), colour: kitLabelOnDark(ours.shirt, ours.trim) }), [d, ours.shirt, ours.trim]);
  const them = useMemo(() => ({ short: radarShort(d.setup.fixture.opponent), colour: kitLabelOnDark(theirs.shirt, theirs.trim) }), [d, theirs.shirt, theirs.trim]);
  return <LiveRadar trace={d.radarTrace} minute={d.matchMinute} stepMs={Math.round(700 / Math.max(1, d.speed))} fullTime={d.MATCH_DURATION} us={us} them={them} onHeight={onHeight} />;
}
