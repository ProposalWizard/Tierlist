/**
 * YOUR STYLE A PLAYER ON HOME AND THE TITLE SCREEN — the scene.
 *
 * The website's components/star/ToonHomePlayer.tsx, line for line, minus the
 * browser: the same head file, body, skin, hair, kit and number
 * (lib/star/people3d.ts), the same light and floodlight rim, the relaxed idle
 * with its keepy-uppies and face (lib/star/homeIdle.ts, toon/face.ts), the same
 * ball and shadow (lib/star/homeSet3d.ts), the same camera framing.
 *
 * Built once and KEPT (one per place, Home and title) for as long as he looks
 * the same: going back to Home only hands the kept man to a new GL view (the
 * phone's screens close when covered), so there is no second load or unpack.
 * The phone screen (./HomePlayer3D.tsx) owns the GL view, the frame loop and
 * the touch; this file only builds and draws. The headless check
 * (phone/tools/three-check.ts) builds the same scene to measure it.
 */
import * as THREE from "three";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import { GLTFLoader } from "./GLTFLoader";
import { withMeshopt } from "./meshopt";
import { withSceneDocument, withSceneDocumentSync } from "./env";
import type { ToonPick } from "@/lib/star/style3d/toon/bodies";

export interface HomeSceneOpts {
  where: "home" | "title";
  /** The box's shape (width / height); the camera frames him in it. */
  width: number;
  height: number;
  kitShirt: string;
  kitTrim: string;
  num: number;
  you: ToonPick;
}

export interface HomeScene {
  /** Draw him at `t` seconds of his idle, turned `yaw` (radians). */
  drawAt(t: number, yaw: number): void;
  /** The yaw he rests at (the website's quarter turn). */
  restYaw: number;
  /** Let go of this GL view (the kept man stays for the next one). */
  dispose(): void;
  /** Per-frame numbers for the meter (draw calls, triangles, the last frame's JavaScript ms). */
  info(): { calls: number; triangles: number; jsMs: number };
}

/** What makes him look different (a change rebuilds him). */
export const homeSceneKey = (o: HomeSceneOpts) =>
  [o.where, (o.width / o.height).toFixed(3), o.kitShirt, o.kitTrim, o.num, o.you.head, o.you.body, o.you.skin, o.you.hair, o.you.name ?? ""].join("|");

interface Model {
  key: string;
  scene: THREE.Scene;
  pose(t: number, yaw: number): void;
  cam: THREE.PerspectiveCamera;
  free(): void;
}
const kept = new Map<string, Promise<Model>>();

