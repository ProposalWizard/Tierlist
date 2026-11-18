// Bundled twice by tools/three-check.ts for a real browser (Chromium, WebGL2):
//  - "phone": the phone's 3D path (src/three: its GLTFLoader with Skia-unpacked
//    pictures, the plain-JavaScript meshopt decoder, the patched GL context);
//  - "web": the website's own path (three's GLTFLoader, WebAssembly meshopt,
//    browser pictures), by aliasing those two files back.
// Each draws the same scenes; the check compares the pictures and reads the
// per-frame JavaScript time and draw counts.
import * as THREE from "three";
import CanvasKitInit from "canvaskit-wasm/bin/full/canvaskit.js";
import { JsiSkApi } from "@shopify/react-native-skia/lib/commonjs/skia/web/JsiSkia";
import { setThreePlatform } from "../src/three/platform";
import { prepareGl } from "../src/three/gl";
import { meshoptStats } from "../src/three/meshoptDecoder";
import { sceneBuildActive, takeGlCanvas } from "../src/three/env";
import { OffscreenCanvas2D } from "../src/draw/offscreen";
import { buildHomeScene } from "../src/three/homeScene";
import { setToonYou } from "@/lib/star/style3d/toon/bodies";
import { ovationPlan } from "@/lib/star/ovation";

declare const __MODE__: string;
const urls: string[] = [];

async function platform() {
  const CK = await (CanvasKitInit as unknown as (o: object) => Promise<unknown>)({ locateFile: (f: string) => "/" + f });
  const Skia = JsiSkApi(CK as never) as unknown as typeof import("@shopify/react-native-skia").Skia;
  const fontBytes = new Uint8Array(await (await fetch("/font-bold.ttf")).arrayBuffer());
  const face = Skia.Typeface.MakeFreeTypeFaceFromData(Skia.Data.fromBytes(fontBytes));
  const fontFor = (spec: { size: number }) => (face ? Skia.Font(face, spec.size) : null);
  if (__MODE__ === "phone") {
    // as on the phone: while a scene is built, its canvases are Skia's and its renderer takes the offered GL
    const d = document as unknown as { createElement: (t: string) => unknown; createElementNS: (n: string, t: string) => unknown };
    const ce = d.createElement.bind(document), cns = d.createElementNS.bind(document);
    d.createElement = (t: string) => (sceneBuildActive() && t.toLowerCase() === "canvas" ? new OffscreenCanvas2D(Skia, 300, 150, fontFor as never) : ce(t));
    d.createElementNS = (n: string, t: string) => (t.toLowerCase() === "canvas" ? takeGlCanvas() ?? cns(n, t) : cns(n, t));
  }
  setThreePlatform({
    Skia: Skia as never,
    fontFor: fontFor as never,
    bytes: async (url) => { urls.push(url); const r = await fetch(url); if (!r.ok) throw new Error(`${r.status} ${url}`); return r.arrayBuffer(); },
  });
}

const YOU = { body: "c2" as const, head: "h2" as const, skin: "#c68642", hair: "#2b1d14", name: "KANE" };

function glCanvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  document.body.appendChild(c);
  // the phone's GL view has no multisampling (expo-gl on Android): the phone path draws without it
  const gl = c.getContext("webgl2", { antialias: __MODE__ !== "phone", alpha: true, preserveDrawingBuffer: true })!;
  if (__MODE__ === "phone") prepareGl(gl);
  return { c, gl };
}

async function home(w: number, h: number, frames: number) {
  setToonYou(YOU);
  const { c, gl } = glCanvas(w, h);
  const r = new THREE.WebGLRenderer({ canvas: c, context: gl, antialias: true, alpha: true });
  r.setPixelRatio(1);
  r.setSize(w, h, false);
  const t0 = performance.now();
  const s = await buildHomeScene(r, { where: "home", width: w, height: h, kitShirt: "#d61f26", kitTrim: "#ffffff", num: 9, you: YOU });
  const buildMs = performance.now() - t0;
  // first frame (shaders and uploads), then a run of ordinary frames
  const f0 = performance.now();
  s.drawAt(0, s.restYaw);
  gl.finish();
  const firstMs = performance.now() - f0;
  const js: number[] = [];
  for (let i = 1; i <= frames; i++) { s.drawAt(i / 30, s.restYaw); js.push(s.info().jsMs); }
  s.drawAt(2.0, s.restYaw);
  gl.finish();
  const png = c.toDataURL("image/png");
  const info = s.info();
  s.dispose();
  r.dispose();
  c.remove();
  return { png, buildMs, firstMs, js, calls: info.calls, triangles: info.triangles };
}

