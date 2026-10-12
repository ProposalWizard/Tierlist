// The 3D-only cameras (cutback side-on, tight angle behind the taker, byline cross corner glide) on
// served chances that pass their kind's rules: camera distance, a man's height at the ball in px,
// ball room above the bottom. Usage: npx tsx scripts/cam3d/kindCamProbe.mts
import { cleanServed } from "./served.mts";
import { solveKindCam, solveCornerCam, solveMatch2D, matchScale, leanedManShare, dragRoomShare } from "../../lib/star/style3d/match2dCam";
import { bcProject } from "../../lib/star/style3d/broadcastCam";

const W = 372, H = 704;
for (const kind of ["one_on_one", "cutback", "tight_angle", "byline_cross"]) {
  for (const c of cleanServed(kind, 4)) {
    const kp = { x: c.keeper.x, y: c.keeper.y };
    const b = c.sc.ball;
    const cams = kind === "one_on_one" ? { def: solveMatch2D(c.f) }
      : kind === "byline_cross" ? { start: solveCornerCam(c.f, b, c.figs, kp, matchScale(), "C"), box: solveCornerCam(c.f, b, c.figs, kp, matchScale(), "A") }
      : { def: solveKindCam(kind, c.f, b, c.figs, kp, matchScale()) };
    const wide = solveMatch2D(c.f);
    for (const [n, cam] of Object.entries(cams)) {
      const man = leanedManShare(cam, W, H, b, 1.8, 0) * H;
      const r = bcProject(cam, W, H, b);
      console.log(`${kind} seed ${c.seed} ${n}: D ${cam.D.toFixed(1)} m (2D frame ${wide.D.toFixed(1)}), ${cam.elevDeg}° fov ${cam.fov}, man ${man.toFixed(1)} px, ball at ${(r.fr * 100).toFixed(0)}% down (room ${(((1 - r.fr) - dragRoomShare(W, H)) * H).toFixed(0)} px spare)`);
    }
  }
}
