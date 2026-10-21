/**
 * STYLE A PROPORTIONS, MEASURED — the eight head files' own rest joints (each
 * file's metadata), rebuilt to each option in lib/star/style3d/toon/proportions.ts
 * (A today, B modest, C bolder) with the same maths the game uses, against a
 * real man of the same height (Drillis & Contini's fractions of height).
 *
 *   npx tsx scripts/bench3d/proportions.mts [--json=out.json]
 *
 * The crown is the head bone's end (hair can sit ~1 cm above it), the chin the
 * file's measured chin. No three.js, no browser: read straight off the files.
 */
import fs from "node:fs";
import path from "node:path";
import { TOON_PROPORTIONS, proportionAffines, apply, type ToonPropId } from "../../lib/star/style3d/toon/proportions";
import { TOON_FILES, TOON_HEADS, type ToonHead } from "../../lib/star/style3d/toon/bodies";

type V3 = [number, number, number];
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const flag = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=").slice(1).join("=");

function glbJson(file: string) {
  const b = fs.readFileSync(file);
  const len = b.readUInt32LE(12);
  return JSON.parse(b.subarray(20, 20 + len).toString("utf8"));
}

/** One head file's measures, rebuilt to option `id`. */
export function measureHead(head: ToonHead, id: ToonPropId) {
  const j = glbJson(path.join(root, "public", TOON_FILES[head]));
  const meta = j.scenes[0].extras as { joints: Record<string, V3>; face: { chinY: number } };
  const nodes = j.nodes as { name?: string; children?: number[] }[];
  const parent: Record<string, string | null> = {};
  for (const n of nodes) if (n.name && meta.joints[n.name]) parent[n.name] = parent[n.name] ?? null;
  nodes.forEach((n) => (n.children ?? []).forEach((c) => { const cn = nodes[c].name; if (cn && meta.joints[cn] && n.name && meta.joints[n.name]) parent[cn] = n.name; }));
  const p = TOON_PROPORTIONS[id];
  const A = proportionAffines(meta.joints, parent, p);
  const J = (n: string): V3 => { const par = parent[n]; return par ? apply(A[par], meta.joints[n]) : apply(A[n], meta.joints[n]); };
  const headY = meta.joints.Head[1] + p.neck;
  const top = headY + (meta.joints.head_end[1] - meta.joints.Head[1]) * p.head;
  const chin = headY - (meta.joints.Head[1] - meta.face.chinY) * p.head;
  const d = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const hip = (J("LeftUpLeg")[1] + J("RightUpLeg")[1]) / 2;
  const sh = (J("LeftArm")[1] + J("RightArm")[1]) / 2;
  return {
    height: top, headH: top - chin, headsTall: top / (top - chin), hip, hipFrac: hip / top,
    knee: J("LeftLeg")[1], thigh: d(J("LeftUpLeg"), J("LeftLeg")), torso: J("neck")[1] - hip,
    shoulder: sh, shoulderFrac: sh / top, shoulderSpan: J("LeftArm")[0] - J("RightArm")[0],
    upperArm: d(J("LeftArm"), J("LeftForeArm")), elbow: J("LeftForeArm")[1], foreArm: d(J("LeftForeArm"), J("LeftHand")),
    neck: chin - sh,
  };
}

/** A real man of height H (Drillis & Contini), the same measures. */
export function realMan(H: number) {
  return { height: H, headH: 0.13 * H, headsTall: 1 / 0.13, hip: 0.53 * H, hipFrac: 0.53, knee: 0.285 * H, thigh: 0.245 * H, torso: 0.288 * H, shoulder: 0.795 * H, shoulderFrac: 0.795, shoulderSpan: 0.215 * H, upperArm: 0.186 * H, elbow: 0.63 * H, foreArm: 0.146 * H, neck: (1 - 0.13 - 0.795) * H };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) {
  const ids: ToonPropId[] = ["a", "b", "c"];
  const rows: Record<string, Record<string, number>> = {};
  const keys = ["height", "headH", "headsTall", "hipFrac", "thigh", "knee", "torso", "shoulderFrac", "shoulderSpan", "upperArm", "elbow", "foreArm", "neck"] as const;
  const avg = (id: ToonPropId, k: (typeof keys)[number], heads: readonly ToonHead[]) => heads.reduce((s, h) => s + measureHead(h, id)[k], 0) / heads.length;
  const players = TOON_HEADS.filter((h) => h.startsWith("h"));
  console.log("Six player heads, average (metres; fractions of height). Real = a man of option A's height.");
  console.log(`${"".padEnd(14)}${ids.map((i) => TOON_PROPORTIONS[i].label.padStart(14)).join("")}${"real man".padStart(12)}`);
  const real = realMan(avg("a", "height", players));
  for (const k of keys) {
    const vals = ids.map((i) => avg(i, k, players));
    ids.forEach((i, n) => { (rows[i] ??= {})[k] = +vals[n].toFixed(3); });
    console.log(`${k.padEnd(14)}${vals.map((v) => v.toFixed(3).padStart(14)).join("")}${real[k].toFixed(3).padStart(12)}`);
  }
  console.log("\nPer head, heads tall / hip height ÷ height:");
  for (const h of TOON_HEADS) console.log(`  ${h}  ${ids.map((i) => { const m = measureHead(h, i); return `${i.toUpperCase()} ${m.headsTall.toFixed(2)} / ${m.hipFrac.toFixed(3)}`; }).join("   ")}`);
  const out = flag("json");
  if (out) fs.writeFileSync(out, JSON.stringify({ real: Object.fromEntries(keys.map((k) => [k, +real[k].toFixed(3)])), options: rows }, null, 1));
}
