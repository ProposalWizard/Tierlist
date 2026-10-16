/**
 * HITBOXES & JUMPING (Leo, 14 Oct 2026) — lib/star/hitbox.ts.
 *
 * "Hitboxes are too high, so it's really hard to chip the ball over defenders
 * or the goalie or even to shoot sometimes over a teammate's head … I want
 * jumping to actually affect the hitbox … I don't want crosses and headers
 * and blocks to be worse."
 *
 *   1. Old is exactly the engine from before the switch (fingerprint).
 *   2. The shape of a man: widest at the feet, nothing above his head.
 *   3. New: a shot or chip over a team-mate's head goes over him.
 *   4. New: a ball over a defender to the side gets by lower.
 *   5. New: a chip over a good keeper off his line needs less height.
 *   6. New: crosses, headers and blocks are not worse — and some headers
 *      are only won because the man really jumped.
 * Full numbers: docs/gameplay16/hitbox.md (npx tsx tests/star/hitboxReport.ts).
 */
import { setHitboxes, bodyReach, headTop, HITBOX_DEFAULTS, applyHitboxDials } from "../../lib/star/canvasEngine";
import { hitboxFingerprint, overMate, clearance, crosses, headers, blocks, keeperClearance } from "./hitboxHarness";

const problems: string[] = [];
const check = (ok: boolean, what: string) => { console.log(`  ${ok ? "✓" : "✗"} ${what}`); if (!ok) problems.push(what); };
const pct = (a: number, b: number) => (a / Math.max(1, b)) * 100;
const f1 = (x: number) => x.toFixed(1);
applyHitboxDials(HITBOX_DEFAULTS);

// 1. Old is Old.
setHitboxes("old");
const OLD_HASH = "7bae47a8"; // recorded 14 Oct 2026 on the engine before the switch existed
console.log("OLD IS THE ENGINE FROM BEFORE");
const fp = hitboxFingerprint();
check(fp === OLD_HASH, `1,200 seeded crosses, shots and passes give the same hash as before (${fp})`);

// 2. The shape.
console.log("THE SHAPE OF A MAN");
check(Math.abs(headTop(0) - 1.96) < 0.001, `a ball's centre touches the top of his head at ${headTop(0).toFixed(2)} m`);
check(bodyReach(1, 2.0, 0) === 0, "nothing above his head (2.0 m) while standing");
check(bodyReach(1, 2.0, 0.4) > 0, "…but he reaches it in the air");
let mono = true;
for (let z = 0; z < 1.95; z += 0.05) if (bodyReach(1, z + 0.05, 0) > bodyReach(1, z, 0) + 1e-9) mono = false;
check(mono, "his reach never grows with height");
check(bodyReach(1, 1.8, 0) < 0.5 * bodyReach(1, 0.2, 0), `at his head he reaches under half what he does at his feet (${bodyReach(1, 1.8, 0).toFixed(2)} vs ${bodyReach(1, 0.2, 0).toFixed(2)})`);

// Measure both.
const run = (mode: "old" | "new") => {
  setHitboxes(mode);
  return {
    shot: overMate("shot", 400), pass: overMate("pass", 400),
    side: clearance(3, 0.9, 12, false),
    keeper: keeperClearance(3, 90),
    cross: crosses("byline_cross", 600),
    head: headers(1200),
    blocks: [blocks("long_range", 500, 0), blocks("long_range", 500, -0.5), blocks("cutback", 500, 0)],
  };
};
const O = run("old"), N = run("new");

console.log("OVER A TEAM-MATE'S HEAD");
check(pct(O.shot.clipped, O.shot.trials) > 60 && pct(N.shot.clipped, N.shot.trials) < 45,
  `a lofted shot over him (1.6-2.8 m): he takes it ${f1(pct(O.shot.clipped, O.shot.trials))}% → ${f1(pct(N.shot.clipped, N.shot.trials))}%`);
check(pct(O.pass.clipped, O.pass.trials) > 95 && pct(N.pass.clipped, N.pass.trials) < 55,
  `a chip over him to the man behind: he takes it ${f1(pct(O.pass.clipped, O.pass.trials))}% → ${f1(pct(N.pass.clipped, N.pass.trials))}%`);

console.log("OVER A DEFENDER, A KEEPER");
check(N.side < O.side - 0.5, `a chip passing 0.9 m to the side of a defender 3 m away gets by at ${O.side} m → ${N.side} m`);
check(N.keeper < O.keeper - 0.2 && N.keeper > 2.6, `a chip over a 90 keeper 3 m off his line clears at ${O.keeper} m → ${N.keeper} m (real jump reach ~2.9-3.0)`);

console.log("CROSSES, HEADERS AND BLOCKS ARE NOT WORSE");
check(pct(N.cross.reached, N.cross.n) >= pct(O.cross.reached, O.cross.n) - 1,
  `byline crosses reach their man ${f1(pct(O.cross.reached, O.cross.n))}% → ${f1(pct(N.cross.reached, N.cross.n))}%`);
check(pct(N.cross.goals, N.cross.n) >= pct(O.cross.goals, O.cross.n) - 2,
  `…and are scored ${f1(pct(O.cross.goals, O.cross.n))}% → ${f1(pct(N.cross.goals, N.cross.n))}%`);
check(pct(N.head.reached, N.head.n) >= pct(O.head.reached, O.head.n),
  `a cross onto his head (1.4-2.8 m) reaches him ${f1(pct(O.head.reached, O.head.n))}% → ${f1(pct(N.head.reached, N.head.n))}%`);
check(pct(N.head.goals, N.head.n) >= pct(O.head.goals, O.head.n) - 4,
  `…and is scored ${f1(pct(O.head.goals, O.head.n))}% → ${f1(pct(N.head.goals, N.head.n))}% (allowed 4 pts of noise)`);
check(O.head.jumped === 0 && N.head.jumped > N.head.n * 0.1,
  `the jump is real: ${N.head.jumped} of ${N.head.n} were won above a standing man's head, in the air (Old: ${O.head.jumped})`);
const bo = O.blocks.reduce((s, b) => s + pct(b.blocked, b.n), 0) / 3, bn = N.blocks.reduce((s, b) => s + pct(b.blocked, b.n), 0) / 3;
check(bn >= bo - 1.5, `shots blocked on average ${f1(bo)}% → ${f1(bn)}%`);

setHitboxes("old");
if (problems.length) { console.log(`\n${problems.length} FAILED`); process.exit(1); }
console.log("\nhitbox: all checks pass");
