/**
 * VISION PASS CHECKS — can a ball to each man actually get there, on the real
 * engine? Writes lib/star/data/visionChecks.json.
 *
 *   npx tsx scripts/vision/check_passes.mts
 *
 * For every Vision picture (the real passes in lib/star/data/visionMoments.json
 * and the team's drawn passing chances) and every team-mate in it: a good
 * player's pass to him (aimed ± 2.5°, weighted ± 10 %, struck round the middle:
 * tests/star/visionBot.ts) is played 24 times by the real engine (launch, then
 * stepDefenders/stepKeeper/stepReactions/stepBall at 1/180 s) with all their
 * men on the pitch and only him to aim at. Stored: how many of the 24 reached
 * him. The drill reads it (lib/star/visionRound.ts): the right man must be
 * reachable (a clean ball gets there), and a man the engine cuts out is a
 * trap ("CUT OUT"). Re-run after re-running build_vision_moments.mts, or
 * after the team commits new drawn chances (a new drawing with no check
 * falls back to the geometry: a defender within LANE_CUT_M of the lane).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { setVisionMoments, realBases, drawnBases, type VisionBase, type VisionPicture } from "../../lib/star/visionRound";
import { playKick, passPowerFor, GOOD_PLAYER } from "../../tests/star/visionBot";
import { mulberry32 } from "../../lib/star/season";

setVisionMoments(JSON.parse(readFileSync("lib/star/data/visionMoments.json", "utf8")));
export const CHECK_GOES = 24;

function gauss(r: () => number) {
  let u = 0, v = 0;
  while (u === 0) u = r();
  while (v === 0) v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function check(b: VisionBase, i: number): number {
  const m = b.mates[i];
  const d = Math.hypot(m.x - b.ball.x, m.y - b.ball.y);
  if (d < 3 || d > 40) return 0;
  const pic: VisionPicture = {
    id: b.id, source: b.source, kind: b.kind, ball: b.ball,
    options: [{ x: m.x, y: m.y, onside: true, lineGap: Infinity, space: 99, lane: 99, score: 1, trap: null }],
    best: 0, defenders: b.opps, keeper: b.keeper, margin: 1, traps: 0,
  };
  const r = mulberry32((i * 7919 + b.id.length * 104729 + Math.round(m.x * 13 + m.y * 31)) >>> 0);
  let ok = 0;
  for (let g = 0; g < CHECK_GOES; g++) {
    const err = (gauss(r) * GOOD_PLAYER.aimSdDeg * Math.PI) / 180;
    const dx = m.x - b.ball.x, dy = m.y - b.ball.y;
    const aim = { x: b.ball.x + dx * Math.cos(err) - dy * Math.sin(err), y: b.ball.y + dx * Math.sin(err) + dy * Math.cos(err) };
    const power = passPowerFor(d) * (1 + gauss(r) * GOOD_PLAYER.powerSd);
    const contact = { cx: gauss(r) * GOOD_PLAYER.contactSd, cy: gauss(r) * GOOD_PLAYER.contactSd };
    // Offside is the law's business, not the pass's: judged here as if onside.
    const v = playKick(pic, aim, power, contact, GOOD_PLAYER.skills, (g * 2654435761 + i) >>> 0, { ignoreOffside: true });
    if (v.result === "right") ok++;
  }
  return ok;
}

const out: Record<string, number[]> = {};
let n = 0;
for (const b of [...realBases(), ...drawnBases()]) {
  out[b.id] = b.mates.map((_, i) => check(b, i));
  n += b.mates.length;
}
const keys = Object.keys(out).sort();
const text = `{\n  "note": ${JSON.stringify(`How many of ${CHECK_GOES} good passes to each team-mate the real engine lets through (scripts/vision/check_passes.mts). Per picture id, one number per team-mate in the picture's own order. Do not edit by hand.`)},\n  "goes": ${CHECK_GOES},\n  "checks": {\n${keys.map((k) => `    ${JSON.stringify(k)}: ${JSON.stringify(out[k])}`).join(",\n")}\n  }\n}\n`;
writeFileSync("lib/star/data/visionChecks.json", text);
console.log(`checked ${n} passes in ${keys.length} pictures → lib/star/data/visionChecks.json (${(text.length / 1024).toFixed(0)} KB)`);
