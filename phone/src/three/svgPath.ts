/**
 * A STAND-IN SVG <path> FOR THE PHONE: `getTotalLength()` and `getPointAtLength()`.
 *
 * The website's signing scene (lib/star/signing3dScene.ts `sampleSignature`) walks the signature's path to
 * know where the pen goes: it makes an `<svg><path d=...>` and asks the browser for points along it. The phone
 * has no SVG, so ./env.ts's stand-in `document` gives the scene this element instead. It reads the commands
 * the game's signatures use (M L H V C S Q T Z, absolute and relative; no arcs) and measures along them.
 * No phone-only imports: tools/signing-check.ts runs this same file.
 */
type Pt = [number, number];

/** The path as one dense polyline (each curve cut into 24 short lines), with the running length at each point. */
export function flattenPath(d: string): { pts: Pt[]; cum: number[] } {
  const tok = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) ?? [];
  const pts: Pt[] = [];
  let i = 0, cmd = "", x = 0, y = 0, sx = 0, sy = 0, cx2 = 0, cy2 = 0, qx = 0, qy = 0, last = "";
  const num = () => Number(tok[i++]);
  const push = (px: number, py: number) => { pts.push([px, py]); };
  const cubic = (x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) => {
    for (let k = 1; k <= 24; k++) {
      const t = k / 24, u = 1 - t;
      push(u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3, u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3);
    }
  };
  const quad = (x0: number, y0: number, x1: number, y1: number, x2: number, y2: number) => {
    for (let k = 1; k <= 24; k++) {
      const t = k / 24, u = 1 - t;
      push(u * u * x0 + 2 * u * t * x1 + t * t * x2, u * u * y0 + 2 * u * t * y1 + t * t * y2);
    }
  };
  while (i < tok.length) {
    if (/^[a-zA-Z]$/.test(tok[i])) {
      cmd = tok[i++];
      if (cmd === "z" || cmd === "Z") { if (pts.length) push(sx, sy); x = sx; y = sy; last = "z"; continue; }
    }
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    const ox = rel ? x : 0, oy = rel ? y : 0;
    if (C === "M") { x = ox + num(); y = oy + num(); sx = x; sy = y; push(x, y); cmd = rel ? "l" : "L"; last = "M"; }
    else if (C === "L") { x = ox + num(); y = oy + num(); push(x, y); last = "L"; }
    else if (C === "H") { x = ox + num(); push(x, y); last = "L"; }
    else if (C === "V") { y = oy + num(); push(x, y); last = "L"; }
    else if (C === "C") {
      const x1 = ox + num(), y1 = oy + num(), x2 = ox + num(), y2 = oy + num(), x3 = ox + num(), y3 = oy + num();
      cubic(x, y, x1, y1, x2, y2, x3, y3); cx2 = x2; cy2 = y2; x = x3; y = y3; last = "C";
    } else if (C === "S") {
      const x1 = last === "C" || last === "S" ? 2 * x - cx2 : x, y1 = last === "C" || last === "S" ? 2 * y - cy2 : y;
      const x2 = ox + num(), y2 = oy + num(), x3 = ox + num(), y3 = oy + num();
      cubic(x, y, x1, y1, x2, y2, x3, y3); cx2 = x2; cy2 = y2; x = x3; y = y3; last = "S";
    } else if (C === "Q") {
      const x1 = ox + num(), y1 = oy + num(), x2 = ox + num(), y2 = oy + num();
      quad(x, y, x1, y1, x2, y2); qx = x1; qy = y1; x = x2; y = y2; last = "Q";
    } else if (C === "T") {
      const x1 = last === "Q" || last === "T" ? 2 * x - qx : x, y1 = last === "Q" || last === "T" ? 2 * y - qy : y;
      const x2 = ox + num(), y2 = oy + num();
      quad(x, y, x1, y1, x2, y2); qx = x1; qy = y1; x = x2; y = y2; last = "T";
    } else { i++; } // an arc or something unknown: skipped
  }
  const cum: number[] = [0];
  for (let k = 1; k < pts.length; k++) cum.push(cum[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
  return { pts, cum };
}

/** The point `at` units along the flattened path. */
export function pointAt(f: { pts: Pt[]; cum: number[] }, at: number): { x: number; y: number } {
  const n = f.pts.length;
  if (!n) return { x: 0, y: 0 };
  const total = f.cum[n - 1];
  const s = Math.max(0, Math.min(total, at));
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (f.cum[m] <= s) lo = m; else hi = m; }
  const seg = f.cum[hi] - f.cum[lo];
  const t = seg > 0 ? (s - f.cum[lo]) / seg : 0;
  return { x: f.pts[lo][0] + (f.pts[hi][0] - f.pts[lo][0]) * t, y: f.pts[lo][1] + (f.pts[hi][1] - f.pts[lo][1]) * t };
}

/** What `path.setAttribute("d", …)` then `getTotalLength()` / `getPointAtLength(n)` need. */
export function svgPathMethods(getD: () => string) {
  let cached: { d: string; f: ReturnType<typeof flattenPath> } | null = null;
  const flat = () => { const d = getD(); if (!cached || cached.d !== d) cached = { d, f: flattenPath(d) }; return cached.f; };
  return {
    getTotalLength: () => { const f = flat(); return f.cum.length ? f.cum[f.cum.length - 1] : 0; },
    getPointAtLength: (n: number) => pointAt(flat(), n),
  };
}
