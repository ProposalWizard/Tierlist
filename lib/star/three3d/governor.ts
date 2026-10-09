/**
 * THE 3D QUALITY GOVERNOR (Harry, 9 Oct 2026, on his iPhone: "the 3D and even
 * the Style Testing areas are struggling on phone to even play at times,
 * needs serious fixing").
 *
 * One shared rule for every 3D scene: watch the real time between drawn
 * frames, and
 *   - if the middle frame (the median) is slower than the budget (about
 *     22 ms at 60 a second, under ~45 fps) for 2.5 s, step DOWN one rung;
 *   - if frames hold the full rate for 15 s, step back UP one rung — never
 *     above where the scene started, and never again once it has bounced
 *     (dropped within 20 s of a step up).
 *
 * Harry, 9 Oct 2026: "I don't want our solution to bad lag to just be make
 * the game look worse." So a phone opens on Medium exactly as built (rung 1)
 * and stays there while it keeps up. Only a phone that cannot is stepped
 * down: first the MOVING picture's pixels (never under 1.5; a still frame
 * stays full), and only then, as an emergency, one light post pass and blob
 * shadows for the people, then no live shadows or post at all.
 *
 * Pure, no three.js: the scenes read `rung` and change their own renderer
 * (pixel ratio, shadow map, post) in `onChange`. Tested in
 * tests/star/perf3d.mts (the stepping).
 *
 * The scene also asks `shouldDraw(now, still)` each rAF tick: false while the
 * tab is hidden, the scene is paused (a menu over it), or — on a still screen
 * — more often than 20 times a second.
 */
import type { Quality3d } from "./quality";

export type GovShadows = "full" | "lite" | "off";
export type GovPost = "full" | "lite" | "off";

export interface GovRung {
  /** The tier this rung belongs to (what the frame meter shows). */
  tier: Quality3d;
  /** The most pixels per screen point the MOVING picture may draw at this rung (still frames keep the scene's own). */
  pixelRatio: number;
  /** full: the scene's own; lite: one smaller map, players near the camera only; off: no live shadow map. */
  shadows: GovShadows;
  /** full: the scene's own pass; lite: one combined pass; off: none. */
  post: GovPost;
}

export const GOV_LADDER: readonly GovRung[] = [
  // High, as built
  { tier: "high", pixelRatio: 2, shadows: "full", post: "full" },
  // Medium, as built: a phone opens here and, if it keeps up, never moves
  { tier: "medium", pixelRatio: 2, shadows: "full", post: "full" },
  // the moving picture may drop to 1.5 px (never lower; a still frame stays full)
  { tier: "medium", pixelRatio: 1.5, shadows: "full", post: "full" },
  // emergency only (a phone still under ~45 fps): one light pass, a smaller sun map, people on blob shadows
  { tier: "low", pixelRatio: 1.5, shadows: "lite", post: "lite" },
  { tier: "low", pixelRatio: 1.5, shadows: "off", post: "off" },
];

/** The rung a scene opens at for a tier. */
export function rungForTier(t: Quality3d): number {
  return t === "high" ? 0 : t === "medium" ? 1 : 3;
}

export interface GovernorOptions {
  /** The tier the scene opens at (Settings, else Auto). */
  start: Quality3d;
  /** A name for the frame meter ("garden", "real game"). */
  name?: string;
  /** Called after the rung changes (also once from apply()). */
  onChange?: (rung: GovRung, index: number, why: "down" | "up" | "start") => void;
  /** Never step (the harness, ?gov=0). */
  frozen?: boolean;
  /** Seconds of slow frames before a step down (default 2.5). */
  slowSeconds?: number;
  /** Seconds of full-rate frames before a step up (default 15). */
  fastSeconds?: number;
  /** A clock for tests. */
  now?: () => number;
}

/** A drawn frame: when, and its gap over the slow budget / the full-rate mark at the cap it aimed for. */
interface Sample { t: number; slow: number; fast: number }

const median = (a: number[]) => {
  if (!a.length) return 0;
  const s = a.slice().sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
};

export class Governor {
  readonly name: string;
  readonly startIndex: number;
  index: number;
  private samples: Sample[] = [];
  private lastFrame = -1;
  private lastDraw = -1e9;
  private cooldownUntil = -1e9;
  private lastUpAt = -1e9;
  private bounced = false;
  private paused = new Set<string>();
  private frozen: boolean;
  /** Steps taken, for the meter and tests. */
  downs = 0;
  ups = 0;
  /** The last median gap over the slow budget (over 1 = slow). */
  lastMedian = 0;
  /** Anything the scene wants the frame meter to show (casters, skinned, passes). */
  stats: Record<string, number | string> = {};

