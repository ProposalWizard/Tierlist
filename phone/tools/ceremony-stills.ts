/**
 * THE CEREMONIES' DRAWN PARTS, AS PICTURES (headless): the Golden Ball stage
 * (src/draw/ceremonyPaint.ts: wall, ring, floor, the three podiums and beams
 * after the reveal, the host waving) and the Season Awards room, on a phone-
 * sized canvas through the canvas stand-in, so they can be looked at next to
 * the website's drawn stage.
 *
 *   cd phone && npx tsx tools/ceremony-stills.ts [DIR]
 */
import fs from "node:fs";
import path from "node:path";
import CanvasKitInit from "canvaskit-wasm/bin/full/canvaskit.js";
import { JsiSkApi } from "@shopify/react-native-skia/lib/commonjs/skia/web/JsiSkia";
import { Ctx2D } from "../src/draw/ctx2d";
import { paintStageBack, paintPodiums, paintHost, paintRoomBack } from "../src/draw/ceremonyPaint";

const OUT = process.argv[2] ?? "/tmp/ceremony-stills";
const W = 390, H = 780, PR = 2;

async function main() {
  const CK = await (CanvasKitInit as unknown as (o: object) => Promise<unknown>)({});
  const Skia = JsiSkApi(CK as never) as unknown as typeof import("@shopify/react-native-skia").Skia;
  fs.mkdirSync(OUT, { recursive: true });
  const shot = (name: string, paint: (g: CanvasRenderingContext2D) => void) => {
    const s = Skia.Surface.Make(W * PR, H * PR)!;
    const g = new Ctx2D(Skia, s.getCanvas(), { width: W, height: H, base: [PR, 0, 0, PR, 0, 0] });
    paint(g as unknown as CanvasRenderingContext2D);
    g.reset();
    s.flush();
    fs.writeFileSync(path.join(OUT, `${name}.png`), Buffer.from(s.makeImageSnapshot().encodeToBytes()));
  };
  const xPct = (x: number) => 50 + x * 14;
  shot("golden-ball-stage", (g) => {
    paintStageBack(g, W, H, true);
    paintPodiums(g, W, H, [
      { left: xPct(-1.6), px: 30 + 0.62 * 90, beam: 0.08, win: false },
      { left: xPct(0), px: 30 + 0.9 * 90, beam: 0.34, win: true },
      { left: xPct(1.6), px: 30 + 0.42 * 90, beam: 0.08, win: false },
    ]);
    g.save(); g.translate(Math.min(90, xPct(3.3)) / 100 * W - 32, H * 0.66 - 120); paintHost(g, 1, -120); g.restore();
  });
  shot("awards-room", (g) => paintRoomBack(g, W, H));
  console.log(`pictures in ${OUT}`);
}
void main();
