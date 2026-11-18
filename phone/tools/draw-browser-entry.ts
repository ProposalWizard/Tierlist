// Bundled by tools/draw-check.ts for a real browser: draws every scene on a
// browser <canvas>, the way the website does, and hands back PNG data URLs.
import { fitFace } from "@/lib/star/faceFit";
import { SCENES } from "../src/draw/testScenes";

(window as unknown as { __drawScenes: (faceDataUrl: string) => Promise<Record<string, string>> }).__drawScenes = async (faceDataUrl) => {
  // The face from a blob: address (a data: address would read as a scanned photo).
  const blob = await (await fetch(faceDataUrl)).blob();
  const img = new Image();
  img.src = URL.createObjectURL(blob);
  await img.decode();
  const fitted = fitFace(img);
  const out: Record<string, string> = {};
  const env = { fitted, layer: (w: number, h: number) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; } };
  for (const s of SCENES) {
    const c = document.createElement("canvas");
    c.width = s.w; c.height = s.h;
    const g = c.getContext("2d")!;
    try { s.draw(g, env); } catch (e) { out[s.name] = "error:" + String(e); continue; }
    out[s.name] = c.toDataURL("image/png");
  }
  return out;
};
