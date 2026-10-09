import * as T from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  DynamicResolution, FrameGate, cameraMoved, tierFromBenchMs, tierHintFromGpu, TIER_PROFILES,
  mergeStaticByMaterial, instanceRepeats, disposeObject3D,
} from "../../lib/star/three3d/perf";
import { Governor, GOV_LADDER, rungForTier, governedPixelRatio } from "../../lib/star/three3d/governor";
import { autoTierFromDevice, deviceKind, stepDownTier, shadowSizeFor, parseQuality3d, quality3dTier, type DeviceInfo } from "../../lib/star/three3d/quality";

/**
 * THE SHARED 3D PERFORMANCE LAYER (lib/star/three3d/perf.ts) — the parts
 * that need no GPU: the render-scale controller, the frame gate, the tier
 * picks, and the scene-graph helpers (merge, instance, dispose).
 */
const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

// ── DynamicResolution: down fast on slow frames, up slowly, never past the tier's limits ──
{
  let pr = 0;
  const fake = { setPixelRatio: (v: number) => { pr = v; } } as unknown as T.WebGLRenderer;
  const prof = TIER_PROFILES.medium;
  const dyn = new DynamicResolution(fake, prof, { devicePixelRatio: 3 });
  check(pr === prof.maxPixelRatio, `starts at the tier ceiling (${prof.maxPixelRatio}), got ${pr}`);
  let t = 1000;
  for (let i = 0; i < 40; i++) { t += 60; dyn.frame(t); } // 16 fps for 2.4 s
  check(pr < prof.maxPixelRatio && pr >= prof.minPixelRatio, `slow frames lower the scale (got ${pr})`);
  for (let i = 0; i < 400; i++) { t += 60; dyn.frame(t); }
  check(pr === prof.minPixelRatio, `never below the floor ${prof.minPixelRatio} (got ${pr})`);
  const low = pr;
  for (let i = 0; i < 150; i++) { t += 16.7; dyn.frame(t); } // 2.5 s of fast frames
  check(pr === low, `does not climb back within 4 s (got ${pr})`);
  for (let i = 0; i < 2000; i++) { t += 16.7; dyn.frame(t); }
  check(pr === prof.maxPixelRatio, `fast frames climb back to the ceiling (got ${pr})`);
}

// ── an up-step that has to come straight back down is not retried for 15 s ──
{
  let pr = 0, changes = 0;
  const fake = { setPixelRatio: (v: number) => { pr = v; changes++; } } as unknown as T.WebGLRenderer;
  const dyn = new DynamicResolution(fake, { maxPixelRatio: 2, minPixelRatio: 0.5, fpsCap: 60 }, { devicePixelRatio: 2 });
  let t = 1000;
  // a phone that can hold 60 fps only at 1.0: slow above it, fast at or below it
  for (let i = 0; i < 6000; i++) { t += pr > 1 ? 40 : 16.7; dyn.frame(t); }
  check(changes < 12, `no flicker between two sizes (${changes} changes in ${(t / 1000).toFixed(0)} s)`);
  check(pr <= 1.25, `settles at a size it can hold (got ${pr})`);
}

// ── FrameGate ──
{
  const g = new FrameGate({ fpsCap: 30 });
  let drawn = 0;
  for (let i = 0; i < 120; i++) { if (g.shouldRender(i * 16.67, true)) drawn++; }
  check(drawn >= 58 && drawn <= 62, `a 30 cap draws every other 60 Hz tick (drew ${drawn}/120)`);
  const still = new FrameGate({ fpsCap: 60 });
  let n = 0;
  for (let i = 0; i < 60; i++) if (still.shouldRender(i * 16.67)) n++;
  check(n === 2, `render-on-demand: nothing moved → only the first frames draw (drew ${n})`);
  still.invalidate();
  check(still.shouldRender(2000), "invalidate() draws again");
  const cam = new T.PerspectiveCamera();
  const memo: number[] = [];
  check(cameraMoved(cam, memo), "first look counts as moved");
  check(!cameraMoved(cam, memo), "a still camera is not moved");
  cam.position.x = 0.5;
  check(cameraMoved(cam, memo), "a moved camera is moved");
}

// ── tiers ──
check(tierFromBenchMs(3) === "high" && tierFromBenchMs(10) === "medium" && tierFromBenchMs(40) === "low", "bench ms → tier");
check(tierHintFromGpu("ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)))") === "low", "SwiftShader is low");
check(tierHintFromGpu("Mali-T880") === "low", "old Mali is low");
check(tierHintFromGpu("Adreno (TM) 740") === "high", "Adreno 740 is high");
check(tierHintFromGpu("Apple GPU") === null, "iPhones are left to the benchmark");
check(TIER_PROFILES.low.fpsCap === 30 && !TIER_PROFILES.low.shadows, "low tier: 30 fps, no shadows");

