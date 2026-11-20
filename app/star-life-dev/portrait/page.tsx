"use client";
/**
 * ONE PERSON, DRAWN SHARP — the stills behind the kit man story's talks
 * (Events v2, /star-life-dev). One people preset (lib/star/people/presets.ts)
 * drawn by the game's own toon renderer (the bench people sheet's code path:
 * makePerson3d, dressPerson3d, his FaceId, his hair), on a see-through
 * background, so the picture can be laid over the pitch-two still.
 *
 *   ?id=trk-old-physio   the preset (staff or player) (Den is the "Long-serving Physio" look; the gaffer "Weathered Boss")
 *   ?w=700 ?h=1100       the picture's size in pixels
 *   ?yaw=-0.35           his turn (0 = straight at you)
 *   ?frame=knees|waist   how much of him is in it
 *   ?club=Altrincham     whose colours a tracksuit wears
 * window.__portrait is the PNG (a data URL) once drawn. Nothing is saved; nothing reaches a career.
 */
import { useEffect, useRef, useState } from "react";
import PageGuide from "@/components/admin/PageGuide";

export default function LifePortraitPage() {
  const box = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState("loading…");
  useEffect(() => {
    let dead = false;
    (async () => {
      const q = new URLSearchParams(window.location.search);
      const id = q.get("id") ?? "trk-old-physio";
      const W = Number(q.get("w") ?? 700), H = Number(q.get("h") ?? 1100);
      const yaw = Number(q.get("yaw") ?? -0.35);
      const T = await import("three");
      const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
      const SkU = await import("three/examples/jsm/utils/SkeletonUtils.js");
      const { withMeshopt } = await import("@/lib/star/three3d/meshopt");
      const P3 = await import("@/lib/star/people3d");
      const PR = await import("@/lib/star/people/presets");
      const HAIR = await import("@/lib/star/style3d/toon/hair");
      const { addToonFace, toonFaceFor } = await import("@/lib/star/style3d/toon/face");
      const { setToonRim } = await import("@/lib/star/style3d/toon/shader");
      const { applyToonFaceId } = await import("@/lib/star/style3d/toon/faceIdApply");
      const player = PR.PLAYER_PRESETS.find((p) => p.id === id);
      const preset = player ?? PR.STAFF_PRESETS.find((p) => p.id === id) ?? PR.STAFF_PRESETS[0];
      const L = PR.presetLook(preset, preset.id, player ? "player" : preset.roles[0], { club: q.get("club") ?? "Altrincham", exact: true });
      const SK = ((SkU as unknown as { default?: unknown }).default ?? SkU) as never;
      const loader = await withMeshopt(new GLTFLoader());
      const anims = await P3.loadPeople3d(loader, "anims", "new");
      const all = await P3.loadPeople3d(loader, "player", "new", [L.head]);
      if (dead || !box.current) return;
      const renderer = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      renderer.setPixelRatio(1);
      renderer.setSize(W, H);
      renderer.toneMapping = T.ACESFilmicToneMapping;
      renderer.setClearColor("#000000", 0);
      box.current.replaceChildren(renderer.domElement);
      const scene = new T.Scene();
      // Dusk on pitch two: a cool sky, the warm lamp over the mower shed from his left.
      scene.add(new T.HemisphereLight("#b9c8e8", "#3d4a35", 1.05));
      const lamp = new T.DirectionalLight("#ffd9a8", 2.4); lamp.position.set(-2.2, 3.6, 2.6); scene.add(lamp);
      setToonRim(T, { color: "#ffe2b8", strength: 0.55, from: [0.45, 0.5, -1] });
      const p = P3.makePerson3d(T, SK, all, anims, { outline: 0.006, toonHead: L.head, toonBody: L.build, who: L.id });
      P3.dressPerson3d(T, p, L.dress);
      applyToonFaceId(T, p, L.faceId, { detail: 1 });
      const face = addToonFace(T, p);
      if (L.hairMesh) await HAIR.wearToonHair(T, loader, p, L.hairMesh, { outline: 0.0045 });
      const clip = L.suit && p.actions["boss-idle"] ? "boss-idle" : p.actions.idle ? "idle" : Object.keys(p.actions)[0];
      P3.poseClips(p, [[clip, 1.2, 1]]);
      p.root.rotation.y = yaw;
      p.root.updateMatrixWorld(true);
      if (p.bones.Hips) { const hp = new T.Vector3(); p.bones.Hips.getWorldPosition(hp); p.root.position.x -= hp.x; p.root.position.z -= hp.z; p.root.updateMatrixWorld(true); }
      face?.set({ face: toonFaceFor({}), blink: 0 });
      scene.add(p.root);
      const cam = new T.PerspectiveCamera(22, W / H, 0.1, 40);
      if (q.get("frame") === "waist") { cam.position.set(0, 1.5, 2.9); cam.lookAt(0, 1.4, 0); }
      else { cam.position.set(0, 1.25, 5.2); cam.lookAt(0, 1.02, 0); }
      renderer.render(scene, cam);
      (window as unknown as { __portrait?: string }).__portrait = renderer.domElement.toDataURL("image/png");
      setStatus(`${preset.name} · ${L.age}`);
    })().catch((e) => setStatus(`failed: ${e instanceof Error ? e.message : e}`));
    return () => { dead = true; };
  }, []);
  return (
    <div style={{ background: "#2a3140", minHeight: "100vh", color: "#fff", padding: 12, fontFamily: "system-ui, sans-serif" }}>
      <div style={{ fontSize: 13, marginBottom: 8 }} data-status>{status}</div>
      <div ref={box} />
      <PageGuide page="/star-life-dev" corner="bottom-left" />
    </div>
  );
}
