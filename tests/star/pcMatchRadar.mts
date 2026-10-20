/**
 * The PC match + radar page (/star-pc-match-dev) draws the real match from
 * above. It only reads; these check that what it reads lands in the right
 * place on its pitch, and that the hooks it reads through change nothing for
 * a real match:
 *   1. a chance's men are turned the right way (your attack goes right, the
 *      attacker's left is the radar's top; their kick at your goal goes left);
 *   2. between chances the ball dot sits inside the area the unseen match
 *      says it is in, every minute of a real match;
 *   3. the live radar's tap and the radar-look override are absent from the
 *      real career match (only the test page wraps the match in them).
 */
import { readFileSync } from "node:fs";
import { toRadar, tickSpot, PITCH_L, PITCH_W } from "../../app/star-pc-match-dev/ElevenRadar";
import { playRadarMatch } from "../../lib/star/matchRadar";
import type { HiddenMatchInputs } from "../../lib/star/hiddenMatch";

let failed = 0;
const ok = (cond: boolean, msg: string) => { if (!cond) { failed++; console.log("  FAIL", msg); } else console.log("  ok  ", msg); };
const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;

console.log("\n== a chance's men, turned onto the whole pitch");
{
  const goal = toRadar({ x: 34, y: 0 }, "us");
  ok(near(goal.x, PITCH_L) && near(goal.y, PITCH_W / 2), "your attack: their goal's centre is the right-hand goal (105, 34)");
  const spot = toRadar({ x: 34, y: 11 }, "us");
  ok(near(spot.x, 94) && near(spot.y, 34), "their penalty spot is 11 m out from the right-hand goal");
  const left = toRadar({ x: 10, y: 20 }, "us");
  ok(left.y < PITCH_W / 2, "the attacker's left (small x on the match screen) is the radar's top");
  const theirs = toRadar({ x: 34, y: 0 }, "them");
  ok(near(theirs.x, 0) && near(theirs.y, PITCH_W / 2), "their kick at your goal: the left-hand goal (0, 34)");
  const theirSpot = toRadar({ x: 34, y: 11 }, "them");
  ok(near(theirSpot.x, 11), "your penalty spot is 11 m out from the left-hand goal");
}

console.log("\n== between chances: the dot sits in the area the unseen match names");
{
  const ZX = { own_box: [0, 16.5], defensive: [16.5, 35], middle: [35, 70], attacking: [70, 88.5], box: [88.5, 105] } as const;
  const LY = { left: [0, 21], centre: [21, 47], right: [47, 68] } as const;
  const inputs: HiddenMatchInputs = { teamStrength: 80, oppStrength: 74, home: true, playerSkill: 70, pace: 70, freeKick: 70, position: "ST" };
  let minutes = 0, inside = 0;
  for (const seed of [1, 2, 3, 4, 5]) {
    for (const f of playRadarMatch(seed, inputs).frames) {
      const p = tickSpot(f);
      minutes++;
      if (p.x >= ZX[f.zone][0] && p.x <= ZX[f.zone][1] && p.y >= LY[f.lane][0] && p.y <= LY[f.lane][1]) inside++;
    }
  }
  ok(minutes > 400 && inside === minutes, `${inside} of ${minutes} minutes (5 real matches) draw the ball inside the named area and channel`);
}

console.log("\n== the real match is untouched");
{
  const career = readFileSync("app/star-dev/page.tsx", "utf8");
  ok(!/LiveRadarTap|MatchRadarLookOverride/.test(career), "the career page never wraps its match in the tap or the look override");
  const look = readFileSync("lib/star/matchRadarLook.ts", "utf8");
  ok(/return forced \?\? saved/.test(look), "with no override the radar look is this phone's own setting");
  const radar = readFileSync("components/star/MatchRadar.tsx", "utf8");
  ok(/if \(tap\?\.hideInline\) return null;/.test(radar) && /tap\?\.onReading\(/.test(radar), "the small radar only hides or reports when a page has wrapped it");
  const page = readFileSync("app/star-pc-match-dev/page.tsx", "utf8");
  ok(/<EnginePlay /.test(page) && !/<CanvasMatch/.test(page), "the page plays the match through EnginePlay, never CanvasMatch directly");
}

if (failed) { console.log(`\n${failed} FAILED`); process.exit(1); }
console.log("\nall passed");
