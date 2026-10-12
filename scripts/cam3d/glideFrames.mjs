// Adds the glide's moments for every corner / byline cross in chances.json (from frames.mts): the
// ball in flight part-way through the glide, and landed (the glide done). The frame's clock is held
// (tHold, scripts/perf3d/entry.ts) so the camera is caught part-way. stills.mjs plays `seq` in order.
// Usage: node scripts/cam3d/glideFrames.mjs DIR [--at=0.5]
import fs from "node:fs";
const dir = process.argv[2];
const at = +(process.argv.find((a) => a.startsWith("--at="))?.slice(5) ?? 0.5);
const GLIDE_S = 0.42; // match2dCam.ts CORNER_CAM.glideS
const file = `${dir}/raw/chances.json`;
const list = JSON.parse(fs.readFileSync(file, "utf8"));
const out = [];
for (const c of list) {
  out.push(c);
  if (c.frame.kind !== "corner" && c.frame.kind !== "byline_cross") continue;
  const f = c.frame, b = f.ball;
  const land = { x: 34 + (b.x < 34 ? -2 : 2), y: 9 }; // a cross to the penalty spot area, far side of it
  const mid = (u) => ({ ...b, x: b.x + (land.x - b.x) * u, y: b.y + (land.y - b.y) * u, z: 0.11 + 7 * u * (1 - u) * 4 * 0.5, vx: (land.x - b.x) / 1.2, vy: (land.y - b.y) / 1.2, vz: 0, live: true });
  const flight = (u, t) => ({ ...f, phase: "flight", ball: mid(u), landing: land, aim: null, tHold: t });
  // the first struck frame starts the glide at t = 100; the next frame is `at` of the glide in
  out.push({ name: `${c.name}-flight`, label: `${c.label}, in flight (${Math.round(at * 100)}% of the ${GLIDE_S} s glide)`, frame: f, seq: [flight(0.15, 100), flight(0.4, 100 + at * GLIDE_S)] });
  out.push({ name: `${c.name}-landed`, label: `${c.label}, landing (glide done)`, frame: f, seq: [flight(0.15, 100), flight(0.95, 102)] });
}
fs.writeFileSync(file, JSON.stringify(out));
console.log(out.map((c) => c.name).join("\n"));
