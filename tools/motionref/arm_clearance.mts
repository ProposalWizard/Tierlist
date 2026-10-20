/**
 * SHOULDERS AND ARM CLEARANCE on our real bodies and clips (B5c, Harry 20 Oct
 * 2026: "why is the shoulders always so awkwardly high when moving … even when
 * standing stationary" and, on b5b/walk-options.mp4, "the arms are hitting
 * into the body and through the body").
 *
 *   npx tsx tools/motionref/arm_clearance.mts [--fps=15] [--clips=idle,walk] [--json=out.json] body.glb [...]
 *
 * Each body is built the way people3d.makePerson3d builds a Style A person
 * (the Style A neck, head and hand scales; the clips' hips brought to the
 * body; the standing idle's relaxed arms; the toon run lean) and given the
 * clips the game gives it (anims.glb with the mocap idle and jog in, then the
 * football set with the mocap clips in). Every clip is played at --fps and,
 * frame by frame, the mesh is skinned on the CPU and measured:
 *
 *   SHOULDERS
 *     gap      neck base above the two shoulder joints (cm; the bone joints)
 *     clav     each collarbone's line (neck end → shoulder joint) above level (degrees)
 *     top      the highest point of the shoulder (skin weighted to the upper arm
 *              or collarbone) above the neck base (cm; + = the shoulder pokes
 *              up past the base of the neck)
 *   ARMS AGAINST THE BODY
 *     pen      deepest any arm skin goes INSIDE the torso or hips (cm; 0 = never)
 *     gap      closest the arm skin comes to the torso without going in (cm)
 *     frames   share of frames with an arm more than 5 mm inside
 *
 * The arm skin: forearm, hand, fingers, and the upper arm from 40% of its
 * length down (the armpit, where arm and chest are one skin, is left out).
 * The torso: hips, the spine bones, and the top of each thigh. "Inside" is
 * measured against the nearest torso skin point's own outward normal.
 * --rest also measures the bind pose (no clip).
 */
import * as THREE from "three";
import { writeFileSync } from "node:fs";
import { relaxIdleArms, IDLE_POSTURE_CLIPS, levelToonLean, TOON_LEAN_MAX, uprightRunPosture, PEOPLE_POSTURE } from "../../lib/star/three3d/runPosture";
import { levelMocapHeads, mergeClips, MOCAP_PEOPLE_OWN, MOCAP_UAL_OWN } from "../../lib/star/three3d/footballAnims";
import { settleClip } from "../../lib/star/three3d/shoulderSet";
import { stripped, parse, nodeBody, shoulderBodyFor, SETTLE_REFS } from "./nodeBody.mts";

const opt = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith("--")).map((a) => { const [k, v] = a.slice(2).split("="); return [k, v ?? "1"]; }));
const files = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const FPS = Number(opt.fps ?? 15);
const WANT = opt.clips ? new Set(opt.clips.split(",")) : null;
// --fix: settle the clip files first, as tools/motionref/settle_clips.mts does to the shipped files
// (against --ref bodies, default SETTLE_REFS), to see the result before writing it.
const FIX = opt.fix === "1" || opt.fix === "on";
const CLIP_FILES = { own: opt.own ?? "public/star/people3d/anims.glb", mocap: opt.mocap ?? "public/star/anims3d/mocap.glb", football: opt.football ?? "public/star/anims3d/football.glb" };

// ── the clips, as the game gets them ──
const own = await parse(stripped(CLIP_FILES.own));
const mocap = await parse(stripped(CLIP_FILES.mocap));
const football = await parse(stripped(CLIP_FILES.football));
if (FIX) {
  const refs = (opt.ref ? opt.ref.split(",") : SETTLE_REFS);
  const t0 = performance.now();
  for (const r of refs) {
    const sb = shoulderBodyFor(await nodeBody(r));
    if (!sb) { console.log(`ref ${r}: no settle (bones missing)`); continue; }
    for (const g of [own, mocap, football]) for (const c of g.animations) settleClip(THREE, sb, c);
  }
  console.log(`settled the clip files against ${refs.join(", ")} in ${(performance.now() - t0).toFixed(0)} ms`);
}
levelMocapHeads(mocap);
uprightRunPosture(THREE, mocap, PEOPLE_POSTURE);
const ownSet = mergeClips(own, mocap, (n) => MOCAP_PEOPLE_OWN.has(n));
const footSet = mergeClips(football, mocap, (n) => !MOCAP_UAL_OWN.has(n));

