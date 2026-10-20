/**
 * THE LAG TEST'S RECORDER — the browser half (B18 step 0, 20 Oct 2026).
 *
 * Nothing here runs until a Lag test step is recording. One recording =
 * one step of the route (components/star/LagTest.tsx), 20–40 s. While it
 * runs it keeps:
 *   - every gap between two animation frames (its own measuring loop: it
 *     only reads the clock, it draws nothing and moves nothing);
 *   - long tasks and long animation frames, where the browser reports them
 *     (Chrome; an iPhone has neither);
 *   - a heartbeat: a 20 ms timer, and how late it fires. Works on an iPhone
 *     too, so a page that blocks is seen there;
 *   - every 2 s, the 3D counters on window.__frame3d (lib/star/three3d/frameStats.ts)
 *     and the 3D governor's rung, read only;
 *   - the JS heap at the start and the end (Chrome only);
 *   - which match phases were on screen (window.__starMatch, dev builds only).
 * Time the page is hidden (another app, the lock screen) is not counted.
 *
 * The maths that turns this into p95 and a ✓/✗ is lib/star/lagTest.ts.
 */
import { frameStats, percentile, type LagFacts, type LagStepResult, type Snap3d } from "./lagTest";
import { currentGovernor, GOV_LADDER } from "./three3d/governor";
import { quality3dSetting } from "./three3d/quality";
import { startFrameStats } from "./three3d/frameStats";

const HEARTBEAT_MS = 20;

export interface Recording {
  /** Visible milliseconds recorded so far. */
  visibleMs: () => number;
  /** Stop and summarise. Safe to call twice (the second call returns the same). */
  stop: () => Omit<LagStepResult, "id" | "title" | "status" | "three">;
}

type Win = Window & {
  __frame3d?: { draws: number; tris: number; jsMs: number; pixelRatio: number; fps: number; worstMs: number; t: number } | null;
  __starMatch?: { phase?: () => string };
};

const supports = (type: string): boolean => {
  try { return typeof PerformanceObserver !== "undefined" && (PerformanceObserver.supportedEntryTypes ?? []).includes(type); }
  catch { return false; }
};

function heapMB(): number | null {
  const m = (performance as Performance & { memory?: { usedJSHeapSize?: number } }).memory;
  return m && typeof m.usedJSHeapSize === "number" ? Math.round((m.usedJSHeapSize / 1048576) * 10) / 10 : null;
}