// ── pause(): resting at 30 a second on purpose is not read as slow ──
{
  const run = (usePause: boolean) => {
    let pr = 0;
    const dyn = new DynamicResolution({ setPixelRatio: (v: number) => { pr = v; } }, { maxPixelRatio: 1, minPixelRatio: 0.6, fpsCap: 60 }, { step: 0.125, devicePixelRatio: 3 });
    let t = 1000;
    for (let round = 0; round < 4; round++) {
      for (let i = 0; i < 60; i++) { t += 16.7; dyn.frame(t); } // walking, holding 60
      for (let i = 0; i < 90; i++) { t += 33.3; if (usePause) dyn.pause(); else dyn.frame(t); } // standing still, 30 a second
    }
    return pr;
  };
  check(run(false) < 1, "control: judging the resting 30 a second as slow would lower the picture");
  check(run(true) === 1, `pause(): resting at 30 doesn't lower the moving picture (got ${run(true)})`);
}

// ── each tier's caps (High must stay exactly the 5 Oct New look) ──
{
  const H = TIER_PROFILES.high, M = TIER_PROFILES.medium, L = TIER_PROFILES.low;
  // 9 Oct 2026: smooth edges on a 3x phone on every tier (antialias, never under 1.25 px/pt on Medium and High)
  check(H.maxPixelRatio === 2 && H.movePixelRatio === 1.5 && H.minPixelRatio >= 1.25 && H.antialias && H.shadows && H.fpsCap === 60 && H.stillFps === 20 && H.outlines,
    "High: 2 still / 1.5 moving, antialias, shadows, 60 moving / 20 still, outlines");
  check(shadowSizeFor(H, 2048) === 2048 && shadowSizeFor(H, 1024) === 1024, "High keeps each scene's own shadow map (garden 2048, shop 1024)");
  check(M.maxPixelRatio === 1.5 && M.minPixelRatio >= 1.25 && M.antialias && M.shadows && shadowSizeFor(M, 2048) === 1024 && shadowSizeFor(M, 1024) === 512 && M.fpsCap === 60 && !M.outlines,
    "Medium: 1.5 still and moving, antialias, half-size shadows, 60 moving, no outlines");
  check(L.maxPixelRatio === 1.25 && L.antialias && !L.shadows && shadowSizeFor(L, 2048) === 0 && L.fpsCap === 30 && L.stillFps === 20 && !L.outlines,
    "Low: 1.25, antialias, no shadows, 30 moving / 20 still, no outlines");
  for (const p of [H, M, L]) check(p.minPixelRatio <= p.movePixelRatio && p.movePixelRatio <= p.maxPixelRatio, `${p.tier}: floor <= moving <= still`);
  check(H.maxPixelRatio > M.maxPixelRatio && M.maxPixelRatio > L.maxPixelRatio, "each tier down draws fewer pixels standing still");
  check(stepDownTier("high") === "medium" && stepDownTier("medium") === "low" && stepDownTier("low") === null, "a slow scene steps down one tier at a time");
  check(parseQuality3d("med") === "medium" && parseQuality3d("low") === "low" && parseQuality3d("x") === null && parseQuality3d(null) === null, "?q= on a test page");
  check(quality3dTier() === "high", "no browser (node): Auto reads as a desktop, High");
}

// ── Auto from fake device info ──
{
  const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
  const IPAD = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
  const ANDROID = "Mozilla/5.0 (Linux; Android 14; SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36";
  const DESKTOP = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36";
  const pick = (d: DeviceInfo) => autoTierFromDevice(d);
  check(deviceKind({ ua: IPHONE }) === "iphone" && deviceKind({ ua: IPAD, platform: "MacIntel", touchPoints: 5 }) === "ipad"
    && deviceKind({ ua: IPAD, platform: "MacIntel", touchPoints: 0 }) === "desktop" && deviceKind({ ua: ANDROID }) === "android" && deviceKind({ ua: DESKTOP }) === "desktop",
    "device kind: iPhone, iPad (says Mac but has touch), a real Mac, Android, desktop");
  check(pick({ dpr: 3, ua: IPHONE, cores: 6 }) === "medium", "iPhone: Medium");
  check(pick({ dpr: 2, ua: IPAD, platform: "MacIntel", touchPoints: 5 }) === "high", "iPad: High");
  check(pick({ dpr: 2.625, ua: ANDROID, memoryGb: 8, cores: 8 }) === "medium", "mid-range Android (8 GB, 8 cores): Medium");
  check(pick({ dpr: 2, ua: ANDROID, memoryGb: 2, cores: 8 }) === "low" && pick({ dpr: 2, ua: ANDROID, memoryGb: 4, cores: 4 }) === "low", "a 2 GB or 4-core Android: Low");
  check(pick({ dpr: 3, ua: ANDROID, memoryGb: 8, cores: 8, gpuHint: "high" }) === "medium", "Android, even a flagship GPU: Medium (phones start on Medium, 9 Oct 2026)");
  check(pick({ dpr: 1, ua: DESKTOP, memoryGb: 8, cores: 8 }) === "high" && pick({ dpr: 2, ua: DESKTOP }) === "high", "desktop: High");
  check(pick({ dpr: 1, ua: DESKTOP, memoryGb: 4, cores: 4 }) === "medium", "a 4 GB desktop: Medium");
  check(pick({ dpr: 1, ua: DESKTOP, memoryGb: 8, cores: 8, gpuHint: "low" }) === "low", "software-drawn / weak GPU caps it at Low");
  check(pick({ dpr: 1, ua: DESKTOP, memoryGb: 8, cores: 8, gpuHint: "medium" }) === "medium", "a mid GPU caps it at Medium");
  check(pick({ dpr: 3, ua: IPHONE, gpuHint: null }) === "medium", "iPhone's GPU says only 'Apple GPU' (no hint): still Medium");
}

