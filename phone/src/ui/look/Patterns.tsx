/**
 * TWO PATTERNS THE WEBSITE PAINTS WITH CSS THAT A PHONE CANNOT: React Native's
 * `backgroundImage` has no `repeating-linear-gradient` and no
 * `repeating-conic-gradient` (it draws nothing), so they are drawn with Skia.
 *
 *   <Scanlines />            a TV's faint lines over the whole parent (Breaking News)
 *   <Rays size={520} />      gold rays turning round a centre (Player of the Month)
 *
 * Both are still (nothing moves at rest) and take no touches.
 */
import { useMemo, useState } from "react";
import { View } from "react-native";
import { Canvas, LinearGradient, Path, Rect, Skia, vec } from "@shopify/react-native-skia";

/** A 1 px line every `gap` px (repeating-linear-gradient(0deg, c 0 1px, transparent 1px 4px)). */
export function Scanlines({ color = "rgba(255,255,255,0.5)", gap = 4, opacity = 0.18 }: { color?: string; gap?: number; opacity?: number }) {
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, opacity }}
      onLayout={(e) => { const { width, height } = e.nativeEvent.layout; if (!box || box.w !== width || box.h !== height) setBox({ w: width, h: height }); }}>
      {box && (
        <Canvas style={{ width: box.w, height: box.h }}>
          <Rect x={0} y={0} width={box.w} height={box.h}>
            <LinearGradient start={vec(0, 0)} end={vec(0, gap)} mode="repeat" colors={[color, color, "rgba(255,255,255,0)", "rgba(255,255,255,0)"]} positions={[0, 1 / gap, 1 / gap, 1]} />
          </Rect>
        </Canvas>
      )}
    </View>
  );
}

/** Rays `lit`° wide every `every`° round a circle `size` across (repeating-conic-gradient). */
export function Rays({ size, color = "rgba(253,230,138,0.16)", lit = 8, every = 22, opacity = 0.8 }: { size: number; color?: string; lit?: number; every?: number; opacity?: number }) {
  const path = useMemo(() => {
    const p = Skia.PathBuilder.Make();
    const r = size / 2, c = size / 2;
    // CSS conic gradients start at the top and turn clockwise
    for (let a = 0; a < 360; a += every) {
      const a0 = ((a - 90) * Math.PI) / 180, a1 = ((a + lit - 90) * Math.PI) / 180;
      p.moveTo(c, c);
      p.lineTo(c + r * Math.cos(a0), c + r * Math.sin(a0));
      p.arcToOval({ x: 0, y: 0, width: size, height: size }, a - 90, lit, false);
      p.lineTo(c + r * Math.cos(a1), c + r * Math.sin(a1));
      p.close();
    }
    return p.build();
  }, [size, lit, every]);
  return (
    <View pointerEvents="none" style={{ width: size, height: size, opacity }}>
      <Canvas style={{ width: size, height: size }}>
        <Path path={path} color={color} />
      </Canvas>
    </View>
  );
}
