/**
 * Style A stills harness (no Next.js): one person on a golden-hour lot, a phone-size frame
 * with his face inset, plus measurements (hands, wrists, fingers, elbows) in window.__done.
 *
 *   esbuild tools/styletest/heads.ts --bundle --format=esm --outfile=<dir>/bundle.js --tsconfig=tsconfig.json
 *   serve <dir> with public/star linked in as <dir>/star; open /?v=stylised&view=front&clip=idle&t=0.4
 *   ?file=/star/people3d/toon-p1.glb  a body not yet in TOON_FILES; ?v= a TOON_LOOK_VARIANTS key
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import { withMeshopt } from "@/lib/star/three3d/meshopt";
import { loadPeople3d, makePerson3d, dressPerson3d, poseClips, relaxToonArms, TOON_LOOK_VARIANTS, FINGER_NAMES, poseFingers, fingersDeg } from "@/lib/star/people3d";
import { loadAnims3d, addClips } from "@/lib/star/three3d/footballAnims";
import { RELAXED_FINGERS_DEG as TOON_RELAXED_FINGERS_DEG } from "@/lib/star/three3d/runPosture";
import { previewPlayerStyleLook } from "@/lib/star/style3d/toon/look";
import { numberTexture } from "@/lib/star/style3d/gameplay";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

const q = new URLSearchParams(location.search);
const variant = q.get("v") ?? "stylised";
const view = q.get("view") ?? "front";
const body = (q.get("body") ?? "c1") as "c1" | "c2" | "c3";
const head = (q.get("head") ?? (q.get("mgr") === "1" ? "m1" : "h1")) as import("@/lib/star/style3d/toon/bodies").ToonHead;
const file = q.get("file");
const skin = q.get("skin") ?? "";
const hair = q.get("hair") ?? "";
const mgr = q.get("mgr") === "1";
const clipName = q.get("clip") ?? "idle";
const clipT = Number(q.get("t") ?? "0.4");
const oldArms = q.get("arms") === "old";

(async () => {
  previewPlayerStyleLook("new");
  const W = 390, H = 844;
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.autoClear = false;
  document.body.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#d9b27e");
  scene.add(new THREE.HemisphereLight("#a7bfe2", "#4d5a2e", 1.15));
  const sun = new THREE.DirectionalLight("#ffd6a0", 2.8);
  sun.position.set(3.5, 4, 4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.bias = -0.0005;
  scene.add(sun);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(6, 48), new THREE.MeshStandardMaterial({ color: "#557f37", roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const loader = await withMeshopt(new GLTFLoader());
  let g: GLTF;
  if (file) {
    const one = await loader.loadAsync(file);
    g = { ...one, toonBodies: Array(8).fill(one), toonWhich: mgr ? "manager" : "player" } as unknown as GLTF;
  } else {
    g = await loadPeople3d(loader, mgr ? "manager" : "player", "new");
  }
  const anims = await loadPeople3d(loader, "anims", "new");
  const fb = await loadAnims3d(loader as never, "football").catch(() => null);
  const look = TOON_LOOK_VARIANTS[variant];
  const p = makePerson3d(THREE, SkeletonUtils as never, g, anims, { outline: 0.006, castShadow: true, toonBody: body, toonHead: head, toonLook: look });
  if (fb) addClips(THREE, p, fb as never);
  const ud = (g.scene.userData ?? {}) as { skinAvg?: number[]; hairAvg?: number[] };
  const lin2hex = (v?: number[]) => (v ? "#" + new THREE.Color(v[0], v[1], v[2]).getHexString() : "#8d5524");
  // ?shirt=EB172B&trim=FFFFFF (a club's colours: its pattern comes too), ?name=SMITH, ?casual=1 (a casual set)
  const kitQ = { shirt: "#" + (q.get("shirt") ?? "c8102e"), trim: "#" + (q.get("trim") ?? "ffffff") };
  dressPerson3d(THREE, p, { skin: skin || lin2hex(ud.skinAvg), hair: hair || lin2hex(ud.hairAvg), kit: mgr ? undefined : kitQ, number: numberTexture(THREE, Number(q.get("num") ?? 10)), name: q.get("name"), grey: 0 });
  if (q.get("casual") === "1") {
    const uu = p.u as Record<string, { value: any }>; // eslint-disable-line @typescript-eslint/no-explicit-any
    uu.uSuit.value = 1; uu.uSuitCoat.value = new THREE.Color("#3b4a63"); uu.uSuitTrousers.value = new THREE.Color("#2a2d34");
    uu.uShoes.value = new THREE.Color("#f2f2ef"); uu.uSuitShirt.value = new THREE.Color("#3b4a63"); uu.uSuitTie.value = new THREE.Color("#3b4a63");
    uu.uBadgeOn.value = 0; uu.uNumOn.value = 0;
  }
  poseClips(p, [[clipName, clipT, 1]]);
  const rk = q.get("relax");
  if (rk) { const k = Number(rk); const R0 = TOON_RELAXED_FINGERS_DEG; const sc = (v: number[]) => v.map((x) => x * k) as [number, number, number]; const f = fingersDeg({ thumb: sc(R0.thumb), index: sc(R0.index), middle: sc(R0.middle), ring: sc(R0.ring), little: sc(R0.little), thumbSwing: R0.thumbSwing * k }); poseFingers(THREE, p, "L", f); poseFingers(THREE, p, "R", f); }
  const fist = q.get("fist");
  if (fist) { const d = Number(fist); const f = fingersDeg({ thumb: [d / 3, d / 3, d / 3], index: [d, d, d], middle: [d, d, d], ring: [d, d, d], little: [d, d, d], thumbSwing: d / 2 }); poseFingers(THREE, p, "L", f); poseFingers(THREE, p, "R", f); }
  if (oldArms && variant !== "current") relaxToonArms(THREE, p);
  p.root.rotation.y = view === "front" ? 0 : view === "side" ? -Math.PI / 2 : view === "back" ? Math.PI : -0.75;
  scene.add(p.root);
  p.root.updateMatrixWorld(true);
  const P = (n: string) => { const v = new THREE.Vector3(); p.bones[n]?.getWorldPosition(v); return v; };
  const headY = P("Head");
  // measures: hand length / forearm, wrist bend, finger curl, elbow
  const m: Record<string, number> = {};
  for (const [s, side] of [["L", "Left"], ["R", "Right"]] as const) {
    const fore = P(`${side}ForeArm`).distanceTo(P(`${side}Hand`));
    const tip = p.fingers?.[s]?.middle ? (() => { const b = p.fingers![s].middle.bones[2]; const v = new THREE.Vector3(); b.getWorldPosition(v); return v.distanceTo(P(`${side}Hand`)) + p.fingers![s].middle.tipLen * p.unit; })() : p.meta.hands[s].len;
    m[`hand/forearm ${s}`] = +(tip / fore).toFixed(2);
    const h = p.bones[`${side}Hand`];
    m[`wrist bend ${s} (deg)`] = +((h.quaternion.angleTo(p.rest.get(h)![1]) * 180) / Math.PI).toFixed(1);
    const e = P(`${side}ForeArm`);
    m[`elbow bend ${s} (deg)`] = +(180 - (P(`${side}Arm`).sub(e).angleTo(P(`${side}Hand`).sub(e)) * 180) / Math.PI).toFixed(1);
    if (p.fingers) for (const f of FINGER_NAMES) {
      const r = p.fingers[s][f];
      m[`${f} curl ${s} (deg, 3 joints)`] = +r.bones.reduce((a, b, i) => a + (b.quaternion.angleTo(r.rest[i]) * 180) / Math.PI, 0).toFixed(0);
    }
  }
  ground.visible = false;
  const cam = new THREE.PerspectiveCamera(26, W / H, 0.1, 50);
  if (q.get("zoom") === "1") { cam.position.set(0, 1.25, 2.4); cam.lookAt(0, 1.2, 0); } else if (q.get("full") === "1") { cam.position.set(0, 1.0, 7.4); cam.lookAt(0, 0.95, 0); } else { cam.position.set(0, 1.0, 5.6); cam.lookAt(0, 1.18, 0); }
  renderer.info.autoReset = false; renderer.info.reset();
  renderer.clear(); renderer.render(scene, cam);
  const stats = { draws: renderer.info.render.calls, triangles: renderer.info.render.triangles };
  ground.visible = true;
  renderer.info.autoReset = true;
  renderer.clear();
  renderer.render(scene, cam);
  const hc = new THREE.PerspectiveCamera(22, 1, 0.05, 20);
  if (q.get("inset") === "hand") {
    // his left hand (screen right from the front), close
    const R = q.get("hand") === "R";
    const hp = P(R ? "RightHand" : "LeftHand"); const side = (view === "front" ? 0 : 0.4) * (R ? -1 : 1);
    hc.position.set(hp.x + (R ? -0.25 : 0.25) + side, hp.y + 0.02, hp.z + 0.75); hc.lookAt(hp.x, hp.y - 0.06, hp.z);
  } else { hc.position.set(0, headY.y + 0.07, 1.2); hc.lookAt(0, headY.y + 0.07, 0); }
  const s = q.get("inset") === "hand" ? 190 : 150;
  renderer.setScissorTest(true);
  renderer.setScissor(W - s - 8, H - s - 8, s, s); renderer.setViewport(W - s - 8, H - s - 8, s, s);
  renderer.clear();
  renderer.render(scene, hc);
  renderer.setScissorTest(false);
  (window as unknown as { __done: unknown }).__done = { ...stats, variant, view, body: file ?? body, clip: clipName, m };
})();