// ── mergeStaticByMaterial: one draw per material, same picture ──
{
  const root = new T.Scene();
  const a = new T.MeshStandardMaterial(), b = new T.MeshStandardMaterial();
  const geo = new T.BoxGeometry(1, 1, 1);
  for (let i = 0; i < 10; i++) { const m = new T.Mesh(geo, i % 2 ? a : b); m.position.set(i, 0, 0); root.add(m); }
  const moving = new T.Mesh(geo, a); moving.userData.dynamic = true; root.add(moving);
  const res = mergeStaticByMaterial(T, mergeGeometries, root);
  let meshes = 0; root.traverse((o) => { if ((o as T.Mesh).isMesh) meshes++; });
  check(res.before === 11 && res.after === 3 && meshes === 3, `11 meshes → 2 merged + 1 dynamic (got ${res.before}→${res.after}, ${meshes} in scene)`);
  const box = new T.Box3().setFromObject(root);
  check(Math.abs(box.min.x + 0.5) < 1e-6 && Math.abs(box.max.x - 9.5) < 1e-6, "merged geometry keeps every box where it was");
}

// ── instanceRepeats ──
{
  const root = new T.Group();
  const mat = new T.MeshStandardMaterial(), geo = new T.CylinderGeometry(0.1, 0.1, 1);
  for (let i = 0; i < 12; i++) { const m = new T.Mesh(geo, mat); m.position.set(i, 0, 0); root.add(m); }
  const made = instanceRepeats(T, root, 4);
  check(made === 1 && root.children.length === 1 && (root.children[0] as T.InstancedMesh).count === 12, "12 fence posts → one InstancedMesh");
}

// ── disposeObject3D frees geometry, materials and their textures once each ──
{
  const root = new T.Scene();
  const tex = new T.Texture();
  let texFreed = 0, matFreed = 0, geoFreed = 0;
  tex.addEventListener("dispose", () => texFreed++);
  const mat = new T.MeshStandardMaterial({ map: tex, normalMap: tex });
  mat.addEventListener("dispose", () => matFreed++);
  const geo = new T.BoxGeometry();
  geo.addEventListener("dispose", () => geoFreed++);
  root.add(new T.Mesh(geo, mat), new T.Mesh(geo, mat));
  disposeObject3D(root);
  check(texFreed === 1 && matFreed === 1 && geoFreed === 1, `each thing freed once (tex ${texFreed}, mat ${matFreed}, geo ${geoFreed})`);
}

