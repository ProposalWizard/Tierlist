/**
 * THE HUMAN — one parametric person for every 3D scene: your player, team-mates,
 * opponents, managers, chairmen, journalists, fans.
 *
 * Harry, 9 Oct 2026: "the player in-game model just doesn't even look human …
 * think of how in Pro Clubs on FIFA you can fully customise your player and then
 * he works into the animations and physics of the game." And: "same system for
 * every other NPC/character."
 *
 * File: public/star/human3d/human.glb (tools/human3d/build_human.py, from the
 * CC0 MakeHuman base mesh). One body with every part a person can wear, build
 * shapes that also move the joints, and the SAME skeleton as the one body
 * (people3d.ts): every clip plays on every build, unchanged.
 *
 *   const p = makeHuman(T, SkeletonUtils, gltf, anims, { height: 1.86, build: 0.3, hair: "curly", outfit: "kit" });
 *   dressPerson3d(T, p, { skin, hair, kit });   // as for any 3D person
 *
 * makePerson3d (people3d.ts) calls this itself when Settings → Look → "3D
 * people" is New (the human), so every existing scene gets it.
 *
 * What a build changes, and what it does not:
 *   - the mesh (baked once per person: no per-frame cost) and the joints
 *     (bone lengths: a taller man's legs are longer, so a clip's steps are too);
 *   - the hips' height, which every clip is scaled to (makePerson3d's `k`),
 *     so feet stay on the ground for every height;
 *   - p.human: height, stride and a collision radius for gameplay to read.
 */
import type * as THREE from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  PEOPLE3D_SHADER, makePeople3dUniforms, people3dOutline,
  type MakePersonOptions, type Person3D, type PersonMeta, type FingerName, FINGER_NAMES,
} from "../people3d";

type Three = typeof import("three");
type V3 = [number, number, number];

export const HUMAN3D_FILE = "/star/human3d/human.glb";

export type HairStyle = "none" | "buzz" | "short" | "crop" | "side" | "slick" | "curly" | "long" | "receding" | "sides";
export type Outfit = "kit" | "kitLong" | "keeper" | "suit" | "suitOpen" | "shirt" | "tracksuit" | "quarterzip" | "coat" | "casual";

/** Everything that shapes a person. Every field is optional: the default is a 1.80 m, 25-year-old athletic footballer. */
export interface HumanSpec {
  /** Metres (1.60 … 2.05). */
  height?: number;
  /** −1 lean … 0 … 1 heavy. */
  build?: number;
  /** −1 soft … 0 … 1 very muscular. */
  muscle?: number;
  /** 0 … 1 a belly. */
  belly?: number;
  /** −1 narrow … 1 broad shoulders. */
  shoulders?: number;
  /** −1 short legs … 1 long legs (the height stays as asked). */
  legs?: number;
  /** −1 thin … 1 thick neck. */
  neck?: number;
  /** Years (18 … 80). */
  age?: number;
  /** Face shape sliders, each −1 … 1. */
  face?: Partial<Record<"jaw" | "chin" | "cheeks" | "nose" | "long" | "round" | "square" | "lips" | "eyes", number>>;
  /** Heritage blend of the face and build (each 0 … 1; the default is an even mix). */
  heritage?: Partial<Record<"african" | "asian" | "caucasian", number>>;
  hair?: HairStyle;
  /** Facial hair. */
  facialHair?: "none" | "stubble" | "beard" | "moustache" | "goatee";
  outfit?: Outfit;
  /** Leave out the modelled brows (a cut-scene face paints its own, which move). */
  noBrows?: boolean;
  glasses?: boolean;
  scarf?: boolean;
  /** Outfit colours ("#rrggbb"): main, second (shirt in the V, collars, cuffs), accent (tie, stripes, soles), and shoes. */
  colours?: Partial<Record<"main" | "second" | "accent" | "trousers" | "shoes" | "scarf" | "frames", string>>;
}

/** What gameplay can read off a built person. */
export interface HumanInfo {
  spec: HumanSpec;
  /** Standing height, metres. */
  height: number;
  /** Leg length (hip to ground), metres — scale stride from it. */
  leg: number;
  /** A collision radius (shoulders and build), metres. */
  radius: number;
  /** Stride relative to the base body (1 = the 1.80 m default). */
  stride: number;
}

interface HumanMeta {
  version: number;
  /** The skin texture's average colour (linear): the texture is used as detail around each person's own tone. */
  skinTexMean?: V3 | null;
  slots?: string[];
  alphaSlots?: string[];
  deleteParts?: string[];
  height: number;
  parts: string[];
  table: Record<string, [number, number][]>;
  bodyVerts: number;
  shapes: { name: string; height: number; joints: Record<string, V3> }[];
}

