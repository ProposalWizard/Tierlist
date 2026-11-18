// Which canvas calls a goal video frame makes (counts per frame), to see where its time goes. Headless.
//   cd phone && npx tsx tools/match-goal-video-prof.ts
import CanvasKitInit from "canvaskit-wasm/bin/full/canvaskit.js";
import { JsiSkApi } from "@shopify/react-native-skia/lib/commonjs/skia/web/JsiSkia";
import { makeEdit, editDuration } from "@/lib/star/goalClip/edit";
import { synthTrack } from "@/lib/star/goalClip/synth";
import { setSkia } from "../src/match/skiaApi";
import { drawEditFrame } from "../src/match/goalClip/render";
import { Ctx2D } from "../src/draw/ctx2d";
import { withCanvasDocument } from "../src/draw/offscreen";

(globalThis as Record<string, unknown>).window ??= {};
(globalThis as Record<string, unknown>).__KIB_HEADLESS__ = true;

async function main() {
  const CK = await (CanvasKitInit as unknown as (o: object) => Promise<unknown>)({});
  const Skia = JsiSkApi(CK as never) as unknown as typeof import("@shopify/react-native-skia").Skia;
  setSkia(Skia);
  const t = synthTrack({ home: "Arsenal", away: "Chelsea", scorer: "Bukayo Saka", scorerShort: "Saka", scorerHome: true, minute: 63, scoreAfter: [1, 0], seed: "prof-1" })!;
  for (const style of ["broadcast", "fan"] as const) {
    const edit = makeEdit([t], style, "new", 0);
    const counts = new Map<string, number>();
    const times: number[] = [];
    const frames = Math.floor(editDuration(edit) * edit.fps);
    for (let f = 1; f < frames; f += 5) {
      const rec = Skia.PictureRecorder();
      const pc = rec.beginRecording(Skia.XYWHRect(0, 0, edit.w, edit.h));
      const ctx = new Ctx2D(Skia, pc, { width: edit.w, height: edit.h });
      const proxy = new Proxy(ctx as unknown as Record<string, unknown>, {
        get(o, k) {
          const v = o[k as string];
          if (typeof v === "function") return (...a: unknown[]) => { counts.set(String(k), (counts.get(String(k)) ?? 0) + 1); return (v as (...x: unknown[]) => unknown).apply(o, a); };
          return v;
        },
        set(o, k, v) { o[k as string] = v; return true; },
      });
      const a = performance.now();
      withCanvasDocument(Skia, () => drawEditFrame(proxy as unknown as CanvasRenderingContext2D, edit, f / edit.fps));
      times.push(performance.now() - a);
      (rec.finishRecordingAsPicture() as unknown as { dispose(): void }).dispose();
    }
    const n = times.length;
    const top = [...counts.entries()].sort((x, y) => y[1] - x[1]).slice(0, 12).map(([k, v]) => `${k} ${Math.round(v / n)}`).join(", ");
    console.log(`${style}: ${(times.reduce((s, x) => s + x, 0) / n).toFixed(1)} ms a frame; calls a frame: ${top}`);
  }
}
void main();