// ── the governor (three3d/governor.ts): one rung down after ~2.5 s of slow frames, one back up after 8 s of fast; stalls ignored ──
{
  const changes: string[] = [];
  const g = new Governor({ start: "medium", onChange: (r, i, why) => changes.push(`${why}:${i}:${r.tier}`) });
  check(g.index === rungForTier("medium") && g.index === 1 && g.tier === "medium", "a phone opens on Medium (rung 1)");
  check(GOV_LADDER[1].shadows === "full" && GOV_LADDER[1].post === "full" && GOV_LADDER[1].pixelRatio === 2, "Medium as built: nothing given up while it keeps up");
  let t = 1000;
  const run = (ms: number, forS: number, cap = 60) => { const end = t + forS * 1000; while (t < end) { t += ms; g.frame(t, cap); } };
  run(16.7, 5);
  check(g.index === 1 && g.downs === 0, "60 fps: stays put");
  run(33, 6, 30);
  check(g.index === 1, "a scene capped at 30 on purpose is not slow");
  t += 1000; g.frame(t); // a pause: the window starts again
  run(28, 2);
  check(g.index === 1, "under 2.5 s of slow frames: no step yet");
  run(28, 0.6);
  check(g.index === 2 && g.downs === 1, `2.5 s at ~36 fps: one rung down (now ${g.index})`);
  check(GOV_LADDER[2].pixelRatio === 1.5 && GOV_LADDER[2].shadows === "full" && GOV_LADDER[2].post === "full", "the first thing given up is the moving picture's pixels (to 1.5, no lower)");
  run(28, 10);
  check(g.index === 2, `36 fps sustained: the ordinary rule stops at rung 2, keeping shadows and post (now ${g.index})`);
  run(40, 5.5);
  check(g.index === 3 && g.rung.shadows === "lite" && g.rung.post === "lite", `then, only under 30 fps for 5 s, one light pass and blob shadows (now ${g.index})`);
  run(80, 30);
  check(g.index === GOV_LADDER.length - 1 && g.rung.shadows === "off" && g.rung.post === "off", "the bottom: no live shadows, no post pass; never lower");
  t += 1000; g.frame(t);
  run(16.7, 6);
  check(g.index === GOV_LADDER.length - 1, "not fast for long enough yet: no step up");
  run(16.7, 2.5);
  check(g.index === GOV_LADDER.length - 2 && g.ups === 1, `8 s at full rate: one rung back up (now ${g.index})`);
  run(16.7, 3.5);
  t += 1000; g.frame(t);
  run(40, 6);
  check(g.index === GOV_LADDER.length - 1, "slow again soon after: back down");
  run(16.7, 30);
  check(g.index === GOV_LADDER.length - 1, "it bounced: no climb for a minute");
  run(16.7, 40);
  check(g.index < GOV_LADDER.length - 1, `a minute after the bounce it may climb again (now ${g.index})`);
}
// ── Harry's iPhone (9 Oct): 60 fps with one-off 500-730 ms stalls at each chance start is NOT slow ──
{
  const g = new Governor({ start: "medium" });
  let t = 1000;
  for (let s = 0; s < 180; s += 20) {
    g.hush(t); t += 700; g.frame(t); // the stall at the chance start
    for (let i = 0; i < 6; i++) { t += 45; g.frame(t); } // a few slow frames right after
    const end = t + 19000; while (t < end) { t += 17; g.frame(t); }
  }
  check(g.index === 1 && g.downs === 0, `3 min of 60 fps with a stall every chance: stays on rung 1 (rung ${g.index}, downs ${g.downs})`);
  const g3 = new Governor({ start: "medium" });
  t = 1000; for (let i = 0; i < 300; i++) { t += 17; g3.frame(t); if (i % 40 === 0) { t += 200; g3.frame(t); } }
  check(g3.index === 1, "single long frames (no hush) are left out too");
  const g4 = new Governor({ start: "medium" });
  t = 1000; for (let i = 0; i < 2000; i++) { t += 30; g4.frame(t); }
  check(g4.index === 2, `33 fps sustained: never past rung 2 (rung ${g4.index})`);
  g.dispose(); g3.dispose(); g4.dispose();
}
{
  let t = 0;
  const g2 = new Governor({ start: "high" });
  t = 0; g2.frame(t); t += 5000; g2.frame(t); for (let i = 0; i < 300; i++) { t += 16.7; g2.frame(t); }
  check(g2.index === 0, "a 5 s gap (hidden tab, a menu) is not a slow frame");
  for (let i = 0; i < 2000; i++) { t += 16.7; g2.frame(t); }
  check(g2.index === 0 && g2.ups === 0, "never above the starting rung");
  let drawn = 0; t = 0;
  for (let i = 0; i < 60; i++) { t += 16.7; if (g2.shouldDraw(t, true)) drawn++; }
  check(drawn >= 18 && drawn <= 21, `a still screen draws ~20 a second (drew ${drawn})`);
  g2.setPaused("menu", true);
  check(!g2.shouldDraw(t + 100), "paused: no draw");
  g2.setPaused("menu", false);
  check(g2.shouldDraw(t + 200), "un-paused: draws");
  check(governedPixelRatio(2, GOV_LADDER[4], 3) === 1.5 && governedPixelRatio(2, GOV_LADDER[1], 3) === 2 && governedPixelRatio(2.5, GOV_LADDER[0], 1) === 1, "pixel ratio: never under 1.5 from the governor; the screen caps it");
  const frozen = new Governor({ start: "high", frozen: true });
  t = 0; for (let i = 0; i < 400; i++) { t += 60; frozen.frame(t); }
  check(frozen.index === 0, "frozen (?gov=0): never steps");
  g2.dispose(); frozen.dispose();
}

if (problems.length) {
  console.error("FAIL");
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log("PASS — the shared 3D layer: render scale holds the budget without flicker, the frame gate caps and skips, merges and instances keep the picture; each 3D quality tier gives its caps (High = today's New look) and Auto picks a sensible tier from fake device info; the governor steps one rung at a time, waits, climbs back once, ignores pauses");