/** Which parts a person wears, by outfit and hair. Skin regions under clothes are left out. */
function partsFor(s: HumanSpec): string[] {
  const out = ["skin.head", "skin.neck", "skin.hand", "skin.wrist", "eyes", "teeth"];
  const add = (...p: string[]) => out.push(...p);
  const outfit = s.outfit ?? "kit";
  const allSkin = ["skin.forearm", "skin.uparmLow", "skin.uparmTop", "skin.torso", "skin.hips", "skin.thighTop", "skin.thighLow", "skin.knee", "skin.shin"];
  switch (outfit) {
    case "kit": add("kit.tee", "kit.teeShorts", "kit.socks", "kit.trainers", "skin.forearm", "skin.uparmLow", "skin.torso", "skin.thighLow", "skin.knee"); break;
    case "kitLong": add("kit.shirtLong", "kit.teeShorts", "kit.socks", "kit.trainers", "skin.thighLow", "skin.knee"); break;
    case "keeper": add("kit.shirtLong", "kit.teeShorts", "kit.socks", "kit.trainers", "kit.gkGloves", "skin.thighLow", "skin.knee"); break;
    case "suit": case "suitOpen": add("out.suit", "out.formalShoes", ...allSkin); break;
    case "shirt": add("out.shirtJeans", "out.formalShoes", ...allSkin); break;
    case "tracksuit": case "quarterzip": add("out.shirtJeans", "out.trainerShoes", ...allSkin); break;
    case "coat": add("out.jacketJeans", "out.formalShoes", ...allSkin); break;
    case "casual": add("out.teeJeans", "out.trainerShoes", ...allSkin); break;
  }
  if (outfit === "keeper") out.splice(out.indexOf("skin.hand"), 1);
  const HAIR: Record<string, string[]> = {
    short: ["hair.mh_short"], crop: ["hair.mh_crop"], side: ["hair.mh_side"], slick: ["hair.mh_swept"], curly: ["hair.mh_afro"], long: ["hair.mh_long"],
    buzz: ["hair.buzz"], receding: ["hair.receding"], sides: ["hair.sides"], none: [],
  };
  add(...(HAIR[s.hair ?? "short"] ?? HAIR.short));
  if (s.facialHair && s.facialHair !== "none") add(`hair.${s.facialHair}`);
  if (!s.noBrows) add("brows.mh");
  if (s.glasses) add("out.glasses");
  if (s.scarf) add("out.scarf");
  return out;
}

/** Shape weights from a spec (see the SHAPES list in build_human.py). */
function shapeWeights(s: HumanSpec, hm: HumanMeta): Record<string, number> {
  const w: Record<string, number> = {};
  const pos = (x: number | undefined) => Math.max(0, x ?? 0), neg = (x: number | undefined) => Math.max(0, -(x ?? 0));
  w.heavy = pos(s.build); w.lean = neg(s.build);
  w.muscle = pos(s.muscle); w.soft = neg(s.muscle);
  w.old = Math.max(0, Math.min(1.15, ((s.age ?? 25) - 25) / 45));
  w.belly = Math.max(0, s.belly ?? 0);
  w.shoulders = s.shoulders ?? 0; w.legs = s.legs ?? 0; w.neck = s.neck ?? 0;
  const f = s.face ?? {};
  w.jaw = f.jaw ?? 0; w.chin = f.chin ?? 0; w.cheeks = f.cheeks ?? 0; w.lips = f.lips ?? 0; w.eyes = f.eyes ?? 0;
  w.nose = pos(f.nose); w.noseSmall = neg(f.nose);
  w.faceLong = f.long ?? 0; w.faceRound = f.round ?? 0; w.faceSquare = f.square ?? 0;
  const h = s.heritage;
  if (h) { const t = (h.african ?? 0) + (h.asian ?? 0) + (h.caucasian ?? 0) || 1; w.african = (h.african ?? 0) / t; w.asian = (h.asian ?? 0) / t; w.caucasian = (h.caucasian ?? 0) / t; }
  // Height last: whatever the other shapes did to it, tall/short bring it to the asked height.
  const byName = Object.fromEntries(hm.shapes.map((x) => [x.name, x.height]));
  let hNow = hm.height;
  for (const [k, v] of Object.entries(w)) if (byName[k] !== undefined) hNow += v * (byName[k] - hm.height);
  const want = s.height ?? 1.8;
  const dT = byName.tall - hm.height, dS = byName.short - hm.height;
  if (want > hNow) w.tall = (want - hNow) / dT; else w.short = (want - hNow) / dS;
  return w;
}

interface SlotSource {
  name: string;
  pos: Float32Array; nor: Float32Array; uv: Float32Array | null; skinIndex: ArrayLike<number>; skinWeight: Float32Array;
  part: Float32Array; zone: Float32Array; anchor: Float32Array; anchorW: Float32Array; del: Float32Array | null;
  index: ArrayLike<number>;
  material: THREE.MeshStandardMaterial;
  alpha: boolean;
}

interface HumanSource {
  slots: SlotSource[];
  shapes: Record<string, Float32Array>;
  hm: HumanMeta;
  joints: Record<string, V3>;
}

const sources = new WeakMap<object, HumanSource>();

function sourceOf(gltf: GLTF): HumanSource {
  let s = sources.get(gltf.scene);
  if (s) return s;
  const shp = gltf.scene.getObjectByName("Shapes") as THREE.Points;
  const meta = gltf.scene.userData as PersonMeta & { human: HumanMeta };
  const hm = meta.human;
  const shapes: Record<string, Float32Array> = {};
  const morphs = shp.geometry.morphAttributes.position ?? [];
  hm.shapes.forEach((x, i) => { const a = morphs[i]; if (a) shapes[x.name] = toF32(a); });
  const slots: SlotSource[] = [];
  gltf.scene.traverse((o) => {
    const m = o as THREE.SkinnedMesh;
    if (!m.isSkinnedMesh || !/^Body/.test(m.name)) return;
    const g = m.geometry;
    const at = (n: string) => (g.getAttribute(n) ? toF32(g.getAttribute(n) as THREE.BufferAttribute) : null);
    const mat = m.material as THREE.MeshStandardMaterial;
    slots.push({
      name: (m.material as THREE.Material).name || (m.name === "Body" ? "body" : m.name.slice(5)),
      pos: at("position")!, nor: at("normal")!, uv: at("uv"), skinIndex: (g.getAttribute("skinIndex") as THREE.BufferAttribute).array, skinWeight: at("skinWeight")!,
      part: at("_part")!, zone: at("_zone")!, anchor: at("_anchor")!, anchorW: at("_anchorw")!, del: at("_del"),
      index: g.getIndex()!.array, material: mat, alpha: mat.alphaTest > 0 || (hm.alphaSlots ?? []).includes(mat.name),
    });
  });
  s = { slots, shapes, hm, joints: meta.joints as unknown as Record<string, V3> };
  sources.set(gltf.scene, s);
  return s;
}

