/**
 * THE CANVAS PATH, IN PLAIN NUMBERS.
 * A browser canvas turns every path command through the transform in force
 * WHEN THE COMMAND IS GIVEN; fill() and stroke() then use the transform in
 * force at THAT moment. So points are kept here already turned (in the
 * picture's own pixels), arcs and ellipses as cubic curves, and ctx2d.ts turns
 * the whole path back into the drawing's space when it fills or strokes.
 * Pure code (no Skia), tested by tools/draw-check.ts.
 */

/** A 2D transform as a canvas keeps it: x' = a·x + c·y + e, y' = b·x + d·y + f. */
export type Mat = [number, number, number, number, number, number];
export const IDENTITY: Mat = [1, 0, 0, 1, 0, 0];

/** m × n: n is applied first, then m (canvas.transform(n) does cur = mul(cur, n)). */
export function mul(m: Mat, n: Mat): Mat {
  return [
    m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}
export function invert(m: Mat): Mat | null {
  const det = m[0] * m[3] - m[1] * m[2];
  if (!det || !Number.isFinite(det)) return null;
  const a = m[3] / det, b = -m[1] / det, c = -m[2] / det, d = m[0] / det;
  return [a, b, c, d, -(a * m[4] + c * m[5]), -(b * m[4] + d * m[5])];
}
export function apply(m: Mat, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}
/** How many picture pixels one drawing unit is (the average scale). */
export function scaleOf(m: Mat): number {
  return Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])) || 0;
}
/** Skia's 3×3 (row-major) for a canvas transform. */
export function toSkia(m: Mat): number[] {
  return [m[0], m[2], m[4], m[1], m[3], m[5], 0, 0, 1];
}

export type Cmd =
  | { k: "M"; p: [number, number] }
  | { k: "L"; p: [number, number] }
  | { k: "Q"; p: [number, number, number, number] }
  | { k: "C"; p: [number, number, number, number, number, number] }
  | { k: "Z" };

const TAU = Math.PI * 2;

/** The current path of one canvas. Points go in with `m` (the transform now). */
export class PathRecorder {
  cmds: Cmd[] = [];
  /** Current point and subpath start, in picture pixels. */
  private cur: [number, number] | null = null;
  private start: [number, number] | null = null;

  reset() { this.cmds = []; this.cur = null; this.start = null; }
  get hasCurrent() { return this.cur !== null; }
  /** The current point in the drawing's space (for arcTo), or null. */
  currentIn(m: Mat): [number, number] | null {
    if (!this.cur) return null;
    const inv = invert(m);
    return inv ? apply(inv, this.cur[0], this.cur[1]) : null;
  }

