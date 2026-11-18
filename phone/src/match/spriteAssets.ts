// The sprite sheet's files, bundled with the app and decoded once into Skia pictures (the phone only).
import { Image } from "react-native";
import { Skia } from "@shopify/react-native-skia";
import { setSpriteSheet, spritesReady, type SpriteIndex } from "./sprites";

/* eslint-disable @typescript-eslint/no-require-imports */
const INDEX = require("./assets/sprites/index-0.json") as SpriteIndex;
const COLOR = require("./assets/sprites/atlas-0.webp") as number;
const MASK = require("./assets/sprites/mask-0.webp") as number;
/* eslint-enable @typescript-eslint/no-require-imports */

let loading: Promise<boolean> | null = null;
async function decode(mod: number) {
  const uri = Image.resolveAssetSource(mod)?.uri;
  if (!uri) return null;
  const data = await Skia.Data.fromURI(uri);
  return Skia.Image.MakeImageFromEncoded(data);
}
/** Start loading (once); resolves true when the players can be drawn as sprites. */
export function loadSpriteSheet(): Promise<boolean> {
  if (spritesReady()) return Promise.resolve(true);
  loading ??= (async () => {
    try {
      const [c, m] = await Promise.all([decode(COLOR), decode(MASK)]);
      if (!c || !m) return false;
      setSpriteSheet(INDEX, c, m);
      return true;
    } catch { loading = null; return false; }
  })();
  return loading;
}
