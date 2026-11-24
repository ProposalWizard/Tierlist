/**
 * A STAR PASS REWARD ON ITS PODIUM, TO SPIN (the website's components/star/Podium3D.tsx, as a scene the walk host runs).
 *
 * The website's file is one React effect (it makes its own renderer, loads the podium and the reward, listens for the
 * pointer on its canvas, draws only while on screen); this is the same code taken out of React, shaped as the host's
 * `start(container, callbacks, data, { quality })`, so the phone's GL view (../three/Walk3D.tsx, ./Podium3D.tsx) runs it:
 *
 * - drag sideways to turn it; let go mid-drag and it keeps turning, slowing down (a flick spins it, a nudge barely moves it);
 * - a short tap zooms in on `zoom` (the sunglasses), another brings it back; the zoom follows his head live;
 * - a reward with clips plays "Idle" on a loop and drops in another every few seconds;
 * - it turns once on its own when it opens, so it reads as something you can spin.
 * The touches arrive as the pointer events the website's canvas gets (the host hands them to the container's listeners).
 * Drawn on a see-through GL view, so the card's own glow shows behind. Nothing is drawn while nothing changes.
 *
 * This file sits OUTSIDE phone/src/three on purpose: a GLTFLoader import from a file in that folder resolves to the
 * phone's own loader file itself (see ../three/signingDeps.ts), and here the phone's loader is what the import must find.
 *
 * Not carried over: the website's off-screen pause (an IntersectionObserver: the host pauses when the app goes to the
 * background and the screen lets the scene go when it closes) and the packed-picture twin of a model (the phone has no
 * WebAssembly: `__ktx2Off`, so the plain file is read, as lib/star/three3d/ktx2.ts does).
 */
import type * as THREE from "three";
import type { Live3D } from "@/lib/star/starPassRewards";
import { TIER_PROFILES, quality3dTier } from "@/lib/star/three3d/quality";
import { withMeshopt } from "@/lib/star/three3d/meshopt";
import { loadModel3d } from "@/lib/star/three3d/ktx2";
import type { WalkController, WalkStart } from "../three/walkHost";

const LENS_FOV = 28.7; // a 70 mm lens on a 36 mm sensor, as the Blender pictures use

export type PodiumData = Live3D;
export type PodiumCallbacks = Record<string, never>;
export interface PodiumController extends WalkController {
  /** The numbers the checks read. */
  debugInfo(): { rotation: number; zoomed: boolean; zoomMix: number; animated: boolean; frames: number };
  /** Turn it by hand (the check; the touch does the same through the pointer events). */
  debugSpin(dy: number): void;
  /** Tap it (the zoom). */
  debugTap(): void;
}
export type PodiumStart = WalkStart<PodiumData, PodiumCallbacks, PodiumController>;

export function loadPodiumStart(): PodiumStart {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("../three/gardenDeps"); // what the scenes load later with import() (RoomEnvironment …)
  return startPodium;
}

