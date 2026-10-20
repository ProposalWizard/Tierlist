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
 * broad and slim builds; add B5b's body with --ref when it lands). Nothing
 * else in the files changes. Then the files are packed again the
 * scripts/perf3d/shrink-models.mjs way (meshopt clips, keys resampled).
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
const WRITE = ["LeftShoulder", "LeftArm", "LeftForeArm", "RightShoulder", "RightArm", "RightForeArm"];

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
/** Largest turn between two tracks, sampled at the new track's keys. */
function maxAngle(tr: THREE.KeyframeTrack, old: THREE.KeyframeTrack): number {
  const it = old.createInterpolant();
  let m = 0;
  for (let i = 0; i < tr.times.length; i++) {
    const o = it.evaluate(tr.times[i]);
    const a = new THREE.Quaternion(o[0], o[1], o[2], o[3]).normalize(), b = new THREE.Quaternion(tr.values[i * 4], tr.values[i * 4 + 1], tr.values[i * 4 + 2], tr.values[i * 4 + 3]);
    m = Math.max(m, a.angleTo(b));
  }
  return m;
}

for (const file of FILES) {
  const g = await parse(stripped(file));
  const orig = new Map<string, THREE.KeyframeTrack>();
  for (const c of g.animations as THREE.AnimationClip[]) for (const t of c.tracks) if (t.name.endsWith(".quaternion")) orig.set(`${c.name}|${t.name.slice(0, -11)}`, t);
  const rows: string[] = [];
  for (const sb of sbs) for (const c of g.animations as THREE.AnimationClip[]) {
    const r = settleClip(THREE, sb, c);
    if (r && sb === sbs[0]) rows.push(`${r.clip}: collarbone ${r.clavBefore.toFixed(0)}° → ${r.clavAfter.toFixed(0)}°, arm in ${r.inBefore.toFixed(1)} → ${r.inAfter.toFixed(1)} cm (turned ≤ ${r.turned.toFixed(0)}°)`);
  }
  console.log(`\n${file}\n  ${rows.join("\n  ")}`);
  if (opt.dry) continue;
  const doc = await io.read(file);
  const root = doc.getRoot();
  const buffer = root.listBuffers()[0];
  for (const clip of g.animations as THREE.AnimationClip[]) {
    const anim = root.listAnimations().find((a: { getName(): string }) => a.getName() === clip.name);
    if (!anim) { console.warn(`  ${clip.name}: not in the file`); continue; }
    // the bones that changed, and one set of key times for all of them (shared, like the file's own)
    const changed: { bone: string; tr: THREE.KeyframeTrack; node: unknown }[] = [];
    for (const bone of WRITE) {
      const tr = clip.tracks.find((t) => t.name === `${bone}.quaternion`);
      if (!tr) continue;
      const node = root.listNodes().find((n: { getName(): string }) => n.getName() === bone);
      if (!node) continue;
      // unchanged (within 0.05°) against the file's own track: leave it as it was
      const old = orig.get(`${clip.name}|${bone}`);
      if (old && maxAngle(tr, old) < 0.05 * Math.PI / 180) continue;
      changed.push({ bone, tr, node });
    }
    if (!changed.length) continue;
    const times = changed[0].tr.times;
    const keep = [...new Set(changed.flatMap((c) => thin(c.tr.times, c.tr.values, KEY_TOL)))].sort((x, y) => x - y);
    const input = doc.createAccessor().setType("SCALAR").setArray(new Float32Array(keep.map((k) => times[k]))).setBuffer(buffer);
    for (const { tr, node } of changed) {
      const output = doc.createAccessor().setType("VEC4").setArray(new Float32Array(keep.flatMap((k) => [tr.values[k * 4], tr.values[k * 4 + 1], tr.values[k * 4 + 2], tr.values[k * 4 + 3]]))).setBuffer(buffer);
      const sampler = doc.createAnimationSampler().setInput(input).setOutput(output).setInterpolation("LINEAR");
      anim.addSampler(sampler);
      const ch = anim.listChannels().find((c: { getTargetNode(): unknown; getTargetPath(): string }) => c.getTargetNode() === node && c.getTargetPath() === "rotation");
      if (ch) { const was = ch.getSampler(); ch.setSampler(sampler); if (was && !anim.listChannels().some((c: { getSampler(): unknown }) => c.getSampler() === was)) { anim.removeSampler(was); was.dispose(); } }
      else anim.addChannel(doc.createAnimationChannel().setTargetNode(node).setTargetPath("rotation").setSampler(sampler));
    }
  }
  // only the old key arrays go (never a leaf bone: runPosture reads the head's end bone)
  await doc.transform(prune({ propertyTypes: ["Accessor", "AnimationSampler"] }), dedup({ propertyTypes: ["Accessor"] }));
  // packed as scripts/perf3d/shrink-models.mjs packs clips (meshopt, the FILTER method)
  const { EXTMeshoptCompression } = req("@gltf-transform/extensions");
  const mo = root.listExtensionsUsed().find((e: { extensionName: string }) => e.extensionName === "EXT_meshopt_compression");
  if (mo) mo.dispose();
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
  await io.write(file, doc);
  console.log(`  written (${refs.join(", ")})`);
}
