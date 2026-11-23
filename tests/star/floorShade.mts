/**
 * THE FLOOR'S BAKED SHADE (lib/star/home3d/bakeShade.ts): dark where a wall meets the floor and
 * round the edge of a thing standing on it, clear in the open middle, nothing on an open side (a
 * terrace), never darker than gentle (Harry: "the lighting and contrast is a bit much at times").
 */
import { floorShade, SHADE_WALL, SHADE_UNDER } from "../../lib/star/home3d/bakeShade";

const problems: string[] = [];
const check = (ok: boolean, what: string) => { if (!ok) problems.push(what); };

const w = 5, d = 4;
const sofa: [number, number, number, number] = [-1, 1, 0.5, 1.4];
const sh = floorShade(w, d, [sofa], ["s"]);
const at = (x: number, z: number) => {
  const i = Math.min(sh.nx - 1, Math.floor(((x + w / 2) / w) * sh.nx)), j = Math.min(sh.nz - 1, Math.floor(((z + d / 2) / d) * sh.nz));
  return sh.alpha[j * sh.nx + i];
};
const max = sh.alpha.reduce((a, b) => Math.max(a, b), 0);
check(at(0, -d / 2 + 0.02) > 0.3, `dark at the north wall's foot (${at(0, -d / 2 + 0.02).toFixed(2)})`);
check(at(-w / 2 + 0.02, -1) > 0.3, "dark at the west wall's foot");
check(at(0, d / 2 - 0.02) < 0.05, "no wall shade on the open south side");
check(at(0, -0.6) < 0.03, `clear in the open middle (${at(0, -0.6).toFixed(3)})`);
check(at(0, 0.5) > 0.3, `dark at the sofa's edge (${at(0, 0.5).toFixed(2)})`);
check(at(0, 0.4) > 0.05 && at(0, 0.4) < at(0, 0.5), "a soft fall-off out from under it");
check(at(0, -0.1) < 0.05, "gone a hand's width further out");
check(max <= 1 - (1 - SHADE_WALL) * (1 - SHADE_UNDER) + 1e-6 && max < 0.75, `never black (max ${max.toFixed(2)})`);

if (problems.length) {
  console.error(`floorShade: ${problems.length} problem(s)`);
  for (const p of problems) console.error("  ✗ " + p);
  process.exit(1);
}
console.log(`floorShade: ok (wall ${at(0, -d / 2 + 0.02).toFixed(2)}, sofa edge ${at(0, 0.5).toFixed(2)}, open floor ${at(0, -0.6).toFixed(2)}, max ${max.toFixed(2)})`);
