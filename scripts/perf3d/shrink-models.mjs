// SHRINK THE 3D MODELS (6 Oct 2026): rewrites the GLBs the 3D scenes load
// (garden, shop, office, signing, the Star Pass podium) IN PLACE, smaller, so
// they download and open faster on phones. Same shapes, same poses.
//
//   - geometry and animation: EXT_meshopt_compression (three's own decoder,
//     three/examples/jsm/libs/meshopt_decoder.module.js, ~25 KB; every loader
//     calls setMeshoptDecoder via lib/star/three3d/meshopt.ts)
//   - animation keys: resampled (keys a straight line between their
//     neighbours already gives are dropped, 1e-4 tolerance)
//   - JPEG / PNG textures: WebP (iOS 14+), same pixel size
//   - Draco files: decoded and re-packed with meshopt (the scenes no longer
//     need the 250 KB Draco decoder for them)
//
// Which attributes may be stored as 8/16-bit integers depends on what the
// game's own code does with each file, so every file has a POLICY below.
// Code that reads raw vertex data (people3d.ts dequantize, shop3d dressInKit,
// the garden's tree rebuild, freezeStatic) is why some files keep floats.
//
// Run after ANY rebuild of these files (build_onebody.py, build_people3d.py,
// tools/garden3d/*, tools/shop3d/*): a rebuild writes them big again.
// A file already carrying EXT_meshopt_compression is skipped, so running it
// twice is harmless.
//
//   npm i --no-save @gltf-transform/core@4 @gltf-transform/functions@4 @gltf-transform/extensions@4 meshoptimizer draco3dgltf sharp
//   node scripts/perf3d/shrink-models.mjs            # every file below, in place
//   node scripts/perf3d/shrink-models.mjs --out=/tmp/x star/onebody/player.glb   # a try, written elsewhere
//   (--tools=<dir> if the packages are installed in another folder)
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const ROOT = new URL("../../", import.meta.url).pathname;
const PUB = path.join(ROOT, "public");
const args = process.argv.slice(2);
const opt = (k) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const files = args.filter((a) => !a.startsWith("--"));
const OUT = opt("out");

// Load the tools from the repo (npm i --no-save) or --tools=<dir>; all
// through require so every package shares one copy of @gltf-transform/core.
const req = (() => {
  for (const dir of [opt("tools"), process.env.SHRINK_TOOLS, ROOT].filter(Boolean)) {
    const r = createRequire(path.join(path.resolve(dir), "noop.js"));
    try { r.resolve("@gltf-transform/core"); return r; } catch { /* next */ }
  }
  console.error("Missing tools. Run:\n  npm i --no-save @gltf-transform/core@4 @gltf-transform/functions@4 @gltf-transform/extensions@4 meshoptimizer draco3dgltf sharp");
  process.exit(1);
})();
const { NodeIO, PropertyType } = req("@gltf-transform/core");
const { ALL_EXTENSIONS, EXTMeshoptCompression, EXTTextureWebP } = req("@gltf-transform/extensions");
const { dedup, prune, resample, quantize, reorder, listTextureSlots } = req("@gltf-transform/functions");
const { MeshoptEncoder, MeshoptDecoder } = req("meshoptimizer");
const draco3d = req("draco3dgltf");
const sharp = req("sharp");

