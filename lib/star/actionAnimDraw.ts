/**
 * The contact flash (Animations: New) — drawn, nothing else. The match screen
 * and the animation test page both call this, so they look the same.
 *
 * A white glow where boot or glove meets the ball, and for a strike off the
 * grass a small puff of dust. No random numbers: the puff is the same every
 * time, so a still is repeatable.
 */
export function drawContactFlash(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  /** The flash's full-size radius in pixels. */
  radius: number,
  /** 0-1: 1 at the touch, fading to 0. */
  strength: number,
  dust = false,
): void {
  if (!(strength > 0) || !(radius > 0)) return;
  ctx.save();
  ctx.globalAlpha = 1;
  // It grows a little as it fades: a burst, not a dot.
  const fr = radius * (0.55 + 0.45 * (1 - strength));
  const g = ctx.createRadialGradient(x, y, 0, x, y, fr);
  g.addColorStop(0, `rgba(255,255,255,${0.85 * strength})`);
  g.addColorStop(0.45, `rgba(255,250,220,${0.45 * strength})`);
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, fr, 0, Math.PI * 2);
  ctx.fill();
  if (dust) {
    // Five small clods of turf thrown up and out behind the boot.
    const spread = radius * (0.35 + 0.9 * (1 - strength));
    ctx.fillStyle = `rgba(150,120,80,${0.55 * strength})`;
    for (let i = 0; i < 5; i++) {
      const a = Math.PI * (1.1 + i * 0.2);
      const d = spread * (0.6 + 0.12 * i);
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.45 + radius * 0.15, Math.max(1, radius * 0.11), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}
