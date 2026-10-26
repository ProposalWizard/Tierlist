/**
 * Does a build-up's joiner (its covering defender, LeadIn.joiners) change the
 * chance's frame when the chance is re-framed with him in it? (25 Oct 2026,
 * the build-up landing review.)
 *
 *   npx tsx scripts/camera/joiner-frame.mts [chances=600]
 *
 * For every served chance whose build-up brings a joiner: the chance's frame
 * (matchStill) without him, and with him standing on his end spot. Prints how
 * many frames change and the largest zoom / centre change on a phone canvas.
 */
import { forceFhrMode } from "../../lib/star/fhr/toggle";
import { forceChancesMode } from "../../lib/star/newChances";
import { servedChances } from "../../lib/star/fhr/servedChances";
import { matchStill } from "../../lib/star/fhr/stillCamera";
import { fhrBuildUpOn } from "../../lib/star/fhr/builders";
import type { Scenario } from "../../lib/star/canvasEngine";

const N = Number(process.argv[2] ?? 600);
const W = 366, HW = 744 / 366;
forceFhrMode("on"); forceChancesMode("new");
let withJoiner = 0, changed = 0, worstZoom = 0, worstPx = 0;
const byKind: Record<string, { n: number; changed: number }> = {};
for (const c of servedChances({ count: N, seed: 41 })) {
  const sc0 = JSON.parse(JSON.stringify(c.sc)) as Scenario;
  const chance = matchStill(sc0, HW, 20).frame.camera;
  const lead = fhrBuildUpOn(JSON.parse(JSON.stringify(sc0)), { ...c.moment, fresh: true, frame: chance });
  if (!lead?.joiners?.length || lead.offside) continue;
  withJoiner++;
  const k = (byKind[sc0.kind] ??= { n: 0, changed: 0 });
  k.n++;
  const sc1 = JSON.parse(JSON.stringify(sc0)) as Scenario;
  for (const j of lead.joiners) sc1.defenders.push({ x: j.end.x, y: j.end.y, homeX: j.end.x, homeY: j.end.y, containT: 0, speed: 1, role: "cover", baseRole: "cover" });
  const f1 = matchStill(sc1, HW, 20).frame.camera;
  const zoom = Math.abs((f1.x2 - f1.x1) / (chance.x2 - chance.x1) - 1) * 100;
  const px = Math.hypot((f1.x1 + f1.x2 - chance.x1 - chance.x2) / 2, (f1.y1 + f1.y2 - chance.y1 - chance.y2) / 2) * W / (f1.x2 - f1.x1);
  if (zoom > 0.01 || px > 0.1) { changed++; k.changed++; }
  worstZoom = Math.max(worstZoom, zoom); worstPx = Math.max(worstPx, px);
}
forceFhrMode(null); forceChancesMode(null);
console.log(`${withJoiner} build-ups bring a joiner; framing with him in changes the chance's frame on ${changed} (worst ${worstZoom.toFixed(2)}% zoom, ${worstPx.toFixed(1)} px)`);
for (const [k, v] of Object.entries(byKind)) console.log(`  ${k.padEnd(13)} ${v.changed}/${v.n}`);
