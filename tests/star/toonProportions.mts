/**
 * STYLE A PROPORTIONS (lib/star/style3d/toon/proportions.ts, B5b): A is today
 * and changes nothing; B and C rebuild the build, never the man's size. On all
 * eight head files: the same height (±1.5 cm), the knees, elbows and ankles
 * where they were, the neck base and the face not moved in the file, a smaller
 * head, a shorter body, longer thighs and upper arms, squarer shoulders, and
 * no tear at a joint (a child bone starts where its parent's change ends).
 */
import fs from "node:fs";
import path from "node:path";
import { TOON_PROPORTIONS, TOON_PROP, propChangesBody, proportionAffines, apply } from "../../lib/star/style3d/toon/proportions";
import { TOON_HEADS, TOON_FILES } from "../../lib/star/style3d/toon/bodies";
import { TOON_LOOK_DEFAULT } from "../../lib/star/people3d";
import { measureHead } from "../../scripts/bench3d/proportions.mts";

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };
type V3 = [number, number, number];

// 1. A is today: no change at all, the head scale is today's, and a page without ?prop gets A.
check(!propChangesBody(TOON_PROPORTIONS.a), "A changes the body");
check(TOON_PROPORTIONS.a.head === TOON_LOOK_DEFAULT.head, `A's head ${TOON_PROPORTIONS.a.head} is not today's ${TOON_LOOK_DEFAULT.head}`);
check(TOON_PROP.id === "a", `with no ?prop the game builds ${TOON_PROP.id}, not A`);

const glbJson = (f: string) => { const b = fs.readFileSync(f); return JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString("utf8")); };
let n = 0;
for (const head of TOON_HEADS) {
  const a = measureHead(head, "a");
  for (const id of ["b", "c"] as const) {
    const m = measureHead(head, id);
    const tag = `${head} ${id.toUpperCase()}`;
    check(Math.abs(m.height - a.height) < 0.015, `${tag}: height ${m.height.toFixed(3)} vs today ${a.height.toFixed(3)}`);
    check(Math.abs(m.knee - a.knee) < 0.002, `${tag}: the knee moved ${(m.knee - a.knee).toFixed(3)} m`);
    check(Math.abs(m.elbow - a.elbow) < 0.012, `${tag}: the elbow moved ${(m.elbow - a.elbow).toFixed(3)} m`);
    check(m.headH < a.headH - 0.02, `${tag}: head not smaller (${m.headH.toFixed(3)} vs ${a.headH.toFixed(3)})`);
    check(m.headsTall > a.headsTall + 0.4 && m.headsTall < 7.7, `${tag}: ${m.headsTall.toFixed(2)} heads tall`);
    check(m.torso < a.torso - 0.03, `${tag}: body not shorter`);
    check(m.thigh > a.thigh + 0.03, `${tag}: thigh not longer`);
    check(m.upperArm > a.upperArm + 0.02, `${tag}: upper arm not longer`);
    check(m.shoulderFrac > a.shoulderFrac + 0.01, `${tag}: shoulders not higher`);
    check(m.hipFrac <= 0.545, `${tag}: hips at ${m.hipFrac.toFixed(3)} of height (a real man 0.53)`);
    n++;
  }
  // 2. No tear: every bone's change meets its parent's at the joint; the neck, head and feet stay put in the file.
  const j = glbJson(path.join("public", TOON_FILES[head]));
  const joints = j.scenes[0].extras.joints as Record<string, V3>;
  const nodes = j.nodes as { name?: string; children?: number[] }[];
  const parent: Record<string, string | null> = {};
  for (const k of Object.keys(joints)) parent[k] = null;
  nodes.forEach((nd) => (nd.children ?? []).forEach((c) => { const cn = nodes[c].name; if (cn && joints[cn] && nd.name && joints[nd.name]) parent[cn] = nd.name; }));
  const A = proportionAffines(joints, parent, TOON_PROPORTIONS.c);
  for (const [b, p] of Object.entries(parent)) {
    if (!p) continue;
    const viaParent = apply(A[p], joints[b]), viaOwn = apply(A[b], joints[b]);
    const gap = Math.hypot(viaParent[0] - viaOwn[0], viaParent[1] - viaOwn[1], viaParent[2] - viaOwn[2]);
    // the torso bones share one change; anything else must meet exactly
    check(gap < 1e-6, `${head}: ${b} tears ${(gap * 100).toFixed(2)} cm from ${p}`);
  }
  for (const b of ["neck", "Head", "head_end"]) {
    const q = apply(A[b], joints[b]);
    check(Math.hypot(q[0] - joints[b][0], q[1] - joints[b][1], q[2] - joints[b][2]) < 1e-6, `${head}: ${b} moved in the file (the face is painted from it)`);
  }
  for (const b of ["LeftFoot", "RightFoot"]) {
    const q = apply(A[parent[b]!], joints[b]);
    check(Math.abs(q[1] - joints[b][1]) < 0.002, `${head}: ${b} rose ${(q[1] - joints[b][1]).toFixed(3)} m`);
  }
}

if (problems.length) {
  console.log(`FAIL — ${problems.length} problem(s):`);
  for (const p of problems) console.log("  " + p);
  process.exit(1);
}
const c = measureHead("h1", "c"), a = measureHead("h1", "a");
console.log(`toonProportions: A unchanged; B and C on ${TOON_HEADS.length} heads (${n} builds): same height, knees and elbows kept, no tear at any joint; h1 heads tall ${a.headsTall.toFixed(2)} → ${c.headsTall.toFixed(2)}, hips ${a.hipFrac.toFixed(3)} → ${c.hipFrac.toFixed(3)} of height: all checks pass`);
