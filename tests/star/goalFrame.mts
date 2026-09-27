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
import { finishServedFrame, naturalTargets, FRAME_TOP_FOR_GOAL, ROOM_FOR_POWER, THUMB_FRAC_W, FIGURE_DRAWN_H, roomShare } from "@/lib/star/goalFrame";
import { mulberry32 } from "@/lib/star/season";
import { POST_L, POST_R, GOAL_H, NET_DEPTH, BOX_L, BOX_R, BOX_DEPTH } from "@/lib/star/pitch";

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

// ── The corner-flag views (final playtest, 27 Sep 2026) ──
// Before: corners 0/300 with the whole goal on screen and a box player cut
// on 281; byline crosses 113/300 and 180. Screen-down is pitch x there.
console.log("\n5. CORNERS AND BYLINE CROSSES: THE WHOLE GOAL AND EVERY MAN IN THE BOX ON SCREEN");
{
  const toS = (sc: Scenario, x: number, y: number) => {
    const v = sc.viewport, fx = (x - v.x1) / (v.x2 - v.x1), fy = (y - v.y1) / (v.y2 - v.y1);
    return sc.facing === "right" ? { sx: 1 - fy, sy: fx } : { sx: fy, sy: 1 - fx };
  };
  const on = (p: { sx: number; sy: number }) => p.sx >= -1e-6 && p.sx <= 1 + 1e-6 && p.sy >= -1e-6 && p.sy <= 1 + 1e-6;
  for (const kind of ["corner", "byline_cross"] as ScenarioKind[]) {
    let n = 0, goal = 0, cut = 0, room = 0, shape = 0, again = 0, maxH = 0;
    for (let i = 0; i < 300; i++) {
      const sc = makeChance({ source: { from: "kind", kind }, rng: mulberry32(700 + i * 7919), memory: null }).sc;
      if ((sc.facing ?? "up") === "up") continue;
      n++;
      const v = sc.viewport, H = v.x2 - v.x1, m = 1 / H;
      maxH = Math.max(maxH, H);
      if (Math.abs((v.y2 - v.y1) / H - VIEW_ASPECT) > 1e-6) shape++;
      const posts = [[POST_L, 0], [POST_R, 0], [POST_L, -NET_DEPTH], [POST_R, -NET_DEPTH]].map(([x, y]) => toS(sc, x, y));
      if (posts.every((p) => on(p) && p.sy - GOAL_H * m >= -1e-6)) goal++;
      const men = [sc.player, sc.keeper, sc.follower, ...sc.teammates, ...sc.defenders,
        ...(sc.runner ? [sc.runner.pos] : []), ...sc.secondaryRunners.map((r) => r.pos)]
        .filter((p) => p.x >= BOX_L - 1 && p.x <= BOX_R + 1 && p.y >= -1 && p.y <= BOX_DEPTH + 1);
      if (men.some((p) => { const f = toS(sc, p.x, p.y); return !on(f) || f.sy - FIGURE_DRAWN_H * m < -1e-6; })) cut++;
      if (1 - toS(sc, sc.ball.x, sc.ball.y).sy >= roomShare() - 1e-6) room++;
      const c2: Scenario = structuredClone(sc);
      finishServedFrame(c2);
      if (Math.abs(c2.viewport.x1 - v.x1) + Math.abs(c2.viewport.x2 - v.x2) > 1e-6) again++;
    }
    ok(goal === n, `${kind}: the whole goal on screen, standing up from its posts (${goal}/${n})`);
    ok(cut === 0, `${kind}: every man drawn in the box on screen, boots to head (${n - cut}/${n})`);
    ok(room === n, `${kind}: a full pull plus a thumb below the ball (${room}/${n})`);
    ok(shape === 0 && again === 0 && maxH <= 60, `${kind}: canvas shape kept, a second pass changes nothing, widest ${maxH.toFixed(1)} m`);
  }
}

if (failed) { console.log(`\n${failed} FAILED`); process.exit(1); }
console.log("\nALL PASSED");
