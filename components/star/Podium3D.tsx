"use client";

/**
 * A Star Pass reward you can spin (Mikey, 2 Oct 2026): the podium and the
 * reward as live 3D (three.js), drawn on a see-through canvas so the road
 * shows behind.
 *
 * - Drag sideways (mouse) or swipe (phone) to turn it. Let go mid-drag and it
 *   keeps turning, slowing down, so a flick spins it and a nudge barely moves
 *   it. Vertical swipes still scroll the page.
 * - Tap to zoom in on `zoom` (the sunglasses), tap again to come back out.
 * - A reward with animation clips plays "Idle" on a loop and drops in one of
 *   the others every few seconds, the way a game character fidgets.
 * - Turns once on its own the first time it scrolls into view, so it reads as
 *   something you can spin.
 *
 * The files come from tools/star-pass-art/export_live3d.py and share
 * Blender's coordinates, so the podium and the reward line up as exported.
 * three.js loads only when a 3D podium is on the page, and nothing is drawn
 * while it is scrolled off screen.
 */
import { useEffect, useRef } from "react";
import type * as THREE from "three";

import type { Live3D } from "@/lib/star/starPassRewards";
import { TIER_PROFILES, quality3dTier } from "@/lib/star/three3d/quality";
import { withMeshopt } from "@/lib/star/three3d/meshopt";

const LENS_FOV = 28.7; // a 70 mm lens on a 36 mm sensor, as the Blender pictures use

