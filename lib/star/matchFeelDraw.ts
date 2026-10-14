/**
 * MATCH FEEL — the drawing (lib/star/matchFeel.ts says what and how much).
 *
 * Pure canvas painting: no state, no timers, no random numbers (feelNoise is
 * a fixed sequence), so a still is the same every time. The real match and the
 * Feel preview on /star-animations-dev both call these, so they look the same.
 */
import { feelNoise } from "./matchFeel";

/** The contact burst at the boot: a hot flash, a ring punched outward, short
 *  speed lines along the strike and clods of turf thrown up behind it.
 *  `u` 0→1 over the burst's life; `size` px; (dx,dy) the strike's screen direction. */
export function drawImpactBurst(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, size: number, u: number,
  dx: number, dy: number, power: number, turf: boolean, scuff: boolean,
): void {
  if (!(size > 0) || u < 0 || u >= 1) return;
  const s = 1 - u;
  ctx.save();
  // Flash: biggest at the hit, gone fast.
  const fr = size * (0.5 + 0.7 * u);
  const g = ctx.createRadialGradient(x, y, 0, x, y, fr);
  const hot = scuff ? 0.35 : 0.95;
  g.addColorStop(0, `rgba(255,255,255,${hot * s * s})`);
  g.addColorStop(0.35, `rgba(255,236,170,${0.6 * hot * s * s})`);
  g.addColorStop(1, "rgba(255,220,140,0)");
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, fr, 0, Math.PI * 2); ctx.fill();
  // Shock ring.
  if (!scuff && power > 0.4) {
    ctx.strokeStyle = `rgba(255,255,255,${0.7 * s})`;
    ctx.lineWidth = Math.max(1, size * 0.09 * s);
    ctx.beginPath(); ctx.arc(x, y, size * (0.35 + 1.1 * u), 0, Math.PI * 2); ctx.stroke();
  }
  // Speed lines thrown forward along the strike.
  const n = Math.round(3 + power * 5);
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  if (!scuff) {
    ctx.strokeStyle = `rgba(255,255,255,${0.85 * s})`;
    ctx.lineCap = "round";
    for (let i = 0; i < n; i++) {
      const a = (feelNoise(i, 3) - 0.5) * 1.1;
      const ca = Math.cos(a), sa = Math.sin(a);
      const lx = ux * ca - uy * sa, ly = uy * ca + ux * sa;
      const r0 = size * (0.45 + 0.9 * u);
      const r1 = r0 + size * (0.5 + 0.9 * power) * s;
      ctx.lineWidth = Math.max(1, size * 0.07);
      ctx.beginPath(); ctx.moveTo(x + lx * r0, y + ly * r0); ctx.lineTo(x + lx * r1, y + ly * r1); ctx.stroke();
    }
  }
  // Turf thrown up behind the boot.
  if (turf) drawDustPuff(ctx, x - ux * size * 0.2, y + size * 0.15, size * (0.6 + 0.6 * power), u, 4 + Math.round(power * 5), 11, scuff);
  ctx.restore();
}

/** A puff of dust and turf clods: rises, spreads, falls back. */
export function drawDustPuff(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, size: number, u: number, count: number, salt: number, dull = false,
): void {
  if (!(size > 0) || u < 0 || u >= 1) return;
  const s = 1 - u;
  ctx.save();
  // A soft cloud.
  const cr = size * (0.4 + 0.8 * u);
  const g = ctx.createRadialGradient(x, y, 0, x, y, cr);
  g.addColorStop(0, `rgba(205,190,150,${(dull ? 0.45 : 0.32) * s})`);
  g.addColorStop(1, "rgba(205,190,150,0)");
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(x, y - cr * 0.15, cr, cr * 0.55, 0, 0, Math.PI * 2); ctx.fill();
  // Clods on little arcs.
  for (let i = 0; i < count; i++) {
    const a = Math.PI * (0.05 + 0.9 * feelNoise(i, salt));
    const sp = 0.6 + 0.8 * feelNoise(i, salt + 1);
    const px = x + Math.cos(a) * size * sp * u * (feelNoise(i, salt + 2) < 0.5 ? -1 : 1);
    const py = y - Math.sin(a) * size * sp * 1.2 * u + size * 1.6 * u * u;
    ctx.fillStyle = i % 3 === 0 ? `rgba(70,110,45,${0.9 * s})` : `rgba(120,92,58,${0.85 * s})`;
    ctx.beginPath(); ctx.arc(px, py, Math.max(1, size * (0.06 + 0.05 * feelNoise(i, salt + 3))), 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

/** A speed streak: a tapered smear along the ball's path behind it. */
export function drawSpeedStreak(
  ctx: CanvasRenderingContext2D,
  pts: { x: number; y: number }[], ballR: number, alpha: number,
): void {
  if (pts.length < 2 || !(alpha > 0)) return;
  ctx.save();
  // Outer soft smear, inner bright core: two tapered ribbons.
  for (const [w, a] of [[1.0, 0.22], [0.45, 0.55]] as const) {
    ctx.beginPath();
    const left: { x: number; y: number }[] = [], right: { x: number; y: number }[] = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const q = pts[Math.min(pts.length - 1, i + 1)], o = pts[Math.max(0, i - 1)];
      let tx = q.x - o.x, ty = q.y - o.y;
      const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
      const k = i / (pts.length - 1); // 0 at the tail, 1 at the ball
      const hw = ballR * w * k;
      left.push({ x: p.x - ty * hw, y: p.y + tx * hw });
      right.push({ x: p.x + ty * hw, y: p.y - tx * hw });
    }
    ctx.moveTo(left[0].x, left[0].y);
    for (const p of left) ctx.lineTo(p.x, p.y);
    for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i].x, right[i].y);
    ctx.closePath();
    const tail = pts[0], head = pts[pts.length - 1];
    const grad = ctx.createLinearGradient(tail.x, tail.y, head.x, head.y);
    grad.addColorStop(0, "rgba(255,255,255,0)");
    grad.addColorStop(1, `rgba(255,255,255,${a * alpha})`);
    ctx.fillStyle = grad;
    ctx.fill();
  }
  ctx.restore();
}

