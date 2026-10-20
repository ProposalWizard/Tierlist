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
 * tab is hidden. Until he has loaded: the picture of him from the last visit
 * (kept on this device) or a plain grey shape, never the old figure (speed
 * job B, 9 Oct 2026: a slow load showed the old drawn player first). Only if
 * 3D can't start does the old figure stay, so the box is never empty.
 */
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import type { CareerState } from "@/lib/star/types";
import { toonYou, subscribeToonYou } from "@/lib/star/style3d/toon/bodies";

export default function ToonHomePlayer({ career, width, height, where, kitShirt, kitTrim, fallback }: {
  career: CareerState; width: number; height: number; where: "home" | "title"; kitShirt: string; kitTrim: string; fallback: ReactNode;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const turn = useRef({ yaw: where === "title" ? -0.35 : 0, drag: null as null | number, from: 0 });
  const you = useSyncExternalStore(subscribeToonYou, toonYou, toonYou);
  const num = career.squadNumber ?? 9;
  // what he looks like now: the kept picture is shown only while it still matches
  const sig = [where, width, height, kitShirt, kitTrim, num, you.head, you.body, you.skin, you.hair].join("|");
  const [snap, setSnap] = useState<string | null>(null);
  useEffect(() => { setSnap(readSnap(where, sig)); }, [where, sig]);

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
        const { loadToonHead, loadPeople3d, makePerson3d, dressPerson3d, poseClips, relaxToonArms, turnBoneInBody } = await import("@/lib/star/people3d");
        const { loadAnims3d, addClips, clipInfo } = await import("@/lib/star/three3d/footballAnims");
        const { addToonFace, toonFaceFor, blinkAt, wanderGaze } = await import("@/lib/star/style3d/toon/face");
        const { setToonRim } = await import("@/lib/star/style3d/toon/shader");
        const { homeIdleAt, homeSway, HOME_BALL_REST } = await import("@/lib/star/homeIdle");
        const { makeHomeSet, juggleSpot } = await import("@/lib/star/homeSet3d");
        const { numberTexture } = await import("@/lib/star/style3d/gameplay");
        if (dead) return;
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
        renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
        renderer.setSize(width, height);
        renderer.setClearColor(0x000000, 0);
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        const scene = new THREE.Scene();
        // B5 (20 Oct 2026): light with shape, not flat: the sun more from his side, a cool sky fill, and a
        // soft rim from the floodlights behind him (drawn in his own shader, toon/shader.ts TOON_RIM: no new light)
        scene.add(new THREE.HemisphereLight("#b9cdf0", "#4a5a2a", 1.1));
        const sun = new THREE.DirectionalLight("#ffe0b0", 2.5);
        sun.position.set(3.4, 4, 2.2);
        scene.add(sun);
        setToonRim(THREE, { color: "#fff1dd", strength: 0.75, from: [-0.35, 0.55, -1] });
        const loader = await withMeshopt(new GLTFLoader());
        const [g, anims, fb] = await Promise.all([
          loadToonHead(loader, you.head), loadPeople3d(loader, "anims", "new"),
          loadAnims3d(loader as never, "football").catch(() => null),
        ]);
        if (dead) { renderer.dispose(); return; }
        const SK = (SkeletonUtils as unknown as { default?: unknown }).default ?? SkeletonUtils;
        const p = makePerson3d(THREE, SK as never, g, anims, { outline: 0.006, you: true });
        dressPerson3d(THREE, p, { skin: you.skin, hair: you.hair, kit: { shirt: kitShirt, trim: kitTrim }, number: numberTexture(THREE, num) });
        if (fb) addClips(THREE, p, fb);
        scene.add(p.root);
        // his face moves: blinks, eyes that look round, lips when he talks (toon/face.ts)
        const face = addToonFace(THREE, p);
        const homeSet = makeHomeSet(THREE, scene);
        const jInfo = clipInfo(fb, "juggle");
        // frame him: boots on the bottom edge, head near the top; the camera a little under his eyes (a hero's angle)
        const tall = 1.83 * (p.root.children[0]?.scale.y ?? 1);
        const cam = new THREE.PerspectiveCamera(18, width / height, 0.1, 40);
        const fit = (tall * 1.08) / 2 / Math.tan((18 * Math.PI) / 360);
        const fitW = (0.95 / (width / height)) / 2 / Math.tan((18 * Math.PI) / 360);
        cam.position.set(0, tall * 0.47, Math.max(fit, fitW));
        cam.lookAt(0, tall * 0.535, 0);
        el.appendChild(renderer.domElement);
        renderer.domElement.style.width = `${width}px`;
        renderer.domElement.style.height = `${height}px`;
        const has = (c: string) => !!p.actions[c];
        const len = (c: string) => p.actions[c]?.getClip().duration ?? 1;
        const t0 = performance.now();
        let snapped = false;
        // he stands a quarter turned (three quarters to the camera), the way a player poses, not square on
        const restYaw = where === "home" ? 0.32 : -0.35;
        const drawAt = (t: number) => {
          const st = homeIdleAt(t, has, len);
          poseClips(p, st.clips);
          // the stance on the standing idle: feet a little apart, arms loose off the hips, his weight shifting
          if (st.idle > 0.01) {
            turnBoneInBody(THREE, p, "LeftUpLeg", [0, 0, 1], 3.2 * st.idle);
            turnBoneInBody(THREE, p, "RightUpLeg", [0, 0, 1], -3.2 * st.idle);
            relaxToonArms(THREE, p, 5 * st.idle, 9 * st.idle);
            const hips = p.bones.Hips;
            if (hips) { hips.position.x += (homeSway(t) / (p.unit || 0.01)) * st.idle; hips.updateMatrixWorld(true); }
          }
          const tr = turn.current;
          if (tr.drag === null && where === "home") tr.yaw += (restYaw - tr.yaw) * 0.04; // drifts back to his pose
          p.root.rotation.y = tr.yaw;
          p.root.updateMatrixWorld(true);
          // the face: the beat's look, the eyes wandering (down to his ball in the keepy-uppies), blinks, the lips
          const gz = wanderGaze(t, 11);
          face?.set({ face: toonFaceFor(st.face), blink: blinkAt(t, 5), talk: st.talk, gaze: st.juggle > 0.5 ? [gz[0] * 0.3, -0.75] : gz });
          homeSet.place(p, tr.yaw, st.juggle, juggleSpot(jInfo, st.juggleT) ?? HOME_BALL_REST, t);
          renderer.render(scene, cam);
          // keep this first picture for the next visit's wait (read straight after the draw)
          if (!snapped) { snapped = true; keepSnap(where, sig, renderer.domElement); }
        };
        (window as unknown as { __homePlayer?: unknown }).__homePlayer = { draw: drawAt };
        const frame = (now: number) => {
          raf = requestAnimationFrame(frame);
          if (document.hidden || now - last < 33) return;
          last = now;
          // stills and films (the bench): window.__homeT holds one moment
          const held = (window as unknown as { __homeT?: number }).__homeT;
          drawAt(typeof held === "number" ? held : (now - t0) / 1000);
        };
        raf = requestAnimationFrame(frame);
        setReady(true);
        dispose = () => {
          cancelAnimationFrame(raf);
          face?.dispose();
          homeSet.dispose();
          setToonRim(THREE, { color: "#ffffff", strength: 0 });
          renderer.dispose();
          renderer.domElement.remove();
        };
      } catch (e) {
        console.error("Style A home player", e);
        if (!dead) setFailed(true);
      }
    })();
    return () => { dead = true; cancelAnimationFrame(raf); dispose(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height, where, kitShirt, kitTrim, num, you.head, you.body, you.skin, you.hair]);

  const onDown = (e: React.PointerEvent) => { if (where !== "home") return; turn.current.drag = e.clientX; turn.current.from = turn.current.yaw; (e.target as Element).setPointerCapture?.(e.pointerId); };
  const onMove = (e: React.PointerEvent) => { const t = turn.current; if (t.drag !== null) t.yaw = t.from + (e.clientX - t.drag) * 0.02; };
  const onUp = () => { turn.current.drag = null; };

  return (
    <div className="relative" style={{ width, height, touchAction: "pan-y" }} data-toon-home={where}
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
      {!ready && failed && <div className="absolute inset-0">{fallback}</div>}
      {!ready && !failed && (snap
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={snap} alt="" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full" data-toon-snap />
        : <WaitShape />)}
      <div ref={wrap} className="absolute inset-0" />
    </div>
  );
}

