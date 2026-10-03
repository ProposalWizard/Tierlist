/**
 * THE NEW VIEW'S BALL — Settings → Look → Ball: New.
 *
 * Harry, 3 Oct 2026: "That ball is horrible." At about 7 px across the photo
 * ball turns into a grey blob. This one is drawn: crisp white, lit from the
 * upper left like the players, a hint of dark pentagon panels (one in the
 * middle, three cut by the edge) that turn with the ball's roll, a 1 px dark rim
 * so it never melts into the white lines or a pale shirt, and a small soft
 * shadow thrown to the lower right like the men's.
 *
 * A picture only. Where the ball is, and how high, is the match's business.
 */

/**
 * @param gx,gy  where the ball is over the grass (its shadow's spot)
 * @param by     the ball's centre on screen (lifted by its height)
 * @param r      its radius in px
 * @param roll   the roll angle (the match's seam angle), turns the panels
 * @param h      height above the grass in metres (shrinks and fades the shadow)
 * @param px1    one device pixel in canvas units (the rim is this thick)
 */
export function drawMatchBall(
  ctx: CanvasRenderingContext2D,
  gx: number, gy: number, by: number, r: number, roll: number, h: number, px1 = 1,
): void {
  // ── The shadow: soft, offset like the players' (lower right) ──
  const k = 1 / (1 + h * 0.18);
  const sx = gx + r * (0.45 + h * 0.08), sy = gy + r * 0.25;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.scale(1, 0.5);
  const sr = r * 1.25 * k;
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, sr);
  g.addColorStop(0, `rgba(0,0,0,${0.42 * k})`);
  g.addColorStop(0.65, `rgba(0,0,0,${0.2 * k})`);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, sr, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // ── The ball ──
  ctx.save();
  ctx.translate(gx, by);
  // Body: white, a touch of grey shading away from the light.
  const body = ctx.createRadialGradient(-r * 0.38, -r * 0.42, r * 0.1, 0, 0, r * 1.05);
  body.addColorStop(0, "#ffffff");
  body.addColorStop(0.55, "#f4f6f8");
  body.addColorStop(1, "#c9d0d8");
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = body;
  ctx.fill();

  // Panels, clipped to the ball and turned with its roll.
  ctx.save();
  ctx.clip();
  ctx.rotate(roll);
  ctx.fillStyle = "rgba(28,34,44,0.82)";
  const pent = (cx: number, cy: number, pr: number, rot: number) => {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = rot + (i * Math.PI * 2) / 5 - Math.PI / 2;
      const x = cx + Math.cos(a) * pr, y = cy + Math.sin(a) * pr;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  };
  // One dark pentagon in the middle and three cut off by the edge — the
  // classic ball picture. All of it is clipped to the circle, so the
  // outline of the ball stays perfectly round however it rolls.
  pent(0, 0, r * 0.32, 0);
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI * 2) / 3 + Math.PI / 6;
    pent(Math.cos(a) * r * 0.98, Math.sin(a) * r * 0.98, r * 0.3, a + Math.PI / 2);
  }
  ctx.restore();

  // A small highlight, upper left, so it reads as round.
  ctx.beginPath();
  ctx.arc(-r * 0.4, -r * 0.42, r * 0.16, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.fill();

  // The rim: one device pixel, dark, so it separates from grass and lines.
  ctx.beginPath();
  ctx.arc(0, 0, r - px1 * 0.5, 0, Math.PI * 2);
  ctx.lineWidth = px1;
  ctx.strokeStyle = "rgba(10,16,24,0.55)";
  ctx.stroke();
  ctx.restore();
}
