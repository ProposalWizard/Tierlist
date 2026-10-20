/**
 * NO BODY PART INSIDE ANOTHER (Harry, 20 Oct 2026, a standing rule: "as a rule
 * something like a chin or any body part can't overlap inside another body
 * part"). The check any 3D build can run on a body and a set of moves.
 *
 *   npx tsx tools/motionref/body_overlap.mts [options] body.glb[@c1|c2|c3] [...]
 *     --clips=idle,walk          only these clips (default: every clip the game gives a person)
 *     --own= --mocap= --football= --casino=   other clip files (default: public/star/…)
 *     --poses=a.json,b.json      cut scenes, dumped by tools/motionref/dump-pose.mjs
 *     --actors=you               only these cut-scene actors
 *     --fps=10                   frames a second checked
 *     --json=out.json            every clip × part pair, for tables
 *     --gate                     exit 1 on an overlap over TOL_CM with no named exception
 *     --exceptions=file.json     the named, measured exceptions (default tools/motionref/overlap_exceptions.json)
 *
 * HOW. The body is cut into parts by the bone that carries each skin point
 * most: head, torso (neck, chest, belly, hips, collarbones), and each side's
 * upper arm, forearm, hand, thigh, shin and foot. Each part gets a VOLUME
 * measured on its own skin at the bind pose: a limb is a tube along its bone
 * (a ring every tenth of its length: where the skin's middle sits off the
 * bone, and its radius), the torso is a stack of 2 cm slices (its outline
 * all round, in 24 directions), the head an ellipsoid. Every frame, every
 * skin point of every part is tested against every OTHER part's volume, the
 * volume moved with its bone: inside = an overlap, depth in cm.
 *   - Neighbours (head–torso, torso–upper arm, upper arm–forearm, …) share a
 *     joint where skin folds: points within that joint's zone are not counted.
 *   - What the body already does in its bind pose (inner thighs touching, an
 *     armpit) is the body, not the move: each point's bind depth is taken off.
 * Reported: the worst depth per part pair per clip and the share of frames over TOL_CM.
 */
import * as THREE from "three";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { relaxIdleArms, IDLE_POSTURE_CLIPS, levelToonLean, TOON_LEAN_MAX, uprightRunPosture, PEOPLE_POSTURE } from "../../lib/star/three3d/runPosture";
import { levelMocapHeads, mergeClips, MOCAP_PEOPLE_OWN, MOCAP_UAL_OWN } from "../../lib/star/three3d/footballAnims";
import { stripped, parse, nodeBody } from "./nodeBody.mts";

const opt = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith("--")).map((a) => { const [k, ...v] = a.slice(2).split("="); return [k, v.length ? v.join("=") : "1"]; }));
const files = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const FPS = Number(opt.fps ?? 10);
const WANT = opt.clips ? new Set(opt.clips.split(",")) : null;
/** Deeper than this is an overlap (cm). */
const TOL_CM = 0.5;

/** Which part a bone's skin belongs to. */
function partOf(bone: string): string {
  const side = bone.startsWith("Left") ? "L" : bone.startsWith("Right") ? "R" : "";
  const b = bone.replace(/^(Left|Right)/, "");
  if (/^(Head|Eye|Jaw|Tongue|Teeth)/i.test(bone)) return "head";
  if (side) {
    if (b.startsWith("Hand")) return `hand${side}`;
    if (b === "ForeArm") return `forearm${side}`;
    if (b === "Arm") return `upperarm${side}`;
    if (b === "UpLeg") return `thigh${side}`;
    if (b === "Leg") return `shin${side}`;
    if (b.startsWith("Foot") || b.startsWith("Toe")) return `foot${side}`;
  }
  return "torso";
}
/** Neighbouring parts and the joint between them: skin within `zone` metres of it is a fold, not an overlap. */
const JOINT_ZONE: Record<string, { joint: string; zone: number }> = {};
const adj = (a: string, b: string, joint: string, zone: number) => { JOINT_ZONE[[a, b].sort().join("+")] = { joint, zone }; };
adj("head", "torso", "Head", 0.06);
/** Each limb part's tube: bone → next bone (the hand: to the middle finger's root; the foot: to the toe and on 9 cm). */
const LIMB: Record<string, { bone: string; to: string; extend?: number }> = {};
for (const [s, n] of [["L", "Left"], ["R", "Right"]] as const) {
  adj("torso", `upperarm${s}`, `${n}Arm`, 0.15);
  adj(`upperarm${s}`, `forearm${s}`, `${n}ForeArm`, 0.07);
  adj(`forearm${s}`, `hand${s}`, `${n}Hand`, 0.05);
  adj("torso", `thigh${s}`, `${n}UpLeg`, 0.13);
  adj(`thigh${s}`, `shin${s}`, `${n}Leg`, 0.08);
  adj(`shin${s}`, `foot${s}`, `${n}Foot`, 0.07);
  LIMB[`upperarm${s}`] = { bone: `${n}Arm`, to: `${n}ForeArm` };
  LIMB[`forearm${s}`] = { bone: `${n}ForeArm`, to: `${n}Hand` };
  LIMB[`hand${s}`] = { bone: `${n}Hand`, to: `${n}HandMiddle1` };
  LIMB[`thigh${s}`] = { bone: `${n}UpLeg`, to: `${n}Leg` };
  LIMB[`shin${s}`] = { bone: `${n}Leg`, to: `${n}Foot` };
  LIMB[`foot${s}`] = { bone: `${n}Foot`, to: `${n}ToeBase`, extend: 0.09 };
}

