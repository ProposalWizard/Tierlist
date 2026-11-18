// The sprite sheets' files, bundled with the app and decoded into Skia pictures (the phone only):
// atlas 0 when the match opens, the others when one of their clips is first asked for (match/sprites.ts).
import { Image } from "react-native";
import { Skia } from "@shopify/react-native-skia";
import { setSpriteSheet, spritesReady, preloadLaterAtlases, type SpriteIndex } from "./sprites";

/* eslint-disable @typescript-eslint/no-require-imports */
const INDEX = require("./assets/sprites/index.json") as SpriteIndex;
const FILES: Record<number, [number, number]> = {
  0: [require("./assets/sprites/atlas-0.webp"), require("./assets/sprites/mask-0.webp")],
  1: [require("./assets/sprites/atlas-1.webp"), require("./assets/sprites/mask-1.webp")],
  2: [require("./assets/sprites/atlas-2.webp"), require("./assets/sprites/mask-2.webp")],
  3: [require("./assets/sprites/atlas-3.webp"), require("./assets/sprites/mask-3.webp")],
  4: [require("./assets/sprites/atlas-4.webp"), require("./assets/sprites/mask-4.webp")],
  5: [require("./assets/sprites/atlas-5.webp"), require("./assets/sprites/mask-5.webp")],
};
/* eslint-enable @typescript-eslint/no-require-imports */

async function decode(mod: number) {
  const uri = Image.resolveAssetSource(mod)?.uri;
  if (!uri) return null;
  const data = await Skia.Data.fromURI(uri);
  return Skia.Image.MakeImageFromEncoded(data);
}
async function atlas(n: number) {
  const f = FILES[n];
  if (!f) return null;
  const [color, mask] = await Promise.all([decode(f[0]), decode(f[1])]);
  return color && mask ? { color, mask } : null;
}

let loading: Promise<boolean> | null = null;
/** Start loading (once); resolves true when the players can be drawn as sprites. */
export function loadSpriteSheet(): Promise<boolean> {
  if (spritesReady()) return Promise.resolve(true);
  loading ??= (async () => {
    try {
      const a0 = await atlas(0);
      if (!a0) { loading = null; return false; }
      setSpriteSheet(INDEX, a0.color, a0.mask, atlas);
      // The later atlases at idle (the website's preloadLaterAtlases), so the first kick never waits.
      setTimeout(preloadLaterAtlases, 400);
      return true;
    } catch { loading = null; return false; }
  })();
  return loading;
}
