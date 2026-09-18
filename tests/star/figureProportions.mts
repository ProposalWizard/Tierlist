/**
 * HOW MUCH OF A FOOTBALLER IS HIS HEAD.
 *
 * Every real graphics bug in this game has been found by looking at a rendered
 * frame, and this one was no exception — the product owner said the figures
 * read as bowling pins. But the CAUSE is arithmetic, and arithmetic can be
 * pinned, which is what this file is for: so that nobody can quietly put the
 * head back by changing a constant that looks harmless on its own.
 *
 * The trap is `drawPlayerHead`, which multiplies the radius it is handed by
 * the Face Editor's own `scale` — 2.2 by default. A caller reading its own
 * source sees `r * 0.26` and thinks a quarter; what lands is 0.572r. Every
 * figure that has ever gone wrong here went wrong that way.
 *
 * Measured, not asserted from a comment: the old main-match numbers are
 * recomputed below from the same anatomy the old code used, so the "before"
 * in the report is a calculation rather than a recollection.
 */
import { DEFAULT_FACE_STYLE } from "../../lib/star/faceStyle.ts";
import { FIGURE_HEIGHT_R, FIGURE_HEAD_R } from "../../lib/star/fiveASide/render.ts";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  if (!ok) { failures++; console.log(`FAIL  ${name} ${detail}`); }
  else console.log(`PASS  ${name} ${detail}`);
}

const { scale, offsetY } = DEFAULT_FACE_STYLE;

/**
 * What a figure actually measures, given the anatomy its own code uses.
 *
 *  - `feetY`     local y of the boots, below the body origin
 *  - `headAt`    local y handed to drawPlayerHead
 *  - `headBase`  the radius handed to drawPlayerHead, BEFORE it scales it
 *
 * all in units of the figure's own r. Returns head-diameter-over-height.
 */
function proportions(feetY: number, headAt: number, headBase: number) {
  const drawnR = headBase * scale;
  const headCentre = headAt + offsetY * headBase;
  const crown = headCentre - drawnR;
  const height = feetY - crown;
  return { height, head: drawnR * 2, ratio: (drawnR * 2) / height };
}

// ── Before: what the main match drew ──
//
// footballer(): translate(px, py - r*0.8), legs run from hipY = r*0.18 down
// r*0.62, and drawPlayerHead(ctx, 0, -r*0.76, r*0.26, r, ...).
const oldOutfielder = proportions(0.80, -0.76, 0.26);
// The keeper: translate(px, py - KR*0.8), legs to KR*0.76, and
// drawPlayerHead(ctx, 0, -KR*0.70, KR*0.28, KR, ...).
const oldKeeper = proportions(0.76, -0.70, 0.28);

console.log(`  before: outfielder head ${(oldOutfielder.ratio * 100).toFixed(1)}% of a figure ${oldOutfielder.height.toFixed(3)}r tall`);
console.log(`  before: keeper     head ${(oldKeeper.ratio * 100).toFixed(1)}% of a figure ${oldKeeper.height.toFixed(3)}r tall`);

check("the old main-match figure really was mostly head",
  oldOutfielder.ratio > 0.4 && oldKeeper.ratio > 0.4,
  `(${(oldOutfielder.ratio * 100).toFixed(1)}% / ${(oldKeeper.ratio * 100).toFixed(1)}%)`);

// ── After: the shared anatomy both now draw ──
const ratio = FIGURE_HEAD_R / FIGURE_HEIGHT_R;
console.log(`  after:  head ${(ratio * 100).toFixed(1)}% of a figure ${FIGURE_HEIGHT_R.toFixed(3)}r tall`);

check("a head is about a quarter of a footballer, not half of him",
  ratio > 0.24 && ratio < 0.30, `(${(ratio * 100).toFixed(1)}%)`);

// The exported constants are what CanvasMatch sizes its figures against, so
// they have to be the real measurement rather than a stale note. Recompute
// them from render.ts's own anatomy numbers and check they agree.
const measured = proportions(0.26, -1.184, 0.114);
check("FIGURE_HEIGHT_R matches the anatomy it describes",
  Math.abs(measured.height - FIGURE_HEIGHT_R) < 0.01,
  `(${measured.height.toFixed(3)} vs ${FIGURE_HEIGHT_R})`);
check("FIGURE_HEAD_R matches the anatomy it describes",
  Math.abs(measured.head - FIGURE_HEAD_R) < 0.01,
  `(${measured.head.toFixed(3)} vs ${FIGURE_HEAD_R})`);

// ── The main match keeps its height ──
//
// Deliberate: the shared renderer draws a life-size 1.95 m man, this camera
// has always drawn larger-than-life ones, and shrinking every player by a
// third is a legibility change rather than a cosmetic one. FIGURE_HEIGHT_PX_PER_R
// in CanvasMatch.tsx is the old drawn height, so the figures stay put.
const CANVAS_MATCH_HEIGHT_PX_PER_R = 2.509;
check("CanvasMatch's height constant is the old figure's real height",
  Math.abs(CANVAS_MATCH_HEIGHT_PX_PER_R - oldOutfielder.height) < 0.005,
  `(${oldOutfielder.height.toFixed(3)})`);

// …and the body therefore grows by about as much as the head shrinks.
const rNew = CANVAS_MATCH_HEIGHT_PX_PER_R / FIGURE_HEIGHT_R;
const headBefore = oldOutfielder.head;
const headAfter = FIGURE_HEAD_R * rNew;
const bodyBefore = oldOutfielder.height - headBefore;
const bodyAfter = CANVAS_MATCH_HEIGHT_PX_PER_R - headAfter;
console.log(`  head ${headBefore.toFixed(3)}r → ${headAfter.toFixed(3)}r, body ${bodyBefore.toFixed(3)}r → ${bodyAfter.toFixed(3)}r (old r)`);
check("the head shrinks and the body grows into the space",
  headAfter < headBefore * 0.65 && bodyAfter > bodyBefore * 1.2);

if (failures) { console.log(`\n${failures} FAILED`); process.exit(1); }
console.log("\nfigure proportions OK");
