/**
 * A BUILD-UP LANDS ON THE CHANCE'S OWN FRAME (Mikey + Harry, 25 Oct 2026:
 * "we need to review the buildup/camera angles and make sure they all land on
 * the same size").
 *
 * For every kind a build-up can come before (scripts/camera/landing-measure.mts,
 * up to 8 chances a kind as the match serves them, a phone's match canvas):
 * the frame at the moment the chance is yours after its build-up is the frame
 * the same chance gets with NO build-up —
 *   zoom within 1%, centre within 2 px, men 22.2 px (±0.3) —
 * and the last build-up frame is within 1 px / 0.3% of it (no jump at the
 * hand-over). A called offside has no chance to land on and is left out.
 *
 * And in CanvasMatch itself (the browser half, measured by
 * scripts/camera/landing-probe.mjs): the hand-over puts the camera and the
 * men's size back on the chance's own (stepLeadIn), and a skip goes through
 * the same hand-over.
 */
import { readFileSync } from "node:fs";
import { landingRows, summarise, LANDING_KINDS } from "../../scripts/camera/landing-measure.mts";

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const rows = landingRows(8);
const per = summarise(rows);
for (const k of LANDING_KINDS) {
  if (k === "through_ball") continue; // served as a one-on-one once the pass is played: no build-up of its own
  const s = per[k];
  check(!!s && s.n > 0, `${k}: no build-up was measured`);
  if (!s || !s.n) continue;
  check(s.zoom <= 1, `${k}: lands ${s.zoom.toFixed(2)}% off the no-build-up zoom (≤ 1%)`);
  check(s.centre <= 2, `${k}: lands ${s.centre.toFixed(2)} px off the no-build-up centre (≤ 2 px)`);
  // Cutbacks are always side-on (26 Oct 2026) and may take a camera up to ~3%
  // wider (room to pull back, emptyGrass.mts); men are a fixed size in metres,
  // so they draw up to ~3% smaller there (21.7 px seen).
  const menLo = k === "cutback" ? 21.5 : 21.9;
  check(s.menMin >= menLo && s.menMax <= 22.5, `${k}: men ${s.menMin.toFixed(1)}-${s.menMax.toFixed(1)} px at control (22.2)`);
  check(s.menLastMin >= menLo && s.menLastMax <= 22.5, `${k}: men ${s.menLastMin.toFixed(1)}-${s.menLastMax.toFixed(1)} px on the last build-up frame (22.2)`);
  check(s.jump <= 1 && s.jumpPct <= 0.3, `${k}: the hand-over jumps ${s.jump.toFixed(2)} px / ${s.jumpPct.toFixed(2)}%`);
}

// The match's own hand-over (CanvasMatch is not importable here: read it).
const cm = readFileSync(new URL("../../components/star/CanvasMatch.tsx", import.meta.url), "utf8");
const step = cm.slice(cm.indexOf("const stepLeadIn = "), cm.indexOf("const ownMover = "));
check(/viewportRef\.current = baseViewportRef\.current;/.test(step) && /figShrinkRef\.current = figShrinkBaseRef\.current;/.test(step),
  "stepLeadIn no longer hands over onto the chance's own camera and men's size");
const skip = cm.slice(cm.indexOf("const skipLeadIn = "), cm.indexOf("// --- Main animation loop ---"));
check(/L\.t = L\.lead\.durS;/.test(skip) && /stepLeadIn\(0\)/.test(skip), "a skipped build-up no longer goes through the same hand-over");
const start = cm.slice(cm.indexOf("const startLeadIn = "), cm.indexOf("const stepLeadIn = "));
check(/frame: \{ \.\.\.baseViewportRef\.current \}/.test(start) || /moment \?\? opening/.test(start), "the build-up is no longer told the chance's own frame");
// The men a build-up adds (its covering defender) never re-frame the chance:
// measured in the real page before the fix, a resize during a build-up framed
// one with him in, up to 7.2% tighter and 48 px off (landing-probe.mjs).
check(/leadJoinersRef\.current\.add\(d\)/.test(start) && /leadJoinersRef\.current = new Set\(\)/.test(start), "startLeadIn no longer remembers the men a build-up adds");
const foc = cm.slice(cm.indexOf("const frameOnChance = "), cm.indexOf("const skipLeadIn = "));
check(/!joined\.has\(d\)/.test(foc) && /hasJoined/.test(foc) && /sc\.defenders\.push\(\.\.\.defsAll\)/.test(foc),
  "frameOnChance frames the chance with the build-up's added men in it again (or never puts them back)");
// …and that rule is not blind: with the joiner in, some chances DO frame differently.
{
  const { forceFhrMode } = await import("../../lib/star/fhr/toggle");
  const { forceChancesMode } = await import("../../lib/star/newChances");
  const { servedChances } = await import("../../lib/star/fhr/servedChances");
  const { matchStill } = await import("../../lib/star/fhr/stillCamera");
  const { fhrBuildUpOn } = await import("../../lib/star/fhr/builders");
  forceFhrMode("on"); forceChancesMode("new");
  let joins = 0, moved = 0;
  for (const c of servedChances({ count: 600, seed: 41 })) {
    const sc0 = JSON.parse(JSON.stringify(c.sc));
    const chance = matchStill(sc0, 744 / 366, 20).frame.camera;
    const lead = fhrBuildUpOn(JSON.parse(JSON.stringify(sc0)), { ...c.moment, fresh: true, frame: chance });
    if (!lead?.joiners?.length || lead.offside) continue;
    joins++;
    const sc1 = JSON.parse(JSON.stringify(sc0));
    for (const j of lead.joiners) sc1.defenders.push({ x: j.end.x, y: j.end.y, homeX: j.end.x, homeY: j.end.y, containT: 0, speed: 1, role: "cover", baseRole: "cover" });
    const f1 = matchStill(sc1, 744 / 366, 20).frame.camera;
    if (Math.abs(f1.x2 - f1.x1 - (chance.x2 - chance.x1)) > 0.01 || Math.abs(f1.y1 + f1.y2 - chance.y1 - chance.y2) > 0.02) moved++;
  }
  forceFhrMode(null); forceChancesMode(null);
  check(joins > 0 && moved > 0, `the joiner check is blind (${moved} of ${joins} chances frame differently with him in): pick more chances`);
}

console.log(problems.length ? "buildupLanding:" : `buildupLanding: ${rows.filter((r) => !r.offside).length} build-ups land on their chance's no-build-up frame (zoom ≤ 1%, centre ≤ 2 px, men 22.2 px, no hand-over jump), ${rows.filter((r) => r.offside).length} called offsides left out — all checks pass`);
for (const k of LANDING_KINDS) {
  const s = per[k];
  if (s) console.log(`  ${k.padEnd(13)} n ${String(s.n).padStart(2)}  zoom ${s.zoom.toFixed(2)}%  centre ${s.centre.toFixed(2)} px  jump ${s.jump.toFixed(2)} px  men ${s.menMin.toFixed(1)}-${s.menMax.toFixed(1)} px`);
}
if (problems.length) {
  console.log(`FAIL — ${problems.length} problem(s):`);
  for (const p of problems) console.log("  " + p);
  process.exit(1);
}
