/**
 * AUTOMATIC RESOLUTION FOR ANDROID PHONES (27 Nov 2026, Harry: "no lag for me on my iPhone 16 … but
 * Mikey gets loads of lag in the garden … he's on an S20").
 *
 * One number for the whole page: the share of the capped pixel ratio a 3D place draws at (1 = all of
 * it). It moves on real frame times, measured by every scene's governor (governor.ts feeds it):
 *   - down FAST: the middle frame slower than the scene's own aim for 1.2 s → 12% fewer pixels a side;
 *   - up SLOWLY: 6 s at the full rate (19 frames in 20 at full rate) → 6% more, never above 1;
 *   - no flicker: 1.5 s between steps, and a step up that has to come straight back down (within
 *     8 s) is not tried again for 30 s.
 * Never under `floor` (the device's own minimum, 1 pixel per point). It never switches 3D off: the
 * governor's rungs (shadows, post) only come after the pixels.
 *
 * Pure, no three.js: perf.ts applies the scale to the one shared renderer (applyPixelCap).
 * Off on Apple and desktop (DeviceCaps.scaled false): those look exactly as before.
 * Tested in tests/star/recover3d.mts.
 */
export interface ResScaleOptions {
  /** The lowest scale (min pixel ratio / capped pixel ratio). */
  floor?: number;
  downSeconds?: number;
  upSeconds?: number;
}

export const RES_STEP_DOWN = 0.88;
export const RES_STEP_UP = 1.06;

export class ResolutionScaler {
  scale = 1;
  floor: number;
  downs = 0;
  ups = 0;
  private samples: { t: number; slow: number; fast: number }[] = [];
  private last = -1;
  private cooldownUntil = -1e9;
  private lastUpAt = -1e9;
  private noUpUntil = -1e9;
  private listeners = new Set<(s: number) => void>();

  constructor(private o: ResScaleOptions = {}) { this.floor = o.floor ?? 0.67; }

  onChange(f: (s: number) => void) { this.listeners.add(f); return () => { this.listeners.delete(f); }; }

  /** Forget the window (a new place opened, a pause). Keeps the scale: the next place starts where this phone settled. */
  reset() { this.samples.length = 0; this.last = -1; }

  /** One drawn frame of the scene on screen: its gap `ms` and the rate it aimed for (`cap`). True when the scale changed. */
  frame(now: number, ms: number, cap = 60): boolean {
    if (ms <= 0 || ms > 250) { this.samples.length = 0; return false; }
    const aim = 1000 / cap;
    this.samples.push({ t: now, slow: ms / Math.max(22, aim * 1.35), fast: ms / (aim * 1.12) });
    const keep = Math.max(this.o.upSeconds ?? 6, this.o.downSeconds ?? 1.2) * 1000;
    while (this.samples.length && now - this.samples[0].t > keep) this.samples.shift();
    if (now < this.cooldownUntil) return false;
    const downWin = (this.o.downSeconds ?? 1.2) * 1000;
    const recent = this.samples.filter((s) => now - s.t <= downWin);
    if (recent.length >= 4 && now - recent[0].t >= downWin * 0.85 && median(recent.map((s) => s.slow)) > 1 && this.scale > this.floor + 1e-3) {
      if (now - this.lastUpAt < 8000) this.noUpUntil = now + 30000;
      return this.set(Math.max(this.floor, this.scale * RES_STEP_DOWN), now, -1);
    }
    const upWin = (this.o.upSeconds ?? 6) * 1000;
    if (this.scale < 1 && now >= this.noUpUntil && this.samples.length >= 8 && now - this.samples[0].t >= upWin * 0.95 && pct(this.samples.map((s) => s.fast), 0.95) <= 1) {
      this.lastUpAt = now;
      return this.set(Math.min(1, this.scale * RES_STEP_UP), now, 1);
    }
    return false;
  }

  private set(v: number, now: number, dir: 1 | -1): boolean {
    const r = Math.round(v * 1000) / 1000;
    if (r === this.scale) return false;
    this.scale = r;
    if (dir < 0) this.downs++; else this.ups++;
    this.samples.length = 0;
    this.cooldownUntil = now + 1500;
    this.listeners.forEach((f) => f(r));
    return true;
  }
}

function pct(a: number[], p: number) { const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))] ?? 0; }
function median(a: number[]) { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)] ?? 0; }

/** The page's one scaler (perf.ts listens; governor.ts feeds it while `active`). */
export const resScale = new ResolutionScaler();
/** Fed only on devices that scale (Android and other non-Apple phones); perf.ts turns it on. */
export const resScaleState = { active: false };

/**
 * The pixel ratio a place actually gets: what it asked for, capped for the device, times the scale,
 * never under the device's minimum (or what it asked for, if that is lower).
 */
export function cappedPixelRatio(want: number, cap: number, min: number, scale: number): number {
  const top = Math.min(want, cap);
  return Math.max(Math.min(top, min), Math.round(top * scale * 100) / 100);
}