  moveTo(m: Mat, x: number, y: number) {
    if (!finite(x, y)) return;
    const p = apply(m, x, y);
    this.cmds.push({ k: "M", p });
    this.cur = p; this.start = p;
  }
  lineTo(m: Mat, x: number, y: number) {
    if (!finite(x, y)) return;
    if (!this.cur) return this.moveTo(m, x, y);
    const p = apply(m, x, y);
    this.cmds.push({ k: "L", p });
    this.cur = p;
  }
  quadraticCurveTo(m: Mat, cx: number, cy: number, x: number, y: number) {
    if (!finite(cx, cy, x, y)) return;
    if (!this.cur) this.moveTo(m, cx, cy);
    const c = apply(m, cx, cy), p = apply(m, x, y);
    this.cmds.push({ k: "Q", p: [c[0], c[1], p[0], p[1]] });
    this.cur = p;
  }
  bezierCurveTo(m: Mat, c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number) {
    if (!finite(c1x, c1y, c2x, c2y, x, y)) return;
    if (!this.cur) this.moveTo(m, c1x, c1y);
    const a = apply(m, c1x, c1y), b = apply(m, c2x, c2y), p = apply(m, x, y);
    this.cmds.push({ k: "C", p: [a[0], a[1], b[0], b[1], p[0], p[1]] });
    this.cur = p;
  }
  closePath() {
    if (!this.cur) return;
    this.cmds.push({ k: "Z" });
    this.cur = this.start;
  }
  rect(m: Mat, x: number, y: number, w: number, h: number) {
    if (!finite(x, y, w, h)) return;
    this.moveTo(m, x, y);
    this.lineTo(m, x + w, y); this.lineTo(m, x + w, y + h); this.lineTo(m, x, y + h);
    this.closePath();
    this.moveTo(m, x, y);
  }
  arc(m: Mat, x: number, y: number, r: number, a0: number, a1: number, ccw = false) {
    if (r < 0) throw new RangeError("The radius provided is negative.");
    this.ellipse(m, x, y, r, r, 0, a0, a1, ccw);
  }
  ellipse(m: Mat, x: number, y: number, rx: number, ry: number, rot: number, a0: number, a1: number, ccw = false) {
    if (!finite(x, y, rx, ry, rot, a0, a1)) return;
    if (rx < 0 || ry < 0) throw new RangeError("The radius provided is negative.");
    const sweep = arcSweep(a0, a1, ccw);
    const cr = Math.cos(rot), sr = Math.sin(rot);
    const pt = (t: number): [number, number] => {
      const ex = rx * Math.cos(t), ey = ry * Math.sin(t);
      return [x + ex * cr - ey * sr, y + ex * sr + ey * cr];
    };
    const dv = (t: number): [number, number] => {
      const ex = -rx * Math.sin(t), ey = ry * Math.cos(t);
      return [ex * cr - ey * sr, ex * sr + ey * cr];
    };
    const s = pt(a0);
    if (this.cur) this.lineTo(m, s[0], s[1]); else this.moveTo(m, s[0], s[1]);
    if (sweep === 0) return;
    const n = Math.max(1, Math.ceil(Math.abs(sweep) / (Math.PI / 2) - 1e-9));
    const step = sweep / n, k = (4 / 3) * Math.tan(step / 4);
    let t = a0;
    for (let i = 0; i < n; i++) {
      const t1 = t + step;
      const p0 = pt(t), p3 = pt(t1), d0 = dv(t), d1 = dv(t1);
      this.bezierCurveTo(m, p0[0] + k * d0[0], p0[1] + k * d0[1], p3[0] - k * d1[0], p3[1] - k * d1[1], p3[0], p3[1]);
      t = t1;
    }
  }
  arcTo(m: Mat, x1: number, y1: number, x2: number, y2: number, r: number) {
    if (!finite(x1, y1, x2, y2, r)) return;
    if (r < 0) throw new RangeError("The radius provided is negative.");
    const p0 = this.currentIn(m);
    if (!p0) { this.moveTo(m, x1, y1); return; }
    const [x0, y0] = p0;
    const v1x = x0 - x1, v1y = y0 - y1, v2x = x2 - x1, v2y = y2 - y1;
    const l1 = Math.hypot(v1x, v1y), l2 = Math.hypot(v2x, v2y);
    const cross = v1x * v2y - v1y * v2x;
    if (l1 === 0 || l2 === 0 || r === 0 || Math.abs(cross) < 1e-9 * l1 * l2) { this.lineTo(m, x1, y1); return; }
    const cos = (v1x * v2x + v1y * v2y) / (l1 * l2);
    const half = Math.acos(Math.max(-1, Math.min(1, cos))) / 2;
    const dist = r / Math.tan(half);
    const t1x = x1 + (v1x / l1) * dist, t1y = y1 + (v1y / l1) * dist;
    const t2x = x1 + (v2x / l2) * dist, t2y = y1 + (v2y / l2) * dist;
    // Centre: from the first tangent point, along the normal on v2's side.
    const nx = cross > 0 ? -v1y / l1 : v1y / l1, ny = cross > 0 ? v1x / l1 : -v1x / l1;
    const cx = t1x + nx * r, cy = t1y + ny * r;
    const a0 = Math.atan2(t1y - cy, t1x - cx), a1 = Math.atan2(t2y - cy, t2x - cx);
    // The short way round from one tangent point to the other.
    let d = (a1 - a0) % TAU; if (d < 0) d += TAU;
    this.lineTo(m, t1x, t1y);
    this.ellipse(m, cx, cy, r, r, 0, a0, a1, d > Math.PI);
  }
  roundRect(m: Mat, x: number, y: number, w: number, h: number, radii: number | DOMPointLike | (number | DOMPointLike)[] = 0) {
    if (!finite(x, y, w, h)) return;
    const list = Array.isArray(radii) ? radii : [radii];
    if (list.length < 1 || list.length > 4) throw new RangeError("roundRect: 1 to 4 radii");
    const rr = list.map((v) => (typeof v === "number" ? { x: v, y: v } : { x: v.x ?? 0, y: v.y ?? 0 }));
    for (const v of rr) if (v.x < 0 || v.y < 0) throw new RangeError("roundRect: negative radius");
    // CSS order: [all] | [tl+br, tr+bl] | [tl, tr+bl, br] | [tl, tr, br, bl]
    let tl, tr, br, bl;
    if (rr.length === 1) tl = tr = br = bl = rr[0];
    else if (rr.length === 2) { tl = br = rr[0]; tr = bl = rr[1]; }
    else if (rr.length === 3) { tl = rr[0]; tr = bl = rr[1]; br = rr[2]; }
    else [tl, tr, br, bl] = rr;
    // A negative width or height flips the rectangle (and which corner is which).
    if (w < 0) { x += w; w = -w; [tl, tr, br, bl] = [tr, tl, bl, br]; }
    if (h < 0) { y += h; h = -h; [tl, tr, br, bl] = [bl, br, tr, tl]; }
    // Radii too big for the sides are all scaled down together.
    const f = Math.min(1,
      w / (tl.x + tr.x || 1), w / (bl.x + br.x || 1), h / (tl.y + bl.y || 1), h / (tr.y + br.y || 1));
    const s = (v: { x: number; y: number }) => ({ x: v.x * f, y: v.y * f });
    [tl, tr, br, bl] = [s(tl), s(tr), s(br), s(bl)];
    this.moveTo(m, x + tl.x, y);
    this.lineTo(m, x + w - tr.x, y);
    if (tr.x && tr.y) this.ellipse(m, x + w - tr.x, y + tr.y, tr.x, tr.y, 0, -Math.PI / 2, 0);
    this.lineTo(m, x + w, y + h - br.y);
    if (br.x && br.y) this.ellipse(m, x + w - br.x, y + h - br.y, br.x, br.y, 0, 0, Math.PI / 2);
    this.lineTo(m, x + bl.x, y + h);
    if (bl.x && bl.y) this.ellipse(m, x + bl.x, y + h - bl.y, bl.x, bl.y, 0, Math.PI / 2, Math.PI);
    this.lineTo(m, x, y + tl.y);
    if (tl.x && tl.y) this.ellipse(m, x + tl.x, y + tl.y, tl.x, tl.y, 0, Math.PI, Math.PI * 1.5);
    this.closePath();
    this.moveTo(m, x, y);
  }
}

