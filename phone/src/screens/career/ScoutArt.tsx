/**
 * THE SCOUT, AND THE NIGHT HE SAW YOU (the website's components/star/ScoutArt.tsx).
 * The floodlit stand (public/home/tall-night.webp, copied to assets/look/bg)
 * behind a dark fade, and the drawn scout in a long coat and flat cap with his
 * notebook: the same paths, drawn once with Skia.
 *
 * Also: the signing moment (SigningMoment), drawn in 2D in the packed app's
 * look in place of the website's 3D office cut scene (Mikey chose which 3D the
 * phone gets: not that one). The manager across the desk, his lines one tap at
 * a time, the pen, then "WELCOME TO <CLUB>".
 */
import { useMemo } from "react";
import { Image, View, type ViewStyle } from "react-native";
import { Canvas, Circle, Group, LinearGradient, Oval, Path, RoundedRect, Skia, vec } from "@shopify/react-native-skia";
import { luminance, tint } from "@/lib/star/heroFigure";
import { kitsOf } from "@/lib/star/kits";
import { rgba } from "../../ui/look";
import { useRiskyPart } from "../../safety";

const NIGHT = require("../../../assets/look/bg/tall-night.webp");

/** The club's light colour (components/star/ui/theme.ts glowOf). */
export function clubGlow(club: string): string {
  const kit = kitsOf(club).home;
  const base = luminance(kit.shirt) > 0.85 ? kit.trim : kit.shirt;
  return luminance(base) < 0.12 ? tint(base, 0.35) : base;
}

/** The floodlit stand behind the whole screen, faded to dark at the bottom. */
export function ScoutBackdrop({ glow = "#10b981" }: { glow?: string }) {
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, overflow: "hidden", backgroundColor: "#05070d" }}>
      <Image source={NIGHT} resizeMode="cover" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, width: "100%", height: "100%" }} />
      <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0,
        backgroundImage: `radial-gradient(90% 55% at 50% 30%, ${rgba(glow, 0.33)} 0%, transparent 65%), linear-gradient(180deg, rgba(5,7,13,0.35) 0%, rgba(5,7,13,0.55) 40%, rgba(5,7,13,0.93) 72%, #05070d 100%)` } as ViewStyle} />
    </View>
  );
}

const P = (d: string) => Skia.Path.MakeFromSVGString(d)!;

/** A scout in a long coat and flat cap, writing in his notebook (viewBox 120 × 140). */
export function ScoutFigure({ width, height, coat = "#1f2937" }: { width: number; height: number; coat?: string }) {
  const ok = useRiskyPart("player-drawing", { settleMs: 3000 });
  const paths = useMemo(() => ({
    coat: P("M36 52 Q60 42 84 52 L92 112 Q60 120 28 112 Z"),
    seam: P("M60 50 L60 114"),
    scarf: P("M46 50 Q60 58 74 50 L72 56 Q60 63 48 56 Z"),
    cap: P("M45 30 Q60 15 75 29 L78 32 Q60 27 44 32 Z"),
    armR: P("M78 60 Q90 76 74 84"),
    armL: P("M42 60 Q32 78 50 84"),
    lines: P("M54 79 h13 M54 83 h10 M54 87 h12"),
    pencil: P("M72 70 L80 82"),
  }), []);
  if (!ok) return <View style={{ width, height }} />;
  const s = Math.min(width / 120, height / 140);
  const pad = { x: (width - 120 * s) / 2, y: (height - 140 * s) / 2 };
  return (
    <Canvas style={{ width, height }}>
      <Group transform={[{ translateX: pad.x }, { translateY: pad.y }, { scale: s }]}>
        <Oval x={26} y={129} width={68} height={10} color="rgba(0,0,0,0.45)" />
        <RoundedRect x={47} y={104} width={10} height={28} r={3} color="#111827" />
        <RoundedRect x={63} y={104} width={10} height={28} r={3} color="#111827" />
        <Path path={paths.coat}><LinearGradient start={vec(0, 45)} end={vec(0, 118)} colors={[coat, "#0b1020"]} /></Path>
        <Path path={paths.coat} style="stroke" strokeWidth={1.5} color="rgba(0,0,0,0.35)" />
        <Path path={paths.seam} style="stroke" strokeWidth={1.5} color="rgba(0,0,0,0.3)" />
        <Path path={paths.scarf} color="#b91c1c" />
        <RoundedRect x={62} y={56} width={6} height={18} r={2} color="#991b1b" />
        <Circle cx={60} cy={34} r={13} color="#e0b08a" />
        <Path path={paths.cap} color="#374151" />
        <Path path={paths.armR} style="stroke" strokeWidth={9} strokeCap="round" color={coat} />
        <Path path={paths.armL} style="stroke" strokeWidth={9} strokeCap="round" color={coat} />
        <Group transform={[{ translateX: 61 }, { translateY: 82 }, { rotate: (-8 * Math.PI) / 180 }, { translateX: -61 }, { translateY: -82 }]}>
          <RoundedRect x={50} y={74} width={22} height={16} r={2} color="#f8fafc" />
          <Path path={paths.lines} style="stroke" strokeWidth={1.2} color="#64748b" />
        </Group>
        <Path path={paths.pencil} style="stroke" strokeWidth={2.5} strokeCap="round" color="#fbbf24" />
      </Group>
    </Canvas>
  );
}
