/**
 * SHARE PICTURE (components/star/ShareCard.tsx): the career's one picture, 1080 x 1350,
 * made on the phone and handed to the phone's share sheet (WhatsApp, Instagram …).
 *
 * The picture is the website's own drawing (draw/shareCardDraw.ts) on an off-screen
 * Skia canvas: crests are the phone's drawn badges, trophies the pictures kept in the
 * app, headings in Anton. The PNG is written to the cache folder and shared with
 * expo-sharing. Anything that fails returns null and the caller shares the words alone.
 *
 * SHARE LINK is not on the phone: the website keeps a career's link in your account
 * (lib/star/legendShare.ts, signed in only) and the phone app has no accounts.
 */
import { Platform } from "react-native";
import { Skia, type SkImage, type SkTypeface } from "@shopify/react-native-skia";
import { Asset } from "expo-asset";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import type { CareerOverviewData } from "@/lib/star/careerOverview";
import type { FarewellRecord } from "@/lib/star/types";
import { OffscreenCanvas2D } from "../../draw/offscreen";
import { phoneFontFor } from "../../draw/useDrawing";
import type { FontFor } from "../../draw/ctx2d";
import { badgeSvgFor, svgForSkia } from "../../draw/badgeSvg";
import { CARD_W, CARD_H, drawCareerCard, type CardImage } from "../../draw/shareCardDraw";
import { TROPHY_ART } from "./Ceremonies";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const ANTON = require("../../../assets/look/fonts/Anton.ttf") as number;

async function dataOf(mod: number) {
  const a = Asset.fromModule(mod);
  if (!a.localUri) await a.downloadAsync();
  return Skia.Data.fromURI(a.localUri ?? a.uri);
}
const asCard = (img: SkImage | null): CardImage | null => (img ? { skImage: img, naturalWidth: img.width(), naturalHeight: img.height() } : null);

/** A club's drawn badge as a picture (the same SVG the screens draw). */
function crestImage(club: string): CardImage | null {
  try {
    const px = 160;
    const { svg, w, h } = badgeSvgFor(club, px);
    const obj = Skia.SVG.MakeFromString(svgForSkia(svg));
    const surface = obj ? Skia.Surface.Make(Math.ceil(w), Math.ceil(h)) : null;
    if (!obj || !surface) return null;
    surface.getCanvas().drawSvg(obj, w, h);
    surface.flush();
    return asCard(surface.makeImageSnapshot());
  } catch { return null; }
}

/** The card as a Skia image, or null. */
export async function makeCareerCardImage(o: CareerOverviewData, farewell: FarewellRecord | undefined): Promise<SkImage | null> {
  let anton: SkTypeface | null = null;
  try { anton = Skia.Typeface.MakeFreeTypeFaceFromData(await dataOf(ANTON)); } catch { anton = null; }
  const fontFor: FontFor = (spec) => {
    if (anton && spec.families.some((f) => /anton/i.test(f))) return Skia.Font(anton, spec.size);
    return phoneFontFor(spec);
  };
  const crests = new Map<string, CardImage | null>();
  for (const club of new Set(o.spells.map((s) => s.club))) crests.set(club, crestImage(club));
  const trophies = new Map<string, CardImage | null>();
  await Promise.all(o.honours.slice(0, 7).map(async (h) => {
    const mod = TROPHY_ART[h.competition];
    let img: SkImage | null = null;
    if (mod) { try { img = Skia.Image.MakeImageFromEncoded(await dataOf(mod)); } catch { img = null; } }
    trophies.set(h.competition, asCard(img));
  }));
  const canvas = new OffscreenCanvas2D(Skia, CARD_W * 2, CARD_H * 2, fontFor);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  drawCareerCard(ctx as unknown as CanvasRenderingContext2D, o, farewell, { crests, trophies, fonts: { display: "Anton, sans-serif", body: "sans-serif" } });
  return canvas.__skiaImage();
}

/** "knowitball-jamie-calloway.png" (ShareCard.tsx cardFileName). */
function cardFileName(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "career";
  return `knowitball-${slug}.png`;
}

/** Make the picture and open the share sheet with it. False = no picture could be shared (share the words instead). */
export async function shareCareerPicture(o: CareerOverviewData, farewell: FarewellRecord | undefined, words: string): Promise<boolean> {
  try {
    const img = await makeCareerCardImage(o, farewell);
    if (!img) return false;
    if (Platform.OS === "web") {
      // A browser (the look check's build): save the picture, as the website does on a computer.
      const doc = (globalThis as unknown as { document?: { createElement: (t: string) => { href: string; download: string; click: () => void } } }).document;
      if (!doc) return false;
      const a = doc.createElement("a");
      a.href = `data:image/png;base64,${img.encodeToBase64()}`;
      a.download = cardFileName(o.name);
      (globalThis as unknown as { __kibShareCard?: string }).__kibShareCard = a.href;
      a.click();
      return true;
    }
    if (!(await Sharing.isAvailableAsync())) return false;
    const file = new File(Paths.cache, cardFileName(o.name));
    if (file.exists) file.delete();
    file.create();
    file.write(img.encodeToBytes());
    await Sharing.shareAsync(file.uri, { mimeType: "image/png", dialogTitle: words });
    return true;
  } catch (e) {
    console.warn("share picture failed", e);
    return false;
  }
}
