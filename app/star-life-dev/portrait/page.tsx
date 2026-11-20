"use client";
/**
 * THE KIT MAN STORY'S STILLS, DRAWN IN ONE FRAME (Events v2, /star-life-dev).
 * Harry, 20 Nov 2026: "the proportions of where Den is standing compared to
 * our player is really off." So the person you talk to and you are drawn by
 * the game's own toon renderer (people presets: makePerson3d, dressPerson3d,
 * their FaceId and hair) in ONE scene: the same scale, feet on the same
 * ground, the camera at a man's eye level, one light for both. Behind them a
 * far backdrop (a picture of the garden wall and trees, or the stands) on a
 * plane; everything near is 3D. The page saves nothing.
 *
 *   ?scene=pitch|van|stadium|corridor|kid   which still
 *   ?id=trk-old-physio   the person you talk to (staff or player preset)
 *   ?with=ply-21         you, over the shoulder in the foreground (a player preset in the club's kit)
 *   ?back=trk-old-physio a third man further back (the corridor: Den in the boot room door)
 *   ?w=780 ?h=1688       the picture's size (a phone at 2x)
 *   ?single=1            one person on a see-through background (the phone's faces)
 *   ?club=Altrincham     whose colours
 * window.__portrait is the PNG; window.__portraitMeta has the speaker's head on the picture (0-1).
 */
import { useEffect, useRef, useState } from "react";
import PageGuide from "@/components/admin/PageGuide";

interface SceneDef { bg: string | null; sky: string; ground: string; hemi: [string, string, number]; key: [string, number, [number, number, number]]; rim: string; fog: number; bright: number }
const SCENES: Record<string, SceneDef> = {
  pitch: { bg: "/star/life/kitman/bg-garden-dusk.webp", sky: "#161d2e", ground: "#1f3018", hemi: ["#9aa8c8", "#1e2a18", 0.62], key: ["#ffe2bf", 1.35, [-2.6, 3.4, 2.2]], rim: "#ffd9a8", fog: 0.02, bright: 0.22 },
  van: { bg: "/star/life/kitman/bg-garden-van.webp", sky: "#0f1422", ground: "#162414", hemi: ["#7f8db0", "#161f12", 0.45], key: ["#ffd6a6", 1.15, [-2.8, 2.8, 2.0]], rim: "#ffc98a", fog: 0.03, bright: 0.14 },
  kid: { bg: "/star/life/kitman/bg-garden-dusk.webp", sky: "#161d2e", ground: "#1f3018", hemi: ["#9aa8c8", "#1e2a18", 0.65], key: ["#ffe2bf", 1.4, [-2.6, 3.4, 2.2]], rim: "#ffd9a8", fog: 0.02, bright: 0.24 },
  stadium: { bg: "/star/life/kitman/bg-stadium-night.webp", sky: "#0a1222", ground: "#1f3d1c", hemi: ["#b9c8e6", "#1f3a1b", 0.6], key: ["#fff2dc", 1.9, [2.4, 5, 3]], rim: "#dfe9ff", fog: 0.018, bright: 0.3 },
  corridor: { bg: null, sky: "#26324c", ground: "#3a4256", hemi: ["#c9d3e6", "#2a3040", 1.1], key: ["#f4f1ea", 2.0, [-1.5, 3, 2.5]], rim: "#ffffff", fog: 0.0, bright: 1 },
};

