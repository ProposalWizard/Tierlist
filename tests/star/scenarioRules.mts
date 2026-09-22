/**
 * tests/star/scenarioRules.mts — the auto-tuner's own two new powers.
 *
 * Both came out of measuring Harry's ten tight angles:
 *
 *   A LAW CAN HOLD AT A VALUE THAT IS NOT ZERO. It used to be zero only, so
 *   a counting measure that was unanimously anything else could never become
 *   a law. All ten tight angles have the ball inside the box — "Ball is
 *   inside the box" reads 1 in every one — and it could not be enforced.
 *
 *   HOW MUCH GOAL YOU CAN SEE is a measure. Nothing computed it, which is
 *   odd for the one thing "tight angle" names: distance from the middle and
 *   distance from the goal line were both measured, but neither says how
 *   much goal is on, and it is the two together that decide.
 */

import {
  MEASURES, deriveRuleSet, violations, describeRuleSet,
  INVARIANT_AGREEMENT, MIN_SAMPLES_FOR_INVARIANT,
  type ShapeSample,
} from "../../lib/star/scenarioRules";
import { CX, GOAL_W } from "../../lib/star/pitch";

let failures = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (!ok) { failures++; console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`); }
  else console.log(`  ✓ ${name}`);
};

/** A shape with everything placed, so one measure can be varied at a time. */
const shape = (o: Partial<ShapeSample> = {}): ShapeSample => ({
  ball: { x: CX + 10, y: 5 },
  you: { x: CX + 10, y: 6.2 },
  keeper: { x: CX + 1.5, y: 1.8 },
  defenders: [{ x: CX + 7, y: 7 }],
  mates: [{ x: CX - 8, y: 9 }],
  ...o,
});

console.log("\nSCENARIO RULES");

// ── The aperture measure ────────────────────────────────────────────────
const aperture = MEASURES.find((m) => m.id === "aperture");
check("how much goal you can see is a measure at all", !!aperture);

if (aperture) {
  // Dead in front of goal on the six-yard line: almost the whole goal is on.
  const straight = aperture.of(shape({ ball: { x: CX, y: 5.5 } }));
  // Out by the corner flag: barely any.
  const wide = aperture.of(shape({ ball: { x: CX + 16, y: 2 } }));
  check("a ball in front of goal sees far more of it than one out wide",
    straight > wide * 3, `${straight.toFixed(1)}° vs ${wide.toFixed(1)}°`);
  // The known answer: from the penalty spot the goal is 2·atan(3.66/11).
  const fromSpot = aperture.of(shape({ ball: { x: CX, y: 11 } }));
  const want = 2 * Math.atan((GOAL_W / 2) / 11) * 180 / Math.PI;
  check("it agrees with the geometry from the penalty spot",
    Math.abs(fromSpot - want) < 0.01, `${fromSpot.toFixed(2)}° vs ${want.toFixed(2)}°`);
  // Moving straight back always narrows it; moving sideways always narrows it.
  const near = aperture.of(shape({ ball: { x: CX, y: 6 } }));
  const far = aperture.of(shape({ ball: { x: CX, y: 18 } }));
  check("backing away narrows it", near > far, `${near.toFixed(1)}° vs ${far.toFixed(1)}°`);
  check("it is never negative and never more than 180",
    [2, 6, 11, 30].every((y) => [0, 5, 16].every((dx) => {
      const v = aperture.of(shape({ ball: { x: CX + dx, y } }));
      return v > 0 && v < 180;
    })));
}

// ── A law at a value that is not zero ───────────────────────────────────
// Ten drawings that all agree the ball is in the box, which is what the real
// tight angles look like.
const inBoxAll = Array.from({ length: 10 }, (_, i) => shape({ ball: { x: CX + 8 + i * 0.5, y: 4 + i * 0.2 } }));
const set = deriveRuleSet("tight_angle", inBoxAll);
const boxRule = set.rules.find((r) => r.id === "inBox");
check("a measure that is unanimously ONE becomes a law", !!boxRule?.invariant);
check("…and the law records that it holds at 1, not at 0", boxRule?.at === 1, String(boxRule?.at));

const mateRule = set.rules.find((r) => r.id === "mateInShot");
check("a measure that is unanimously ZERO is still a law", !!mateRule?.invariant);
check("…and still records that it holds at 0", mateRule?.at === 0, String(mateRule?.at));

// The whole point: the law has to actually reject something.
const outOfBox = shape({ ball: { x: CX + 10, y: 30 } });
check("a ball outside the box now breaks the law",
  violations(outOfBox, set).some((v) => v.toLowerCase().includes("inside the box")),
  JSON.stringify(violations(outOfBox, set)));
check("…and one inside it breaks nothing",
  violations(shape({ ball: { x: CX + 9, y: 5 } }), set).length === 0,
  JSON.stringify(violations(shape({ ball: { x: CX + 9, y: 5 } }), set)));

// The readout has to say the real value, or it reads as the opposite.
check("the readout prints the value a law holds at",
  describeRuleSet(set).some((l) => /inside the box.*1/i.test(l)),
  describeRuleSet(set).filter((l) => /inside the box/i.test(l)).join(" | "));

// ── The bars that stop one bad drawing making a law ─────────────────────
const nineAndOne = [
  ...Array.from({ length: 9 }, () => shape({ ball: { x: CX + 9, y: 5 } })),
  shape({ ball: { x: CX + 9, y: 30 } }),          // this one is outside the box
];
const nine = deriveRuleSet("tight_angle", nineAndOne, nineAndOne.map((_, i) => `d${i}`));
const nineBox = nine.rules.find((r) => r.id === "inBox");
check(`9 of 10 still clears the ${(INVARIANT_AGREEMENT * 100).toFixed(0)}% bar`, !!nineBox?.invariant);
check("…and the one that disagrees is named as an outlier",
  nineBox?.outliers.length === 1 && nineBox.outliers[0] === "d9",
  JSON.stringify(nineBox?.outliers));

const half = Array.from({ length: 10 }, (_, i) => shape({ ball: { x: CX + 9, y: i < 5 ? 5 : 30 } }));
check("5 of 10 does not",
  !deriveRuleSet("tight_angle", half).rules.find((r) => r.id === "inBox")?.invariant);

const tooFew = Array.from({ length: MIN_SAMPLES_FOR_INVARIANT - 1 }, () => shape());
check(`fewer than ${MIN_SAMPLES_FOR_INVARIANT} drawings makes no law at all`,
  !deriveRuleSet("tight_angle", tooFew).rules.some((r) => r.invariant));

// ── A continuous measure is never a law ─────────────────────────────────
// Ten identical drawings agree on EVERY measure, including the distances.
// Only the counting ones may harden into laws — a distance is a range the
// author worked within, and ten drawings cannot have found its real edges.
const identical = Array.from({ length: 10 }, () => shape());
const same = deriveRuleSet("tight_angle", identical);
check("a distance never becomes a law, however unanimous",
  same.rules.filter((r) => r.invariant).every((r) => r.count),
  same.rules.filter((r) => r.invariant && !r.count).map((r) => r.id).join(","));

console.log(failures === 0 ? "\nAll checks passed.\n" : `\n${failures} FAILED\n`);
if (failures > 0) process.exit(1);
