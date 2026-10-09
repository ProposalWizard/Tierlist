import { kitMasks, HEMS, type V3 } from "../../lib/star/shop3d/kit";
import { shopDisplays } from "../../lib/star/shop3d/catalogue";

/**
 * 3D SHOP (/star-shop3d-dev) — the kit painted onto the bare 3D body, and the
 * cards' data. The page itself was filmed in a browser.
 */
const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

// A stick man standing up the y axis: pelvis at 1.0, neck 1.5, head 1.6,
// left thigh 1.0 -> knee 0.55 -> ankle 0.1 -> toe.
const names = ["pelvis", "spine_01", "neck_01", "Head", "upperarm_l", "lowerarm_l", "thigh_l", "calf_l", "foot_l", "ball_l"];
const heads: V3[] = [
  [0, 1.0, 0], [0, 1.1, 0], [0, 1.5, 0], [0, 1.6, 0],
  [0.2, 1.45, 0], [0.5, 1.45, 0],
  [0.1, 1.0, 0], [0.1, 0.55, 0], [0.1, 0.1, 0], [0.1, 0.02, 0.15],
];
const verts: { p: V3; bone: string }[] = [
  { p: [0, 1.3, 0.1], bone: "spine_01" }, // chest
  { p: [0, 1.58, 0.05], bone: "neck_01" }, // throat, above the collar
  { p: [0.3, 1.45, 0], bone: "upperarm_l" }, // top of the arm (a third down)
  { p: [0.45, 1.45, 0], bone: "upperarm_l" }, // above the elbow (five sixths down)
  { p: [0.1, 0.9, 0.05], bone: "thigh_l" }, // top of the thigh
  { p: [0.1, 0.65, 0.05], bone: "thigh_l" }, // just above the knee
  { p: [0.1, 0.5, 0.05], bone: "calf_l" }, // just under the knee
  { p: [0.1, 0.3, 0.05], bone: "calf_l" }, // shin
  { p: [0.1, 0.05, 0.1], bone: "foot_l" }, // foot
];
const positions = verts.flatMap((v) => v.p);
const skinIndex = verts.flatMap((v) => [names.indexOf(v.bone), 0, 0, 0]);
const skinWeight = verts.flatMap(() => [1, 0, 0, 0]);
const m = kitMasks({ positions, skinIndex, skinWeight, boneNames: names, boneHeads: heads });
const at = (i: number) => ({ shirt: m[i * 4], shorts: m[i * 4 + 1], socks: m[i * 4 + 2], boots: m[i * 4 + 3] });

check(at(0).shirt > 0, "the chest is in the shirt");
check(at(1).shirt < 0, "the throat is above the collar");
check(at(2).shirt > 0, "the top of the arm is in the sleeve");
check(at(3).shirt < 0, `above the elbow is bare (sleeve ends ${HEMS.sleeve} of the way down)`);
check(at(4).shorts > 0, "the top of the thigh is in the shorts");
check(at(5).shorts < 0, "just above the knee is bare");
check(at(6).socks < 0, "just under the knee is bare");
check(at(7).socks > 0 && at(7).boots < 0, "the shin is in the sock, not the boot");
check(at(8).boots > 0, "the foot is in the boot");
// The hem is a straight line: the shorts number falls evenly down the thigh.
const thighStep = at(4).shorts - at(5).shorts;
check(Math.abs(thighStep - 0.25) < 1e-6, `shorts edge is a distance in metres (got ${thighStep})`);

// The cards: every boot and car has 5 levels, dearer each level up.
const d = shopDisplays();
check(d.boots.items.length === 7, `7 boots on the wall (got ${d.boots.items.length})`);
for (const disp of [d.boots, d.car, d.counter]) {
  for (const it of disp.items) {
    check(it.levels.length === 5, `${it.name} has 5 levels`);
    for (let i = 1; i < it.levels.length; i++) check(it.levels[i].price > it.levels[i - 1].price, `${it.name} L${i + 1} costs more than L${i}`);
  }
}
check(d.cans.items[0].levels.length === 3, "the fridge has the shop's three cans");
// Old shows no homes and today's six cars; look H adds the motorbike, the jet and the nine homes.
check(d.homes.items.length === 0 && d.car.items.length === 6, "Old: six cars, no homes table");
const h = shopDisplays({}, { h: true });
check(h.car.items.map((i) => i.id).join() === "bike,car-1,car-2,suv,car-3,classic,car-4,jet", `look H: every vehicle on the turntable (got ${h.car.items.map((i) => i.id).join()})`);
check(h.homes.items.length === 9, `look H: nine homes on the model table (got ${h.homes.items.length})`);
for (const it of [...h.car.items, ...h.homes.items]) check(it.levels.length === 5, `${it.name} has 5 levels`);

if (problems.length) { console.error("shop3d FAILED:\n  " + problems.join("\n  ")); process.exit(1); }
console.log("shop3d: all passed");