export interface DOMPointLike { x?: number; y?: number }

/** How far an arc turns, the browser's way (radians, + = clockwise on screen). */
export function arcSweep(a0: number, a1: number, ccw: boolean): number {
  if (!ccw && a1 - a0 >= TAU) return TAU;
  if (ccw && a0 - a1 >= TAU) return -TAU;
  if (!ccw) { let d = (a1 - a0) % TAU; if (d < 0) d += TAU; return d; }
  let d = (a0 - a1) % TAU; if (d < 0) d += TAU; return -d;
}

/** The same commands with every point put through `m`. */
export function transformCmds(cmds: Cmd[], m: Mat): Cmd[] {
  const t = (x: number, y: number) => apply(m, x, y);
  return cmds.map((c): Cmd => {
    switch (c.k) {
      case "M": case "L": return { k: c.k, p: t(c.p[0], c.p[1]) };
      case "Q": { const a = t(c.p[0], c.p[1]), b = t(c.p[2], c.p[3]); return { k: "Q", p: [a[0], a[1], b[0], b[1]] }; }
      case "C": { const a = t(c.p[0], c.p[1]), b = t(c.p[2], c.p[3]), d = t(c.p[4], c.p[5]); return { k: "C", p: [a[0], a[1], b[0], b[1], d[0], d[1]] }; }
      default: return c;
    }
  });
}

function finite(...v: number[]) { for (const n of v) if (!Number.isFinite(n)) return false; return true; }