function toF32(a: THREE.BufferAttribute | THREE.InterleavedBufferAttribute): Float32Array {
  const n = a.count * a.itemSize;
  const out = new Float32Array(n);
  for (let i = 0; i < a.count; i++) for (let k = 0; k < a.itemSize; k++) out[i * a.itemSize + k] = a.getComponent ? a.getComponent(i, k) : (a as THREE.BufferAttribute).array[i * a.itemSize + k] as number;
  return out;
}

/** The synthetic base colours the body shader reads (people3d's FRAG_BODY): skin, kit white, hair. */
const SKIN0: V3 = [0.62, 0.36, 0.24];
const HAIR0: V3 = [0.044, 0.026, 0.0185];

function hexLin(T: Three, hex: string | undefined, fallback: string): V3 { const c = new T.Color(hex ?? fallback); return [c.r, c.g, c.b]; }

/** The colour each part and zone starts as (before dressPerson3d paints skin, hair and kit). */
function baseColour(T: Three, part: string, zone: number, s: HumanSpec): V3 {
  const c = s.colours ?? {};
  if (part.startsWith("skin.")) return SKIN0;
  if (part.startsWith("hair.") || part === "brows") return HAIR0;
  if (part === "eyes") return zone === 2 ? [0.01, 0.008, 0.007] : zone === 1 ? hexLin(T, "#4a3020", "#4a3020") : [0.8, 0.77, 0.74];
  if (part === "teeth") return [0.78, 0.74, 0.66];
  if (part.startsWith("kit.")) return part === "kit.boots" && zone === 2 ? [0.06, 0.06, 0.06] : [0.8, 0.8, 0.8];
  if (part === "out.glasses") return hexLin(T, c.frames, "#1c1c1f");
  if (part === "out.scarf") return hexLin(T, c.scarf ?? c.main, "#7a1626");
  if (part === "out.shoes" || part === "out.trainers") return zone === 2 ? hexLin(T, part === "out.trainers" ? "#f2f2f2" : "#2a1a12", "#000") : hexLin(T, c.shoes, part === "out.trainers" ? "#f4f4f4" : "#16110e");
  if (part === "out.trousers" || part === "out.trackPants") return hexLin(T, c.trousers ?? c.main, "#20242c");
  if (part === "out.coat") return hexLin(T, c.main, "#2b2f38");
  if (part === "out.dressShirt") return hexLin(T, c.second, "#f4f4f2");
  return hexLin(T, c.main, "#1f2a44");
}