interface Exception { clip: string; pair: string; body?: string; maxCm: number; reason: string }
/** "*" matches anything, "a|b" either. */
const glob = (g: string) => new RegExp(`^(?:${g.split("|").map((x) => x.replace(/[.+?^${}()[\]\\]/g, "\\$&").replace(/\*/g, ".*")).join("|")})$`);
const exFile = opt.exceptions ?? "tools/motionref/overlap_exceptions.json";
const EXC: Exception[] = existsSync(exFile) ? JSON.parse(readFileSync(exFile, "utf8")).exceptions : [];

// ── the moves ──
const C = { own: opt.own ?? "public/star/people3d/anims.glb", mocap: opt.mocap ?? "public/star/anims3d/mocap.glb", football: opt.football ?? "public/star/anims3d/football.glb", casino: opt.casino ?? "public/star/anims3d/casino.glb" };
const own = await parse(stripped(C.own)), mocap = await parse(stripped(C.mocap)), football = await parse(stripped(C.football)), casino = await parse(stripped(C.casino));
levelMocapHeads(mocap);
uprightRunPosture(THREE, mocap, PEOPLE_POSTURE);
const sets = [mergeClips(own, mocap, (n) => MOCAP_PEOPLE_OWN.has(n)), mergeClips(football, mocap, (n) => !MOCAP_UAL_OWN.has(n)), casino];
interface PoseDump { fps: number; scene: string; actors: Record<string, { bones: string[]; frames: number[][] }> }
const dumps: PoseDump[] = opt.poses ? opt.poses.split(",").filter(Boolean).map((f: string) => JSON.parse(readFileSync(f, "utf8"))) : [];

type Row = { body: string; clip: string; frames: number; pairs: Record<string, { cm: number; share: number; at: number }> };
const rows: Row[] = [];
const fails: string[] = [];
const V = () => new THREE.Vector3();

