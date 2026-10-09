"use client";
/**
 * YOUR STYLE A PLAYER ON HOME AND THE TITLE SCREEN (Harry, 9 Oct 2026: "home +
 * title … needs to be translated to the new style of player once done").
 *
 * Drawn inside HomePlayerFigure's box (boots on the bottom edge), only under
 * Settings → Look → "Player style: New". Your head, build, skin and hair
 * (Settings → Your look), your club kit and number, the relaxed idle with the
 * fixed hands. Home: drag to turn him. Light on purpose: ONE head file (not the
 * squad's set), one small canvas, 30 frames a second at most, paused when the
 * tab is hidden. Until he has loaded (or if 3D can't start) the old figure
 * stays, so the box is never empty.
 */
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import type { CareerState } from "@/lib/star/types";
import { toonYou, subscribeToonYou } from "@/lib/star/style3d/toon/bodies";

export default function ToonHomePlayer({ career, width, height, where, kitShirt, kitTrim, fallback }: {
  career: CareerState; width: number; height: number; where: "home" | "title"; kitShirt: string; kitTrim: string; fallback: ReactNode;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const turn = useRef({ yaw: where === "title" ? -0.35 : 0, drag: null as null | number, from: 0 });
  const you = useSyncExternalStore(subscribeToonYou, toonYou, toonYou);
  const num = career.squadNumber ?? 9;

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    let dead = false, raf = 0, last = 0;
    let dispose = () => {};
    (async () => {
      try {
        const THREE = await import("three");
        const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
        const SkeletonUtils = await import("three/examples/jsm/utils/SkeletonUtils.js");
        const { withMeshopt } = await import("@/lib/star/three3d/meshopt");
        const { loadToonHead, loadPeople3d, makePerson3d, dressPerson3d, poseClips } = await import("@/lib/star/people3d");
        const { numberTexture } = await import("@/lib/star/style3d/gameplay");
        if (dead) return;
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
        renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
        renderer.setSize(width, height);
        renderer.setClearColor(0x000000, 0);
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        const scene = new THREE.Scene();
        scene.add(new THREE.HemisphereLight("#b9cdf0", "#4a5a2a", 1.2));
        const sun = new THREE.DirectionalLight("#ffe0b0", 2.6);
        sun.position.set(2.5, 4, 4);
        scene.add(sun);
        const loader = await withMeshopt(new GLTFLoader());
        const [g, anims] = await Promise.all([loadToonHead(loader, you.head), loadPeople3d(loader, "anims", "new")]);
        if (dead) { renderer.dispose(); return; }
        const SK = (SkeletonUtils as unknown as { default?: unknown }).default ?? SkeletonUtils;
        const p = makePerson3d(THREE, SK as never, g, anims, { outline: 0.006, you: true });
        dressPerson3d(THREE, p, { skin: you.skin, hair: you.hair, kit: { shirt: kitShirt, trim: kitTrim }, number: numberTexture(THREE, num) });
        scene.add(p.root);
        // frame him: boots on the bottom edge, head near the top
        const tall = 1.83 * (p.root.children[0]?.scale.y ?? 1);
        const cam = new THREE.PerspectiveCamera(18, width / height, 0.1, 40);
        const fit = (tall * 1.06) / 2 / Math.tan((18 * Math.PI) / 360);
        const fitW = (0.9 / (width / height)) / 2 / Math.tan((18 * Math.PI) / 360);
        cam.position.set(0, tall * 0.53, Math.max(fit, fitW));
        cam.lookAt(0, tall * 0.53, 0);
        el.appendChild(renderer.domElement);
        renderer.domElement.style.width = `${width}px`;
        renderer.domElement.style.height = `${height}px`;
        const idle = p.actions.idle ? "idle" : Object.keys(p.actions)[0];
        const dur = p.actions[idle]?.getClip().duration ?? 1;
        const t0 = performance.now();
        const frame = (now: number) => {
          raf = requestAnimationFrame(frame);
          if (document.hidden || now - last < 33) return;
          last = now;
          const t = (now - t0) / 1000;
          poseClips(p, [[idle, t % dur, 1]]);
          const tr = turn.current;
          if (tr.drag === null && where === "home") tr.yaw *= 0.96; // drifts back to face you
          p.root.rotation.y = tr.yaw;
          renderer.render(scene, cam);
        };
        raf = requestAnimationFrame(frame);
        setReady(true);
        dispose = () => {
          cancelAnimationFrame(raf);
          renderer.dispose();
          renderer.domElement.remove();
        };
      } catch (e) {
        console.error("Style A home player", e);
      }
    })();
    return () => { dead = true; cancelAnimationFrame(raf); dispose(); };
  }, [width, height, where, kitShirt, kitTrim, num, you.head, you.body, you.skin, you.hair]);

  const onDown = (e: React.PointerEvent) => { if (where !== "home") return; turn.current.drag = e.clientX; turn.current.from = turn.current.yaw; (e.target as Element).setPointerCapture?.(e.pointerId); };
  const onMove = (e: React.PointerEvent) => { const t = turn.current; if (t.drag !== null) t.yaw = t.from + (e.clientX - t.drag) * 0.02; };
  const onUp = () => { turn.current.drag = null; };

  return (
    <div className="relative" style={{ width, height, touchAction: "pan-y" }} data-toon-home={where}
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
      {!ready && <div className="absolute inset-0">{fallback}</div>}
      <div ref={wrap} className="absolute inset-0" />
    </div>
  );
}
