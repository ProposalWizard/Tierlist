/**
 * WEB ONLY (the look check, phone/tools/look). The Android app never reads this file.
 *
 * On Android, Skia's matchFont finds the phone's own font (Roboto). In a browser
 * Skia has no fonts at all, so every drawn word (names on the pitch, numbers on
 * shirts) would be missing. tools/look/build-web.mjs puts Roboto next to
 * index.html (/fonts/Roboto-<weight>.ttf); Boot.web.tsx loads them here before
 * the app starts, and src/web/skia.tsx's matchFont picks the nearest weight.
 */
import { Skia, type SkTypeface, type SkFont } from "@shopify/react-native-skia";

const WEIGHTS = [400, 500, 700, 800, 900];
const faces: { weight: number; italic: boolean; tf: SkTypeface }[] = [];

export async function loadWebFonts(): Promise<void> {
  const files = [...WEIGHTS.map((w) => ({ w, italic: false })), { w: 400, italic: true }];
  await Promise.all(files.map(async ({ w, italic }) => {
    try {
      const res = await fetch(`/fonts/Roboto-${w}${italic ? "i" : ""}.ttf`);
      if (!res.ok) return;
      const bytes = new Uint8Array(await res.arrayBuffer());
      const tf = Skia.Typeface.MakeFreeTypeFaceFromData(Skia.Data.fromBytes(bytes));
      if (tf) faces.push({ weight: w, italic, tf });
    } catch { /* that weight stays missing */ }
  }));
}

function weightOf(w: unknown): number {
  if (typeof w === "number") return w;
  const s = String(w ?? "normal");
  if (s === "bold") return 700;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : 400;
}

/** A font like the phone's matchFont gives, or null when no Roboto was loaded. */
export function webFont(style: { fontSize?: number; fontWeight?: unknown; fontStyle?: string } = {}): SkFont | null {
  if (!faces.length) return null;
  const want = weightOf(style.fontWeight);
  const italic = style.fontStyle === "italic";
  const pick = [...faces].sort((a, b) =>
    (Number(a.italic !== italic) - Number(b.italic !== italic)) * 10000 + Math.abs(a.weight - want) - Math.abs(b.weight - want))[0];
  return Skia.Font(pick.tf, style.fontSize ?? 14);
}