// ── Policies ─────────────────────────────────────────────────────────────
// q: which vertex attributes become 8/16-bit (a RegExp), or null for none.
// quantMeta: also write scene extras.quant {scale, offset} — people3d.ts's
//   dequantize() turns positions back into metres from it (the body shader
//   reads rest-pose metres).
// anim: resample the clips.
const ANIM = { q: null, anim: true };
const PEOPLE = {
  // already 16-bit (build_onebody.py); positions must stay exactly as they
  // are: extras.quant describes them.
  onebody: { q: null, webp: true },
  // float bodies (build_people3d.py): quantized here, extras.quant written.
  old: { q: /^(POSITION|NORMAL|TEXCOORD_0)$/, quantMeta: true, webp: true },
};
const POLICY = {
  "star/people3d/anims.glb": ANIM,
  "star/shop3d/anims.glb": ANIM,
  "star/garden3d/anims.glb": ANIM,
  // Kicking, reactions, training and casino moves, both skeletons (tools/anims3d/build.py).
  "star/anims3d/football.glb": ANIM,
  "star/anims3d/casino.glb": ANIM,
  "star/anims3d/football-ual.glb": ANIM,
  "star/anims3d/casino-ual.glb": ANIM,
  // Motion capture (CMU) on both skeletons (tools/mocap3d/build.py), Settings → Look → Motion: Mocap.
  "star/anims3d/mocap.glb": ANIM,
  "star/anims3d/mocap-ual.glb": ANIM,
  // The ovation's hugs, dap-ups, pats and claps (tools/ovation3d/author_greetings.py).
  "star/ovation3d/greetings.glb": ANIM,
  // The human body (tools/human3d/build_human.py): float positions on purpose — the game
  // re-shapes them per person (build shapes, clothes anchors), so no quantizing.
  "star/human3d/human.glb": { q: null, webp: true, keepOrder: true },
  "star/onebody/player.glb": PEOPLE.onebody,
  "star/onebody/player-buzz.glb": PEOPLE.onebody,
  "star/onebody/player-long.glb": PEOPLE.onebody,
  "star/onebody/manager.glb": PEOPLE.onebody,
  "star/people3d/player.glb": PEOPLE.old,
  "star/people3d/player-buzz.glb": PEOPLE.old,
  "star/people3d/player-long.glb": PEOPLE.old,
  "star/people3d/manager.glb": PEOPLE.old,
  // The old shop/garden player: dressInKit (shop3d/scene.ts) reads positions
  // in metres and skinWeight.array as 0..1 floats, so those two stay float.
  "star/shop3d/character.glb": { q: /^(NORMAL|TEXCOORD_\d+|COLOR_\d+)$/, keepWeights: true, webp: true },
  // Animals: nothing reads their vertices.
  "star/garden3d/horse.glb": { q: /.*/, anim: true, webp: true },
  "star/garden3d/bird.glb": { q: /.*/, anim: true, webp: true },
  // Garden pieces: the scene takes each piece's geometry OUT of its node
  // (garden3d/scene.ts "pieces"), so a position decode folded into the node
  // would be lost: positions stay float. Normals/UVs go small; the loader
  // (lib/star/three3d/meshopt.ts) turns a still mesh's small attributes back
  // to float so freezeStatic can still merge them with the scene's own.
  // Kept as Draco: measured smaller over the wire than meshopt here (6 Oct
  // 2026, brotli: props 79 KB Draco vs 99 KB meshopt; a boot 59 vs 69; a car
  // 149 vs 176). The garden's pieces would also need their positions kept
  // float: garden3d/scene.ts takes each piece's geometry out of its node.
  "star/garden3d/props.glb": { skip: "Draco (smaller than meshopt)" },
  "star/signing3d/aviators.glb": { q: /.*/ },
  "star/star-pass/3d/podium-europa-medium.glb": { q: /.*/ },
  "star/star-pass/3d/podium-premier-medium.glb": { q: /.*/ },
  "star/star-pass/3d/reward-ball.glb": { q: /.*/ },
  "star/star-pass/3d/reward-glasses.glb": { q: /.*/, anim: true },
};
for (const id of ["control", "curl", "elite", "maestro", "power", "speed", "starter"]) POLICY[`star/shop3d/items/boot-${id}.glb`] = { skip: "Draco (smaller than meshopt)" };
for (const id of ["1", "2", "3", "4", "classic", "suv"]) POLICY[`star/shop3d/items/car-${id}.glb`] = { skip: "Draco (smaller than meshopt)" };
// The generated family car (Higgsfield → Tripo, 9 Oct 2026; look H): textures cut to 1024 first
// (gltf-transform textureCompress); nothing reads its vertices, so everything may go small.
POLICY["star/shop3d/items/car-family-hf.glb"] = { q: /.*/, webp: true };