/** Make a person from the human file (and the people's clips). */
export function makeHuman(
  T: Three, SkeletonUtils: { clone(o: THREE.Object3D): THREE.Object3D },
  gltf: GLTF, anims: GLTF, spec: HumanSpec = {}, opts: MakePersonOptions = {},
): Person3D & { human: HumanInfo } {
  const src = sourceOf(gltf);
  const hm = src.hm;
  const w = shapeWeights(spec, hm);
  const nb = hm.bodyVerts;

  // Body deltas from the shapes, then every part vertex follows its anchors.
  const D = new Float32Array(nb * 3);
  for (const [name, k] of Object.entries(w)) {
    const s = src.shapes[name];
    if (!s || !k) continue;
    for (let i = 0; i < nb * 3; i++) D[i] += s[i] * k;
  }
  const wantNames = partsFor(spec);
  const want = new Set(wantNames.map((n) => hm.parts.indexOf(n)).filter((i) => i >= 0));
  let delBits = 0;
  (hm.deleteParts ?? []).forEach((nm, i) => { if (wantNames.includes(nm)) delBits |= 1 << i; });
  const Pa: number[] = [], Na: number[] = [], UVa: number[] = [], Ca: number[] = [], SIa: number[] = [], SWa: number[] = [], PTa: number[] = [];
  const idx: number[] = [];
  const groups: { start: number; count: number; slot: SlotSource }[] = [];
  let m = 0;
  for (const sl of src.slots) {
    const n = sl.pos.length / 3;
    const keep = new Int32Array(n).fill(-1);
    const I = sl.index;
    const start = idx.length;
    for (let t = 0; t < I.length; t += 3) {
      const a = I[t], b = I[t + 1], c = I[t + 2];
      if (!want.has(sl.part[a])) continue;
      if (sl.del && delBits && (((sl.del[a] | 0) | (sl.del[b] | 0) | (sl.del[c] | 0)) & delBits)) continue;
      for (const v of [a, b, c]) {
        if (keep[v] >= 0) continue;
        keep[v] = m++;
        let dx = 0, dy = 0, dz = 0;
        for (let k = 0; k < 3; k++) {
          const an = sl.anchor[v * 3 + k], aw = sl.anchorW[v * 3 + k];
          if (!aw) continue;
          dx += D[an * 3] * aw; dy += D[an * 3 + 1] * aw; dz += D[an * 3 + 2] * aw;
        }
        Pa.push(sl.pos[v * 3] + dx, sl.pos[v * 3 + 1] + dy, sl.pos[v * 3 + 2] + dz);
        Na.push(sl.nor[v * 3], sl.nor[v * 3 + 1], sl.nor[v * 3 + 2]);
        UVa.push(sl.uv ? sl.uv[v * 2] : 0, sl.uv ? sl.uv[v * 2 + 1] : 0);
        for (let k = 0; k < 4; k++) { SIa.push(sl.skinIndex[v * 4 + k]); SWa.push(sl.skinWeight[v * 4 + k]); }
        PTa.push(sl.part[v]);
        const pname = hm.parts[sl.part[v]];
        const isSkin = pname.startsWith("skin.");
        // skin: _ZONE is how deep in a hollow the point sits (0 open .. 0.7), a soft painted shadow
        const occ = isSkin ? 1 - 0.35 * sl.zone[v] : 1;
        const c0 = sl.uv && sl.material.map ? [1, 1, 1] : baseColour(T, pname, isSkin ? 0 : Math.round(sl.zone[v]), spec);
        const col = [c0[0] * occ, c0[1] * occ * (isSkin ? 0.97 : 1), c0[2] * occ * (isSkin ? 0.94 : 1)];
        Ca.push(col[0], col[1], col[2]);
      }
      idx.push(keep[a], keep[b], keep[c]);
    }
    if (idx.length > start) groups.push({ start, count: idx.length - start, slot: sl });
  }
  const P = new Float32Array(Pa), PT = new Float32Array(PTa);
  const geo = new T.BufferGeometry();
  geo.setAttribute("position", new T.BufferAttribute(P, 3));
  geo.setAttribute("normal", new T.BufferAttribute(new Float32Array(Na), 3));
  geo.setAttribute("uv", new T.BufferAttribute(new Float32Array(UVa), 2));
  geo.setAttribute("color", new T.BufferAttribute(new Float32Array(Ca), 3));
  geo.setAttribute("skinIndex", new T.Uint16BufferAttribute(new Uint16Array(SIa), 4));
  geo.setAttribute("skinWeight", new T.BufferAttribute(new Float32Array(SWa), 4));
  geo.setAttribute("_part", new T.BufferAttribute(PT, 1));
  geo.setIndex(idx);
  groups.forEach((g, i) => geo.addGroup(g.start, g.count, i));
  geo.computeBoundingBox(); geo.computeBoundingSphere();

  // Joints: the base plus each shape's joint moves.
  const J: Record<string, V3> = {};
  for (const [k, v] of Object.entries(src.joints)) J[k] = [...v] as V3;
  for (const sh of hm.shapes) {
    const k = w[sh.name];
    if (!k) continue;
    for (const [b, d] of Object.entries(sh.joints)) if (J[b]) { J[b][0] += d[0] * k; J[b][1] += d[1] * k; J[b][2] += d[2] * k; }
  }

  // The skeleton, cloned, with this person's bone lengths.
  const root = new T.Group();
  const inner = SkeletonUtils.clone(gltf.scene);
  inner.getObjectByName("Shapes")?.removeFromParent();
  root.add(inner);
  const extraSlots: THREE.Object3D[] = [];
  inner.traverse((o) => { if (/^Body./.test(o.name) && (o as THREE.SkinnedMesh).isSkinnedMesh) extraSlots.push(o); });
  extraSlots.forEach((o) => o.removeFromParent());
  const body = inner.getObjectByName("Body") as THREE.SkinnedMesh;
  const bones: Record<string, THREE.Bone> = {};
  inner.traverse((o) => { if ((o as THREE.Bone).isBone) bones[o.name] = o as THREE.Bone; });
  const armature = inner.getObjectByName("Armature")!;
  const unit = armature.scale.y || 0.01;
  inner.updateMatrixWorld(true);
  const order: THREE.Bone[] = [];
  const walk = (o: THREE.Object3D) => { if ((o as THREE.Bone).isBone) order.push(o as THREE.Bone); o.children.forEach(walk); };
  walk(armature);
  const pq = new T.Quaternion(), ps = new T.Vector3(), pp = new T.Vector3();
  for (const b of order) {
    const at = J[b.name];
    if (!at) continue;
    const par = b.parent!;
    par.updateMatrixWorld(true);
    par.matrixWorld.decompose(pp, pq, ps);
    const parentAt = (par as THREE.Bone).isBone && J[par.name] ? new T.Vector3(...J[par.name]) : pp;
    const d = new T.Vector3(...at).sub(parentAt).applyQuaternion(pq.clone().invert()).divide(ps);
    b.position.copy(d);
    b.updateMatrixWorld(true);
  }
  inner.updateMatrixWorld(true);
  body.geometry = geo;
  body.skeleton.calculateInverses();
  body.bindMatrix.identity(); body.bindMatrixInverse.identity();

  // Measurements, this person's.
  const meta0 = gltf.scene.userData as PersonMeta;
  const ys = (part: string, f: "min" | "max") => {
    const id = hm.parts.indexOf(part); let v = f === "min" ? Infinity : -Infinity;
    for (let i = 0; i < m; i++) if (PT[i] === id) v = f === "min" ? Math.min(v, P[i * 3 + 1]) : Math.max(v, P[i * 3 + 1]);
    return isFinite(v) ? v : undefined;
  };
  const eyeY = (J.eyeL[1] + J.eyeR[1]) / 2;
  let frontZ = -1, chinY = Infinity;
  const headId = hm.parts.indexOf("skin.head");
  for (let i = 0; i < m; i++) {
    if (PT[i] !== headId || Math.abs(P[i * 3]) > 0.012) continue;
    frontZ = Math.max(frontZ, P[i * 3 + 2]);
    if (P[i * 3 + 2] > J.Head[2] + 0.04) chinY = Math.min(chinY, P[i * 3 + 1]);
  }
  const lm0 = (meta0 as unknown as { landmarks?: { lipBot?: number } }).landmarks;
  if (lm0?.lipBot !== undefined) chinY = lm0.lipBot - 0.036 + (J.Head[1] - src.joints.Head[1]);
  if (!isFinite(chinY)) chinY = J.jaw[1] - 0.04;
  const meta: PersonMeta & { human: HumanMeta } = {
    ...meta0,
    model: spec.outfit && !spec.outfit.startsWith("kit") && spec.outfit !== "keeper" ? "manager" : "player",
    joints: J as unknown as PersonMeta["joints"],
    face: { chinY, eyeY, browY: eyeY + 0.02, frontZ },
    kit: {
      hemY: (ys("kit.tee", "min") ?? ys("kit.shirtLong", "min") ?? meta0.kit.hemY) + 0.004,
      sockY: (ys("kit.socks", "max") ?? meta0.kit.sockY) + 0.002,
      bootY: (ys("kit.trainers", "max") ?? ys("kit.boots", "max") ?? meta0.kit.bootY) + 0.002,
    },
    human: hm,
  };

  // The material: the people's body shader (kit colours, numbers, accessories)
  // on the vertex colours, with each part's own kind (skin, hair, kit).
  const u = makePeople3dUniforms(T, meta);
  if (!(spec.outfit ?? "kit").startsWith("kit") && spec.outfit !== "keeper") u.uKit.value = 0;
  const KIND: Record<string, number> = { suit: 1, suitOpen: 2, shirt: 3, tracksuit: 4, quarterzip: 5, coat: 6, casual: 7 };
  const cc = spec.colours ?? {};
  const lin = (hex: string | undefined, f: string) => new T.Color(hex ?? f);
  const lmk = (meta0 as unknown as { landmarks?: { mouth?: V3; mouthW?: number } }).landmarks;
  const dHead = new T.Vector3(...J.Head).sub(new T.Vector3(...src.joints.Head));
  Object.assign(u, {
    uHumNeck: { value: new T.Vector4(J.neck[0], J.neck[1], J.neck[2], J.Spine01[1]) },
    uHumHips: { value: J.Hips[1] }, uHumHipX: { value: J.LeftUpLeg[0] * 0.9 },
    uHumKind: { value: KIND[spec.outfit ?? ""] ?? 0 },
    uHumSkinTex: { value: new T.Vector3(...(hm.skinTexMean ?? [0.5, 0.3, 0.22])) },
    uHumC0: { value: lin(cc.main, "#1f2a44") }, uHumC1: { value: lin(cc.second, "#f4f4f2") }, uHumC2: { value: lin(cc.accent, "#7a1626") }, uHumC3: { value: lin(cc.trousers ?? cc.main, "#20242c") },
    uHumHead: { value: new T.Vector3(...J.Head).add(new T.Vector3(0, 0.09, 0)) },
    uHumEyeL: { value: new T.Vector3(...J.eyeL).add(new T.Vector3(0, 0, 0.0118)) }, uHumEyeR: { value: new T.Vector3(...J.eyeR).add(new T.Vector3(0, 0, 0.0118)) },
    uHumMouth: { value: lmk?.mouth ? new T.Vector4(lmk.mouth[0] + dHead.x, lmk.mouth[1] + dHead.y, lmk.mouthW ?? 0.024, lmk.mouth[2] + dHead.z) : new T.Vector4(0, -9, 0.02, 0) },
  });
  const mats = groups.map((g) => {
    const base = g.slot.material;
    const mat = new T.MeshStandardMaterial({
      vertexColors: true, metalness: 0, roughness: 0.75, side: T.DoubleSide,
      map: g.slot.uv ? base.map : null, normalMap: g.slot.uv ? base.normalMap : null,
      alphaTest: g.slot.alpha ? 0.45 : 0,
    });
    if (mat.normalMap) mat.normalScale = new T.Vector2(0.8, 0.8);
    patchHuman(mat, u, hm, g.slot.name);
    return mat;
  });
  body.material = mats;
  body.frustumCulled = false;
  body.castShadow = !!opts.castShadow;
  // No ink line round the human body (Harry, 9 Oct 2026: the black outline "reads cartoon";
  // the target has none). A toon style can still ask for one with humanOutline.
  const ow = (opts as { humanOutline?: number }).humanOutline ?? 0;
  const om = people3dOutline(T, ow || 0.0045, opts.outlineNear);
  const hidden = new T.MeshBasicMaterial({ visible: false });
  const outline = new T.SkinnedMesh(geo, groups.map((g) => (g.slot.alpha || g.slot.name === "brows" ? hidden : om)));
  outline.name = "Outline";
  outline.frustumCulled = false;
  outline.visible = ow > 0;
  body.parent!.add(outline);
  outline.bind(body.skeleton, body.bindMatrix);

  // From here exactly as makePerson3d.
  const rest = new Map<THREE.Bone, [THREE.Vector3, THREE.Quaternion]>();
  for (const b of Object.values(bones)) rest.set(b, [b.position.clone(), b.quaternion.clone()]);
  root.updateMatrixWorld(true);
  const handOf = (side: "L" | "R") => {
    const h = meta.hands[side];
    const q = new T.Quaternion();
    bones[side === "L" ? "LeftHand" : "RightHand"].getWorldQuaternion(q);
    const inv = q.invert();
    return { along: new T.Vector3(...h.along).applyQuaternion(inv), palm: new T.Vector3(...h.palm).applyQuaternion(inv), thumb: new T.Vector3(...h.thumb).applyQuaternion(inv), len: h.len };
  };
  const hand = { L: handOf("L"), R: handOf("R") };
  const hipsRest = bones.Hips.position.clone();
  const k = hipsRest.y / ((anims.scene.userData as { hipsY?: number }).hipsY || hipsRest.y);
  const mixer = new T.AnimationMixer(inner);
  const actions: Record<string, THREE.AnimationAction> = {};
  for (const clip of anims.animations) {
    const c = clip.clone();
    for (const tr of c.tracks) if (tr.name.endsWith(".position")) { const v = tr.values.slice(); for (let i = 0; i < v.length; i++) v[i] *= k; tr.values = v; }
    const a = mixer.clipAction(c); a.play(); a.setEffectiveWeight(0); actions[clip.name] = a;
  }
  const base = new Map<THREE.Bone, [THREE.Vector3, THREE.Quaternion]>();
  for (const b of Object.values(bones)) base.set(b, [b.position.clone(), b.quaternion.clone()]);
  let fingers: Person3D["fingers"];
  if (meta.fingers) {
    fingers = {} as NonNullable<Person3D["fingers"]>;
    for (const side of ["L", "R"] as const) {
      const out = {} as Record<FingerName, NonNullable<Person3D["fingers"]>["L"][FingerName]>;
      for (const f of FINGER_NAMES) {
        const fm = meta.fingers[side][f];
        const bs = fm.bones.map((nm) => bones[nm]);
        const local = (v: V3, b: THREE.Bone) => { const q = new T.Quaternion(); b.getWorldQuaternion(q); return new T.Vector3(...v).applyQuaternion(q.invert()).normalize(); };
        out[f] = { bones: bs, rest: bs.map((b) => b.quaternion.clone()), axis: bs.map((b) => local(fm.axis, b)), swing: fm.swing ? local(fm.swing, bs[0]) : undefined, dir: local(fm.dir, bs[2]), tipLen: fm.len * 0.24 / unit };
      }
      fingers[side] = out;
    }
  }
  const height = (ys("skin.head", "max") ?? 1.8);
  const leg = J.Hips[1];
  const info: HumanInfo = {
    spec, height, leg,
    radius: 0.24 + 0.05 * Math.max(0, spec.build ?? 0) + 0.02 * (spec.shoulders ?? 0) + 0.04 * (spec.belly ?? 0),
    stride: leg / (src.joints.Hips[1] || leg),
  };
  return { root, body, outline, bones, mixer, actions, meta, u, hand, base, rest, hipsRest, unit, fingers, human: info };
}

