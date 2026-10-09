/**
 * THE 3D FRAME METER (Harry, 9 Oct 2026: "a lot of lag in the 3D areas"). The
 * build machine has no graphics chip, so a phone is the only true measure:
 * this puts a small readout in the corner of every 3D place —
 *   fps · slowest frame in the last 2 s · draw calls · triangles · pixel ratio · tier
 * — for admins and testers (and anyone with ?fps=1; ?fps=0 hides it).
 *
 * One file, no scene changes. It counts at the WebGL level (the browser's own
 * drawElements / drawArrays), so every renderer on the page is seen — the
 * shared one in three3d/perf.ts and the garden's, shop's, casino's own. (Three
 * makes `render` per renderer, not on its prototype, so it can't be wrapped
 * there.) Installed from acquireRenderer and withMeshopt, which every 3D scene
 * goes through. Cheap: a counter per draw call; the text changes twice a
 * second. It hides 3 s after the last 3D frame (leaving a 3D place).
 */
import { quality3dTier } from "./quality";

let installed = false;

function wanted(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  const q = new URLSearchParams(window.location.search).get("fps");
  if (q === "1") return Promise.resolve(true);
  if (q === "0") return Promise.resolve(false);
  return import("@/lib/useIsAdmin").then((m) => m.isTesterNow()).catch(() => false);
}

/** Start the meter (once per page). Safe to call from every scene. */
export function installFrameMeter(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;
  void wanted().then((on) => {
    if (!on) return;
    let inFrame = false, calls = 0, tris = 0, lastCalls = 0, lastTris = 0, lastStart = 0, lastDraw = 0, pr = 1;
    const starts: number[] = [];
    const gaps: { t: number; ms: number }[] = [];
    const endFrame = () => { inFrame = false; lastCalls = calls; lastTris = tris; calls = 0; tris = 0; };
    const count = (gl: WebGLRenderingContext | WebGL2RenderingContext, mode: number, n: number) => {
      const now = performance.now();
      if (!inFrame) {
        inFrame = true;
        if (lastStart) gaps.push({ t: now, ms: now - lastStart });
        starts.push(now);
        lastStart = now;
        queueMicrotask(endFrame);
        const c = gl.canvas as HTMLCanvasElement;
        if (c && c.clientWidth > 0) pr = c.width / c.clientWidth;
      }
      calls++;
      if (mode === 4) tris += n / 3;
      lastDraw = now;
    };
    const wrap = (proto: any) => {
      if (!proto || proto.__frameMeter) return;
      proto.__frameMeter = true;
      const de = proto.drawElements, da = proto.drawArrays, dei = proto.drawElementsInstanced, dai = proto.drawArraysInstanced;
      proto.drawElements = function (m: number, c: number, t: number, o: number) { count(this, m, c); return de.call(this, m, c, t, o); };
      proto.drawArrays = function (m: number, f: number, c: number) { count(this, m, c); return da.call(this, m, f, c); };
      if (dei) proto.drawElementsInstanced = function (m: number, c: number, t: number, o: number, k: number) { count(this, m, c * k); return dei.call(this, m, c, t, o, k); };
      if (dai) proto.drawArraysInstanced = function (m: number, f: number, c: number, k: number) { count(this, m, c * k); return dai.call(this, m, f, c, k); };
    };
    wrap(typeof WebGLRenderingContext !== "undefined" ? WebGLRenderingContext.prototype : null);
    wrap(typeof WebGL2RenderingContext !== "undefined" ? WebGL2RenderingContext.prototype : null);

    const el = document.createElement("div");
    el.setAttribute("data-frame-meter", "");
    Object.assign(el.style, {
      position: "fixed", left: "4px", top: "calc(env(safe-area-inset-top, 0px) + 4px)", zIndex: "2147483000",
      pointerEvents: "none", font: "700 10px/1.25 ui-monospace, Menlo, monospace", color: "#d1fae5",
      background: "rgba(0,0,0,0.62)", padding: "3px 5px", borderRadius: "5px", whiteSpace: "pre", display: "none",
    } as Partial<CSSStyleDeclaration>);
    document.body.appendChild(el);
    window.setInterval(() => {
      const now = performance.now();
      while (starts.length && now - starts[0] > 2000) starts.shift();
      while (gaps.length && now - gaps[0].t > 2000) gaps.shift();
      if (now - lastDraw > 3000) { el.style.display = "none"; return; }
      const fps = starts.length / 2;
      const slow = gaps.reduce((m, g) => Math.max(m, g.ms), 0);
      el.textContent = `${fps.toFixed(0)} fps  worst ${slow.toFixed(0)} ms\n${lastCalls} draws  ${(lastTris / 1000).toFixed(0)}k tris\npx ${pr.toFixed(2)}  ${quality3dTier()}`;
      el.style.display = "block";
    }, 500);
  });
}
