/**
 * SETTLE THE SHIPPED CLIPS (B5c, 20 Oct 2026; Harry: "why is the shoulders
 * always so awkwardly high when moving … even when standing stationary" and
 * "the arms are hitting into the body and through the body").
 *
 *   SHRINK_TOOLS=<dir with @gltf-transform + meshoptimizer> \
 *   npx tsx tools/motionref/settle_clips.mts [--ref=body.glb@c2,...] [--dry] [file.glb ...]
 *
 * Rewrites, in place, the collarbone, upper-arm and forearm tracks of every
 * clip in the people-skeleton clip files (default: people3d/anims.glb,
 * anims3d/mocap.glb, anims3d/football.glb, anims3d/casino.glb) with
 * lib/star/three3d/shoulderSet.ts's settleClip, measured on each reference
 * body in turn (default SETTLE_REFS in nodeBody.mts: today's Style A body,
 * broad and slim builds, B5b's f2/f3 and B5d's d1-d3). On the standing and
 * walking clips (POSTURE_CLIPS) the first body also sets the posture (Harry
 * 23:21: "whyyyy is the posture so weird"): the spine, neck and head, and on
 * the still ones the hips (rotation and place) and legs. Nothing else in the
 * files changes. Then the files are packed again the
 * scripts/perf3d/shrink-models.mjs way (meshopt clips, keys resampled); a file
 * whose key times would not match its keys is never written (clip_check.mts
 * reads a written file the same way).
 *
 * Run it again whenever a body or a clip file changes (tools/mocap3d/build.py
 * and tools/anims3d/build.py rebuild these files from their sources: this
 * step comes after them). Check with:
 *   npx tsx tools/motionref/arm_clearance.mts <bodies>
 * It is safe to run twice: a settled clip is already level and clear.
 */
import * as THREE from "three";
import path from "node:path";
import { createRequire } from "node:module";
import { settleClip } from "../../lib/star/three3d/shoulderSet";
import { stripped, parse, nodeBody, shoulderBodyFor, SETTLE_REFS } from "./nodeBody.mts";

const args = process.argv.slice(2);
const opt = Object.fromEntries(args.filter((a) => a.startsWith("--")).map((a) => { const [k, v] = a.slice(2).split("="); return [k, v ?? "1"]; }));
const files = args.filter((a) => !a.startsWith("--"));
const FILES = files.length ? files : ["public/star/people3d/anims.glb", "public/star/anims3d/mocap.glb", "public/star/anims3d/football.glb", "public/star/anims3d/casino.glb"];
const refs = opt.ref ? opt.ref.split(",") : SETTLE_REFS;

const req = (() => {
  for (const dir of [opt.tools, process.env.SHRINK_TOOLS, process.cwd()].filter(Boolean) as string[]) {
    const r = createRequire(path.join(path.resolve(dir), "noop.js"));
    try { r.resolve("@gltf-transform/core"); return r; } catch { /* next */ }
  }
  console.error("Missing tools. Run:\n  npm i --no-save @gltf-transform/core@4 @gltf-transform/functions@4 @gltf-transform/extensions@4 meshoptimizer");
  process.exit(1);
})();
const { NodeIO } = req("@gltf-transform/core");
const { ALL_EXTENSIONS } = req("@gltf-transform/extensions");
const { dedup, prune } = req("@gltf-transform/functions");
const { MeshoptEncoder, MeshoptDecoder } = req("meshoptimizer");
await MeshoptDecoder.ready; await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder });

const sbs = [];
for (const r of refs) {
  const sb = shoulderBodyFor(await nodeBody(r));
  if (!sb) { console.error(`ref ${r}: bones missing`); process.exit(1); }
  sbs.push(sb);
}
const WRITE = ["LeftShoulder", "LeftArm", "LeftForeArm", "RightShoulder", "RightArm", "RightForeArm",
  // the posture (shoulderSet POSTURE): the spine, neck and head; standing still, the hips and legs
  "Spine02", "Spine01", "Spine", "neck", "Head", "Hips", "LeftUpLeg", "LeftLeg", "LeftFoot", "RightUpLeg", "RightLeg", "RightFoot"];

