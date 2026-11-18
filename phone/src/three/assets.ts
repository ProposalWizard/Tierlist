/**
 * THE 3D FILES INSIDE THE APP, by their website address (./assetList.ts),
 * and the phone's side of ./platform.ts: Skia for pictures, the phone's fonts
 * for shirt numbers. The files open with no signal (they are in the app).
 */
import { Skia } from "@shopify/react-native-skia";
import { Asset } from "expo-asset";
import { File } from "expo-file-system";
import { phoneFontFor } from "../draw/useDrawing";
import { setThreePlatform } from "./platform";

/* eslint-disable @typescript-eslint/no-require-imports */
const FILES: Record<string, number> = {
  "/star/people3d/toon-p1.glb": require("../../assets/3d/people3d/toon-p1.glb"),
  "/star/people3d/toon-p2.glb": require("../../assets/3d/people3d/toon-p2.glb"),
  "/star/people3d/toon-p3.glb": require("../../assets/3d/people3d/toon-p3.glb"),
  "/star/people3d/toon-p4.glb": require("../../assets/3d/people3d/toon-p4.glb"),
  "/star/people3d/toon-p5.glb": require("../../assets/3d/people3d/toon-p5.glb"),
  "/star/people3d/toon-p6.glb": require("../../assets/3d/people3d/toon-p6.glb"),
  "/star/people3d/anims.glb": require("../../assets/3d/people3d/anims.glb"),
  "/star/anims3d/football.glb": require("../../assets/3d/anims3d/football.glb"),
  "/star/anims3d/mocap.glb": require("../../assets/3d/anims3d/mocap.glb"),
  "/star/ovation3d/greetings.glb": require("../../assets/3d/ovation3d/greetings.glb"),
};
/* eslint-enable @typescript-eslint/no-require-imports */

const bytes = new Map<string, Promise<ArrayBuffer>>();
/** A bundled 3D file's bytes (read once per run of the app). */
export function bundledBytes(url: string): Promise<ArrayBuffer> {
  let p = bytes.get(url);
  if (!p) {
    const mod = FILES[url];
    if (mod === undefined) return Promise.reject(new Error(`3D: ${url} is not in the app (phone/src/three/assetList.ts)`));
    p = (async () => {
      const a = Asset.fromModule(mod);
      if (!a.localUri) await a.downloadAsync();
      const u8 = await new File(a.localUri ?? a.uri).bytes();
      // a plain ArrayBuffer of exactly the file (three checks `instanceof ArrayBuffer` and reads from byte 0)
      return u8.byteOffset === 0 && u8.byteLength === u8.buffer.byteLength && u8.buffer instanceof ArrayBuffer ? u8.buffer : u8.slice().buffer;
    })();
    p.catch(() => bytes.delete(url));
    bytes.set(url, p);
  }
  return p;
}

let ready = false;
/** Set the phone's 3D surroundings (once). */
export function setupPhone3d(): void {
  if (ready) return;
  ready = true;
  setThreePlatform({ Skia, bytes: bundledBytes, fontFor: phoneFontFor });
}
