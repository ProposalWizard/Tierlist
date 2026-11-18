/**
 * GOAL VIDEO FRAME COST AND SAMENESS, HEADLESS.
 *
 *   cd phone && npx tsx tools/goal-video-bench.ts [--ref path/to/older/ctx2d.ts] [--png DIR]
 *
 * Draws every 3rd frame of a made goal (lib/star/goalClip/synth.ts) in each
 * cut (broadcast, behind the goal, fan, TikTok) through src/draw/ctx2d.ts with
 * the phone's sprite sheets, the way MatchGoalVideo.tsx does (2x pixels), and
 * prints the JS time to record one frame (median / p95) and how many calls
 * into Skia's canvas it made. With --ref, draws the same frames through
 * another Ctx2D (an older copy of ctx2d.ts) and compares the pixels.
 * A desktop CPU on CanvasKit, not a phone: read the times as relative.
 */
import fs from "node:fs";
import path from "node:path";
import CanvasKitInit from "canvaskit-wasm/bin/full/canvaskit.js";
import { JsiSkApi } from "@shopify/react-native-skia/lib/commonjs/skia/web/JsiSkia";
import { makeEdit, editDuration, type ClipStyle } from "@/lib/star/goalClip/edit";
import { synthTrack } from "@/lib/star/goalClip/synth";
import { setSkia } from "../src/match/skiaApi";
import { setSpriteSheet, setAtlas, type SpriteIndex } from "../src/match/sprites";
import { drawEditFrame } from "../src/match/goalClip/render";
import { Ctx2D } from "../src/draw/ctx2d";
import { withCanvasDocument } from "../src/draw/offscreen";

(globalThis as Record<string, unknown>).window ??= {};
(globalThis as Record<string, unknown>).__KIB_HEADLESS__ = true;
const args = process.argv.slice(2);
const REF = args.includes("--ref") ? args[args.indexOf("--ref") + 1] : null;
const PNG = args.includes("--png") ? args[args.indexOf("--png") + 1] : null;

type Ctor = new (S: unknown, c: unknown, o: object) => unknown;

