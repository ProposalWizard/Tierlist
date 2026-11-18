/**
 * YOUR PLAYER ON HOME AND THE TITLE SCREEN — the one hook (the website's
 * components/star/HomePlayer.tsx): a box (width × height, his boots on its
 * bottom edge), a soft glow of the club's colour behind his chest and the pool
 * of light he stands in, and the figure:
 * - Settings → Look → "Player style: New" (the default): your 3D player
 *   (./HomePlayer3D.tsx), the drawn figure if 3D can't start;
 * - Old: the drawn figure (draw/PlayerFigure.tsx).
 * The glow and the pool are drawn once (no animation: nothing redraws).
 */
import { View } from "react-native";
import { Canvas, Circle, Oval, RadialGradient, vec } from "@shopify/react-native-skia";
import type { CareerState } from "@/lib/star/types";
import { kitsOf } from "@/lib/star/kits";
import { usePlayerStyleLook } from "@/lib/star/style3d/toon/look";
import { PlayerFigure } from "../draw/PlayerFigure";
import { HomePlayer3D } from "./HomePlayer3D";

function rgba(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h.slice(0, 6), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export function HomePlayer({ career, width, height, where }: { career: CareerState; width: number; height: number; where: "home" | "title" }) {
  const style = usePlayerStyleLook();
  const club = career.player.club;
  const kit = kitsOf(club, career.clubKits?.[club]).home;
  const drawn = <PlayerFigure career={career} width={width} height={height} />;
  const gw = width * 0.95, gh = height * 0.55, poolW = width * 1.25, poolH = Math.max(14, height * 0.09);
  return (
    <View style={{ width, height }}>
      <Canvas pointerEvents="none" style={{ position: "absolute", left: -(poolW - width) / 2, top: 0, width: poolW, height: height + poolH / 2 }}>
        {/* the soft glow behind his chest */}
        <Circle cx={poolW / 2} cy={height * 0.18 + gh / 2} r={Math.max(gw, gh) / 2}>
          <RadialGradient c={vec(poolW / 2, height * 0.18 + gh / 2)} r={Math.max(gw, gh) / 2} colors={[rgba(kit.shirt, 0.55), rgba(kit.shirt, 0)]} />
        </Circle>
        {/* the pool of light he stands in */}
        <Oval x={0} y={height - poolH / 2} width={poolW} height={poolH}>
          <RadialGradient c={vec(poolW / 2, height)} r={poolW / 2} colors={[rgba("#ffffff", 0.5), rgba(kit.shirt, 0.45), rgba(kit.shirt, 0)]} positions={[0, 0.55, 1]} />
        </Oval>
      </Canvas>
      {style === "new"
        ? <HomePlayer3D career={career} width={width} height={height} where={where} kitShirt={kit.shirt} kitTrim={kit.trim} fallback={drawn} />
        : drawn}
    </View>
  );
}
