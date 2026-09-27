/**
 * tests/star/goalFrame.mts — the served frame's last word (v0.15 A3, items
 * 12 and 20).
 *
 *  1. The whole goal is on screen on every open-play chance with a goal in it
 *     (the top edge at or above the bar, both posts inside). Before: through
 *     balls had the goal cut 34% of the time (166 of 482 in a 400-match run).
 *  2. The chance itself never moves: the ball and everybody but a man a slide
 *     would lose stand exactly where they were made ("built closer" was
 *     rejected — the camera zooms out instead).
 *  3. A full-power pull (power 55, plus a thumb's width) fits on the picture
 *     towards every natural target.
 *  4. The frame keeps the canvas's shape and never zooms past what it needs.
 */
import { VIEW_ASPECT, dragForFullPower, type ScenarioKind, type Scenario } from "@/lib/star/canvasEngine";
import { makeChance } from "@/lib/star/chanceMaker";
import { finishServedFrame, naturalTargets, FRAME_TOP_FOR_GOAL, ROOM_FOR_POWER, THUMB_FRAC_W } from "@/lib/star/goalFrame";
import { mulberry32 } from "@/lib/star/season";
import { POST_L, POST_R } from "@/lib/star/pitch";

let failed = 0;
const ok = (c: boolean, msg: string) => { console.log(`  ${c ? "✓" : "✗"} ${msg}`); if (!c) failed++; };

const KINDS: ScenarioKind[] = ["through_ball", "long_range", "tight_angle", "cutback", "one_on_one", "free_kick", "penalty"];

console.log("1-4. SERVED CHANCES, 150 A KIND");
for (const kind of KINDS) {
  let cut = 0, moved = 0, pullOff = 0, shape = 0, n = 0;
  let maxH = 0;
  for (let i = 0; i < 150; i++) {
    const made = makeChance({ source: { from: "kind", kind }, rng: mulberry32(3100 + i * 7919), memory: null });
    const sc = made.sc;
    if ((sc.facing ?? "up") !== "up") continue;
    n++;
    const v = sc.viewport;
    if (v.y1 > FRAME_TOP_FOR_GOAL + 1e-6 || POST_L < v.x1 || POST_R > v.x2) cut++;
    const W = v.x2 - v.x1, H = v.y2 - v.y1;
    maxH = Math.max(maxH, H);
    if (Math.abs(W / H - VIEW_ASPECT) > 1e-6) shape++;
    // A second pass changes nothing (it is the camera's last word, and stable).
    const again: Scenario = structuredClone(sc);
    finishServedFrame(again);
    if (Math.abs(again.ball.x - sc.ball.x) + Math.abs(again.ball.y - sc.ball.y) > 1e-9) moved++;
    // The pull, from the ball, straight back from each natural target.
    const L = dragForFullPower(ROOM_FOR_POWER) * H, thumb = THUMB_FRAC_W * W;
    for (const t of naturalTargets(sc)) {
      const dx = sc.ball.x - t.x, dy = sc.ball.y - t.y, d = Math.hypot(dx, dy) || 1;
      const ex = sc.ball.x + (dx / d) * L, ey = sc.ball.y + (dy / d) * L;
      if (ex - thumb < v.x1 - 1e-6 || ex + thumb > v.x2 + 1e-6 || ey + thumb > v.y2 + 1e-6 || ey - thumb < v.y1 - 1e-6) { pullOff++; break; }
    }
  }
  ok(cut === 0, `${kind}: whole goal in frame (${n - cut}/${n})`);
  ok(moved === 0, `${kind}: the ball never moves for the camera`);
  ok(pullOff === 0, `${kind}: a full pull plus a thumb fits (${n - pullOff}/${n})`);
  ok(shape === 0 && maxH <= 60, `${kind}: the frame keeps the canvas's shape, tallest ${maxH.toFixed(1)} m`);
}

// The same chance, framed or not: the ball and you stand where they were made.
console.log("\n2. THE CAMERA MOVES, NEVER THE CHANCE");
{
  let moved = 0, n = 0;
  for (let i = 0; i < 200; i++) {
    const made = makeChance({ source: { from: "kind", kind: "through_ball" }, rng: mulberry32(51 + i), memory: null });
    const sc = structuredClone(made.sc);
    // Undo the frame to a plain 42 m one high up the pitch and frame it again.
    const b = { ...sc.ball }, you = { ...sc.player };
    sc.viewport = { x1: sc.ball.x - 13, x2: sc.ball.x + 13.25, y1: sc.ball.y - 30, y2: sc.ball.y + 12 };
    finishServedFrame(sc);
    n++;
    if (Math.hypot(sc.ball.x - b.x, sc.ball.y - b.y) > 1e-9 || Math.hypot(sc.player.x - you.x, sc.player.y - you.y) > 1e-9) moved++;
  }
  ok(moved === 0, `ball and you never moved (${moved}/${n})`);
}

if (failed) { console.log(`\n${failed} FAILED`); process.exit(1); }
console.log("\nALL PASSED");
