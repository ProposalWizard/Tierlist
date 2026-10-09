/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * What a 3D frame costs, counted at the WebGL level (the browser's own draw
 * calls), so every renderer on the page is seen without touching a scene.
 * Used by the frame meter (frameMeter.ts, ?fps=1) and by measuring scripts
 * (window.__frame3d). Per drawn frame:
 *   draws, tris      every draw call and its triangles
 *   shadowDraws      draws into a square, power-of-two target (a shadow map)
 *   skinnedDraws     draws with a skinning shader into the picture (not the shadow map)
 *   posts            full-screen passes (a target, or the screen, that gets one small draw)
 *   targets          render targets drawn into (the screen not counted)
 *   jsMs             the time the page spent in that frame's rAF callback
 * Off unless the meter is on. Cheap: a few counters per draw call.
 */
export interface FrameStat { draws: number; tris: number; shadowDraws: number; skinnedDraws: number; posts: number; targets: number; jsMs: number; pixelRatio: number; t: number }
export interface FrameSummary extends FrameStat { fps: number; worstMs: number; frames: number }

let started: { summary: () => FrameSummary | null } | null = null;

export function startFrameStats(): { summary: () => FrameSummary | null } {
  if (started) return started;
  if (typeof window === "undefined") return { summary: () => null };
  const frames: FrameStat[] = [];
  let cur: FrameStat | null = null;
  let curFb: any = null;
  let segFb: any = undefined, segDraws = 0, segVerts = 0;
  const fbSeen = new Set<any>();
  const kind = new WeakMap<object, "shadow" | "rt">();
  const skinnedProg = new WeakMap<object, boolean>();
  let curSkinned = false;
  let pr = 1;
  let inCb = false;

  const closeSeg = () => {
    if (cur && segFb !== undefined && segDraws === 1 && segVerts <= 6 && !(segFb && kind.get(segFb) === "shadow")) cur.posts++;
    segFb = undefined; segDraws = 0; segVerts = 0;
  };
  const endFrame = () => {
    if (!cur) return;
    closeSeg();
    cur.targets = fbSeen.size;
    fbSeen.clear();
    frames.push(cur);
    if (frames.length > 240) frames.shift();
    cur = null;
    (window as any).__frame3d = summary();
  };
  const begin = (gl: any) => {
    const c = gl.canvas as HTMLCanvasElement;
    if (c && c.clientWidth > 0) pr = c.width / c.clientWidth;
    cur = { draws: 0, tris: 0, shadowDraws: 0, skinnedDraws: 0, posts: 0, targets: 0, jsMs: 0, pixelRatio: pr, t: performance.now() };
    if (!inCb) queueMicrotask(endFrame);
  };
  const count = (gl: any, mode: number, n: number) => {
    if (!cur) begin(gl);
    const f = cur!;
    if (segFb !== curFb) { closeSeg(); segFb = curFb; }
    segDraws++; segVerts += n;
    f.draws++;
    if (mode === 4) f.tris += n / 3;
    if (curFb) {
      fbSeen.add(curFb);
      let k = kind.get(curFb);
      if (!k) {
        const v = gl.getParameter(gl.VIEWPORT);
        const w = v[2], h = v[3];
        k = w === h && w >= 128 && (w & (w - 1)) === 0 ? "shadow" : "rt";
        kind.set(curFb, k);
      }
      if (k === "shadow") { f.shadowDraws++; return; }
    }
    if (curSkinned) f.skinnedDraws++;
  };
  const wrap = (proto: any) => {
    if (!proto || proto.__frameStats) return;
    proto.__frameStats = true;
    const de = proto.drawElements, da = proto.drawArrays, dei = proto.drawElementsInstanced, dai = proto.drawArraysInstanced, bf = proto.bindFramebuffer, up = proto.useProgram;
    proto.drawElements = function (m: number, c: number, t: number, o: number) { count(this, m, c); return de.call(this, m, c, t, o); };
    proto.drawArrays = function (m: number, f: number, c: number) { count(this, m, c); return da.call(this, m, f, c); };
    if (dei) proto.drawElementsInstanced = function (m: number, c: number, t: number, o: number, k: number) { count(this, m, c * k); return dei.call(this, m, c, t, o, k); };
    if (dai) proto.drawArraysInstanced = function (m: number, f: number, c: number, k: number) { count(this, m, c * k); return dai.call(this, m, f, c, k); };
    proto.bindFramebuffer = function (target: number, fb: any) {
      if (target === 0x8d40 || target === 0x8ca9) curFb = fb; // FRAMEBUFFER / DRAW_FRAMEBUFFER
      return bf.call(this, target, fb);
    };
    proto.useProgram = function (p: any) {
      if (p) {
        let s = skinnedProg.get(p);
        if (s === undefined) { s = !!this.getUniformLocation(p, "boneTexture"); skinnedProg.set(p, s); }
        curSkinned = s;
      } else curSkinned = false;
      return up.call(this, p);
    };
  };
  wrap(typeof WebGLRenderingContext !== "undefined" ? WebGLRenderingContext.prototype : null);
  wrap(typeof WebGL2RenderingContext !== "undefined" ? WebGL2RenderingContext.prototype : null);

  // the page's own time per frame: the rAF callback that drew
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb: FrameRequestCallback) => raf((t) => {
    const a = performance.now();
    inCb = true;
    try { cb(t); } finally {
      inCb = false;
      const f = cur;
      if (f) { f.jsMs += performance.now() - a; endFrame(); }
    }
  });

  function summary(): FrameSummary | null {
    const now = performance.now();
    const recent = frames.filter((f) => now - f.t <= 4000);
    if (!recent.length) return null;
    const med = (k: keyof FrameStat) => { const a = recent.map((f) => f[k] as number).sort((x, y) => x - y); return a[Math.floor(a.length / 2)]; };
    let worst = 0;
    for (let i = 1; i < recent.length; i++) worst = Math.max(worst, recent[i].t - recent[i - 1].t);
    const span = Math.max(1, now - recent[0].t);
    return {
      draws: med("draws"), tris: Math.round(med("tris")), shadowDraws: med("shadowDraws"), skinnedDraws: med("skinnedDraws"),
      posts: med("posts"), targets: med("targets"), jsMs: med("jsMs"), pixelRatio: med("pixelRatio"), t: now,
      fps: recent.length / Math.max(0.5, span / 1000), worstMs: worst, frames: recent.length,
    };
  }
  started = { summary };
  (window as any).__frame3dAll = () => frames.slice();
  return started;
}
