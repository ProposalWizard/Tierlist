/**
 * NO BODY PART INSIDE ANOTHER (Harry, 20 Oct 2026, a standing rule: "as a rule
 * something like a chin or any body part can't overlap inside another body
 * part"). tools/motionref/body_overlap.mts --gate on today's Style A body and
 * the standing, walking, talking and celebrating clips: every overlap deeper
 * than 0.5 cm must be a named, measured exception in
 * tools/motionref/overlap_exceptions.json (with its reason), and no deeper
 * than measured there. A new overlap, or a deeper one, fails. The full run
 * (every clip, the cut scenes, B5b's bodies) is in the B5c README.
 */
import { spawnSync } from "node:child_process";

const CLIPS = ["idle", "walk", "jog", "run", "sprint", "handshake", "applause", "talk", "point", "nod", "wave", "shirt_hold", "celebrate_fist", "celebrate_pump", "celebrate_roar", "dejected", "frustrated", "slump_walk", "walk_confident"];
const r = spawnSync("npx", ["tsx", "tools/motionref/body_overlap.mts", "--gate", "--fps=10", `--clips=${CLIPS.join(",")}`, "public/star/people3d/toon-p1.glb"], { encoding: "utf8", timeout: 240000 });
const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
if (r.status !== 0) { console.error(`✗ body overlap gate failed:\n${out.split("\n").filter((l) => l.includes("✗") || l.includes("cm") && l.includes(":")).slice(0, 30).join("\n")}`); process.exit(1); }
const clear = out.split("\n").filter((l) => /^\s{2}\S/.test(l) && l.trim().endsWith("clear")).length;
console.log(`✓ no part inside another beyond the named exceptions: ${CLIPS.length} clips on today's body (${clear} fully clear)`);