  constructor(private o: GovernorOptions) {
    this.name = o.name ?? "3d";
    this.startIndex = rungForTier(o.start);
    this.index = this.startIndex;
    this.frozen = !!o.frozen || governorFrozenByUrl();
    register(this);
  }

  get rung(): GovRung { return GOV_LADDER[this.index]; }
  get tier(): Quality3d { return this.rung.tier; }

  /** Tell the scene the starting rung (call once after building). */
  apply() { this.o.onChange?.(this.rung, this.index, "start"); }

  /** Pause drawing for a reason (a menu over the scene); `false` lifts it. */
  setPaused(reason: string, on: boolean) {
    if (on) this.paused.add(reason); else this.paused.delete(reason);
    this.lastFrame = -1; // the gap across a pause is not a slow frame
  }
  get isPaused() { return this.paused.size > 0 || (typeof document !== "undefined" && document.hidden); }

  /**
   * Should this rAF tick draw? False while paused or hidden; on a still
   * screen (nothing moving but idle sway) at most `stillFps` a second.
   */
  shouldDraw(now: number, still = false, stillFps = 20): boolean {
    if (this.isPaused) return false;
    if (still && now - this.lastDraw < 1000 / stillFps - 2) return false;
    this.lastDraw = now;
    return true;
  }

  /**
   * Once per drawn frame. `cap` is the rate the scene is aiming for this
   * frame (60, or 30/20 while it throttles itself), so a capped scene never
   * reads as slow. Returns true when the rung changed this frame.
   */
  frame(now: number, cap = 60): boolean {
    const prev = this.lastFrame;
    this.lastFrame = now;
    if (prev < 0) return false;
    const ms = now - prev;
    if (ms <= 0) return false;
    if (ms > 250) { this.samples.length = 0; return false; } // a pause, a hidden tab, a load
    // judged against the rate the scene aimed for at that frame (a capped scene is not slow)
    this.samples.push({ t: now, slow: ms / Math.max(22, (1000 / cap) * 1.35), fast: ms / ((1000 / cap) * 1.12) });
    const keep = Math.max(this.o.fastSeconds ?? 15, this.o.slowSeconds ?? 2.5) * 1000;
    while (this.samples.length && now - this.samples[0].t > keep) this.samples.shift();
    if (this.frozen || now < this.cooldownUntil) return false;
    const slowWin = (this.o.slowSeconds ?? 2.5) * 1000;
    const recent = this.samples.filter((s) => now - s.t <= slowWin);
    if (recent.length >= 4 && now - recent[0].t >= slowWin * 0.9) {
      const m = median(recent.map((s) => s.slow));
      this.lastMedian = m;
      if (m > 1 && this.index < GOV_LADDER.length - 1) return this.step(+1, now);
    }
    const fastWin = (this.o.fastSeconds ?? 15) * 1000;
    if (!this.bounced && this.index > this.startIndex && this.samples.length >= 8 && now - this.samples[0].t >= fastWin * 0.95) {
      const m = median(this.samples.map((s) => s.fast));
      if (m <= 1) return this.step(-1, now);
    }
    return false;
  }

  /** Force a rung (the Test Area; tests). */
  set(index: number) {
    const i = Math.max(0, Math.min(GOV_LADDER.length - 1, index));
    if (i === this.index) return;
    const why = i > this.index ? "down" : "up";
    this.index = i;
    this.o.onChange?.(this.rung, this.index, why);
  }

  private step(dir: 1 | -1, now: number): boolean {
    if (dir > 0) {
      if (now - this.lastUpAt < 20000) this.bounced = true;
      this.downs++;
    } else {
      this.ups++;
      this.lastUpAt = now;
    }
    this.index += dir;
    this.samples.length = 0;
    this.cooldownUntil = now + 3000; // judge the new rung on its own frames
    this.o.onChange?.(this.rung, this.index, dir > 0 ? "down" : "up");
    return true;
  }

  dispose() { unregister(this); }
}

/** ?gov=0 on any page: the governor never steps (measuring a fixed tier). */
export function governorFrozenByUrl(): boolean {
  if (typeof window === "undefined") return false;
  try { return new URLSearchParams(window.location.search).get("gov") === "0"; } catch { return false; }
}

// ── the live governors, for the frame meter ──
const live: Governor[] = [];
function register(g: Governor) { live.push(g); }
function unregister(g: Governor) { const i = live.indexOf(g); if (i >= 0) live.splice(i, 1); }
/** The newest live governor (the scene on screen). */
export function currentGovernor(): Governor | null { return live.length ? live[live.length - 1] : null; }

/** A pixel ratio a scene wants, capped by the rung (never above the screen's own). */
export function governedPixelRatio(want: number, rung: GovRung, dpr: number): number {
  return Math.min(want, dpr, Math.max(1.5, rung.pixelRatio));
}
