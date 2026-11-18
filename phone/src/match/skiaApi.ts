/**
 * Which Skia the match draws with. On the phone: React Native Skia's own
 * (set by screens/MatchPitch.tsx). In node (tools/match-frame.ts): the same
 * Skia as CanvasKit through RN Skia's own web wrapper (JsiSkApi), so the
 * per-frame drawing can be timed headless with the code the phone runs.
 * No React Native import here.
 */
import type { Skia as SkiaValue, SkPaint } from "@shopify/react-native-skia";
export type SkiaApi = typeof SkiaValue;

let api: SkiaApi | null = null;
export function setSkia(a: SkiaApi) { if (api !== a) { api = a; paints.clear(); } }
export function sk(): SkiaApi {
  if (!api) throw new Error("match: setSkia() was never called");
  return api;
}

// Skia's enum numbers (enums are not importable without React Native).
export const PAINT_STROKE = 1;
export const CAP_ROUND = 1;
export const FILTER_LINEAR = 1, MIPMAP_NONE = 0;

const paints = new Map<string, SkPaint>();
/** A cached fill paint. */
export function fill(color: string): SkPaint {
  const k = "f" + color;
  let p = paints.get(k);
  if (!p) { p = sk().Paint(); p.setAntiAlias(true); p.setColor(sk().Color(color)); paints.set(k, p); }
  return p;
}
/** A cached stroke paint. */
export function stroke(color: string, w: number): SkPaint {
  const k = `s${color}|${w}`;
  let p = paints.get(k);
  if (!p) { p = sk().Paint(); p.setAntiAlias(true); p.setColor(sk().Color(color)); p.setStyle(PAINT_STROKE); p.setStrokeWidth(w); p.setStrokeCap(CAP_ROUND); paints.set(k, p); }
  return p;
}
