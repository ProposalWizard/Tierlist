// Summarise scripts/camera/landing-probe.mjs output: per kind, how far the
// frame at control (after a build-up) is from the chance's own no-build-up
// frame (the still), and the jump at the hand-over.
//
//   node scripts/camera/landing-report.mjs <probe.json> [--rows]
import fs from "node:fs";

const [file, flag] = process.argv.slice(2);
const { rows } = JSON.parse(fs.readFileSync(file, "utf8"));
const W = (v, facing) => (facing && facing !== "up" ? v.y2 - v.y1 : v.x2 - v.x1);
const per = {};
for (const r of rows) {
  if (!r.build || !r.ctrl) continue;
  // A build-up that ends in a called offside has no chance after it (the match stays on its own camera).
  if (r.ctrl.phase === "result") { (per[r.kind] ??= { n: 0, zoom: 0, centre: 0, jump: 0, jumpPct: 0, fig: [], facing: 0, offside: 0, widths: [] }).offside++; continue; }
  const s = r.still.cam, c = r.ctrl.cam, box = r.ctrl.box;
  const across = W(c, r.ctrl.facing), pxPerM = box.w / across;
  const zoomPct = Math.abs(W(s, r.still.facing) / across - 1) * 100;
  const centrePx = Math.hypot((s.x1 + s.x2) / 2 - (c.x1 + c.x2) / 2, (s.y1 + s.y2) / 2 - (c.y1 + c.y2) / 2) * pxPerM;
  const jumpPx = r.last ? Math.hypot((r.last.cam.x1 + r.last.cam.x2) / 2 - (r.first.cam.x1 + r.first.cam.x2) / 2, (r.last.cam.y1 + r.last.cam.y2) / 2 - (r.first.cam.y1 + r.first.cam.y2) / 2) * pxPerM : 0;
  const jumpPct = r.last ? Math.abs(W(r.last.cam, r.last.facing) / W(r.first.cam, r.first.facing) - 1) * 100 : 0;
  const k = (per[r.kind] ??= { n: 0, zoom: 0, centre: 0, jump: 0, jumpPct: 0, fig: [], facing: 0, offside: 0, widths: [] });
  k.widths.push(W(s, r.still.facing));
  k.n++; k.zoom = Math.max(k.zoom, zoomPct); k.centre = Math.max(k.centre, centrePx);
  k.jump = Math.max(k.jump, jumpPx); k.jumpPct = Math.max(k.jumpPct, jumpPct); k.fig.push(r.ctrl.figPx);
  if ((r.still.facing || "up") !== (r.ctrl.facing || "up")) k.facing++;
  if (flag === "--rows") console.log(`${r.kind} #${r.seed}: zoom ${zoomPct.toFixed(1)}% centre ${centrePx.toFixed(1)}px jump ${jumpPx.toFixed(1)}px/${jumpPct.toFixed(1)}% men ${r.ctrl.figPx.toFixed(1)}px facing ${r.still.facing}->${r.ctrl.facing}`);
}
console.log("kind            n  offside   zoom max   centre max   hand-over jump   men px (min-max)   facing differs   frame width across chances (m)");
for (const [kind, k] of Object.entries(per)) {
  console.log(`${kind.padEnd(14)} ${String(k.n).padStart(3)}  ${String(k.offside).padStart(7)}   ${k.zoom.toFixed(2).padStart(6)}%   ${k.centre.toFixed(1).padStart(7)} px   ${k.jump.toFixed(1).padStart(5)} px ${k.jumpPct.toFixed(1).padStart(5)}%   ${k.fig.length ? Math.min(...k.fig).toFixed(1) + "-" + Math.max(...k.fig).toFixed(1) : "-"}   ${String(k.facing).padStart(3)}              ${k.widths.length ? Math.min(...k.widths).toFixed(1) + "-" + Math.max(...k.widths).toFixed(1) : "-"}`);
}
