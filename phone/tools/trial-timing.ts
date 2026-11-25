/**
 * HEADLESS TIMING: how long the trial's free-kick stage takes from the strike to the next kick,
 * through the phone's driver (no DOM). Prints, per kick: outcome, frames strike -> resolved, frames
 * resolved -> next kick loaded, and the seconds each is at 60 fps.
 *
 *   npx esbuild phone/tools/trial-timing.ts --bundle --platform=neutral --main-fields=module,main \
 *     --format=esm --alias:@=. --external:three --outfile=/tmp/trial-timing.mjs && node /tmp/trial-timing.mjs
 */
import { setVisitSalt } from "@/lib/star/chanceMaker";
import { mulberry32 } from "@/lib/star/season";
import { startTrial } from "@/lib/star/trial";
import { freeKickSetup } from "@/lib/star/trialStages";
import { MatchDriver } from "../src/match/driver";
import { featureSetup, type ChanceResolved } from "../src/match/setup";
import { buildFreeKickScenario } from "../src/match/drills";
import { botContact, flatPullFor } from "./match-bot";
import { POST_L, POST_R, CX } from "@/lib/star/pitch";
import { VIEW_ASPECT } from "@/lib/star/canvasEngine";

(globalThis as Record<string, unknown>).window ??= {};
(globalThis as Record<string, unknown>).__KIB_HEADLESS__ = true;
setVisitSalt(0);

const rows: { o: string; strike: number; resolve: number; next: number; ballOff: boolean; tl: string; pull: number; sig: string }[] = [];
const PULLS = [0.1, 0.2, 0.3, 0.4];
const AIMS = [CX, POST_R - 0.7, POST_R + 4, POST_L - 4];
for (let t = 0; t < Number(process.env.N ?? 12); t++) {
  const trial = startTrial(31337 + t * 7);
  const seed = (trial.seed ^ 0x5f5e) >>> 0;
  let dRef: MatchDriver | null = null, sig = "", rep = 0, tick = 0, struckAt = -1, resolvedAt = -1, nextAt = -1, last: ChanceResolved | null = null;
  const d = new MatchDriver(featureSetup({
    openOn: () => { const r = rep++; if (struckAt >= 0 && resolvedAt >= 0 && nextAt < 0) nextAt = tick; return buildFreeKickScenario(trial, r, mulberry32((seed ^ ((r + 1) * 0x9e3779b1)) >>> 0)); },
    keeperStrength: () => freeKickSetup(trial, Math.max(0, rep - 1)).keeperStrength,
    scene: { teammates: false }, setPieceSkill: 55,
    onChanceResolved: (i) => { last = i; resolvedAt = tick; sig = `${i.outcome}|${i.ball ? i.ball.x.toFixed(3) + "," + i.ball.y.toFixed(3) + "," + i.ball.z.toFixed(3) : "-"}|rng${dRef?.rngDrawn}`; },
  }, { skills: { power: 60, technique: 60 }, seed: 4242 }), { hw: 1.6 });
  dRef = d;
  d.start();
  let aimT = 0, contactT = 0, lastPh = "", kick = 0, tl: string[] = [], pullUsed = 0;
  for (; tick < 40_000 && kick < 3; tick++) {
    if (d.phase === "aim" && lastPh !== "aim") aimT = 0;
    if (d.phase === "contact" && lastPh !== "contact") contactT = 0;
    if (struckAt >= 0 && d.phase !== lastPh) tl.push(`${d.phase}@${tick - struckAt}`);
    lastPh = d.phase;
    if (d.phase === "aim" && !d.lead) {
      aimT++;
      if (aimT === 30) {
        const b = d.sc.ball, pull = flatPullFor(d.viewport, d.facing);
        d.pointerDown({ x: b.x, y: b.y }, 99, 0);
        const n = t * 3 + kick, tx = AIMS[n % AIMS.length], k = PULLS[(n >> 2) % PULLS.length] * ((d.facing === "up" ? d.viewport.x2 - d.viewport.x1 : d.viewport.y2 - d.viewport.y1) / VIEW_ASPECT);
        const gs = { x: tx - b.x, y: 0 - b.y }, L = Math.hypot(gs.x, gs.y) || 1;
        pullUsed = PULLS[(n >> 2) % PULLS.length];
        d.pointerMove({ x: b.x - gs.x / L * k, y: b.y - gs.y / L * k }, pull);
        d.pointerUp(pull);
        struckAt = tick; resolvedAt = -1; nextAt = -1;
      }
    }
    if (d.phase === "contact" && !d.contactLocked) { contactT++; if (contactT === 6) { const c = botContact(t * 3 + kick); d.tapContact(c.cx, c.cy); } }
    if (process.env.TRACE && struckAt >= 0 && d.ball && (tick - struckAt) % 20 === 0 && tick - struckAt > 140) { const b = d.ball; console.log(`  t+${tick - struckAt} ${d.phase} pos ${b.pos.x.toFixed(1)},${b.pos.y.toFixed(1)} z ${b.z.toFixed(1)} v ${Math.hypot(b.vel.x, b.vel.y).toFixed(1)} rest ${b.resting} lt ${b.lastTouch} own ${b.owner} loose ${b.loose} cl ${b.cleared} vp y ${d.viewport.y1.toFixed(0)}..${d.viewport.y2.toFixed(0)} x ${d.viewport.x1.toFixed(0)}..${d.viewport.x2.toFixed(0)}`); }
    d.tick();
    if (struckAt >= 0 && resolvedAt >= 0 && nextAt >= 0) {
      rows.push({ o: String(last?.outcome), strike: resolvedAt - struckAt, resolve: nextAt - resolvedAt, next: nextAt - struckAt, ballOff: false, tl: tl.join(" "), pull: pullUsed, sig }); tl = [];
      struckAt = -1; kick++;
    }
  }
}
const s = (n: number) => (n / 60).toFixed(1) + "s";
for (const r of rows) console.log(`${r.o.padEnd(8)} strike->resolved ${String(r.strike).padStart(5)}f ${s(r.strike).padStart(6)}   resolved->next kick ${String(r.resolve).padStart(5)}f ${s(r.resolve).padStart(6)}   total ${s(r.next)}`);
console.log("SIGNATURES (outcome | where the ball was | random numbers drawn) must not change:");
console.log(rows.map((r) => r.sig).join("\n"));
const by: Record<string, number[]> = {};
for (const r of rows) (by[r.o] ??= []).push(r.next);
for (const k of Object.keys(by)) console.log(`${k.padEnd(8)} n=${by[k].length} total mean ${s(by[k].reduce((a, b) => a + b, 0) / by[k].length)} max ${s(Math.max(...by[k]))}`);
