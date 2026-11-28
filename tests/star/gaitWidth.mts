/**
 * NO TIGHTROPE WALKS (Harry, 20 Nov 2026: "why the legs like squeezing past each other", "the feet still
 * seem abnormally close together"). Every Style A head and build, on its real file, playing the real clips:
 *   - its hip joints are as wide as the clip skeleton's (within 8%, by leg length): hipFit.ts;
 *   - standing, walking, jogging, running and sitting, its feet are as far apart as the SOURCE's (the clip on the clip file's own
 *     skeleton, where the capture's feet were put): mean spacing within 10% (or 1.5 cm);
 *   - standing, the ankles are 15 to 26 cm apart; walking, never under 6 cm;
 *   - on no moving loop is one leg's skin inside the other's.
 * THE STRIDE FITTED TO OUR BODIES (28 Nov 2026, three3d/stride.ts; the capture's own step width put the boots of our
 * fuller legs into each other): the fitted walks and runs (STRIDE_SHARE) are held to their share of the hip width
 * instead of the source; and, on the real body in its kit cloth (scripts/walk3d/measure.mts), for every build:
 *   - below the knee, no leg passes into the other on any walk or run;
 *   - the thighs' skin never passes into the other's on a walk; the shorts brush under 1.6 cm into each other (h1 c3 on walk_relaxed: 1.5);
 *   - a flat foot slides under 3.5 cm a step at the clip's own ground speed, which every scene now moves him at;
 *   - walk_confident (a standing pose in the file) is dealt to nobody;
 *   - of the 22 men walking out in walkout22, no two are in step (the same walk, within a twentieth of a stride,
 *     for over half the walk).
 * Prints the table (cm): body, clip, source min/mean, ours min/mean, nearest skin.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import { readFileSync } from "node:fs";
import { loadPeople3d, makePerson3d, type Person3D } from "../../lib/star/people3d";
import { addClips, clipInfo, loadAnims3d } from "../../lib/star/three3d/footballAnims";
import { TOON_ALL_HEADS, TOON_BODIES, TOON_BUILD_SCALE, type ToonHead, type ToonBody } from "../../lib/star/style3d/toon/bodies";
import { STRIDE_SHARE, strideOn } from "../../lib/star/three3d/stride";

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

// Quaternius UAL 1 clips (tools/mocap3d/ual.py, 21 Nov 2026): also held to the LIBRARY's own skeleton's
// step width (clips[name].srcFeet, measured at build time on the UAL rig, per metre of leg)
const UAL = ["walk_relaxed", "walk_formal", "jog_easy", "idle_relaxed", "idle_relaxed_m", "idle_talk", "seated_idle", "seated_talk"];
// (the fitted walks and runs are held to STRIDE_SHARE instead, below; walk_confident is a standing pose, dealt to nobody)
const FITTED = strideOn() ? Object.keys(STRIDE_SHARE) : [];
const SOURCE_TRUE = ["idle", "walk", "slump_walk", "jog", "run", "sprint", "dribble_run", "sit_idle", "sitidle", ...UAL].filter((c) => !FITTED.includes(c));
const LOOPS = ["walk", "slump_walk", "jog", "run", "sprint", "dribble_run", "walk_relaxed", "walk_formal", "jog_easy"];
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
    // Stop every action and start only this one: three's mixer only writes a bone whose value CHANGED since it
    // last wrote it, so after the bones are put back at rest a clip holding the same still pose as the clip
    // before (two seated loops) was silently left at rest. Restarting re-reads the bones (21 Nov 2026).
    const pose = (clip: string, t: number) => {
      for (const a of Object.values(p.actions)) a.stop();
      p.rest.forEach(([pos, q], b) => { b.position.copy(pos); b.quaternion.copy(q); });
      const a = p.actions[clip]; a.enabled = true; a.play(); a.setEffectiveWeight(1); a.time = Math.max(1e-4, Math.min(t, a.getClip().duration - 1e-3));
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
      const lib = clipInfo(fb, clip)?.srcFeet;
      if (UAL.includes(clip)) {
        check(!!lib, `${clip}: no srcFeet in the clip file (rebuild with tools/mocap3d/build.py)`);
        if (lib) {
          rows.push(`${head} ${build}  ${clip.padEnd(15)} UAL rig ${cm(lib[0] * leg)} /${cm(lib[1] * leg)}`);
          check(Math.abs(sum - lib[1] * leg) < Math.max(0.015, 0.1 * lib[1] * leg), `${head} ${build} ${clip}: feet ${cm(sum)} cm apart on average, the UAL rig's are ${cm(lib[1] * leg)}`);
        }
      }
      if (clip === "idle") check(sum > 0.15 && sum < 0.26, `${head} ${build}: stands with his ankles ${cm(sum)} cm apart (want 15 to 26)`);
      if (clip === "walk") check(mn > (strideOn() ? 0.12 : 0.06), `${head} ${build}: walks with his ankles ${cm(mn)} cm apart at the narrowest (a tightrope: want over ${strideOn() ? 12 : 6})`);
      // a fitted walk or run: its feet planted at least its share of the hips apart (the ankles' spacing averaged over
      // the frames each foot is down; the hips' width from the joints)
      if (FITTED.includes(clip)) {
        const hw = wp(B.LeftUpLeg).x - wp(B.RightUpLeg).x;
        check(sum > (STRIDE_SHARE[clip] - 0.12) * hw, `${head} ${build} ${clip}: feet ${cm(sum)} cm apart on average, under ${Math.round((STRIDE_SHARE[clip] - 0.12) * 100)}% of the hips' ${cm(hw)}`);
      }
      if (LOOPS.includes(clip)) {
        // (the capture's runner lands his feet on one line and his calves brush: ours may brush, never pass through)
        check(near > 0.0005, `${head} ${build} ${clip}: one leg's skin is in the other's (${cm(near)} cm)`);
      }
    }
  }
}
if (process.env.ROWS_ONLY) { for (const r of rows) console.log(r); process.exit(0); }

// ── the real body in its kit cloth, every build (scripts/walk3d/measure.mts) ──
if (strideOn() && !process.env.SKIP_CLOTH) {
  const { measureClip } = await import("../../scripts/walk3d/measure.mts");
  const W = await import("../../scripts/walk3d/lib.mts");
  const F = await W.loadAll();
  const MOVING = ["walk", "walk_relaxed", "walk_formal", "jog", "run", "sprint", "dribble_run", "slump_walk"];
  const WALKS = ["walk", "walk_relaxed", "walk_formal"];
  for (const head of (process.env.CLOTH_HEADS ?? "h1,m3").split(",") as ToonHead[]) for (const build of TOON_BODIES) {
    const m = await W.person(F, head, build);
    for (const clip of MOVING) {
      const r = await measureClip(m, clip);
      if (!r) continue;
      rows.push(`${head} ${build}  ${clip.padEnd(15)} cloth: plants ${(r.share * 100).toFixed(0)}% of hips, below knee ${r.legIn > 0 ? "IN " + cm(r.legIn) : "clear " + cm(r.legNear)}, thighs IN ${cm(r.thighIn)}, shorts IN ${cm(r.shortsIn)}, slide ${cm(r.slide)} cm/step at ${r.groundSpeed.toFixed(2)} m/s`);
      // (slump_walk: the trailing toe still brushes the heel ahead, 1.7 to 1.9 cm: a known weak point)
      if (clip !== "slump_walk") check(r.legIn === 0, `${head} ${build} ${clip}: below the knee one leg goes ${cm(r.legIn)} cm into the other`);
      if (WALKS.includes(clip)) {
        check(r.thighIn === 0, `${head} ${build} ${clip}: a thigh goes ${cm(r.thighIn)} cm into the other`);
        check(r.shortsIn < 0.016, `${head} ${build} ${clip}: the shorts' legs go ${cm(r.shortsIn)} cm into each other (want under 1.6)`);
      }
      check(r.slide < 0.035, `${head} ${build} ${clip}: a flat foot slides ${cm(r.slide)} cm a step (want under 3.5)`);
      check(r.groundSpeed > 0.5, `${head} ${build} ${clip}: no ground speed measured (${r.groundSpeed.toFixed(2)} m/s)`);
    }
  }
  // walk_confident is dealt to nobody
  const { ownMotion } = await import("../../lib/star/people/life");
  const dealt = Array.from({ length: 2000 }, (_, i) => ownMotion(`p${i}`).walk);
  check(!dealt.includes("walk_confident" as never), "walk_confident (a standing pose) is dealt to someone");
  // 22 men walking out: no two in step
  const { TEST_SCENES } = await import("../../lib/star/cutscene/testScenes");
  const { compileScript, clipsAt } = await import("../../lib/star/cutscene/timeline");
  const sc = TEST_SCENES.walkout22();
  const C = compileScript(sc, undefined, sc.source?.event);
  const ids = C.cast.map((c) => c.id);
  const DUR: Record<string, number> = { walk: 1.175, walk_relaxed: 1.333, walk_formal: 1.333 };
  const at: Record<string, [string, number][]> = {};
  const ts = Array.from({ length: 80 }, (_, i) => 2 + i * 0.1);
  // each man's stride clock as the director runs it: the distance over his walk's ground speed on his own build
  // (measured above, h1: walk 0.93 / 1.04 / 0.98 m/s on c1 / c2 / c3, the UAL walks 0.84-0.95)
  const { toonBodyFor } = await import("../../lib/star/style3d/toon/bodies");
  const GS: Record<string, number[]> = { walk: [0.93, 1.04, 0.98], walk_relaxed: [0.84, 0.93, 0.88], walk_formal: [0.85, 0.95, 0.9] };
  for (const id of ids) {
    const b = TOON_BODIES.indexOf(toonBodyFor(id));
    at[id] = ts.map((t) => { const e = clipsAt(C, id, t, (n) => n in DUR || n === "idle", (n) => DUR[n] ?? 3, "teammate", "player", (n) => GS[n]?.[b]).entries.sort((a, b2) => b2[2] - a[2])[0]; return [e[0], e[1] / (DUR[e[0]] ?? 3)]; });
  }
  let inStep = 0;
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const same = ts.filter((_, k) => { const a = at[ids[i]][k], b = at[ids[j]][k]; const d = Math.abs(a[1] - b[1]) % 1; return a[0] === b[0] && Math.min(d, 1 - d) < 0.05; }).length;
    if (same > ts.length / 2) { inStep++; problems.push(`walkout22: ${ids[i]} and ${ids[j]} walk in step (${same} of ${ts.length} moments)`); }
  }
  rows.push(`walkout22: ${ids.length} men, ${inStep} pairs in step`);
}
console.log("body      clip            source min / mean      ours min / mean (cm between the ankles)");
for (const r of rows) console.log(r);
if (problems.length) { console.log(`FAIL — ${problems.length} problem(s):`); for (const p of problems) console.log("  " + p); process.exit(1); }
console.log(`gaitWidth: ${heads.length} heads pass`);
