// Garden ↔ shop hopping, the mini scene entered 4 times in a row.
// fresh: a new WebGLRenderer (new context) each visit, old one disposed the
//        way the scenes do it today (traverse + renderer.dispose()).
// shared: one renderer kept (perf.ts acquire/release with late dispose).
import * as THREE from "three";
import { buildMini } from "./mini";
import { disposeObject3D } from "@/lib/star/three3d/perf";
const W: any = window;
W.runHop = async (mode: "fresh" | "shared", visits = 4) => {
  const out: any[] = [];
  let shared: THREE.WebGLRenderer | undefined;
  let lost = 0;
  let pending: THREE.Object3D | null = null;
  for (let v = 0; v < visits; v++) {
    const c = document.createElement("canvas");
    c.style.cssText = "position:fixed;inset:0;width:100%;height:100%";
    c.addEventListener("webglcontextlost", () => { lost++; });
    const t0 = performance.now();
    let firstMs = 0, frames = 0;
    let done: () => void = () => {};
    const got = new Promise<void>((r) => { done = r; });
    let stage: HTMLElement = document.getElementById("stage")!;
    if (mode === "fresh" || !shared) stage.appendChild(c); else stage.appendChild(shared.domElement);
    const h = await buildMini(mode === "fresh" || !shared ? c : null, innerWidth, innerHeight, 1, location.origin, (ms, first) => { if (first) firstMs = ms; if (++frames >= 3) done(); }, mode === "shared" ? shared : undefined);
    if (mode === "shared") shared = h.renderer;
    await got;
    if (pending) { disposeObject3D(pending); pending = null; } // late: after this scene compiled
    const entry = performance.now() - t0;
    out.push({ visit: v + 1, entryMs: Math.round(entry), firstFrameMs: Math.round(firstMs), programs: h.renderer.info.programs?.length });
    h.stop();
    if (mode === "fresh") { disposeObject3D(h.scene); h.renderer.dispose(); h.renderer.domElement.remove(); }
    else { h.renderer.domElement.remove(); pending = h.scene; }
  }
  W.__hop = { out, lost };
};
