/**
 * <SvgIcon>: one of the website's own drawn line icons (never an emoji: they
 * look different on every phone). The inside of a 24×24 `<svg>` as the website
 * writes it, with `currentColor` replaced by `color`. Drawn by Skia, as the
 * club badges and flags are.
 *
 *   <SvgIcon body={BAR_ICON.shop(true)} size={22} color="#fff" />
 */
import { useMemo } from "react";
import { View } from "react-native";
import { Canvas, ImageSVG, Skia } from "@shopify/react-native-skia";
import { svgForSkia } from "../draw/badgeSvg";

const cache = new Map<string, ReturnType<typeof Skia.SVG.MakeFromString>>();

export function SvgIcon({ body, size = 24, color = "#fff", box = 24, opacity = 1 }: { body: string; size?: number; color?: string; box?: number; opacity?: number }) {
  const svg = useMemo(() => {
    const key = `${box}|${color}|${body}`;
    let o = cache.get(key);
    if (o === undefined) {
      try {
        o = Skia.SVG.MakeFromString(svgForSkia(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${box} ${box}">${body.replace(/currentColor/g, color)}</svg>`));
      } catch { o = null; }
      cache.set(key, o);
    }
    return o;
  }, [body, color, box]);
  return (
    <View style={{ width: size, height: size, opacity }}>
      {svg ? <Canvas style={{ width: size, height: size }}><ImageSVG svg={svg} x={0} y={0} width={size} height={size} /></Canvas> : null}
    </View>
  );
}

const line = (on: boolean) => `fill="${on ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" stroke-linecap="round"`;

/** The shop bar's icons (ShowroomShop.tsx BarIcon): thin, white, filled for the page you are on. */
export const SHOP_BAR_ICON = {
  foryou: (on: boolean) => `<rect x="4" y="3" width="16" height="18" rx="4" ${line(on)}/><path d="M10 9l5 3-5 3z" fill="${on ? "#05080f" : "currentColor"}"/>`,
  shop: (on: boolean) => `<path d="M5 8h14l-1.2 12H6.2z" ${line(on)}/><path d="M9 8V6.5a3 3 0 016 0V8" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>`,
  sponsors: (on: boolean) => `<circle cx="12" cy="9" r="5" ${line(on)}/><path d="M8.5 13l-1.5 7 5-2.5 5 2.5-1.5-7" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/>`,
  boots: (on: boolean) => `<path d="M5 6h6l1 5 6.5 2.2a2.5 2.5 0 011.5 2.3V17H4.5z" ${line(on)}/><path d="M6 20v-2.5M10 20v-2.5M14 20v-2.5M18 20v-2.5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" fill="none"/>`,
} as const;
