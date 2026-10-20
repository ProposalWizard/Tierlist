/**
 * A Style A person in Node, built the way people3d.makePerson3d builds one
 * (the Style A neck, head and hand scales, the build), for the shoulder and
 * arm measuring (arm_clearance.mts) and the clip settle (settle_clips.mts).
 * Pictures are dropped (Node has no image decoder); the skin is all that matters.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import { existsSync, readFileSync } from "node:fs";
import { TOON_LOOK_DEFAULT } from "../../lib/star/people3d";
import { TOON_BUILD_SCALE, type ToonBody } from "../../lib/star/style3d/toon/bodies";
import { shoulderBodyOf, type ShoulderBody } from "../../lib/star/three3d/shoulderSet";

export function stripped(f: string): ArrayBuffer {
  const raw = readFileSync(f);
  const jl = raw.readUInt32LE(12);
  const js = JSON.parse(raw.subarray(20, 20 + jl).toString());
  delete js.textures; delete js.images; delete js.samplers;
  for (const m of js.materials ?? []) { delete m.occlusionTexture; delete m.normalTexture; delete m.emissiveTexture; if (m.pbrMetallicRoughness) { delete m.pbrMetallicRoughness.baseColorTexture; delete m.pbrMetallicRoughness.metallicRoughnessTexture; } }
  js.extensionsUsed = (js.extensionsUsed ?? []).filter((e: string) => e !== "EXT_texture_webp" && e !== "KHR_texture_basisu");
  js.extensionsRequired = (js.extensionsRequired ?? []).filter((e: string) => e !== "EXT_texture_webp" && e !== "KHR_texture_basisu");
  const jb = Buffer.from(JSON.stringify(js)); const pad = Buffer.alloc((4 - (jb.length % 4)) % 4, 0x20);
  const rest = raw.subarray(20 + jl);
  const head = Buffer.alloc(20); head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4);
  head.writeUInt32LE(20 + jb.length + pad.length + rest.length, 8); head.writeUInt32LE(jb.length + pad.length, 12); head.writeUInt32LE(0x4e4f534a, 16);
  const glb = Buffer.concat([head, jb, pad, rest]);
  return glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength) as ArrayBuffer;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const parse = (buf: ArrayBuffer): Promise<any> => new Promise((res, rej) => { const l = new GLTFLoader(); l.setMeshoptDecoder(MeshoptDecoder as never); l.parse(buf, "", res, rej); });

export interface NodeBody {
  file: string; build: ToonBody; root: THREE.Group; inner: THREE.Object3D; body: THREE.SkinnedMesh;
  bones: Record<string, THREE.Bone>; hipsRest: THREE.Vector3; palm: { L: THREE.Vector3; R: THREE.Vector3 };
  meta: Record<string, unknown>;
}

/** "file.glb" or "file.glb@c2" (the build: c1 Slim, c2 Strong, c3 Tall). */
export async function nodeBody(spec: string): Promise<NodeBody> {
  const [file, b] = spec.split("@");
  const build = ((b as ToonBody) || "c1");
  const g = await parse(stripped(file));
  const inner = SkeletonUtils.clone(g.scene);
  const root = new THREE.Group(); root.add(inner);
  inner.scale.set(...TOON_BUILD_SCALE[build]);
  const body = inner.getObjectByName("Body") as THREE.SkinnedMesh;
  const bones: Record<string, THREE.Bone> = {};
  inner.traverse((o) => { if ((o as THREE.Bone).isBone) bones[o.name] = o as THREE.Bone; });
  const tl = TOON_LOOK_DEFAULT;
  bones.neck?.scale.set(tl.neck, 1, tl.neck);
  bones.Head?.scale.set(tl.head / tl.neck, tl.head, tl.head / tl.neck);
  bones.LeftHand?.scale.setScalar(tl.hands); bones.RightHand?.scale.setScalar(tl.hands);
  root.updateMatrixWorld(true);
  const meta = g.scene.userData as { hands?: Record<"L" | "R", { palm: [number, number, number] }> };
  const palmOf = (s: "L" | "R") => {
    const q = new THREE.Quaternion(); bones[s === "L" ? "LeftHand" : "RightHand"].getWorldQuaternion(q);
    const p = meta.hands?.[s]?.palm ?? [0, 0, s === "L" ? -1 : 1];
    return new THREE.Vector3(...p).applyQuaternion(q.invert());
  };
  return { file, build, root, inner, body, bones, hipsRest: bones.Hips.position.clone(), palm: { L: palmOf("L"), R: palmOf("R") }, meta };
}

export const shoulderBodyFor = (b: NodeBody): ShoulderBody | null => shoulderBodyOf(THREE, b.inner, b.bones, b.body, `${b.file}@${b.build}`);

/**
 * The reference bodies the shipped clips are settled against (settle_clips.mts):
 * today's Style A body at its broadest and slimmest builds, and B5b's new body
 * (toon-f2 leaner, toon-f3 bigger head) once they are in the repo. The 20 Oct 2026
 * bake used all four (f2 and f3 from B5b's branch, de417b5f, passed with --ref).
 */
export const SETTLE_REFS = ["public/star/people3d/toon-p1.glb@c2", "public/star/people3d/toon-p1.glb@c1", "public/star/people3d/toon-f2.glb", "public/star/people3d/toon-f3.glb", "public/star/people3d/toon-d1.glb", "public/star/people3d/toon-d2.glb", "public/star/people3d/toon-d3.glb"].filter((r) => existsSync(r.split("@")[0]));
