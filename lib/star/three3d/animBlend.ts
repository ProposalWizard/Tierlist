/**
 * CLEAN ANIMATION BLENDING (Harry, 9 Oct 2026: "The animations are a bit
 * wild and rough … I want animations clean in every mode").
 *
 * Pure maths, no three.js: the shared clip player (footballAnims.ts
 * ClipPlayer) and the garden/shop/house legs (gaitBlend.ts GaitBlend) run on
 * it, so every 3D mode blends the same way. Tested in tests/star/animSmooth.mts.
 *
 *   FadeWeights  every clip change fades from the pose he is in NOW. A second
 *                change inside a fade never drops the older clip to nothing in
 *                one frame (that was the "pop"): every clip still showing is
 *                scaled down together while the new one comes up. Weights
 *                always add up to 1, so he never sags towards the bind pose.
 *   locoWeights  walk / jog / run / sprint picked by his real speed as a
 *                smooth mix of the two loops either side of it. No gait is
 *                "chosen", so there is nothing to flicker between.
 *   LocoPhase    all the loops share one stride clock, each started at its own
 *                left-foot moment, and the clock runs at ground speed ÷ the
 *                mixed stride length. The feet keep pace with the ground at
 *                any speed and any mix (no foot slide), and a change of loop
 *                keeps the same foot down.
 *   smoothYaw    turns ease in and out (a spring with a top turn speed), so a
 *                sudden new facing never snaps the body round in one frame.
 */

/** The shortest fade any clip change gets, seconds (a 1-frame swap reads as a pop). */
export const MIN_FADE = 0.08;
/** A clip under this weight is gone. */
const GONE = 1e-3;

/**
 * Weights for any number of clips, keyed by anything (the clip player keys
 * them by action). `to(key)` brings that clip up to 1 over `fade` seconds,
 * starting from whatever weight it has now; every other clip shares what is
 * left, in the same proportions it had. Interrupting a fade is smooth by
 * construction: nothing is reset, the newest clip simply starts rising.
 */
export class FadeWeights<K> {
  private w = new Map<K, number>();
  current: K | null = null;
  private rate = Infinity;

  /** Bring `key` up to full over `fade` s (never less than MIN_FADE unless nothing is showing yet). */
  to(key: K, fade: number) {
    if (this.w.size === 0 || (this.w.size === 1 && this.w.has(key))) {
      // nothing else on screen: start fully in it
      this.w.clear(); this.w.set(key, 1); this.current = key; this.rate = Infinity;
      return;
    }
    this.current = key;
    if (!this.w.has(key)) this.w.set(key, 0);
    this.rate = 1 / Math.max(MIN_FADE, fade);
  }

  /** Move the weights on by dt seconds. Returns the keys that just dropped out (set their weight to 0). */
  step(dt: number): K[] {
    const gone: K[] = [];
    const c = this.current;
    if (c === null) return gone;
    let wc = this.w.get(c) ?? 0;
    if (wc < 1) wc = Math.min(1, wc + Math.max(0, dt) * this.rate);
    this.w.set(c, wc);
    let rest = 0;
    this.w.forEach((v, k) => { if (k !== c) rest += v; });
    const scale = rest > 0 ? (1 - wc) / rest : 0;
    this.w.forEach((v, k) => {
      if (k === c) return;
      const nv = v * scale;
      if (nv < GONE) { this.w.delete(k); gone.push(k); } else this.w.set(k, nv);
    });
    // the dropped crumbs go to the current clip, so the sum stays 1
    if (gone.length) { let s = 0; this.w.forEach((v) => (s += v)); if (s > 0 && Math.abs(s - 1) > 1e-9) this.w.forEach((v, k) => this.w.set(k, v / s)); }
    return gone;
  }

  get(key: K): number { return this.w.get(key) ?? 0; }
  has(key: K): boolean { return this.w.has(key); }
  keys(): K[] { return [...this.w.keys()]; }
  entries(): [K, number][] { return [...this.w.entries()]; }
  /** Rename a key, keeping its weight (a clip handed over to a stand-in). */
  rekey(from: K, to: K) {
    const v = this.w.get(from);
    if (v === undefined) return;
    this.w.delete(from);
    this.w.set(to, (this.w.get(to) ?? 0) + v);
    if (this.current === from) this.current = to;
  }
  /** Is anything still fading? */
  fading(): boolean { return this.w.size > 1; }
}

// ── Locomotion ──────────────────────────────────────────────────────────────

/** One moving loop: its own ground speed (m/s at timeScale 1, this body's size), length (s) and left-foot moment (s). */
export interface LocoLoop { speed: number; dur: number; mark: number }

/** Below this share of the walk's own speed he is partly standing (the idle mixes in). */
export const WALK_FULL = 0.55;
/** A loop's cadence is never pushed outside this range of its own (the mix takes the rest). */
export const CADENCE_MIN = 0.45, CADENCE_MAX = 1.75;

/**
 * The idle's weight and each loop's weight for a ground speed. `loops` are
 * sorted slowest first. `top` (optional): the fastest loop allowed (e.g. the
 * sprint only while the sprint button is held); past it that loop stays full.
 */