// ── Run ──────────────────────────────────────────────────────────────────
await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  "meshopt.encoder": MeshoptEncoder,
  "meshopt.decoder": MeshoptDecoder,
  "draco3d.decoder": await draco3d.createDecoderModule(),
});
const todo = files.length ? files : Object.keys(POLICY);
let a = 0, b = 0;
const rows = [];
for (const f of todo) {
  const rel = f.replace(/^public\//, "").replace(/^\//, "");
  const pol = POLICY[rel];
  if (!pol) { console.error(`no policy for ${rel} — add one to POLICY first`); process.exitCode = 1; continue; }
  const src = path.join(PUB, rel);
  if (pol.skip) { rows.push([rel, fs.statSync(src).size, fs.statSync(src).size, `left as is: ${pol.skip}`]); continue; }
  const doc = await io.read(src);
  const root = doc.getRoot();
  const used = root.listExtensionsUsed().map((e) => e.extensionName);
  // Never twice: a second pass would re-quantize and break extras.quant.
  if (used.includes("EXT_meshopt_compression")) { rows.push([rel, fs.statSync(src).size, fs.statSync(src).size, "already shrunk"]); continue; }
  const before = snapshot(doc);
  const draco = root.listExtensionsUsed().find((e) => e.extensionName === "KHR_draco_mesh_compression");
  if (draco) draco.dispose();

  const steps = [dedup({ propertyTypes: [PropertyType.ACCESSOR, PropertyType.TEXTURE] }), prune({ keepAttributes: true, keepLeaves: true, keepSolidTextures: true })];
  if (pol.anim) steps.push(resample({ tolerance: 1e-4 }));
  // keepOrder: the file refers to its own vertices by number (the human body's clothes anchors).
  if (root.listMeshes().length && !pol.keepOrder) steps.push(reorder({ encoder: MeshoptEncoder, target: "size" }));
  let volume = null;
  if (pol.q) {
    if (pol.quantMeta) volume = meshVolume(root.listMeshes().find((m) => m.listPrimitives().some((p) => p.getAttribute("POSITION"))));
    steps.push(quantize({ pattern: pol.q, patternTargets: pol.q, quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12, normalizeWeights: !pol.keepWeights }));
  }
  await doc.transform(...steps);
  if (pol.webp) await toWebp(doc);
  if (volume) {
    const scene = root.listScenes()[0];
    scene.setExtras({ ...scene.getExtras(), quant: { scale: volume.scale, offset: volume.offset } });
  }
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });

  const dst = OUT ? path.join(OUT, rel) : src;
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  const tmp = `${dst}.tmp-${process.pid}.glb`;
  await io.write(tmp, doc);
  // Check before replacing: same meshes, vertices, triangles, clips; the
  // positions where they were.
  const err = await check(tmp, before, pol, volume);
  if (err) { fs.rmSync(tmp); console.error(`${rel}: NOT written — ${err}`); process.exitCode = 1; continue; }
  const s0 = fs.statSync(src).size;
  fs.renameSync(tmp, dst);
  const s1 = fs.statSync(dst).size;
  a += s0; b += s1;
  rows.push([rel, s0, s1, draco ? "was Draco" : ""]);
}
const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
for (const [rel, s0, s1, note] of rows) console.log(`${rel.padEnd(46)} ${kb(s0).padStart(8)} → ${kb(s1).padStart(8)}  ${note}`);
if (a) console.log(`${"TOTAL (files written)".padEnd(46)} ${kb(a).padStart(8)} → ${kb(b).padStart(8)}`);

// ── Helpers ──────────────────────────────────────────────────────────────

/** JPEG/PNG → WebP, same size; kept only if it comes out clearly smaller.
 *  Normal maps get a higher quality (their errors show as bumps). */
async function toWebp(doc) {
  let any = false;
  for (const t of doc.getRoot().listTextures()) {
    if (!/^image\/(jpeg|png)$/.test(t.getMimeType())) continue;
    const normal = listTextureSlots(t).some((s) => /normal/i.test(s));
    const src = t.getImage();
    const out = await sharp(Buffer.from(src)).webp({ quality: normal ? 85 : 84, effort: 6 }).toBuffer();
    if (out.length > src.byteLength * 0.9) continue;
    t.setImage(new Uint8Array(out)).setMimeType("image/webp");
    if (t.getURI()) t.setURI(t.getURI().replace(/\.(jpe?g|png)$/i, ".webp"));
    any = true;
  }
  if (any) doc.createExtension(EXTTextureWebP).setRequired(true);
}

