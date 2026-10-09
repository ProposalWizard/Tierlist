/**
 * A SIGNATURE from a name — the path the pen's tip really follows on the
 * contract. Pure: strokes of points in a 300 × 60 box (x right, y down), the
 * pen lifted between strokes. The same name always signs the same way.
 *
 * Shape: a tall looped capital, the rest of the name as a fast cursive run
 * (one loop or hump per letter, shrinking to the right), the surname's
 * capital crossed into it, then an underline flourish and a dot.
 */
import { hashStr, rng } from "./math";

export type Stroke = [number, number][];

export interface Signature {
  strokes: Stroke[];
  /** Cumulative length at the end of each stroke (for ink and timing). */
  lengths: number[];
  total: number;
}

export function makeSignature(name: string): Signature {
  const clean = (name || "Player").replace(/[^A-Za-z ]/g, "").trim() || "Player";
  const parts = clean.split(/\s+/);
  const first = parts[0], last = parts.length > 1 ? parts[parts.length - 1] : "";
  const R = rng(hashStr(clean));
  const strokes: Stroke[] = [];

  // 1. The first capital: up, a loop over the top, down past the baseline.
  const cap = (x0: number, h: number, w: number): Stroke => {
    const pts: Stroke = [];
    const n = 28;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2.1;
      const x = x0 + Math.sin(a) * w * 0.5 + (i / n) * w * 0.55;
      const y = 40 - h * 0.5 - Math.cos(a) * h * 0.5 + (i / n) * 8;
      pts.push([x, y]);
    }
    return pts;
  };
  // 2. A cursive run: humps and loops along the baseline, getting smaller.
  const run = (x0: number, letters: number, startFrom: [number, number] | null): Stroke => {
    const pts: Stroke = startFrom ? [startFrom] : [];
    const step = Math.min(18, 150 / Math.max(3, letters));
    let x = x0;
    for (let i = 0; i < letters; i++) {
      const tall = R.chance(0.28);
      const loop = R.chance(0.35);
      const hgt = (tall ? 26 : 13) * (1 - i / (letters * 2.2)) * R.range(0.85, 1.15);
      const n = 10;
      for (let j = 1; j <= n; j++) {
        const k = j / n;
        const a = k * Math.PI;
        const lx = loop ? Math.sin(a * 2) * step * 0.22 : 0;
        pts.push([x + k * step + lx, 44 - Math.sin(a) * hgt]);
      }
      x += step;
    }
    return pts;
  };

  const capH = R.range(42, 52), capW = R.range(22, 30);
  const s1 = cap(12, capH, capW);
  const firstLetters = Math.min(6, Math.max(2, first.length - 1));
  const r1 = run(s1[s1.length - 1][0], firstLetters, s1[s1.length - 1]);
  strokes.push([...s1, ...r1.slice(1)]);
  let xEnd = r1[r1.length - 1][0];
  if (last) {
    const s2 = cap(xEnd + 10, capH * 0.92, capW * 0.85);
    const r2 = run(s2[s2.length - 1][0], Math.min(9, Math.max(3, last.length - 1)), s2[s2.length - 1]);
    strokes.push([...s2, ...r2.slice(1)]);
    xEnd = r2[r2.length - 1][0];
  }
  // 3. The flourish: back under the name, a little upswing at the end.
  const fl: Stroke = [];
  const fx0 = Math.min(xEnd, 286), fx1 = R.range(14, 30);
  for (let i = 0; i <= 18; i++) {
    const k = i / 18;
    fl.push([fx0 - (fx0 - fx1) * k, 54 + Math.sin(k * Math.PI) * 3 - k * k * 4]);
  }
  strokes.push(fl);
  // 4. A dot.
  const dx = R.range(70, 140);
  strokes.push([[dx, 14], [dx + 1.5, 13.4], [dx + 2.2, 14.6]]);

  // squeeze into the box
  const all = strokes.flat();
  const minX = Math.min(...all.map((p) => p[0])), maxX = Math.max(...all.map((p) => p[0]));
  const minY = Math.min(...all.map((p) => p[1])), maxY = Math.max(...all.map((p) => p[1]));
  const sx = Math.min(1, 292 / Math.max(1, maxX - minX)), sy = Math.min(1, 56 / Math.max(1, maxY - minY));
  const fit = strokes.map((s) => s.map(([x, y]) => [4 + (x - minX) * sx, 2 + (y - minY) * sy] as [number, number]));
  const lengths: number[] = [];
  let total = 0;
  for (const s of fit) {
    for (let i = 1; i < s.length; i++) total += Math.hypot(s[i][0] - s[i - 1][0], s[i][1] - s[i - 1][1]);
    lengths.push(total);
  }
  return { strokes: fit, lengths, total };
}

/**
 * Where the pen is `u` (0..1) of the way through signing, by time: strokes
 * take time by their length, and each lift between strokes takes `liftFrac`
 * of the whole. Returns the point, whether the pen is down, and how much
 * ink is on the paper (0..1 of the total length).
 */
export function signatureAt(sig: Signature, u: number, liftFrac = 0.06): { x: number; y: number; down: boolean; ink: number; lift: number } {
  const n = sig.strokes.length;
  const lifts = Math.max(0, n - 1);
  const writeFrac = 1 - lifts * liftFrac;
  const uu = Math.max(0, Math.min(1, u));
  let tcur = 0;
  for (let i = 0; i < n; i++) {
    const startLen = i === 0 ? 0 : sig.lengths[i - 1];
    const sLen = sig.lengths[i] - startLen;
    const dur = (sLen / sig.total) * writeFrac;
    if (uu <= tcur + dur || (i === n - 1)) {
      const k = dur > 0 ? Math.min(1, (uu - tcur) / dur) : 1;
      const p = along(sig.strokes[i], k);
      return { x: p[0], y: p[1], down: true, ink: (startLen + sLen * k) / sig.total, lift: 0 };
    }
    tcur += dur;
    if (i < n - 1) {
      if (uu <= tcur + liftFrac) {
        const k = (uu - tcur) / liftFrac;
        const a = sig.strokes[i][sig.strokes[i].length - 1], b = sig.strokes[i + 1][0];
        return { x: a[0] + (b[0] - a[0]) * k, y: a[1] + (b[1] - a[1]) * k, down: false, ink: sig.lengths[i] / sig.total, lift: Math.sin(k * Math.PI) };
      }
      tcur += liftFrac;
    }
  }
  const last = sig.strokes[n - 1];
  const p = last[last.length - 1];
  return { x: p[0], y: p[1], down: true, ink: 1, lift: 0 };
}

function along(s: Stroke, k: number): [number, number] {
  if (s.length === 1) return s[0];
  let tot = 0;
  const seg: number[] = [];
  for (let i = 1; i < s.length; i++) { const d = Math.hypot(s[i][0] - s[i - 1][0], s[i][1] - s[i - 1][1]); seg.push(d); tot += d; }
  let want = k * tot;
  for (let i = 0; i < seg.length; i++) {
    if (want <= seg[i] || i === seg.length - 1) {
      const f = seg[i] > 0 ? Math.min(1, want / seg[i]) : 0;
      return [s[i][0] + (s[i + 1][0] - s[i][0]) * f, s[i][1] + (s[i + 1][1] - s[i][1]) * f];
    }
    want -= seg[i];
  }
  return s[s.length - 1];
}