/** Around each shoulder joint, where arm and chest skin always meet (and fold), nothing counts as "in". */
const SHOULDER_ZONE = 0.15;
const TORSO = new Set(["Hips", "Spine", "Spine01", "Spine02"]);
const ARM: Record<"L" | "R", { up: string; fore: string; hand: string; clav: string; pre: string }> = {
  L: { up: "LeftArm", fore: "LeftForeArm", hand: "LeftHand", clav: "LeftShoulder", pre: "Left" },
  R: { up: "RightArm", fore: "RightForeArm", hand: "RightHand", clav: "RightShoulder", pre: "Right" },
};

interface Row { clip: string; frames: number; gap: number; clav: number; top: number; pen: number; penAt: number; near: number; penShare: number; worstSide: string; penLow: number; lowShare: number }
const report: Record<string, Row[]> = {};

for (const file of files) {
  const nb = await nodeBody(file);
  const { root, inner, body, bones, hipsRest, palm } = nb;
  const rest = new Map<THREE.Bone, [THREE.Vector3, THREE.Quaternion]>();
  for (const b of Object.values(bones)) rest.set(b, [b.position.clone(), b.quaternion.clone()]);

  // clips: the person's own set, then the football set (a name already there is kept)
  const clips = new Map<string, THREE.AnimationClip>();
  for (const set of [ownSet, footSet]) {
    const k = hipsRest.y / ((set.scene.userData as { hipsY?: number }).hipsY || hipsRest.y);
    for (const clip of set.animations as THREE.AnimationClip[]) {
      if (clips.has(clip.name)) continue;
      if (WANT && !WANT.has(clip.name)) continue;
      const c = clip.clone();
      if (IDLE_POSTURE_CLIPS.has(c.name)) relaxIdleArms(THREE, inner, bones, c, palm);
      if (set === footSet && TOON_LEAN_MAX[c.name] !== undefined) levelToonLean(THREE, inner, bones, c, TOON_LEAN_MAX[c.name]);
      for (const tr of c.tracks) if (tr.name.endsWith(".position")) { const v = tr.values.slice(); for (let i = 0; i < v.length; i++) v[i] *= k; tr.values = v; }
      clips.set(c.name, c);
    }
  }

  // skin: which bone carries each vertex most
  const geo = body.geometry;
  const pos = geo.getAttribute("position");
  const si = geo.getAttribute("skinIndex"), sw = geo.getAttribute("skinWeight");
  const boneName = body.skeleton.bones.map((b) => b.name);
  const dom = new Array<string>(pos.count);
  for (let i = 0; i < pos.count; i++) {
    let best = -1, bw = -1;
    for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (w > bw) { bw = w; best = si.getComponent(i, k); } }
    dom[i] = boneName[best];
  }
  const restWorld: THREE.Vector3[] = [];
  const tmp = new THREE.Vector3();
  const skinned = (i: number, out = new THREE.Vector3()) => body.getVertexPosition(i, out).applyMatrix4(body.matrixWorld);
  for (let i = 0; i < pos.count; i++) restWorld.push(skinned(i));
  const J = (n: string) => bones[n].getWorldPosition(new THREE.Vector3());
  const hipY = J("Hips").y;
  // the armpit, where arm and chest are one skin, is not "the arm in the body"
  const armpitY = (J("LeftArm").y + J("RightArm").y) / 2 - 0.14;
  const torso: number[] = [], armV: Record<"L" | "R", number[]> = { L: [], R: [] }, shoulderTop: number[] = [];
  for (const s of ["L", "R"] as const) {
    const a = ARM[s], sh = J(a.up), upLen = sh.distanceTo(J(a.fore));
    for (let i = 0; i < pos.count; i++) {
      const d = dom[i];
      if (d === a.fore || d === a.hand || (d.startsWith(`${a.pre}Hand`) && d !== a.hand)) armV[s].push(i);
      else if (d === a.up && restWorld[i].clone().sub(sh).dot(J(a.fore).sub(sh)) / (upLen * upLen) > 0.6) armV[s].push(i);
      if (d === a.up) shoulderTop.push(i);
    }
  }
  for (let i = 0; i < pos.count; i++) {
    const d = dom[i];
    if ((TORSO.has(d) && restWorld[i].y < armpitY) || ((d === "LeftUpLeg" || d === "RightUpLeg") && restWorld[i].y > hipY - 0.14)) torso.push(i);
  }
  const torsoSet = new Set(torso);
  const lower = new Set<number>([...armV.L, ...armV.R].filter((i) => dom[i] !== "LeftArm" && dom[i] !== "RightArm"));
  // faces touching the torso, for its normals
  const idx = geo.getIndex()!;
  const faces: number[] = [];
  for (let f = 0; f < idx.count; f += 3) { const a = idx.getX(f), b = idx.getX(f + 1), c = idx.getX(f + 2); if (torsoSet.has(a) || torsoSet.has(b) || torsoSet.has(c)) faces.push(a, b, c); }
  const P = new Map<number, THREE.Vector3>();
  const used = new Set<number>([...torso, ...armV.L, ...armV.R, ...shoulderTop, ...faces]);
  const restQ = (b: THREE.Bone) => rest.get(b)!;
  const width = (() => {
    // chest width at the armpit (torso skin only), and the hip width
    let mn = 9, mx = -9;
    const y = J("Spine02").y;
    for (const i of torso) if (Math.abs(restWorld[i].y - y) < 0.03) { mn = Math.min(mn, restWorld[i].x); mx = Math.max(mx, restWorld[i].x); }
    return mx - mn;
  })();
  console.log(`\n${file.split("/").pop()}: ${pos.count} vertices · arm ${armV.L.length}+${armV.R.length} · torso ${torso.length} · height ${(J("Head").y).toFixed(2)} m to the head joint · chest ${(width * 100).toFixed(0)} cm wide · shoulder joints ${(J("LeftArm").distanceTo(J("RightArm")) * 100).toFixed(0)} cm apart`);

  if (opt.profile) {
    // the torso's half-width and half-depth up the body (bind pose), in shoulder half-spans,
    // from the hip joint (0) to the neck base (1): what lib/star/three3d/shoulderSet.ts keeps the arms off
    const h0 = J("Hips"), h1 = J("neck"), half = J("LeftArm").distanceTo(J("RightArm")) / 2;
    const all = restWorld.map((p, i) => ({ p, d: dom[i] })).filter((x) => TORSO.has(x.d) || x.d === "LeftUpLeg" || x.d === "RightUpLeg" || x.d === "LeftShoulder" || x.d === "RightShoulder");
    const rows: string[] = [];
    for (const f of [-0.15, 0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.85]) {
      const y = h0.y + (h1.y - h0.y) * f;
      const sl = all.filter((x) => Math.abs(x.p.y - y) < 0.015 && (f > 0.05 || Math.abs(x.p.x - h0.x) < 0.3));
      if (!sl.length) continue;
      const xs = sl.map((x) => x.p.x - h0.x), zs = sl.map((x) => x.p.z);
      const w = Math.max(...xs.map(Math.abs)), zc = (Math.max(...zs) + Math.min(...zs)) / 2, d = (Math.max(...zs) - Math.min(...zs)) / 2;
      rows.push(`[${f}, ${(w / half).toFixed(3)}, ${(d / half).toFixed(3)}, ${((zc - h0.z) / half).toFixed(3)}]`);
    }
    // the arm's own thickness at the elbow and the wrist (radius, in half-spans)
    const rad = (n: string, k: string) => { const c = J(n); const vs = restWorld.filter((p, i) => dom[i] === k && p.distanceTo(c) < 0.06); return vs.length ? Math.max(...vs.map((p) => Math.hypot(p.x - c.x, p.z - c.z))) / half : 0; };
    console.log(`  profile (from hip joint 0 to neck base 1: [height, half-width, half-depth, centre forward]): ${rows.join(" ")}\n  arm radius: elbow ${rad("LeftForeArm", "LeftForeArm").toFixed(3)} wrist ${rad("LeftHand", "LeftForeArm").toFixed(3)} · hips→neck ${(h1.y - h0.y).toFixed(3)} m · half-span ${half.toFixed(3)} m`);
  }

  const measure = () => {
    root.updateMatrixWorld(true);
    for (const i of used) P.set(i, skinned(i, P.get(i) ?? new THREE.Vector3()));
    // torso normals
    const N = new Map<number, THREE.Vector3>();
    const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), fn = new THREE.Vector3();
    for (let f = 0; f < faces.length; f += 3) {
      const a = P.get(faces[f])!, b = P.get(faces[f + 1])!, c = P.get(faces[f + 2])!;
      fn.crossVectors(e1.subVectors(b, a), e2.subVectors(c, a));
      for (const k of [faces[f], faces[f + 1], faces[f + 2]]) { let n = N.get(k); if (!n) { n = new THREE.Vector3(); N.set(k, n); } n.add(fn); }
    }
    N.forEach((n) => n.normalize());
    // a 3 cm grid of the torso
    const cell = 0.03, grid = new Map<string, number[]>();
    const key = (x: number, y: number, z: number) => `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`;
    for (const i of torso) { const p = P.get(i)!; const k = key(p.x, p.y, p.z); (grid.get(k) ?? grid.set(k, []).get(k)!).push(i); }
    const out = { L: { pen: 0, near: 9, low: 0 }, R: { pen: 0, near: 9, low: 0 } };
    const dbg: Record<string, string> = {};
    const fmt = (v: THREE.Vector3) => `(${v.x.toFixed(2)},${v.y.toFixed(2)},${v.z.toFixed(2)})`;
    for (const s of ["L", "R"] as const) {
      for (const i of armV[s]) {
        const a = P.get(i)!;
        const cx = Math.floor(a.x / cell), cy = Math.floor(a.y / cell), cz = Math.floor(a.z / cell);
        // the 8 nearest torso points: "inside" only when most of them agree (a thin overhang, like the
        // shirt hem whose underside faces down, is not the body)
        const near: [number, number][] = [];
        for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) for (let dz = -2; dz <= 2; dz++) {
          const l = grid.get(`${cx + dx},${cy + dy},${cz + dz}`);
          if (l) for (const t of l) near.push([a.distanceToSquared(P.get(t)!), t]);
        }
        if (!near.length) continue;
        near.sort((x, y) => x[0] - y[0]);
        const k8 = near.slice(0, 8), bi = k8[0][1];
        const d = Math.sqrt(k8[0][0]);
        const inZone = P.get(bi)!.distanceTo(J(ARM[s].up)) < SHOULDER_ZONE || a.distanceTo(J(ARM[s].up)) < SHOULDER_ZONE;
        const sds = k8.map(([, t]) => tmp.subVectors(a, P.get(t)!).dot(N.get(t)!));
        const neg = sds.filter((x) => x < 0).sort((x, y) => y - x);
        const sd = inZone || neg.length < Math.ceil(k8.length * 0.75) ? 1 : neg[Math.floor(neg.length / 2)];
        if (sd < 0 && lower.has(i)) out[s].low = Math.max(out[s].low, -sd);
        if (sd < 0 && -sd > out[s].pen) { out[s].pen = -sd; if (opt.debug) dbg[s] = `arm ${dom[i]} ${fmt(a)} ← torso ${dom[bi]} ${fmt(P.get(bi)!)} n ${fmt(N.get(bi)!)} d ${(d * 100).toFixed(1)}`; }
        else out[s].near = Math.min(out[s].near, d);
      }
    }
    // shoulders
    const nk = J("neck"), aL = J("LeftArm"), aR = J("RightArm"), cL = J("LeftShoulder"), cR = J("RightShoulder");
    const elev = (c: THREE.Vector3, a: THREE.Vector3) => { const d = a.clone().sub(c); return Math.atan2(d.y, Math.hypot(d.x, d.z)) * 180 / Math.PI; };
    let top = -9;
    for (const i of shoulderTop) top = Math.max(top, P.get(i)!.y);
    if (opt.debug) console.log("    ", JSON.stringify(dbg), "joints armL", fmt(aL), "foreL", fmt(J("LeftForeArm")), "handL", fmt(J("LeftHand")), "hips", fmt(J("Hips")));
    return { gap: nk.y - (aL.y + aR.y) / 2, clav: (elev(cL, aL) + elev(cR, aR)) / 2, top: top - nk.y, out };
  };
  const rows: Row[] = [];
  const pose = (fn: () => void) => { for (const [b, [p, q]] of rest) { b.position.copy(p); b.quaternion.copy(q); } fn(); };
  const run = (name: string, at: (t: number) => void, dur: number) => {
    const n = Math.max(1, Math.round(dur * FPS));
    const acc = { gap: 0, clav: 0, top: 0, pen: 0, penAt: 0, near: 9, hit: 0, worst: "", low: 0, lowHit: 0 };
    for (let f = 0; f < n; f++) {
      const t = (f / n) * dur;
      pose(() => at(t));
      const m = measure();
      acc.gap += m.gap / n; acc.clav += m.clav / n; acc.top += m.top / n;
      const pen = Math.max(m.out.L.pen, m.out.R.pen);
      const low = Math.max(m.out.L.low, m.out.R.low);
      acc.low = Math.max(acc.low, low); if (low > 0.005) acc.lowHit++;
      if (pen > acc.pen) { acc.pen = pen; acc.penAt = t; acc.worst = m.out.L.pen > m.out.R.pen ? "L" : "R"; }
      if (pen > 0.005) acc.hit++;
      acc.near = Math.min(acc.near, m.out.L.near, m.out.R.near);
    }
    const r: Row = { clip: name, frames: n, gap: acc.gap * 100, clav: acc.clav, top: acc.top * 100, pen: acc.pen * 100, penAt: acc.penAt, near: acc.near * 100, penShare: acc.hit / n, worstSide: acc.worst, penLow: acc.low * 100, lowShare: acc.lowHit / n };
    rows.push(r);
    console.log(`  ${name.padEnd(20)} shoulders: neck ${r.gap.toFixed(1).padStart(5)} cm above joints · collarbone ${r.clav.toFixed(0).padStart(3)}° · shoulder top ${r.top >= 0 ? "+" : ""}${r.top.toFixed(1)} cm vs neck base   arms: ${r.pen > 0.5 ? `IN ${r.pen.toFixed(1)} cm (${r.worstSide} @${r.penAt.toFixed(2)}s, ${(r.penShare * 100).toFixed(0)}% of frames)` : `clear, closest ${r.near.toFixed(1)} cm`}   forearm/hand: ${r.penLow > 0.5 ? `IN ${r.penLow.toFixed(1)} cm (${(r.lowShare * 100).toFixed(0)}%)` : "clear"}`);
  };
  if (opt.rest) run("(bind pose)", () => {}, 1 / FPS);
  // each track read straight at t (an AnimationMixer only writes a value that changed, so a pose
  // reset under it would stick): the same values the game's mixer puts on the bones
  for (const [name, c] of clips) {
    const tr = c.tracks.map((k) => {
      const dot = k.name.lastIndexOf(".");
      return { bone: bones[k.name.slice(0, dot)], prop: k.name.slice(dot + 1), it: k.createInterpolant() };
    }).filter((x) => x.bone);
    run(name, (t) => {
      for (const x of tr) {
        const v = x.it.evaluate(Math.min(t, c.duration)) as ArrayLike<number>;
        if (x.prop === "quaternion") x.bone.quaternion.set(v[0], v[1], v[2], v[3]).normalize();
        else if (x.prop === "position") x.bone.position.set(v[0], v[1], v[2]);
      }

    }, c.duration);
  }
  report[file.split("/").pop()!] = rows;
}
if (opt.json) writeFileSync(opt.json, JSON.stringify(report, null, 1));
