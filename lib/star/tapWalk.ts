/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * TAP TO MOVE — for the 3D garden and the 3D shop (Harry, 5 Oct 2026: "Can we
 * also make a tap to move mechanic on phone along with the joystick").
 *
 * Tap the ground and your player walks there; tap something you can use and
 * he walks up to it, so its card appears. The walk goes round things (a grid
 * path over the same no-walk boxes and circles the joystick bumps into), and
 * the scene still moves him with its own walk/jog animation and collisions:
 * this file only says which way to face and how fast to go.
 *
 * Pure maths plus one small marker ring; three.js is passed in.
 */

export type XZ = [number, number];

/** Which places on the floor can be stood on, on a square grid. */
export interface WalkGrid {
  x0: number; z0: number; cell: number; nx: number; nz: number;
  free: Uint8Array;
}

export function buildGrid(x0: number, x1: number, z0: number, z1: number, cell: number, isFree: (x: number, z: number) => boolean): WalkGrid {
  const nx = Math.max(1, Math.ceil((x1 - x0) / cell)), nz = Math.max(1, Math.ceil((z1 - z0) / cell));
  const free = new Uint8Array(nx * nz);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) free[j * nx + i] = isFree(x0 + (i + 0.5) * cell, z0 + (j + 0.5) * cell) ? 1 : 0;
  return { x0, z0, cell, nx, nz, free };
}

const cellOf = (g: WalkGrid, x: number, z: number): [number, number] =>
  [Math.max(0, Math.min(g.nx - 1, Math.floor((x - g.x0) / g.cell))), Math.max(0, Math.min(g.nz - 1, Math.floor((z - g.z0) / g.cell)))];
const centre = (g: WalkGrid, i: number, j: number): XZ => [g.x0 + (i + 0.5) * g.cell, g.z0 + (j + 0.5) * g.cell];
export const freeAt = (g: WalkGrid, x: number, z: number) => {
  const i = Math.floor((x - g.x0) / g.cell), j = Math.floor((z - g.z0) / g.cell);
  return i >= 0 && j >= 0 && i < g.nx && j < g.nz && g.free[j * g.nx + i] === 1;
};

/** The nearest free cell to (x, z), searching outwards up to `maxR` metres. */
export function nearestFree(g: WalkGrid, x: number, z: number, maxR = 3): XZ | null {
  if (freeAt(g, x, z)) return [x, z];
  const [ci, cj] = cellOf(g, x, z);
  const R = Math.ceil(maxR / g.cell);
  let best: XZ | null = null, bd = Infinity;
  for (let dj = -R; dj <= R; dj++) for (let di = -R; di <= R; di++) {
    const i = ci + di, j = cj + dj;
    if (i < 0 || j < 0 || i >= g.nx || j >= g.nz || !g.free[j * g.nx + i]) continue;
    const [cx, cz] = centre(g, i, j);
    const d = Math.hypot(cx - x, cz - z);
    if (d < bd && d <= maxR) { bd = d; best = [cx, cz]; }
  }
  return best;
}

/** Can he walk straight from a to b (every point on the way free)? */
export function clearLine(g: WalkGrid, a: XZ, b: XZ): boolean {
  const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const n = Math.max(1, Math.ceil(d / (g.cell * 0.4)));
  for (let k = 1; k < n; k++) {
    const t = k / n;
    if (!freeAt(g, a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)) return false;
  }
  return true;
}

/**
 * The way from `from` to `to`, round anything in between: a list of points to
 * walk through (not including `from`), or null if there is no way. `to` that
 * is inside something moves to the nearest place he can stand.
 */