async function makeModel(o: HomeSceneOpts, key: string): Promise<Model> {
  return withSceneDocument(async () => {
    const people = await import("@/lib/star/people3d");
    const { loadAnims3d, addClips, clipInfo } = await import("@/lib/star/three3d/footballAnims");
    const { addToonFace, toonFaceFor, blinkAt, wanderGaze } = await import("@/lib/star/style3d/toon/face");
    const { homeIdleAt, homeSway, HOME_BALL_REST } = await import("@/lib/star/homeIdle");
    const { makeHomeSet, juggleSpot } = await import("@/lib/star/homeSet3d");
    const { numberTexture } = await import("@/lib/star/style3d/gameplay");
    const { loadToonHead, loadPeople3d, makePerson3d, dressPerson3d, poseClips, relaxToonArms, turnBoneInBody } = people;

    const scene = new THREE.Scene();
    // B5 (20 Oct 2026): the sun more from his side, a cool sky fill, the floodlight rim in his own shader
    scene.add(new THREE.HemisphereLight("#b9cdf0", "#4a5a2a", 1.1));
    const sun = new THREE.DirectionalLight("#ffe0b0", 2.5);
    sun.position.set(3.4, 4, 2.2);
    scene.add(sun);
    const loader = await withMeshopt(new GLTFLoader());
    const [g, anims, fb] = await Promise.all([
      loadToonHead(loader, o.you.head), loadPeople3d(loader, "anims", "new"),
      loadAnims3d(loader as never, "football").catch((e) => { console.warn("3D home: football clips", e); return null; }),
    ]);
    const SK = ((SkeletonUtils as unknown as { default?: unknown }).default ?? SkeletonUtils) as never;
    const p = makePerson3d(THREE, SK, g, anims, { outline: 0.006, you: true });
    withSceneDocumentSync(() => dressPerson3d(THREE, p, { skin: o.you.skin, hair: o.you.hair, kit: { shirt: o.kitShirt, trim: o.kitTrim }, number: numberTexture(THREE, o.num) }));
    if (fb) addClips(THREE, p, fb);
    scene.add(p.root);
    const face = addToonFace(THREE, p);
    const homeSet = makeHomeSet(THREE, scene);
    const jInfo = clipInfo(fb, "juggle");
    // boots on the bottom edge, head near the top; the camera a little under his eyes
    const tall = 1.83 * (p.root.children[0]?.scale.y ?? 1);
    const aspect = o.width / o.height;
    const cam = new THREE.PerspectiveCamera(18, aspect, 0.1, 40);
    const fit = (tall * 1.08) / 2 / Math.tan((18 * Math.PI) / 360);
    const fitW = (0.95 / aspect) / 2 / Math.tan((18 * Math.PI) / 360);
    cam.position.set(0, tall * 0.47, Math.max(fit, fitW));
    cam.lookAt(0, tall * 0.535, 0);
    const has = (c: string) => !!p.actions[c];
    const len = (c: string) => p.actions[c]?.getClip().duration ?? 1;
    return {
      key, scene, cam,
      pose(t: number, yaw: number) {
        const st = homeIdleAt(t, has, len);
        poseClips(p, st.clips);
        // the stance on the standing idle: feet a little apart, arms loose, his weight shifting
        if (st.idle > 0.01) {
          turnBoneInBody(THREE, p, "LeftUpLeg", [0, 0, 1], 3.2 * st.idle);
          turnBoneInBody(THREE, p, "RightUpLeg", [0, 0, 1], -3.2 * st.idle);
          relaxToonArms(THREE, p, 5 * st.idle, 9 * st.idle);
          const hips = p.bones.Hips;
          if (hips) { hips.position.x += (homeSway(t) / (p.unit || 0.01)) * st.idle; hips.updateMatrixWorld(true); }
        }
        p.root.rotation.y = yaw;
        p.root.updateMatrixWorld(true);
        const gz = wanderGaze(t, 11);
        face?.set({ face: toonFaceFor(st.face), blink: blinkAt(t, 5), talk: st.talk, gaze: st.juggle > 0.5 ? [gz[0] * 0.3, -0.75] : gz });
        homeSet.place(p, yaw, st.juggle, juggleSpot(jInfo, st.juggleT) ?? HOME_BALL_REST, t);
      },
      free() {
        face?.dispose();
        homeSet.dispose();
        scene.traverse((ob) => {
          const m = ob as THREE.Mesh;
          if ((m as unknown as THREE.SkinnedMesh).isSkinnedMesh) { (m.material as THREE.Material).dispose?.(); return; }
          if (m.geometry) m.geometry.dispose();
        });
      },
    };
  });
}

/** He is built once per look and kept; a different look for the same place replaces him. */
function modelFor(o: HomeSceneOpts): Promise<Model> {
  const key = homeSceneKey(o);
  let m = kept.get(key);
  if (!m) {
    for (const [k, old] of Array.from(kept)) {
      if (k.startsWith(o.where + "|")) { kept.delete(k); void old.then((x) => x.free(), () => {}); }
    }
    m = makeModel(o, key);
    m.catch(() => kept.delete(key));
    kept.set(key, m);
  }
  return m;
}

/** Start loading him now (the title screen asks for Home's man ahead). */
export function prefetchHomeScene(o: HomeSceneOpts): void { void modelFor(o).catch(() => {}); }

export async function buildHomeScene(renderer: THREE.WebGLRenderer, o: HomeSceneOpts): Promise<HomeScene> {
  const { setToonRim } = await import("@/lib/star/style3d/toon/shader");
  const m = await modelFor(o);
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  let jsMs = 0;
  return {
    restYaw: o.where === "home" ? 0.32 : -0.35,
    drawAt(t: number, yaw: number) {
      const t0 = performance.now();
      m.pose(t, yaw);
      // his rim light is one shared setting: on for this draw only (the headshots use another)
      setToonRim(THREE, { color: "#fff1dd", strength: 0.75, from: [-0.35, 0.55, -1] });
      renderer.render(m.scene, m.cam);
      jsMs = performance.now() - t0;
    },
    dispose() {
      // the man is kept for the next visit; only the shared rim goes back to off (the website does the same on leaving Home)
      setToonRim(THREE, { color: "#ffffff", strength: 0 });
    },
    info: () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, jsMs }),
  };
}
