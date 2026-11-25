import { useRiskyPart } from "../safety";
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
import { Image, View } from "react-native";
import { ICON } from "../ui/look/pictures";
const BALL = ICON.ball;
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

export function HomePlayer({ career, width, height, where, ball, glow }: { career: CareerState; width: number; height: number; where: "home" | "title"; /** His light in another colour (away with your country: the nation's, HomeHub `glow`). */ glow?: string; /** The ball at his feet when he is DRAWN (the 3D player brings his own). */ ball?: boolean }) {
  const style = usePlayerStyleLook();
  // 3D starts a moment after the rest of Home, so a crash in it is named on its own (safety.ts). HomePlayer3D then waits another
  // HOME_GL_SETTLE_MS (the screen before gone and quiet, no other GL alive) before it makes its view: 1700 + 800 = the 2.5 s it was.
  const ok3d = useRiskyPart("3d", { delayMs: 1700, settleMs: 6000 });
  const club = career.player.club;
  const kit = kitsOf(club, career.clubKits?.[club]).home;
  const lit = glow && /^#[0-9a-f]{6}$/i.test(glow) ? glow : kit.shirt;
  const figure = <PlayerFigure career={career} width={width} height={height} />;
  // the ball: beside him on the title (TitleScreen TitleBall), at his feet on Home
  const bs = Math.round(height * (where === "title" ? 0.145 : 0.11));
  const bx = width * (where === "title" ? 0.29 : 0.4) - bs / 2;
  const drawn = ball ? <View style={{ width, height }}>{figure}<Image source={BALL} style={{ position: "absolute", width: bs, height: bs, left: bx, bottom: where === "title" ? 0 : -bs * 0.15 }} /></View> : figure;
  const gw = width * 0.95, gh = height * 0.55, poolW = width * 1.25, poolH = Math.max(14, height * 0.09);
  return (
    <View style={{ width, height }}>
      <Canvas pointerEvents="none" style={{ position: "absolute", left: -(poolW - width) / 2, top: 0, width: poolW, height: height + poolH / 2 }}>
        {/* the soft glow behind his chest */}
        <Circle cx={poolW / 2} cy={height * 0.18 + gh / 2} r={Math.max(gw, gh) / 2}>
          <RadialGradient c={vec(poolW / 2, height * 0.18 + gh / 2)} r={Math.max(gw, gh) / 2} colors={[rgba(lit, 0.55), rgba(lit, 0)]} />
        </Circle>
        {/* the pool of light he stands in */}
        <Oval x={0} y={height - poolH / 2} width={poolW} height={poolH}>
          <RadialGradient c={vec(poolW / 2, height)} r={poolW / 2} colors={[rgba("#ffffff", 0.5), rgba(lit, 0.45), rgba(lit, 0)]} positions={[0, 0.55, 1]} />
        </Oval>
      </Canvas>
      {style === "new" && ok3d
        ? <HomePlayer3D career={career} width={width} height={height} where={where} kitShirt={kit.shirt} kitTrim={kit.trim} fallback={drawn} />
        : drawn}
    </View>
  );
}
