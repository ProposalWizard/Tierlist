// The page side of the worker experiment. A UI ticker (what a CSS spinner,
// a scroll or a button press feels) runs on the main thread the whole time;
// we record its worst gap while the scene loads and draws.
import { buildMini } from "./mini";
const W: any = window;
W.__ui = { gaps: [] as number[], last: 0 };
const tick = (t: number) => { if (W.__ui.last) W.__ui.gaps.push(t - W.__ui.last); W.__ui.last = t; requestAnimationFrame(tick); };
requestAnimationFrame(tick);
W.__mini = { frames: [] as { ms: number; at: number }[], t0: 0, first: 0 };
W.runMini = (mode: "main" | "worker") => {
  const c = document.createElement("canvas");
  c.style.cssText = "position:fixed;inset:0;width:100%;height:100%";
  document.getElementById("stage")!.appendChild(c);
  const w = innerWidth, h = innerHeight, pr = Math.min(1.5, devicePixelRatio);
  W.__ui.gaps = []; W.__mini.t0 = performance.now();
  const rec = (ms: number, first: boolean, at = performance.now()) => { if (first) W.__mini.first = at - W.__mini.t0; W.__mini.frames.push({ ms, at }); };
  if (mode === "main") {
    buildMini(c, w, h, pr, location.origin, (ms, first) => rec(ms, first)).catch((e) => { W.__err = String(e); });
  } else {
    const off = c.transferControlToOffscreen();
    const wk = new Worker("mini-worker.js");
    wk.onmessage = (e) => { if (e.data.err) W.__err = e.data.err; else rec(e.data.ms, e.data.first, e.data.at - performance.timeOrigin); };
    wk.postMessage({ canvas: off, w, h, pr, base: location.origin }, [off]);
  }
};
