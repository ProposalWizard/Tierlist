// For served chances: where the 2D puts the ball and the taker on the phone, vs the 3D default camera
// (the 2D frame solve, × OPEN_DEFAULT_K, then keepDragRoom). Usage: npx tsx scripts/cam3d/framingDiag.mts
import { cleanServed, SERVED_KINDS } from "./served.mts";
import { solveMatch2D, pitchTo2dScreen, keepDragRoom, usesSetPieceCam, usesCornerCam } from "../../lib/star/style3d/match2dCam";
import { bcProject } from "../../lib/star/style3d/broadcastCam";

const W = 372, H = 704;
const pct = (v: number) => `${(v * 100).toFixed(0)}%`;
for (const kind of SERVED_KINDS) {
  if (usesSetPieceCam(kind) || usesCornerCam(kind)) continue;
  for (const c of cleanServed(kind, 2)) {
    if (!c.drawn) continue;
    const you = c.figs.find((g) => g.sid === "you")!;
    const b2 = pitchTo2dScreen(c.f, c.sc.ball), y2 = pitchTo2dScreen(c.f, you);
    const wide = solveMatch2D(c.f);
    const def = { ...wide, D: wide.D * 0.85 };
    const room = keepDragRoom(def, c.sc.ball, W, H);
    const at = (cam: typeof wide, p: { x: number; y: number }) => { const r = bcProject(cam, W, H, p); return `(${pct((r.nx + 1) / 2)}, ${pct(r.fr)})`; };
    console.log(`${kind}-${c.seed}: 2D ball (${pct(b2.X / W)}, ${pct(b2.Y / H)}) taker (${pct(y2.X / W)}, ${pct(y2.Y / H)}) | 3D 2D-frame ball ${at(wide, c.sc.ball)} taker ${at(wide, you)} D ${wide.D.toFixed(0)} | ×0.85 ball ${at(def, c.sc.ball)} taker ${at(def, you)} | drag-room slide ${Math.hypot(room.tx - def.tx, room.tz - def.tz).toFixed(1)} m`);
  }
}