async function farewell(which: "guard" | "ovation", w: number, h: number, at: number) {
  const div = document.createElement("div");
  div.style.cssText = `width:${w}px;height:${h}px;position:relative`;
  document.body.appendChild(div);
  const you = { skin: "#c68642", face: null, accessories: [], kit: { shirt: "#d61f26", trim: "#ffffff" }, number: 9, hair: "#2b1d14", hairStyle: "short" as const };
  const kits = { ours: { shirt: "#d61f26", trim: "#ffffff" }, rivals: { shirt: "#111827", trim: "#fbbf24" } };
  const t0 = performance.now();
  let h0: { debugSeek(t: number): void; debugInfo(): { calls: number; triangles: number }; dispose(): void };
  let canvas: HTMLCanvasElement;
  if (__MODE__ === "phone") {
    // the phone's way in: a GL of its own handed to the scene's renderer
    const { c, gl } = glCanvas(w, h);
    canvas = c;
    // the phone has no ResizeObserver (src/three/env.ts gives one that never fires)
    (window as unknown as { ResizeObserver: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
    const fs = await import("../src/three/farewellScenes");
    h0 = which === "guard"
      ? await fs.startGuardOfHonour(gl, { you, ...kits, seed: 7, tier: "medium" })
      : await fs.startOvation(gl, { you, ...kits, seed: 7, tier: "medium", plan: ovationPlan([{ id: "m1", name: "Saka", team: "ours" }, { id: "m2", name: "Rice", team: "ours" }], [{ id: "r1", name: "Haaland", team: "rivals" }], null) });
  } else {
    if (which === "guard") {
      const { createGuardScene } = await import("@/lib/star/farewell3d");
      h0 = await createGuardScene(div, { you, ...kits, seed: 7, tier: "medium" });
    } else {
      const { createOvationScene } = await import("@/lib/star/ovation3d");
      h0 = await createOvationScene(div, { you, ...kits, seed: 7, tier: "medium", plan: ovationPlan([{ id: "m1", name: "Saka", team: "ours" }, { id: "m2", name: "Rice", team: "ours" }], [{ id: "r1", name: "Haaland", team: "rivals" }], null) });
    }
    canvas = div.querySelector("canvas")!;
  }
  const buildMs = performance.now() - t0;
  // at < 0: the scene's own frame loop for 3 seconds instead of a still (JavaScript time of each frame it draws)
  const live: number[] = [];
  if (at < 0) {
    const realRaf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => realRaf((now) => { const a = performance.now(); cb(now); live.push(performance.now() - a); });
    await new Promise((r) => setTimeout(r, 3000));
    window.requestAnimationFrame = realRaf;
    const info = h0.debugInfo();
    h0.dispose();
    div.remove();
    canvas.remove();
    return { png: "", buildMs, seekMs: 0, live, calls: info.calls, triangles: info.triangles };
  }
  const s0 = performance.now();
  h0.debugSeek(at);
  const seekMs = performance.now() - s0;
  const png = canvas.toDataURL("image/png");
  const info = h0.debugInfo();
  h0.dispose();
  div.remove();
  return { png, buildMs, seekMs, live, calls: info.calls, triangles: info.triangles };
}

/** A card headshot: the phone's maker (src/three/headshotMaker.ts) vs the website's (lib/star/headshot3d/maker.ts). */
async function headshot(frame: "head" | "card") {
  const { headshotLookFor } = await import("@/lib/star/headshot3d/look");
  const looks = [
    headshotLookFor({ id: "you", you: true, kit: { shirt: "#d61f26", trim: "#ffffff" } }, YOU),
    headshotLookFor({ id: "Arsenal|B. Saka", kit: { shirt: "#ef0107", trim: "#ffffff" } }),
  ];
  const out: string[] = [];
  const ms: number[] = [];
  if (__MODE__ === "phone") {
    const m = await import("../src/three/headshotMaker");
    m.setHeadshotGl({ make: async () => document.createElement("canvas").getContext("webgl2", { antialias: false, alpha: true, premultipliedAlpha: true })!, drop: () => {} });
    const CK = await (CanvasKitInit as unknown as (o: object) => Promise<unknown>)({ locateFile: (f: string) => "/" + f });
    const Skia = JsiSkApi(CK as never) as unknown as typeof import("@shopify/react-native-skia").Skia;
    for (const l of looks) {
      const t0 = performance.now();
      const px = await m.shootHeadshot(l, frame);
      ms.push(performance.now() - t0);
      if (!px) { out.push(""); continue; }
      const img = Skia.Image.MakeImage({ width: px.width, height: px.height, colorType: 4, alphaType: 2 } as never, Skia.Data.fromBytes(px.data), px.width * 4)!;
      out.push("data:image/png;base64," + img.encodeToBase64());
    }
  } else {
    const { benchHeadshot } = await import("@/lib/star/headshot3d/maker");
    for (const l of looks) {
      const t0 = performance.now();
      const r = await benchHeadshot(l, frame);
      ms.push(performance.now() - t0);
      out.push(r?.url ?? "");
    }
  }
  return { pngs: out, ms };
}

(window as unknown as Record<string, unknown>).__three = {
  ready: platform(),
  home, farewell, headshot,
  urls: () => Array.from(new Set(urls)),
  meshopt: () => meshoptStats,
};
