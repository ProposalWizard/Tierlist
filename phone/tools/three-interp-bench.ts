/**
 * HOW LONG THE PHONE'S PLAIN-JAVASCRIPT 3D WORK TAKES WITH NO JIT (a stand-in
 * for Hermes, the phone's engine, which interprets bytecode and has no JIT).
 *
 *   cd phone && node --jitless --import tsx tools/three-interp-bench.ts
 *
 * 1. Unpacking every bundled 3D file's meshopt parts (src/three/meshoptDecoder.ts).
 * 2. The Home player's per-frame pose work without drawing (lib/star homeIdle,
 *    poseClips, the stance, the face, the ball): src/three/homeScene.ts's
 *    drawAt minus renderer.render, on the real files (pictures skipped: no
 *    Skia here, they do not change the pose).
 * V8 with --jitless is an interpreter like Hermes; read the numbers as the
 * right size, not as a phone's exact times (Hermes is usually somewhat faster
 * than V8's interpreter, and a phone's processor slower than this machine's).
 */
import fs from "node:fs";
import path from "node:path";
import * as THREE from "three";
import { MeshoptDecoderJS, meshoptStats } from "../src/three/meshoptDecoder";
import { THREE_ASSET_URLS } from "../src/three/assetList";
import { setThreePlatform } from "../src/three/platform";

const ROOT = path.join(__dirname, "..", "..");
const ms = (f: () => void) => { const t = performance.now(); f(); return performance.now() - t; };

(async () => {
  // 1. unpacking
  let parts = 0, bytes = 0;
  const t = ms(() => {
    for (const u of THREE_ASSET_URLS) {
      const buf = fs.readFileSync(path.join(ROOT, "public", u));
      const jl = buf.readUInt32LE(12);
      const json = JSON.parse(buf.subarray(20, 20 + jl).toString("utf8"));
      const bin = new Uint8Array(buf.buffer, buf.byteOffset + 20 + jl + 8, buf.readUInt32LE(20 + jl));
      for (const bv of json.bufferViews ?? []) {
        const e = bv.extensions?.EXT_meshopt_compression;
        if (!e) continue;
        const out = new Uint8Array(e.count * e.byteStride);
        MeshoptDecoderJS.decodeGltfBuffer(out, e.count, e.byteStride, bin.subarray(e.byteOffset ?? 0, (e.byteOffset ?? 0) + e.byteLength), e.mode, e.filter);
        parts++; bytes += out.length;
      }
    }
  });
  console.log(`unpack all ${THREE_ASSET_URLS.length} files: ${parts} parts, ${(bytes / 1024).toFixed(0)} KB, ${t.toFixed(0)} ms`);
  const homeFiles = ["/star/people3d/toon-p2.glb", "/star/people3d/anims.glb", "/star/anims3d/football.glb", "/star/anims3d/mocap.glb"];
  meshoptStats.ms = 0; meshoptStats.parts = 0;

  // 2. the Home player's pose, per frame
  setThreePlatform({
    Skia: { Image: { MakeImageFromEncoded: () => null }, Data: { fromBytes: () => null } } as never,
    bytes: async (url) => { const b = fs.readFileSync(path.join(ROOT, "public", url)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer; },
  });
  // no pictures here: an image that "fails" leaves the material without its map (pose work is the same)
  const g = globalThis as Record<string, unknown>;
  g.document = undefined;
  const { GLTFLoader } = await import("../src/three/GLTFLoader");
  const { withMeshopt } = await import("../src/three/meshopt");
  const people = await import("@/lib/star/people3d");
  const { loadAnims3d, addClips, clipInfo } = await import("@/lib/star/three3d/footballAnims");
  const { homeIdleAt, homeSway } = await import("@/lib/star/homeIdle");
  const SK = await import("three/examples/jsm/utils/SkeletonUtils.js");
  const l0 = performance.now();
  const loader = await withMeshopt(new GLTFLoader());
  const [gl, anims, fb] = await Promise.all([people.loadToonHead(loader, "h2"), people.loadPeople3d(loader, "anims", "new"), loadAnims3d(loader as never, "football")]);
  const loadMs = performance.now() - l0;
  const p = people.makePerson3d(THREE, SK as never, gl, anims, { outline: 0.006, you: true });
  addClips(THREE, p, fb);
  void clipInfo;
  console.log(`Home player files (${homeFiles.length}) loaded and unpacked: ${loadMs.toFixed(0)} ms (of which meshopt ${meshoptStats.ms.toFixed(0)} ms)`);
  const has = (c: string) => !!p.actions[c];
  const len = (c: string) => p.actions[c]?.getClip().duration ?? 1;
  const times: number[] = [];
  for (let i = 0; i < 300; i++) {
    const tt = i / 30;
    times.push(ms(() => {
      const st = homeIdleAt(tt, has, len);
      people.poseClips(p, st.clips);
      if (st.idle > 0.01) {
        people.turnBoneInBody(THREE, p, "LeftUpLeg", [0, 0, 1], 3.2 * st.idle);
        people.turnBoneInBody(THREE, p, "RightUpLeg", [0, 0, 1], -3.2 * st.idle);
        people.relaxToonArms(THREE, p, 5 * st.idle, 9 * st.idle);
        const hips = p.bones.Hips;
        if (hips) { hips.position.x += (homeSway(tt) / (p.unit || 0.01)) * st.idle; hips.updateMatrixWorld(true); }
      }
      p.root.rotation.y = 0.32;
      p.root.updateMatrixWorld(true);
    }));
  }
  times.sort((a, b) => a - b);
  console.log(`Home player pose per frame (300 frames): median ${times[150].toFixed(2)} ms, 95% ${times[285].toFixed(2)} ms, worst ${times[299].toFixed(2)} ms`);
})().catch((e) => { console.error(e); process.exit(1); });