/** Start recording one step. */
export function startRecording(opts: { snapEveryMs?: number } = {}): Recording {
  const w = window as Win;
  const gaps: number[] = [];
  const beats: number[] = [];
  const snaps: Snap3d[] = [];
  const phases = new Set<string>();
  const heapStart = heapMB();
  let lt: { count: number; totalMs: number; maxMs: number } | null = supports("longtask") ? { count: 0, totalMs: 0, maxMs: 0 } : null;
  let loaf: { count: number; maxMs: number; blockingMs: number } | null = supports("long-animation-frame") ? { count: 0, maxMs: 0, blockingMs: 0 } : null;
  const observers: PerformanceObserver[] = [];

  let running = true;
  let hidden = document.visibilityState === "hidden";
  let hiddenMs = 0;
  let hiddenAt = hidden ? performance.now() : 0;
  let visibleStart = performance.now();
  let visibleSoFar = 0;

  // ── frames: the gap between one animation frame and the next ──
  let last = -1;
  let raf = 0;
  const onFrame = (t: number) => {
    if (!running) return;
    if (!hidden && last >= 0) gaps.push(t - last);
    last = hidden ? -1 : t;
    raf = requestAnimationFrame(onFrame);
  };
  raf = requestAnimationFrame(onFrame);

  // ── heartbeat: a timer that should fire every 20 ms ──
  let beatAt = performance.now() + HEARTBEAT_MS;
  let beatTimer: ReturnType<typeof setTimeout> | null = null;
  const beat = () => {
    if (!running) return;
    const now = performance.now();
    if (!hidden) beats.push(Math.max(0, now - beatAt));
    beatAt = now + HEARTBEAT_MS;
    beatTimer = setTimeout(beat, HEARTBEAT_MS);
  };
  beatTimer = setTimeout(beat, HEARTBEAT_MS);

  // ── long tasks / long animation frames ──
  if (lt) {
    try {
      const o = new PerformanceObserver((list) => {
        if (!lt || hidden) return;
        for (const e of list.getEntries()) { lt.count++; lt.totalMs += e.duration; lt.maxMs = Math.max(lt.maxMs, e.duration); }
      });
      o.observe({ type: "longtask", buffered: false });
      observers.push(o);
    } catch { lt = null; }
  }
  if (loaf) {
    try {
      const o = new PerformanceObserver((list) => {
        if (!loaf || hidden) return;
        for (const e of list.getEntries() as (PerformanceEntry & { blockingDuration?: number })[]) {
          loaf.count++; loaf.maxMs = Math.max(loaf.maxMs, e.duration); loaf.blockingMs += e.blockingDuration ?? 0;
        }
      });
      o.observe({ type: "long-animation-frame", buffered: false });
      observers.push(o);
    } catch { loaf = null; }
  }

  // ── 3D counters, the governor's rung, match phases (read only) ──
  const t0 = performance.now();
  const snap = () => {
    if (!running || hidden) return;
    const now = performance.now();
    const f = w.__frame3d;
    if (f && typeof f.t === "number" && now - f.t < 1500 && snaps.length < 30) {
      const g = currentGovernor();
      snaps.push({
        t: Math.round((now - t0) / 100) / 10, draws: f.draws, tris: Math.round(f.tris), jsMs: Math.round(f.jsMs * 10) / 10,
        pr: Math.round(f.pixelRatio * 100) / 100, fps: Math.round(f.fps), worst: Math.round(f.worstMs),
        rung: g ? g.index : null, tier: g ? GOV_LADDER[g.index]?.tier ?? null : null,
      });
    }
  };
  const snapTimer = setInterval(snap, opts.snapEveryMs ?? 2000);
  const phaseTimer = setInterval(() => {
    if (hidden || phases.size >= 12) return;
    try { const p = w.__starMatch?.phase?.(); if (typeof p === "string" && p) phases.add(p); } catch { /* not a match */ }
  }, 500);

  // ── hidden time is not counted ──
  const onVis = () => {
    const now = performance.now();
    if (document.visibilityState === "hidden" && !hidden) {
      hidden = true; hiddenAt = now; visibleSoFar += now - visibleStart; last = -1;
    } else if (document.visibilityState !== "hidden" && hidden) {
      hidden = false; hiddenMs += now - hiddenAt; visibleStart = now; beatAt = now + HEARTBEAT_MS;
    }
  };
  document.addEventListener("visibilitychange", onVis);

  const visibleMs = () => visibleSoFar + (hidden ? 0 : performance.now() - visibleStart);

  let result: ReturnType<Recording["stop"]> | null = null;
  const stop: Recording["stop"] = () => {
    if (result) return result;
    const seconds = Math.round(visibleMs() / 100) / 10;
    if (hidden) hiddenMs += performance.now() - hiddenAt;
    running = false;
    cancelAnimationFrame(raf);
    if (beatTimer) clearTimeout(beatTimer);
    clearInterval(snapTimer);
    clearInterval(phaseTimer);
    observers.forEach((o) => { try { o.disconnect(); } catch { /* gone */ } });
    document.removeEventListener("visibilitychange", onVis);
    const heapEnd = heapMB();
    const b = beats.slice().sort((x, y) => x - y);
    const r1 = (x: number) => Math.round(x * 10) / 10;
    result = {
      seconds,
      frames: frameStats(gaps),
      longTasks: lt ? { count: lt.count, totalMs: Math.round(lt.totalMs), maxMs: Math.round(lt.maxMs) } : null,
      loaf: loaf ? { count: loaf.count, maxMs: Math.round(loaf.maxMs), blockingMs: Math.round(loaf.blockingMs) } : null,
      heartbeat: b.length ? { n: b.length, p95: r1(percentile(b, 95)), max: r1(b[b.length - 1]), over50: b.filter((x) => x > 50).length } : null,
      frame3d: snaps,
      heapMB: heapStart !== null && heapEnd !== null ? [heapStart, heapEnd] : null,
      phases: Array.from(phases),
      hiddenMs: Math.round(hiddenMs),
    };
    return result;
  };
  return { visibleMs, stop };
}

/**
 * The idle frame gaps for the refresh-rate estimate: frames for `ms` while the
 * start screen sits still. Resolves with the gaps.
 */
export function sampleIdleGaps(ms = 2000): Promise<number[]> {
  return new Promise((resolve) => {
    const gaps: number[] = [];
    let last = -1;
    const end = performance.now() + ms;
    const tick = (t: number) => {
      if (last >= 0 && document.visibilityState !== "hidden") gaps.push(t - last);
      last = t;
      if (performance.now() < end) requestAnimationFrame(tick);
      else resolve(gaps);
    };
    requestAnimationFrame(tick);
  });
}

/** Turn on the 3D draw counters (the same ones the Speed readout uses) so window.__frame3d fills in. */
export function start3dCounters(): void {
  try { startFrameStats(); } catch { /* no 3D counters, still fine */ }
}

/** The graphics chip's name, where the browser tells (a throwaway WebGL context, released at once). */
function gpuName(): string | null {
  try {
    const c = document.createElement("canvas");
    const gl = (c.getContext("webgl") ?? c.getContext("experimental-webgl")) as WebGLRenderingContext | null;
    if (!gl) return null;
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const name = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return typeof name === "string" ? name.slice(0, 160) : null;
  } catch {
    return null;
  }
}

/** The device, once per run. */
export function deviceFacts(): LagFacts {
  const n = navigator as Navigator & { deviceMemory?: number; standalone?: boolean };
  let quality: string | null = null;
  try { quality = quality3dSetting(); } catch { quality = null; }
  let standalone = false;
  try { standalone = !!n.standalone || window.matchMedia("(display-mode: standalone)").matches || window.matchMedia("(display-mode: fullscreen)").matches; } catch { standalone = false; }
  return {
    ua: navigator.userAgent.slice(0, 400),
    screen: `${screen.width}×${screen.height}`,
    viewport: `${window.innerWidth}×${window.innerHeight}`,
    dpr: Math.round((window.devicePixelRatio || 1) * 100) / 100,
    cores: typeof n.hardwareConcurrency === "number" ? n.hardwareConcurrency : null,
    memGB: typeof n.deviceMemory === "number" ? n.deviceMemory : null,
    gpu: gpuName(),
    standalone,
    quality3d: quality,
    build: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || null,
    tzOffset: new Date().getTimezoneOffset(),
  };
}