/** gltf-transform quantize()'s own "mesh" volume: the box's centre, its largest half-side. */
function meshVolume(mesh) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity], el = [];
  for (const p of mesh.listPrimitives()) {
    const pos = p.getAttribute("POSITION");
    for (let i = 0; i < pos.getCount(); i++) { pos.getElement(i, el); for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], el[k]); hi[k] = Math.max(hi[k], el[k]); } }
  }
  return { offset: [0, 1, 2].map((k) => lo[k] + (hi[k] - lo[k]) / 2), scale: Math.max(...[0, 1, 2].map((k) => (hi[k] - lo[k]) / 2)) };
}

function snapshot(doc) {
  const r = doc.getRoot();
  const meshes = r.listMeshes().map((m) => m.listPrimitives().map((p) => {
    const pos = p.getAttribute("POSITION");
    const box = [[Infinity, Infinity, Infinity], [-Infinity, -Infinity, -Infinity]], el = [];
    if (pos) for (let i = 0; i < pos.getCount(); i++) { pos.getElement(i, el); for (let k = 0; k < 3; k++) { box[0][k] = Math.min(box[0][k], el[k]); box[1][k] = Math.max(box[1][k], el[k]); } }
    return { tris: p.getIndices() ? p.getIndices().getCount() : pos?.getCount() ?? 0, attrs: p.listSemantics().sort().join(","), box };
  }));
  const clips = r.listAnimations().map((x) => `${x.getName()}:${x.listChannels().length}`).sort().join(" ");
  const dur = Math.max(0, ...r.listAnimations().flatMap((x) => x.listSamplers().map((s) => s.getInput().getMax([])[0])));
  return { meshes, clips, dur, textures: r.listTextures().length, skins: r.listNodes().filter((n) => n.getSkin()).length };
}

async function check(file, before, pol, volume) {
  const doc = await io.read(file);
  const after = snapshot(doc);
  if (after.clips !== before.clips) return `clips changed (${before.clips} → ${after.clips})`;
  if (Math.abs(after.dur - before.dur) > 1e-3) return `clip length changed`;
  if (after.textures !== before.textures) return `texture count changed`;
  if (after.skins !== before.skins) return `skin count changed`;
  if (after.meshes.length !== before.meshes.length) return `mesh count changed`;
  for (let i = 0; i < before.meshes.length; i++) {
    const A = before.meshes[i], B = after.meshes[i];
    if (A.length !== B.length) return `primitive count changed on mesh ${i}`;
    for (let j = 0; j < A.length; j++) {
      if (A[j].tris !== B[j].tris) return `triangles changed on mesh ${i}/${j}`;
      if (A[j].attrs !== B[j].attrs) return `attributes changed on mesh ${i}/${j}: ${A[j].attrs} → ${B[j].attrs}`;
      // Unquantized positions must come back exactly where they were.
      if (!pol.q || !pol.q.test("POSITION")) {
        for (let k = 0; k < 3; k++) if (Math.abs(A[j].box[0][k] - B[j].box[0][k]) > 1e-4 || Math.abs(A[j].box[1][k] - B[j].box[1][k]) > 1e-4) return `positions moved on mesh ${i}/${j}`;
      }
    }
  }
  if (volume) {
    // The extras.quant decode must give back the original box (people3d.ts dequantize).
    const r = doc.getRoot();
    const q = r.listScenes()[0].getExtras().quant;
    const mesh = r.listMeshes().find((m) => m.listPrimitives().some((p) => p.getAttribute("POSITION")));
    const bi = r.listMeshes().indexOf(mesh);
    const pos = mesh.listPrimitives()[0].getAttribute("POSITION");
    const el = [], lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < pos.getCount(); i++) { pos.getElement(i, el); for (let k = 0; k < 3; k++) { const v = el[k] * q.scale + q.offset[k]; lo[k] = Math.min(lo[k], v); hi[k] = Math.max(hi[k], v); } }
    const want = before.meshes[bi][0].box;
    for (let k = 0; k < 3; k++) if (Math.abs(lo[k] - want[0][k]) > 1e-3 || Math.abs(hi[k] - want[1][k]) > 1e-3) return `extras.quant does not decode to the original positions (axis ${k}: ${lo[k]}..${hi[k]} vs ${want[0][k]}..${want[1][k]})`;
  }
  return null;
}
