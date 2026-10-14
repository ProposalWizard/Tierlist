/**
 * The 2D | 3D switch, many times and mid-gesture, then the 3D touch still works:
 * one set of listeners, a pull-back from the ball kicks, a swipe on the grass turns
 * the camera, a pinch zooms (Harry, 14 Oct 2026: "halfway through a game my 3d camera
 * broke, cant drag the ball back anymore and zoom/swipes mixed up").
 *
 * It needs a real browser and a running dev server, so it runs only when one is named:
 *   STAR_SWITCH3D_URL=http://localhost:3000 node scripts/run-star-tests.mjs switch3d
 * (the work is scripts/star-sandbox/switch3d.mjs). Without it, it says so and passes.
 */
import { spawnSync } from "node:child_process";

const url = process.env.STAR_SWITCH3D_URL;
if (!url) {
  console.log("skipped: set STAR_SWITCH3D_URL to a running dev server (npm run dev) to run the 2D|3D switch check");
  process.exit(0);
}
const r = spawnSync("node", ["scripts/star-sandbox/switch3d.mjs", "--url", url, "--switches", process.env.STAR_SWITCH3D_N || "10"], { stdio: "inherit", timeout: 30 * 60 * 1000 });
if (r.status !== 0) { console.error(`switch3d.mjs failed (exit ${r.status})`); process.exit(1); }
console.log("2D|3D switch check passed");