async function main() {
  const CK = await (CanvasKitInit as unknown as (o: object) => Promise<unknown>)({});
  const Skia = JsiSkApi(CK as never) as unknown as typeof import("@shopify/react-native-skia").Skia;
  setSkia(Skia);
  const dir = path.join(__dirname, "../src/match/assets/sprites");
  const idx = JSON.parse(fs.readFileSync(path.join(dir, "index.json"), "utf8")) as SpriteIndex;
  const img = (f: string) => Skia.Image.MakeImageFromEncoded(Skia.Data.fromBytes(new Uint8Array(fs.readFileSync(path.join(dir, f)))))!;
  setSpriteSheet(idx, img("atlas-0.webp"), img("mask-0.webp"));
  for (let n = 1; n <= 5; n++) setAtlas(n, img(`atlas-${n}.webp`), img(`mask-${n}.webp`));
  const Ref = REF ? ((await import(path.resolve(REF))) as { Ctx2D: Ctor }).Ctx2D : null;
  if (PNG) fs.mkdirSync(PNG, { recursive: true });
  // Count every call into Skia (on a phone each is a trip from JS to native code).
  let calls = 0;
  const byName = new Map<string, number>();
  const counted = <T extends object>(o: T): T => new Proxy(o, {
    get(t, k) {
      const v = (t as Record<string | symbol, unknown>)[k];
      return typeof v === "function" ? (...a: unknown[]) => { calls++; byName.set(String(k), (byName.get(String(k)) ?? 0) + 1); return (v as (...x: unknown[]) => unknown).apply(t, a); } : v;
    },
  });
  const SkiaCounted = new Proxy(Skia as object, {
    get(t, k) {
      const v = (t as Record<string | symbol, unknown>)[k];
      if (typeof v === "function") return (...a: unknown[]) => { calls++; byName.set("Skia."+String(k), (byName.get("Skia."+String(k)) ?? 0) + 1); const r = (v as (...x: unknown[]) => unknown).apply(t, a); return r && typeof r === "object" ? counted(r as object) : r; };
      if (v && typeof v === "object") return counted(v as object);
      return v;
    },
  });
  const t = synthTrack({ home: "Arsenal", away: "Chelsea", scorer: "Bukayo Saka", scorerShort: "Saka", scorerHome: true, minute: 63, scoreAfter: [1, 0], seed: "prof-1" })!;
  const pr = 2;
  const record = (C: Ctor, edit: ReturnType<typeof makeEdit>, tt: number, count: boolean) => {
    const W = edit.w * pr, H = edit.h * pr;
    const rec = Skia.PictureRecorder();
    const raw = rec.beginRecording(Skia.XYWHRect(0, 0, W, H));
    const pc = count ? counted(raw) : raw;
    pc.saveLayer();
    const ctx = new C(count ? SkiaCounted : Skia, pc, { width: edit.w, height: edit.h, base: [pr, 0, 0, pr, 0, 0] }) as { reset(): void };
    const a = performance.now();
    withCanvasDocument(Skia, () => drawEditFrame(ctx as unknown as CanvasRenderingContext2D, edit, tt));
    ctx.reset();
    pc.restore();
    const ms = performance.now() - a;
    return { ms, pic: rec.finishRecordingAsPicture() };
  };
  // JS alone: the same frame into a Skia that does nothing (every call returns at once), so what is
  // left is the drawing's own JavaScript (on a phone Skia's side runs as native code).
  const stub: object = new Proxy(function () {} as object, {
    get: (_t, k) => (k === "then" ? undefined : stub),
    apply: () => stub,
  });
  const recordJs = (C: Ctor, edit: ReturnType<typeof makeEdit>, tt: number) => {
    const ctx = new C(stub, stub, { width: edit.w, height: edit.h, base: [pr, 0, 0, pr, 0, 0] }) as { reset(): void };
    const a = performance.now();
    withCanvasDocument(Skia, () => drawEditFrame(ctx as unknown as CanvasRenderingContext2D, edit, tt));
    ctx.reset();
    return performance.now() - a;
  };
  const pixels = (pic: ReturnType<typeof record>["pic"], W: number, H: number) => {
    const s = Skia.Surface.Make(W, H)!;
    const c = s.getCanvas(); c.clear(Float32Array.of(0, 0, 0, 1) as never); c.drawPicture(pic); s.flush();
    const im = s.makeImageSnapshot();
    const out = { px: im.readPixels(0, 0, { width: W, height: H, colorType: 4, alphaType: 3 }) as Uint8Array, png: PNG ? im.encodeToBytes() : new Uint8Array() };
    (im as unknown as { dispose(): void }).dispose(); (s as unknown as { dispose(): void }).dispose();
    return out;
  };
  const free = (p: unknown) => (p as { dispose(): void }).dispose();
  const q = (xs: number[], p: number) => { const s = [...xs].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
  let worst = 0;
  for (const style of ["broadcast", "reverse", "fan", "tiktok"] as ClipStyle[]) {
    const edit = makeEdit([t], style, "new", 0);
    const frames = Math.floor(editDuration(edit) * edit.fps);
    // Warm up (sprite tints, fonts, caches) so the numbers are the steady state.
    for (let f = 1; f < frames; f += 15) free(record(Ctx2D as unknown as Ctor, edit, f / edit.fps, false).pic);
    const ms: number[] = [], refMs: number[] = [], js: number[] = [], refJs: number[] = [];
    let callSum = 0, n = 0, diffFrames = 0, compared = 0;
    for (let f = 1; f < frames; f += 3) {
      const r = record(Ctx2D as unknown as Ctor, edit, f / edit.fps, false);
      ms.push(r.ms);
      js.push(recordJs(Ctx2D as unknown as Ctor, edit, f / edit.fps));
      if (Ref) refJs.push(recordJs(Ref, edit, f / edit.fps));
      calls = 0; free(record(Ctx2D as unknown as Ctor, edit, f / edit.fps, true).pic); callSum += calls; n++;
      if (Ref) {
        const o = record(Ref, edit, f / edit.fps, false);
        refMs.push(o.ms);
        if (f % 9 === 1) {
          const W = edit.w * pr, H = edit.h * pr;
          const a = pixels(r.pic, W, H), b = pixels(o.pic, W, H);
          let big = 0;
          for (let i = 0; i < a.px.length; i += 4) {
            const d = Math.max(Math.abs(a.px[i] - b.px[i]), Math.abs(a.px[i + 1] - b.px[i + 1]), Math.abs(a.px[i + 2] - b.px[i + 2]));
            if (d > 8) big++;
          }
          const share = big / (W * H);
          worst = Math.max(worst, share);
          compared++;
          if (share > 0.001) diffFrames++;
          if (PNG && f % 45 === 1) {
            fs.writeFileSync(path.join(PNG, `${style}-${f}-new.png`), Buffer.from(a.png));
            fs.writeFileSync(path.join(PNG, `${style}-${f}-ref.png`), Buffer.from(b.png));
          }
        }
        free(o.pic);
      }
      free(r.pic);
    }
    console.log(`${style.padEnd(9)} ${edit.w}x${edit.h}: record a frame median ${q(ms, 0.5).toFixed(1)} ms p95 ${q(ms, 0.95).toFixed(1)} ms; Skia calls a frame ${Math.round(callSum / n)}; JS alone median ${q(js, 0.5).toFixed(1)} ms` +
      (Ref ? `; reference median ${q(refMs, 0.5).toFixed(1)} ms, JS alone ${q(refJs, 0.5).toFixed(1)} ms; ${diffFrames}/${compared} frames differ` : ""));
  }
  if (args.includes("--calls")) console.log("calls by kind (all cuts):", [...byName.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, v]) => `${k} ${v}`).join(", "));
  if (Ref) console.log(`worst frame: ${(worst * 100).toFixed(3)}% of pixels differ by more than 8/255`);
}
void main();