export const startPodium: PodiumStart = async (container, _cb, cfg, opts) => {
  const T = await import("three");
  const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
  const { RoomEnvironment } = await import("three/examples/jsm/environments/RoomEnvironment.js");

  const el = container as unknown as HTMLElement & { clientWidth: number; clientHeight: number };
  const w = el.clientWidth || cfg.w, h = el.clientHeight || cfg.h;
  // the phone's tier (Walk3D chose it: a small phone opens one step lower): Low has no shadows and no antialias
  const tier = opts.quality ?? quality3dTier();
  const prof = TIER_PROFILES[tier];
  const renderer = new T.WebGLRenderer({ antialias: prof.antialias, alpha: true });
  renderer.setPixelRatio(Math.min(tier === "high" ? 2 : prof.maxPixelRatio, (globalThis as { devicePixelRatio?: number }).devicePixelRatio || 1));
  renderer.setSize(w, h);
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = T.AgXToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.shadowMap.enabled = prof.shadows;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  const canvas = renderer.domElement;
  container.appendChild(canvas);

  const scene = new T.Scene();
  // The soft room's reflections. If the phone's GL has no float targets for it the scene keeps its plain lights (a little flatter).
  let pmrem: THREE.PMREMGenerator | null = null;
  let envOk = false;
  try {
    pmrem = new T.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.9;
    envOk = true;
  } catch (e) {
    console.warn("[podium 3D] no reflections here:", e);
    pmrem?.dispose(); pmrem = null;
  }
  // Blender (x, y, z) is three (x, z, -y).
  const B = (x: number, y: number, z: number) => new T.Vector3(x, z, -y);
  const key = new T.DirectionalLight(0xffffff, 2.6);
  key.position.copy(B(-4, -4, 7));
  key.castShadow = prof.shadows;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -3.5, right: 3.5, top: 3.5, bottom: -3.5, near: 1, far: 20 });
  key.shadow.bias = -0.0005;
  key.shadow.radius = 4;
  scene.add(key);
  const rim = new T.DirectionalLight(0xffffff, 1.6);
  rim.position.copy(B(3, 5, 5));
  scene.add(rim);
  scene.add(new T.HemisphereLight(0xdfe6ff, 0x2a1830, envOk ? 0.6 : 1.4));

  const camera = new T.PerspectiveCamera(LENS_FOV, w / h, 0.05, 100);
  if (w >= h) camera.fov = (2 * Math.atan(Math.tan((LENS_FOV * Math.PI) / 360) / (w / h)) * 180) / Math.PI;
  camera.updateProjectionMatrix();
  const tilt = (cfg.tilt * Math.PI) / 180;
  const homePos = new T.Vector3(0, cfg.look + cfg.dist / Math.tan(tilt), cfg.dist);
  const homeAt = new T.Vector3(0, cfg.look, 0);
  const zoomAt = cfg.zoom ? B(...cfg.zoom.at) : homeAt.clone();
  const zoomPos = zoomAt.clone().add(new T.Vector3(0, cfg.zoom ? cfg.zoom.dist * 0.18 : 0, cfg.zoom?.dist ?? 0));
  const camAt = homeAt.clone();
  camera.position.copy(homePos);
  camera.lookAt(camAt);

  const turntable = new T.Group();
  turntable.rotation.y = -0.6;
  scene.add(turntable);
  const loader = await withMeshopt(new GLTFLoader()); // meshopt-packed (scripts/perf3d/shrink-models.mjs)
  // No podium file: the stand is part of the model (the level-100 Golden Set).
  const [pod, item] = await Promise.all([
    cfg.podium ? loader.loadAsync(cfg.podium) : Promise.resolve({ scene: new T.Group() } as unknown as Awaited<ReturnType<typeof loader.loadAsync>>),
    loadModel3d(loader, cfg.item, (u) => loader.loadAsync(u)),
  ]);

  pod.scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.receiveShadow = true;
    // The neon rings glow brighter than glTF's plain emissive shows them.
    const mat = m.material as THREE.MeshPhysicalMaterial;
    if (mat.emissive && mat.emissive.getHex() !== 0) mat.emissiveIntensity = Math.max(mat.emissiveIntensity, 3.5);
    else mat.envMapIntensity = 0.55;
  });
  turntable.add(pod.scene);

  const holder = new T.Group();
  const at = cfg.itemAt ?? [0, 0, 0];
  holder.position.copy(B(at[0], at[1], at[2]));
  holder.scale.setScalar(cfg.itemScale ?? 1);
  holder.add(item.scene);
  turntable.add(holder);
  item.scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.castShadow = true;
    m.receiveShadow = true;
    m.frustumCulled = false; // a skinned body's box doesn't follow its moves
    const mats = (Array.isArray(m.material) ? m.material : [m.material]) as THREE.MeshPhysicalMaterial[];
    for (const mat of mats) {
      const n = (mat.name || "").toLowerCase();
      const isLens = n.includes("lens");
      const isWisp = /short0|hair|eyebrow|eyelash/.test(n);
      if (!isLens && "clearcoat" in mat) mat.clearcoat = 0;
      if (isLens) { mat.transparent = true; mat.depthWrite = false; mat.envMapIntensity = 1.6; }
      else if (isWisp) { mat.transparent = false; mat.alphaTest = 0.45; mat.depthWrite = true; }
      else { mat.transparent = false; mat.alphaTest = 0; mat.depthWrite = true; }
      if (n.includes("gold")) mat.envMapIntensity = 1.5;
      mat.needsUpdate = true;
    }
  });

  // The zoom follows his head live, wherever a step or a spin has put it.
  const headBone = cfg.zoom ? item.scene.getObjectByName("head") : undefined;
  const headPos = new T.Vector3();

  // Fidgeting: Idle on a loop, another clip dropped in every few seconds.
  let mixer: THREE.AnimationMixer | null = null;
  let current: THREE.AnimationAction | null = null;
  let idle: THREE.AnimationAction | null = null;
  let nextGesture = 2.5;
  let lastGesture = "";
  const gestures: THREE.AnimationAction[] = [];
  if (item.animations.length) {
    mixer = new T.AnimationMixer(item.scene);
    for (const clip of item.animations) {
      const a = mixer.clipAction(clip);
      if (clip.name === "Idle") { idle = a; a.setLoop(T.LoopRepeat, Infinity); }
      else { a.setLoop(T.LoopOnce, 1); a.clampWhenFinished = true; gestures.push(a); }
    }
    if (idle) { idle.play(); current = idle; }
    mixer.addEventListener("finished", () => {
      if (idle && current && current !== idle) {
        idle.reset().play();
        idle.crossFadeFrom(current, 0.45, false);
        current = idle;
        nextGesture = 2.5 + Math.random() * 3;
      }
    });
  }

  // Spinning by drag/swipe, with the spin carrying on after a flick. The pointer events are the website's (the host hands the touches to these listeners).
  let vel = 0;
  let dragging = false;
  let lastX = 0, lastT = 0, downX = 0, downT = 0;
  let zoomed = false;
  let zoomMix = 0;
  let hint = 1; // the one turn it makes on its own the first time it is seen
  let frames = 0;
  type P = { clientX: number; pointerId?: number };
  const onDown = (e: P) => {
    dragging = true; hint = 0;
    lastX = downX = e.clientX; lastT = downT = performance.now();
    vel = 0;
  };
  const onMove = (e: P) => {
    if (!dragging) return;
    const now = performance.now();
    const dx = e.clientX - lastX;
    const dt = Math.max(1, now - lastT) / 1000;
    turntable.rotation.y += dx * 0.012;
    vel = vel * 0.6 + ((dx * 0.012) / dt) * 0.4;
    lastX = e.clientX; lastT = now;
  };
  const onUp = (e: P) => {
    if (!dragging) return;
    dragging = false;
    if (performance.now() - lastT > 80) vel = 0; // held still before letting go
    const moved = Math.abs(e.clientX - downX);
    if (moved < 6 && performance.now() - downT < 350 && cfg.zoom) { zoomed = !zoomed; vel = 0; }
  };
  const onCancel = () => { dragging = false; vel = 0; };
  container.addEventListener("pointerdown", onDown as never);
  container.addEventListener("pointermove", onMove as never);
  container.addEventListener("pointerup", onUp as never);
  container.addEventListener("pointercancel", onCancel);

  const clock = new T.Clock();
  let raf = 0;
  let drawnOnce = false;
  let dead = false;
  const loop = () => {
    if (dead) return;
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, clock.getDelta());
    let changed = !drawnOnce;
    if (hint > 0) {
      const step = Math.min(hint, dt * 1.6);
      turntable.rotation.y += step * Math.PI * 2 * (0.4 + hint);
      hint -= step;
      changed = true;
    }
    if (headBone && zoomed && zoomMix < 0.01) {
      headBone.getWorldPosition(zoomAt);
      zoomAt.y += 0.05;
    }
    if (!dragging && Math.abs(vel) > 0.002) {
      turntable.rotation.y += vel * dt;
      vel *= Math.exp(-2.2 * dt);
      changed = true;
    }
    const target = zoomed ? 1 : 0;
    if (headBone && zoomMix > 0.001) {
      headBone.getWorldPosition(headPos);
      headPos.y += 0.05;
      zoomAt.lerp(headPos, Math.min(1, dt * 8));
      zoomPos.copy(zoomAt).add(new T.Vector3(0, (cfg.zoom?.dist ?? 0) * 0.18, cfg.zoom?.dist ?? 0));
    }
    if (Math.abs(zoomMix - target) > 0.001 || (headBone && zoomMix > 0.001)) {
      zoomMix += (target - zoomMix) * Math.min(1, dt * 5);
      camera.position.lerpVectors(homePos, zoomPos, zoomMix);
      camAt.lerpVectors(homeAt, zoomAt, zoomMix);
      camera.lookAt(camAt);
      changed = true;
    }
    if (mixer) {
      mixer.update(dt);
      changed = true;
      if (current === idle && gestures.length) {
        nextGesture -= dt;
        if (nextGesture <= 0) {
          const pool = gestures.filter((g) => g.getClip().name !== lastGesture);
          const g = pool[Math.floor(Math.random() * pool.length)];
          lastGesture = g.getClip().name;
          g.reset().play();
          if (idle) g.crossFadeFrom(idle, 0.45, false);
          current = g;
        }
      }
    }
    if (dragging) changed = true;
    if (changed) { renderer.render(scene, camera); drawnOnce = true; frames++; }
  };
  loop();

  return {
    setStick() { /* a podium has no stick */ },
    orbit() { /* the pointer events turn it */ },
    stats() { return { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, quality: tier }; },
    debugInfo() { return { rotation: turntable.rotation.y, zoomed, zoomMix, animated: !!mixer, frames }; },
    debugSpin(dy: number) { turntable.rotation.y += dy; hint = 0; },
    debugTap() { if (cfg.zoom) { zoomed = !zoomed; vel = 0; } },
    dispose() {
      dead = true;
      cancelAnimationFrame(raf);
      container.removeEventListener("pointerdown", onDown as never);
      container.removeEventListener("pointermove", onMove as never);
      container.removeEventListener("pointerup", onUp as never);
      container.removeEventListener("pointercancel", onCancel);
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
        for (const mt of mats) mt.dispose();
      });
      renderer.dispose();
      pmrem?.dispose();
      canvas.remove();
    },
  };
};