/** The wait with no kept picture: a soft grey player shape where he will stand. */
function WaitShape() {
  return (
    <svg viewBox="0 0 100 200" preserveAspectRatio="xMidYMax meet" className="pointer-events-none absolute inset-0 h-full w-full animate-pulse" aria-hidden data-toon-wait>
      <g fill="rgba(255,255,255,0.13)">
        <circle cx="50" cy="26" r="11" />
        <path d="M33 44 Q50 38 67 44 L72 98 Q60 102 56 100 L54 188 L44 188 L44 100 Q40 102 28 98 Z" />
      </g>
    </svg>
  );
}

/** One kept picture per place (Home, title), with what he looked like when it was taken. */
const snapKey = (where: string) => "kib-toon-snap-" + where;
function readSnap(where: string, sig: string): string | null {
  try {
    const v = JSON.parse(localStorage.getItem(snapKey(where)) ?? "null") as { sig?: string; url?: string } | null;
    return v && v.sig === sig && typeof v.url === "string" ? v.url : null;
  } catch { return null; }
}
function keepSnap(where: string, sig: string, canvas: HTMLCanvasElement) {
  try {
    const url = canvas.toDataURL("image/webp", 0.85);
    if (url.startsWith("data:image/") && url.length < 400_000) localStorage.setItem(snapKey(where), JSON.stringify({ sig, url }));
  } catch { /* no room or no storage: the grey shape next time */ }
}
