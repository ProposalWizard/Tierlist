/**
 * THE GROUND'S COST, HEADLESS: records and rasters the match's grass, lines
 * and goal (src/match/drawGround.ts) for a few cameras on CanvasKit.
 *   cd phone && npx tsx tools/look/ground-bench.ts [--png DIR]
 * A desktop CPU, not a phone: read the numbers as relative.
 */
import fs from "node:fs";
import path from "node:path";
import CanvasKitInit from "canvaskit-wasm/bin/full/canvaskit.js";
import { JsiSkApi } from "@shopify/react-native-skia/lib/commonjs/skia/web/JsiSkia";
import { setSkia } from "../../src/match/skiaApi";
import { drawGround, groundStats } from "../../src/match/drawGround";
import { makeCam } from "../../src/match/view";

const args = process.argv.slice(2);
const PNG = args.includes("--png") ? args[args.indexOf("--png") + 1] : null;
const W = 390, H = 640;
async function main() {
  const CK = await (CanvasKitInit as unknown as (o: object) => Promise<unknown>)({});
  const Skia = JsiSkApi(CK as never) as unknown as typeof import("@shopify/react-native-skia").Skia;
  setSkia(Skia);
  const surf = Skia.Surface.Make(W, H)!;
  const hw = H / W;
  const cams = {
    freekick: makeCam({ x1: 10, y1: -3, x2: 58, y2: -3 + 48 * hw }, "up", 0, W, H),
    tilted: makeCam({ x1: 10, y1: -3, x2: 58, y2: -3 + 48 * hw }, "up", 20, W, H),
    side: makeCam({ x1: 0, y1: -4, x2: 40 * hw, y2: 36 }, "right", 0, W, H),
  };
  const q = (xs: number[], p: number) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(p * (s.length - 1))]; };
  for (const [name, cam] of Object.entries(cams)) {
    const r: number[] = [];
    for (let i = 0; i < 60; i++) {
      const a = performance.now();
      const c = surf.getCanvas(); c.clear(Skia.Color("black")); drawGround(c, cam, undefined); surf.flush();
      r.push(performance.now() - a);
    }
    console.log(`${name.padEnd(9)} raster median ${q(r, 0.5).toFixed(2)} ms`);
    if (PNG) { fs.mkdirSync(PNG, { recursive: true }); fs.writeFileSync(path.join(PNG, `ground-${name}.png`), Buffer.from(surf.makeImageSnapshot().encodeToBytes())); }
  }
  console.log(`recorded ${groundStats.recorded} times, ${(groundStats.ms / groundStats.recorded).toFixed(2)} ms each`);
}
void main();