/** Keys kept so a straight slerp between them stays within `tol` radians of every dropped key (the clip files stay small). */
const KEY_TOL = 0.5 * Math.PI / 180;
function thin(times: ArrayLike<number>, v: ArrayLike<number>, tol: number): number[] {
  const n = times.length;
  if (n <= 2) return Array.from({ length: n }, (_, i) => i);
  const q = (i: number) => new THREE.Quaternion(v[i * 4], v[i * 4 + 1], v[i * 4 + 2], v[i * 4 + 3]);
  const keep = new Set([0, n - 1]);
  const split = (a: number, b: number) => {
    let worst = -1, wi = -1;
    const qa = q(a), qb = q(b);
    for (let i = a + 1; i < b; i++) {
      const u = (times[i] - times[a]) / (times[b] - times[a]);
      const e = qa.clone().slerp(qb, u).angleTo(q(i));
      if (e > worst) { worst = e; wi = i; }
    }
    if (worst > tol) { keep.add(wi); split(a, wi); split(wi, b); }
  };
  split(0, n - 1);
  return [...keep].sort((x, y) => x - y);
}
/** Keys kept so a straight line between them stays within `tol` (the file's own units: centimetres) of every dropped key. */
const POS_TOL = 0.05;
function thinV(times: ArrayLike<number>, v: ArrayLike<number>, tol: number): number[] {
  const n = times.length;
  if (n <= 2) return Array.from({ length: n }, (_, i) => i);
  const keep = new Set([0, n - 1]);
  const split = (a: number, b: number) => {
    let worst = -1, wi = -1;
    for (let i = a + 1; i < b; i++) {
      const u = (times[i] - times[a]) / (times[b] - times[a]);
      let e = 0; for (let c = 0; c < 3; c++) e = Math.max(e, Math.abs(v[a * 3 + c] + (v[b * 3 + c] - v[a * 3 + c]) * u - v[i * 3 + c]));
      if (e > worst) { worst = e; wi = i; }
    }
    if (worst > tol) { keep.add(wi); split(a, wi); split(wi, b); }
  };
  split(0, n - 1);
  return [...keep].sort((x, y) => x - y);
}
/** Largest move between two position tracks, sampled at the new track's keys. */
function maxMove(tr: THREE.KeyframeTrack, old: THREE.KeyframeTrack): number {
  const it = old.createInterpolant();
  let m = 0;
  for (let i = 0; i < tr.times.length; i++) { const o = it.evaluate(tr.times[i]); m = Math.max(m, Math.hypot(o[0] - tr.values[i * 3], o[1] - tr.values[i * 3 + 1], o[2] - tr.values[i * 3 + 2])); }
  return m;
}
/** Largest turn between two tracks, sampled at the new track's keys. */
function maxAngle(tr: THREE.KeyframeTrack, old: THREE.KeyframeTrack): number {
  const it = old.createInterpolant();
  let m = 0;
  for (let i = 0; i < tr.times.length; i++) {
    const o = it.evaluate(tr.times[i]);
    // both normalized: a packed file's own keys are not quite unit length (that alone read as a 0.6 deg change)
    const a = new THREE.Quaternion(o[0], o[1], o[2], o[3]).normalize(), b = new THREE.Quaternion(tr.values[i * 4], tr.values[i * 4 + 1], tr.values[i * 4 + 2], tr.values[i * 4 + 3]).normalize();
    m = Math.max(m, a.angleTo(b));
  }
  return m;
}