/** The people's body shader on vertex colours; skin, hair and kit by part, not guessed from colour. */
function patchHuman(mat: THREE.MeshStandardMaterial, u: Record<string, { value: unknown }>, hm: HumanMeta, slot = "body") {
  const ids = (pre: string) => hm.parts.map((p, i) => (p === pre || p.startsWith(pre + ".") || (pre.endsWith(".") && p.startsWith(pre)) ? i : -1)).filter((i) => i >= 0);
  const id = (name: string) => hm.parts.indexOf(name);
  const test = (name: string, list: number[]) => `float ${name} = 0.0;\n${list.map((i) => `if (abs(vHumPart - ${i}.0) < 0.5) ${name} = 1.0;`).join("\n")}`;
  const isP = (name: string) => `(abs(vHumPart - ${id(name)}.0) < 0.5)`;
  const { VERT_HEAD, FRAG_HEAD, FRAG_BODY } = PEOPLE3D_SHADER;
  const body = FRAG_BODY
    .replace("float hair = head * offFace * (1.0 - eye) * hairCol;", "float hair = vHumHair;")
    .replace("float kit = uKit", "float kit = vHumKit * uKit")
    .replace("float skin = (1.0 - kit)", "float skin = vHumSkin * (1.0 - kit)")
    .replace("float head = smoothstep(uFaceF.x - 0.045, uFaceF.x - 0.025, r.y);", "float head = vHumHead;");
  if (body === FRAG_BODY) throw new Error("human: the body shader changed shape");
  const pre = /* glsl */ `
  if (${isP("kit.teeShorts")} || ${isP("kit.trainers")}) {
    // the cloth texture's folds and weave, around white (the kit painter colours it)
    float l0 = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
    diffuseColor.rgb = vec3(clamp(0.82 + (l0 - 0.12) * 2.2, 0.55, 0.95));
  }
  if (${isP("kit.tee")}) {
    // the shirt's cloth texture (a mid grey, 0.62) around near-white, so the kit colour comes through true
    float l1 = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
    diffuseColor.rgb = vec3(clamp(0.95 + (l1 - 0.62) * 1.6, 0.6, 1.0));
  }
  if (vHumSkin > 0.5) {
    // the skin texture as detail: its colour around its own average, on the body's base tone
    vec3 dt = diffuseColor.rgb / max(vColor.rgb, vec3(1e-3)) / uHumSkinTex;
    float dl = dot(dt, vec3(0.299, 0.587, 0.114));
    dt = mix(vec3(dl), dt, 0.45);
    dt = vec3(1.0) + (dt - vec3(1.0)) * 0.85;  // the repainted face carries strong stubble and shading: a touch softer
    diffuseColor.rgb = vec3(0.62, 0.36, 0.24) * clamp(dt, vec3(0.3), vec3(1.8)) * vColor.rgb;
  }`;
  // Clothes' details drawn from where each point sits (crisp at any distance):
  // the jacket's V, lapels, tie and buttons; zips, stripes, collars; the lips; hair strands.
  const outfit = /* glsl */ `
{
  vec3 r = vRest;
  vec3 n = normalize(vRestN);
  float aa = max(fwidth(r.y), 0.0002);
  float ny = uHumNeck.y, cy = uHumNeck.w, hy = uHumHips;
  float frontS = smoothstep(0.1, 0.35, n.z);
  vec3 col = diffuseColor.rgb;
  float kind = uHumKind;
  {
    // MakeHuman's textured clothes, in this person's colours (the texture keeps the folds).
    float l = dot(col, vec3(0.299, 0.587, 0.114));
    float mx = max(col.r, max(col.g, col.b)), mn = min(col.r, min(col.g, col.b));
    float sat = (mx - mn) / max(mx, 0.001);
    bool top = r.y > hy - 0.03;
    if (${isP("out.suit")}) {
      vec3 tie = kind > 1.5 ? uHumC1 * 0.95 : uHumC2;
      col = sat > 0.3 ? tie * clamp(l / 0.25, 0.4, 1.4) : l > 0.45 ? uHumC1 * clamp(l / 0.8, 0.5, 1.15) : uHumC0 * clamp(l / 0.09, 0.45, 1.6);
    }
    if (${isP("out.shirtJeans")} || ${isP("out.jacketJeans")} || ${isP("out.teeJeans")}) {
      vec3 c = top ? (kind > 3.5 && kind < 5.5 ? uHumC0 : kind > 2.5 && kind < 3.5 ? uHumC1 : uHumC0) : uHumC3;
      col = c * clamp(l / (top ? 0.42 : 0.3), 0.45, 1.35);
    }
    if (${isP("out.formalShoes")}) col = col * 0.9;
  }
  if (${isP("out.jacket")} || ${isP("out.coat")}) {
    float top = ny + 0.03, tip = cy - (${isP("out.coat")} ? 0.0 : 0.035);
    float wv = (${isP("out.coat")} ? 0.05 : 0.062) * clamp((r.y - tip) / (top - tip), 0.0, 1.0);
    float vin = frontS * (1.0 - smoothstep(wv - aa, wv + aa, abs(r.x))) * step(tip, r.y);
    float lapel = frontS * (1.0 - smoothstep(wv + 0.016 - aa, wv + 0.016 + aa, abs(r.x))) * (1.0 - vin) * step(tip - 0.01, r.y);
    col = mix(col, col * 0.72, lapel * 0.8);
    vec3 shirt = uHumC1;
    float tie = step(kind, 1.5) * (1.0 - smoothstep(0.010 + 0.007 * clamp((ny - 0.03 - r.y) / 0.2, 0.0, 1.0) - aa, 0.010 + 0.007 * clamp((ny - 0.03 - r.y) / 0.2, 0.0, 1.0) + aa, abs(r.x)));
    shirt = mix(shirt, uHumC2 * (r.y > ny - 0.035 ? 0.85 : 1.0), tie);
    col = mix(col, shirt, vin);
    // buttons under the V, pocket flaps
    for (int i = 0; i < 2; i++) {
      float by = tip - 0.03 - float(i) * 0.07;
      col = mix(col, col * 0.35, frontS * (1.0 - smoothstep(0.0035, 0.0045, length(vec2(r.x, r.y - by)))) * (1.0 - vin));
    }
    float pk = frontS * (1.0 - smoothstep(0.0006, 0.0012, abs(r.y - (hy + 0.03)))) * step(0.04, abs(r.x)) * step(abs(r.x), 0.12);
    col = mix(col, col * 0.6, pk);
  }
  if (${isP("out.dressShirt")}) {
    float placket = frontS * (1.0 - smoothstep(0.004, 0.0055, abs(r.x)));
    col = mix(col, col * 0.9, placket);
    float btn = placket * step(0.5, fract((r.y - cy) / 0.07)) * (1.0 - smoothstep(0.0025, 0.0032, length(vec2(r.x, fract((r.y - cy) / 0.07 + 0.5) * 0.07 - 0.035))));
    col = mix(col, col * 0.7, btn);
    col = mix(col, col * 0.88, step(ny - 0.012, r.y));
  }
  if (((kind > 3.5 && kind < 5.5) && ${isP("out.shirtJeans")} && r.y > hy - 0.03) || ${isP("out.trackTop")} || ${isP("out.quarterZip")} || ${isP("out.trackPants")}) {
    float zip = frontS * (1.0 - smoothstep(0.0022, 0.003, abs(r.x)));
    if (${isP("out.quarterZip")} || kind > 4.5) zip *= step(ny - 0.17, r.y);
    if (${isP("out.trackPants")}) zip = 0.0;
    col = mix(col, uHumC2, zip);
    vec3 outward = normalize(vec3(sign(r.x) * 0.95, ${isP("out.trackPants")} ? -0.05 : 0.3, 0.0));
    float side = dot(n, outward);
    float onLimb = ${isP("out.trackPants")} ? 1.0 : step(0.17, abs(r.x));
    float stripe = onLimb * (1.0 - smoothstep(0.012, 0.022, abs(side - 0.93))) ;
    float stripes = max(stripe, ${isP("out.trackPants")} ? 0.0 : 0.0);
    col = mix(col, uHumC2, stripes * step(0.5, float(${isP("out.quarterZip")} ? 0 : 1)));
    if (!${isP("out.trackPants")}) col = mix(col, uHumC1, step(ny - 0.018, r.y));
  }
  if (${isP("out.trousers")}) {
    col = mix(col, col * 0.55, step(hy + 0.055, r.y) * step(kind, 3.5));
    col = mix(col, col * 0.85, frontS * (1.0 - smoothstep(0.0006, 0.0014, abs(abs(r.x) - abs(uHumHipX)))) * step(r.y, hy - 0.08));
  }
  if (${isP("out.shoes")} || ${isP("out.trainers")} || ${isP("kit.boots")}) {
    float sole = 1.0 - smoothstep(0.012 - aa, 0.012 + aa, r.y);
    if (${isP("out.trainers")}) sole = 1.0 - smoothstep(0.024 - aa, 0.024 + aa, r.y);
    col = mix(col, ${isP("out.trainers")} ? vec3(0.9) : col * 0.35, sole);
    if (${isP("out.trainers")}) col = mix(col, uHumC1, (1.0 - sole) * smoothstep(0.85, 0.95, abs(n.x)) * step(0.03, r.y));
  }
  if (${isP("kit.shirt")} || ${isP("kit.shirtLong")}) {
    // a trim round the collar
    float az = atan(r.x - uHumNeck.x, r.z - uHumNeck.z);
    float nl = ny + 0.012 - 0.03 * pow(max(cos(az), 0.0), 2.0);
    float nearNeck = 1.0 - smoothstep(0.075, 0.085, length(r.xz - uHumNeck.xz));
    col = mix(col, uTrim * max(dot(col, vec3(0.333)), 0.2) * 2.4, smoothstep(nl - 0.016 - aa, nl - 0.016 + aa, r.y) * 0.9 * nearNeck);
  }
  if (vHumHair > 0.5) {
    float az = atan(r.x - uHumHead.x, r.z - uHumHead.z);
    float strands = 0.86 + 0.14 * sin(az * 110.0 + r.y * 160.0) * sin(az * 37.0 - r.y * 90.0);
    float sheen = smoothstep(0.55, 0.85, n.y) * (1.0 - smoothstep(0.9, 1.0, n.y));
    col *= strands * (1.0 + 0.25 * sheen);
  }
  diffuseColor.rgb = col;
}`;
  const SKIN_LIGHT = /* glsl */ `
  if (vHumSkin > 0.5) {
    vec3 dd = reflectedLight.directDiffuse;
    float base = max(dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114)), 1e-3);
    float L = dot(dd, vec3(0.299, 0.587, 0.114)) / base;
    // a soft painted ramp: three gentle tones instead of a smooth roll-off
    float Lr = 0.1 + 0.42 * smoothstep(0.04, 0.4, L) + 0.6 * smoothstep(0.5, 1.15, L);
    dd *= mix(1.0, Lr / max(L, 0.02), 0.35);
    // light under the skin: the turn into shadow goes warm, never grey
    float term = smoothstep(0.0, 0.22, L) * (1.0 - smoothstep(0.3, 0.9, L));
    dd += diffuseColor.rgb * vec3(0.5, 0.14, 0.05) * (0.03 + 0.25 * term);
    reflectedLight.directDiffuse = dd;
    reflectedLight.indirectDiffuse *= vec3(1.07, 0.97, 0.92);
    // a warm rim where the skin turns away
    float fr = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 3.0);
    reflectedLight.directDiffuse += diffuseColor.rgb * vec3(1.0, 0.72, 0.5) * fr * 0.3;
  }`;
  const EYE_CATCH = /* glsl */ `
  if (${isP("eyes")}) {
    // a catchlight high on each iris, the same side as the key light
    for (int i = 0; i < 2; i++) {
      vec3 E = i == 0 ? uHumEyeL : uHumEyeR;
      vec2 cpos = E.xy + vec2(0.0022, 0.0026);
      float sp = 1.0 - smoothstep(0.0008, 0.0014, length(vRest.xy - cpos));
      totalEmissiveRadiance += vec3(0.95) * sp * step(E.z - 0.004, vRest.z);
    }
  }`;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", `#include <common>${VERT_HEAD}\nattribute float _part;\nvarying float vHumPart;`)
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvRest = position;\nvRestN = normal;\nvHumPart = _part;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>${FRAG_HEAD}\nvarying float vHumPart;\nuniform vec4 uHumNeck, uHumMouth;\nuniform vec3 uHumC0, uHumC1, uHumC2, uHumC3, uHumHead, uHumEyeL, uHumEyeR;\nuniform float uHumHips, uHumKind, uHumHipX;\nuniform vec3 uHumSkinTex;`)
      .replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>\nif (${isP("eyes")}) roughnessFactor = 0.14;`)
      .replace("#include <lights_fragment_end>", `#include <lights_fragment_end>\n${SKIN_LIGHT}`)
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>\n${EYE_CATCH}`)
      .replace("#include <color_fragment>", `#include <color_fragment>\n${test("vHumSkin", ids("skin."))}\n${test("vHumHair", [...ids("hair."), ...ids("brows")])}\n${test("vHumKit", ids("kit."))}\n${test("vHumHead", [id("skin.head"), id("skin.neck"), ...ids("hair."), ...ids("brows"), id("eyes"), id("teeth")])}\n${pre}\n${body}\n${outfit}`);
  };
  mat.customProgramCacheKey = () => `human-body-v4-${slot}`;
}

/** A spec for the four people files the scenes ask for by name. */
export function defaultHumanSpec(which: string): HumanSpec {
  switch (which) {
    case "player-buzz": return { hair: "buzz", outfit: "kit" };
    case "player-long": return { hair: "long", outfit: "kit" };
    case "manager": return { age: 54, build: 0.25, muscle: -0.3, belly: 0.25, hair: "slick", outfit: "suit", height: 1.79 };
    default: return { hair: "crop", outfit: "kit" };
  }
}