for (const spec of files) {
  const nb = await nodeBody(spec);
  const { inner, body, bones, hipsRest, palm } = nb;
  const label = spec.split("/").pop()!;
  const rest = new Map<THREE.Bone, [THREE.Vector3, THREE.Quaternion]>();
  for (const b of Object.values(bones)) rest.set(b, [b.position.clone(), b.quaternion.clone()]);
  const toRest = () => { for (const [b, [p, q]] of rest) { b.position.copy(p); b.quaternion.copy(q); } inner.updateMatrixWorld(true); };
  toRest();

  // ── the skin, by part ──
  const geo = body.geometry;
  const pos = geo.getAttribute("position"), si = geo.getAttribute("skinIndex"), sw = geo.getAttribute("skinWeight");
  const names = body.skeleton.bones.map((b) => b.name);
  const N = pos.count;
  const part: string[] = new Array(N);
  for (let i = 0; i < N; i++) {
    let best = 0, bw = -1;
    for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (w > bw) { bw = w; best = si.getComponent(i, k); } }
    part[i] = partOf(names[best]);
  }
  const P: THREE.Vector3[] = Array.from({ length: N }, V);
  const skin = () => { inner.updateMatrixWorld(true); for (let i = 0; i < N; i++) body.getVertexPosition(i, P[i]).applyMatrix4(body.matrixWorld); };
  skin();
  const bindP = P.map((p) => p.clone());
  const W = (n: string) => bones[n].getWorldPosition(V());
  const bindM: Record<string, THREE.Matrix4> = {};
  for (const n of Object.keys(bones)) bindM[n] = bones[n].matrixWorld.clone();

  // ── the volumes, at the bind pose ──
  interface Tube { kind: "tube"; bone: string; A: THREE.Vector3; u: THREE.Vector3; len: number; rings: { t: number; c: THREE.Vector3; r: number }[] }
  interface Slices { kind: "torso"; mid: number; slices: { y: number; cx: number; cz: number; r: Float32Array }[] }
  interface Ell { kind: "head"; c: THREE.Vector3; ax: THREE.Vector3 }
  const vol: Record<string, Tube | Slices | Ell> = {};
  const ofPart = (p: string) => bindP.filter((_, i) => part[i] === p);
  for (const [p, L] of Object.entries(LIMB)) {
    if (!bones[L.bone] || !bones[L.to]) continue;
    const A = W(L.bone), B = W(L.to);
    if (L.extend) B.add(B.clone().sub(A).setLength(L.extend));
    const u = B.clone().sub(A); const len = u.length(); u.divideScalar(len);
    const pts = ofPart(p);
    const rings: Tube["rings"] = [];
    for (let t = 0.05; t < 1; t += 0.1) {
      const at = A.clone().addScaledVector(u, t * len);
      const ring = pts.filter((q) => Math.abs(q.clone().sub(at).dot(u)) < 0.012);
      if (ring.length < 5) continue;
      const c = ring.reduce((m, q) => m.add(q), V()).divideScalar(ring.length);
      c.addScaledVector(u, -c.clone().sub(at).dot(u));
      const ds = ring.map((q) => { const d = q.clone().sub(c); return d.addScaledVector(u, -d.dot(u)).length(); }).sort((a, b) => a - b);
      rings.push({ t, c, r: ds[Math.floor(ds.length / 2)] });
    }
    if (rings.length) vol[p] = { kind: "tube", bone: L.bone, A, u, len, rings };
  }
  {
    const hip = W("Hips"), neck = W("neck");
    const pts = ofPart("torso");
    const slices: Slices["slices"] = [];
    const BINS = 24;
    for (let y = hip.y - 0.22; y <= neck.y - 0.02; y += 0.02) {
      const sl = pts.filter((q) => Math.abs(q.y - y) < 0.012);
      if (sl.length < 12) continue;
      const zs = sl.map((q) => q.z);
      const cx = hip.x, cz = (Math.max(...zs) + Math.min(...zs)) / 2;
      const r = new Float32Array(BINS);
      for (const q of sl) { const b = ((Math.round((Math.atan2(q.z - cz, q.x - cx) / (2 * Math.PI)) * BINS) % BINS) + BINS) % BINS; r[b] = Math.max(r[b], Math.hypot(q.x - cx, q.z - cz)); }
      for (let k = 0; k < BINS; k++) if (!r[k]) { let a = 0, n = 0; for (const j of [k - 1, k + 1, k - 2, k + 2]) { const x = r[(j + BINS) % BINS]; if (x) { a += x; n++; } } r[k] = n ? a / n : 0; }
      slices.push({ y, cx, cz, r });
    }
    vol.torso = { kind: "torso", mid: hip.y + (neck.y - hip.y) * 0.4, slices };
  }
  {
    const pts = ofPart("head");
    if (pts.length) {
      const c = pts.reduce((m, q) => m.add(q), V()).divideScalar(pts.length);
      const ax = V();
      for (const q of pts) { ax.x = Math.max(ax.x, Math.abs(q.x - c.x)); ax.y = Math.max(ax.y, Math.abs(q.y - c.y)); ax.z = Math.max(ax.z, Math.abs(q.z - c.z)); }
      vol.head = { kind: "head", c, ax: ax.multiplyScalar(0.85) };
    }
  }
  const PARTS = Object.keys(vol);

  // ── how deep a point is in a part's volume, on the current pose ──
  const toBind = (bone: string) => bindM[bone].clone().multiply(bones[bone].matrixWorld.clone().invert());
  const depthIn = (p: string, q: THREE.Vector3, M: Record<string, THREE.Matrix4>): number => {
    const v = vol[p];
    if (v.kind === "tube") {
      const b = q.clone().applyMatrix4(M[v.bone]);
      const t = b.clone().sub(v.A).dot(v.u) / v.len;
      if (t < v.rings[0].t || t > v.rings[v.rings.length - 1].t) return 0;
      let k = 0; while (k < v.rings.length - 1 && v.rings[k + 1].t < t) k++;
      const r0 = v.rings[k], r1 = v.rings[Math.min(k + 1, v.rings.length - 1)];
      const f = r1.t > r0.t ? (t - r0.t) / (r1.t - r0.t) : 0;
      const c = r0.c.clone().lerp(r1.c, f), r = r0.r + (r1.r - r0.r) * f;
      const d = b.sub(c); d.addScaledVector(v.u, -d.dot(v.u));
      return r - d.length();
    }
    if (v.kind === "torso") {
      let best = 0;
      for (const [bn, lo, hi] of [["Hips", -9, v.mid + 0.06], ["Spine", v.mid - 0.06, 9]] as const) {
        const b = q.clone().applyMatrix4(M[bn]);
        if (b.y < lo || b.y > hi) continue;
        const s = v.slices;
        if (!s.length || b.y < s[0].y - 0.01 || b.y > s[s.length - 1].y + 0.01) continue;
        let k = 0; while (k < s.length - 1 && s[k + 1].y < b.y) k++;
        const sl = s[k];
        const dx = b.x - sl.cx, dz = b.z - sl.cz, rho = Math.hypot(dx, dz);
        const ff = (((Math.atan2(dz, dx) / (2 * Math.PI)) * 24) + 24) % 24, kk = Math.floor(ff), uu = ff - kk;
        const R = sl.r[kk % 24] * (1 - uu) + sl.r[(kk + 1) % 24] * uu;
        best = Math.max(best, R - rho);
      }
      return best;
    }
    const b = q.clone().applyMatrix4(M.Head).sub(v.c);
    const s = Math.hypot(b.x / v.ax.x, b.y / v.ax.y, b.z / v.ax.z);
    return s < 1 ? (1 - s) * b.length() / Math.max(s, 0.2) : 0;
  };
  const frameMs = () => { const M: Record<string, THREE.Matrix4> = {}; for (const n of ["Hips", "Spine", "Head", ...Object.values(LIMB).map((l) => l.bone)]) if (bones[n]) M[n] = toBind(n); return M; };
  const pairKey = (a: string, b: string) => [a, b].sort().join("+");
  /** Each point's depth in each other part (only where > 0). */
  const depths = (): Map<number, Map<string, number>> => {
    const M = frameMs();
    const jw: Record<string, THREE.Vector3> = {};
    for (const z of Object.values(JOINT_ZONE)) if (bones[z.joint]) jw[z.joint] = W(z.joint);
    const out = new Map<number, Map<string, number>>();
    for (let i = 0; i < N; i++) {
      const pa = part[i];
      for (const pb of PARTS) {
        if (pb === pa) continue;
        const z = JOINT_ZONE[pairKey(pa, pb)];
        if (z && jw[z.joint] && P[i].distanceTo(jw[z.joint]) < z.zone) continue;
        const d = depthIn(pb, P[i], M);
        if (d > 0) { let m = out.get(i); if (!m) out.set(i, (m = new Map())); m.set(pb, d); }
      }
    }
    return out;
  };
  const base = depths();
  console.log(`\n${label}: ${N} skin points · parts ${PARTS.join(" ")}`);

  const check = (name: string, dur: number, at: (t: number) => void) => {
    const n = Math.max(1, Math.round(dur * FPS));
    const acc: Record<string, { cm: number; hits: number; at: number }> = {};
    for (let f = 0; f < n; f++) {
      const t = (f / n) * dur;
      toRest(); at(t); skin();
      const worst: Record<string, number> = {};
      for (const [i, m] of depths()) for (const [q, d] of m) {
        const ex = d - (base.get(i)?.get(q) ?? 0);
        if (ex <= 0) continue;
        const k = pairKey(part[i], q);
        if (!(k in worst) || ex > worst[k]) worst[k] = ex;
      }
      for (const [k, d] of Object.entries(worst)) {
        const a = (acc[k] ??= { cm: 0, hits: 0, at: 0 });
        if (d * 100 > a.cm) { a.cm = d * 100; a.at = t; }
        if (d * 100 > TOL_CM) a.hits++;
      }
    }
    const pairs: Row["pairs"] = {};
    for (const [k, a] of Object.entries(acc)) if (a.cm > TOL_CM) pairs[k] = { cm: +a.cm.toFixed(2), share: +(a.hits / n).toFixed(3), at: +a.at.toFixed(2) };
    rows.push({ body: label, clip: name, frames: n, pairs });
    const list = Object.entries(pairs).sort((x, y) => y[1].cm - x[1].cm);
    console.log(`  ${name.padEnd(26)} ${list.length ? list.map(([k, p]) => `${k} ${p.cm.toFixed(1)} cm (${(p.share * 100).toFixed(0)}%)`).join(" · ") : "clear"}`);
    for (const [k, p] of list) {
      const e = EXC.find((x) => glob(x.clip).test(name) && glob(x.pair).test(k) && (!x.body || glob(x.body).test(label)));
      if (!e || p.cm > e.maxCm + 0.3) fails.push(`${label} ${name}: ${k} ${p.cm.toFixed(1)} cm${e ? ` (exception allows ${e.maxCm} cm: ${e.reason})` : ""}`);
    }
  };
  if (opt.rest) check("(bind pose)", 1 / FPS, () => {});

  // the clips, as a person gets them (people3d.makePerson3d, footballAnims.addClips)
  const seen = new Set<string>();
  for (const set of sets) {
    const k = hipsRest.y / ((set.scene.userData as { hipsY?: number }).hipsY || hipsRest.y);
    for (const clip of set.animations as THREE.AnimationClip[]) {
      if (seen.has(clip.name) || (WANT && !WANT.has(clip.name))) continue;
      seen.add(clip.name);
      const c = clip.clone();
      if (IDLE_POSTURE_CLIPS.has(c.name)) relaxIdleArms(THREE, inner, bones, c, palm);
      if (set === sets[1] && TOON_LEAN_MAX[c.name] !== undefined) levelToonLean(THREE, inner, bones, c, TOON_LEAN_MAX[c.name]);
      for (const tr of c.tracks) if (tr.name.endsWith(".position")) { const vv = tr.values.slice(); for (let i = 0; i < vv.length; i++) vv[i] *= k; tr.values = vv; }
      const tr = c.tracks.map((x) => { const dot = x.name.lastIndexOf("."); return { bone: bones[x.name.slice(0, dot)], prop: x.name.slice(dot + 1), it: x.createInterpolant() }; }).filter((x) => x.bone);
      check(c.name, c.duration, (t) => {
        for (const x of tr) {
          const val = x.it.evaluate(Math.min(t, c.duration)) as ArrayLike<number>;
          if (x.prop === "quaternion") x.bone.quaternion.set(val[0], val[1], val[2], val[3]).normalize();
          else if (x.prop === "position") x.bone.position.set(val[0], val[1], val[2]);
        }
      });
    }
  }
  // cut scenes: each actor's bone turns as the director posed him, put on this body
  for (const dmp of dumps) {
    for (const [id, a] of Object.entries(dmp.actors)) {
      if (opt.actors && !opt.actors.split(",").includes(id)) continue;
      const bs = a.bones.map((n) => bones[n] ?? null);
      const n = a.frames.length;
      check(`${dmp.scene}:${id}`, (n - 1) / dmp.fps, (t) => {
        const f = a.frames[Math.min(n - 1, Math.round(t * dmp.fps))];
        bs.forEach((b, j) => { if (b) b.quaternion.set(f[j * 4], f[j * 4 + 1], f[j * 4 + 2], f[j * 4 + 3]).normalize(); });
      });
    }
  }
}
if (opt.json) writeFileSync(opt.json, JSON.stringify(rows, null, 1));
if (opt.gate) {
  if (fails.length) { console.error(`\n✗ ${fails.length} overlap(s) with no named exception:\n  ${fails.join("\n  ")}`); process.exit(1); }
  console.log("\n✓ no part inside another (beyond the named exceptions)");
}
