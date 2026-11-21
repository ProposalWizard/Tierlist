/**
 * <NationFlag nation width? />: A NATION'S FLAG, DRAWN (the website's
 * components/star/NationFlag.tsx; lib/star/nationFlags.ts). Never a flag emoji:
 * Samsung phones have no England, Scotland or Wales emoji flag (a black flag
 * shows) and draw the others in their own style. A nation with no drawing gets
 * two bands in its kit colours (211 nations have a kit), so nothing is blank.
 *
 *   nation  the nation or nationality, as the game names it ("England", "Ivory Coast")
 *   width   in points; the height is two thirds of it (default 20)
 */
import { useMemo } from "react";
import { View } from "react-native";
import { Canvas, ImageSVG, Skia } from "@shopify/react-native-skia";
import { flagMarkup } from "@/lib/star/nationFlags";
import { nationKits } from "@/lib/star/international";
import { svgForSkia } from "./badgeSvg";

const cache = new Map<string, ReturnType<typeof Skia.SVG.MakeFromString>>();
function flagSvg(nation: string) {
  let o = cache.get(nation);
  if (o === undefined) {
    try {
      let bands: [string, string] | undefined;
      try { const k = nationKits(nation); bands = [k.home.shirt, k.home.trim]; } catch { bands = undefined; }
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20" preserveAspectRatio="none">${flagMarkup(nation, bands)}</svg>`;
      o = Skia.SVG.MakeFromString(svgForSkia(svg));
    } catch { o = null; }
    cache.set(nation, o);
  }
  return o;
}

export function NationFlag({ nation, width = 20 }: { nation: string; width?: number }) {
  const h = Math.round((width * 2) / 3);
  const svg = useMemo(() => flagSvg(nation), [nation]);
  return (
    <View style={{ width, height: h, borderRadius: Math.max(1.5, width / 10), overflow: "hidden", backgroundColor: "#e5e7eb", borderWidth: 0.5, borderColor: "rgba(0,0,0,0.4)" }}>
      {svg ? (
        <Canvas style={{ width, height: h }}>
          <ImageSVG svg={svg} x={0} y={0} width={width} height={h} />
        </Canvas>
      ) : null}
    </View>
  );
}
