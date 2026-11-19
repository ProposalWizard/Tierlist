/**
 * WEB ONLY (the look check, phone/tools/look). The Android app never reads this
 * file: on a phone `./Boot` is Boot.tsx; in a browser the bundler picks this one.
 *
 * In a browser, Skia draws through CanvasKit (Skia compiled for the web), which
 * must be loaded before any drawing code runs. This loads it (canvaskit.wasm,
 * served next to index.html: phone/tools/look/build-web.mjs copies it there),
 * then starts the usual Boot.tsx, with its safe start and fault screen.
 */
import { useEffect, useState, type ComponentType } from "react";
import { Text, View } from "react-native";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore: a plain JS file of Skia's web build
import { LoadSkiaWeb } from "@shopify/react-native-skia/lib/module/web/LoadSkiaWeb";

// react-native-web's Image has no resolveAssetSource, which the app uses to find
// its bundled files (sprite sheets, packed photos and badges): the same answer
// from expo-asset (the file's address on this server).
{
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const RNImage = (require("react-native") as { Image: { resolveAssetSource?: unknown } }).Image;
  if (typeof RNImage.resolveAssetSource !== "function") {
    RNImage.resolveAssetSource = (src: unknown) => {
      if (typeof src !== "number") return src as { uri?: string } | null;
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const a = (require("expo-asset") as typeof import("expo-asset")).Asset.fromModule(src);
        return { uri: a.uri, width: a.width ?? undefined, height: a.height ?? undefined, scale: 1 };
      } catch { return null; }
    };
  }
}

let Real: ComponentType | null = null;
let failed = "";
const ready: Promise<void> = (LoadSkiaWeb as (o: object) => Promise<void>)({ locateFile: (f: string) => `/${f}` })
  .catch((e: unknown) => { failed = `CanvasKit did not load: ${String(e)}`; })
  // Roboto for Skia's drawn words (src/web/fonts.ts)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  .then(() => (failed ? undefined : (require("./web/fonts") as typeof import("./web/fonts")).loadWebFonts()))
  .then(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/ban-ts-comment
    // @ts-ignore: the phone's own Boot (an explicit .tsx so this file does not load itself)
    Real = require("./Boot.tsx").default as ComponentType;
  });

export default function BootWeb() {
  const [ok, setOk] = useState(!!Real);
  useEffect(() => { ready.then(() => setOk(true)); }, []);
  if (!ok || !Real) return <View style={{ flex: 1, backgroundColor: "#0b100e" }}>{failed ? <Text style={{ color: "#f87171", margin: 20 }}>{failed}</Text> : null}</View>;
  const B = Real;
  return <B />;
}
