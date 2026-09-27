/**
 * tests/star/goalOnLine.mts — the gallery, its editor and Infinite
 * Highlights draw the goal where the real match draws it (v0.15, item 1).
 *
 * Harry, playtesting the gallery: it "puts the goal a little bit more forward
 * than it should be". The pictures drew the small-sided goal flat, with its
 * posts running 1.2 m FORWARD onto the pitch from the goal line, so he placed
 * keepers where the posts ended. They now call the match's own goal drawing
 * (lib/star/matchGoal.ts — CanvasMatch calls the same function): posts
 * standing UP from the line, net behind it.
 *
 * Checked by painting real pictures onto a canvas that records every line it
 * is asked to draw. Permanent (Harry, v0.15): the Play Area's old "Goal in
 * pictures" switch is gone, and a device that still has it saved as Old gets
 * the new goal anyway.
 *
 * Run: npx tsx tests/star/goalOnLine.mts
 */
import { buildScenario, type ScenarioKind } from "../../lib/star/canvasEngine";
import { mulberry32 } from "../../lib/star/season";
import { frameFromScenario, frameScreen, frameCssSize, paint, type Frame } from "../../lib/star/scenarioFrame";
import { POST_L, POST_R, GOAL_H } from "../../lib/star/pitch";

let failed = 0;
const ok = (c: boolean, what: string) => { if (!c) { failed++; console.error(`  FAIL ${what}`); } else console.log(`  ✓ ${what}`); };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const g = globalThis as any;
const setOff = (names: string[]) => {
  // A test screen (the gallery), so saved Play Area switches WOULD be read.
  g.window = names.length ? { location: { pathname: "/star-gallery-dev" }, localStorage: { getItem: (k: string) => (names.includes(k.replace("star-compare-", "")) ? "off" : null), setItem() {}, removeItem() {} } } : undefined;
};

/** A 2D context that records the points of every path, and does nothing else. */
function recordingCanvas() {
  const pts: { x: number; y: number }[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stub: any = new Proxy(function () { /* */ }, { get: () => stub, apply: () => stub });
  const state: Record<string | symbol, unknown> = {};
  const ctx = new Proxy(state, {
    get(t, prop) {
      if (prop in t) return t[prop];
      if (prop === "moveTo" || prop === "lineTo") return (x: number, y: number) => { pts.push({ x, y }); };
      if (prop === "measureText") return () => ({ width: 10, actualBoundingBoxAscent: 5, actualBoundingBoxDescent: 1 });
      return () => stub;
    },
    set(t, prop, v) { t[prop] = v; return true; },
  });
  const canvas = { width: 0, height: 0, style: {} as Record<string, string>, getContext: () => ctx };
  return { canvas, pts };
}

const has = (pts: { x: number; y: number }[], p: { x: number; y: number }, eps = 0.01) =>
  pts.some((q) => Math.abs(q.x - p.x) < eps && Math.abs(q.y - p.y) < eps);

function check(kind: ScenarioKind, seed: number) {
  const f: Frame = frameFromScenario(buildScenario(kind, mulberry32(seed)));
  const { cssW, cssH } = frameCssSize(f, {});
  const scr = frameScreen(f, cssW, cssH);
  const foot = scr.toScreen({ x: POST_L, y: 0 });                // the left post on the line
  const stub = scr.toScreen({ x: POST_L, y: 1.2 });              // where the old post ended, on the pitch
  const top = { x: foot.x, y: foot.y - GOAL_H * (cssH / (f.camera.y2 - f.camera.y1)) }; // the match's crossbar end
  const lineR = scr.toScreen({ x: POST_R, y: 0 });

  setOff([]);
  const now = recordingCanvas();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  paint(now.canvas as any, f);
  setOff(["goalOnLine"]);
  const old = recordingCanvas();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  paint(old.canvas as any, f);
  setOff([]);
  return {
    ok: has(now.pts, foot) && has(now.pts, lineR) && has(now.pts, top) && !has(now.pts, stub),
    retiredSwitchIgnored: has(old.pts, foot) && has(old.pts, top) && !has(old.pts, stub),
    forwardPx: stub.y - foot.y,
  };
}

console.log("\nTHE PICTURE'S GOAL STANDS ON THE LINE, LIKE THE MATCH'S");
for (const kind of ["penalty", "one_on_one", "tight_angle", "cutback", "long_range", "free_kick"] as ScenarioKind[]) {
  let good = 0, ignored = 0, fwd = 0;
  const n = 20;
  for (let i = 0; i < n; i++) {
    const r = check(kind, 11 + i * 97);
    if (r.ok) good++;
    if (r.retiredSwitchIgnored) ignored++;
    fwd = r.forwardPx;
  }
  ok(good === n, `${kind}: posts stand on the line and go up to the bar, none on the pitch in front (${good}/${n})`);
  ok(ignored === n, `${kind}: a device still saved on the retired "Goal in pictures: Old" gets the new goal too — the old one put its posts ${fwd.toFixed(1)} px onto the pitch (${ignored}/${n})`);
}

console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
