/**
 * 3D THAT RECOVERS, AND 3D SIZED FOR THE PHONE (27 Nov 2026).
 *
 * Harry: "The 3D toggle in-game doesn't take you to the 3D engine anymore … sometimes the 3D just
 * toggles off, it breaks, and then I can't get back into it." Mikey's Galaxy S20: "loads of lag in
 * the garden". The pure parts:
 *   1. a 3D place closed mid-load can't take the one renderer (three3d/perf.ts acquireRenderer);
 *   2. the match's stats bar always has a way back to 3D (matchView3d.ts match3dButtons);
 *   3. the GPU table: phone GPUs are never "high"; the S20's two chips are mid (quality.ts);
 *   4. the device caps: Apple and desktop unchanged, Android capped at 1.5 pixels per point;
 *   5. the automatic resolution: down fast, up slowly, never under its floor, no flicker (resScale.ts);
 *   6. the governor on an Android phone: pixels first, then shadows and post (governor.ts).
 *   7. the freeze (Harry, 27 Nov 2026: "it just shows like a frozen screen … we should never have a
 *      feature where we have to press tap to reload"): a 3D picture the phone took away is rebuilt
 *      silently twice a minute, and only then is "Tap to reload 3D" shown (three3d/autoHeal.ts).
 */
import { acquireRenderer, abandonedContainer, isAbandonedScene, ABANDONED_SCENE } from "../../lib/star/three3d/perf";
import { match3dButtons, type Match3dStatus } from "../../lib/star/matchView3d";
import { tierHintFromGpu, gpuClass, deviceCaps, autoTierFromDevice } from "../../lib/star/three3d/quality";
import { ResolutionScaler, cappedPixelRatio, resScale, resScaleState } from "../../lib/star/three3d/resScale";
import { Governor } from "../../lib/star/three3d/governor";
import { afterLoss, healReset, newHealState, AUTO_REBUILDS, HEAL_WINDOW_MS } from "../../lib/star/three3d/autoHeal";

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

// ── 1. a place closed mid-load never takes the renderer ──
check(abandonedContainer({ isConnected: false }), "a box off the page is abandoned");
check(!abandonedContainer({ isConnected: true }) && !abandonedContainer({}) && !abandonedContainer(null), "a box on the page (or no DOM) is not");
let made = 0;
const fakeT = { WebGLRenderer: class { constructor() { made++; } } } as unknown as typeof import("three");
let threw: unknown = null;
try { acquireRenderer(fakeT, { isConnected: false } as unknown as HTMLElement, { antialias: true, maxPixelRatio: 2 }); } catch (e) { threw = e; }
check(isAbandonedScene(threw) && (threw as Error).name === ABANDONED_SCENE, "acquireRenderer refuses a closed screen's box");
check(made === 0, "… without making a renderer or touching the one on screen");
check(!isAbandonedScene(new Error("x")) && !isAbandonedScene(null), "other errors are not 'abandoned'");

// ── 2. the stats bar always has a way back ──
const all: Match3dStatus[] = ["idle", "loading", "ready", "off", "lost"];
for (const on of [true, false]) for (const st of all) {
  const b = match3dButtons(on, st);
  check(b.retry !== b.toggle, `match ${on ? "3D" : "2D"} ${st}: exactly one button (retry ${b.retry}, toggle ${b.toggle})`);
}
check(match3dButtons(true, "off").retry, "a failed 3D build shows '3D ↻' (it used to hide the switch for good)");
check(match3dButtons(true, "lost").retry, "a lost 3D picture shows '3D ↻'");
check(match3dButtons(false, "off").toggle, "in 2D after a failed build, the 2D | 3D switch is still there");

