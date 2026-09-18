/**
 * THE FIRST-PERSON FIGURE IS THE SAME MAN AS THE TRIAL'S.
 *
 * `lib/star/fiveASide/render.ts` and `lib/star/firstPersonRender.ts` draw
 * footballers for two different cameras — one flat and overhead, one a real
 * divide-by-depth perspective — so they cannot share a `drawFigure`. What they
 * CAN share is the shape, and this file is what stops that from being a claim
 * in a comment: every landmark below is checked against fiveASide's own
 * exported proportions, so moving one without the other fails here.
 *
 * It also pins the specific bug this was written for. `drawPlayerHead`
 * multiplies the radius it is handed by the Face Editor's `scale` — 2.2 by
 * default — and `firstPersonRender` used to draw its NO-PHOTO head as a plain
 * circle at that same number used as a finished radius. Two identical
 * defenders standing side by side therefore had heads 2.2x different depending
 * on whether one of them happened to have a photo on file, and the photo one
 * floated clear of its own shoulders because nothing compensated for
 * `offsetY`. Both are arithmetic, and arithmetic can be pinned.
 */
import { DEFAULT_FACE_STYLE } from "../../lib/star/faceStyle.ts";
import { FIGURE_HEIGHT_R, FIGURE_HEAD_R } from "../../lib/star/fiveASide/render.ts";
import { FP_ANATOMY, FIGURE_HEIGHT } from "../../lib/star/firstPersonRender.ts";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  if (!ok) { failures++; console.log(`FAIL  ${name} ${detail}`); }
  else console.log(`PASS  ${name} ${detail}`);
}
const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;

const A = FP_ANATOMY;
const { scale, offsetY } = DEFAULT_FACE_STYLE;

// ── The head is a quarter of a footballer, not a sixth and not a half ──
//
// `headBaseR` is UNSCALED: what lands on screen is `headBaseR * scale`.
const drawnR = A.headBaseR * scale;
const headRatio = (drawnR * 2) / A.height;
const approved = FIGURE_HEAD_R / FIGURE_HEIGHT_R;
console.log(`  head ${(headRatio * 100).toFixed(1)}% of a ${A.height} m man (approved ${(approved * 100).toFixed(1)}%)`);
check("the head matches the trial renderer's approved proportion",
  near(headRatio, approved, 0.015), `(${(headRatio * 100).toFixed(1)}% vs ${(approved * 100).toFixed(1)}%)`);

// The exact bug: a head drawn at the BASE radius instead of the drawn one is
// 2.2x too small, which is what the no-photo branch used to do. Pin the gap so
// nobody can reintroduce it by "simplifying" the two branches back together.
check("the base radius and the drawn radius are genuinely different numbers",
  drawnR > A.headBaseR * 2, `(base ${A.headBaseR.toFixed(3)} m → drawn ${drawnR.toFixed(3)} m)`);

// ── The anchor is pre-compensated, so a default head lands on the shoulders ──
//
// `drawPlayerHead` moves the head by `offsetY * headBaseR` from the point it
// is handed. Screen y grows downward and the default offsetY is negative, so
// the head ends up ABOVE the anchor: the anchor must sit below the centre by
// exactly that much or the head floats.
const landedCentre = A.headAnchorZ - offsetY * A.headBaseR;
check("the head anchor is pre-compensated for the default offsetY",
  near(landedCentre, A.headCentreZ, 1e-9),
  `(anchor ${A.headAnchorZ.toFixed(3)} + ${(-offsetY * A.headBaseR).toFixed(3)} = ${landedCentre.toFixed(3)} m)`);
check("that compensation is a real shift, not a rounding error",
  Math.abs(A.headCentreZ - A.headAnchorZ) > 0.05,
  `(${(A.headCentreZ - A.headAnchorZ).toFixed(3)} m)`);

// The head has to actually meet the body: its underside should sit at or just
// below the neck line, never hovering above it.
const chinZ = A.headCentreZ - drawnR;
check("the head's underside reaches the neck", chinZ <= A.neckZ + 0.02,
  `(chin ${chinZ.toFixed(3)} m vs neck ${A.neckZ.toFixed(3)} m)`);
check("…and does not sink into the chest", chinZ > A.shoulderZ - 0.12,
  `(chin ${chinZ.toFixed(3)} m vs shoulders ${A.shoulderZ.toFixed(3)} m)`);

// ── Every other landmark, against fiveASide's own anatomy ──
//
// fiveASide measures from the boots with −y up: a landmark at local y sits
// `(FEET_Y − y)` r above the turf, and `FIGURE_HEIGHT_R` r is the whole man.
const FEET_Y = 0.26;
const asFraction = (localY: number) => (FEET_Y - localY) / FIGURE_HEIGHT_R;
const landmarks: [string, number, number][] = [
  // name, fiveASide local y, this file's height in metres
  ["hip", -0.34, A.hipZ],
  ["shoulders", -1.00, A.shoulderZ],
  ["neck", -1.10, A.neckZ],
  ["head centre", -1.3493, A.headCentreZ],
];
for (const [name, localY, z] of landmarks) {
  const want = asFraction(localY) * A.height;
  check(`${name} sits where the trial renderer puts it`, near(z, want, 0.01),
    `(${z.toFixed(3)} m vs ${want.toFixed(3)} m)`);
}

// Shoulders genuinely wider than the waist — the taper is what stops the body
// reading as a slab, and it was 0.28 → 0.22 (barely visible) before.
const taper = A.shoulderHalf / A.waistHalf;
check("the torso really tapers", taper > 1.35 && taper < 1.6, `(${taper.toFixed(2)}x)`);
check("shoulder width matches fiveASide's 0.42r",
  near(A.shoulderHalf, (0.42 / FIGURE_HEIGHT_R) * A.height, 0.01),
  `(${A.shoulderHalf.toFixed(3)} m)`);

// `figureR` only feeds drawPlayerHead's outline thickness, which is a fraction
// of the whole figure rather than of the head — passing the head radius there
// (as this file used to) makes the outline about ten times too thin to see.
check("figureR is the whole figure, not the head",
  near(A.figureR, A.height / FIGURE_HEIGHT_R, 1e-9) && A.figureR > A.headBaseR * 5,
  `(${A.figureR.toFixed(3)} vs head base ${A.headBaseR.toFixed(3)})`);

check("FIGURE_HEIGHT is a footballer", FIGURE_HEIGHT > 1.6 && FIGURE_HEIGHT < 2.0,
  `(${FIGURE_HEIGHT} m)`);

if (failures) { console.log(`\n${failures} FAILED`); process.exit(1); }
console.log("\nfirst-person figure OK");