export function findPath(g: WalkGrid, from: XZ, to: XZ): XZ[] | null {
  const goal = nearestFree(g, to[0], to[1]);
  if (!goal) return null;
  if (clearLine(g, from, goal)) return [goal];
  const start = freeAt(g, from[0], from[1]) ? from : nearestFree(g, from[0], from[1], 1.5) ?? from;
  const [si, sj] = cellOf(g, start[0], start[1]);
  const [gi, gj] = cellOf(g, goal[0], goal[1]);
  const N = g.nx * g.nz;
  const cost = new Float32Array(N).fill(Infinity);
  const prev = new Int32Array(N).fill(-1);
  const shut = new Uint8Array(N);
  // a small binary heap of [f, index]
  const hf: number[] = [], hi: number[] = [];
  const push = (f: number, i: number) => {
    let k = hf.length; hf.push(f); hi.push(i);
    while (k > 0) { const p = (k - 1) >> 1; if (hf[p] <= hf[k]) break; [hf[p], hf[k]] = [hf[k], hf[p]]; [hi[p], hi[k]] = [hi[k], hi[p]]; k = p; }
  };
  const pop = () => {
    const top = hi[0];
    const lf = hf.pop()!, li = hi.pop()!;
    if (hf.length) {
      hf[0] = lf; hi[0] = li;
      let k = 0;
      for (;;) {
        const l = k * 2 + 1, r = l + 1;
        let m = k;
        if (l < hf.length && hf[l] < hf[m]) m = l;
        if (r < hf.length && hf[r] < hf[m]) m = r;
        if (m === k) break;
        [hf[m], hf[k]] = [hf[k], hf[m]]; [hi[m], hi[k]] = [hi[k], hi[m]]; k = m;
      }
    }
    return top;
  };
  const h = (i: number, j: number) => { const dx = Math.abs(i - gi), dz = Math.abs(j - gj); return Math.max(dx, dz) + 0.4142 * Math.min(dx, dz); };
  const s = sj * g.nx + si, e = gj * g.nx + gi;
  cost[s] = 0;
  push(h(si, sj), s);
  let found = false;
  while (hf.length) {
    const c = pop();
    if (shut[c]) continue;
    shut[c] = 1;
    if (c === e) { found = true; break; }
    const ci = c % g.nx, cj = (c / g.nx) | 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const i = ci + di, j = cj + dj;
      if (i < 0 || j < 0 || i >= g.nx || j >= g.nz) continue;
      const n = j * g.nx + i;
      if (!g.free[n] || shut[n]) continue;
      // no cutting a corner past something solid
      if (di && dj && (!g.free[cj * g.nx + i] || !g.free[j * g.nx + ci])) continue;
      const nc = cost[c] + (di && dj ? 1.4142 : 1);
      if (nc < cost[n]) { cost[n] = nc; prev[n] = c; push(nc + h(i, j), n); }
    }
  }
  if (!found) return null;
  const cells: XZ[] = [];
  for (let c = e; c !== -1 && c !== s; c = prev[c]) cells.push(centre(g, c % g.nx, (c / g.nx) | 0));
  cells.reverse();
  cells[cells.length - 1] = goal;
  // pull the string tight: skip every point he can walk past in a straight line
  const out: XZ[] = [];
  let at: XZ = from;
  let k = 0;
  while (k < cells.length) {
    let far = k;
    for (let m = cells.length - 1; m > k; m--) if (clearLine(g, at, cells[m])) { far = m; break; }
    out.push(cells[far]);
    at = cells[far];
    k = far + 1;
  }
  return out;
}

/** A trip longer than this (metres) jogs a little faster than the stick's top speed. */
export const TAP_LONG = 5;
/** A trip shorter than this is a walk; anything longer is a jog. */
export const TAP_SHORT = 1.5;
/** The push on a long trip. Over 1 = past the stick at full tilt (the scenes
 *  turn push into speed with the same line as the stick, so 1.05 is about
 *  0.4 m/s quicker than the stick's jog). */
export const TAP_PUSH_LONG = 1.05;

/**
 * Follows a path: each frame, which way to face and how hard to push (0..1
 * like the stick, a little over 1 on a long trip). It gives up if he stops
 * getting anywhere (something moved into the way), and calls `onArrive` at
 * the end.
 */
export class TapWalker {
  path: XZ[] = [];
  active = false;
  run = false;
  private onArrive: (() => void) | null = null;
  private best = Infinity;
  private stuck = 0;
  /** Where he should look once there (a thing he walked up to), if anything. */
  face: XZ | null = null;

