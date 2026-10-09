/**
 * Football boots for the human body (Harry, 9 Oct 2026: the black "slipper" shapes
 * had to become real boots: studs, a sole line, a toe). Reuses the 3D shop's boot
 * model (public/star/shop3d/items/boot-*.glb, Draco), one on each foot bone, sized
 * to that person's foot and tinted in a colour (the kit's, by default).
 */
import type * as THREE from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

type Three = typeof import("three");

export const HUMAN_BOOT_FILE = "/star/shop3d/items/boot-speed.glb";

let bootGltf: Promise<GLTF> | null = null;

async function loadBoot(): Promise<GLTF> {
  if (!bootGltf) {
    bootGltf = (async () => {
      const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
      const { DRACOLoader } = await import("three/examples/jsm/loaders/DRACOLoader.js");
      const { withMeshopt } = await import("../three3d/meshopt");
      const loader = await withMeshopt(new GLTFLoader());
      const draco = new DRACOLoader();
      draco.setDecoderPath("/star/shop3d/draco/");
      loader.setDRACOLoader(draco);
      return loader.loadAsync(HUMAN_BOOT_FILE);
    })();
    bootGltf.catch(() => { bootGltf = null; });
  }
  return bootGltf;
}

/**
 * Put a boot on each foot of a made person (call once, at rest pose, before any
 * clip has moved the bones). The model's toe points along +x, its sole at y 0.
 * Resolves to the two boots (or none if the file can't load: the person keeps the
 * body's own shoes).
 */
export async function addHumanBoots(T: Three, root: THREE.Object3D, colour = "#b3202c"): Promise<THREE.Object3D[]> {
  let g: GLTF;
  try { g = await loadBoot(); } catch { return []; }
  const box = new T.Box3().setFromObject(g.scene);
  const len = box.max.x - box.min.x;
  const out: THREE.Object3D[] = [];
  root.updateMatrixWorld(true);
  const groundY = new T.Vector3().setFromMatrixPosition(root.matrixWorld).y;
  for (const S of ["Left", "Right"]) {
    let foot: THREE.Bone | null = null, toe: THREE.Bone | null = null;
    root.traverse((o) => {
      const b = o as THREE.Bone;
      if (!b.isBone) return;
      if (b.name === `${S}Foot`) foot = b;
      if (b.name === `${S}ToeBase`) toe = b;
    });
    if (!foot || !toe) continue;
    const F = new T.Vector3().setFromMatrixPosition((foot as THREE.Bone).matrixWorld);
    const B = new T.Vector3().setFromMatrixPosition((toe as THREE.Bone).matrixWorld);
    const fwd = B.clone().sub(F).setY(0);
    const fl = fwd.length();
    if (fl < 1e-4) continue;
    fwd.normalize();
    // heel behind the ankle, toe tip past the ball of the foot (the body's own foot proportions)
    const heel = F.clone().addScaledVector(fwd, -0.07);
    const tip = B.clone().addScaledVector(fwd, 0.085);
    const want = tip.clone().sub(heel).setY(0).length() * 1.06;
    const k = want / len;
    const boot = g.scene.clone(true);
    boot.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mat = (m.material as THREE.MeshStandardMaterial).clone();
      // the upper takes the colour; the sole and studs (the lowest parts) stay as made
      const bb = new T.Box3().setFromObject(m);
      if (bb.max.y > box.min.y + (box.max.y - box.min.y) * 0.3) mat.color = new T.Color(colour).lerp(new T.Color("#ffffff"), 0.15);
      m.material = mat;
      m.castShadow = true;
      m.frustumCulled = false;
    });
    const holder = new T.Group();
    holder.add(boot);
    boot.position.set(-box.min.x, -box.min.y, -(box.min.z + box.max.z) / 2);
    holder.scale.setScalar(k);
    holder.position.set(heel.x, groundY, heel.z);
    holder.rotation.y = Math.atan2(-fwd.z, fwd.x);
    root.add(holder);
    holder.updateMatrixWorld(true);
    (foot as THREE.Bone).attach(holder);
    out.push(holder);
  }
  return out;
}
