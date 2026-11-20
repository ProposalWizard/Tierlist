/**
 * NO TIGHTROPE WALKS (Harry, 20 Nov 2026: "why the legs like squeezing past each other", "the feet still
 * seem abnormally close together"). Every Style A head and build, on its real file, playing the real clips:
 *   - its hip joints are as wide as the clip skeleton's (within 8%, by leg length): hipFit.ts;
 *   - standing and walking, its feet are as far apart as the SOURCE's (the clip on the clip file's own
 *     skeleton, where the capture's feet were put): mean spacing within 10% (or 1.5 cm);
 *   - standing, the ankles are 15 to 26 cm apart; walking, never under 6 cm;
 *   - on no moving loop do the ankles cross, and no calf or knee comes within 2 mm of the other leg.
 * Prints the table (cm): body, clip, source min/mean, ours min/mean, nearest skin.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import { readFileSync } from "node:fs";
import { loadPeople3d, makePerson3d, type Person3D } from "../../lib/star/people3d";
import { addClips, loadAnims3d } from "../../lib/star/three3d/footballAnims";
import { TOON_ALL_HEADS, TOON_BODIES, TOON_BUILD_SCALE, type ToonHead, type ToonBody } from "../../lib/star/style3d/toon/bodies";

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

function strip(raw: Buffer): ArrayBuffer {
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
const loader = {
  setMeshoptDecoder() { return this; },
  async loadAsync(url: string) {
    const l = new GLTFLoader(); l.setMeshoptDecoder(MeshoptDecoder as never);
    return new Promise((res, rej) => l.parse(strip(readFileSync("public" + url.split("?")[0])), "", res, rej));
  },
};

const SOURCE_TRUE = ["idle", "walk", "walk_confident", "sit_idle"];
const LOOPS = ["walk", "walk_confident", "slump_walk", "jog", "run", "sprint", "dribble_run"];
const N = 24;
const wp = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3());

const anims = await loadPeople3d(loader as never, "anims", "new");
const fb = await loadAnims3d(loader as never, "football");

// ── the source: each clip on the clip file's own skeleton (spacing per metre of leg) ──
const src: Record<string, { min: number; mean: number }> = {};
{
  const all = new Map<string, [THREE.Object3D, THREE.AnimationClip]>();
  for (const g of [anims, fb]) for (const c of g.animations) if (!all.has(c.name) || g === fb) all.set(c.name, [g.scene, c]);
  for (const name of Array.from(new Set([...SOURCE_TRUE, ...LOOPS]))) {
    const e = all.get(name); if (!e) continue;
    const [scene, clip] = e;
    const B = (n: string) => scene.getObjectByName(n)!;
    const mixer = new THREE.AnimationMixer(scene); const a = mixer.clipAction(clip); a.play(); mixer.update(1 / 60);
    let mn = 9, sum = 0;
    for (let f = 0; f < N; f++) {
      mixer.setTime(Math.max(1e-4, (f / N) * clip.duration)); scene.updateMatrixWorld(true);
      const leg = wp(B("LeftUpLeg")).distanceTo(wp(B("LeftLeg"))) + wp(B("LeftLeg")).distanceTo(wp(B("LeftFoot")));
      const s = (wp(B("LeftFoot")).x - wp(B("RightFoot")).x) / leg;
      mn = Math.min(mn, s); sum += s / N;
    }
    a.stop(); mixer.uncacheRoot(scene);
    src[name] = { min: mn, mean: sum };
  }
}

const cm = (m: number) => (m * 100).toFixed(1).padStart(5);
const rows: string[] = [];
const heads = (process.env.HEADS ? process.env.HEADS.split(",") : TOON_ALL_HEADS) as ToonHead[];
for (const head of heads) {
  const model = await loadPeople3d(loader as never, "player", "new", [head]);
  for (const build of (process.env.ALL_BUILDS ? TOON_BODIES : ["c2"]) as ToonBody[]) {
    const p: Person3D = makePerson3d(THREE, SkeletonUtils as never, model, anims, { who: `t-${head}`, toonHead: head, toonBody: build, outline: 0 } as never);
    addClips(THREE, p, fb);
    const B = p.bones, body = p.body;
    p.root.updateMatrixWorld(true);
    const legAt = () => wp(B.LeftUpLeg).distanceTo(wp(B.LeftLeg)) + wp(B.LeftLeg).distanceTo(wp(B.LeftFoot));
    // the skin of each leg from the knee region down
    const si = body.geometry.getAttribute("skinIndex"), sw = body.geometry.getAttribute("skinWeight");
    const bi = (n: string) => body.skeleton.bones.findIndex((b) => b.name === n);
    const LL = new Set([bi("LeftUpLeg"), bi("LeftLeg")]), RL = new Set([bi("RightUpLeg"), bi("RightLeg")]);
    const Lv: number[] = [], Rv: number[] = [];
    for (let i = 0; i < si.count; i += 3) { let best = -1, bw = 0; for (let k = 0; k < 4; k++) if (sw.getComponent(i, k) > bw) { bw = sw.getComponent(i, k); best = si.getComponent(i, k); } if (LL.has(best)) Lv.push(i); else if (RL.has(best)) Rv.push(i); }
    const v = new THREE.Vector3();
    const pose = (clip: string, t: number) => {
      for (const a of Object.values(p.actions)) a.setEffectiveWeight(0);
      const a = p.actions[clip]; a.enabled = true; a.setEffectiveWeight(1); a.time = Math.max(1e-4, Math.min(t, a.getClip().duration - 1e-3));
      p.rest.forEach(([pos, q], b) => { b.position.copy(pos); b.quaternion.copy(q); });
      p.mixer.update(0); p.root.updateMatrixWorld(true); body.skeleton.update();
    };
    pose("idle", 0.5);
    // a build is the whole man a little wider or narrower across: the source's spacing is too
    const wide = TOON_BUILD_SCALE[build][0];
    const hipW = wp(B.LeftUpLeg).x - wp(B.RightUpLeg).x, leg0 = legAt();
    const cs = anims.scene.getObjectByName("LeftUpLeg")!, ck = anims.scene.getObjectByName("LeftLeg")!, cf = anims.scene.getObjectByName("LeftFoot")!;
    const clipHip = (2 * Math.abs(cs.position.x)) / (ck.position.length() + cf.position.length()) * leg0 * wide;
    check(Math.abs(hipW / clipHip - 1) < 0.08, `${head} ${build}: hip joints ${cm(hipW)} cm apart, the clips are made for ${cm(clipHip)}`);
    for (const clip of Array.from(new Set([...SOURCE_TRUE, ...LOOPS]))) {
      if (!p.actions[clip] || !src[clip]) continue;
      const dur = p.actions[clip].getClip().duration;
      let mn = 9, sum = 0, near = 9;
      for (let f = 0; f < N; f++) {
        pose(clip, (f / N) * dur);
        const s = wp(B.LeftFoot).x - wp(B.RightFoot).x;
        mn = Math.min(mn, s); sum += s / N;
        if (LOOPS.includes(clip)) {
          const cut = Math.min(wp(B.LeftUpLeg).y, wp(B.RightUpLeg).y) - 0.25;
          const pts = (ids: number[]) => ids.map((i) => body.getVertexPosition(i, v).applyMatrix4(body.matrixWorld).clone()).filter((q) => q.y < cut);
          const L = pts(Lv), R = pts(Rv);
          for (const a of L) for (const b of R) { const d = a.distanceToSquared(b); if (d < near * near) near = Math.sqrt(d); }
        }
      }
      const leg = leg0 * wide, S = src[clip];
      rows.push(`${head} ${build}  ${clip.padEnd(15)} source ${cm(S.min * leg)} /${cm(S.mean * leg)}   ours ${cm(mn)} /${cm(sum)}${LOOPS.includes(clip) ? `   nearest skin ${cm(near)}` : ""}`);
      if (SOURCE_TRUE.includes(clip)) check(Math.abs(sum - S.mean * leg) < Math.max(0.015, 0.1 * S.mean * leg), `${head} ${build} ${clip}: feet ${cm(sum)} cm apart on average, the source's are ${cm(S.mean * leg)}`);
      if (clip === "idle") check(sum > 0.15 && sum < 0.26, `${head} ${build}: stands with his ankles ${cm(sum)} cm apart (want 15 to 26)`);
      if (clip === "walk") check(mn > 0.06, `${head} ${build}: walks with his ankles ${cm(mn)} cm apart at the narrowest (a tightrope: want over 6)`);
      if (LOOPS.includes(clip)) {
        check(mn > 0.02, `${head} ${build} ${clip}: the ankles cross or meet (${cm(mn)} cm)`);
        check(near > 0.002, `${head} ${build} ${clip}: one leg's skin within ${cm(near)} cm of the other`);
      }
    }
  }
}
if (process.env.ROWS_ONLY) { for (const r of rows) console.log(r); process.exit(0); }
console.log("body      clip            source min / mean      ours min / mean (cm between the ankles)");
for (const r of rows) console.log(r);
if (problems.length) { console.log(`FAIL — ${problems.length} problem(s):`); for (const p of problems) console.log("  " + p); process.exit(1); }
console.log(`gaitWidth: ${heads.length} heads pass`);
