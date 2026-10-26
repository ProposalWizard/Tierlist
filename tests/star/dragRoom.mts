/**
 * ROOM TO PULL BACK (Mikey, 26 Oct 2026). Upright, every chance's ball sits
 * at least a full-power drag from the left and right edges of the screen
 * (lib/star/matchView.ts dragRoomCamera). Measured before: within a drag of a
 * side on 21% of tight angles, 18% of long shots, 10% of cutbacks.
 * And every cutback is watched side-on (turnWideChance), whatever the Wide
 * chances setting.
 */
import { buildScenario, SCENARIO_KINDS, goalInView, type Scenario } from "../../lib/star/canvasEngine";
import { frameForNewView, setPlayZoomOverride, turnWideChance, DRAG_ROOM_SHARE, framingFaults } from "../../lib/star/matchView";
import { POST_L, POST_R } from "../../lib/star/pitch";

let fails = 0;
const check = (ok: boolean, what: string) => { if (!ok) { fails++; console.log("  ✗", what); } else console.log("  ✓", what); };
function rng32(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const HW = 844 / 390;

for (const zoom of ["z2", "off"] as const) {
  setPlayZoomOverride(zoom);
  let close = 0, n = 0, goalCut = 0, faults = 0;
  const byKind: Record<string, number> = {};
  for (const kind of SCENARIO_KINDS) for (let s = 1; s <= 80; s++) for (const tilt of [0, 20]) {
    const sc: Scenario = buildScenario(kind, rng32(s * 7919 + 11));
    if (kind === "cutback") turnWideChance(sc, true, HW);
    const before = framingFaults(sc, sc.viewport, HW, tilt).length;
    const cam = frameForNewView(sc, HW, false, tilt);
    if ((sc.facing ?? "up") !== "up") continue;
    n++;
    const m = DRAG_ROOM_SHARE * (cam.x2 - cam.x1);
    if (sc.ball.x < cam.x1 + m - 1e-6 || sc.ball.x > cam.x2 - m + 1e-6) { close++; byKind[kind] = (byKind[kind] ?? 0) + 1; }
    if (goalInView(kind) && (cam.x1 > POST_L + 1e-6 || cam.x2 < POST_R - 1e-6)) goalCut++;
    if (framingFaults(sc, cam, HW, tilt).length > before) faults++;
  }
  check(close === 0, `${zoom === "z2" ? "Zoom" : "Old"} framing: the ball a full drag from both sides on every upright chance (${close} of ${n} too close${close ? ": " + JSON.stringify(byKind) : ""})`);
  check(goalCut === 0, `…and the whole goal still on screen where the goal is in the picture (${goalCut} cut)`);
  check(faults === 0, `…and nobody newly cut in half by an edge (${faults})`);
}
setPlayZoomOverride(null);

{
  let up = 0;
  for (let s = 1; s <= 80; s++) {
    const sc: Scenario = buildScenario("cutback", rng32(s * 31 + 5));
    turnWideChance(sc, true, HW);
    if ((sc.facing ?? "up") === "up") up++;
  }
  check(up === 0, `every cutback is side-on (${up} of 80 upright)`);
}

if (fails) { console.log(`FAIL (${fails})`); process.exit(1); }
console.log("PASS — room to pull back on every chance; cutbacks side-on");
