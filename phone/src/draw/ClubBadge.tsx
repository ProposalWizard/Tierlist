/**
 * <ClubBadge club kit? size? shadow? />: A CLUB'S BADGE, AS THE WEBSITE DRAWS IT.
 *
 * The website's ClubBadge (components/star/ClubBadge.tsx) shows, for a
 * nation, its drawn flag (lib/star/nationFlags.ts `flagMarkup`, inside the
 * same rounded frame as components/star/NationFlag.tsx), and for a club the
 * drawn badge from the club data (lib/star/clubBadge.ts `badgeSvg`) — the
 * "New" badge look, decided for everyone (no toggle). Same functions here
 * (badgeSvg.ts), drawn by Skia from the same SVG.
 *
 * Props
 *   club    the club (or nation) name, as in the career
 *   kit     unused by the drawn badge (kept so calls match the website's)
 *   size    the square box, in points (default 28, as on the website)
 *   shadow  a small drop shadow under it (the Home figure's chest crest has one)
 *
 * Not done: the website's per-device badge redo (/admin/badges overrides,
 * kept in that browser) and the "Old" look (real crest images).
 */
import { useMemo } from "react";
import { View } from "react-native";
import { Canvas, Group, ImageSVG, Paint, Shadow, Skia } from "@shopify/react-native-skia";
import type { Kit } from "@/lib/star/kits";
import { badgeSvgFor, svgForSkia } from "./badgeSvg";

export { badgeSvgFor, svgForSkia };

const cache = new Map<string, ReturnType<typeof Skia.SVG.MakeFromString>>();
function svgObject(club: string, size: number) {
  const { svg, w, h, flag } = badgeSvgFor(club, size);
  const key = flag ? `${club}|${size}` : club;
  let o = cache.get(key);
  if (o === undefined) {
    try { o = Skia.SVG.MakeFromString(svgForSkia(svg)); } catch { o = null; }
    cache.set(key, o);
  }
  return { svg: o, w, h };
}

export function ClubBadge({ club, size = 28, shadow = false }: { club: string; kit?: Kit; size?: number; shadow?: boolean }) {
  const { svg, w, h } = useMemo(() => svgObject(club, size), [club, size]);
  if (!svg) return <View style={{ width: size, height: size }} />;
  const pad = shadow ? 2 : 0;
  const img = <ImageSVG svg={svg} x={pad + (size - w) / 2} y={pad + (size - h) / 2} width={w} height={h} />;
  return (
    <View style={{ width: size, height: size }}>
      <Canvas style={{ position: "absolute", left: -pad, top: -pad, width: size + pad * 2, height: size + pad * 2 }}>
        {shadow
          ? <Group layer={<Paint><Shadow dx={0} dy={1} blur={0.5} color="rgba(0,0,0,0.45)" /></Paint>}>{img}</Group>
          : img}
      </Canvas>
    </View>
  );
}
