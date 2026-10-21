/**
 * B14b — where the stamina bar sits (lib/star/barSpot.ts). Harry, 21 Oct 2026:
 * "move it" (on a computer it touched the goal net when the goal was on the left).
 */
import { pickBarCorner, barBox, barHits, BAR_ORDER, type Box } from "../../lib/star/barSpot";

let fails = 0;
function check(label: string, ok: boolean, got?: unknown) {
  if (!ok) { fails++; console.log(`FAIL ${label}`, got ?? ""); } else console.log(`ok   ${label}`);
}
const W = 384, H = 800;
const box = (x: number, y: number, w: number, h: number): Box => ({ x1: x, y1: y, x2: x + w, y2: y + h });

check("nothing on the pitch: bottom-left", pickBarCorner(W, H, [], null) === "bl");
const goalLeft = { box: box(0, 300, 90, 160), weight: 10 };   // side-on, goal on the left edge
check("goal on the left (computer, side-on): the bar never covers it", barHits(pickBarCorner(W, H, [goalLeft], "tl"), W, H, [goalLeft.box]) === 0);
const manBL = { box: box(10, H - 50, 20, 40) };
check("a man in the bottom-left corner: the bar goes bottom-right", pickBarCorner(W, H, [manBL], null) === "br");
check("a clear corner is kept (no hopping)", pickBarCorner(W, H, [], "tr") === "tr");
const all = BAR_ORDER.map((c) => ({ box: barBox(c, W, H) }));
const withGoal = [...all, { box: barBox("tl", W, H), weight: 10 }];
check("every corner busy: never the goal's corner", pickBarCorner(W, H, withGoal, null) !== "tl");
check("the added-time badge pushes a top bar down 28 px", barBox("tl", W, H, 28).y1 === barBox("tl", W, H).y1 + 28);
// Fuzz: whenever a clear corner exists, the pick covers nothing.
let ok = 0, n = 0;
let s = 1;
const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
for (let i = 0; i < 3000; i++) {
  const things = Array.from({ length: 1 + Math.floor(rnd() * 14) }, () => ({ box: box(rnd() * W, rnd() * H, 18, 30) }));
  const anyClear = BAR_ORDER.some((c) => barHits(c, W, H, things.map((t) => t.box)) === 0);
  if (!anyClear) continue;
  n++;
  if (barHits(pickBarCorner(W, H, things, BAR_ORDER[i % 4]), W, H, things.map((t) => t.box)) === 0) ok++;
}
check(`a clear corner always wins when there is one (${ok}/${n})`, ok === n && n > 2000);

console.log(fails ? `\n${fails} FAILED` : "\nall passed");
process.exit(fails ? 1 : 0);
