/**
 * THE 3D BENCH — the same ten shots, every time (3D plan step 1, Harry 20 Oct
 * 2026: "Fixing skin and light is very big"). Every later 3D step shows its
 * before and after on these shots, so nobody argues from different stills.
 *
 * Each shot is an existing 3D page at a fixed moment, at phone size
 * (390 × 844). The bench page (/star-3d-bench-dev) shows one at a time with
 * its frame numbers; scripts/bench3d/shots.mts takes every still and measures
 * the skin (through the skin probe, lib/star/style3d/toon/shader.ts TOON_SKIN)
 * and the frame time. `?skinfix=0` on a shot's address shows the old skin.
 */
export interface Bench3dShot {
  id: string;
  /** What it is, in the words on the bench page. */
  label: string;
  /** The page (same site), without ?fps=1 (added by the bench). */
  url: string;
  /** A cut scene: the second to stop at (window.__frameStep.seek). */
  t?: number;
  /** A live place: how long to let it settle before a still (ms). */
  settle?: number;
  kind: "home" | "cut" | "place" | "drill";
}

const cut = (q: string) => `/star-3d-bench-dev/scene?scene=director&${q}&clean=1`;

export const BENCH3D_SHOTS: Bench3dShot[] = [
  { id: "home", label: "Home player", url: "/star-3d-bench-dev/home", settle: 6000, kind: "home" },
  { id: "signing", label: "Signing: his close-up", url: cut("fixture=signing"), t: 10.1, kind: "cut" },
  { id: "office", label: "Manager's office", url: "/star-3d-area-dev/office", settle: 9000, kind: "place" },
  { id: "press", label: "Press conference", url: cut("fixture=press"), t: 6.7, kind: "cut" },
  { id: "trophy", label: "Trophy lift", url: cut("fixture=trophy"), t: 4.1, kind: "cut" },
  { id: "walkout", label: "Walk-out", url: cut("fixture=walkout"), t: 2.3, kind: "cut" },
  { id: "garden", label: "Garden", url: "/star-garden3d-dev", settle: 12000, kind: "place" },
  { id: "drill", label: "Training drill (Free Roam)", url: "/star-3d-bench-dev/scene?scene=play3d&clean=1", settle: 9000, kind: "drill" },
  { id: "gen-goal", label: "Made-up scene: a goal", url: cut("event=scored&stakes=0.8&emotion=joy&seed=3"), t: 7.1, kind: "cut" },
  { id: "gen-trophy", label: "Made-up scene: a trophy", url: cut("event=won-trophy&stakes=0.9&emotion=joy&seed=5"), t: 5.0, kind: "cut" },
];

/**
 * The shot's address with the frame meter on. `old`: the shot as it was on 19 Oct 2026, for a
 * before still — the old skin (?skinfix=0), the old cut-scene cameras (?framing=old) and painted
 * faces that never move (?face=old). (The Home player's new life has no switch: its before is a still.)
 */
export function benchUrl(s: Bench3dShot, o: { old?: boolean } = {}): string {
  const q = [s.t !== undefined ? `t=${s.t}` : "", "fps=1", o.old ? "skinfix=0&framing=old&face=old" : ""].filter(Boolean).join("&");
  return `${s.url}${s.url.includes("?") ? "&" : "?"}${q}`;
}