  go(path: XZ[], opts: { run?: boolean; face?: XZ | null; onArrive?: () => void } = {}) {
    this.path = path.slice();
    this.active = path.length > 0;
    this.run = !!opts.run;
    this.face = opts.face ?? null;
    this.onArrive = opts.onArrive ?? null;
    this.best = Infinity;
    this.stuck = 0;
  }
  cancel() { this.active = false; this.path = []; this.onArrive = null; this.face = null; }
  get goal(): XZ | null { return this.path.length ? this.path[this.path.length - 1] : null; }

  /** One frame. Returns the yaw to face and the push, or null when done. */
  step(x: number, z: number, dt: number): { yaw: number; push: number } | null {
    if (!this.active) return null;
    while (this.path.length > 1 && Math.hypot(this.path[0][0] - x, this.path[0][1] - z) < 0.45) this.path.shift();
    const [tx, tz] = this.path[0];
    const last = this.path.length === 1;
    const d = Math.hypot(tx - x, tz - z);
    if (last && d < 0.18) {
      const cb = this.onArrive;
      this.active = false; this.path = []; this.onArrive = null;
      cb?.();
      return null;
    }
    // stuck: no nearer the end for a second and a half
    const left = d + this.restLength();
    if (left < this.best - 0.05) { this.best = left; this.stuck = 0; } else if ((this.stuck += dt) > 1.5) { this.cancel(); return null; }
    const rest = this.restLength() + d;
    // Harry, 7 Oct 2026 (iPhone): "tap to walk is too slow". A jog for any
    // real trip, a touch quicker than the stick at full tilt on a long one;
    // a walk only for a step or two. Eases off over the last metre or so.
    const cruise = this.run || rest > TAP_LONG ? TAP_PUSH_LONG : rest > TAP_SHORT ? 1 : 0.7;
    const push = last ? Math.min(cruise, 0.3 + d * 0.6) : cruise;
    return { yaw: Math.atan2(tx - x, tz - z), push };
  }
  private restLength() {
    let s = 0;
    for (let i = 1; i < this.path.length; i++) s += Math.hypot(this.path[i][0] - this.path[i - 1][0], this.path[i][1] - this.path[i - 1][1]);
    return s;
  }
}

/** The ring on the floor where you tapped: it pulses, then fades on arrival. */
export function makeTapMarker(THREE: any, parent: any, colour = "#facc15") {
  const mat = new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: 0, depthWrite: false, toneMapped: false, fog: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.3, 40), mat);
  ring.rotation.x = -Math.PI / 2;
  ring.renderOrder = 2;
  ring.visible = false;
  parent.add(ring);
  const dot = new THREE.Mesh(new THREE.CircleGeometry(0.07, 20), mat);
  dot.rotation.x = -Math.PI / 2;
  dot.renderOrder = 2;
  dot.visible = false;
  parent.add(dot);
  let t = 0, fading = false;
  return {
    show(x: number, z: number, y = 0.04) {
      ring.position.set(x, y, z); dot.position.set(x, y, z);
      ring.visible = dot.visible = true;
      t = 0; fading = false;
      mat.opacity = 0.95;
    },
    fade() { fading = true; },
    hide() { ring.visible = dot.visible = false; },
    get visible() { return ring.visible; },
    update(dt: number) {
      if (!ring.visible) return;
      t += dt;
      if (fading) {
        mat.opacity = Math.max(0, mat.opacity - dt * 2.5);
        ring.scale.setScalar(ring.scale.x + dt * 1.2);
        if (mat.opacity <= 0) ring.visible = dot.visible = false;
      } else {
        // a quick pop in, then a slow pulse
        const s = t < 0.18 ? 0.4 + (t / 0.18) * 0.8 : 1 + 0.12 * Math.sin((t - 0.18) * 6);
        ring.scale.setScalar(s);
      }
    },
    dispose() { parent.remove(ring); parent.remove(dot); ring.geometry.dispose(); dot.geometry.dispose(); mat.dispose(); },
  };
}
