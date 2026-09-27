/**
 * THE GOAL, AS THE MATCH DRAWS IT — one function, two callers.
 *
 * Moved here UNCHANGED from CanvasMatch.tsx's render (v0.15, item 1) so the
 * scenario gallery, its editor and Infinite Highlights draw exactly the goal
 * the real match draws. Harry, playtesting the gallery: it "puts the goal a
 * little bit more forward than it should be" — he placed keepers where the
 * posts end, thinking that was the goal line. The pictures drew the goal flat,
 * with the post stubs running 1.2 m FORWARD onto the pitch; the match draws
 * them standing UP from the line. One drawing now, so the two cannot disagree.
 *
 * The pitch is a flat plan and the goal is the one thing on it drawn with
 * HEIGHT: posts standing on the goal line, a crossbar across their tops, the
 * netting stretched back behind them and a second frame at the back. That is
 * not a departure from the overhead camera — it is the same trick the ball
 * already uses, being lifted off its own shadow — and it is drawn at exactly
 * that scale, so a ball over the bar is visibly over the bar.
 *
 * Built as five surfaces, drawn back to front, because that is what a goal
 * is. What it replaced was a single flat panel with an even mesh over it,
 * and rendering the two side by side at matched width said why that read as
 * a window rather than a goal: **no tonal separation**. A goal's roof
 * catches the light and its mouth is in shadow, and with both the same
 * brightness there is nothing to tell you which way is in.
 *
 * `P` maps pitch metres to canvas pixels for whatever way the frame is turned
 * (CanvasMatch's `toPx`); `unit` is pixels per metre across the pitch and
 * `heightScale` pixels per metre of height (CanvasMatch's `uy`). Height is
 * always drawn straight up the screen, whichever way the pitch is turned —
 * exactly as the match does it.
 */
import { POST_L, POST_R, NET_DEPTH, GOAL_H } from "./pitch";

export type GoalPt = { px: number; py: number };

export function drawMatchGoal(
  ctx: CanvasRenderingContext2D,
  P: (x: number, y: number) => GoalPt,
  unit: number,
  heightScale: number,
): void {
  const hpx = GOAL_H * heightScale;
  const bl = P(POST_L, 0), br = P(POST_R, 0);                 // feet of the posts
  const tl = { px: bl.px, py: bl.py - hpx };                  // top of the near post
  const tr = { px: br.px, py: br.py - hpx };
  const rl = P(POST_L, -NET_DEPTH), rr = P(POST_R, -NET_DEPTH); // feet at the back
  const ul = { px: rl.px, py: rl.py - hpx };                  // and the back frame
  const ur = { px: rr.px, py: rr.py - hpx };

  type Pt = GoalPt;
  const path = (q: Pt[]) => {
    ctx.beginPath();
    ctx.moveTo(q[0].px, q[0].py);
    for (let i = 1; i < q.length; i++) ctx.lineTo(q[i].px, q[i].py);
    ctx.closePath();
  };
  const quad = (q: Pt[], fill: string) => { path(q); ctx.fillStyle = fill; ctx.fill(); };
  const seg = (a2: Pt, b2: Pt) => { ctx.beginPath(); ctx.moveTo(a2.px, a2.py); ctx.lineTo(b2.px, b2.py); ctx.stroke(); };
  const lerp = (a2: Pt, b2: Pt, f: number) => ({ px: a2.px + (b2.px - a2.px) * f, py: a2.py + (b2.py - a2.py) * f });
  // Netting over a surface: strands both ways, clipped to it.
  const netting = (q: Pt[], cols: number, rows: number, alpha: number) => {
    ctx.save();
    path(q); ctx.clip();
    ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
    ctx.lineWidth = Math.max(0.7, unit * 0.028);
    for (let i = 0; i <= cols; i++) { const f = i / cols; seg(lerp(q[0], q[1], f), lerp(q[3], q[2], f)); }
    for (let j = 0; j <= rows; j++) { const f = j / rows; seg(lerp(q[0], q[3], f), lerp(q[1], q[2], f)); }
    ctx.restore();
  };

  // Its shadow on the grass.
  const sh = unit * 0.5;
  quad([rl, rr, br, bl].map(q => ({ px: q.px + sh, py: q.py + sh * 0.3 })), "rgba(0,0,0,0.09)");
  // The floor inside — barely shaded, because it is grass and you are
  // looking straight at it through an open mouth.
  quad([bl, br, rr, rl], "rgba(20,50,32,0.05)");
  // The back of the net: the deepest surface, and the one you see through
  // the mouth. Dimmer than the roof, which is what separates the two — in a
  // straight-down view a horizontal roof and a vertical back wall both come
  // out as flat bands, so shading is the only thing that can tell them apart.
  quad([rl, rr, ur, ul], "rgba(22,52,34,0.16)");
  netting([rl, rr, ur, ul], 34, 10, 0.42);
  ctx.strokeStyle = "#0f1a14";
  ctx.lineWidth = Math.max(1.8, unit * 0.15);
  seg(rl, ul); seg(rr, ur); seg(ul, ur);
  // The roof, catching the light — brighter than the back, deliberately.
  quad([tl, tr, ur, ul], "rgba(236,245,239,0.30)");
  netting([tl, tr, ur, ul], 34, 5, 0.8);
  // ── Nothing is drawn across the mouth ──
  //
  // The mouth is a hole. The net hangs BEHIND the posts and across the back,
  // and what you see through the opening is that back net in the upper part
  // and plain grass below it — which is exactly what the geometry gives you
  // once you stop drawing a second net across the front. Meshing the front
  // face too put netting on both sides of the frame: "it's everywhere, it's
  // at the front of the goal as well."

  // The frame at the front. The two objects a shot can actually hit.
  ctx.lineCap = "round";
  ctx.strokeStyle = "#f6faf7";
  ctx.lineWidth = Math.max(1.8, unit * 0.12);
  seg(bl, tl); seg(br, tr);
  ctx.lineWidth = Math.max(2, unit * 0.16);
  seg(tl, tr);
  ctx.lineCap = "butt";

  // The goal line on the ground, thin — the frame above it is the loud part.
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = Math.max(1.5, unit * 0.11);
  seg(bl, br);
}
