/**
 * THE GROUND ALONE, HEADLESS: the grass, lines and goal (src/match/drawGround.ts) for one camera,
 * written as a PNG. For looking at the markings (is the 18-yard line there?) without playing a match.
 *
 *   cd phone && npx tsx tools/ground-still.ts OUT.png [x1 y1 x2 y2] [tiltDeg] [W H]
 *
 * Default: the penalty's frame (the box's middle 24 m, goal line to 50 m out), tilt 26, 390×860.
 */
import fs from "node:fs";
import CanvasKitInit from "canvaskit-wasm/bin/full/canvaskit.js";
import { JsiSkApi } from "@shopify/react-native-skia/lib/commonjs/skia/web/JsiSkia";
import { setSkia } from "../src/match/skiaApi";
import { drawGround } from "../src/match/drawGround";
import { makeCam, toScreen } from "../src/match/view";

(globalThis as Record<string, unknown>).window ??= {};
(globalThis as Record<string, unknown>).__KIB_HEADLESS__ = true;

const a = process.argv.slice(2);
const out = a[0] ?? "ground.png";
const n = a.slice(1).map(Number);
const vp = n.length >= 4 ? { x1: n[0], y1: n[1], x2: n[2], y2: n[3] } : { x1: 22, y1: -3, x2: 46, y2: 50 };
const tilt = n[4] ?? 26, W = n[5] ?? 390, H = n[6] ?? 860;

async function main() {
  const CK = await (CanvasKitInit as unknown as (o: object) => Promise<unknown>)({});
  const Skia = JsiSkApi(CK as never) as unknown as typeof import("@shopify/react-native-skia").Skia;
  setSkia(Skia);
  const cam = makeCam(vp, "up", tilt, W, H);
  const surf = Skia.Surface.Make(W, H)!;
  // As the app does it: recorded into the frame's picture, then the picture drawn.
  const rec = Skia.PictureRecorder();
  drawGround(rec.beginRecording(Skia.XYWHRect(0, 0, W, H)), cam, undefined);
  surf.getCanvas().drawPicture(rec.finishRecordingAsPicture());
  surf.flush();
  fs.writeFileSync(out, Buffer.from(surf.makeImageSnapshot().encodeToBytes()));
  // Where the lines should be on the glass, and whether a white pixel is there.
  const px = surf.makeImageSnapshot().readPixels(0, 0, { width: W, height: H, colorType: 4, alphaType: 1 } as never) as Uint8Array | null;
  const white = (X: number, Y: number) => {
    if (!px) return "?";
    for (let dy = -2; dy <= 2; dy++) { const i = (Math.round(Y + dy) * W + Math.round(X)) * 4; if (px[i] > 200 && px[i + 1] > 215 && px[i + 2] > 200) return "line"; }
    return "NO LINE";
  };
  for (const [name, p] of [["goal line, left of the 6-yard box", { x: 24.2, y: 0 }], ["18-yard line, left of the D", { x: 25, y: 16.5 }], ["18-yard line, right of the D", { x: 43, y: 16.5 }], ["6-yard line", { x: 30, y: 5.5 }]] as const) {
    const s = toScreen(cam, p);
    console.log(`${name}: (${s.X.toFixed(0)}, ${s.Y.toFixed(0)}) ${white(s.X, s.Y)}`);
  }
}
main();