export function locoWeights(speed: number, loops: { speed: number }[], top = loops.length - 1, band = LOCO_BAND): { idle: number; w: number[] } {
  const n = loops.length, w = new Array<number>(n).fill(0);
  if (!n) return { idle: 1, w };
  const v = Math.max(0, speed);
  const walkFull = loops[0].speed * WALK_FULL;
  if (v <= 1e-4) return { idle: 1, w };
  if (v < walkFull) { const t = smooth01(v / walkFull); w[0] = t; return { idle: 1 - t, w }; }
  const last = Math.max(0, Math.min(n - 1, top));
  let i = 0;
  while (i < last && v >= loops[i + 1].speed) i++;
  if (i >= last) { w[last] = 1; return { idle: 0, w }; }
  const a = loops[i].speed, b = loops[i + 1].speed;
  // each loop plays alone (sped up or slowed) over most of the gap; the two
  // only share the weight in a band round the middle (their geometric mean),
  // where both are equally far off their own speed. Mixing two different
  // gaits over a wide range is what makes the planted foot drift.
  const c = Math.sqrt(a * b);
  const lo = Math.max(a, c * (1 - band)), hi = Math.min(b, c * (1 + band));
  const t = hi > lo ? smooth01((v - lo) / (hi - lo)) : v >= c ? 1 : 0;
  w[i] = 1 - t; w[i + 1] = t;
  return { idle: 0, w };
}

/** Half-width of the mixing band between two loops, as a share of their middle speed. */
export const LOCO_BAND = 0.04;

const smooth01 = (x: number) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };

/**
 * One shared stride clock for every moving loop. `phase` runs 0..1 per stride
 * (left-foot moment to left-foot moment). Each loop's time is its own mark
 * plus phase × its length, so all of them have the same foot down together.
 */
export class LocoPhase {
  phase = 0;

  /** Where loop `l` is in its own clip at the current phase. */
  timeOf(l: LocoLoop): number {
    return ((l.mark + this.phase * l.dur) % l.dur + l.dur) % l.dur;
  }

  /** Put the clock where loop `l` is (taking over from a loop played on its own). */
  syncTo(l: LocoLoop, time: number) {
    this.phase = ((((time - l.mark) / l.dur) % 1) + 1) % 1;
  }

  /**
   * Move the clock on. `speed` m/s on the ground, `w` each loop's weight
   * (the idle's share counts as no stride). Returns strides per second.
   */
  step(dt: number, speed: number, loops: LocoLoop[], w: number[]): number {
    let stride = 0, cadence = 0, moving = 0;
    for (let i = 0; i < loops.length; i++) {
      if (!(w[i] > 0)) continue;
      stride += w[i] * loops[i].speed * loops[i].dur;
      cadence += w[i] / loops[i].dur;
      moving += w[i];
    }
    if (moving <= 1e-6) return 0;
    const own = cadence / moving;
    let rate = stride > 1e-6 ? Math.max(0, speed) / stride : own;
    rate = Math.max(own * CADENCE_MIN, Math.min(own * CADENCE_MAX, rate));
    this.phase = (this.phase + rate * Math.max(0, dt)) % 1;
    return rate;
  }
}

/** Low-pass a value towards a target with time constant tau (s). */
export function ease(cur: number, target: number, dt: number, tau: number): number {
  if (!(tau > 0)) return target;
  return cur + (target - cur) * (1 - Math.exp(-Math.max(0, dt) / tau));
}

// ── Turning ──────────────────────────────────────────────────────────────────

export const angDiff = (a: number, b: number) => {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
};

/** A body's shown facing that turns with weight. `vel` rad/s is kept on the state. */
export interface YawState { yaw: number; vel: number }
export const TURN = {
  /** How quickly a turn settles, s (critically damped spring). */
  settle: 0.11,
  /** Top turn speed, rad/s (about two full turns a second). */
  maxRate: 13,
  /** Further off than this and he is just put there (a reset, a teleport). */
  snapOver: Math.PI * 0.98,
};

/**
 * Ease a shown facing towards the game's facing: a critically damped spring
 * (no overshoot) with a top turn speed. `settle` overrides TURN.settle (a
 * strike that must face the ball turns quicker). Returns the new yaw.
 */
export function smoothYaw(s: YawState, target: number, dt: number, settle = TURN.settle): number {
  if (!(dt > 0)) return s.yaw;
  const d = angDiff(s.yaw, target);
  if (Math.abs(d) >= TURN.snapOver) { s.yaw = target; s.vel = 0; return s.yaw; }
  const w = 2 / Math.max(1e-3, settle);
  // critically damped: x'' = w²·d − 2w·x'
  const h = 1 / 60;
  let left = dt;
  while (left > 1e-9) {
    const st = Math.min(h, left);
    const dd = angDiff(s.yaw, target);
    s.vel += (w * w * dd - 2 * w * s.vel) * st;
    s.vel = Math.max(-TURN.maxRate, Math.min(TURN.maxRate, s.vel));
    s.yaw += s.vel * st;
    left -= st;
  }
  return s.yaw;
}