// ── 3. the GPU table ──
check(tierHintFromGpu("Mali-G77 MP11") === "medium", "S20 (Exynos 990, Mali-G77): medium, was high");
check(tierHintFromGpu("Adreno (TM) 650") === "medium", "S20 (Snapdragon 865, Adreno 650): medium, was high");
check(tierHintFromGpu("Adreno (TM) 750") === "medium", "even the newest phone GPU is at most medium");
check(tierHintFromGpu("Mali-G52 MC2") === "low" && tierHintFromGpu("Adreno (TM) 610") === "low", "old phone GPUs: low");
check(tierHintFromGpu("Apple GPU") === null, "Apple says nothing (as before)");
check(tierHintFromGpu("ANGLE (NVIDIA, NVIDIA GeForce RTX 3060)") === "high", "desktop cards: high (as before)");
check(gpuClass("Mali-G77 MP11") === "android-mid" && gpuClass("Adreno (TM) 650") === "android-mid", "S20 chips: android-mid");
check(gpuClass("Adreno (TM) 740") === "android-high" && gpuClass("Mali-G715-Immortalis MC11") === "android-high", "2022+ chips: android-high");
check(gpuClass("Mali-G52") === "android-low" && gpuClass("PowerVR Rogue GE8320") === "android-low", "old chips: android-low");
check(gpuClass("Apple GPU") === "apple" && gpuClass("") === "unknown" && gpuClass("Google SwiftShader") === "software", "apple / unknown / software");