/** Spark off the keeper's glove: bright star lines and a ring. */
export function drawGloveSpark(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, u: number, salt: number): void {
  if (!(size > 0) || u < 0 || u >= 1) return;
  const s = 1 - u;
  ctx.save();
  const g = ctx.createRadialGradient(x, y, 0, x, y, size * (0.6 + 0.6 * u));
  g.addColorStop(0, `rgba(255,255,255,${0.95 * s})`);
  g.addColorStop(0.5, `rgba(180,230,255,${0.45 * s})`);
  g.addColorStop(1, "rgba(180,230,255,0)");
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, size * (0.6 + 0.6 * u), 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = `rgba(255,255,255,${0.9 * s})`;
  ctx.lineCap = "round";
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + feelNoise(i, salt) * 0.6;
    const r0 = size * (0.3 + 0.6 * u), r1 = r0 + size * (0.5 + 0.5 * feelNoise(i, salt + 1)) * s;
    ctx.lineWidth = Math.max(1, size * 0.08);
    ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0); ctx.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1); ctx.stroke();
  }
  ctx.restore();
}

/** Woodwork clang: rings of vibration round the point it hit. */
export function drawClang(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, u: number): void {
  if (!(size > 0) || u < 0 || u >= 1) return;
  const s = 1 - u;
  ctx.save();
  for (let i = 0; i < 3; i++) {
    const uu = Math.max(0, u - i * 0.12);
    ctx.strokeStyle = `rgba(255,255,255,${0.8 * s * (1 - i * 0.25)})`;
    ctx.lineWidth = Math.max(1, size * 0.08 * s);
    ctx.beginPath(); ctx.arc(x, y, size * (0.3 + 1.4 * uu), 0, Math.PI * 2); ctx.stroke();
  }
  drawGloveSpark(ctx, x, y, size * 0.7, Math.min(0.99, u * 1.6), 29);
  ctx.restore();
}

/**
 * The back of the net bulging round the ball. (gx,gy) the ball on screen,
 * (bx,by) one screen metre "into" the net (away from the pitch), `size` px,
 * `amt` 0-1 how far it is pushed now. Drawn as stretched mesh lines pulled
 * toward the ball and a shaded pocket behind it.
 */
export function drawNetBulge(
  ctx: CanvasRenderingContext2D,
  gx: number, gy: number, bx: number, by: number, size: number, amt: number,
): void {
  if (!(size > 0) || !(amt > 0.01)) return;
  let nx = bx - gx, ny = by - gy;
  const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
  const push = size * 0.55 * amt;
  ctx.save();
  // The pocket: a shadow where the mesh is pushed back.
  const g = ctx.createRadialGradient(gx + nx * push, gy + ny * push, 0, gx, gy, size);
  g.addColorStop(0, `rgba(8,24,14,${0.4 * amt})`);
  g.addColorStop(1, "rgba(8,24,14,0)");
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(gx, gy, size, size * 0.8, 0, 0, Math.PI * 2); ctx.fill();
  // A patch of the net's own square mesh, dented: every knot is pushed back
  // along (nx,ny) by a bell curve round the ball, so the squares stretch into
  // a pocket. Faded out at its edge so it melts into the goal's mesh.
  const step = size * 0.24, half = Math.ceil(size / step);
  const dent = (x: number, y: number) => {
    const r2 = (x * x + y * y) / (size * size * 0.45);
    const k = push * Math.exp(-r2);
    return { x: gx + x + nx * k, y: gy + y + ny * k };
  };
  ctx.lineWidth = Math.max(0.7, size * 0.03);
  const line = (pts: { x: number; y: number }[], a: number) => {
    if (!(a > 0.02)) return;
    ctx.strokeStyle = `rgba(255,255,255,${a})`;
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
  };
  const A = 0.8 * Math.min(1, amt * 1.6);
  for (let j = -half; j <= half; j++) {
    const o = j * step;
    const fade = A * Math.max(0, 1 - Math.abs(o) / (half * step));
    const h: { x: number; y: number }[] = [], v: { x: number; y: number }[] = [];
    for (let i = -half * 3; i <= half * 3; i++) {
      const s = (i / (half * 3)) * half * step;
      if (Math.hypot(s, o) <= size) { h.push(dent(s, o)); v.push(dent(o, s)); }
    }
    if (h.length > 1) line(h, fade);
    if (v.length > 1) line(v, fade);
  }
  ctx.restore();
}
