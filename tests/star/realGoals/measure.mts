/**
 * Real Goals: strike every real goal along its real line N times, real lane
 * off (before) and on (after). Run: npx tsx tests/star/realGoals/measure.mts [N] [ids…]
 */
import { loadGoals, aimAtReal, playStrike } from "./harness.mts";
import { FEATURED, realEnd } from "../../../lib/star/realGoals";

const N = Number(process.argv[2] ?? 8);
const WOBBLE = process.env.RG_WOBBLE !== "0";
const only = process.argv.slice(3);
const goals = loadGoals().filter((g) => g.shot.type === "Open Play" || g.shot.type === "Free Kick").filter((g) => !only.length || only.includes(g.id));
const featured = new Set(FEATURED.map((f) => f.id));
let tot = { off: 0, on: 0, n: 0, lane: 0, aimMiss: 0 };
let feat = { off: 0, on: 0, n: 0 };
const worst: string[] = [];
const t0 = Date.now();
for (const g of goals) {
  const aim = aimAtReal(g);
  const e = realEnd(g);
  const aimErr = Math.hypot(aim.x - e.x, aim.z - e.z);
  if (aimErr > 0.25) { tot.aimMiss++; }
  let off = 0, on = 0, lane = 0;
  for (let i = 0; i < N; i++) {
    const seed = (9001 + i * 7919) >>> 0;
    if (playStrike(g, aim, false, seed, WOBBLE).goal) off++;
    const p = playStrike(g, aim, true, seed, WOBBLE);
    if (p.goal) on++;
    if (p.inLane) lane++;
  }
  tot.off += off; tot.on += on; tot.n += N; tot.lane += lane;
  if (featured.has(g.id)) { feat.off += off; feat.on += on; feat.n += N; }
  if (on < N) worst.push(`${g.id} ${g.shot.player.slice(0, 22)} on ${on}/${N} lane ${lane} aimErr ${aimErr.toFixed(2)} (${g.shot.type}/${g.shot.body})`);
  if (only.length || featured.has(g.id)) console.log(`${g.id} ${g.shot.player.slice(0, 24).padEnd(24)} before ${off}/${N}  after ${on}/${N}  in lane ${lane}/${N}  aim err ${aimErr.toFixed(2)} m`);
}
const pc = (a: number, b: number) => (b ? (100 * a / b).toFixed(1) : "-");
console.log(`\nALL ${goals.length} goals × ${N}: scored before ${pc(tot.off, tot.n)}%  after ${pc(tot.on, tot.n)}%  (in lane ${pc(tot.lane, tot.n)}%, aim search missed by >25 cm on ${tot.aimMiss})`);
console.log(`FEATURED ${feat.n / N} goals × ${N}: before ${pc(feat.off, feat.n)}%  after ${pc(feat.on, feat.n)}%`);
console.log(`not 100% after (${worst.length}):\n  ` + worst.slice(0, 40).join("\n  "));
console.log(`(${((Date.now() - t0) / 1000).toFixed(0)} s)`);
