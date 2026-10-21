import { newMatch, tick, type HiddenMatchInputs } from "../../lib/star/hiddenMatch";
import { mulberry32 } from "../../lib/star/season";
import { cornerReach, canTakeCorners } from "../../lib/star/cornerReach";

/**
 * CORNERS ONLY IF YOU CAN REACH THE BOX (Mikey, 20 Oct 2026).
 *
 * "you can only become the corner kick taker if you also have the minimum
 * amount of power to kick the ball into the center of the penalty area …
 * determine this by the actual number" — the carry of your strongest corner
 * through the match's own physics, not the power number.
 */

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

// 1. Reach follows the physics: more power carries further, and the line sits
//    where the carry passes the distance to the middle of the box.
let last = 0;
const rows: string[] = [];
for (const power of [20, 40, 50, 60, 65, 70, 80, 100]) {
  const r = cornerReach({ power, technique: 50 });
  check(r.carry >= last, `carry rises with power (${power}: ${r.carry.toFixed(1)} m)`);
  last = r.carry;
  check(r.needed > 30 && r.needed < 40, `the flag is 30–40 m from the middle of the box (${r.needed.toFixed(1)})`);
  check(r.ok === (r.carry >= r.needed), "ok means the carry reaches it");
  rows.push(`power ${String(power).padStart(3)}: carries ${r.carry.toFixed(1)} m of ${r.needed.toFixed(1)} → ${r.ok ? "takes corners" : "a team-mate takes them"}`);
}
check(!canTakeCorners({ power: 40, technique: 50 }), "a 40-power player can't reach the box");
check(canTakeCorners({ power: 80, technique: 50 }), "an 80-power player can");

// 2. The match never hands you a corner when you can't reach, and still does when you can.
function cornersIn(can: boolean | undefined): number {
  let n = 0;
  for (let seed = 1; seed <= 300; seed++) {
    const rng = mulberry32(seed * 977 + 3);
    const st = newMatch(rng);
    const inputs: HiddenMatchInputs = { teamStrength: 70, oppStrength: 65, energy: 80, playerSkill: 65, pace: 60, home: true, position: "CM", freeKick: 60, ...(can === undefined ? {} : { canTakeCorners: can }) };
    for (let m = 0; m < 90; m++) { const out = tick(st, inputs, rng); if (out.request?.kinds.includes("corner")) n++; }
  }
  return n;
}
const yes = cornersIn(true), no = cornersIn(false), old = cornersIn(undefined);
check(no === 0, `can't reach: no corners handed to you (${no})`);
check(yes > 0 && yes === old, `can reach: corners as before (${yes} vs ${old})`);
rows.push(`300 matches as a CM: corners handed to you ${old} before · ${yes} if you can reach · ${no} if you can't`);

console.log(rows.join("\n"));
if (problems.length) { console.log("FAIL cornerReach"); for (const x of problems) console.log("  ✗ " + x); process.exit(1); }
console.log("PASS cornerReach");