// ── 4. device caps ──
const S20_UA = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";
const IPHONE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const s20 = deviceCaps({ ua: S20_UA, dpr: 2.625, memoryGb: 8, cores: 8, gpu: "Mali-G77 MP11", cssPixels: 412 * 915 });
check(s20.scaled && s20.maxPixelRatio <= 1.5 && s20.maxPixelRatio >= 1.4, `S20: at most 1.5 pixels per point (got ${s20.maxPixelRatio})`);
check(s20.slowFloor === 4 && s20.minPixelRatio === 1, "S20: the slow rule may drop shadows and post; resolution floor 1");
const s20first = deviceCaps({ ua: S20_UA, dpr: 2.625, cssPixels: 412 * 915 });
check(s20first.scaled && s20first.maxPixelRatio <= 1.5, "S20 on its first visit (GPU not read yet): capped too");
const tab = deviceCaps({ ua: S20_UA, dpr: 2, gpu: "Mali-G77", cssPixels: 800 * 1280 });
check(tab.maxPixelRatio < 1.5 && tab.maxPixelRatio >= 1, `a big Android screen gets fewer pixels per point (got ${tab.maxPixelRatio})`);
const ip = deviceCaps({ ua: IPHONE_UA, dpr: 3, gpu: "Apple GPU" });
check(!ip.scaled && ip.maxPixelRatio === Infinity && ip.slowFloor === 2, "iPhone: no cap, the old slow rule (looks exactly the same)");
const mac = deviceCaps({ ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15", dpr: 2, gpu: "Apple M2" });
check(!mac.scaled && mac.maxPixelRatio === Infinity, "MacBook: no cap");
check(autoTierFromDevice({ ua: S20_UA, dpr: 2.625, memoryGb: 8, cores: 8, gpuHint: tierHintFromGpu("Mali-G77") }) === "medium", "S20 opens on Medium (never High)");
check(autoTierFromDevice({ ua: IPHONE_UA, dpr: 3 }) === "medium", "iPhone Auto unchanged: Medium");

// ── 5. the automatic resolution ──
check(cappedPixelRatio(2.5, 1.5, 1, 1) === 1.5, "a place asking 2.5 on an S20 gets 1.5");
check(cappedPixelRatio(2.5, 1.5, 1, 0.5) === 1, "never under the floor");
check(cappedPixelRatio(0.8, 1.5, 1, 1) === 0.8, "a place asking less than the floor keeps its own");
{
  const r = new ResolutionScaler({ floor: 0.67 });
  let t = 0;
  const run = (secs: number, ms: number, cap = 60) => { const end = t + secs * 1000; while (t < end) { t += ms; r.frame(t, ms, cap); } };
  run(1.4, 40); // 25 fps
  check(r.scale < 1, `25 fps: down within 1.4 s (scale ${r.scale})`);
  run(20, 40);
  check(Math.abs(r.scale - 0.67) < 1e-6, `keeps going down to its floor and stops there (scale ${r.scale})`);
  const before = r.scale;
  run(4, 16.7);
  check(r.scale === before, "4 s of full-rate frames: not yet up (up is slow)");
  run(30, 16.7);
  check(r.scale > before, `30 s of full-rate frames: back up (scale ${r.scale})`);
  const r2 = new ResolutionScaler(); t = 0;
  const run2 = (secs: number, ms: number, cap = 60) => { const end = t + secs * 1000; while (t < end) { t += ms; r2.frame(t, ms, cap); } };
  run2(10, 33.4, 30); // a scene capped at 30 on purpose is not slow
  check(r2.scale === 1 && r2.downs === 0, "a scene that aims at 30 a second is not read as slow");
  run2(5, 600); // a pause / a load: never judged
  check(r2.scale === 1, "long gaps (a load, a hidden tab) are not slowness");
  // flicker: count direction changes over a minute that sits on the edge
  const r3 = new ResolutionScaler(); t = 0; let changes = 0;
  r3.onChange(() => changes++);
  for (let i = 0; i < 60; i++) { const ms = r3.scale > 0.8 ? 26 : 16; const end = t + 1000; while (t < end) { t += ms; r3.frame(t, ms, 60); } }
  check(changes <= 12, `no flicker on the edge: ${changes} changes in a minute (≤ 12)`);
}

// ── 6. the governor on an Android phone: pixels first ──
{
  let now = 0;
  resScaleState.active = true;
  resScale.scale = 1; resScale.floor = 0.67; resScale.reset();
  const g = new Governor({ start: "medium", remember: false, slowFloor: 4, now: () => now } as never);
  const firstScale = () => { while (now < 1.4e3) { now += 40; g.frame(now); } };
  firstScale();
  check(resScale.scale < 1 && g.index === 1, `slow frames: the pixels go first (scale ${resScale.scale}, rung ${g.index})`);
  for (let i = 0; i < 40 * 25; i++) { now += 40; g.frame(now); }
  check(Math.abs(resScale.scale - 0.67) < 1e-6, "… down to the resolution floor");
  check(g.index >= 3, `then shadows and post (rung ${g.index}), never 3D off`);
  resScaleState.active = false;
  const gApple = new Governor({ start: "medium", remember: false, now: () => 0 } as never);
  let t = 0; for (let i = 0; i < 2000; i++) { t += 30; gApple.frame(t); }
  check(gApple.index === 2, `Apple / desktop: the old rule, pixels only at ~33 fps (rung ${gApple.index})`);
}

// ── 7. the freeze: lost 3D heals itself, the tap only as a last resort ──
{
  // A canvas whose context the phone took: on screen, no new frames (the frozen picture / sad-face box).
  // Before: the Home player kept that dead canvas and put it back on every return to Home; the match
  // showed "3D ↻" at once. Now each place asks afterLoss what to do.
  const h = newHealState();
  check(AUTO_REBUILDS === 2, "two silent rebuilds before any tap");
  check(afterLoss(h, 0) === "rebuild", "first freeze: rebuilt silently");
  check(afterLoss(h, 5_000) === "rebuild", "second freeze: rebuilt silently");
  check(afterLoss(h, 9_000) === "give-up", "third freeze within a minute: the fallback (tap to reload)");
  check(afterLoss(h, 9_000 + HEAL_WINDOW_MS) === "rebuild", "a minute later it is a one-off again: rebuilt silently");
  healReset(h);
  check(afterLoss(h, 10) === "rebuild" && afterLoss(h, 20) === "rebuild", "after a tap the count starts again");
  // the match while it heals: the 2D | 3D switch (no amber "3D ↻"), exactly as Match3DLayer passes it
  const healing = true;
  check(match3dButtons(true, healing ? "loading" : "lost").toggle, "match healing after a lost 3D: no '3D ↻' shown");
  check(match3dButtons(true, "lost").retry, "match after two failed heals: '3D ↻' (last resort)");
}

if (problems.length) {
  console.log(`recover3d: ${problems.length} problem(s)`);
  for (const p of problems) console.log("  ✗ " + p);
  process.exit(1);
}
console.log("recover3d: all checks pass");
