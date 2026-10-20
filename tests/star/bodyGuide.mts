/**
 * THE BODY GUIDE AND THE JUDGED BODIES (B5b, 20 Oct 2026). The guide (lib/star/bodyGuide.ts) is a real
 * footballer: 7.7 heads tall, shoulders about two heads wide, everything in order from the floor up,
 * his outline closed and symmetric. Bodies being judged (TOON_BODY_SETS) are never seen without
 * ?bodies= (the real game keeps today's files), each judged file exists and carries its own face
 * (faceFileLandmarks.ts, keyed by the file's model name) and its own head, neck and hand size (meta.look).
 */
import fs from "node:fs";
import path from "node:path";
import { GUIDE_FRAC, GUIDE_HEAD, guideMeasure, guideFront, guideSide, guideMarks } from "../../lib/star/bodyGuide";
import { TOON_BODY_SETS, TOON_BODY_SET, TOON_FILES, TOON_HEADS, toonFileFor, toonFileIsJudged } from "../../lib/star/style3d/toon/bodies";
import { TOON_FACE_FILE_LANDMARKS } from "../../lib/star/style3d/toon/faceFileLandmarks";

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

// 1. the guide
const g = guideMeasure(1.83);
check(Math.abs(g.headsTall - 1 / GUIDE_HEAD) < 1e-9 && g.headsTall > 7.4 && g.headsTall < 8, `heads tall ${g.headsTall}`);
check(g.headsWide > 1.8 && g.headsWide < 2.2, `shoulders ${g.headsWide} heads wide`);
const order = ["ankle", "sockTop", "knee", "shortsHem", "crotch", "hipJoint", "waist", "elbow", "nipple", "shoulderJoint", "shoulder", "chin", "crown"] as const;
for (let i = 1; i < order.length; i++) check(GUIDE_FRAC[order[i]] > GUIDE_FRAC[order[i - 1]], `${order[i]} above ${order[i - 1]}`);
check(g.chestDepth > 0.2 && g.chestDepth < 0.27 && g.chestOut > 0, `chest ${g.chestDepth} / ${g.chestOut}`);
const fr = guideFront(1.83);
const xs = fr.body.map(([x]) => x);
check(Math.abs(Math.max(...xs) + Math.min(...xs)) < 1e-9, "front outline symmetric");
check(Math.max(...fr.body.map(([, y]) => y)) <= 1.83 + 1e-9 && Math.min(...fr.body.map(([, y]) => y)) >= 0, "front outline within his height");
check(guideSide(1.83).length > 20 && guideMarks(1.83).length === 10, "side outline and marks");

// 2. the judged bodies
check(TOON_BODY_SET.id === null, "no ?bodies= outside a browser page");
for (const h of TOON_HEADS) check(toonFileFor(h) === TOON_FILES[h] && !toonFileIsJudged(h), `${h}: today's file in the game`);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../public");
for (const [id, set] of Object.entries(TOON_BODY_SETS)) {
  for (const [h, url] of Object.entries(set)) {
    const file = path.join(root, url!);
    check(fs.existsSync(file), `set ${id} ${h}: ${url} exists`);
    if (!fs.existsSync(file)) continue;
    const b = fs.readFileSync(file);
    const json = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString());
    const ex = json.scenes[0].extras;
    check(!!TOON_FACE_FILE_LANDMARKS[ex.model], `set ${id}: ${ex.model} has its own face measured`);
    check(ex.look?.head === 1 && ex.look?.neck === 1 && ex.look?.hands === 1, `set ${id}: ${ex.model} keeps its own head, neck and hands (TOON_REAL)`);
  }
}

if (problems.length) {
  console.log(`FAIL — ${problems.length} problem(s):`);
  for (const p of problems) console.log("  " + p);
  process.exit(1);
}
console.log(`bodyGuide: the guide is ${g.headsTall.toFixed(2)} heads tall, ${g.headsWide.toFixed(2)} heads wide, in order and symmetric; ${Object.keys(TOON_BODY_SETS).length} judged sets, each file present with its own face and size; the game keeps today's files: all checks pass`);