export default function LifePortraitPage() {
  const box = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState("loading…");
  useEffect(() => {
    let dead = false;
    (async () => {
      const q = new URLSearchParams(window.location.search);
      const single = q.get("single") === "1";
      const sceneId = q.get("scene") ?? "pitch";
      const S = SCENES[sceneId] ?? SCENES.pitch;
      const W = Number(q.get("w") ?? (single ? 700 : 780)), H = Number(q.get("h") ?? (single ? 1100 : 1688));
      const club = q.get("club") ?? "Altrincham";
      const outline = Number(q.get("outline") ?? (single ? 0.006 : 0));
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
      const lookOf = (id: string) => {
        const player = PR.PLAYER_PRESETS.find((p) => p.id === id);
        const preset = player ?? PR.STAFF_PRESETS.find((p) => p.id === id) ?? PR.STAFF_PRESETS[0];
        return { preset, L: PR.presetLook(preset, preset.id, player ? "player" : preset.roles[0], { club, exact: true }) };
      };
      const main = lookOf(q.get("id") ?? "trk-old-physio");
      const you = !single && q.get("with") ? lookOf(q.get("with")!) : null;
      const back = !single && q.get("back") ? lookOf(q.get("back")!) : null;
      const SK = ((SkU as unknown as { default?: unknown }).default ?? SkU) as never;
      const loader = await withMeshopt(new GLTFLoader());
      const anims = await P3.loadPeople3d(loader, "anims", "new");
      const heads = Array.from(new Set([main.L.head, ...(you ? [you.L.head] : []), ...(back ? [back.L.head] : [])]));
      const all = await P3.loadPeople3d(loader, "player", "new", heads);
      if (dead || !box.current) return;
      const renderer = new T.WebGLRenderer({ antialias: true, alpha: single, preserveDrawingBuffer: true });
      renderer.setPixelRatio(1);
      renderer.setSize(W, H);
      renderer.toneMapping = T.ACESFilmicToneMapping;
      renderer.setClearColor(single ? "#000000" : S.sky, single ? 0 : 1);
      box.current.replaceChildren(renderer.domElement);
      const scene = new T.Scene();
      if (!single && S.fog) scene.fog = new T.FogExp2(S.sky, S.fog);
      scene.add(new T.HemisphereLight(S.hemi[0], S.hemi[1], S.hemi[2]));
      const key = new T.DirectionalLight(S.key[0], S.key[1]); key.position.set(...S.key[2]); scene.add(key);
      setToonRim(T, { color: S.rim, strength: 0.55, from: [0.45, 0.5, -1] });

      const make = async (who: { L: ReturnType<typeof lookOf>["L"] }, x: number, z: number, yaw: number) => {
        const L = who.L;
        // No drawn outline: a lit head and shoulders, not a cut-out (Harry's review: the jaw line read as a mask).
        const p = P3.makePerson3d(T, SK, all, anims, { outline: outline, toonHead: L.head, toonBody: L.build, who: L.id });
        P3.dressPerson3d(T, p, L.dress);
        applyToonFaceId(T, p, L.faceId, { detail: 1 });
        const face = addToonFace(T, p);
        if (L.hairMesh) await HAIR.wearToonHair(T, loader, p, L.hairMesh, { outline: outline * 0.75 });
        const clip = L.suit && p.actions["boss-idle"] ? "boss-idle" : p.actions.idle ? "idle" : Object.keys(p.actions)[0];
        P3.poseClips(p, [[clip, 1.2, 1]]);
        p.root.rotation.y = yaw;
        p.root.updateMatrixWorld(true);
        if (p.bones.Hips) { const hp = new T.Vector3(); p.bones.Hips.getWorldPosition(hp); p.root.position.x += x - hp.x; p.root.position.z += z - hp.z; }
        p.root.updateMatrixWorld(true);
        face?.set({ face: toonFaceFor({}), blink: 0 });
        scene.add(p.root);
        return p;
      };

      const cam = new T.PerspectiveCamera(single ? 22 : 30, W / H, 0.1, 80);
      let speaker;
      if (single) {
        speaker = await make(main, 0, 0, Number(q.get("yaw") ?? -0.35));
        cam.position.set(0, 1.25, 5.2); cam.lookAt(0, 1.02, 0);
      } else {
        // The ground, and the far backdrop on a plane.
        const ground = new T.Mesh(new T.PlaneGeometry(80, 80), new T.MeshBasicMaterial({ color: S.ground }));
        ground.rotation.x = -Math.PI / 2; scene.add(ground);
        if (sceneId === "stadium") {
          // the pitch's stripes and the edge of the centre circle under them
          for (let i = -6; i < 6; i++) { const s = new T.Mesh(new T.PlaneGeometry(2.5, 80), new T.MeshBasicMaterial({ color: i % 2 ? "#1f3d1c" : "#264a22" })); s.rotation.x = -Math.PI / 2; s.position.set(i * 2.5, 0.002, 0); scene.add(s); }
        }
        if (S.bg) {
          const tex = await new T.TextureLoader().loadAsync(S.bg);
          tex.colorSpace = T.SRGBColorSpace;
          const aspect = tex.image.width / tex.image.height;
          const hh = sceneId === "stadium" ? 16 : 9.5;
          const plane = new T.Mesh(new T.PlaneGeometry(hh * aspect, hh), new T.MeshBasicMaterial({ map: tex, fog: false }));
          // its own lawn goes under our ground, so the wall and the trees stand on it
          plane.position.set(0.6, hh / 2 - (sceneId === "stadium" ? 2.6 : 2.2), sceneId === "stadium" ? -26 : -11);
          scene.add(plane);
        }
        if (sceneId === "corridor") {
          const wall = new T.Mesh(new T.PlaneGeometry(30, 8), new T.MeshBasicMaterial({ color: "#232d44" })); wall.position.set(0, 4, -4.2); scene.add(wall);
          const door = new T.Mesh(new T.PlaneGeometry(1.3, 2.3), new T.MeshLambertMaterial({ color: "#151a26" })); door.position.set(1.7, 1.15, -4.18); scene.add(door);
          const frame = new T.Mesh(new T.PlaneGeometry(1.5, 2.45), new T.MeshLambertMaterial({ color: "#5c6680" })); frame.position.set(1.7, 1.22, -4.19); scene.add(frame);
        }
        if (sceneId === "pitch" || sceneId === "van" || sceneId === "kid") {
          // the lamp over the mower shed: a warm point light up on the left
          const lamp = new T.PointLight("#ffc98a", sceneId === "van" ? 9 : 6, 14, 1.6); lamp.position.set(-2.4, 3.2, -2.5); scene.add(lamp);
        }
        if (sceneId === "stadium") { for (const lx of [-9, 9]) { const f = new T.PointLight("#fff6e6", 30, 40, 1.4); f.position.set(lx, 9, -6); scene.add(f); } }
        // Him three-quarter, you over the shoulder; the same ground, the same scale.
        speaker = await make(main, 0.62, -1.1, -0.42);
        if (back) await make(back, 1.7, -3.7, -0.2);
        if (you) await make(you, -0.42, 1.05, Math.PI - 0.62);
        // A man's eye level (1.62 m), looking slightly down the shoulder line at him.
        cam.position.set(-0.85, 1.62, 3.7);
        cam.lookAt(0.45, 1.18, -1.1);
      }
      renderer.render(scene, cam);
      // Where his head is on the picture (the Telltale screen keeps him in colour there).
      let meta = { x: 0.5, y: 0.35 };
      const hb = speaker.bones.Head;
      if (hb) { const v = new T.Vector3(); hb.getWorldPosition(v); v.y += 0.08; v.project(cam); meta = { x: +((v.x + 1) / 2).toFixed(3), y: +((1 - v.y) / 2).toFixed(3) }; }
      (window as unknown as { __portraitMeta?: unknown }).__portraitMeta = { ...meta, w: W, h: H };
      (window as unknown as { __portrait?: string }).__portrait = renderer.domElement.toDataURL("image/png");
      setStatus(`${main.preset.name} · ${main.L.age}${you ? ` with ${you.preset.name}` : ""} · head at ${meta.x}, ${meta.y}`);
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