for (const file of FILES) {
  const g = await parse(stripped(file));
  const orig = new Map<string, THREE.KeyframeTrack>();
  for (const c of g.animations as THREE.AnimationClip[]) for (const t of c.tracks) { if (t.name.endsWith(".quaternion")) orig.set(`${c.name}|${t.name.slice(0, -11)}`, t); else if (t.name === "Hips.position") orig.set(`${c.name}|Hips.position`, t); }
  const rows: string[] = [];
  for (const sb of sbs) for (const c of g.animations as THREE.AnimationClip[]) {
    const r = settleClip(THREE, sb, c, { posture: sb === sbs[0] });
    if (r && sb === sbs[0]) rows.push(`${r.clip}: collarbone ${r.clavBefore.toFixed(0)}° → ${r.clavAfter.toFixed(0)}°, arm in ${r.inBefore.toFixed(1)} → ${r.inAfter.toFixed(1)} cm (turned ≤ ${r.turned.toFixed(0)}°)`);
  }
  console.log(`\n${file}\n  ${rows.join("\n  ")}`);
  if (opt.dry) continue;
  const doc = await io.read(file);
  /** Every sampler's key times as long as its values, and finite (a broken file must never be written). */
  const keysOk = (when: string) => {
    let bad = 0;
    for (const a of doc.getRoot().listAnimations()) for (const s of a.listSamplers()) {
      const i = s.getInput(), o = s.getOutput();
      if (i.getCount() !== o.getCount() || Array.from(i.getArray() as Float32Array).some((x) => !Number.isFinite(x))) { bad++; if (bad < 4) console.log(`  ${when}: ${a.getName()} keys ${i.getCount()} / ${o.getCount()}`); }
    }
    return bad;
  };
  const root = doc.getRoot();
  const buffer = root.listBuffers()[0];
  for (const clip of g.animations as THREE.AnimationClip[]) {
    const anim = root.listAnimations().find((a: { getName(): string }) => a.getName() === clip.name);
    if (!anim) { console.warn(`  ${clip.name}: not in the file`); continue; }
    // the bones that changed, and one set of key times for all of them (shared, like the file's own)
    const changed: { bone: string; tr: THREE.KeyframeTrack; node: unknown; path: "rotation" | "translation" }[] = [];
    for (const bone of WRITE) {
      const tr = clip.tracks.find((t) => t.name === `${bone}.quaternion`);
      if (!tr) continue;
      const node = root.listNodes().find((n: { getName(): string }) => n.getName() === bone);
      if (!node) continue;
      // unchanged (within 0.05°) against the file's own track: leave it as it was
      const old = orig.get(`${clip.name}|${bone}`);
      if (tr === old || (old && maxAngle(tr, old) < 0.05 * Math.PI / 180)) continue;
      changed.push({ bone, tr, node, path: "rotation" });
    }
    // the hips' place (the posture's still clips)
    {
      const tr = clip.tracks.find((t) => t.name === "Hips.position");
      const old = orig.get(`${clip.name}|Hips.position`);
      const node = root.listNodes().find((n: { getName(): string }) => n.getName() === "Hips");
      if (tr && node && tr !== old && (!old || maxMove(tr, old) > 1e-4)) changed.push({ bone: "Hips", tr, node, path: "translation" });
    }
    if (!changed.length) continue;
    const times = changed[0].tr.times;
    // one set of key times for all of them: a track on other times is read at these (never mixed up)
    for (const c of changed) {
      const t = c.tr.times;
      if (t.length === times.length && t.every((x, i) => x === times[i])) continue;
      const it = c.tr.createInterpolant(), w = c.path === "rotation" ? 4 : 3, vals: number[] = [];
      for (let i = 0; i < times.length; i++) vals.push(...Array.from(it.evaluate(times[i]) as ArrayLike<number>).slice(0, w));
      c.tr = (c.path === "rotation" ? new THREE.QuaternionKeyframeTrack(c.tr.name, Array.from(times), vals) : new THREE.VectorKeyframeTrack(c.tr.name, Array.from(times), vals)) as THREE.KeyframeTrack;
    }
    const keep = [...new Set(changed.flatMap((c) => c.path === "rotation" ? thin(c.tr.times, c.tr.values, KEY_TOL) : thinV(c.tr.times, c.tr.values, POS_TOL)))].sort((x, y) => x - y);
    const input = doc.createAccessor().setType("SCALAR").setArray(new Float32Array(keep.map((k) => times[k]))).setBuffer(buffer);
    for (const { tr, node, path } of changed) {
      const w = path === "rotation" ? 4 : 3;
      const output = doc.createAccessor().setType(w === 4 ? "VEC4" : "VEC3").setArray(new Float32Array(keep.flatMap((k) => Array.from(tr.values.slice(k * w, k * w + w))))).setBuffer(buffer);
      const sampler = doc.createAnimationSampler().setInput(input).setOutput(output).setInterpolation("LINEAR");
      anim.addSampler(sampler);
      const ch = anim.listChannels().find((c: { getTargetNode(): unknown; getTargetPath(): string }) => c.getTargetNode() === node && c.getTargetPath() === path);
      if (ch) { const was = ch.getSampler(); ch.setSampler(sampler); if (was && !anim.listChannels().some((c: { getSampler(): unknown }) => c.getSampler() === was)) { anim.removeSampler(was); was.dispose(); } }
      else anim.addChannel(doc.createAnimationChannel().setTargetNode(node).setTargetPath(path).setSampler(sampler));
    }
  }
  // only the old key arrays go (never a leaf bone: runPosture reads the head's end bone)
  await doc.transform(prune({ propertyTypes: ["Accessor", "AnimationSampler"] }), dedup({ propertyTypes: ["Accessor"] }));
  // packed as scripts/perf3d/shrink-models.mjs packs clips (meshopt, the FILTER method)
  const { EXTMeshoptCompression } = req("@gltf-transform/extensions");
  const mo = root.listExtensionsUsed().find((e: { extensionName: string }) => e.extensionName === "EXT_meshopt_compression");
  if (mo) mo.dispose();
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
  const broken = keysOk("packed");
  if (broken) { console.error(`  ${file}: ${broken} samplers with broken keys, NOT written`); process.exitCode = 1; continue; }
  await io.write(file, doc);
  console.log(`  written (${refs.join(", ")})`);
}