export default function Podium3D({ cfg, dim = false }: { cfg: Live3D; dim?: boolean }) {
  const wrap = useRef<HTMLDivElement>(null);
  // Rebuild only when the settings really change, not on every new object.
  const cfgKey = JSON.stringify(cfg);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    let disposed = false;
    let stop = () => {};

    (async () => {
      const THREE = await import("three");
      const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
      const { RoomEnvironment } = await import("three/examples/jsm/environments/RoomEnvironment.js");
      if (disposed) return;

      const { w, h } = cfg;
      // Settings → Look → "3D quality": High exactly as before (2x, antialias, shadow)
      const tier = quality3dTier();
      const prof = TIER_PROFILES[tier];
      const renderer = new THREE.WebGLRenderer({ antialias: prof.antialias, alpha: true });
      renderer.setPixelRatio(Math.min(tier === "high" ? 2 : prof.maxPixelRatio, window.devicePixelRatio || 1));
      renderer.setSize(w, h);
      renderer.toneMapping = THREE.AgXToneMapping;
      renderer.toneMappingExposure = 1.05;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.shadowMap.enabled = prof.shadows;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      const canvas = renderer.domElement;
      canvas.style.touchAction = "pan-y";
      canvas.style.cursor = "grab";
      canvas.style.display = "block";
      el.appendChild(canvas);

      const scene = new THREE.Scene();
      const pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environmentIntensity = 0.9;
      // Blender (x, y, z) is three (x, z, -y).
      const B = (x: number, y: number, z: number) => new THREE.Vector3(x, z, -y);
      const key = new THREE.DirectionalLight(0xffffff, 2.6);
      key.position.copy(B(-4, -4, 7));
      key.castShadow = prof.shadows;
      key.shadow.mapSize.set(1024, 1024);
      Object.assign(key.shadow.camera, { left: -3.5, right: 3.5, top: 3.5, bottom: -3.5, near: 1, far: 20 });
      key.shadow.bias = -0.0005;
      key.shadow.radius = 4;
      scene.add(key);
      const rim = new THREE.DirectionalLight(0xffffff, 1.6);
      rim.position.copy(B(3, 5, 5));
      scene.add(rim);
      scene.add(new THREE.HemisphereLight(0xdfe6ff, 0x2a1830, 0.6));

      const camera = new THREE.PerspectiveCamera(LENS_FOV, w / h, 0.05, 100);
      if (w >= h) camera.fov = (2 * Math.atan(Math.tan((LENS_FOV * Math.PI) / 360) / (w / h)) * 180) / Math.PI;
      camera.updateProjectionMatrix();
      const t = (cfg.tilt * Math.PI) / 180;
      const homePos = new THREE.Vector3(0, cfg.look + cfg.dist / Math.tan(t), cfg.dist);
      const homeAt = new THREE.Vector3(0, cfg.look, 0);
      const zoomAt = cfg.zoom ? B(...cfg.zoom.at) : homeAt.clone();
      const zoomPos = zoomAt.clone().add(new THREE.Vector3(0, cfg.zoom ? cfg.zoom.dist * 0.18 : 0, cfg.zoom?.dist ?? 0));
      const camAt = homeAt.clone();
      camera.position.copy(homePos);
      camera.lookAt(camAt);

      const turntable = new THREE.Group();
      turntable.rotation.y = -0.6;
      scene.add(turntable);
      const loader = await withMeshopt(new GLTFLoader()); // meshopt-packed (scripts/perf3d/shrink-models.mjs)
      const [pod, item] = await Promise.all([loader.loadAsync(cfg.podium), loader.loadAsync(cfg.item)]);
      if (disposed) { renderer.dispose(); return; }

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

      const holder = new THREE.Group();
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
      const headPos = new THREE.Vector3();

      // Fidgeting: Idle on a loop, another clip dropped in every few seconds.
      let mixer: THREE.AnimationMixer | null = null;
      let current: THREE.AnimationAction | null = null;
      let idle: THREE.AnimationAction | null = null;
      let nextGesture = 2.5;
      let lastGesture = "";
      const gestures: THREE.AnimationAction[] = [];
      if (item.animations.length) {
        mixer = new THREE.AnimationMixer(item.scene);
        for (const clip of item.animations) {
          const a = mixer.clipAction(clip);
          if (clip.name === "Idle") { idle = a; a.setLoop(THREE.LoopRepeat, Infinity); }
          else { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; gestures.push(a); }
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

      // Spinning by drag/swipe, with the spin carrying on after a flick.
      let vel = 0;
      let dragging = false;
      let lastX = 0, lastT = 0, downX = 0, downT = 0;
      let zoomed = false;
      let zoomMix = 0;
      let hint = 1; // the one turn it makes on its own the first time it is seen
      const onDown = (e: PointerEvent) => {
        dragging = true; hint = 0;
        lastX = downX = e.clientX; lastT = downT = performance.now();
        canvas.setPointerCapture(e.pointerId);
        canvas.style.cursor = "grabbing";
        vel = 0;
      };
      const onMove = (e: PointerEvent) => {
        if (!dragging) return;
        const now = performance.now();
        const dx = e.clientX - lastX;
        const dt = Math.max(1, now - lastT) / 1000;
        turntable.rotation.y += dx * 0.012;
        vel = vel * 0.6 + ((dx * 0.012) / dt) * 0.4;
        lastX = e.clientX; lastT = now;
      };
      const onUp = (e: PointerEvent) => {
        if (!dragging) return;
        dragging = false;
        canvas.style.cursor = "grab";
        if (performance.now() - lastT > 80) vel = 0; // held still before letting go
        const moved = Math.abs(e.clientX - downX);
        if (moved < 6 && performance.now() - downT < 350 && cfg.zoom) { zoomed = !zoomed; vel = 0; }
      };
      canvas.addEventListener("pointerdown", onDown);
      canvas.addEventListener("pointermove", onMove);
      canvas.addEventListener("pointerup", onUp);
      canvas.addEventListener("pointercancel", () => { dragging = false; vel = 0; });

      let visible = false;
      const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { rootMargin: "150px" });
      io.observe(el);
      const clock = new THREE.Clock();
      let raf = 0;
      let drawnOnce = false;
      const loop = () => {
        raf = requestAnimationFrame(loop);
        const dt = Math.min(0.05, clock.getDelta());
        if (!visible) return;
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
          zoomPos.copy(zoomAt).add(new THREE.Vector3(0, (cfg.zoom?.dist ?? 0) * 0.18, cfg.zoom?.dist ?? 0));
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
        if (changed) { renderer.render(scene, camera); drawnOnce = true; }
      };
      loop();

      stop = () => {
        cancelAnimationFrame(raf);
        io.disconnect();
        renderer.dispose();
        pmrem.dispose();
        canvas.remove();
      };
    })().catch((e) => console.error("Podium3D failed", e));

    return () => { disposed = true; stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfgKey]);

  return (
    <div ref={wrap} style={{ width: cfg.w, height: cfg.h, filter: dim ? "saturate(.85) brightness(.85)" : undefined }} />
  );
}
